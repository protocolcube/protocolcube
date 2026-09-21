import type { JSONContent } from "@tiptap/core";
import { MarkdownManager } from "@tiptap/markdown";
import createDOMPurify from "dompurify";
import {
  ProtocolCore,
  type FormulaTestCase,
  type Protocol,
  type ProtocolInspection,
  type Section,
  type VariableDefinition,
} from "../../../domain/protocol";
import { createProtocolContentExtensions } from "../../../shared/protocol-markdown";
import { z } from "zod";

const MINIMUM_PBKDF2_ITERATIONS = 600_000;
const MAX_ENCODED_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 50_000_000;
const markdownManager = new MarkdownManager({
  extensions: createProtocolContentExtensions(),
});

export interface KeyBundle {
  documentKind: "protocol-box/key-bundle";
  formatVersion: 1;
  kdf: {
    name: "PBKDF2";
    hash: "SHA-256";
    iterations: number;
    salt: string;
  };
  cipher: {
    name: "AES-GCM";
    iv: string;
  };
  publicKeySpki: string;
  keyId: string;
  ciphertext: string;
}

const base64urlSchema = z.string().regex(/^[A-Za-z0-9_-]+$/);
const keyBundleSchema = z
  .object({
    documentKind: z.literal("protocol-box/key-bundle"),
    formatVersion: z.literal(1),
    kdf: z
      .object({
        name: z.literal("PBKDF2"),
        hash: z.literal("SHA-256"),
        iterations: z.number().int().min(MINIMUM_PBKDF2_ITERATIONS),
        salt: base64urlSchema,
      })
      .strict(),
    cipher: z
      .object({
        name: z.literal("AES-GCM"),
        iv: base64urlSchema,
      })
      .strict(),
    publicKeySpki: base64urlSchema,
    keyId: z.string().regex(/^[0-9a-f]{64}$/),
    ciphertext: base64urlSchema,
  })
  .strict();

const keyIdSchema = z.string().regex(/^[0-9a-f]{64}$/);
const draftIdSchema = z.string().uuid();

interface EncryptedDraftVersion {
  updatedAt: number;
  iv: string;
  ciphertext: string;
}

export interface EncryptedDraftRecord extends EncryptedDraftVersion {
  draftId: string;
  keyId: string;
  salt: string;
  snapshots: EncryptedDraftVersion[];
  quarantined?: boolean;
}

interface RecoveryCopyRecord {
  keyId: string;
  keyBundle: KeyBundle;
  savedAt: number;
  sourceFileName?: string;
}

const recoveryCopyRecordSchema = z
  .object({
    keyId: keyIdSchema,
    keyBundle: keyBundleSchema,
    savedAt: z.number().int().nonnegative(),
    sourceFileName: z.string().min(1).max(255).optional(),
  })
  .strict()
  .refine((record) => record.keyId === record.keyBundle.keyId, {
    message: "Recovery copy Key ID does not match its Key Bundle",
  });

export interface RecoveryCopySummary {
  keyId: string;
  savedAt: number;
  sourceFileName?: string;
}

export interface RecoveryCopy extends RecoveryCopySummary {
  keyBundle: KeyBundle;
}

interface DraftPayload {
  formatVersion: 1;
  protocol: Protocol;
  expectedAuthorKeyId?: string;
  source?: {
    fingerprint: string;
    keyId: string;
  };
}

export type WorkspaceSnapshot =
  | { mode: "locked" }
  | { mode: "unlocked"; keyId: string }
  | {
      mode: "editing";
      keyId: string;
      draft: {
        draftId: string;
        protocol: Protocol;
        source?: DraftPayload["source"];
      };
    }
  | {
      mode: "save-failed";
      keyId: string;
      error: { code: string; message: string };
      draft: {
        draftId: string;
        protocol: Protocol;
        source?: DraftPayload["source"];
      };
    };

export class AuthorWorkspaceFailure extends Error {
  constructor(
    readonly code: string,
    readonly path: string,
    message: string,
    options?: ErrorOptions,
    readonly details?: Record<string, string>,
  ) {
    super(message, options);
    this.name = "AuthorWorkspaceFailure";
  }
}

export interface AuthorWorkspaceOptions {
  databaseName: string;
  indexedDB: IDBFactory;
  scheduler?: WorkspaceScheduler;
  remoteImageLoader?: RemoteImageLoader;
  onStateChange?: (snapshot: WorkspaceSnapshot) => void;
}

export interface ImageImport {
  bytes: Uint8Array;
  mimeType: "image/png" | "image/jpeg" | "image/webp" | "image/svg+xml";
  width: number;
  height: number;
}

export type RemoteImageLoader = (url: string) => Promise<ImageImport>;

export interface PublicationFile {
  name: string;
  bytes: Uint8Array<ArrayBuffer>;
  mediaType: "text/html" | "text/plain";
  overwriteWarning: string;
}

export interface PublicationSaveAdapter {
  saveHtml(file: PublicationFile): Promise<{ name: string }>;
  saveChecksum(file: PublicationFile): Promise<{ name: string }>;
}

export interface PublishedResult {
  status: "published";
  fileName: string;
  checksumFileName: string;
  protocolFingerprint: string;
  keyId: string;
  wholeFileSha256: string;
}

function isSupportedImageMime(
  value: string | undefined,
): value is ImageImport["mimeType"] {
  return (
    value === "image/png" ||
    value === "image/jpeg" ||
    value === "image/webp" ||
    value === "image/svg+xml"
  );
}

export interface WorkspaceScheduler {
  setTimeout(
    callback: () => void | Promise<void>,
    delay: number,
  ): unknown;
  clearTimeout(handle: unknown): void;
}

