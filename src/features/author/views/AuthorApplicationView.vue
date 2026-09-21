<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import { storeToRefs } from "pinia";
import { useRoute, useRouter } from "vue-router";
import {
  isAuthorActionFailure,
  useAuthorStore,
} from "@/features/author/store";
import { ProtocolCore } from "@/domain/protocol";
import ReaderView from "@/features/reader/views/ReaderView.vue";
import AccessibleDialog from "@/components/shared/AccessibleDialog.vue";
import HelpView from "@/features/help/views/HelpView.vue";
import {
  t,
} from "@/locales";
import { useAppShellStore } from "@/stores/app-shell";
import AuthoringWorkspace from "@/features/author/components/AuthoringWorkspace.vue";
import AuthorAccess from "@/features/author/components/AuthorAccess.vue";
import AuthorLockFailure from "@/features/author/components/AuthorLockFailure.vue";
import DraftBrowser from "@/features/author/components/DraftBrowser.vue";
import AuthorCommandBar from "@/features/author/components/AuthorCommandBar.vue";
import AuthorWorkspaceRail from "@/features/author/components/AuthorWorkspaceRail.vue";
import AuthorOperationStatus from "@/features/author/components/AuthorOperationStatus.vue";
import PublishWorkspace from "@/features/author/components/PublishWorkspace.vue";
import { authoringDirty, clearAuthoringEditPending, hasAuthoringEditPending, savedAuthoringCanonical as savedCanonical } from "@/features/author/components/authoring-session-state";


const router = useRouter();
const route = useRoute();
const appShell = useAppShellStore();
appShell.inspectDocument(document.documentElement.outerHTML);
const {
  readerMode,
  originalPublishedProtocolHtml: publishedProtocolHtml,
  pendingForkIntent: pendingForkAction,
  editableForkDraftId,
} = storeToRefs(appShell);
const returnToReaderRequested = ref(false);
const navigationOpen = ref(true);
const hasReturnedToReader = ref(false);
let helpOpener: HTMLElement | undefined;
let helpOpenerTopic: string | undefined;
let previewOpener: HTMLElement | undefined;

const author = useAuthorStore();
const {
  snapshot,
  editing,
  capabilities,
  newKeyRecoveryReminderKeyId,
} = storeToRefs(author);
type AuthorView = "drafts" | "authoring" | "publish";
interface ProtectedDraftIntent {
  route: string;
  draftId: string;
  keyId: string;
}
const activeAuthorView = ref<AuthorView>("drafts");
const protectedDraftIntent = ref<ProtectedDraftIntent>();
const leaveDraftRequested = ref(false);
const authorPreviewRequested = ref(false);
const contextualHelpEntry = computed(() => route.query.from === "author");
const isHelpRoute = computed(() => route.path.startsWith("/help"));
const isReaderRoute = computed(() => route.name === "reader");
const isReaderHelpRoute = computed(
  () => isHelpRoute.value && route.query.from === "reader",
);

