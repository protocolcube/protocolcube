import Decimal from "decimal.js";
import { z } from "zod";
import {
  ProtocolCore,
  type EnvelopeInspection,
  type Protocol,
  type ProtocolError,
  type VariableValue,
  isDurationUnit,
} from "../../../domain/protocol";

const ReaderDecimal = Decimal.clone({
  precision: 120,
  rounding: Decimal.ROUND_HALF_EVEN,
});

export interface ReaderScheduler {
  setTimeout(callback: () => void | Promise<void>, delay: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface ReaderWorkspaceOptions {
  html: string;
  monotonicNow: () => number;
  wallNow: () => number;
  scheduler: ReaderScheduler;
  sessionStorage?: ReaderSessionStorage;
}

export type AuthorPreviewOptions = Omit<
  ReaderWorkspaceOptions,
  "html" | "sessionStorage"
> & {
  protocol: Protocol;
};

export interface ReaderSessionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  keys(): string[];
}

export interface ReaderInspection {
  format: "valid" | "invalid";
  signature: "match" | "mismatch" | "unverified";
  playable: boolean;
  protocolFingerprint?: string;
  keyId?: string;
  errors: ProtocolError[];
}

export interface ActiveSectionSnapshot {
  values: Record<string, VariableValue>;
  currentSectionIndex: number;
  renderedSection: { title: string; markdown: string };
  completedSectionIds: string[];
  checkedTaskItemIndexes: number[];
  taskItemCount: number;
  taskItemCompletionRequired: boolean;
  taskItemCompletionSatisfied: boolean;
  canCompleteSection: boolean;
  sectionCompleted: boolean;
}

export type ReaderSnapshot =
  | {
      mode: "invalid";
      errors: ProtocolError[];
    }
  | {
      mode: "configuring" | "ready";
      values: Record<string, VariableValue>;
      errors: ProtocolError[];
    }
  | (ActiveSectionSnapshot & {
      mode: "playing";
      remainingMilliseconds?: number;
    })
  | (ActiveSectionSnapshot & {
      mode: "paused";
      reason: "clock-drift" | "timer-delay" | "page-hidden" | "page-visible";
      remainingMilliseconds?: number;
    })
  | (ActiveSectionSnapshot & {
      mode: "waiting";
    })
  | {
      mode: "completed";
      values: Record<string, VariableValue>;
      completedSectionIds: string[];
    }
  | {
      mode: "quarantined";
      protocolFingerprint: string;
      errors: ProtocolError[];
    };

export interface CompletionSummary {
  label: "Non-audit personal reference";
  protocolFingerprint: string;
  /**
   * Canonical resolved Variable Values, exactly as the resumable Playback
   * Session stores them: Duration Variables are canonical seconds.
   */
  values: Record<string, VariableValue>;
  /**
   * Presented Variable Values: Duration Variables are rendered in their
   * declared Duration Unit through the single domain formatter, so `text`
   * and the completion screen always show the same formatted strings.
   */
  presentedValues: Record<string, VariableValue>;
  completedSectionIds: string[];
  startedAtUtc: number;
  completedAtUtc: number;
  text: string;
}

export class ReaderWorkspaceFailure extends Error {
  constructor(
    readonly code: string,
    readonly path: string,
    message: string,
  ) {
    super(message);
    this.name = "ReaderWorkspaceFailure";
  }
}

const playbackSessionSchema = z
  .object({
    formatVersion: z.literal(1),
    protocolFingerprint: z.string().regex(/^[0-9a-f]{64}$/),
    values: z.record(z.string(), z.union([z.string(), z.boolean()])),
    currentSectionIndex: z.number().int().nonnegative(),
    completedSectionIds: z.array(z.string().uuid()),
    checkedTaskItems: z
      .record(
        z.string().uuid(),
        z.array(z.number().int().nonnegative().max(10_000)).max(1_000),
      )
      .optional(),
    state: z.enum(["playing", "paused", "waiting", "completed"]),
    remainingMilliseconds: z.number().int().nonnegative().optional(),
    startedAtUtc: z.number().finite(),
    completedAtUtc: z.number().finite().optional(),
    updatedAtUtc: z.number().finite(),
  })
  .strict();

function interpolate(
  source: string,
  values: Record<string, VariableValue>,
): string {
  const result = source.replace(
    /{{\s*([A-Za-z_][A-Za-z0-9_]*)\s*}}/g,
    (_match, id: string) => {
      const value = values[id];
      if (value === undefined) {
        throw new ReaderWorkspaceFailure(
          "unknown_interpolation",
          "section",
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
  if (result.includes("{{") || result.includes("}}")) {
    throw new ReaderWorkspaceFailure(
      "malformed_interpolation",
      "section",
      "Interpolation must use {{ variableName }} syntax",
    );
  }
  return result;
}

/**
 * Duration Variable Values are stored as canonical seconds, but every
 * presented value renders through the single domain formatter in the
 * declared Duration Unit (Reader step text, the Author Preview, and the
 * Completion Summary). This covers Duration Inputs and Duration Derived
 * Variables alike: a Derived duration value is canonical seconds exactly
 * like an Input value. Other Variable Value kinds pass through unchanged,
 * and the HTML and Markdown escaping inside `interpolate` still applies to
 * the formatted result. Section-duration table and timer displays are not
 * presentations of Variable Values and do not go through here.
 */
function presentationValues(
  protocol: Protocol,
  values: Record<string, VariableValue>,
): Record<string, VariableValue> {
  const presented = { ...values };
  for (const definition of protocol.variables) {
    const value = values[definition.id];
    if (
      (definition.kind === "input" || definition.kind === "derived") &&
      definition.valueType === "duration" &&
      typeof value === "string" &&
      isDurationUnit(definition.unit)
    ) {
      presented[definition.id] = ProtocolCore.formatDurationValue(
        value,
        definition.unit,
      );
    }
  }
  return presented;
}

export class ReaderWorkspace {
  static async openAuthorPreview(
    options: AuthorPreviewOptions,
  ): Promise<ReaderWorkspace> {
    const protocol = structuredClone(options.protocol);
    const inspection = ProtocolCore.inspectProtocol(protocol);
    const fingerprint = await ProtocolCore.fingerprintProtocol(protocol);
    return new ReaderWorkspace(
      { ...options, html: "" },
      {
        ...inspection,
        signature: "unverified",
        protocol,
      },
      protocol,
      fingerprint,
      undefined,
      true,
    );
  }

  static async open(options: ReaderWorkspaceOptions): Promise<ReaderWorkspace> {
    const decoded = ProtocolCore.extractEnvelope(options.html);
    if (!decoded.ok) {
      return new ReaderWorkspace(options, {
        format: "invalid",
        signature: "unverified",
        playable: false,
        errors: decoded.errors,
      });
    }
    const protocol =
      decoded.envelope.documentKind === "protocol-box/published-protocol"
        ? structuredClone(decoded.envelope.protocol)
        : undefined;
    const publishedHtmlBytes = new TextEncoder().encode(options.html).byteLength;
    if (
      protocol !== undefined &&
      (globalThis.crypto === undefined || globalThis.crypto.subtle === undefined)
    ) {
      const protocolInspection = ProtocolCore.inspectProtocol(protocol, {
        importedHtmlBytes: publishedHtmlBytes,
        publishedHtmlBytes,
      });
      return new ReaderWorkspace(
        options,
        {
          ...protocolInspection,
          signature: "unverified",
          protocol,
          errors: [
            ...protocolInspection.errors,
            {
              code: "web_crypto_unavailable",
              path: "signature",
              message:
                "Web Crypto is unavailable; Signature Match cannot be checked",
            },
          ],
        },
        protocol,
        undefined,
        decoded.envelope.documentKind === "protocol-box/published-protocol"
          ? decoded.envelope.signature.keyId
          : undefined,
      );
    }
    const inspected = await ProtocolCore.inspectEnvelope(decoded.envelope, {
      importedHtmlBytes: publishedHtmlBytes,
      publishedHtmlBytes,
    });
    const fingerprint =
      protocol === undefined
        ? undefined
        : await ProtocolCore.fingerprintProtocol(protocol);
    return new ReaderWorkspace(
      options,
      inspected,
      protocol,
      fingerprint,
      decoded.envelope.documentKind === "protocol-box/published-protocol"
        ? decoded.envelope.signature.keyId
        : undefined,
    );
  }

  private values: Record<string, VariableValue> = {};
  private evaluationErrors: ProtocolError[] = [];
  private currentSectionIndex?: number;
  private completedSectionIds: string[] = [];
  private checkedTaskItems: Record<string, number[]> = {};
  private remainingMilliseconds?: number;
  private timerHandle?: unknown;
  private timerStartedMonotonic?: number;
  private timerStartedWall?: number;
  private pauseReason?:
    | "clock-drift"
    | "timer-delay"
    | "page-hidden"
    | "page-visible";
  private startedAtUtc?: number;
  private completedAtUtc?: number;
  private persistence: "memory" | "persistent" = "memory";
  private quarantineErrors: ProtocolError[] = [];
  private mode: ReaderSnapshot["mode"];

  private constructor(
    private readonly options: ReaderWorkspaceOptions,
    private readonly envelopeInspection: EnvelopeInspection,
    private readonly protocol?: Protocol,
    private readonly protocolFingerprint?: string,
    private readonly keyId?: string,
    private readonly authorPreview = false,
  ) {
    this.mode =
      protocol === undefined ||
      envelopeInspection.format !== "valid" ||
      (!authorPreview && envelopeInspection.signature !== "match") ||
      !envelopeInspection.playable
        ? "invalid"
        : "configuring";
    if (this.mode === "configuring" && protocol !== undefined) {
      for (const definition of protocol.variables) {
        if (
          definition.kind === "input" &&
          definition.defaultValue !== undefined
        ) {
          // Duration defaults are stored as canonical seconds; the
          // configuration entry space is the declared Duration Unit.
          // (Playability requires a valid unit; the fallback keeps the raw
          // default only for protocols that could not be inspected.)
          this.values[definition.id] =
            definition.valueType === "duration" &&
            isDurationUnit(definition.unit)
              ? ProtocolCore.convertDurationSecondsToUnit(
                  definition.defaultValue,
                  definition.unit,
                )
              : definition.defaultValue;
        }
      }
      this.evaluateConfiguration();
    }
  }

  inspection(): ReaderInspection {
    return {
      format: this.envelopeInspection.format,
      signature: this.envelopeInspection.signature,
      playable: this.envelopeInspection.playable,
      errors: structuredClone(this.envelopeInspection.errors),
      ...(this.protocolFingerprint === undefined
        ? {}
        : { protocolFingerprint: this.protocolFingerprint }),
      ...(this.keyId === undefined ? {} : { keyId: this.keyId }),
    };
  }

  isAuthorPreview(): boolean {
    return this.authorPreview;
  }

  readProtocol(): Protocol | undefined {
    return this.protocol === undefined
      ? undefined
      : structuredClone(this.protocol);
  }

  setInputValue(id: string, value: VariableValue): void {
    this.requireConfiguration();
    const definition = this.protocol!.variables.find(
      (candidate) => candidate.kind === "input" && candidate.id === id,
    );
    if (definition === undefined) {
      throw new ReaderWorkspaceFailure(
        "unknown_input_variable",
        `values.${id}`,
        `Unknown Input Variable: ${id}`,
      );
    }
    this.values[id] = value;
    this.evaluateConfiguration();
  }

  startPlayback(input: {
    persistence: "memory" | "persistent";
    sensitiveDataConfirmed?: boolean;
  }): void {
    if (this.mode !== "ready" || this.protocol === undefined) {
      throw new ReaderWorkspaceFailure(
        "configuration_invalid",
        "values",
        "Complete a valid Reader configuration before Playback",
      );
    }
    if (
      input.persistence === "persistent" &&
      (this.authorPreview ||
        !input.sensitiveDataConfirmed ||
        this.options.sessionStorage === undefined)
    ) {
      throw new ReaderWorkspaceFailure(
        this.authorPreview
          ? "author_preview_memory_only"
          : "persistent_session_confirmation_required",
        "persistence",
        this.authorPreview
          ? "Author Preview is always memory-only"
          : "Persistent plaintext Sessions require explicit Reader confirmation",
      );
    }
    this.persistence = input.persistence;
    this.startedAtUtc = this.options.wallNow();
    this.currentSectionIndex = 0;
    this.completedSectionIds = [];
    this.checkedTaskItems = {};
    this.enterCurrentSection();
    this.persistSession();
  }

  setTaskItemChecked(index: number, checked: boolean): void {
    if (
      (this.mode !== "playing" && this.mode !== "paused") ||
      this.protocol === undefined ||
      this.currentSectionIndex === undefined ||
      !Number.isInteger(index) ||
      index < 0
    ) {
      throw new ReaderWorkspaceFailure(
        "invalid_task_item",
        "playback.checklist",
        "The checklist item is not available in the current Section",
      );
    }
    const section = this.protocol.sections[this.currentSectionIndex]!;
    if (this.completedSectionIds.includes(section.sectionId)) {
      throw new ReaderWorkspaceFailure(
        "completed_section_read_only",
        "playback.checklist",
        "Task Items in a completed Section are read-only",
      );
    }
    if (index >= ProtocolCore.countTaskItems(section.markdown)) {
      throw new ReaderWorkspaceFailure(
        "invalid_task_item",
        "playback.checklist",
        "The checklist item is not available in the current Section",
      );
    }
    const sectionId = section.sectionId;
    const checkedIndexes = new Set(this.checkedTaskItems[sectionId] ?? []);
    if (checked) checkedIndexes.add(index);
    else checkedIndexes.delete(index);
    this.checkedTaskItems[sectionId] = [...checkedIndexes].sort(
      (left, right) => left - right,
    );
    if (
      this.mode === "playing" &&
      section.duration.kind !== "untimed" &&
      this.remainingMilliseconds === 0 &&
      this.taskItemCompletionSatisfied(section)
    ) {
      this.finishTimedSection();
      return;
    }
    this.persistSession();
  }

  completeCurrentSection(): void {
    if (
      this.mode !== "playing" ||
      this.protocol === undefined ||
      this.currentSectionIndex === undefined
    ) {
      throw new ReaderWorkspaceFailure(
        "invalid_playback_transition",
        "playback",
        "There is no active Section to complete",
      );
    }
    const section = this.protocol.sections[this.currentSectionIndex]!;
    if (this.completedSectionIds.includes(section.sectionId)) {
      throw new ReaderWorkspaceFailure(
        "section_already_completed",
        "playback",
        "The current Section is already complete",
      );
    }
    if (
      section.duration.kind !== "untimed"
    ) {
      throw new ReaderWorkspaceFailure(
        "timed_section_in_progress",
        "playback",
        "A timed Section completes only when its timer expires",
      );
    }
    this.requireTaskItemCompletion(section);
    this.cancelTimer();
    this.completeAndAdvance();
  }

  resumePlayback(input: { confirmed: boolean }): void {
    if (this.mode !== "paused" || !input.confirmed) {
      throw new ReaderWorkspaceFailure(
        "resume_confirmation_required",
        "playback",
        "Paused Playback requires explicit Reader confirmation",
      );
    }
    this.mode = "playing";
    this.pauseReason = undefined;
    this.scheduleCurrentTimer();
    this.persistSession();
  }

  acknowledgeSection(): void {
    if (this.mode !== "waiting") {
      throw new ReaderWorkspaceFailure(
        "invalid_playback_transition",
        "playback",
        "No Section is waiting for acknowledgement",
      );
    }
    this.requireTaskItemCompletion(
      this.protocol!.sections[this.currentSectionIndex!]!,
    );
    this.completeAndAdvance();
  }

  jumpToSection(input: {
    sectionIndex: number;
    confirmed: boolean;
  }): void {
    if (!input.confirmed) {
      throw new ReaderWorkspaceFailure(
        "section_jump_confirmation_required",
        "playback",
        "Changing the current Section requires Reader confirmation",
      );
    }
    if (
      this.protocol === undefined ||
      this.currentSectionIndex === undefined ||
      (this.mode !== "playing" &&
        this.mode !== "paused" &&
        this.mode !== "waiting") ||
      !Number.isInteger(input.sectionIndex) ||
      this.protocol.sections[input.sectionIndex] === undefined
    ) {
      throw new ReaderWorkspaceFailure(
        "invalid_playback_transition",
        "playback",
        "The requested Section is unavailable during the current state",
      );
    }
    this.cancelTimer();
    this.currentSectionIndex = input.sectionIndex;
    this.remainingMilliseconds = undefined;
    this.pauseReason = undefined;
    this.enterCurrentSection();
    this.persistSession();
  }

  handleVisibilityChange(state: "hidden" | "visible"): void {
    if (this.mode === "playing") {
      if (this.currentSectionCompleted()) return;
      if (
        this.remainingMilliseconds !== undefined &&
        this.timerStartedMonotonic !== undefined
      ) {
        this.remainingMilliseconds = Math.max(
          0,
          this.remainingMilliseconds -
            (this.options.monotonicNow() - this.timerStartedMonotonic),
        );
      }
      this.cancelTimer();
      this.pauseReason = state === "hidden" ? "page-hidden" : "page-visible";
      this.mode = "paused";
      this.persistSession();
      return;
    }
    if (this.mode === "paused" && state === "visible") {
      this.pauseReason = "page-visible";
      this.persistSession();
    }
  }

  restorePersistentSession(): "none" | "restored" | "quarantined" {
    if (
      this.authorPreview ||
      this.protocol === undefined ||
      this.protocolFingerprint === undefined ||
      this.options.sessionStorage === undefined
    ) {
      return "none";
    }

    const key = this.sessionKey();
    const raw = this.options.sessionStorage.getItem(key);
    if (raw === null) return "none";
    try {
      const parsed = playbackSessionSchema.parse(JSON.parse(raw));
      if (
        parsed.protocolFingerprint !== this.protocolFingerprint ||
        parsed.currentSectionIndex > this.protocol.sections.length ||
        (parsed.state !== "completed" &&
          this.protocol.sections[parsed.currentSectionIndex] === undefined) ||
        parsed.completedSectionIds.some(
          (id) => !this.protocol!.sections.some((section) => section.sectionId === id),
        )
      ) {
        throw new Error("Playback Session does not match this Protocol");
      }
      // Stored Variable Values are already in their resolved canonical form
      // (canonical seconds for the duration kind), so they are validated
      // against their definitions directly instead of being re-fed as
      // declared-unit entries.
      const resolution = ProtocolCore.resolveVariableValues(
        this.protocol,
        parsed.values,
        "playback-session",
      );
      if (!resolution.ok) {
        throw new Error("Playback Session values are invalid");
      }
      const currentSection = this.protocol.sections[parsed.currentSectionIndex];
      const completedIds = new Set(parsed.completedSectionIds);
      const checkedTaskItems = parsed.checkedTaskItems ?? {};
      const completedStateIsValid =
        parsed.state !== "completed" ||
        (parsed.currentSectionIndex === this.protocol.sections.length &&
          parsed.completedAtUtc !== undefined &&
          parsed.remainingMilliseconds === undefined);
      const activeStateIsValid =
        parsed.state === "completed" ||
        parsed.state === "waiting" ||
        (currentSection !== undefined &&
          parsed.completedAtUtc === undefined &&
          (completedIds.has(currentSection.sectionId) ||
            currentSection.duration.kind === "untimed" ||
            (parsed.remainingMilliseconds !== undefined &&
              parsed.remainingMilliseconds <= 604_800_000)));
      const waitingStateIsValid =
        parsed.state !== "waiting" ||
        (currentSection?.duration.kind !== "untimed" &&
          currentSection?.endAction === "wait" &&
          parsed.remainingMilliseconds === undefined &&
          this.taskItemCompletionSatisfied(
            currentSection,
            checkedTaskItems,
          ));
      if (
        completedIds.size !== parsed.completedSectionIds.length ||
        Object.keys(checkedTaskItems).some(
          (sectionId) =>
            !this.protocol!.sections.some(
              (section) => section.sectionId === sectionId,
            ),
        ) ||
        Object.entries(checkedTaskItems).some(([sectionId, indexes]) => {
          const checkedSection = this.protocol!.sections.find(
            (section) => section.sectionId === sectionId,
          );
          return (
            checkedSection === undefined ||
            new Set(indexes).size !== indexes.length ||
            indexes.some(
              (index) =>
                index >= ProtocolCore.countTaskItems(checkedSection.markdown),
            )
          );
        }) ||
        (currentSection !== undefined &&
          completedIds.has(currentSection.sectionId) &&
          parsed.remainingMilliseconds !== undefined) ||
        parsed.updatedAtUtc < parsed.startedAtUtc ||
        (parsed.completedAtUtc !== undefined &&
          parsed.completedAtUtc < parsed.startedAtUtc) ||
        !completedStateIsValid ||
        !activeStateIsValid ||
        !waitingStateIsValid
      ) {
        throw new Error("Playback Session contains an impossible state");
      }
      this.values = resolution.values;
      this.currentSectionIndex = parsed.currentSectionIndex;
      this.completedSectionIds = [...parsed.completedSectionIds];
      this.checkedTaskItems = structuredClone(checkedTaskItems);
      this.remainingMilliseconds = parsed.remainingMilliseconds;
      this.startedAtUtc = parsed.startedAtUtc;
      this.completedAtUtc = parsed.completedAtUtc;
      this.persistence = "persistent";
      if (parsed.state === "completed") {
        this.mode = "completed";
      } else if (parsed.state === "waiting") {
        this.mode = "waiting";
      } else if (
        currentSection !== undefined &&
        completedIds.has(currentSection.sectionId)
      ) {
        this.mode = "playing";
      } else {
        this.mode = "paused";
        this.pauseReason = "page-visible";
      }
      return "restored";
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Invalid Playback Session";
      const quarantineBase =
        `protocol-box:playback-quarantine:${this.protocolFingerprint}:` +
        this.options.wallNow();
      let quarantineKey = quarantineBase;
      let suffix = 1;
      while (this.options.sessionStorage.getItem(quarantineKey) !== null) {
        quarantineKey = `${quarantineBase}:${suffix}`;
        suffix += 1;
      }
      this.options.sessionStorage.setItem(quarantineKey, raw);
      this.options.sessionStorage.removeItem(key);
      this.quarantineErrors = [
        {
          code: "invalid_playback_session",
          path: "playbackSession",
          message,
        },
      ];
      this.mode = "quarantined";
      return "quarantined";
    }
  }

  clearSession(input: { confirmed: boolean }): void {
    if (!input.confirmed) {
      throw new ReaderWorkspaceFailure(
        "session_reset_confirmation_required",
        "playbackSession",
        "Clearing Playback progress requires Reader confirmation",
      );
    }
    this.cancelTimer();
    if (
      this.options.sessionStorage !== undefined &&
      this.protocolFingerprint !== undefined
    ) {
      const activeKey = this.sessionKey();
      const quarantinePrefix =
        `protocol-box:playback-quarantine:${this.protocolFingerprint}:`;
      for (const key of this.options.sessionStorage.keys()) {
        if (key === activeKey || key.startsWith(quarantinePrefix)) {
          this.options.sessionStorage.removeItem(key);
        }
      }
    }
    this.values = {};
    this.evaluationErrors = [];
    this.currentSectionIndex = undefined;
    this.completedSectionIds = [];
    this.checkedTaskItems = {};
    this.remainingMilliseconds = undefined;
    this.startedAtUtc = undefined;
    this.completedAtUtc = undefined;
    this.persistence = "memory";
    this.quarantineErrors = [];
    this.pauseReason = undefined;
    this.mode = "configuring";
    for (const definition of this.protocol!.variables) {
      if (
        definition.kind === "input" &&
        definition.defaultValue !== undefined
      ) {
        this.values[definition.id] = definition.defaultValue;
      }
    }
    this.evaluateConfiguration();
  }

  snapshot(): ReaderSnapshot {
    if (this.mode === "invalid" || this.protocol === undefined) {
      return {
        mode: "invalid",
        errors: structuredClone(this.envelopeInspection.errors),
      };
    }
    if (this.mode === "quarantined") {
      return {
        mode: "quarantined",
        protocolFingerprint: this.protocolFingerprint!,
        errors: structuredClone(this.quarantineErrors),
      };
    }
    if (this.mode === "configuring" || this.mode === "ready") {
      return {
        mode: this.mode,
        values: structuredClone(this.values),
        errors: structuredClone(this.evaluationErrors),
      };
    }
    if (this.mode === "completed") {
      return {
        mode: "completed",
        values: structuredClone(this.values),
        completedSectionIds: [...this.completedSectionIds],
      };
    }
    const section = this.protocol.sections[this.currentSectionIndex!];
    const renderedSection = {
      title: interpolate(
        section!.title,
        presentationValues(this.protocol, this.values),
      ),
      markdown: interpolate(
        section!.markdown,
        presentationValues(this.protocol, this.values),
      ),
    };
    const checkedTaskItemIndexes = [
      ...(this.checkedTaskItems[section!.sectionId] ?? []),
    ];
    const taskItemCount = ProtocolCore.countTaskItems(section!.markdown);
    const taskItemCompletionRequired =
      section!.completionRequirement === "all-task-items";
    const taskItemCompletionSatisfied =
      !taskItemCompletionRequired ||
      checkedTaskItemIndexes.length === taskItemCount;
    const sectionCompleted = this.completedSectionIds.includes(
      section!.sectionId,
    );
    const canCompleteSection =
      !sectionCompleted &&
      taskItemCompletionSatisfied &&
      (section!.duration.kind === "untimed" ||
        this.remainingMilliseconds === 0 ||
        this.mode === "waiting");
    const activeSectionSnapshot = {
      values: structuredClone(this.values),
      currentSectionIndex: this.currentSectionIndex!,
      renderedSection,
      completedSectionIds: [...this.completedSectionIds],
      checkedTaskItemIndexes,
      taskItemCount,
      taskItemCompletionRequired,
      taskItemCompletionSatisfied,
      canCompleteSection,
      sectionCompleted,
    };
    if (this.mode === "paused") {
      return {
        ...activeSectionSnapshot,
        mode: "paused",
        reason: this.pauseReason!,
        ...(this.remainingMilliseconds === undefined
          ? {}
          : { remainingMilliseconds: this.remainingMilliseconds }),
      };
    }
    if (this.mode === "waiting") {
      return {
        ...activeSectionSnapshot,
        mode: "waiting",
      };
    }
    return {
      ...activeSectionSnapshot,
      mode: "playing",
      ...(this.remainingMilliseconds === undefined
        ? {}
        : { remainingMilliseconds: this.remainingMilliseconds }),
    };
  }

  completionSummary(): CompletionSummary {
    if (this.authorPreview) {
      throw new ReaderWorkspaceFailure(
        "author_preview_has_no_completion_summary",
        "authorPreview",
        "Author Preview does not create a Completion Summary",
      );
    }
    if (
      this.mode !== "completed" ||
      this.protocolFingerprint === undefined ||
      this.startedAtUtc === undefined ||
      this.completedAtUtc === undefined
    ) {
      throw new ReaderWorkspaceFailure(
        "playback_not_completed",
        "playback",
        "Complete Playback before creating a Completion Summary",
      );
    }
    // The Completion Summary is unsigned and non-evidentiary (see
    // CONTEXT.md): `values` carries the canonical resolved Variable Values
    // while the presented record formats every Duration Variable through
    // the single domain formatter, so `text` and the completion screen
    // show the same formatted strings without losing the canonical form.
    const presentedValues = presentationValues(this.protocol!, this.values);
    return {
      label: "Non-audit personal reference",
      protocolFingerprint: this.protocolFingerprint,
      values: { ...this.values },
      presentedValues,
      completedSectionIds: [...this.completedSectionIds],
      startedAtUtc: this.startedAtUtc,
      completedAtUtc: this.completedAtUtc,
      text: [
        "Non-audit personal reference",
        `Protocol Fingerprint: ${this.protocolFingerprint}`,
        `Started (UTC ms): ${this.startedAtUtc}`,
        `Completed (UTC ms): ${this.completedAtUtc}`,
        "Variable Values:",
        ...this.protocol!.variables
          .filter((definition) => this.values[definition.id] !== undefined)
          .map((definition) => `${definition.id}: ${presentedValues[definition.id]}`),
        "Completed Sections:",
        ...this.completedSectionIds,
      ].join("\n"),
    };
  }

  private evaluateConfiguration(): void {
    // Variable Value validation and resolution live in the domain seam
    // (ProtocolCore.resolveVariableValues); the Reader never re-implements
    // per-kind checks locally.
    const result = ProtocolCore.resolveVariableValues(
      this.protocol!,
      this.values,
      "reader-configuration",
    );
    if (!result.ok) {
      this.evaluationErrors = result.errors;
      this.mode = "configuring";
      return;
    }
    const durationErrors: ProtocolError[] = [];
    for (const [index, section] of this.protocol!.sections.entries()) {
      if (section.duration.kind !== "derived") continue;
      const seconds = result.values[section.duration.variableId];
      const milliseconds =
        typeof seconds === "string"
          ? new ReaderDecimal(seconds)
              .times(1_000)
              .toDecimalPlaces(0, Decimal.ROUND_HALF_EVEN)
          : undefined;
      if (
        milliseconds === undefined ||
        milliseconds.lessThan(1_000) ||
        milliseconds.greaterThan(604_800_000)
      ) {
        durationErrors.push({
          code: "invalid_duration",
          path: `sections.${index}.duration`,
          message:
            "A resolved Section duration must be from 1 second through 7 days",
        });
      }
    }
    if (durationErrors.length > 0) {
      this.values = result.values;
      this.evaluationErrors = durationErrors;
      this.mode = "configuring";
      return;
    }
    this.values = result.values;
    this.evaluationErrors = [];
    this.mode = "ready";
  }

  private enterCurrentSection(): void {
    const section = this.protocol!.sections[this.currentSectionIndex!];
    if (section === undefined) {
      this.mode = "completed";
      this.completedAtUtc = this.options.wallNow();
      return;
    }
    this.mode = "playing";
    if (this.completedSectionIds.includes(section.sectionId)) {
      this.remainingMilliseconds = undefined;
      return;
    }
    if (section.duration.kind === "untimed") {
      this.remainingMilliseconds = undefined;
      return;
    }
    const seconds =
      section.duration.kind === "fixed"
        ? section.duration.seconds
        : String(this.values[section.duration.variableId]);
    this.remainingMilliseconds = new ReaderDecimal(seconds)
      .times(1_000)
      .toDecimalPlaces(0, Decimal.ROUND_HALF_EVEN)
      .toNumber();
    this.scheduleCurrentTimer();
  }

  private completeAndAdvance(): void {
    const section = this.protocol!.sections[this.currentSectionIndex!];
    if (!this.completedSectionIds.includes(section!.sectionId)) {
      this.completedSectionIds.push(section!.sectionId);
    }
    this.currentSectionIndex = this.currentSectionIndex! + 1;
    this.remainingMilliseconds = undefined;
    this.timerStartedMonotonic = undefined;
    this.timerStartedWall = undefined;
    this.enterCurrentSection();
    this.persistSession();
  }

  private scheduleCurrentTimer(): void {
    if (this.remainingMilliseconds === undefined) return;
    this.timerStartedMonotonic = this.options.monotonicNow();
    this.timerStartedWall = this.options.wallNow();
    this.timerHandle = this.options.scheduler.setTimeout(
      () => this.handleTimer(),
      this.remainingMilliseconds,
    );
  }

  private handleTimer(): void {
    if (
      this.mode !== "playing" ||
      this.remainingMilliseconds === undefined ||
      this.timerStartedMonotonic === undefined ||
      this.timerStartedWall === undefined
    ) {
      return;
    }
    const monotonicElapsed =
      this.options.monotonicNow() - this.timerStartedMonotonic;
    const wallElapsed = this.options.wallNow() - this.timerStartedWall;
    if (Math.abs(wallElapsed - monotonicElapsed) > 5_000) {
      this.remainingMilliseconds = Math.max(
        0,
        this.remainingMilliseconds - monotonicElapsed,
      );
      this.cancelTimer();
      this.pauseReason = "clock-drift";
      this.mode = "paused";
      this.persistSession();
      return;
    }
    if (monotonicElapsed - this.remainingMilliseconds > 5_000) {
      this.remainingMilliseconds = 0;
      this.cancelTimer();
      this.pauseReason = "timer-delay";
      this.mode = "paused";
      this.persistSession();
      return;
    }
    if (monotonicElapsed < this.remainingMilliseconds) {
      this.remainingMilliseconds -= monotonicElapsed;
      this.scheduleCurrentTimer();
      return;
    }
    this.cancelTimer();
    const section = this.protocol!.sections[this.currentSectionIndex!];
    this.remainingMilliseconds = 0;
    if (!this.taskItemCompletionSatisfied(section!)) {
      this.persistSession();
      return;
    }
    this.finishTimedSection();
  }

  private finishTimedSection(): void {
    const section = this.protocol!.sections[this.currentSectionIndex!]!;
    if (section.endAction === "wait") {
      this.remainingMilliseconds = undefined;
      this.mode = "waiting";
      this.persistSession();
      return;
    }
    this.completeAndAdvance();
  }

  private taskItemCompletionSatisfied(
    section: Protocol["sections"][number],
    checkedTaskItems = this.checkedTaskItems,
  ): boolean {
    if (section.completionRequirement !== "all-task-items") return true;
    return (
      (checkedTaskItems[section.sectionId] ?? []).length ===
      ProtocolCore.countTaskItems(section.markdown)
    );
  }

  private requireTaskItemCompletion(
    section: Protocol["sections"][number],
  ): void {
    if (this.taskItemCompletionSatisfied(section)) return;
    throw new ReaderWorkspaceFailure(
      "task_items_incomplete",
      "playback.checklist",
      "Complete every checklist Task Item before completing this Section",
    );
  }

  private currentSectionCompleted(): boolean {
    const section = this.protocol?.sections[this.currentSectionIndex ?? -1];
    return (
      section !== undefined &&
      this.completedSectionIds.includes(section.sectionId)
    );
  }

  private cancelTimer(): void {
    if (this.timerHandle !== undefined) {
      this.options.scheduler.clearTimeout(this.timerHandle);
      this.timerHandle = undefined;
    }
    this.timerStartedMonotonic = undefined;
    this.timerStartedWall = undefined;
  }

  private persistSession(): void {
    if (
      this.authorPreview ||
      this.persistence !== "persistent" ||
      this.options.sessionStorage === undefined ||
      this.protocolFingerprint === undefined ||
      this.currentSectionIndex === undefined ||
      this.startedAtUtc === undefined ||
      (this.mode !== "playing" &&
        this.mode !== "paused" &&
        this.mode !== "waiting" &&
        this.mode !== "completed")
    ) {
      return;
    }
    this.options.sessionStorage.setItem(
      this.sessionKey(),
      JSON.stringify({
        formatVersion: 1,
        protocolFingerprint: this.protocolFingerprint,
        values: this.values,
        currentSectionIndex: this.currentSectionIndex,
        completedSectionIds: this.completedSectionIds,
        checkedTaskItems: this.checkedTaskItems,
        state: this.mode,
        ...(this.remainingMilliseconds === undefined
          ? {}
          : { remainingMilliseconds: this.remainingMilliseconds }),
        startedAtUtc: this.startedAtUtc,
        ...(this.completedAtUtc === undefined
          ? {}
          : { completedAtUtc: this.completedAtUtc }),
        updatedAtUtc: this.options.wallNow(),
      }),
    );
  }

  private sessionKey(): string {
    return `protocol-box:playback:${this.protocolFingerprint}`;
  }

  private requireConfiguration(): void {
    if (
      this.protocol === undefined ||
      (this.mode !== "configuring" && this.mode !== "ready")
    ) {
      throw new ReaderWorkspaceFailure(
        "configuration_locked",
        "values",
        "Input Variables cannot change during Playback",
      );
    }
  }
}
