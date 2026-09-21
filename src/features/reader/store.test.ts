import { createPinia, setActivePinia } from "pinia";
import { describe, expect, it } from "vitest";
import { ProtocolCore, type Protocol } from "../../domain/protocol";
import { useReaderStore, type ReaderStoreRuntime } from "./store";

const protocol: Protocol = {
  protocolId: "018f7f3e-7b1d-7a91-bf10-8f767a9c0f70",
  title: "Store tracer",
  sections: [
    {
      sectionId: "018f7f3e-7b1d-7a91-bf10-8f767a9c0f71",
      title: "Prepare {{ amount }}",
      markdown: "Prepare **{{ amount }}** units.\n\n- [ ] Confirm the amount.",
      duration: { kind: "untimed" },
      endAction: "wait",
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
  ],
  formulaTestCases: [],
};

function runtime(): {
  runtime: ReaderStoreRuntime;
  visibility: { state: DocumentVisibilityState; listener?: () => void };
} {
  const visibility: {
    state: DocumentVisibilityState;
    listener?: () => void;
  } = { state: "visible" };
  return {
    visibility,
    runtime: {
      monotonicNow: () => 1_000,
      wallNow: () => 1_700_000_000_000,
      scheduler: {
        setTimeout: () => 1,
        clearTimeout: () => undefined,
      },
      document: {
        get visibilityState() {
          return visibility.state;
        },
        addEventListener(_type, listener) {
          visibility.listener = listener;
        },
        removeEventListener(_type, listener) {
          if (visibility.listener === listener) visibility.listener = undefined;
        },
      },
      storageCapability: "available",
      sessionStorage: {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined,
        keys: () => [],
      },
    },
  };
}

describe("Reader Pinia store", () => {
  it("owns preview lifecycle and refreshes its public snapshot", async () => {
    setActivePinia(createPinia());
    const store = useReaderStore();
    const testRuntime = runtime();

    await store.openAuthorPreview(protocol, testRuntime.runtime);

    expect(store.isPreview).toBe(true);
    expect(store.inspection).toMatchObject({
      format: "valid",
      signature: "unverified",
      playable: true,
    });
    expect(store.snapshot).toMatchObject({
      mode: "configuring",
      values: {},
    });

    store.setInputValue("amount", "3");
    expect(store.snapshot).toMatchObject({
      mode: "ready",
      values: { amount: "3" },
    });

    store.startPlayback();
    expect(store.activePlayback).toMatchObject({
      mode: "playing",
      renderedSection: { title: "Prepare 3" },
      checkedTaskItemIndexes: [],
    });
    store.setTaskItemChecked(0, true);
    expect(store.activePlayback?.checkedTaskItemIndexes).toEqual([0]);
    store.setTaskItemChecked(0, false);
    expect(store.activePlayback?.checkedTaskItemIndexes).toEqual([]);

    testRuntime.visibility.state = "hidden";
    testRuntime.visibility.listener?.();
    expect(store.snapshot).toMatchObject({
      mode: "paused",
      reason: "page-hidden",
    });

    store.resumePlayback();
    store.completeCurrentSection();
    expect(store.snapshot).toMatchObject({ mode: "completed" });
    expect(store.completionSummary).toBeUndefined();
  });

  it("owns persistence selection and reset state", async () => {
    setActivePinia(createPinia());
    const store = useReaderStore();
    const testRuntime = runtime();
    await store.openAuthorPreview(protocol, testRuntime.runtime);

    expect(() => store.selectPersistence("persistent")).toThrow(
      expect.objectContaining({ code: "persistent_session_unavailable" }),
    );

    store.setInputValue("amount", "2");
    store.startPlayback();
    store.resetSession();

    expect(store.persistence).toBe("memory");
    expect(store.storageStatus).toBe("cleared");
    expect(store.snapshot).toMatchObject({
      mode: "configuring",
      values: {},
    });
  });

  it("exposes a Completion Summary from the completed store snapshot", async () => {
    setActivePinia(createPinia());
    const store = useReaderStore();
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

    await store.openPublishedProtocol(
      `<script id="protocol-box-data" type="application/octet-stream">${envelope}</script>`,
      runtime().runtime,
    );
    store.setInputValue("amount", "2");
    store.startPlayback();
    store.completeCurrentSection();

    expect(store.snapshot.mode).toBe("completed");
    expect(store.completionSummary).toMatchObject({
      label: "Non-audit personal reference",
      values: { amount: "2" },
      completedSectionIds: [protocol.sections[0]!.sectionId],
    });
  });
});