const hasUnsavedChanges = computed(() => {
  if (!editing.value) return false;
  return authoringDirty.value || (
    savedCanonical.value === undefined ||
    ProtocolCore.canonicalizeProtocol(editing.value.protocol) !==
      savedCanonical.value
  );
});
const editableForkAvailable = computed(
  () => editableForkDraftId.value !== undefined,
);
const sourceProvenance = computed(() => editing.value?.source);
const requiredAuthorKeyId = computed(() => protectedDraftIntent.value?.keyId);
const unlockedAuthorKeyId = computed(() =>
  snapshot.value.mode === "locked" ? undefined : snapshot.value.keyId,
);
const showingNewKeyReminder = computed(
  () =>
    route.name === "author-access" &&
    unlockedAuthorKeyId.value !== undefined &&
    unlockedAuthorKeyId.value === newKeyRecoveryReminderKeyId.value,
);
const showAuthorAccess = computed(
  () => snapshot.value.mode === "locked" || showingNewKeyReminder.value,
);
const shortSourceFingerprint = computed(
  () => sourceProvenance.value?.fingerprint.slice(0, 16) ?? "",
);
const bodyHeadingWarningCount = computed(
  () =>
    editing.value?.protocol.sections.filter((candidate) =>
      /^(?:#|##)\s+\S/m.test(candidate.markdown),
    ).length ?? 0,
);
function handleDraftOpened(canonical?: string): void {
  if (canonical === undefined) {
    savedCanonical.value = undefined;
    return;
  }
  void nextTick(() => {
    savedCanonical.value = editing.value
      ? ProtocolCore.canonicalizeProtocol(editing.value.protocol)
      : undefined;
  });
}

function handleAuthorLock(): void {
  savedCanonical.value = undefined;
  appShell.setCrossShellRouteIntent(undefined);
}

function openHelp(topic?: string): void {
  helpOpener =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : undefined;
  helpOpenerTopic = topic;
  appShell.setCrossShellRouteIntent(route.fullPath);
  void router.push({
    path: topic === undefined ? "/help" : `/help/${topic}`,
    query: { from: "author" },
  });
}

function closeHelp(): void {
  const destination = appShell.crossShellRouteIntent ?? "/author/access";
  appShell.setCrossShellRouteIntent(undefined);
  void router.push(destination).then(() => {
    void nextTick(() => {
      const opener = helpOpenerTopic
        ? document.querySelector<HTMLElement>(
            `[data-help-topic="${CSS.escape(helpOpenerTopic)}"]`,
          )
        : undefined;
      (opener ?? (helpOpener?.isConnected ? helpOpener : undefined))?.focus();
      helpOpenerTopic = undefined;
    });
  });
}

function navigateAuthorView(view: AuthorView): void {
  if (view === "drafts" && editing.value) {
    if (hasUnsavedChanges.value) {
      leaveDraftRequested.value = true;
      return;
    }
    author.closeDraft();
  }
  if (view !== "drafts" && !editing.value) {
    author.setStatus("Open an Unsigned Draft to continue");
    return;
  }
  if (view === "drafts") {
    if (route.name === "author-drafts") return;
    void router.push({ name: "author-drafts" });
    return;
  }
  if (!editing.value) return;
  const destination =
    view === "authoring" ? "author-authoring" : "author-publish";
  if (
    route.name === destination &&
    draftIdFromRoute() === editing.value.draftId
  ) {
    return;
  }
  void router.push({
    name: destination,
    params: { draftId: editing.value.draftId },
  });
}

function discardAndShowDrafts(): void {
  leaveDraftRequested.value = false;
  author.closeDraft();
  savedCanonical.value = undefined;
  void router.push({ name: "author-drafts" });
  author.setStatus("Unsigned Draft closed without saving changes");
}

function returnToDraftAfterSaveFailure(): void {
  if (!editing.value) return;
  void router.replace({
    name: "author-authoring",
    params: { draftId: editing.value.draftId },
  });
}

function completeRetriedLock(): void {
  void router.replace({ name: "author-access" });
}

function requestAuthorPreview(): void {
  if (!editing.value) return;
  previewOpener =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : undefined;
  authorPreviewRequested.value = true;
}

function exitAuthorPreview(): void {
  authorPreviewRequested.value = false;
  void nextTick(() => previewOpener?.focus());
}

function handleGlobalShortcut(event: KeyboardEvent): void {
  const target = event.target;
  const isTextEntry =
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable);
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    if (editing.value) void save();
    return;
  }
  if (
    (event.ctrlKey || event.metaKey) &&
    event.shiftKey &&
    event.key === "Enter"
  ) {
    event.preventDefault();
    requestAuthorPreview();
    return;
  }
  if (isTextEntry || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.key === "?") {
    event.preventDefault();
    openHelp("keyboard");
  }
}

let authorListenersAttached = false;

async function initializeAuthorWorkspace(): Promise<void> {
  const opened = await author.openWorkspace();
  if (!opened || authorListenersAttached) return;
  window.addEventListener("pointerdown", recordActivity);
  window.addEventListener("keydown", recordActivity);
  window.addEventListener("keydown", handleGlobalShortcut);
  window.addEventListener("pagehide", closeWorkspace);
    authorListenersAttached = true;
}

function draftIdFromRoute(): string | undefined {
  const value = route.params.draftId;
  return typeof value === "string" ? value : undefined;
}

