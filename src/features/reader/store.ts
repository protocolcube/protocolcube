import { computed, readonly, ref, shallowRef } from "vue";
import { defineStore } from "pinia";
import type {
  Protocol,
  VariableValue,
} from "@/domain/protocol";
import {
  ReaderWorkspace,
  ReaderWorkspaceFailure,
  type CompletionSummary,
  type ReaderInspection,
  type ReaderScheduler,
  type ReaderSessionStorage,
  type ReaderSnapshot,
} from "./workspace";

type Persistence = "memory" | "persistent";
type StorageCapability = "available" | "unavailable" | "not-applicable";
type StorageStatus = "idle" | "restored" | "quarantined" | "cleared";
type VisibilityState = "hidden" | "visible";
type TimerOutcome = "waiting" | "paused" | "advanced" | "completed";

interface ReaderLifecycleDocument {
  visibilityState: DocumentVisibilityState;
  addEventListener(
    type: "visibilitychange",
    listener: () => void,
  ): void;
  removeEventListener(
    type: "visibilitychange",
    listener: () => void,
  ): void;
}

export interface ReaderStoreRuntime {
  monotonicNow: () => number;
  wallNow: () => number;
  scheduler: ReaderScheduler;
  document?: ReaderLifecycleDocument;
  sessionStorage?: ReaderSessionStorage;
  storageCapability: Exclude<StorageCapability, "not-applicable">;
}

export interface ReaderOpenResult {
  restored: "none" | "restored" | "quarantined";
}

function createBrowserSessionStorage(): {
  sessionStorage?: ReaderSessionStorage;
  storageCapability: Exclude<StorageCapability, "not-applicable">;
} {
  const probeKey = "protocol-box:playback-storage-probe";
  try {
    localStorage.setItem(probeKey, "1");
    localStorage.removeItem(probeKey);
    void localStorage.length;
  } catch {
    return { storageCapability: "unavailable" };
  }

  return {
    storageCapability: "available",
    sessionStorage: {
      getItem: (key) => localStorage.getItem(key),
      setItem: (key, value) => localStorage.setItem(key, value),
      removeItem: (key) => localStorage.removeItem(key),
      keys: () =>
        Array.from({ length: localStorage.length }, (_, index) =>
          localStorage.key(index),
        ).filter((key): key is string => key !== null),
    },
  };
}

function createBrowserRuntime(): ReaderStoreRuntime {
  const storage = createBrowserSessionStorage();
  return {
    monotonicNow: () => performance.now(),
    wallNow: () => Date.now(),
    scheduler: {
      setTimeout(callback, delay) {
        return window.setTimeout(() => {
          void callback();
        }, delay);
      },
      clearTimeout(handle) {
        window.clearTimeout(handle as number);
      },
    },
    document,
    ...storage,
  };
}

