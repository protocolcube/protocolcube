import { computed, ref, shallowRef } from "vue";
import { defineStore } from "pinia";
import {
  ProtocolCore,
  type FormulaTestCase,
  type Protocol,
  type ProtocolInspection,
  type Section,
  type VariableDefinition,
  type VariableValue,
} from "../../domain/protocol";
import {
  AuthorWorkspace,
  AuthorWorkspaceFailure,
  type AuthorWorkspaceOptions,
  type ImageImport,
  type KeyBundle,
  type PublicationSaveAdapter,
  type PublishedResult,
  type RecoveryCopy,
  type RecoveryCopySummary,
  type WorkspaceSnapshot,
} from "./workspace";

type DraftSummary = Awaited<ReturnType<AuthorWorkspace["listDrafts"]>>[number];
type RecoverySnapshot = Awaited<
  ReturnType<AuthorWorkspace["listRecoverySnapshots"]>
>[number];

export interface AuthorCapabilities {
  indexedDb: boolean;
  webCrypto: boolean;
  available: boolean;
  workspaceOpen: boolean;
}

export interface RecoveryCacheOutcome {
  status: "cached" | "replacement-required";
}

export interface AuthorActionFailure extends Error {
  code: string;
  path: string;
  details?: Record<string, string>;
}

export function isAuthorActionFailure(
  error: unknown,
): error is AuthorActionFailure {
  return error instanceof AuthorWorkspaceFailure;
}

function unavailableWorkspace(): never {
  throw new AuthorWorkspaceFailure(
    "workspace_unavailable",
    "workspace",
    "Author Workspace is not open",
  );
}

