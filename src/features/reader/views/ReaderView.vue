<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useReaderStore, isReaderActionFailure } from "@/features/reader/store";
import type { Protocol } from "@/domain/protocol";
import { type TranslationKey, type TranslationParams } from "@/locales";
import ReaderCommandBar from "@/features/reader/components/ReaderCommandBar.vue";
import ReaderCompletion from "@/features/reader/components/ReaderCompletion.vue";
import ReaderConfiguration from "@/features/reader/components/ReaderConfiguration.vue";
import ReaderPlayback from "@/features/reader/components/ReaderPlayback.vue";
import ReaderProgress from "@/features/reader/components/ReaderProgress.vue";
import ReaderSignedFrame from "@/features/reader/components/ReaderSignedFrame.vue";
import ReaderStatus from "@/features/reader/components/ReaderStatus.vue";
import { ScrollArea } from "@/components/ui/scroll-area";
import "@/features/reader/components/reader.css";

const props = defineProps<{ previewProtocol?: Protocol; editableForkAvailable?: boolean }>();
const emit = defineEmits<{ exitPreview: []; requestEditableFork: [action: "create" | "return"] }>();
const readerStore = useReaderStore();
const { activePlayback, inspection, isPreview, timerOutcome } = storeToRefs(readerStore);
const status = ref<{ key: TranslationKey; params?: TranslationParams }>({ key: props.previewProtocol ? "reader.status.openingPreview" : "reader.status.opening" });
function setStatus(key: TranslationKey, params?: TranslationParams): void { status.value = params === undefined ? { key } : { key, params }; }
function reportReaderFailure(error: unknown): void { if (isReaderActionFailure(error)) { setStatus("reader.status.actionFailed"); return; } throw error; }
watch(timerOutcome, (outcome) => { if (outcome === undefined) return; if (outcome.value === "waiting") setStatus("reader.status.timerComplete"); else if (outcome.value === "paused") setStatus("reader.status.paused"); else if (outcome.value === "advanced" && activePlayback.value !== undefined) setStatus("reader.status.advanced", { title: activePlayback.value.renderedSection.title }); else if (outcome.value === "completed") setStatus("reader.status.sectionComplete"); });
onMounted(async () => { try { const { restored } = props.previewProtocol === undefined ? await readerStore.openPublishedProtocol(document.documentElement.outerHTML) : await readerStore.openAuthorPreview(props.previewProtocol); if (isPreview.value) setStatus("reader.status.previewReady"); else if (restored === "restored") setStatus("reader.status.restored"); else if (restored === "quarantined") setStatus("reader.status.quarantined"); else if (inspection.value.signature === "match" && inspection.value.playable) setStatus("reader.status.ready"); else setStatus("reader.status.blocked"); } catch (error) { reportReaderFailure(error); } });
onBeforeUnmount(() => readerStore.dispose());
</script>
<template>
  <main class="reader-app">
    <ReaderCommandBar :editable-fork-available="editableForkAvailable" @request-editable-fork="emit('requestEditableFork', $event)" />
    <ScrollArea class="reader-scroll" data-reader-scroll><ReaderProgress /><ReaderSignedFrame @exit-preview="emit('exitPreview')"><ReaderConfiguration @status="setStatus" /><ReaderPlayback @status="setStatus" /><ReaderCompletion @exit-preview="emit('exitPreview')" @status="setStatus" /></ReaderSignedFrame></ScrollArea>
    <ReaderStatus :status="status" />
  </main>
</template>
