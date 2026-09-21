<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useReaderStore } from "@/features/reader/store";
import { t, type TranslationKey } from "@/locales";
const { snapshot } = storeToRefs(useReaderStore());
const stages = [{ id: "configure", label: "reader.stage.configure" }, { id: "playback", label: "reader.stage.playback" }, { id: "completion", label: "reader.stage.completion" }] as const satisfies readonly { id: "configure" | "playback" | "completion"; label: TranslationKey }[];
const stage = computed<(typeof stages)[number]["id"]>(() => snapshot.value.mode === "completed" ? "completion" : ["playing", "paused", "waiting", "quarantined"].includes(snapshot.value.mode) ? "playback" : "configure");
</script>
<template><nav :aria-label="t('reader.progress')" class="reader-progress"><ol><li v-for="item in stages" :key="item.id"><span :aria-current="stage === item.id ? 'step' : undefined" :data-active="stage === item.id">{{ t(item.label) }}</span></li></ol></nav></template>