export const useAuthorStore = defineStore("author", () => {
  let workspace: AuthorWorkspace | undefined;
  let opening: Promise<boolean> | undefined;

  const snapshot = shallowRef<WorkspaceSnapshot>({ mode: "locked" });
  const drafts = ref<DraftSummary[]>([]);
  const recoverySnapshots = ref<RecoverySnapshot[]>([]);
  const recoveryCopies = ref<RecoveryCopySummary[]>([]);
  const newKeyRecoveryReminderKeyId = ref<string>();
  const status = ref("Opening Author Workspace...");
  const capabilities = ref<AuthorCapabilities>({
    indexedDb: typeof globalThis.indexedDB !== "undefined",
    webCrypto:
      typeof globalThis.crypto !== "undefined" &&
      typeof globalThis.crypto.subtle !== "undefined",
    available: true,
    workspaceOpen: false,
  });

  const editing = computed(() =>
    snapshot.value.mode === "editing" || snapshot.value.mode === "save-failed"
      ? snapshot.value.draft
      : undefined,
  );
  const publicSnapshot = computed<WorkspaceSnapshot>(() => snapshot.value);
  const publicDrafts = computed(() => drafts.value);
  const publicRecoverySnapshots = computed(() => recoverySnapshots.value);
  const publicRecoveryCopies = computed(() => recoveryCopies.value);
  const publicNewKeyRecoveryReminderKeyId = computed(
    () => newKeyRecoveryReminderKeyId.value,
  );
  const publicStatus = computed(() => status.value);
  const publicCapabilities = computed(() => capabilities.value);
  const inspection = computed<ProtocolInspection | undefined>(() =>
    editing.value === undefined
      ? undefined
      : ProtocolCore.inspectProtocol(editing.value.protocol),
  );

  function synchronizeSnapshot(): void {
    if (workspace !== undefined) snapshot.value = workspace.snapshot();
  }

  function currentWorkspace(): AuthorWorkspace {
    return workspace ?? unavailableWorkspace();
  }

  function setStatus(message: string): void {
    status.value = message;
  }

  function markNewKeyRecoveryReminder(keyId: string): void {
    newKeyRecoveryReminderKeyId.value = keyId;
  }

  function clearNewKeyRecoveryReminder(keyId: string): void {
    if (newKeyRecoveryReminderKeyId.value === keyId) {
      newKeyRecoveryReminderKeyId.value = undefined;
    }
  }

  async function openWorkspace(
    options: Partial<
      Pick<
        AuthorWorkspaceOptions,
        "databaseName" | "indexedDB" | "scheduler" | "remoteImageLoader"
      >
    > = {},
  ): Promise<boolean> {
    if (workspace !== undefined) return true;
    if (opening !== undefined) return opening;
    status.value = "Opening Author Workspace...";
    const indexedDb = options.indexedDB ?? globalThis.indexedDB;
    const webCryptoAvailable =
      typeof globalThis.crypto !== "undefined" &&
      typeof globalThis.crypto.subtle !== "undefined";
    capabilities.value = {
      indexedDb: indexedDb !== undefined,
      webCrypto: webCryptoAvailable,
      available: indexedDb !== undefined && webCryptoAvailable,
      workspaceOpen: false,
    };
    if (indexedDb === undefined) {
      status.value =
        "IndexedDB is unavailable; Author mode cannot store encrypted Unsigned Drafts.";
      capabilities.value.available = false;
      console.error(
        "[Protocol Box] Author mode disabled: IndexedDB is unavailable.",
      );
      return false;
    }
    if (!webCryptoAvailable) {
      status.value =
        "Web Crypto is unavailable; Author Key and Unsigned Draft operations are disabled.";
      capabilities.value.available = false;
      console.error(
        "[Protocol Box] Author mode disabled: Web Crypto is unavailable.",
      );
      return false;
    }
    opening = AuthorWorkspace.open({
      databaseName: options.databaseName ?? "protocol-box-author",
      indexedDB: indexedDb,
      ...(options.scheduler === undefined ? {} : { scheduler: options.scheduler }),
      ...(options.remoteImageLoader === undefined
        ? {}
        : { remoteImageLoader: options.remoteImageLoader }),
      onStateChange(nextSnapshot) {
        snapshot.value = nextSnapshot;
        if (nextSnapshot.mode === "save-failed") {
          status.value = nextSnapshot.error.message;
        }
      },
    })
      .then(async (openedWorkspace) => {
        workspace = openedWorkspace;
        synchronizeSnapshot();
        capabilities.value = {
          ...capabilities.value,
          available: true,
          workspaceOpen: true,
        };
        await refreshRecoveryCopies();
        status.value = "Author mode is locked";
        return true;
      })
      .catch((error: unknown) => {
        const name = error instanceof DOMException ? error.name : "Error";
        const message = error instanceof Error ? error.message : String(error);
        status.value =
          `IndexedDB could not be opened; Author mode is disabled: ${message}`;
        capabilities.value = {
          ...capabilities.value,
          available: false,
          workspaceOpen: false,
        };
        console.error(
          `[Protocol Box] Author mode disabled: IndexedDB could not be opened (${name}: ${message}).`,
        );
        return false;
      })
      .finally(() => {
        opening = undefined;
      });
    return opening;
  }

  async function closeWorkspace(): Promise<void> {
    if (workspace === undefined) return;
    const closingWorkspace = workspace;
    workspace = undefined;
    capabilities.value = { ...capabilities.value, workspaceOpen: false };
    await closingWorkspace.close();
    snapshot.value = { mode: "locked" };
    drafts.value = [];
    recoverySnapshots.value = [];
  }

  function recordActivity(): void {
    if (snapshot.value.mode !== "locked") currentWorkspace().recordActivity();
  }

  async function refreshDrafts(): Promise<DraftSummary[]> {
    if (snapshot.value.mode === "locked" || workspace === undefined) {
      drafts.value = [];
      return drafts.value;
    }
    drafts.value = await workspace.listDrafts();
    return drafts.value;
  }

  async function refreshRecoverySnapshots(): Promise<RecoverySnapshot[]> {
    if (workspace === undefined || editing.value === undefined) {
      recoverySnapshots.value = [];
      return recoverySnapshots.value;
    }
    recoverySnapshots.value = await workspace.listRecoverySnapshots(
      editing.value.draftId,
    );
    return recoverySnapshots.value;
  }

  async function refreshRecoveryCopies(): Promise<RecoveryCopySummary[]> {
    if (workspace === undefined) {
      recoveryCopies.value = [];
      return recoveryCopies.value;
    }
    recoveryCopies.value = await workspace.listRecoveryCopies();
    return recoveryCopies.value;
  }

  async function cacheUnlockedRecoveryCopy(
    bundle: unknown,
    options: { replace?: boolean; sourceFileName?: string } = {},
  ): Promise<RecoveryCacheOutcome> {
    try {
      await currentWorkspace().cacheRecoveryCopy(bundle, options);
      await refreshRecoveryCopies();
      return { status: "cached" };
    } catch (error) {
      if (
        error instanceof AuthorWorkspaceFailure &&
        error.code === "recovery_copy_replacement_required"
      ) {
        await refreshRecoveryCopies();
        return { status: "replacement-required" };
      }
      throw error;
    }
  }

  async function createKeyBundle(input: {
    passphrase: string;
    privateKeyPkcs8?: string;
    publicKeySpki?: string;
  }): Promise<{ bundle: KeyBundle; recoveryCopy: RecoveryCacheOutcome }> {
    let privateKeyPkcs8 = input.privateKeyPkcs8;
    let publicKeySpki = input.publicKeySpki;
    if (privateKeyPkcs8 !== undefined && publicKeySpki !== undefined) {
    } else if (privateKeyPkcs8 === undefined && publicKeySpki === undefined) {
      const generated = await ProtocolCore.generateAuthorKeyPair();
      privateKeyPkcs8 = await ProtocolCore.exportPrivateKeyPkcs8(
        generated.privateKey,
      );
      publicKeySpki = await ProtocolCore.exportPublicKeySpki(generated.publicKey);
    } else {
      throw new AuthorWorkspaceFailure(
        "key_pair_incomplete",
        "keyBundle",
        "Both PKCS#8 and SPKI values are required",
      );
    }
    const current = currentWorkspace();
    const iterations = await current.calibrateKeyBundleIterations({
      passphrase: input.passphrase,
    });
    const bundle = await current.createKeyBundle({
      privateKeyPkcs8,
      publicKeySpki,
      passphrase: input.passphrase,
      iterations,
    });
    await current.unlockKeyBundle(bundle, input.passphrase);
    synchronizeSnapshot();
    const recoveryCopy = await cacheUnlockedRecoveryCopy(bundle);
    await refreshDrafts();
    return { bundle, recoveryCopy };
  }

  async function unlockKeyBundle(
    bundle: unknown,
    passphrase: string,
    options: { sourceFileName?: string } = {},
  ): Promise<RecoveryCacheOutcome> {
    await currentWorkspace().unlockKeyBundle(bundle, passphrase);
    synchronizeSnapshot();
    const recoveryCopy = await cacheUnlockedRecoveryCopy(bundle, options);
    await refreshDrafts();
    return recoveryCopy;
  }

  async function retrieveRecoveryCopy(keyId: string): Promise<RecoveryCopy> {
    return currentWorkspace().retrieveRecoveryCopy(keyId);
  }

  async function cacheRecoveryCopy(
    bundle: unknown,
    options: { replace?: boolean; sourceFileName?: string } = {},
  ): Promise<RecoveryCacheOutcome> {
    return cacheUnlockedRecoveryCopy(bundle, options);
  }

  async function forgetRecoveryCopy(keyId: string): Promise<void> {
    await currentWorkspace().forgetRecoveryCopy(keyId);
    await refreshRecoveryCopies();
  }

  async function forgetAllRecoveryCopies(): Promise<void> {
    await currentWorkspace().forgetAllRecoveryCopies();
    await refreshRecoveryCopies();
  }

  async function identifyDraft(
    draftId: string,
  ): Promise<{ draftId: string; keyId: string }> {
    return currentWorkspace().identifyDraft(draftId);
  }

  async function createDraft(protocol: Protocol): Promise<{ draftId: string }> {
    const created = await currentWorkspace().createDraft(protocol);
    synchronizeSnapshot();
    recoverySnapshots.value = [];
    return created;
  }

  async function importPublishedProtocol(
    html: string,
    options: { fork?: boolean } = {},
  ): Promise<{ draftId: string }> {
    const imported = await currentWorkspace().importPublishedProtocol(html, options);
    synchronizeSnapshot();
    recoverySnapshots.value = [];
    return imported;
  }

  async function restoreDraft(draftId: string): Promise<void> {
    await currentWorkspace().restoreDraft(draftId);
    synchronizeSnapshot();
    await refreshRecoverySnapshots();
  }

  async function restoreRecoverySnapshot(index: number): Promise<void> {
    const draft = editing.value ?? unavailableWorkspace();
    await currentWorkspace().restoreRecoverySnapshot(draft.draftId, index);
    synchronizeSnapshot();
  }

  function closeDraft(): void {
    currentWorkspace().closeDraft();
    synchronizeSnapshot();
    recoverySnapshots.value = [];
  }

  function updateProtocol(protocol: Protocol): void {
    currentWorkspace().updateProtocol(protocol);
    synchronizeSnapshot();
  }

  function addSection(section: Omit<Section, "sectionId">): string {
    const sectionId = currentWorkspace().addSection(section);
    synchronizeSnapshot();
    return sectionId;
  }

  function updateSection(
    sectionId: string,
    update: Partial<Omit<Section, "sectionId">>,
  ): void {
    currentWorkspace().updateSection(sectionId, update);
    synchronizeSnapshot();
  }

  function removeSection(sectionId: string): void {
    currentWorkspace().removeSection(sectionId);
    synchronizeSnapshot();
  }

  function copySection(sectionId: string): string {
    const copiedId = currentWorkspace().copySection(sectionId);
    synchronizeSnapshot();
    return copiedId;
  }

  function reorderSection(sectionId: string, targetIndex: number): void {
    currentWorkspace().reorderSection(sectionId, targetIndex);
    synchronizeSnapshot();
  }

  function replaceVariables(variables: VariableDefinition[]): void {
    currentWorkspace().replaceVariables(variables);
    synchronizeSnapshot();
  }

  function replaceFormulaTestCases(formulaTestCases: FormulaTestCase[]): void {
    currentWorkspace().replaceFormulaTestCases(formulaTestCases);
    synchronizeSnapshot();
  }

  function inspectDraft(): ProtocolInspection {
    return currentWorkspace().inspectDraft();
  }

  function evaluateProtocol(
    protocol: Protocol,
    values: Record<string, VariableValue>,
  ) {
    return ProtocolCore.evaluateProtocol(protocol, values);
  }

  function sanitizePastedHtml(html: string): string {
    return currentWorkspace().sanitizePastedHtml(html);
  }

  function sanitizeSvg(svg: string): string {
    return currentWorkspace().sanitizeSvg(svg);
  }

  function importImage(input: ImageImport): string {
    return currentWorkspace().importImage(input);
  }

  async function importRemoteImage(input: {
    url: string;
    confirmed: boolean;
  }): Promise<string> {
    return currentWorkspace().importRemoteImage(input);
  }

  async function saveDraft(): Promise<void> {
    await currentWorkspace().saveDraft();
    synchronizeSnapshot();
    await refreshDrafts();
    await refreshRecoverySnapshots();
  }

  async function lock(): Promise<void> {
    await currentWorkspace().lock();
    synchronizeSnapshot();
    drafts.value = [];
    recoverySnapshots.value = [];
  }

  async function publishCurrentDraft(input: {
    applicationHtml: string;
    appVersion: string;
    fileName: string;
    saveAdapter: PublicationSaveAdapter;
  }): Promise<PublishedResult> {
    const result = await currentWorkspace().publishCurrentDraft(input);
    synchronizeSnapshot();
    await refreshDrafts();
    recoverySnapshots.value = [];
    return result;
  }

  return {
    snapshot: publicSnapshot,
    editing,
    drafts: publicDrafts,
    recoverySnapshots: publicRecoverySnapshots,
    recoveryCopies: publicRecoveryCopies,
    newKeyRecoveryReminderKeyId: publicNewKeyRecoveryReminderKeyId,
    status: publicStatus,
    capabilities: publicCapabilities,
    inspection,
    setStatus,
    markNewKeyRecoveryReminder,
    clearNewKeyRecoveryReminder,
    openWorkspace,
    closeWorkspace,
    recordActivity,
    refreshDrafts,
    refreshRecoverySnapshots,
    refreshRecoveryCopies,
    createKeyBundle,
    unlockKeyBundle,
    retrieveRecoveryCopy,
    cacheRecoveryCopy,
    forgetRecoveryCopy,
    forgetAllRecoveryCopies,
    identifyDraft,
    createDraft,
    importPublishedProtocol,
    restoreDraft,
    restoreRecoverySnapshot,
    closeDraft,
    updateProtocol,
    addSection,
    updateSection,
    removeSection,
    copySection,
    reorderSection,
    replaceVariables,
    replaceFormulaTestCases,
    inspectDraft,
    evaluateProtocol,
    sanitizePastedHtml,
    sanitizeSvg,
    importImage,
    importRemoteImage,
    saveDraft,
    lock,
    publishCurrentDraft,
  };
});
