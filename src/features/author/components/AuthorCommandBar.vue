<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { ArrowLeft, CircleHelp, LockKeyhole, Play, Save } from "@lucide/vue";
import { useRouter } from "vue-router";
import { ProtocolCore } from "@/domain/protocol";
import { useAuthorStore } from "@/features/author/store";
import AppearanceSelect from "@/components/shared/AppearanceSelect.vue";
import LocaleSelect from "@/components/shared/LocaleSelect.vue";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import KeyBundleRecoveryActions from "@/features/author/components/KeyBundleRecoveryActions.vue";
import { clearAuthoringEditPending, savedAuthoringCanonical } from "@/features/author/components/authoring-session-state";
import { useAppShellStore } from "@/stores/app-shell";
import { t } from "@/locales";
const props = defineProps<{ readerMode: boolean; navigationOpen: boolean }>();
const emit = defineEmits<{ help: []; preview: []; returnToReader: []; locked: []; toggleNavigation: [] }>();
const author = useAuthorStore();
const router = useRouter();
const appShell = useAppShellStore();
const { editing, newKeyRecoveryReminderKeyId, snapshot } = storeToRefs(author);
const recoveryKeyId = computed(() =>
  snapshot.value.mode === "locked" ? undefined : snapshot.value.keyId,
);
const showNewKeyReminder = computed(
  () =>
    recoveryKeyId.value !== undefined &&
    recoveryKeyId.value === newKeyRecoveryReminderKeyId.value,
);
async function save(): Promise<void> { if (!editing.value) return; try { await author.saveDraft(); await author.refreshDrafts(); await author.refreshRecoverySnapshots(); savedAuthoringCanonical.value = ProtocolCore.canonicalizeProtocol(editing.value.protocol); clearAuthoringEditPending(); author.setStatus("Unsigned Draft saved"); } catch (error) { author.setStatus(error instanceof Error ? error.message : "Save failed"); } }
async function lock(): Promise<void> {
  try {
    appShell.setCrossShellRouteIntent(undefined);
    await author.lock();
    await router.push({ name: "author-access" });
    appShell.setCrossShellRouteIntent(undefined);
    emit("locked");
    author.setStatus(t("author.status.modeLocked"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    author.setStatus(t("author.recovery.retrySaveLockFailed", { message }));
  }
}
</script>
<template>
<header
  class="command-bar z-30 flex min-h-15 flex-wrap items-center justify-between gap-3 border-x-0 border-t-0 border-b border-border bg-[color-mix(in_oklab,var(--card)_94%,transparent)] px-4 py-[.6rem] [backdrop-filter:blur(16px)] max-[48rem]:items-start max-[24rem]:grid max-[24rem]:grid-cols-[1fr_auto]"
>
  <div class="flex items-center gap-3">
    <button
      type="button"
      class="grid size-9 place-items-center rounded-[.35rem] border border-primary font-mono text-[.72rem] font-extrabold tracking-[.08em] text-primary"
      :aria-label="t('author.nav.toggle')"
      aria-controls="author-workspace-navigation"
      :aria-expanded="navigationOpen"
      @click="emit('toggleNavigation')"
    >PB</button>
    <div>
      <h1 class="m-0 text-base tracking-[-.02em]">{{ t("author.heading") }}</h1>
      <p class="mt-[.05rem] mb-0 text-[.72rem] text-muted-foreground max-[48rem]:hidden">
        {{ t("author.subtitle") }}
      </p>
    </div>
  </div>
  <div class="command-actions flex flex-wrap justify-end gap-1.5 max-[48rem]:[&_[data-slot=button]_span]:hidden max-[24rem]:col-span-full">
    <Button
      v-if="readerMode"
      type="button"
      size="sm"
      variant="outline"
      @click="emit('returnToReader')"
    >
      <ArrowLeft aria-hidden="true" />
      {{ t("author.fork.backToPublished") }}
    </Button>
    <Button
      v-if="editing"
      type="button"
      size="sm"
      variant="ghost"
      title="Save (Ctrl/Cmd+S)"
      @click="save"
    >
      <Save aria-hidden="true" />
      {{ t("author.action.save") }}
    </Button>
    <Button
      v-if="editing"
      type="button"
      size="sm"
      variant="ghost"
      @click="lock"
    >
      <LockKeyhole aria-hidden="true" />
      {{ t("author.action.saveLock") }}
    </Button>
    <Button
      v-if="editing"
      type="button"
      size="sm"
      variant="outline"
      title="Author Preview (Ctrl/Cmd+Shift+Enter)"
      @click="emit('preview')"
    >
      <Play aria-hidden="true" />
      {{ t("author.action.preview") }}
    </Button>
    <Popover v-if="editing && recoveryKeyId">
      <PopoverTrigger as-child>
        <Button
          type="button"
          size="sm"
          variant="outline"
          :aria-label="t('author.access.title')"
        >
          <LockKeyhole aria-hidden="true" />
          {{ t("author.access.title") }}
          <span
            v-if="showNewKeyReminder"
            class="new-key-reminder-indicator"
            aria-hidden="true"
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent class="author-key-menu" align="end">
        <strong>{{ t("author.recovery.title") }}</strong>
        <p>{{ t("author.recovery.exportWarning") }}</p>
        <p v-if="showNewKeyReminder" class="recovery-warning" role="alert">
          <strong>{{ t("author.recovery.reminderTitle") }}</strong>
          {{ t("author.recovery.reminderBody") }}
        </p>
        <KeyBundleRecoveryActions :key-id="recoveryKeyId" compact />
      </PopoverContent>
    </Popover>
    <Button type="button" size="sm" variant="ghost" @click="emit('help')">
      <CircleHelp aria-hidden="true" />
      {{ t("common.help") }}
    </Button>
    <LocaleSelect />
    <AppearanceSelect />
  </div>
  <p class="hidden max-[48rem]:block">
    Author editing is supported as a desktop workflow.
  </p>
</header>

</template>
