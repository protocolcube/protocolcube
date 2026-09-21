import { describe, expect, it, vi } from "vitest";
import { ProtocolCore, type Protocol } from "../../../domain/protocol";
import { ReaderWorkspace, type ReaderScheduler } from "./index";

const readerProtocol: Protocol = {
  protocolId: "018f7f3e-7b1d-7a91-bf10-8f767a9c0f70",
  title: "Reader tracer",
  sections: [
    {
      sectionId: "018f7f3e-7b1d-7a91-bf10-8f767a9c0f71",
      title: "Prepare {{ amount }}",
      markdown:
        "Prepare **{{ amount }}** units.\n\n- [ ] Confirm preparation.",
      duration: { kind: "untimed" },
      endAction: "wait",
    },
    {
      sectionId: "018f7f3e-7b1d-7a91-bf10-8f767a9c0f72",
      title: "Incubate",
      markdown: "Wait for {{ doubled }} units.",
      duration: { kind: "fixed", seconds: "1" },
      endAction: "advance",
    },
  ],
  variables: [
    {
      kind: "input",
      id: "amount",
      label: "Amount",
      valueType: "numeric",
      minimum: "1",
      maximum: "10",
    },
    {
      kind: "derived",
      id: "doubled",
      label: "Doubled",
      valueType: "numeric",
      formula: "amount * 2",
      precision: 0,
      roundingMode: "half-even",
    },
  ],
  formulaTestCases: [
    {
      testCaseId: "018f7f3e-7b1d-7a91-bf10-8f767a9c0f73",
      name: "Doubles amount",
      inputValues: { amount: "2" },
      expectedDerivedValues: { doubled: "4" },
      precision: 0,
      roundingMode: "half-even",
    },
  ],
};