function bytesToBase64url(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function hasImageSignature(
  bytes: Uint8Array,
  mimeType: "image/png" | "image/jpeg" | "image/webp",
): boolean {
  if (mimeType === "image/png") {
    return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
      (byte, index) => bytes[index] === byte,
    );
  }
  if (mimeType === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  return (
    new TextDecoder().decode(bytes.subarray(0, 4)) === "RIFF" &&
    new TextDecoder().decode(bytes.subarray(8, 12)) === "WEBP"
  );
}

function base64urlToBytes(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1) {
    throw new Error("Invalid base64url");
  }
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(
    Math.ceil(value.length / 4) * 4,
    "=",
  );
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function cspHash(content: string): Promise<string> {
  return `'sha256-${bytesToBase64(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content)),
    ),
  )}'`;
}

async function installContentSecurityPolicy(html: string): Promise<string> {
  const structuralHtml = html
    .replace(
      /(<script(?:\s[^>]*)?>)[\s\S]*?(<\/script>)/gi,
      "$1$2",
    )
    .replace(/(<style(?:\s[^>]*)?>)[\s\S]*?(<\/style>)/gi, "$1$2");
  const headMatches = [
    ...structuralHtml.matchAll(/<head(?:\s[^>]*)?>/gi),
  ];
  if (headMatches.length !== 1) {
    throw new AuthorWorkspaceFailure(
      "invalid_application_template",
      "applicationHtml",
      "Expected exactly one HTML head",
    );
  }
  const scriptHashes: string[] = [];
  for (const match of html.matchAll(
    /<script(?<attributes>\s[^>]*)?>(?<content>[\s\S]*?)<\/script>/gi,
  )) {
    const attributes = match.groups?.attributes ?? "";
    if (
      /\btype\s*=\s*["']application\/octet-stream["']/i.test(attributes)
    ) {
      continue;
    }
    scriptHashes.push(await cspHash(match.groups?.content ?? ""));
  }
  const policy = [
    "default-src 'none'",
    `script-src ${scriptHashes.join(" ") || "'none'"}`,
    `script-src-elem ${scriptHashes.join(" ") || "'none'"}`,
    "script-src-attr 'none'",
    "style-src 'unsafe-inline'",
    "style-src-elem 'unsafe-inline'",
    "style-src-attr 'unsafe-inline'",
    "img-src data:",
    "font-src data:",
    "connect-src 'none'",
    "frame-src 'none'",
    "object-src 'none'",
    "worker-src 'none'",
    "media-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
  ].join("; ");
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policy}">`;
  return html.replace(headMatches[0]![0], `${headMatches[0]![0]}${meta}`);
}

function assertSelfContainedApplicationHtml(html: string): void {
  const markup = html.replace(
    /(<script(?:\s[^>]*)?>)[\s\S]*?(<\/script>)/gi,
    "$1$2",
  );
  const hasExternalAttribute =
    /\b(?:src|href|data|poster)\s*=\s*["']\s*(?:https?:)?\/\//i.test(markup);
  const hasRuntimeSource =
    /<script\b[^>]*\bsrc\s*=/i.test(markup) ||
    /<link\b(?=[^>]*\brel\s*=\s*["']?stylesheet\b)[^>]*>/i.test(markup) ||
    /<(?:iframe|frame|object|embed|video|audio|source|track)\b/i.test(markup);
  const hasNonEmbeddedResource =
    /\b(?:src|href|data|poster)\s*=\s*["']\s*(?!data:|#)[^"']+/i.test(markup);
  const hasRemoteCss =
    /(?:@import\s+|url\s*\(\s*["']?\s*)(?:https?:)?\/\//i.test(html);
  if (
    hasExternalAttribute ||
    hasRuntimeSource ||
    hasNonEmbeddedResource ||
    hasRemoteCss
  ) {
    throw new AuthorWorkspaceFailure(
      "external_runtime_resource",
      "applicationHtml",
      "Published Protocol application resources must be self-contained",
    );
  }
}

function publicationWriteFailure(
  cause: unknown,
  path: "htmlFile" | "checksumFile",
  details?: Record<string, string>,
): AuthorWorkspaceFailure {
  if (path === "checksumFile") {
    return new AuthorWorkspaceFailure(
      "partial_publication",
      path,
      "The HTML was written, but its checksum file was not",
      { cause },
      details,
    );
  }
  if (cause instanceof DOMException && cause.name === "AbortError") {
    return new AuthorWorkspaceFailure(
      "publication_cancelled",
      path,
      "Publication was cancelled before the HTML was written",
      { cause },
    );
  }
  if (cause instanceof DOMException && cause.name === "NotAllowedError") {
    return new AuthorWorkspaceFailure(
      "publication_permission_denied",
      path,
      "Permission to write the Published Protocol was denied",
      { cause },
    );
  }
  return new AuthorWorkspaceFailure(
    "publication_write_failed",
    path,
    "The Published Protocol HTML could not be written",
    { cause },
  );
}

function keyBundleAuthenticatedData(
  bundle: Omit<KeyBundle, "ciphertext">,
): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(JSON.stringify(bundle));
}

async function derivePassphraseMaterial(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const passphraseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt, iterations },
      passphraseKey,
      256,
    ),
  );
}

async function importAesKey(
  material: Uint8Array<ArrayBuffer>,
  usages: KeyUsage[],
): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", material, "AES-GCM", false, usages);
}

async function keyIdForSpki(spki: string): Promise<string> {
  return bytesToHex(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", base64urlToBytes(spki)),
    ),
  );
}

async function verifyKeyPair(
  privateKey: CryptoKey,
  publicKey: CryptoKey,
): Promise<boolean> {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    challenge,
  );
  return crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    publicKey,
    signature,
    challenge,
  );
}