export const useReaderStore = defineStore("reader", () => {
  let workspace: ReaderWorkspace | undefined;
  let lifecycleDocument: ReaderLifecycleDocument | undefined;
  let lifecycleHandler: (() => void) | undefined;

  const inspection = shallowRef<ReaderInspection>({
    format: "invalid",
    signature: "unverified",
    playable: false,
    errors: [],
  });
  const snapshot = shallowRef<ReaderSnapshot>({ mode: "invalid", errors: [] });
  const protocol = shallowRef<Protocol>();
  const isPreview = ref(false);
  const persistence = ref<Persistence>("memory");
  const storageCapability = ref<StorageCapability>("unavailable");
  const storageStatus = ref<StorageStatus>("idle");
  const completionSummary = shallowRef<CompletionSummary>();
  const timerOutcome = shallowRef<
    { sequence: number; value: TimerOutcome } | undefined
  >();

  const activePlayback = computed(() =>
    snapshot.value.mode === "playing" ||
    snapshot.value.mode === "paused" ||
    snapshot.value.mode === "waiting"
      ? snapshot.value
      : undefined,
  );
  const playbackRemaining = computed(() => {
    const playback = activePlayback.value;
    return playback !== undefined && "remainingMilliseconds" in playback
      ? playback.remainingMilliseconds
      : undefined;
  });
  const hasPlaybackSession = computed(
    () =>
      snapshot.value.mode === "playing" ||
      snapshot.value.mode === "paused" ||
      snapshot.value.mode === "waiting" ||
      snapshot.value.mode === "completed" ||
      snapshot.value.mode === "quarantined",
  );

  function requireWorkspace(): ReaderWorkspace {
    if (workspace === undefined) {
      throw new ReaderWorkspaceFailure(
        "reader_not_open",
        "reader",
        "Open a Published Protocol or Author Preview before using Reader actions",
      );
    }
    return workspace;
  }

  function syncSnapshot(): void {
    const currentWorkspace = requireWorkspace();
    snapshot.value = currentWorkspace.snapshot();
    protocol.value = currentWorkspace.readProtocol();
    completionSummary.value =
      snapshot.value.mode === "completed" && !isPreview.value
        ? currentWorkspace.completionSummary()
        : undefined;
  }

  function schedulerWithSnapshotRefresh(scheduler: ReaderScheduler): ReaderScheduler {
    return {
      setTimeout(callback, delay) {
        return scheduler.setTimeout(async () => {
          const previous = snapshot.value;
          await callback();
          syncSnapshot();
          const playback = activePlayback.value;
          const outcome =
            snapshot.value.mode === "waiting"
              ? "waiting"
              : snapshot.value.mode === "paused"
                ? "paused"
                : snapshot.value.mode === "completed"
                  ? "completed"
                  : previous.mode === "playing" &&
                      playback !== undefined &&
                      previous.currentSectionIndex !== playback.currentSectionIndex
                    ? "advanced"
                    : undefined;
          if (outcome !== undefined) {
            timerOutcome.value = {
              sequence: (timerOutcome.value?.sequence ?? 0) + 1,
              value: outcome,
            };
          }
        }, delay);
      },
      clearTimeout: scheduler.clearTimeout,
    };
  }

  function detachLifecycle(): void {
    if (lifecycleDocument !== undefined && lifecycleHandler !== undefined) {
      lifecycleDocument.removeEventListener("visibilitychange", lifecycleHandler);
    }
    lifecycleDocument = undefined;
    lifecycleHandler = undefined;
  }

  function attachLifecycle(document: ReaderLifecycleDocument | undefined): void {
    detachLifecycle();
    if (document === undefined) return;
    lifecycleDocument = document;
    lifecycleHandler = () => {
      handleVisibilityChange(
        document.visibilityState === "hidden" ? "hidden" : "visible",
      );
    };
    document.addEventListener("visibilitychange", lifecycleHandler);
  }

  async function openPublishedProtocol(
    html: string,
    runtime = createBrowserRuntime(),
  ): Promise<ReaderOpenResult> {
    detachLifecycle();
    workspace = await ReaderWorkspace.open({
      html,
      monotonicNow: runtime.monotonicNow,
      wallNow: runtime.wallNow,
      scheduler: schedulerWithSnapshotRefresh(runtime.scheduler),
      sessionStorage: runtime.sessionStorage,
    });
    isPreview.value = false;
    persistence.value = "memory";
    storageCapability.value = runtime.storageCapability;
    storageStatus.value = "idle";
    timerOutcome.value = undefined;
    inspection.value = workspace.inspection();
    const restored = restorePersistentSession();
    attachLifecycle(runtime.document);
    return { restored };
  }

  async function openAuthorPreview(
    previewProtocol: Protocol,
    runtime = createBrowserRuntime(),
  ): Promise<ReaderOpenResult> {
    detachLifecycle();
    workspace = await ReaderWorkspace.openAuthorPreview({
      protocol: previewProtocol,
      monotonicNow: runtime.monotonicNow,
      wallNow: runtime.wallNow,
      scheduler: schedulerWithSnapshotRefresh(runtime.scheduler),
    });
    isPreview.value = true;
    persistence.value = "memory";
    storageCapability.value = "not-applicable";
    storageStatus.value = "idle";
    timerOutcome.value = undefined;
    inspection.value = workspace.inspection();
    syncSnapshot();
    attachLifecycle(runtime.document);
    return { restored: "none" };
  }

  function refresh(): void {
    syncSnapshot();
  }

  function restorePersistentSession(): "none" | "restored" | "quarantined" {
    const restored = requireWorkspace().restorePersistentSession();
    if (restored === "restored") {
      persistence.value = "persistent";
      storageStatus.value = "restored";
    } else if (restored === "quarantined") {
      storageStatus.value = "quarantined";
    }
    syncSnapshot();
    return restored;
  }

  function selectPersistence(value: Persistence): void {
    if (value === "persistent" && storageCapability.value !== "available") {
      throw new ReaderWorkspaceFailure(
        "persistent_session_unavailable",
        "persistence",
        "Persistent Playback Sessions are unavailable",
      );
    }
    persistence.value = value;
  }

  function setInputValue(id: string, value: VariableValue): void {
    requireWorkspace().setInputValue(id, value);
    syncSnapshot();
  }

  function startPlayback(input: { sensitiveDataConfirmed?: boolean } = {}): void {
    requireWorkspace().startPlayback({
      persistence: isPreview.value ? "memory" : persistence.value,
      sensitiveDataConfirmed: input.sensitiveDataConfirmed,
    });
    syncSnapshot();
  }

  function completeCurrentSection(): void {
    requireWorkspace().completeCurrentSection();
    syncSnapshot();
  }

  function setTaskItemChecked(index: number, checked: boolean): void {
    requireWorkspace().setTaskItemChecked(index, checked);
    syncSnapshot();
  }

  function acknowledgeSection(): void {
    requireWorkspace().acknowledgeSection();
    syncSnapshot();
  }

  function resumePlayback(): void {
    requireWorkspace().resumePlayback({ confirmed: true });
    syncSnapshot();
  }

  function jumpToSection(sectionIndex: number): void {
    requireWorkspace().jumpToSection({ sectionIndex, confirmed: true });
    syncSnapshot();
  }

  function handleVisibilityChange(state: VisibilityState): void {
    requireWorkspace().handleVisibilityChange(state);
    syncSnapshot();
  }

  function resetSession(): void {
    requireWorkspace().clearSession({ confirmed: true });
    persistence.value = "memory";
    storageStatus.value = "cleared";
    syncSnapshot();
  }

  function dispose(): void {
    detachLifecycle();
    workspace = undefined;
    inspection.value = {
      format: "invalid",
      signature: "unverified",
      playable: false,
      errors: [],
    };
    snapshot.value = { mode: "invalid", errors: [] };
    protocol.value = undefined;
    completionSummary.value = undefined;
    persistence.value = "memory";
    storageStatus.value = "idle";
    timerOutcome.value = undefined;
  }

  return {
    inspection: readonly(inspection),
    snapshot: readonly(snapshot),
    protocol: readonly(protocol),
    isPreview: readonly(isPreview),
    persistence: readonly(persistence),
    storageCapability: readonly(storageCapability),
    storageStatus: readonly(storageStatus),
    completionSummary: readonly(completionSummary),
    timerOutcome: readonly(timerOutcome),
    activePlayback,
    playbackRemaining,
    hasPlaybackSession,
    openPublishedProtocol,
    openAuthorPreview,
    refresh,
    restorePersistentSession,
    selectPersistence,
    setInputValue,
    startPlayback,
    completeCurrentSection,
    setTaskItemChecked,
    acknowledgeSection,
    resumePlayback,
    jumpToSection,
    handleVisibilityChange,
    resetSession,
    dispose,
  };
});

export function isReaderActionFailure(error: unknown): error is Error {
  return error instanceof ReaderWorkspaceFailure;
}

export type {
  CompletionSummary,
  ReaderInspection,
  ReaderSnapshot,
} from "./workspace";