describe("ReaderWorkspace", () => {
  it("simulates an Unsigned Draft in memory without creating Reader evidence", async () => {
    const workspace = await ReaderWorkspace.openAuthorPreview({
      protocol: readerProtocol,
      monotonicNow: () => 1_000,
      wallNow: () => 1_700_000_000_000,
      scheduler: {
        setTimeout: () => 1,
        clearTimeout: () => undefined,
      },
    });

    expect(workspace.isAuthorPreview()).toBe(true);
    expect(workspace.inspection()).toMatchObject({
      format: "valid",
      signature: "unverified",
      playable: true,
    });
    workspace.setInputValue("amount", "3");
    expect(() =>
      workspace.startPlayback({
        persistence: "persistent",
        sensitiveDataConfirmed: true,
      }),
    ).toThrow(expect.objectContaining({ code: "author_preview_memory_only" }));
    workspace.startPlayback({ persistence: "memory" });
    workspace.completeCurrentSection();
    workspace.jumpToSection({ sectionIndex: 0, confirmed: true });
    expect(workspace.snapshot()).toMatchObject({
      mode: "playing",
      sectionCompleted: true,
    });
    expect(() => workspace.setTaskItemChecked(0, true)).toThrow(
      expect.objectContaining({ code: "completed_section_read_only" }),
    );
    expect(() => workspace.completeCurrentSection()).toThrow(
      expect.objectContaining({ code: "section_already_completed" }),
    );
    expect(workspace.restorePersistentSession()).toBe("none");
    expect(() => workspace.completionSummary()).toThrow(
      expect.objectContaining({
        code: "author_preview_has_no_completion_summary",
      }),
    );
  });

  it("loads, configures, plays, and completes a signed Protocol", async () => {
    const keys = await ProtocolCore.generateAuthorKeyPair();
    const signature = await ProtocolCore.signProtocol(
      readerProtocol,
      keys.privateKey,
      keys.publicKey,
    );
    const envelope = ProtocolCore.encodeEnvelope({
      documentKind: "protocol-box/published-protocol",
      formatVersion: 1,
      appVersion: "0.0.0",
      protocol: readerProtocol,
      signature,
    });
    let monotonic = 1_000;
    let wall = 1_700_000_000_000;
    let scheduled: (() => void | Promise<void>) | undefined;
    const scheduler: ReaderScheduler = {
      setTimeout(callback) {
        scheduled = callback;
        return 1;
      },
      clearTimeout() {
        scheduled = undefined;
      },
    };
    const workspace = await ReaderWorkspace.open({
      html: `<script id="protocol-box-data" type="application/octet-stream">${envelope}</script>`,
      monotonicNow: () => monotonic,
      wallNow: () => wall,
      scheduler,
    });

    expect(workspace.inspection()).toMatchObject({
      format: "valid",
      signature: "match",
      playable: true,
      protocolFingerprint: expect.stringMatching(/^[0-9a-f]{64}$/),
      keyId: signature.keyId,
    });
    workspace.setInputValue("amount", "3");
    expect(workspace.snapshot()).toMatchObject({
      mode: "ready",
      values: { amount: "3", doubled: "6" },
    });

    workspace.startPlayback({ persistence: "memory" });
    expect(workspace.snapshot()).toMatchObject({
      mode: "playing",
      currentSectionIndex: 0,
      renderedSection: {
        title: "Prepare 3",
        markdown: "Prepare **3** units.\n\n- [ ] Confirm preparation.",
      },
    });
    workspace.completeCurrentSection();
    expect(workspace.snapshot()).toMatchObject({
      mode: "playing",
      currentSectionIndex: 1,
      remainingMilliseconds: 1_000,
    });

    monotonic += 1_000;
    wall += 1_000;
    await scheduled?.();

    expect(workspace.snapshot()).toMatchObject({ mode: "completed" });
    const summary = workspace.completionSummary();
    expect(summary).toMatchObject({
      label: "Non-audit personal reference",
      protocolFingerprint: expect.stringMatching(/^[0-9a-f]{64}$/),
      values: { amount: "3", doubled: "6" },
      completedSectionIds: readerProtocol.sections.map(
        (section) => section.sectionId,
      ),
    });
    expect(summary.text).toBe(
      [
        "Non-audit personal reference",
        `Protocol Fingerprint: ${summary.protocolFingerprint}`,
        "Started (UTC ms): 1700000000000",
        "Completed (UTC ms): 1700000001000",
        "Variable Values:",
        "amount: 3",
        "doubled: 6",
        "Completed Sections:",
        ...readerProtocol.sections.map((section) => section.sectionId),
      ].join("\n"),
    );
    expect(summary.text).not.toMatch(
      /\b(?:signature|certificate|audit record|proof|verified completion)\b/i,
    );
  });

  it("requires every task item before an untimed Section can complete", async () => {
    const protocol: Protocol = {
      ...readerProtocol,
      sections: [
        {
          ...readerProtocol.sections[0]!,
          markdown: "- [x] Repeat\n- [ ] Repeat",
          completionRequirement: "all-task-items",
        },
      ],
    };
    const workspace = await ReaderWorkspace.openAuthorPreview({
      protocol,
      monotonicNow: () => 0,
      wallNow: () => 0,
      scheduler: {
        setTimeout: () => 1,
        clearTimeout: () => undefined,
      },
    });
    workspace.setInputValue("amount", "2");
    workspace.startPlayback({ persistence: "memory" });

    expect(workspace.snapshot()).toMatchObject({
      mode: "playing",
      checkedTaskItemIndexes: [],
      taskItemCount: 2,
      taskItemCompletionRequired: true,
      taskItemCompletionSatisfied: false,
      canCompleteSection: false,
      sectionCompleted: false,
    });
    expect(() => workspace.completeCurrentSection()).toThrow(
      expect.objectContaining({ code: "task_items_incomplete" }),
    );
    expect(() => workspace.setTaskItemChecked(2, true)).toThrow(
      expect.objectContaining({ code: "invalid_task_item" }),
    );

    workspace.setTaskItemChecked(0, true);
    workspace.setTaskItemChecked(1, true);
    expect(workspace.snapshot()).toMatchObject({
      checkedTaskItemIndexes: [0, 1],
      taskItemCompletionSatisfied: true,
      canCompleteSection: true,
    });
    workspace.completeCurrentSection();
    expect(workspace.snapshot()).toMatchObject({
      mode: "completed",
      completedSectionIds: [protocol.sections[0]!.sectionId],
    });
  });

  it("waits for a checklist when a timed advancing Section expires first", async () => {
    const protocol: Protocol = {
      ...readerProtocol,
      sections: [
        {
          ...readerProtocol.sections[0]!,
          markdown: "- [ ] Confirm",
          duration: { kind: "fixed", seconds: "1" },
          endAction: "advance",
          completionRequirement: "all-task-items",
        },
      ],
    };
    let now = 0;
    let scheduled: (() => void | Promise<void>) | undefined;
    const workspace = await ReaderWorkspace.openAuthorPreview({
      protocol,
      monotonicNow: () => now,
      wallNow: () => now,
      scheduler: {
        setTimeout(callback) {
          scheduled = callback;
          return 1;
        },
        clearTimeout: () => undefined,
      },
    });
    workspace.setInputValue("amount", "2");
    workspace.startPlayback({ persistence: "memory" });

    now = 1_000;
    await scheduled?.();
    expect(workspace.snapshot()).toMatchObject({
      mode: "playing",
      remainingMilliseconds: 0,
      taskItemCompletionSatisfied: false,
      canCompleteSection: false,
    });

    workspace.setTaskItemChecked(0, true);
    expect(workspace.snapshot()).toMatchObject({
      mode: "completed",
      completedSectionIds: [protocol.sections[0]!.sectionId],
    });
  });

  it("waits for acknowledgement after checklist and timer conditions are met", async () => {
    const protocol: Protocol = {
      ...readerProtocol,
      sections: [
        {
          ...readerProtocol.sections[0]!,
          markdown: "- [ ] Confirm",
          duration: { kind: "fixed", seconds: "1" },
          endAction: "wait",
          completionRequirement: "all-task-items",
        },
      ],
    };
    let now = 0;
    let scheduled: (() => void | Promise<void>) | undefined;
    const workspace = await ReaderWorkspace.openAuthorPreview({
      protocol,
      monotonicNow: () => now,
      wallNow: () => now,
      scheduler: {
        setTimeout(callback) {
          scheduled = callback;
          return 1;
        },
        clearTimeout: () => undefined,
      },
    });
    workspace.setInputValue("amount", "2");
    workspace.startPlayback({ persistence: "memory" });
    workspace.setTaskItemChecked(0, true);

    now = 1_000;
    await scheduled?.();
    expect(workspace.snapshot()).toMatchObject({
      mode: "waiting",
      taskItemCompletionSatisfied: true,
      canCompleteSection: true,
    });
    workspace.acknowledgeSection();
    expect(workspace.snapshot()).toMatchObject({ mode: "completed" });
  });

  it("keeps Signature Match independent from playability and read-only content", async () => {
      const keys = await ProtocolCore.generateAuthorKeyPair();
      const signature = await ProtocolCore.signProtocol(
        readerProtocol,
        keys.privateKey,
        keys.publicKey,
      );
      const changedProtocol = { ...readerProtocol, title: "Changed after signing" };
      const envelope = ProtocolCore.encodeEnvelope({
        documentKind: "protocol-box/published-protocol",
        formatVersion: 1,
        appVersion: "0.0.0",
        protocol: changedProtocol,
        signature,
      });
      const workspace = await ReaderWorkspace.open({
        html: `<script id="protocol-box-data" type="application/octet-stream">${envelope}</script>`,
        monotonicNow: () => 0,
        wallNow: () => 0,
        scheduler: {
          setTimeout: () => 1,
          clearTimeout: () => undefined,
        },
      });

      expect(workspace.inspection()).toMatchObject({
        format: "valid",
        signature: "mismatch",
        playable: true,
      });
      const inspected = workspace.readProtocol();
      expect(inspected?.title).toBe("Changed after signing");
      inspected!.title = "Reader mutation";
      expect(workspace.readProtocol()?.title).toBe("Changed after signing");
      expect(() => workspace.startPlayback({ persistence: "memory" })).toThrowError(
        expect.objectContaining({ code: "configuration_invalid" }),
      );
  });

  it("keeps a Published Protocol inspectable when Web Crypto is unavailable", async () => {
    const keys = await ProtocolCore.generateAuthorKeyPair();
    const signature = await ProtocolCore.signProtocol(
      readerProtocol,
      keys.privateKey,
      keys.publicKey,
    );
    const envelope = ProtocolCore.encodeEnvelope({
      documentKind: "protocol-box/published-protocol",
      formatVersion: 1,
      appVersion: "0.0.0",
      protocol: readerProtocol,
      signature,
    });
    vi.stubGlobal("crypto", undefined);
    try {
      const workspace = await ReaderWorkspace.open({
        html: `<script id="protocol-box-data" type="application/octet-stream">${envelope}</script>`,
        monotonicNow: () => 0,
        wallNow: () => 0,
        scheduler: {
          setTimeout: () => 1,
          clearTimeout: () => undefined,
        },
      });

      expect(workspace.inspection()).toMatchObject({
        format: "valid",
        signature: "unverified",
        playable: true,
        keyId: signature.keyId,
        errors: [
          expect.objectContaining({ code: "web_crypto_unavailable" }),
        ],
      });
      expect(workspace.readProtocol()?.title).toBe(readerProtocol.title);
      expect(() =>
        workspace.startPlayback({ persistence: "memory" }),
      ).toThrowError(expect.objectContaining({ code: "configuration_invalid" }));
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("blocks Playback when the Published Protocol HTML exceeds its resource limit", async () => {
    const keys = await ProtocolCore.generateAuthorKeyPair();
    const signature = await ProtocolCore.signProtocol(
      readerProtocol,
      keys.privateKey,
      keys.publicKey,
    );
    const envelope = ProtocolCore.encodeEnvelope({
      documentKind: "protocol-box/published-protocol",
      formatVersion: 1,
      appVersion: "0.0.0",
      protocol: readerProtocol,
      signature,
    });
    const workspace = await ReaderWorkspace.open({
      html:
        `<script id="protocol-box-data" type="application/octet-stream">${envelope}</script>` +
        " ".repeat(25 * 1024 * 1024),
      monotonicNow: () => 0,
      wallNow: () => 0,
      scheduler: {
        setTimeout: () => 1,
        clearTimeout: () => undefined,
      },
    });

    expect(workspace.inspection()).toMatchObject({
      format: "valid",
      signature: "match",
      playable: false,
      errors: [
        expect.objectContaining({
          code: "resource_limit",
          path: "publishedHtml",
        }),
      ],
    });
    expect(() =>
      workspace.startPlayback({ persistence: "memory" }),
    ).toThrowError(expect.objectContaining({ code: "configuration_invalid" }));
  });

  it("pauses on dual-clock drift and waits for acknowledgement without skipping", async () => {
    const keys = await ProtocolCore.generateAuthorKeyPair();
    const waitProtocol: Protocol = {
      ...readerProtocol,
      sections: readerProtocol.sections.map((section, index) =>
        index === 1 ? { ...section, endAction: "wait" as const } : section,
      ),
    };
    const signature = await ProtocolCore.signProtocol(
      waitProtocol,
      keys.privateKey,
      keys.publicKey,
    );
    const envelope = ProtocolCore.encodeEnvelope({
      documentKind: "protocol-box/published-protocol",
      formatVersion: 1,
      appVersion: "0.0.0",
      protocol: waitProtocol,
      signature,
    });
    let monotonic = 0;
    let wall = 1_700_000_000_000;
    let scheduled: (() => void | Promise<void>) | undefined;
    const workspace = await ReaderWorkspace.open({
      html: `<script id="protocol-box-data" type="application/octet-stream">${envelope}</script>`,
      monotonicNow: () => monotonic,
      wallNow: () => wall,
      scheduler: {
        setTimeout(callback) {
          scheduled = callback;
          return 1;
        },
        clearTimeout() {
          scheduled = undefined;
        },
      },
    });
    workspace.setInputValue("amount", "3");
    workspace.startPlayback({ persistence: "memory" });
    workspace.completeCurrentSection();

    workspace.handleVisibilityChange("hidden");
    expect(workspace.snapshot()).toMatchObject({
      mode: "paused",
      reason: "page-hidden",
      currentSectionIndex: 1,
      remainingMilliseconds: 1_000,
    });
    workspace.resumePlayback({ confirmed: true });

    monotonic += 400;
    wall += 5_400;
    await scheduled?.();
    expect(workspace.snapshot()).toMatchObject({
      mode: "playing",
      currentSectionIndex: 1,
      remainingMilliseconds: 600,
    });

    monotonic += 100;
    wall += 5_101;
    await scheduled?.();
    expect(workspace.snapshot()).toMatchObject({
      mode: "paused",
      reason: "clock-drift",
      currentSectionIndex: 1,
      remainingMilliseconds: 500,
    });

    workspace.resumePlayback({ confirmed: true });
    monotonic += 500;
    wall += 500;
    await scheduled?.();
    expect(workspace.snapshot()).toMatchObject({
      mode: "waiting",
      currentSectionIndex: 1,
    });

    workspace.acknowledgeSection();
    expect(workspace.snapshot()).toMatchObject({
      mode: "completed",
      completedSectionIds: waitProtocol.sections.map(
        (section) => section.sectionId,
      ),
    });
  });

  it("pauses instead of advancing after a substantially delayed timer callback", async () => {
    const keys = await ProtocolCore.generateAuthorKeyPair();
    const signature = await ProtocolCore.signProtocol(
      readerProtocol,
      keys.privateKey,
      keys.publicKey,
    );
    const envelope = ProtocolCore.encodeEnvelope({
      documentKind: "protocol-box/published-protocol",
      formatVersion: 1,
      appVersion: "0.0.0",
      protocol: readerProtocol,
      signature,
    });
    let now = 0;
    let scheduled: (() => void | Promise<void>) | undefined;
    const workspace = await ReaderWorkspace.open({
      html: `<script id="protocol-box-data" type="application/octet-stream">${envelope}</script>`,
      monotonicNow: () => now,
      wallNow: () => now,
      scheduler: {
        setTimeout(callback) {
          scheduled = callback;
          return 1;
        },
        clearTimeout: () => undefined,
      },
    });
    workspace.setInputValue("amount", "2");
    workspace.startPlayback({ persistence: "memory" });
    workspace.completeCurrentSection();

    now = 6_001;
    await scheduled?.();
    expect(workspace.snapshot()).toMatchObject({
      mode: "paused",
      reason: "timer-delay",
      currentSectionIndex: 1,
      remainingMilliseconds: 0,
    });
  });

  it("restores persistent progress by Protocol Fingerprint and quarantines invalid state", async () => {
    const keys = await ProtocolCore.generateAuthorKeyPair();
    const signature = await ProtocolCore.signProtocol(
      readerProtocol,
      keys.privateKey,
      keys.publicKey,
    );
    const envelope = ProtocolCore.encodeEnvelope({
      documentKind: "protocol-box/published-protocol",
      formatVersion: 1,
      appVersion: "0.0.0",
      protocol: readerProtocol,
      signature,
    });
    const html = `<script id="protocol-box-data" type="application/octet-stream">${envelope}</script>`;
    const stored = new Map<string, string>();
    const sessionStorage = {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
      removeItem: (key: string) => stored.delete(key),
      keys: () => [...stored.keys()],
    };
    const options = {
      html,
      monotonicNow: () => 0,
      wallNow: () => 1_700_000_000_000,
      scheduler: {
        setTimeout: () => 1,
        clearTimeout: () => undefined,
      },
      sessionStorage,
    };
    const first = await ReaderWorkspace.open(options);
    first.setInputValue("amount", "4");
    first.startPlayback({
      persistence: "persistent",
      sensitiveDataConfirmed: true,
    });
    first.setTaskItemChecked(0, true);
    first.completeCurrentSection();

    const restored = await ReaderWorkspace.open(options);
    expect(restored.restorePersistentSession()).toBe("restored");
    expect(restored.snapshot()).toMatchObject({
      mode: "paused",
      reason: "page-visible",
      currentSectionIndex: 1,
      values: { amount: "4", doubled: "8" },
      remainingMilliseconds: 1_000,
    });
    restored.jumpToSection({ sectionIndex: 0, confirmed: true });
    expect(restored.snapshot()).toMatchObject({
      currentSectionIndex: 0,
      checkedTaskItemIndexes: [0],
    });

    const fingerprint = restored.inspection().protocolFingerprint!;
    const activeKey = `protocol-box:playback:${fingerprint}`;
    const impossibleSession = JSON.parse(stored.get(activeKey)!) as Record<
      string,
      unknown
    >;
    const impossibleRaw = JSON.stringify({
      ...impossibleSession,
      state: "completed",
      currentSectionIndex: 0,
      completedAtUtc: 1_700_000_000_000,
    });
    stored.set(activeKey, impossibleRaw);
    const impossible = await ReaderWorkspace.open(options);
    expect(impossible.restorePersistentSession()).toBe("quarantined");

    stored.set(`protocol-box:playback:${fingerprint}`, "{broken");
    const corrupted = await ReaderWorkspace.open(options);
    expect(corrupted.restorePersistentSession()).toBe("quarantined");
    expect(corrupted.snapshot()).toMatchObject({
      mode: "quarantined",
      protocolFingerprint: fingerprint,
    });
    expect(
      [...stored.entries()].some(
        ([key, value]) =>
          key.startsWith(
            `protocol-box:playback-quarantine:${fingerprint}:`,
          ) && value === "{broken",
      ),
    ).toBe(true);
    expect(
      [...stored.entries()]
        .filter(([key]) =>
          key.startsWith(`protocol-box:playback-quarantine:${fingerprint}:`),
        )
        .map(([, value]) => value),
    ).toEqual(expect.arrayContaining([impossibleRaw, "{broken"]));

    expect(() => corrupted.clearSession({ confirmed: false })).toThrowError(
      expect.objectContaining({ code: "session_reset_confirmation_required" }),
    );
    corrupted.clearSession({ confirmed: true });
    expect(
      [...stored.keys()].filter((key) => key.includes(fingerprint)),
    ).toEqual([]);
    expect(corrupted.snapshot()).toMatchObject({ mode: "configuring" });
  });

  it("validates every Input Variable type before Playback", async () => {
    const protocol: Protocol = {
      ...readerProtocol,
      sections: [readerProtocol.sections[0]!],
      variables: [
        {
          kind: "input",
          id: "note",
          label: "Note",
          valueType: "text",
        },
        {
          kind: "input",
          id: "amount",
          label: "Amount",
          valueType: "numeric",
          minimum: "1",
          maximum: "10",
        },
        {
          kind: "input",
          id: "enabled",
          label: "Enabled",
          valueType: "boolean",
        },
        {
          kind: "input",
          id: "mode",
          label: "Mode",
          valueType: "enum",
          options: ["gentle", "rapid"],
        },
      ],
      formulaTestCases: [],
    };
    const keys = await ProtocolCore.generateAuthorKeyPair();
    const signature = await ProtocolCore.signProtocol(
      protocol,
      keys.privateKey,
      keys.publicKey,
    );
    const envelope = ProtocolCore.encodeEnvelope({
      documentKind: "protocol-box/published-protocol",
      formatVersion: 1,
      appVersion: "0.0.0",
      protocol,
      signature,
    });
    const workspace = await ReaderWorkspace.open({
      html: `<script id="protocol-box-data" type="application/octet-stream">${envelope}</script>`,
      monotonicNow: () => 0,
      wallNow: () => 0,
      scheduler: {
        setTimeout: () => 1,
        clearTimeout: () => undefined,
      },
    });

    workspace.setInputValue("note", "");
    workspace.setInputValue("amount", "01");
    workspace.setInputValue("enabled", "true");
    workspace.setInputValue("mode", "unknown");
    expect(workspace.snapshot()).toMatchObject({
      mode: "configuring",
      errors: expect.arrayContaining([
        expect.objectContaining({ code: "missing_input", path: "values.note" }),
        expect.objectContaining({ code: "invalid_input", path: "values.amount" }),
        expect.objectContaining({ code: "invalid_input", path: "values.enabled" }),
        expect.objectContaining({ code: "invalid_input", path: "values.mode" }),
      ]),
    });

    workspace.setInputValue("note", "Reader note");
    workspace.setInputValue("amount", "10");
    workspace.setInputValue("enabled", true);
    workspace.setInputValue("mode", "rapid");
    expect(workspace.snapshot()).toMatchObject({
      mode: "ready",
      values: {
        note: "Reader note",
        amount: "10",
        enabled: true,
        mode: "rapid",
      },
      errors: [],
    });
  });

  it("resolves Derived Variable durations with decimal half-even milliseconds", async () => {
    const protocol: Protocol = {
      ...readerProtocol,
      sections: [
        {
          ...readerProtocol.sections[0]!,
          title: "First timer",
          markdown: "First timer.",
          duration: { kind: "derived", variableId: "firstSeconds" },
          endAction: "advance",
        },
        {
          ...readerProtocol.sections[1]!,
          markdown: "Last timer.",
          duration: { kind: "derived", variableId: "lastSeconds" },
        },
      ],
      variables: [
        {
          kind: "input",
          id: "seconds",
          label: "Seconds",
          valueType: "numeric",
        },
        {
          kind: "derived",
          id: "firstSeconds",
          label: "First duration",
          valueType: "numeric",
          formula: "seconds",
          precision: 4,
          roundingMode: "half-even",
        },
        {
          kind: "derived",
          id: "lastSeconds",
          label: "Last duration",
          valueType: "numeric",
          formula: "604800.0005",
          precision: 4,
          roundingMode: "half-even",
        },
      ],
      formulaTestCases: [
        {
          testCaseId: "018f7f3e-7b1d-7a91-bf10-8f767a9c0f74",
          name: "Resolves durations",
          inputValues: { seconds: "1.0005" },
          expectedDerivedValues: {
            firstSeconds: "1.0005",
            lastSeconds: "604800.0005",
          },
          precision: 4,
          roundingMode: "half-even",
        },
      ],
    };
    const keys = await ProtocolCore.generateAuthorKeyPair();
    const signature = await ProtocolCore.signProtocol(
      protocol,
      keys.privateKey,
      keys.publicKey,
    );
    const envelope = ProtocolCore.encodeEnvelope({
      documentKind: "protocol-box/published-protocol",
      formatVersion: 1,
      appVersion: "0.0.0",
      protocol,
      signature,
    });
    const delays: number[] = [];
    let scheduled: (() => void | Promise<void>) | undefined;
    let now = 0;
    const workspace = await ReaderWorkspace.open({
      html: `<script id="protocol-box-data" type="application/octet-stream">${envelope}</script>`,
      monotonicNow: () => now,
      wallNow: () => now,
      scheduler: {
        setTimeout(callback, delay) {
          scheduled = callback;
          delays.push(delay);
          return 1;
        },
        clearTimeout: () => undefined,
      },
    });

    workspace.setInputValue("seconds", "1.0005");
    workspace.startPlayback({ persistence: "memory" });
    expect(workspace.snapshot()).toMatchObject({
      mode: "playing",
      remainingMilliseconds: 1_000,
    });
    expect(() => workspace.completeCurrentSection()).toThrowError(
      expect.objectContaining({ code: "timed_section_in_progress" }),
    );
    now = 1_000;
    await scheduled?.();
    expect(workspace.snapshot()).toMatchObject({
      mode: "playing",
      currentSectionIndex: 1,
      remainingMilliseconds: 604_800_000,
    });
    expect(delays).toEqual([1_000, 604_800_000]);

    const invalidDuration = await ReaderWorkspace.open({
      html: `<script id="protocol-box-data" type="application/octet-stream">${envelope}</script>`,
      monotonicNow: () => 0,
      wallNow: () => 0,
      scheduler: {
        setTimeout: () => 1,
        clearTimeout: () => undefined,
      },
    });
    invalidDuration.setInputValue("seconds", "0.9994");
    expect(invalidDuration.snapshot()).toMatchObject({
      mode: "configuring",
      errors: [
        expect.objectContaining({
          code: "invalid_duration",
          path: "sections.0.duration",
        }),
      ],
    });
  });

  it("requires confirmation for a manual Section jump without inferring completion", async () => {
    const jumpProtocol: Protocol = {
      ...readerProtocol,
      sections: readerProtocol.sections.map((section) => ({
        ...section,
        duration: { kind: "untimed" as const },
      })),
    };
    const keys = await ProtocolCore.generateAuthorKeyPair();
    const signature = await ProtocolCore.signProtocol(
      jumpProtocol,
      keys.privateKey,
      keys.publicKey,
    );
    const envelope = ProtocolCore.encodeEnvelope({
      documentKind: "protocol-box/published-protocol",
      formatVersion: 1,
      appVersion: "0.0.0",
      protocol: jumpProtocol,
      signature,
    });
    const workspace = await ReaderWorkspace.open({
      html: `<script id="protocol-box-data" type="application/octet-stream">${envelope}</script>`,
      monotonicNow: () => 0,
      wallNow: () => 0,
      scheduler: {
        setTimeout: () => 1,
        clearTimeout: () => undefined,
      },
    });
    workspace.setInputValue("amount", "2");
    workspace.startPlayback({ persistence: "memory" });

    expect(() =>
      workspace.jumpToSection({ sectionIndex: 1, confirmed: false }),
    ).toThrowError(
      expect.objectContaining({ code: "section_jump_confirmation_required" }),
    );
    workspace.jumpToSection({ sectionIndex: 1, confirmed: true });
    expect(workspace.snapshot()).toMatchObject({
      mode: "playing",
      currentSectionIndex: 1,
    });
    workspace.completeCurrentSection();
    expect(workspace.completionSummary().completedSectionIds).toEqual([
      jumpProtocol.sections[1]!.sectionId,
    ]);
  });

  it("keeps memory-only progress out of storage and isolates persistent Sessions by fingerprint", async () => {
    const keys = await ProtocolCore.generateAuthorKeyPair();
    const firstSignature = await ProtocolCore.signProtocol(
      readerProtocol,
      keys.privateKey,
      keys.publicKey,
    );
    const revisedProtocol = { ...readerProtocol, title: "Reader revision" };
    const revisedSignature = await ProtocolCore.signProtocol(
      revisedProtocol,
      keys.privateKey,
      keys.publicKey,
    );
    const stored = new Map<string, string>();
    const sessionStorage = {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
      removeItem: (key: string) => stored.delete(key),
      keys: () => [...stored.keys()],
    };
    const open = (protocol: Protocol, signature: typeof firstSignature) =>
      ReaderWorkspace.open({
        html: `<script id="protocol-box-data" type="application/octet-stream">${ProtocolCore.encodeEnvelope({
          documentKind: "protocol-box/published-protocol",
          formatVersion: 1,
          appVersion: "0.0.0",
          protocol,
          signature,
        })}</script>`,
        monotonicNow: () => 0,
        wallNow: () => 1_700_000_000_000,
        scheduler: {
          setTimeout: () => 1,
          clearTimeout: () => undefined,
        },
        sessionStorage,
      });

    const memoryOnly = await open(readerProtocol, firstSignature);
    memoryOnly.setInputValue("amount", "2");
    memoryOnly.startPlayback({ persistence: "memory" });
    memoryOnly.completeCurrentSection();
    expect(stored.size).toBe(0);

    const persistent = await open(readerProtocol, firstSignature);
    persistent.setInputValue("amount", "3");
    persistent.startPlayback({
      persistence: "persistent",
      sensitiveDataConfirmed: true,
    });
    expect(stored.size).toBe(1);

    const revised = await open(revisedProtocol, revisedSignature);
    expect(revised.restorePersistentSession()).toBe("none");
    expect(revised.snapshot()).toMatchObject({ mode: "configuring" });
  });
});
