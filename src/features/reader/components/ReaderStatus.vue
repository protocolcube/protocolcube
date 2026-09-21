<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useReaderStore } from "@/features/reader/store";
import { t, type TranslationKey, type TranslationParams } from "@/locales";
const props = defineProps<{ status: { key: TranslationKey; params?: TranslationParams } }>();
const { inspection, isPreview, persistence, snapshot } = storeToRefs(useReaderStore());
const stageLabel = computed(() => t(snapshot.value.mode === "completed" ? "reader.stage.completion" : ["playing", "paused", "waiting", "quarantined"].includes(snapshot.value.mode) ? "reader.stage.playback" : "reader.stage.configure"));
const blocked = computed(() => !isPreview.value && (inspection.value.format === "invalid" || inspection.value.signature === "mismatch" || inspection.value.signature === "unverified" || !inspection.value.playable));
</script>
<template><footer class="operational-status"><span role="status"><span class="status-dot" :data-state="blocked ? 'error' : snapshot.mode === 'paused' ? 'warning' : 'ok'" />{{ t(props.status.key, props.status.params) }}</span><span class="status-metadata"><span>{{ stageLabel }}</span><span>{{ isPreview ? t("reader.status.preview") : persistence === "persistent" ? t("reader.status.persistent") : t("reader.status.memory") }}</span><span>{{ t("reader.status.offline") }}</span></span></footer></template>
