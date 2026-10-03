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

  it("drives Section timers from configured Duration and Numeric Input Variables", async () => {
    const protocol: Protocol = {
      ...readerProtocol,
      sections: [
        {
          ...readerProtocol.sections[0]!,
          title: "Soak",
          markdown: "Soak the sample.",
          duration: { kind: "derived", variableId: "soakSeconds" },
          endAction: "advance",
        },
        {
          ...readerProtocol.sections[1]!,
          title: "Incubate",
          markdown: "Incubate the sample.",
          duration: { kind: "derived", variableId: "legacySeconds" },
        },
      ],
      variables: [
        {
          kind: "input",
          id: "soakSeconds",
          label: "Soak",
          valueType: "duration",
          unit: "second",
          maximum: "700000",
        },
        {
          kind: "input",
          id: "legacySeconds",
          label: "Legacy",
          valueType: "numeric",
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
    const openDenied = () =>
      ReaderWorkspace.open({
        html: `<script id="protocol-box-data" type="application/octet-stream">${envelope}</script>`,
        monotonicNow: () => 0,
        wallNow: () => 0,
        scheduler: {
          setTimeout: () => 1,
          clearTimeout: () => undefined,
        },
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

    // A Duration Input Variable resolves to canonical seconds, so the Section
    // timer reads it directly with no extra unit conversion and the same
    // half-even millisecond rounding as Numeric references.
    workspace.setInputValue("soakSeconds", "1.0005");
    workspace.setInputValue("legacySeconds", "2.5");
    workspace.startPlayback({ persistence: "memory" });
    expect(workspace.snapshot()).toMatchObject({
      mode: "playing",
      remainingMilliseconds: 1_000, // 1.0005 s → 1000.5 ms rounds half-even
    });
    expect(() => workspace.completeCurrentSection()).toThrowError(
      expect.objectContaining({ code: "timed_section_in_progress" }),
    );
    now = 1_000;
    await scheduled?.();
    expect(workspace.snapshot()).toMatchObject({
      mode: "playing",
      currentSectionIndex: 1,
      remainingMilliseconds: 2_500,
    });
    expect(delays).toEqual([1_000, 2_500]);

    // The resolved 1 s–7 days bound applies to both kinds: the Duration
    // reference through its canonical seconds, the Numeric reference with
    // unchanged value-means-seconds semantics.
    const aboveBound = await openDenied();
    aboveBound.setInputValue("soakSeconds", "700000");
    aboveBound.setInputValue("legacySeconds", "700000");
    expect(aboveBound.snapshot()).toMatchObject({
      mode: "configuring",
      errors: [
        { code: "invalid_duration", path: "sections.0.duration" },
        { code: "invalid_duration", path: "sections.1.duration" },
      ],
    });
    const belowBound = await openDenied();
    belowBound.setInputValue("soakSeconds", "0.5");
    belowBound.setInputValue("legacySeconds", "0.9994");
    expect(belowBound.snapshot()).toMatchObject({
      mode: "configuring",
      errors: [
        { code: "invalid_duration", path: "sections.0.duration" },
        { code: "invalid_duration", path: "sections.1.duration" },
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

  it("resolves Duration Input Variable entries in the declared unit", async () => {
    const protocol: Protocol = {
      ...readerProtocol,
      sections: [readerProtocol.sections[0]!],
      variables: [
        {
          kind: "input",
          id: "soakMinutes",
          label: "Soak",
          valueType: "duration",
          unit: "minute",
          defaultValue: "300",
          minimum: "60",
          maximum: "3600",
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
    const open = () =>
      ReaderWorkspace.open({
        html: `<script id="protocol-box-data" type="application/octet-stream">${envelope}</script>`,
        monotonicNow: () => 0,
        wallNow: () => 0,
        scheduler: {
          setTimeout: () => 1,
          clearTimeout: () => undefined,
        },
      });

    // The default is stored as canonical seconds and enters configuration in
    // the declared unit (300 seconds prefills as 5 minutes).
    const defaulted = await open();
    expect(defaulted.snapshot()).toMatchObject({
      mode: "ready",
      values: { soakMinutes: "300" },
      errors: [],
    });

    for (const entry of ["abc", "-1", "0.5", "120"]) {
      const workspace = await open();
      workspace.setInputValue("soakMinutes", entry);
      expect(workspace.snapshot()).toMatchObject({
        mode: "configuring",
        errors: [
          expect.objectContaining({
            code: "invalid_input",
            path: "values.soakMinutes",
          }),
        ],
      });
    }

    const valid = await open();
    valid.setInputValue("soakMinutes", "10");
    expect(valid.snapshot()).toMatchObject({
      mode: "ready",
      values: { soakMinutes: "600" },
      errors: [],
    });
  });

  it("renders Duration Variables through the single formatter on every Reader surface", async () => {
    const protocol: Protocol = {
      ...readerProtocol,
      sections: [
        {
          ...readerProtocol.sections[0]!,
          sectionId: "018f7f3e-7b1d-7a91-bf10-8f767a9c0f74",
          title: "Prepare {{ soakHours }} & record",
          markdown:
            "Soak **{{ soakHours }}** & confirm.\n\n- [ ] Confirm the soak.",
          duration: { kind: "untimed" },
          endAction: "advance",
          completionRequirement: "all-task-items",
        },
        {
          ...readerProtocol.sections[1]!,
          sectionId: "018f7f3e-7b1d-7a91-bf10-8f767a9c0f75",
          title: "Done",
          markdown: "Complete.",
          duration: { kind: "untimed" },
          endAction: "wait",
        },
      ],
      variables: [
        {
          kind: "input",
          id: "soakHours",
          label: "Soak",
          valueType: "duration",
          unit: "hour",
          minimum: "1800",
          maximum: "7200",
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
    const open = () =>
      ReaderWorkspace.open({
        html: `<script id="protocol-box-data" type="application/octet-stream">${envelope}</script>`,
        monotonicNow: () => 0,
        wallNow: () => 0,
        scheduler: {
          setTimeout: () => 1,
          clearTimeout: () => undefined,
        },
      });

    // Every surface renders exactly what the domain formatter renders for
    // the stored canonical seconds.
    const expected = ProtocolCore.formatDurationValue("5400", "hour");
    expect(expected).toBe("1.5 h");

    const workspace = await open();
    workspace.setInputValue("soakHours", "1.5");
    expect(workspace.snapshot()).toMatchObject({
      mode: "ready",
      // Resolved values stay canonical seconds...
      values: { soakHours: "5400" },
      errors: [],
    });
    workspace.startPlayback({ persistence: "memory" });
    // ...while step-text interpolation renders the formatted declared-unit
    // value. The HTML and Markdown escaping still runs over the formatted
    // result after formatting (a no-op on plain decimals and unit symbols),
    // and template text outside `{{ id }}` is untouched.
    expect(workspace.snapshot()).toMatchObject({
      mode: "playing",
      renderedSection: {
        title: "Prepare 1.5 h & record",
        markdown:
          "Soak **1.5 h** & confirm.\n\n- [ ] Confirm the soak.",
      },
    });

    workspace.setTaskItemChecked(0, true);
    workspace.completeCurrentSection();
    workspace.completeCurrentSection();
    const summary = workspace.completionSummary();
    // The Completion Summary keeps the canonical resolved Variable Value in
    // `values` (5400 canonical seconds) and carries the formatted string in
    // the presented record, which `text` prints.
    expect(summary.values.soakHours).toBe("5400");
    expect(summary.presentedValues.soakHours).toBe("1.5 h");
    expect(summary.text).toContain("soakHours: 1.5 h");

    // The Author Preview renders the same formatted text.
    const preview = await ReaderWorkspace.openAuthorPreview({
      protocol,
      monotonicNow: () => 0,
      wallNow: () => 0,
      scheduler: {
        setTimeout: () => 1,
        clearTimeout: () => undefined,
      },
    });
    preview.setInputValue("soakHours", "1.5");
    preview.startPlayback({ persistence: "memory" });
    expect(preview.snapshot()).toMatchObject({
      mode: "playing",
      renderedSection: {
        title: "Prepare 1.5 h & record",
        markdown:
          "Soak **1.5 h** & confirm.\n\n- [ ] Confirm the soak.",
      },
    });
  });

  it("resolves Duration Derived Variable values into canonical seconds", async () => {
    const protocol: Protocol = {
      ...readerProtocol,
      sections: [readerProtocol.sections[0]!],
      variables: [
        {
          kind: "input",
          id: "soakHours",
          label: "Soak",
          valueType: "duration",
          unit: "hour",
        },
        {
          kind: "derived",
          id: "doubledMinutes",
          label: "Doubled soak",
          valueType: "duration",
          unit: "minute",
          formula: "soakHours * 2",
          precision: 2,
          roundingMode: "half-even",
        },
      ],
      formulaTestCases: [
        {
          testCaseId: "018f7f3e-7b1d-7a91-bf10-8f767a9c0f75",
          name: "Doubles the soak",
          inputValues: { soakHours: "1" },
          expectedDerivedValues: { doubledMinutes: "7200" },
          precision: 2,
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
    const workspace = await ReaderWorkspace.open({
      html: `<script id="protocol-box-data" type="application/octet-stream">${envelope}</script>`,
      monotonicNow: () => 0,
      wallNow: () => 0,
      scheduler: {
        setTimeout: () => 1,
        clearTimeout: () => undefined,
      },
    });
    expect(workspace.snapshot()).toMatchObject({ mode: "configuring" });

    // The declared-unit entry (1 hour) resolves to canonical seconds and the
    // Duration Derived Variable evaluates through the same engine into
    // canonical seconds, consumable by timers and summaries.
    workspace.setInputValue("soakHours", "1");
    expect(workspace.snapshot()).toMatchObject({
      mode: "ready",
      values: { soakHours: "3600", doubledMinutes: "7200" },
      errors: [],
    });

    workspace.setInputValue("soakHours", "1.5");
    expect(workspace.snapshot()).toMatchObject({
      mode: "ready",
      values: { soakHours: "5400", doubledMinutes: "10800" },
      errors: [],
    });
  });

  it("renders a Duration Derived Variable through the formatter on every Reader surface", async () => {
    const protocol: Protocol = {
      ...readerProtocol,
      sections: [
        {
          ...readerProtocol.sections[0]!,
          sectionId: "018f7f3e-7b1d-7a91-bf10-8f767a9c0f76",
          title: "Prepare {{ soakHours }}",
          markdown: "Soak **{{ soakHours }}**.\n\n- [ ] Confirm the soak.",
          duration: { kind: "untimed" },
          endAction: "advance",
          completionRequirement: "all-task-items",
        },
        {
          ...readerProtocol.sections[1]!,
          sectionId: "018f7f3e-7b1d-7a91-bf10-8f767a9c0f77",
          title: "Done",
          markdown: "Complete.",
          duration: { kind: "untimed" },
          endAction: "wait",
        },
      ],
      variables: [
        {
          kind: "input",
          id: "soakMinutes",
          label: "Soak",
          valueType: "duration",
          unit: "minute",
        },
        {
          kind: "derived",
          id: "soakHours",
          label: "Soak in hours",
          valueType: "duration",
          unit: "hour",
          formula: "soakMinutes",
          precision: 2,
          roundingMode: "half-even",
        },
      ],
      formulaTestCases: [
        {
          testCaseId: "018f7f3e-7b1d-7a91-bf10-8f767a9c0f78",
          name: "Converts the declared minutes into declared hours",
          inputValues: { soakMinutes: "90" },
          expectedDerivedValues: { soakHours: "5400" },
          precision: 2,
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
    const workspace = await ReaderWorkspace.open({
      html: `<script id="protocol-box-data" type="application/octet-stream">${envelope}</script>`,
      monotonicNow: () => 0,
      wallNow: () => 0,
      scheduler: {
        setTimeout: () => 1,
        clearTimeout: () => undefined,
      },
    });
    workspace.setInputValue("soakMinutes", "90");
    expect(workspace.snapshot()).toMatchObject({
      mode: "ready",
      // The Derived duration Variable Value stays canonical seconds...
      values: { soakMinutes: "5400", soakHours: "5400" },
      errors: [],
    });
    workspace.startPlayback({ persistence: "memory" });
    // ...while `{{ soakHours }}` interpolates the domain formatter output in
    // the Derived Variable's declared unit (5400 s in hours is `1.5 h`).
    expect(workspace.snapshot()).toMatchObject({
      mode: "playing",
      renderedSection: {
        title: "Prepare 1.5 h",
        markdown: "Soak **1.5 h**.\n\n- [ ] Confirm the soak.",
      },
    });

    workspace.setTaskItemChecked(0, true);
    workspace.completeCurrentSection();
    workspace.completeCurrentSection();
    const summary = workspace.completionSummary();
    // Canonical seconds stay in `values` while the presented record renders
    // the Derived Variable's declared unit through the domain formatter.
    expect(summary.values.soakHours).toBe("5400");
    expect(summary.presentedValues.soakHours).toBe("1.5 h");
    expect(summary.text).toContain("soakHours: 1.5 h");
  });

  it("persists and restores a Playback Session with a Duration Input Variable", async () => {
    const protocol: Protocol = {
      ...readerProtocol,
      sections: [
        {
          ...readerProtocol.sections[0]!,
          title: "Soak",
          markdown: "Soak the sample.\n\n- [ ] Confirm the soak.",
          duration: { kind: "untimed" },
          endAction: "advance",
          completionRequirement: "all-task-items",
        },
        {
          ...readerProtocol.sections[1]!,
          markdown: "Wait for the timer.",
        },
      ],
      variables: [
        {
          kind: "input",
          id: "soakMinutes",
          label: "Soak",
          valueType: "duration",
          unit: "minute",
          minimum: "60",
          maximum: "3600",
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
    const stored = new Map<string, string>();
    const sessionStorage = {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
      removeItem: (key: string) => stored.delete(key),
      keys: () => [...stored.keys()],
    };
    const options = {
      html: `<script id="protocol-box-data" type="application/octet-stream">${envelope}</script>`,
      monotonicNow: () => 0,
      wallNow: () => 1_700_000_000_000,
      scheduler: {
        setTimeout: () => 1,
        clearTimeout: () => undefined,
      },
      sessionStorage,
    };

    const first = await ReaderWorkspace.open(options);
    first.setInputValue("soakMinutes", "10");
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
      values: { soakMinutes: "600" },
    });

    // A stored Duration Variable Value is canonical seconds: it must still
    // satisfy the definition's constraints, or the Session quarantines.
    const fingerprint = restored.inspection().protocolFingerprint!;
    const activeKey = `protocol-box:playback:${fingerprint}`;
    const session = JSON.parse(stored.get(activeKey)!) as Record<
      string,
      unknown
    >;
    stored.set(
      activeKey,
      JSON.stringify({
        ...session,
        values: {
          ...(session.values as Record<string, unknown>),
          soakMinutes: "5",
        },
      }),
    );
    const quarantined = await ReaderWorkspace.open(options);
    expect(quarantined.restorePersistentSession()).toBe("quarantined");
    expect(quarantined.snapshot()).toMatchObject({
      mode: "quarantined",
      protocolFingerprint: fingerprint,
    });
  });
});