async function synchronizeRoute(): Promise<void> {
  if (route.name === "bootstrap") {
    await router.replace({ name: readerMode.value ? "reader" : "author-access" });
    return;
  }
  if (isHelpRoute.value || isReaderRoute.value) return;
  if (route.name === "author-access") return;

  const draftId = draftIdFromRoute();
  if (!capabilities.value.workspaceOpen) {
    await initializeAuthorWorkspace();
  }
  if (!capabilities.value.available) {
    await router.replace({ name: "author-access" });
    return;
  }
  if (snapshot.value.mode === "locked") {
    if (draftId === undefined) {
      await router.replace({ name: "author-access" });
      return;
    }
    try {
      const identified = await author.identifyDraft(draftId);
      protectedDraftIntent.value = {
        route: route.fullPath,
        draftId: identified.draftId,
        keyId: identified.keyId,
      };
      appShell.setCrossShellRouteIntent(route.fullPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      protectedDraftIntent.value = undefined;
      author.setStatus(t("author.recovery.missingDraft", { message }));
    }
    await router.replace({ name: "author-access" });
    return;
  }
  if (draftId === undefined) {
    if (editing.value !== undefined && hasUnsavedChanges.value) {
      leaveDraftRequested.value = true;
      await router.replace({
        name: "author-authoring",
        params: { draftId: editing.value.draftId },
      });
      return;
    }
    activeAuthorView.value = "drafts";
    return;
  }
  if (editing.value?.draftId !== draftId) {
    await restoreDraftForRoute(draftId);
  }
  activeAuthorView.value =
    route.name === "author-publish" ? "publish" : "authoring";
}

async function restoreDraftForRoute(draftId: string): Promise<void> {
  try {
    await author.restoreDraft(draftId);
    savedCanonical.value = editing.value
      ? ProtocolCore.canonicalizeProtocol(editing.value.protocol)
      : undefined;
    await refreshRecoverySnapshots();
    author.setStatus("Unsigned Draft restored");
  } catch (error) {
    await refreshDrafts();
    author.setStatus(error instanceof Error ? error.message : "Unsigned Draft restore failed");
    await router.replace({ name: "author-drafts" });
  }
}

function preventUnsavedDraftUnload(event: BeforeUnloadEvent): void {
  event.preventDefault();
  event.returnValue = "";
}

watch(hasUnsavedChanges, (dirty) => {
  window[dirty ? "addEventListener" : "removeEventListener"](
    "beforeunload",
    preventUnsavedDraftUnload,
  );
});

watch(showingNewKeyReminder, (showing, wasShowing) => {
  if (
    !showing &&
    wasShowing &&
    route.name === "author-access" &&
    snapshot.value.mode !== "locked"
  ) {
    void router.replace({ name: "author-drafts" });
  }
});

watch(
  () => route.fullPath,
  () => {
    void synchronizeRoute();
  },
  { immediate: true },
);

onMounted(async () => {
  if (!readerMode.value) await initializeAuthorWorkspace();
  await synchronizeRoute();
});

onBeforeUnmount(() => {
  if (authorListenersAttached) {
    window.removeEventListener("pointerdown", recordActivity);
    window.removeEventListener("keydown", recordActivity);
    window.removeEventListener("keydown", handleGlobalShortcut);
    window.removeEventListener("pagehide", closeWorkspace);
  }
  window.removeEventListener("beforeunload", preventUnsavedDraftUnload);
  closeWorkspace();
});

function closeWorkspace(): void {
  void author.closeWorkspace();
}

function recordActivity(): void {
  author.recordActivity();
}

async function handleAuthorAccessReady(): Promise<void> {
  const protectedIntent = protectedDraftIntent.value;
  if (protectedIntent !== undefined) {
    if (unlockedAuthorKeyId.value !== protectedIntent.keyId) {
      author.setStatus(t("author.recovery.keyMismatch"));
      return;
    }
    try {
      await author.restoreDraft(protectedIntent.draftId);
      savedCanonical.value = editing.value
        ? ProtocolCore.canonicalizeProtocol(editing.value.protocol)
        : undefined;
      await refreshRecoverySnapshots();
      protectedDraftIntent.value = undefined;
      appShell.setCrossShellRouteIntent(undefined);
      await router.replace(protectedIntent.route);
      author.setStatus("Unsigned Draft restored");
    } catch (error) {
      author.setStatus(
        error instanceof Error ? error.message : "Unsigned Draft restore failed",
      );
    }
    return;
  }
  if (pendingForkAction.value === undefined && appShell.crossShellRouteIntent === undefined) {
    await router.replace({ name: "author-drafts" });
    return;
  }
  await completePendingForkAction();
  await resumeProtectedRouteIntent();
}

async function requestEditableFork(action: "create" | "return"): Promise<void> {
  appShell.requestFork(action);
  await initializeAuthorWorkspace();
  await router.push({ name: "author-access" });
  if (!capabilities.value.available || snapshot.value.mode === "locked") return;
  await completePendingForkAction();
}

async function completePendingForkAction(): Promise<void> {
  const action = pendingForkAction.value;
  if (
    action === undefined ||
    publishedProtocolHtml.value === undefined ||
    snapshot.value.mode === "locked"
  ) {
    return;
  }

  try {
    if (action === "create") {
      hasReturnedToReader.value = false;
      if (editing.value !== undefined) author.closeDraft();
      const { draftId } = await author.importPublishedProtocol(
        publishedProtocolHtml.value,
        { fork: true },
      );
        appShell.setEditableForkDraft(draftId);
      savedCanonical.value = undefined;
      await router.push({
        name: "author-authoring",
        params: { draftId },
      });
      author.setStatus("Published Protocol Forked as an Unsigned Draft");
    } else {
      const draftId = editableForkDraftId.value;
      if (draftId === undefined) return;
      if (editing.value?.draftId !== draftId) {
        if (editing.value !== undefined) author.closeDraft();
        await author.restoreDraft(draftId);
            savedCanonical.value = editing.value
          ? ProtocolCore.canonicalizeProtocol(editing.value.protocol)
          : undefined;
      }
      await router.push({
        name: "author-authoring",
        params: { draftId },
      });
    }
    appShell.clearForkIntent();
  } catch (error) {
    author.setStatus(error instanceof Error ? error.message : "Editable Fork failed");
  }
}

async function resumeProtectedRouteIntent(): Promise<void> {
  const destination = appShell.crossShellRouteIntent;
  if (pendingForkAction.value !== undefined) return;
  if (destination === undefined) {
    if (route.name === "author-access") {
      await router.replace({ name: "author-drafts" });
    }
    return;
  }
  appShell.setCrossShellRouteIntent(undefined);
  await router.push(destination);
}

function cancelPendingFork(): void {
  appShell.clearForkIntent();
  void router.push({ name: "reader" });
}

async function finishReturnToPublishedProtocol(): Promise<void> {
  returnToReaderRequested.value = false;
  appShell.clearForkIntent();
  try {
    await author.lock();
    await router.push({ name: "reader" });
    hasReturnedToReader.value = true;
  } catch (error) {
    author.setStatus(error instanceof Error
        ? `Return failed: ${error.message}`
        : "Return to Published Protocol failed");
  }
}

function requestReturnToPublishedProtocol(): void {
  if (!hasReturnedToReader.value || hasUnsavedChanges.value || hasAuthoringEditPending()) {
    returnToReaderRequested.value = true;
    return;
  }
  void finishReturnToPublishedProtocol();
}

async function saveAndReturnToPublishedProtocol(): Promise<void> {
  if (await save()) await finishReturnToPublishedProtocol();
}

async function discardAndReturnToPublishedProtocol(): Promise<void> {
  const persisted = savedCanonical.value !== undefined;
  if (editing.value !== undefined) author.closeDraft();
  if (!persisted) appShell.setEditableForkDraft(undefined);
  savedCanonical.value = undefined;
  await finishReturnToPublishedProtocol();
}

function handlePublicationFailure(error: Error): void {
  if (isAuthorActionFailure(error) && error.code === "partial_publication" && error.details !== undefined) {
    author.setStatus(`${error.message}: ${error.details.fileName} (${error.details.wholeFileSha256})`);
    return;
  }
  author.setStatus(error.message);
}

async function refreshDrafts(): Promise<void> {
  await author.refreshDrafts();
}

async function refreshRecoverySnapshots(): Promise<void> {
  await author.refreshRecoverySnapshots();
}



async function save(): Promise<boolean> {
  if (!author || !editing.value) return false;
  try {
    await author.saveDraft();
    await refreshDrafts();
    await refreshRecoverySnapshots();
    savedCanonical.value = editing.value
      ? ProtocolCore.canonicalizeProtocol(editing.value.protocol)
      : undefined;
    authoringDirty.value = false;
    clearAuthoringEditPending();
    author.setStatus("Unsigned Draft saved");
    return true;
  } catch (error) {
    author.setStatus(error instanceof Error ? error.message : "Save failed");
    return false;
  }
}



</script>

<template>
  <ReaderView
    v-if="readerMode && (isReaderRoute || isReaderHelpRoute)"
    v-show="isReaderRoute"
    :editable-fork-available="editableForkAvailable"
    @request-editable-fork="requestEditableFork"
  />
  <ReaderView
    v-if="authorPreviewRequested && editing"
    :preview-protocol="editing.protocol"
    @exit-preview="exitAuthorPreview"
  />
  <HelpView
    v-if="isHelpRoute"
    :mode="isReaderHelpRoute ? 'reader' : 'author'"
    :contextual-entry="contextualHelpEntry || isReaderHelpRoute"
    @close="closeHelp"
  />
  <main
    v-if="
      !isHelpRoute &&
      !(readerMode && (isReaderRoute || isReaderHelpRoute)) &&
      !authorPreviewRequested
    "
    class="author-app grid h-dvh w-full grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-background"
  >
    <AuthorCommandBar
      :reader-mode="readerMode"
      :navigation-open="navigationOpen"
      @toggle-navigation="navigationOpen = !navigationOpen"
      @return-to-reader="requestReturnToPublishedProtocol"
      @help="openHelp"
      @preview="requestAuthorPreview"
      @locked="handleAuthorLock"
    />
    <div
      class="author-layout grid min-h-0"
      :data-navigation="navigationOpen ? 'open' : 'closed'"
    >
      <AuthorWorkspaceRail
        v-if="navigationOpen"
        :active-view="activeAuthorView"
        @navigate="navigateAuthorView"
        @help="openHelp"
      />

      <div
        class="author-surface min-h-0 min-w-0"
        :class="activeAuthorView === 'authoring' ? 'overflow-hidden' : 'overflow-auto'"
      >
    <aside
      v-if="
        sourceProvenance &&
        (activeAuthorView === 'authoring' || activeAuthorView === 'publish')
      "
      class="mx-auto mt-4 flex w-[min(76rem,calc(100%-2rem))] items-start gap-3 rounded-[var(--radius)] border border-[color-mix(in_oklab,var(--primary)_45%,var(--border))] bg-[color-mix(in_oklab,var(--primary)_7%,var(--card))] px-4 py-[.8rem]"
      role="note"
    >
      <GitFork aria-hidden="true" />
      <div>
        <strong>
          {{ t("author.fork.from", { fingerprint: shortSourceFingerprint }) }}
        </strong>
        <details>
          <summary>{{ t("author.fork.sourceDetails") }}</summary>
          <dl>
            <dt>{{ t("reader.integrity.fingerprint") }}</dt>
            <dd class="mono">{{ sourceProvenance.fingerprint }}</dd>
            <dt>{{ t("reader.integrity.authorKeyId") }}</dt>
            <dd class="mono">{{ sourceProvenance.keyId }}</dd>
          </dl>
        </details>
      </div>
    </aside>
    <AuthorLockFailure
      v-if="snapshot.mode === 'save-failed'"
      @return-to-draft="returnToDraftAfterSaveFailure"
      @locked="completeRetriedLock"
    />
    <AuthorAccess
      v-else-if="showAuthorAccess"
      :pending-fork-action="pendingForkAction"
      :required-key-id="requiredAuthorKeyId"
      :show-new-key-reminder="showingNewKeyReminder"
      @help="openHelp"
      @ready="handleAuthorAccessReady"
      @cancel-fork="cancelPendingFork"
    />
    <DraftBrowser
      v-else-if="snapshot.mode === 'unlocked' && activeAuthorView === 'drafts'"
      @help="openHelp"
      @draft-opened="handleDraftOpened"
    />
    <AuthoringWorkspace
      v-else-if="activeAuthorView === 'authoring'"
      @help="openHelp"
    />
    <PublishWorkspace
      v-else-if="activeAuthorView === 'publish'"
      :has-unsaved-changes="hasUnsavedChanges"
      @help="openHelp"
      @preview="requestAuthorPreview"
      @publication-failure="handlePublicationFailure"
    />
      </div>
    </div>
    <AuthorOperationStatus
      :has-unsaved-changes="hasUnsavedChanges"
      :body-heading-warning-count="bodyHeadingWarningCount"
    />
    <AccessibleDialog
      v-if="leaveDraftRequested"
      id="leave-draft-dialog"
      title="Discard unsaved changes?"
      confirm-label="Discard and Close"
      @confirm="discardAndShowDrafts"
      @cancel="leaveDraftRequested = false"
    >
      <p>Changes since the last Save Unsigned Draft will be lost.</p>
    </AccessibleDialog>
    <AccessibleDialog
      v-if="returnToReaderRequested"
      id="return-to-reader-dialog"
      :title="t('author.fork.returnTitle')"
      :confirm-label="t('author.fork.saveReturn')"
      :secondary-label="t('author.fork.discardReturn')"
      :cancel-label="t('common.cancel')"
      @confirm="saveAndReturnToPublishedProtocol"
      @secondary="discardAndReturnToPublishedProtocol"
      @cancel="returnToReaderRequested = false"
    >
      <p>{{ t("author.fork.returnBody") }}</p>
    </AccessibleDialog>
  </main>
</template>

<style src="../components/author-ui.css"></style>
