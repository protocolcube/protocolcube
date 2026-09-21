<script setup lang="ts">
import { EditorContent, useEditor } from "@tiptap/vue-3";
import { Markdown } from "@tiptap/markdown";
import { computed, nextTick, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useReaderStore, isReaderActionFailure, type ReaderSnapshot } from "@/features/reader/store";
import type { ProtocolError, Section, VariableValue } from "@/domain/protocol";
import AccessibleDialog from "@/components/shared/AccessibleDialog.vue";
import { Button } from "@/components/ui/button";
import { t, type TranslationKey, type TranslationParams } from "@/locales";
import { createProtocolContentExtensions } from "@/shared/protocol-markdown";

type PauseReason = Extract<ReaderSnapshot, { mode: "paused" }>["reason"];
const emit = defineEmits<{ status: [key: TranslationKey, params?: TranslationParams] }>();
const readerStore = useReaderStore();
const { activePlayback, isPreview, playbackRemaining, protocol, snapshot } = storeToRefs(readerStore);
const clearSessionRequested = ref(false);
const pendingSectionIndex = ref<number>();
const externalLinkHref = ref<string>();
const sectionProse = ref<HTMLElement>();
const taskItemIndexes = new WeakMap<object, number>();
const checkedTaskItemCount = computed(
  () => activePlayback.value?.checkedTaskItemIndexes.length ?? 0,
);
function onReadOnlyTaskChecked(
  checkedNode: { textContent: string },
  checked: boolean,
): boolean {
  const checkedIndex = taskItemIndexes.get(checkedNode);
  if (checkedIndex === undefined) return false;
  try {
    readerStore.setTaskItemChecked(checkedIndex, checked);
    return true;
  } catch (error) {
    reportFailure(error, "reader.status.actionFailed");
    return false;
  }
}
const readerEditor = useEditor({
  extensions: [
    ...createProtocolContentExtensions({ onReadOnlyTaskChecked }),
    Markdown,
  ],
  content: "",
  contentType: "markdown",
  editable: false,
});
function synchronizeRenderedSection(): void {
  const playback = activePlayback.value;
  const currentEditor = readerEditor.value;
  if (playback === undefined || currentEditor === undefined) return;
  currentEditor.commands.setContent(playback.renderedSection.markdown, {
    contentType: "markdown",
    emitUpdate: false,
  });
  let mappedTaskItemIndex = 0;
  currentEditor.state.doc.descendants((node) => {
    if (node.type.name !== "taskItem") return;
    taskItemIndexes.set(node, mappedTaskItemIndex);
    mappedTaskItemIndex += 1;
  });
  const checkedIndexes = new Set(playback.checkedTaskItemIndexes);
  currentEditor.commands.command(({ state, tr }) => {
    let taskItemIndex = 0;
    state.doc.descendants((node, position) => {
      if (node.type.name !== "taskItem") return;
      const checked = checkedIndexes.has(taskItemIndex);
      taskItemIndex += 1;
      if (node.attrs.checked === checked) return;
      tr.setNodeMarkup(position, undefined, { ...node.attrs, checked });
    });
    return true;
  });
  void nextTick(() => {
    const currentPlayback = activePlayback.value;
    if (currentPlayback === undefined) return;
    for (const checkbox of sectionProse.value?.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"]',
    ) ?? []) {
      checkbox.disabled = currentPlayback.sectionCompleted;
    }
  });
}
watch(activePlayback, synchronizeRenderedSection, {
  deep: true,
  flush: "post",
});
watch(readerEditor, synchronizeRenderedSection, { flush: "post" });
function reportFailure(error: unknown, key: TranslationKey): void { if (isReaderActionFailure(error)) { emit("status", key); return; } throw error; }
function inputValue(id: string): VariableValue | undefined { return "values" in snapshot.value ? snapshot.value.values[id] : undefined; }
function formatMilliseconds(milliseconds: number): string { const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1_000)); const hours = Math.floor(totalSeconds / 3_600); const minutes = Math.floor((totalSeconds % 3_600) / 60); const seconds = totalSeconds % 60; return hours > 0 ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}` : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`; }
function formatSeconds(seconds: string): string { return formatMilliseconds(Number(seconds) * 1_000); }
function sectionDuration(section: Section): string { if (section.duration.kind === "untimed") return t("reader.playback.untimed"); if (section.duration.kind === "fixed") return t("reader.playback.fixedTimer", { duration: formatSeconds(section.duration.seconds) }); const value = inputValue(section.duration.variableId); return typeof value === "string" ? t("reader.playback.fixedTimer", { duration: formatSeconds(value) }) : t("reader.playback.derivedTimer"); }
function pauseReason(reason: PauseReason): string { return t(`reader.playback.pause.${reason}` as TranslationKey); }
function isCurrentSection(index: number): boolean { return activePlayback.value?.currentSectionIndex === index; }
function completeSection(): void { try { readerStore.completeCurrentSection(); emit("status", activePlayback.value === undefined ? "reader.status.sectionComplete" : "reader.status.advanced", activePlayback.value === undefined ? undefined : { title: activePlayback.value.renderedSection.title }); } catch (error) { reportFailure(error, "reader.status.actionFailed"); } }
function acknowledgeSection(): void { try { readerStore.acknowledgeSection(); emit("status", activePlayback.value === undefined ? "reader.status.sectionComplete" : "reader.status.advanced", activePlayback.value === undefined ? undefined : { title: activePlayback.value.renderedSection.title }); } catch (error) { reportFailure(error, "reader.status.actionFailed"); } }
function resumePlayback(): void { try { readerStore.resumePlayback(); emit("status", "reader.status.resumed"); } catch (error) { reportFailure(error, "reader.status.actionFailed"); } }
function confirmSectionJump(): void { if (pendingSectionIndex.value === undefined) return; try { readerStore.jumpToSection(pendingSectionIndex.value); pendingSectionIndex.value = undefined; if (activePlayback.value !== undefined) emit("status", "reader.status.sectionChanged", { title: activePlayback.value.renderedSection.title }); } catch (error) { pendingSectionIndex.value = undefined; reportFailure(error, "reader.status.actionFailed"); } }
function confirmClearSession(): void { clearSessionRequested.value = false; try { readerStore.resetSession(); emit("status", isPreview.value ? "reader.status.previewReset" : "reader.status.sessionCleared"); } catch (error) { reportFailure(error, "reader.status.actionFailed"); } }
function openExternalLink(event: MouseEvent): void { const target = event.target; if (!(target instanceof Element)) return; const anchor = target.closest("a"); if (!(anchor instanceof HTMLAnchorElement)) return; event.preventDefault(); if (/^(https?:|mailto:)/.test(anchor.href)) externalLinkHref.value = anchor.href; }
function confirmExternalLink(): void { const href = externalLinkHref.value; externalLinkHref.value = undefined; if (href !== undefined) window.open(href, "_blank", "noopener,noreferrer"); }
function errorSubject(error: ProtocolError): string {
  const directId = error.path.match(/(?:values|inputValues)\.([A-Za-z_][A-Za-z0-9_]*)/)?.[1];
  if (directId !== undefined) return protocol.value?.variables.find((definition) => definition.id === directId)?.label ?? directId;
  const variableIndex = Number(error.path.match(/variables\.(\d+)/)?.[1]);
  return Number.isInteger(variableIndex) ? protocol.value?.variables[variableIndex]?.label ?? error.path : error.path || t("reader.frame.published");
}
function translatedError(error: ProtocolError): string {
  const path = error.path || t("reader.frame.published");
  switch (error.code) {
    case "missing_input": case "missing_input_value": return t("reader.error.missingInput", { variable: errorSubject(error) });
    case "invalid_input": case "invalid_variable_constraints": case "invalid_variable_default": return t("reader.error.invalidInput", { variable: errorSubject(error) });
    case "invalid_duration": case "invalid_duration_variable": return t("reader.error.invalidDuration");
    case "web_crypto_unavailable": return t("reader.error.webCrypto");
    case "invalid_playback_session": return t("reader.error.invalidSession");
    case "resource_limit": return t("reader.error.resourceLimit", { path });
    case "invalid_image": return t("reader.error.invalidImage", { path });
    case "formula_error": case "formula_test_failed": case "unknown_variable": case "non_numeric_variable": case "cyclic_dependency": case "missing_formula_test_case": case "missing_expected_value": return t("reader.error.formula", { path });
    case "invalid_envelope_encoding": case "unrecognized_field": case "duplicate_section": case "duplicate_variable": return t("reader.error.structure", { path });
    default: return t("reader.error.generic", { path, code: error.code });
  }
}
</script>
<template>
  <section v-if="activePlayback" class="playback-workbench" aria-labelledby="playback-title">
    <nav class="section-rail" :aria-label="t('reader.playback.sections')"><p>{{ t("reader.playback.sections") }}</p><Button v-for="(section, index) in protocol?.sections" :key="section.sectionId" type="button" variant="ghost" class="section-navigation-button" :aria-current="isCurrentSection(index) ? 'step' : undefined" @click="pendingSectionIndex = index"><span class="section-index">{{ String(index + 1).padStart(2, "0") }}</span><span class="section-navigation-copy"><strong>{{ section.title }}</strong><small>{{ isCurrentSection(index) ? t("reader.playback.current") : sectionDuration(section) }}</small></span><span class="reader-visually-hidden">{{ t("reader.playback.jumpTo", { title: section.title }) }}</span></Button></nav>
    <details class="section-drawer" open><summary>{{ t("reader.playback.sectionDrawer", { current: activePlayback.currentSectionIndex + 1, total: protocol?.sections.length ?? 0 }) }}</summary><div><Button v-for="(section, index) in protocol?.sections" :key="section.sectionId" type="button" variant="ghost" class="section-navigation-button" :aria-current="isCurrentSection(index) ? 'step' : undefined" @click="pendingSectionIndex = index"><span class="section-index">{{ String(index + 1).padStart(2, "0") }}</span><span class="section-navigation-copy"><strong>{{ section.title }}</strong><small>{{ isCurrentSection(index) ? t("reader.playback.current") : sectionDuration(section) }}</small></span><span class="reader-visually-hidden">{{ t("reader.playback.jumpTo", { title: section.title }) }}</span></Button></div></details>
    <article class="current-section"><header class="current-section-header"><div><p>{{ t("reader.playback.currentSection") }}</p><h2 id="playback-title">{{ activePlayback.renderedSection.title }}</h2></div><div v-if="playbackRemaining !== undefined" class="compact-timer" role="timer" :aria-label="t('reader.playback.timer')"><span>{{ t("reader.playback.timer") }}</span><strong>{{ formatMilliseconds(playbackRemaining) }}</strong><small>{{ t("reader.playback.remaining", { duration: formatMilliseconds(playbackRemaining) }) }}</small></div><div v-else class="compact-timer" data-untimed><span>{{ t("reader.playback.timer") }}</span><strong>{{ activePlayback.sectionCompleted ? "OK" : "—" }}</strong><small>{{ activePlayback.sectionCompleted ? t("reader.playback.complete") : t("reader.playback.untimed") }}</small></div></header>
      <p v-if="activePlayback.mode === 'paused'" class="playback-alert" role="alert">{{ t("reader.playback.paused", { reason: pauseReason(activePlayback.reason) }) }}</p><div ref="sectionProse" class="section-prose protocol-content"><EditorContent :editor="readerEditor" @click="openExternalLink" /></div>
      <p v-if="activePlayback.taskItemCompletionRequired" id="task-completion-status" class="task-completion-status" :data-satisfied="activePlayback.taskItemCompletionSatisfied">{{ activePlayback.sectionCompleted ? t("reader.playback.taskItemsReadOnly") : t("reader.playback.taskItemsComplete", { checked: checkedTaskItemCount, total: activePlayback.taskItemCount }) }}</p>
      <footer class="playback-actions"><div class="primary-playback-action"><Button v-if="activePlayback.sectionCompleted" type="button" size="lg" variant="secondary" disabled>{{ t("reader.playback.sectionCompleted") }}</Button><Button v-else-if="activePlayback.mode === 'playing' && protocol?.sections[activePlayback.currentSectionIndex]?.duration.kind === 'untimed'" type="button" size="lg" :disabled="!activePlayback.canCompleteSection" :aria-describedby="activePlayback.taskItemCompletionRequired ? 'task-completion-status' : undefined" @click="completeSection">{{ t("reader.action.completeSection") }}</Button><Button v-else-if="activePlayback.mode === 'paused'" type="button" size="lg" @click="resumePlayback">{{ t("reader.action.resume") }}</Button><Button v-else-if="activePlayback.mode === 'playing'" type="button" size="lg" disabled>{{ playbackRemaining === 0 && !activePlayback.taskItemCompletionSatisfied ? t("reader.action.completeChecklist") : t("reader.action.timerRunning") }}</Button></div><div class="secondary-session-actions"><span>{{ t("reader.playback.sessionActions") }}</span><Button type="button" size="sm" variant="outline" @click="clearSessionRequested = true">{{ isPreview ? t("reader.action.resetPreview") : t("reader.action.clearSession") }}</Button></div></footer></article>
    <AccessibleDialog v-if="activePlayback.mode === 'waiting'" id="wait-dialog" :title="t('reader.wait.title')" :confirm-label="t('reader.wait.confirm')" :dismissible="false" @confirm="acknowledgeSection"><div class="reader-feature-scope"><p>{{ t("reader.wait.body") }}</p></div></AccessibleDialog>
  </section>
  <section v-else-if="snapshot.mode === 'quarantined'" class="quarantine-workbench" aria-labelledby="quarantine-title"><p>{{ t("reader.stage.playback") }}</p><h2 id="quarantine-title">{{ t("reader.quarantine.title") }}</h2><p>{{ t("reader.quarantine.body") }}</p><ul role="alert"><li v-for="error in snapshot.errors" :key="`${error.path}:${error.code}`">{{ translatedError(error) }}</li></ul><Button type="button" variant="destructive" @click="clearSessionRequested = true">{{ t("reader.action.clearSession") }}</Button></section>
  <AccessibleDialog v-if="externalLinkHref" id="external-link-dialog" :title="t('reader.external.title')" :confirm-label="t('reader.external.confirm')" :cancel-label="t('common.cancel')" @confirm="confirmExternalLink" @cancel="externalLinkHref = undefined"><div class="reader-feature-scope"><p>{{ t("reader.external.body") }}</p><p class="break-anywhere">{{ externalLinkHref }}</p></div></AccessibleDialog>
  <AccessibleDialog v-if="clearSessionRequested" id="clear-session-dialog" :title="isPreview ? t('reader.previewReset.title') : t('reader.clear.title')" :confirm-label="isPreview ? t('reader.previewReset.confirm') : t('reader.clear.confirm')" :cancel-label="t('common.cancel')" @confirm="confirmClearSession" @cancel="clearSessionRequested = false"><div class="reader-feature-scope"><p>{{ isPreview ? t("reader.previewReset.body") : t("reader.clear.body") }}</p></div></AccessibleDialog>
  <AccessibleDialog v-if="pendingSectionIndex !== undefined" id="section-jump-dialog" :title="t('reader.jump.title')" :confirm-label="t('reader.jump.confirm')" :cancel-label="t('common.cancel')" @confirm="confirmSectionJump" @cancel="pendingSectionIndex = undefined"><div class="reader-feature-scope"><p>{{ t("reader.jump.body") }}</p></div></AccessibleDialog>
</template>
