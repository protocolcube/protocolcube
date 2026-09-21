<script setup lang="ts">
import { CircleHelp, GitFork, MoreHorizontal } from "@lucide/vue";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useRouter } from "vue-router";
import { useAppShellStore } from "@/stores/app-shell";
import { useReaderStore } from "@/features/reader/store";
import AccessibleDialog from "@/components/shared/AccessibleDialog.vue";
import LocaleSelect from "@/components/shared/LocaleSelect.vue";
import { t, type TranslationKey } from "@/locales";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Appearance = "light" | "dark" | "system";

const props = defineProps<{ editableForkAvailable?: boolean }>();
const emit = defineEmits<{ requestEditableFork: [action: "create" | "return"] }>();
const router = useRouter();
const appShell = useAppShellStore();
const readerStore = useReaderStore();
const { hasPlaybackSession, inspection, isPreview, persistence } = storeToRefs(readerStore);
const forkRequested = ref(false);
const appearanceStorageKey = "protocol-box:appearance";
const systemDark = window.matchMedia("(prefers-color-scheme: dark)");

const forkEligible = computed(() => !isPreview.value && inspection.value.format === "valid" && inspection.value.signature === "match");
const forkBlockedReason = computed<TranslationKey | undefined>(() => {
  if (forkEligible.value) return undefined;
  if (inspection.value.format !== "valid") return "reader.fork.blockedFormat";
  return "reader.fork.blockedSignature";
});

function readAppearance(): Appearance {
  try {
    const stored = localStorage.getItem(appearanceStorageKey);
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
  } catch {
    return "system";
  }
}

const appearance = ref<Appearance>(readAppearance());
function applyAppearance(): void {
  document.documentElement.classList.toggle("dark", appearance.value === "dark" || (appearance.value === "system" && systemDark.matches));
}
function saveAppearance(value: Appearance): void {
  try { localStorage.setItem(appearanceStorageKey, value); } catch { /* Appearance persistence is optional. */ }
}
function handleSystemAppearance(): void { if (appearance.value === "system") applyAppearance(); }
watch(appearance, (value) => { applyAppearance(); saveAppearance(value); });
applyAppearance();
onMounted(() => systemDark.addEventListener("change", handleSystemAppearance));
onBeforeUnmount(() => systemDark.removeEventListener("change", handleSystemAppearance));

function openHelp(): void {
  appShell.setCrossShellRouteIntent("/reader");
  void router.push({ name: "help", query: { from: "reader" } });
}
function requestFork(): void { if (forkEligible.value) forkRequested.value = true; }
function confirmFork(): void { forkRequested.value = false; emit("requestEditableFork", "create"); }
function returnToEditableFork(): void { emit("requestEditableFork", "return"); }
</script>

<template>
  <header class="reader-command-bar">
    <div class="reader-brand">
      <span class="reader-brand-mark" aria-hidden="true">PB</span>
      <div><h1>{{ t("reader.heading") }}</h1><p>{{ t("reader.subtitle") }}</p></div>
    </div>
    <div class="reader-chrome-controls">
      <div v-if="!isPreview" class="reader-author-actions reader-author-actions-desktop">
        <Button v-if="!editableForkAvailable" type="button" size="sm" variant="outline" :disabled="!forkEligible" @click="requestFork"><GitFork aria-hidden="true" />{{ t("reader.fork.create") }}</Button>
        <template v-else>
          <Button type="button" size="sm" variant="outline" @click="returnToEditableFork"><GitFork aria-hidden="true" />{{ t("reader.fork.return") }}</Button>
          <Popover><PopoverTrigger as-child><Button type="button" size="icon" variant="ghost" :aria-label="t('reader.fork.more')"><MoreHorizontal aria-hidden="true" /></Button></PopoverTrigger><PopoverContent align="end" class="reader-author-menu reader-feature-scope"><Button type="button" variant="ghost" :disabled="!forkEligible" @click="requestFork"><GitFork aria-hidden="true" />{{ t("reader.fork.createAnother") }}</Button></PopoverContent></Popover>
        </template>
        <span v-if="forkBlockedReason" class="fork-blocked-reason" role="status">{{ t(forkBlockedReason) }}</span>
      </div>
      <Popover v-if="!isPreview"><PopoverTrigger as-child><Button type="button" size="sm" variant="outline" class="reader-author-actions-mobile"><GitFork aria-hidden="true" />{{ t("reader.fork.options") }}</Button></PopoverTrigger><PopoverContent align="start" class="reader-author-menu reader-feature-scope"><Button v-if="editableForkAvailable" type="button" variant="ghost" @click="returnToEditableFork">{{ t("reader.fork.return") }}</Button><Button type="button" variant="ghost" :disabled="!forkEligible" @click="requestFork">{{ editableForkAvailable ? t("reader.fork.createAnother") : t("reader.fork.create") }}</Button><p v-if="forkBlockedReason" class="fork-blocked-reason" role="status">{{ t(forkBlockedReason) }}</p></PopoverContent></Popover>
      <LocaleSelect />
      <div class="appearance-control"><span id="reader-appearance-label">{{ t("appearance.label") }}</span><Select v-model="appearance"><SelectTrigger aria-labelledby="reader-appearance-label" class="appearance-trigger" size="sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="light">{{ t("appearance.light") }}</SelectItem><SelectItem value="dark">{{ t("appearance.dark") }}</SelectItem><SelectItem value="system">{{ t("appearance.system") }}</SelectItem></SelectContent></Select></div>
      <Button type="button" size="sm" variant="ghost" @click="openHelp"><CircleHelp aria-hidden="true" />{{ t("common.help") }}</Button>
    </div>
    <AccessibleDialog v-if="forkRequested" id="create-fork-dialog" :title="t('reader.fork.dialogTitle')" :confirm-label="t('reader.fork.confirm')" :cancel-label="t('common.cancel')" @confirm="confirmFork" @cancel="forkRequested = false"><div class="reader-feature-scope"><p>{{ t("reader.fork.dialogBody") }}</p><p v-if="hasPlaybackSession">{{ persistence === "persistent" ? t("reader.fork.persistentSession") : t("reader.fork.memorySession") }}</p></div></AccessibleDialog>
  </header>
</template>