function openDatabase(
  indexedDB: IDBFactory,
  databaseName: string,
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 3);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("drafts")) {
        database.createObjectStore("drafts", { keyPath: "draftId" });
      }
      if (!database.objectStoreNames.contains("recoveryCopies")) {
        database.createObjectStore("recoveryCopies", { keyPath: "keyId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function recoveryCopySummary(record: RecoveryCopyRecord): RecoveryCopySummary {
  return {
    keyId: record.keyId,
    savedAt: record.savedAt,
    ...(record.sourceFileName === undefined
      ? {}
      : { sourceFileName: record.sourceFileName }),
  };
}

function parseRecoveryCopyRecord(value: unknown): RecoveryCopyRecord {
  const parsed = recoveryCopyRecordSchema.safeParse(value);
  if (!parsed.success) {
    throw new AuthorWorkspaceFailure(
      "invalid_recovery_copy_record",
      "recoveryCopy",
      "The stored Browser Key Bundle Recovery Copy is malformed",
    );
  }
  return parsed.data;
}

function validateRecoverySourceFileName(value: string | undefined): void {
  if (
    value !== undefined &&
    (typeof value !== "string" ||
      value.trim().length === 0 ||
      value.length > 255 ||
      /[\\/\u0000-\u001f\u007f]/.test(value))
  ) {
    throw new AuthorWorkspaceFailure(
      "invalid_recovery_copy_source_file_name",
      "sourceFileName",
      "Recovery Copy source file names cannot contain paths or control characters",
    );
  }
}

async function normalizeKeyBundleForRecovery(
  bundleInput: unknown,
): Promise<KeyBundle> {
  const parsed = keyBundleSchema.safeParse(bundleInput);
  if (!parsed.success) {
    throw new AuthorWorkspaceFailure(
      "invalid_key_bundle",
      "keyBundle",
      "Unsupported or malformed Key Bundle",
    );
  }

  try {
    const [keyId] = await Promise.all([
      keyIdForSpki(parsed.data.publicKeySpki),
      ProtocolCore.importPublicKeySpki(parsed.data.publicKeySpki),
      base64urlToBytes(parsed.data.kdf.salt),
      base64urlToBytes(parsed.data.cipher.iv),
      base64urlToBytes(parsed.data.ciphertext),
    ]);
    if (keyId !== parsed.data.keyId) {
      throw new Error("Key ID does not match public key");
    }
  } catch (cause) {
    throw new AuthorWorkspaceFailure(
      "invalid_key_bundle",
      "keyBundle",
      "Unsupported or malformed Key Bundle",
      { cause },
    );
  }

  return structuredClone(parsed.data);
}

const browserRemoteImageLoader: RemoteImageLoader = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Image download failed with HTTP ${response.status}`);
  }
  const mimeType = response.headers.get("content-type")?.split(";", 1)[0];
  if (!isSupportedImageMime(mimeType)) {
    throw new Error("Remote response is not a supported image");
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  const bitmap = await createImageBitmap(new Blob([bytes], { type: mimeType }));
  const result = {
    bytes,
    mimeType,
    width: bitmap.width,
    height: bitmap.height,
  };
  bitmap.close();
  return result;
};

export class AuthorWorkspace {
  static async open(options: AuthorWorkspaceOptions): Promise<AuthorWorkspace> {
    const database = await openDatabase(options.indexedDB, options.databaseName);
    const scheduler: WorkspaceScheduler =
      options.scheduler ??
      {
        setTimeout(callback, delay) {
          return globalThis.setTimeout(() => void callback(), delay);
        },
        clearTimeout(handle) {
          globalThis.clearTimeout(
            handle as ReturnType<typeof globalThis.setTimeout>,
          );
        },
      };
    return new AuthorWorkspace(
      database,
      scheduler,
      options.remoteImageLoader ?? browserRemoteImageLoader,
      options.onStateChange,
    );
  }

  private privateKey?: CryptoKey;
  private publicKey?: CryptoKey;
  private draftRootKey?: CryptoKey;
  private keyId?: string;
  private unlockedKeyBundle?: KeyBundle;
  private draft?: {
    draftId: string;
    payload: DraftPayload;
  };
  private inactivityHandle?: unknown;
  private saveFailure?: AuthorWorkspaceFailure;

  private constructor(
    private readonly database: IDBDatabase,
    private readonly scheduler: WorkspaceScheduler,
    private readonly remoteImageLoader: RemoteImageLoader,
    private readonly onStateChange?: (snapshot: WorkspaceSnapshot) => void,
  ) {}

  async calibrateKeyBundleIterations(input: {
    passphrase: string;
    targetMilliseconds?: number;
  }): Promise<number> {
    const target = Math.min(
      1_000,
      Math.max(500, input.targetMilliseconds ?? 750),
    );
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const startedAt = performance.now();
    const material = await derivePassphraseMaterial(
      input.passphrase,
      salt,
      MINIMUM_PBKDF2_ITERATIONS,
    );
    const elapsed = Math.max(performance.now() - startedAt, 1);
    material.fill(0);
    return Math.max(
      MINIMUM_PBKDF2_ITERATIONS,
      Math.ceil((MINIMUM_PBKDF2_ITERATIONS * target) / elapsed),
    );
  }

  normalizeMarkdown(markdown: string): {
    markdown: string;
    content: JSONContent;
  } {
    const markdownOutsideCode = markdown
      .replace(/(^|\n)(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\2(?=\n|$)/g, "$1")
      .replace(/(`+)[^`\n]*\1/g, "")
      .replace(/<(?:https?|mailto):[^>\n]+>/gi, "");
    if (/<\/?[A-Za-z][^>]*>/.test(markdownOutsideCode)) {
      throw new AuthorWorkspaceFailure(
        "raw_html_forbidden",
        "markdown",
        "Raw HTML is not supported in Protocol Markdown",
      );
    }
    const content = markdownManager.parse(markdown);
    return {
      markdown: markdownManager.serialize(content).trimEnd(),
      content,
    };
  }

  interpolateMarkdown(
    markdown: string,
    values: Record<string, string | boolean>,
  ): string {
    const interpolated = markdown.replace(
      /{{\s*([A-Za-z_][A-Za-z0-9_]*)\s*}}/g,
      (_match, id: string) => {
        const value = values[id];
        if (value === undefined) {
          throw new AuthorWorkspaceFailure(
            "unknown_interpolation",
            "markdown",
            `Unknown Variable Definition: ${id}`,
          );
        }
        return String(value)
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replace(/\r?\n/g, " ")
          .replace(/[\\`*_[\]{}]/g, "\\$&");
      },
    );
    if (interpolated.includes("{{") || interpolated.includes("}}")) {
      throw new AuthorWorkspaceFailure(
        "malformed_interpolation",
        "markdown",
        "Interpolation must use {{ variableName }} syntax",
      );
    }
    return interpolated;
  }

  sanitizePastedHtml(html: string): string {
    if (typeof window === "undefined" || typeof document === "undefined") {
      throw new AuthorWorkspaceFailure(
        "dom_unavailable",
        "html",
        "Rich-text paste requires a browser DOM",
      );
    }
    const purifier = createDOMPurify(window);
    const sanitized = purifier.sanitize(html, {
      ALLOWED_TAGS: [
        "p",
        "br",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "strong",
        "em",
        "s",
        "ul",
        "ol",
        "li",
        "blockquote",
        "pre",
        "code",
        "table",
        "thead",
        "tbody",
        "tr",
        "th",
        "td",
        "a",
        "img",
        "input",
      ],
      ALLOWED_ATTR: [
        "href",
        "title",
        "src",
        "alt",
        "colspan",
        "rowspan",
        "type",
        "checked",
        "data-type",
        "data-checked",
      ],
      FORBID_TAGS: ["script", "iframe", "style", "object", "embed"],
      FORBID_ATTR: ["style", "class", "id"],
    });
    const template = document.createElement("template");
    template.innerHTML = sanitized;
    for (const anchor of template.content.querySelectorAll("a")) {
      const href = anchor.getAttribute("href");
      if (href === null || !/^(?:https?|mailto):/i.test(href)) {
        anchor.removeAttribute("href");
      }
    }
    for (const image of template.content.querySelectorAll("img")) {
      image.remove();
    }
    return template.innerHTML;
  }

  sanitizeSvg(svg: string): string {
    if (typeof window === "undefined" || typeof document === "undefined") {
      throw new AuthorWorkspaceFailure(
        "dom_unavailable",
        "svg",
        "SVG import requires a browser DOM",
      );
    }
    const purifier = createDOMPurify(window);
    const sanitized = purifier.sanitize(svg, {
      USE_PROFILES: { svg: true, svgFilters: true },
      FORBID_TAGS: [
        "script",
        "foreignObject",
        "iframe",
        "style",
        "animate",
        "animateMotion",
        "animateTransform",
        "set",
      ],
      FORBID_ATTR: ["style"],
    });
    const template = document.createElement("template");
    template.innerHTML = sanitized;
    const root = template.content.firstElementChild;
    if (root?.tagName.toLowerCase() !== "svg") {
      throw new AuthorWorkspaceFailure(
        "invalid_svg",
        "svg",
        "Imported SVG must contain one SVG root",
      );
    }
    const elements = [root, ...root.querySelectorAll("*")];
    for (const element of elements) {
      for (const attribute of ["href", "xlink:href"]) {
        const value = element.getAttribute(attribute);
        if (value !== null && !value.startsWith("#")) {
          element.removeAttribute(attribute);
        }
      }
    }
    for (const element of elements) {
      for (const attribute of [...element.attributes]) {
        if (
          /url\s*\(/i.test(attribute.value) ||
          /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(attribute.value)
        ) {
          element.removeAttribute(attribute.name);
        }
      }
    }
    return root.outerHTML;
  }

  importImage(input: ImageImport): string {
    if (
      !Number.isSafeInteger(input.width) ||
      !Number.isSafeInteger(input.height) ||
      input.width <= 0 ||
      input.height <= 0 ||
      input.width * input.height > MAX_IMAGE_PIXELS
    ) {
      throw new AuthorWorkspaceFailure(
        "image_dimensions_exceeded",
        "image",
        "Images must not exceed 50 megapixels",
      );
    }

    let bytes = input.bytes;
    if (input.mimeType === "image/svg+xml") {
      bytes = new TextEncoder().encode(
        this.sanitizeSvg(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
      );
    } else if (!hasImageSignature(bytes, input.mimeType)) {
      throw new AuthorWorkspaceFailure(
        "image_format_mismatch",
        "image",
        "The declared image type does not match its contents",
      );
    }

    const encoded = bytesToBase64(bytes);
    if (encoded.length > MAX_ENCODED_IMAGE_BYTES) {
      throw new AuthorWorkspaceFailure(
        "image_size_exceeded",
        "image",
        "Encoded images must not exceed 5 MB",
      );
    }
    return `data:${input.mimeType};base64,${encoded}`;
  }

  async importRemoteImage(input: {
    url: string;
    confirmed: boolean;
  }): Promise<string> {
    if (!input.confirmed) {
      throw new AuthorWorkspaceFailure(
        "remote_image_confirmation_required",
        "image.url",
        "The Author must confirm before downloading a remote image",
      );
    }
    if (!/^https?:\/\//i.test(input.url)) {
      throw new AuthorWorkspaceFailure(
        "invalid_remote_image_url",
        "image.url",
        "Remote images require an HTTP or HTTPS URL",
      );
    }
    try {
      return this.importImage(await this.remoteImageLoader(input.url));
    } catch (cause) {
      if (cause instanceof AuthorWorkspaceFailure) throw cause;
      throw new AuthorWorkspaceFailure(
        "remote_image_download_failed",
        "image.url",
        "The remote image could not be downloaded",
        { cause },
      );
    }
  }

  async createKeyBundle(input: {
    privateKeyPkcs8: string;
    publicKeySpki: string;
    passphrase: string;
    iterations: number;
  }): Promise<KeyBundle> {
    if (input.iterations < MINIMUM_PBKDF2_ITERATIONS) {
      throw new AuthorWorkspaceFailure(
        "weak_kdf",
        "iterations",
        `PBKDF2 requires at least ${MINIMUM_PBKDF2_ITERATIONS} iterations`,
      );
    }
    const [privateKey, publicKey] = await Promise.all([
      ProtocolCore.importPrivateKeyPkcs8(input.privateKeyPkcs8),
      ProtocolCore.importPublicKeySpki(input.publicKeySpki),
    ]);
    if (!(await verifyKeyPair(privateKey, publicKey))) {
      throw new AuthorWorkspaceFailure(
        "key_mismatch",
        "publicKeySpki",
        "The PKCS#8 private key does not match the SPKI public key",
      );
    }

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const keyId = await keyIdForSpki(input.publicKeySpki);
    const metadata: Omit<KeyBundle, "ciphertext"> = {
      documentKind: "protocol-box/key-bundle",
      formatVersion: 1,
      kdf: {
        name: "PBKDF2",
        hash: "SHA-256",
        iterations: input.iterations,
        salt: bytesToBase64url(salt),
      },
      cipher: {
        name: "AES-GCM",
        iv: bytesToBase64url(iv),
      },
      publicKeySpki: input.publicKeySpki,
      keyId,
    };
    const material = await derivePassphraseMaterial(
      input.passphrase,
      salt,
      input.iterations,
    );
    try {
      const encryptionKey = await importAesKey(material, ["encrypt"]);
      const ciphertext = await crypto.subtle.encrypt(
        {
          name: "AES-GCM",
          iv,
          additionalData: keyBundleAuthenticatedData(metadata),
        },
        encryptionKey,
        base64urlToBytes(input.privateKeyPkcs8),
      );
      return {
        ...metadata,
        ciphertext: bytesToBase64url(new Uint8Array(ciphertext)),
      };
    } finally {
      material.fill(0);
    }
  }

  async unlockKeyBundle(
    bundleInput: unknown,
    passphrase: string,
  ): Promise<void> {
    const parsed = keyBundleSchema.safeParse(bundleInput);
    if (!parsed.success) {
      throw new AuthorWorkspaceFailure(
        "invalid_key_bundle",
        "keyBundle",
        "Unsupported or malformed Key Bundle",
      );
    }
    const bundle = parsed.data;

    let material: Uint8Array<ArrayBuffer> | undefined;
    try {
      material = await derivePassphraseMaterial(
        passphrase,
        base64urlToBytes(bundle.kdf.salt),
        bundle.kdf.iterations,
      );
      const encryptionKey = await importAesKey(material, ["decrypt"]);
      const { ciphertext: _ciphertext, ...metadata } = bundle;
      const privateKeyBytes = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: base64urlToBytes(bundle.cipher.iv),
          additionalData: keyBundleAuthenticatedData(metadata),
        },
        encryptionKey,
        base64urlToBytes(bundle.ciphertext),
      );
      const [privateKey, publicKey] = await Promise.all([
        ProtocolCore.importPrivateKeyPkcs8(
          bytesToBase64url(new Uint8Array(privateKeyBytes)),
        ),
        ProtocolCore.importPublicKeySpki(bundle.publicKeySpki),
      ]);
      if (
        bundle.keyId !== (await keyIdForSpki(bundle.publicKeySpki)) ||
        !(await verifyKeyPair(privateKey, publicKey))
      ) {
        throw new Error("Key metadata mismatch");
      }
      this.privateKey = privateKey;
      this.publicKey = publicKey;
      this.draftRootKey = await crypto.subtle.importKey(
        "raw",
        material,
        "HKDF",
        false,
        ["deriveKey"],
      );
      this.keyId = bundle.keyId;
      this.unlockedKeyBundle = structuredClone(bundle);
      this.draft = undefined;
      this.recordActivity();
      this.notifyStateChange();
    } catch (cause) {
      throw new AuthorWorkspaceFailure(
        "key_bundle_unlock_failed",
        "keyBundle",
        "The Key Bundle password or authenticated contents are invalid",
        { cause },
      );
    } finally {
      material?.fill(0);
    }
  }

  async listRecoveryCopies(): Promise<RecoveryCopySummary[]> {
    const transaction = this.database.transaction("recoveryCopies", "readonly");
    const records = await requestResult(
      transaction.objectStore("recoveryCopies").getAll(),
    );
    return (records as unknown[])
      .map(parseRecoveryCopyRecord)
      .map((record) => recoveryCopySummary(record));
  }

  async retrieveRecoveryCopy(keyId: string): Promise<RecoveryCopy> {
    this.validateKeyId(keyId, "keyId");
    const transaction = this.database.transaction("recoveryCopies", "readonly");
    const value = await requestResult(
      transaction.objectStore("recoveryCopies").get(keyId),
    );
    if (value === undefined) {
      throw new AuthorWorkspaceFailure(
        "recovery_copy_not_found",
        "keyId",
        "Browser Key Bundle Recovery Copy was not found",
      );
    }
    const record = parseRecoveryCopyRecord(value);
    return {
      ...recoveryCopySummary(record),
      keyBundle: structuredClone(record.keyBundle),
    };
  }

  async cacheRecoveryCopy(
    bundleInput: unknown,
    options: { replace?: boolean; sourceFileName?: string } = {},
  ): Promise<RecoveryCopySummary> {
    const { keyId } = this.requireUnlocked();
    validateRecoverySourceFileName(options.sourceFileName);
    const keyBundle = await normalizeKeyBundleForRecovery(bundleInput);
    if (keyBundle.keyId !== keyId) {
      throw new AuthorWorkspaceFailure(
        "recovery_copy_key_mismatch",
        "keyBundle.keyId",
        "The Recovery Copy must use the currently unlocked Author Key",
      );
    }
    if (
      this.unlockedKeyBundle === undefined ||
      JSON.stringify(keyBundle) !== JSON.stringify(this.unlockedKeyBundle)
    ) {
      throw new AuthorWorkspaceFailure(
        "recovery_copy_not_validated",
        "keyBundle",
        "Unlock this exact Key Bundle successfully before caching it",
      );
    }

    const transaction = this.database.transaction(
      "recoveryCopies",
      "readwrite",
    );
    const store = transaction.objectStore("recoveryCopies");
    const existingValue = await requestResult(store.get(keyId));
    if (existingValue !== undefined) {
      const existing = parseRecoveryCopyRecord(existingValue);
      if (JSON.stringify(existing.keyBundle) === JSON.stringify(keyBundle)) {
        return recoveryCopySummary(existing);
      }
      if (options.replace !== true) {
        throw new AuthorWorkspaceFailure(
          "recovery_copy_replacement_required",
          "replace",
          "An existing Recovery Copy for this Author Key requires explicit replacement",
        );
      }
    }

    const record: RecoveryCopyRecord = {
      keyId,
      keyBundle: structuredClone(keyBundle),
      savedAt: Date.now(),
      ...(options.sourceFileName === undefined
        ? {}
        : { sourceFileName: options.sourceFileName }),
    };
    await requestResult(store.put(record));
    return recoveryCopySummary(record);
  }

  async forgetRecoveryCopy(keyId: string): Promise<void> {
    this.validateKeyId(keyId, "keyId");
    const transaction = this.database.transaction(
      "recoveryCopies",
      "readwrite",
    );
    const store = transaction.objectStore("recoveryCopies");
    const existing = await requestResult(store.get(keyId));
    if (existing === undefined) {
      throw new AuthorWorkspaceFailure(
        "recovery_copy_not_found",
        "keyId",
        "Browser Key Bundle Recovery Copy was not found",
      );
    }
    parseRecoveryCopyRecord(existing);
    await requestResult(store.delete(keyId));
  }

  async forgetAllRecoveryCopies(): Promise<void> {
    const transaction = this.database.transaction(
      "recoveryCopies",
      "readwrite",
    );
    await requestResult(transaction.objectStore("recoveryCopies").clear());
  }

  async identifyDraft(draftId: string): Promise<{ draftId: string; keyId: string }> {
    const parsedDraftId = draftIdSchema.safeParse(draftId);
    if (!parsedDraftId.success) {
      throw new AuthorWorkspaceFailure(
        "invalid_draft_id",
        "draftId",
        "Draft ID must be a UUID",
      );
    }
    const transaction = this.database.transaction("drafts", "readonly");
    const record = await requestResult(
      transaction.objectStore("drafts").get(parsedDraftId.data),
    );
    if (record === undefined) {
      throw new AuthorWorkspaceFailure(
        "draft_not_found",
        "draftId",
        "Unsigned Draft was not found",
      );
    }
    const index = z
      .object({ draftId: draftIdSchema, keyId: keyIdSchema })
      .passthrough()
      .safeParse(record);
    if (!index.success || index.data.draftId !== parsedDraftId.data) {
      throw new AuthorWorkspaceFailure(
        "invalid_draft_record",
        "draftId",
        "The stored Unsigned Draft index is malformed",
      );
    }
    return { draftId: index.data.draftId, keyId: index.data.keyId };
  }

  async listDrafts(): Promise<
    Array<{
      draftId: string;
      keyId: string;
      updatedAt: number;
      status: "available" | "quarantined";
      title?: string;
      source?: DraftPayload["source"];
    }>
  > {
    const { draftRootKey, keyId } = this.requireUnlocked();
    const transaction = this.database.transaction("drafts", "readonly");
    const records = (await requestResult(
      transaction.objectStore("drafts").getAll(),
    )) as EncryptedDraftRecord[];
    const matchingRecords = records.filter((record) => record.keyId === keyId);

    return Promise.all(
      matchingRecords.map(async (record) => {
        if (record.quarantined) {
          return {
            draftId: record.draftId,
            keyId: record.keyId,
            updatedAt: record.updatedAt,
            status: "quarantined" as const,
          };
        }

        try {
          const draftKey = await this.deriveDraftKey(
            draftRootKey,
            base64urlToBytes(record.salt),
            record.draftId,
          );
          const plaintext = await crypto.subtle.decrypt(
            {
              name: "AES-GCM",
              iv: base64urlToBytes(record.iv),
              additionalData: new TextEncoder().encode(
                `${record.draftId}:${keyId}:1`,
              ),
            },
            draftKey,
            base64urlToBytes(record.ciphertext),
          );
          const payload = JSON.parse(
            new TextDecoder("utf-8", { fatal: true }).decode(plaintext),
          ) as DraftPayload;
          return {
            draftId: record.draftId,
            keyId: record.keyId,
            updatedAt: record.updatedAt,
            status: "available" as const,
            title: payload.protocol.title,
            ...(payload.source === undefined
              ? {}
              : { source: structuredClone(payload.source) }),
          };
        } catch {
          const writeTransaction = this.database.transaction(
            "drafts",
            "readwrite",
          );
          await requestResult(
            writeTransaction
              .objectStore("drafts")
              .put({ ...record, quarantined: true }),
          );
          return {
            draftId: record.draftId,
            keyId: record.keyId,
            updatedAt: record.updatedAt,
            status: "quarantined" as const,
          };
        }
      }),
    );
  }

  async createDraft(protocol: Protocol): Promise<{ draftId: string }> {
    this.requireUnlocked();
    const draftId = crypto.randomUUID();
    this.draft = {
      draftId,
      payload: {
        formatVersion: 1,
        protocol: structuredClone(protocol),
        expectedAuthorKeyId: this.keyId,
      },
    };
    this.notifyStateChange();
    return { draftId };
  }

  async importPublishedProtocol(
    html: string,
    options: { fork?: boolean } = {},
  ): Promise<{ draftId: string }> {
    const { keyId: currentKeyId } = this.requireUnlocked();
    const decoded = ProtocolCore.extractEnvelope(html);
    if (!decoded.ok) {
      throw new AuthorWorkspaceFailure(
        "invalid_published_protocol",
        "publishedProtocol",
        decoded.errors.map((error) => error.message).join("; "),
      );
    }
    const inspection = await ProtocolCore.inspectEnvelope(decoded.envelope);
    if (
      decoded.envelope.documentKind !== "protocol-box/published-protocol" ||
      inspection.format !== "valid" ||
      inspection.signature !== "match" ||
      inspection.protocol === undefined
    ) {
      throw new AuthorWorkspaceFailure(
        "invalid_published_protocol",
        "publishedProtocol",
        "A valid Published Protocol with a matching signature is required",
      );
    }

    const sourceFingerprint = await ProtocolCore.fingerprintProtocol(
      inspection.protocol,
    );
    const sourceKeyId = decoded.envelope.signature.keyId;
    if (sourceKeyId !== currentKeyId && options.fork !== true) {
      throw new AuthorWorkspaceFailure(
        "fork_required",
        "publishedProtocol",
        "A Protocol signed by another Author must be explicitly Forked",
      );
    }
    const imported = structuredClone(inspection.protocol);
    if (options.fork === true) {
      imported.protocolId = crypto.randomUUID();
      imported.derivedFromFingerprint = sourceFingerprint;
    }
    const draftId = crypto.randomUUID();
    this.draft = {
      draftId,
      payload: {
        formatVersion: 1,
        protocol: imported,
        expectedAuthorKeyId: currentKeyId,
        source: {
          fingerprint: sourceFingerprint,
          keyId: sourceKeyId,
        },
      },
    };
    this.recordActivity();
    this.notifyStateChange();
    return { draftId };
  }

  updateProtocol(protocol: Protocol): void {
    this.requireUnlocked();
    if (this.draft === undefined) {
      throw new AuthorWorkspaceFailure(
        "no_open_draft",
        "draft",
        "No Unsigned Draft is open",
      );
    }
    this.draft.payload.protocol = structuredClone(protocol);
    this.recordActivity();
  }

  addSection(section: Omit<Section, "sectionId">): string {
    const draft = this.requireDraft();
    const sectionId = crypto.randomUUID();
    draft.payload.protocol.sections.push({
      ...structuredClone(section),
      sectionId,
      markdown: this.normalizeMarkdown(section.markdown).markdown,
    });
    this.recordActivity();
    return sectionId;
  }

  updateSection(
    sectionId: string,
    update: Partial<Omit<Section, "sectionId">>,
  ): void {
    const draft = this.requireDraft();
    const index = draft.payload.protocol.sections.findIndex(
      (section) => section.sectionId === sectionId,
    );
    const current = draft.payload.protocol.sections[index];
    if (current === undefined) {
      throw new AuthorWorkspaceFailure(
        "section_not_found",
        "sectionId",
        "Section was not found",
      );
    }
    const updatedSection: Section = {
      ...current,
      ...structuredClone(update),
      sectionId,
      ...(update.markdown === undefined
        ? {}
        : { markdown: this.normalizeMarkdown(update.markdown).markdown }),
    };
    if (
      Object.hasOwn(update, "completionRequirement") &&
      update.completionRequirement === undefined
    ) {
      delete updatedSection.completionRequirement;
    }
    draft.payload.protocol.sections[index] = updatedSection;
    this.recordActivity();
  }

  removeSection(sectionId: string): void {
    const draft = this.requireDraft();
    const index = draft.payload.protocol.sections.findIndex(
      (section) => section.sectionId === sectionId,
    );
    if (index < 0) {
      throw new AuthorWorkspaceFailure(
        "section_not_found",
        "sectionId",
        "Section was not found",
      );
    }
    draft.payload.protocol.sections.splice(index, 1);
    this.recordActivity();
  }

  copySection(sectionId: string): string {
    const draft = this.requireDraft();
    const source = draft.payload.protocol.sections.find(
      (section) => section.sectionId === sectionId,
    );
    if (source === undefined) {
      throw new AuthorWorkspaceFailure(
        "section_not_found",
        "sectionId",
        "Section was not found",
      );
    }
    const copiedId = crypto.randomUUID();
    const sourceIndex = draft.payload.protocol.sections.indexOf(source);
    draft.payload.protocol.sections.splice(sourceIndex + 1, 0, {
      ...structuredClone(source),
      sectionId: copiedId,
    });
    this.recordActivity();
    return copiedId;
  }

  reorderSection(sectionId: string, targetIndex: number): void {
    const draft = this.requireDraft();
    const sourceIndex = draft.payload.protocol.sections.findIndex(
      (section) => section.sectionId === sectionId,
    );
    if (
      sourceIndex < 0 ||
      !Number.isInteger(targetIndex) ||
      targetIndex < 0 ||
      targetIndex >= draft.payload.protocol.sections.length
    ) {
      throw new AuthorWorkspaceFailure(
        "invalid_section_order",
        "targetIndex",
        "Section and target position must exist",
      );
    }
    const [section] = draft.payload.protocol.sections.splice(sourceIndex, 1);
    draft.payload.protocol.sections.splice(targetIndex, 0, section!);
    this.recordActivity();
  }

  replaceVariables(variables: VariableDefinition[]): void {
    const draft = this.requireDraft();
    draft.payload.protocol.variables = structuredClone(variables);
    this.recordActivity();
  }

  replaceFormulaTestCases(formulaTestCases: FormulaTestCase[]): void {
    const draft = this.requireDraft();
    draft.payload.protocol.formulaTestCases =
      structuredClone(formulaTestCases);
    this.recordActivity();
  }

  inspectDraft(): ProtocolInspection {
    return ProtocolCore.inspectProtocol(this.requireDraft().payload.protocol);
  }

  async publishCurrentDraft(input: {
    applicationHtml: string;
    appVersion: string;
    fileName: string;
    saveAdapter: PublicationSaveAdapter;
  }): Promise<PublishedResult> {
    const { privateKey, publicKey, keyId } = this.requireUnlocked();
    const draft = this.requireDraft();
    this.recordActivity();
    const inspection = ProtocolCore.inspectProtocol(draft.payload.protocol);
    if (inspection.format !== "valid" || !inspection.playable) {
      throw new AuthorWorkspaceFailure(
        "protocol_not_playable",
        "draft.protocol",
        "Only a Playable Protocol can be published",
      );
    }
    if (draft.payload.expectedAuthorKeyId !== keyId) {
      throw new AuthorWorkspaceFailure(
        "author_key_mismatch",
        "draft.expectedAuthorKeyId",
        "Unlock the Author Key expected by this Draft before publishing",
      );
    }
    assertSelfContainedApplicationHtml(input.applicationHtml);
    const signature = await ProtocolCore.signProtocol(
      draft.payload.protocol,
      privateKey,
      publicKey,
    );
    const envelope = ProtocolCore.encodeEnvelope({
      documentKind: "protocol-box/published-protocol",
      formatVersion: 1,
      appVersion: input.appVersion,
      protocol: structuredClone(draft.payload.protocol),
      signature,
    });
    const dataBlockPattern =
      /(<script id="protocol-box-data" type="application\/octet-stream">)[\s\S]*?(<\/script>)/g;
    const matches = [...input.applicationHtml.matchAll(dataBlockPattern)];
    if (matches.length !== 1) {
      throw new AuthorWorkspaceFailure(
        "invalid_application_template",
        "applicationHtml",
        "Expected exactly one fixed Protocol Box data block",
      );
    }
    let publishedHtml = input.applicationHtml.replace(
      dataBlockPattern,
      `$1${envelope}$2`,
    );
    publishedHtml = await installContentSecurityPolicy(publishedHtml);
    const htmlBytes = new TextEncoder().encode(publishedHtml);
    const publicationInspection = ProtocolCore.inspectProtocol(
      draft.payload.protocol,
      { publishedHtmlBytes: htmlBytes.byteLength },
    );
    if (
      publicationInspection.errors.some(
        (error) =>
          error.code === "resource_limit" && error.path === "publishedHtml",
      )
    ) {
      throw new AuthorWorkspaceFailure(
        "publication_resource_limit",
        "publishedHtml",
        "Published Protocol HTML may not exceed 25 MB",
      );
    }
    const wholeFileSha256 = bytesToHex(
      new Uint8Array(await crypto.subtle.digest("SHA-256", htmlBytes)),
    );
    let savedHtml: { name: string };
    try {
      savedHtml = await input.saveAdapter.saveHtml({
        name: input.fileName,
        bytes: htmlBytes,
        mediaType: "text/html",
        overwriteWarning:
          "Overwriting a Published Protocol is irreversible; save a new version instead.",
      });
    } catch (cause) {
      throw publicationWriteFailure(cause, "htmlFile");
    }
    const checksumFileName = `${savedHtml.name}.sha256`;
    let savedChecksum: { name: string };
    try {
      savedChecksum = await input.saveAdapter.saveChecksum({
        name: checksumFileName,
        bytes: new TextEncoder().encode(
          `${wholeFileSha256}  ${savedHtml.name}\n`,
        ),
        mediaType: "text/plain",
        overwriteWarning:
          "Overwriting a checksum may break trusted distribution verification.",
      });
    } catch (cause) {
      throw publicationWriteFailure(cause, "checksumFile", {
        fileName: savedHtml.name,
        wholeFileSha256,
      });
    }

    const deleteTransaction = this.database.transaction("drafts", "readwrite");
    await requestResult(
      deleteTransaction.objectStore("drafts").delete(draft.draftId),
    );
    this.draft = undefined;
    this.notifyStateChange();
    return {
      status: "published",
      fileName: savedHtml.name,
      checksumFileName: savedChecksum.name,
      protocolFingerprint: await ProtocolCore.fingerprintProtocol(
        draft.payload.protocol,
      ),
      keyId,
      wholeFileSha256,
    };
  }

  async saveDraft(): Promise<void> {
    try {
      await this.persistDraft();
      this.saveFailure = undefined;
      this.notifyStateChange();
    } catch (cause) {
      if (
        cause instanceof AuthorWorkspaceFailure &&
        cause.code === "no_open_draft"
      ) {
        throw cause;
      }
      const failure = new AuthorWorkspaceFailure(
        "draft_save_failed",
        "draft",
        "The Unsigned Draft could not be saved",
        { cause },
      );
      this.saveFailure = failure;
      this.notifyStateChange();
      throw failure;
    }
  }

  private async persistDraft(): Promise<void> {
    const { draftRootKey, keyId } = this.requireUnlocked();
    if (this.draft === undefined) {
      throw new AuthorWorkspaceFailure(
        "no_open_draft",
        "draft",
        "No Unsigned Draft is open",
      );
    }

    const readTransaction = this.database.transaction("drafts", "readonly");
    const existing = (await requestResult(
      readTransaction.objectStore("drafts").get(this.draft.draftId),
    )) as EncryptedDraftRecord | undefined;
    const salt = existing
      ? base64urlToBytes(existing.salt)
      : crypto.getRandomValues(new Uint8Array(16));
    const draftKey = await this.deriveDraftKey(
      draftRootKey,
      salt,
      this.draft.draftId,
    );
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const updatedAt = Date.now();
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv,
        additionalData: new TextEncoder().encode(
          `${this.draft.draftId}:${keyId}:1`,
        ),
      },
      draftKey,
      new TextEncoder().encode(JSON.stringify(this.draft.payload)),
    );
    const previousVersions =
      existing === undefined
        ? []
        : [
            {
              updatedAt: existing.updatedAt,
              iv: existing.iv,
              ciphertext: existing.ciphertext,
            },
            ...existing.snapshots,
          ].slice(0, 2);
    const record: EncryptedDraftRecord = {
      draftId: this.draft.draftId,
      keyId,
      updatedAt,
      salt: bytesToBase64url(salt),
      iv: bytesToBase64url(iv),
      ciphertext: bytesToBase64url(new Uint8Array(ciphertext)),
      snapshots: previousVersions,
    };
    const writeTransaction = this.database.transaction("drafts", "readwrite");
    await requestResult(writeTransaction.objectStore("drafts").put(record));
  }

  async restoreDraft(draftId: string): Promise<void> {
    const { draftRootKey, keyId } = this.requireUnlocked();
    const transaction = this.database.transaction("drafts", "readonly");
    const record = (await requestResult(
      transaction.objectStore("drafts").get(draftId),
    )) as EncryptedDraftRecord | undefined;
    if (record === undefined) {
      throw new AuthorWorkspaceFailure(
        "draft_not_found",
        "draftId",
        "Unsigned Draft was not found",
      );
    }
    if (record.keyId !== keyId) {
      throw new AuthorWorkspaceFailure(
        "draft_key_mismatch",
        "keyId",
        "Unlock the matching Key Bundle to open this Unsigned Draft",
      );
    }

    try {
      const salt = base64urlToBytes(record.salt);
      const draftKey = await this.deriveDraftKey(
        draftRootKey,
        salt,
        draftId,
      );
      const plaintext = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: base64urlToBytes(record.iv),
          additionalData: new TextEncoder().encode(`${draftId}:${keyId}:1`),
        },
        draftKey,
        base64urlToBytes(record.ciphertext),
      );
      const payload = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(plaintext),
      ) as DraftPayload;
      payload.expectedAuthorKeyId ??= keyId;
      this.draft = { draftId, payload };
      this.notifyStateChange();
    } catch (cause) {
      const writeTransaction = this.database.transaction("drafts", "readwrite");
      await requestResult(
        writeTransaction
          .objectStore("drafts")
          .put({ ...record, quarantined: true }),
      );
      throw new AuthorWorkspaceFailure(
        "draft_authentication_failed",
        "ciphertext",
        "Unsigned Draft authentication failed; ciphertext was preserved",
        { cause },
      );
    }
  }

  async listRecoverySnapshots(
    draftId: string,
  ): Promise<Array<{ index: number; updatedAt: number }>> {
    const { keyId } = this.requireUnlocked();
    const transaction = this.database.transaction("drafts", "readonly");
    const record = (await requestResult(
      transaction.objectStore("drafts").get(draftId),
    )) as EncryptedDraftRecord | undefined;
    if (record === undefined || record.keyId !== keyId) {
      throw new AuthorWorkspaceFailure(
        "draft_not_found",
        "draftId",
        "No matching Unsigned Draft was found",
      );
    }
    return record.snapshots.map((snapshot, index) => ({
      index,
      updatedAt: snapshot.updatedAt,
    }));
  }

  async restoreRecoverySnapshot(
    draftId: string,
    snapshotIndex: number,
  ): Promise<void> {
    const { draftRootKey, keyId } = this.requireUnlocked();
    const transaction = this.database.transaction("drafts", "readonly");
    const record = (await requestResult(
      transaction.objectStore("drafts").get(draftId),
    )) as EncryptedDraftRecord | undefined;
    if (record === undefined || record.keyId !== keyId) {
      throw new AuthorWorkspaceFailure(
        "draft_not_found",
        "draftId",
        "No matching Unsigned Draft was found",
      );
    }
    const snapshot = record.snapshots[snapshotIndex];
    if (snapshot === undefined) {
      throw new AuthorWorkspaceFailure(
        "snapshot_not_found",
        "snapshotIndex",
        "Recovery snapshot was not found",
      );
    }
    try {
      const draftKey = await this.deriveDraftKey(
        draftRootKey,
        base64urlToBytes(record.salt),
        draftId,
      );
      const plaintext = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: base64urlToBytes(snapshot.iv),
          additionalData: new TextEncoder().encode(`${draftId}:${keyId}:1`),
        },
        draftKey,
        base64urlToBytes(snapshot.ciphertext),
      );
      const payload = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(plaintext),
      ) as DraftPayload;
      payload.expectedAuthorKeyId ??= keyId;
      this.draft = { draftId, payload };
    } catch (cause) {
      throw new AuthorWorkspaceFailure(
        "draft_authentication_failed",
        "ciphertext",
        "Recovery snapshot authentication failed; ciphertext was preserved",
        { cause },
      );
    }
  }

  closeDraft(): void {
    this.requireDraft();
    this.draft = undefined;
    this.saveFailure = undefined;
    this.recordActivity();
    this.notifyStateChange();
  }

  async lock(): Promise<void> {
    if (this.keyId === undefined) return;
    if (this.draft !== undefined) {
      await this.saveDraft();
    }
    if (this.inactivityHandle !== undefined) {
      this.scheduler.clearTimeout(this.inactivityHandle);
      this.inactivityHandle = undefined;
    }
    this.privateKey = undefined;
    this.publicKey = undefined;
    this.draftRootKey = undefined;
    this.keyId = undefined;
    this.unlockedKeyBundle = undefined;
    this.draft = undefined;
    this.saveFailure = undefined;
    this.notifyStateChange();
  }

  async close(): Promise<void> {
    if (this.draft !== undefined && this.keyId !== undefined) {
      try {
        await this.saveDraft();
      } catch {
        // Page close is best effort; saveDraft has already exposed the failure.
      }
    }
    if (this.inactivityHandle !== undefined) {
      this.scheduler.clearTimeout(this.inactivityHandle);
      this.inactivityHandle = undefined;
    }
    this.privateKey = undefined;
    this.publicKey = undefined;
    this.draftRootKey = undefined;
    this.keyId = undefined;
    this.unlockedKeyBundle = undefined;
    this.draft = undefined;
    this.saveFailure = undefined;
    this.database.close();
    this.notifyStateChange();
  }

  recordActivity(): void {
    this.requireUnlocked();
    if (this.inactivityHandle !== undefined) {
      this.scheduler.clearTimeout(this.inactivityHandle);
    }
    this.inactivityHandle = this.scheduler.setTimeout(
      async () => {
        try {
          await this.lock();
        } catch {
          this.notifyStateChange();
        }
      },
      15 * 60 * 1_000,
    );
  }

  snapshot(): WorkspaceSnapshot {
    if (this.keyId === undefined) return { mode: "locked" };
    if (this.draft === undefined) {
      return { mode: "unlocked", keyId: this.keyId };
    }
    if (this.saveFailure !== undefined) {
      return {
        mode: "save-failed",
        keyId: this.keyId,
        error: {
          code: this.saveFailure.code,
          message: this.saveFailure.message,
        },
        draft: {
          draftId: this.draft.draftId,
          protocol: structuredClone(this.draft.payload.protocol),
          ...(this.draft.payload.source === undefined
            ? {}
            : { source: structuredClone(this.draft.payload.source) }),
        },
      };
    }
    return {
      mode: "editing",
      keyId: this.keyId,
      draft: {
        draftId: this.draft.draftId,
        protocol: structuredClone(this.draft.payload.protocol),
        ...(this.draft.payload.source === undefined
          ? {}
          : { source: structuredClone(this.draft.payload.source) }),
      },
    };
  }

  private notifyStateChange(): void {
    this.onStateChange?.(this.snapshot());
  }

  private requireUnlocked(): {
    privateKey: CryptoKey;
    publicKey: CryptoKey;
    draftRootKey: CryptoKey;
    keyId: string;
  } {
    if (
      this.privateKey === undefined ||
      this.publicKey === undefined ||
      this.draftRootKey === undefined ||
      this.keyId === undefined
    ) {
      throw new AuthorWorkspaceFailure(
        "workspace_locked",
        "keyBundle",
        "Unlock a Key Bundle before using Author mode",
      );
    }

    return {
      privateKey: this.privateKey,
      publicKey: this.publicKey,
      draftRootKey: this.draftRootKey,
      keyId: this.keyId,
    };
  }

  private requireDraft(): NonNullable<AuthorWorkspace["draft"]> {
    this.requireUnlocked();
    if (this.draft === undefined) {
      throw new AuthorWorkspaceFailure(
        "no_open_draft",
        "draft",
        "No Unsigned Draft is open",
      );
    }
    return this.draft;
  }

  private validateKeyId(value: string, path: string): void {
    if (!keyIdSchema.safeParse(value).success) {
      throw new AuthorWorkspaceFailure(
        "invalid_key_id",
        path,
        "Author Key ID must be a 64-character lowercase hexadecimal value",
      );
    }
  }

  private deriveDraftKey(
    rootKey: CryptoKey,
    salt: Uint8Array<ArrayBuffer>,
    draftId: string,
  ): Promise<CryptoKey> {
    return crypto.subtle.deriveKey(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt,
        info: new TextEncoder().encode(`protocol-box:draft:${draftId}`),
      },
      rootKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
  }
}
