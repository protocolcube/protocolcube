<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useAuthorStore } from "@/features/author/store";
import { t, type TranslationKey } from "@/locales";
const props = defineProps<{ hasUnsavedChanges: boolean; bodyHeadingWarningCount: number }>();
const { snapshot, editing, inspection, status } = storeToRefs(useAuthorStore());
const authorStatusKeys: Partial<Record<string, TranslationKey>> = {
  "Opening Author Workspace...": "author.status.opening", "Author mode is locked": "author.status.locked", "Author mode unlocked": "author.status.unlocked", "Key Bundle created. Save its JSON outside this application.": "author.status.keyCreated", "Unsigned Draft created": "author.status.draftCreated", "Unsigned Draft restored": "author.status.draftRestored", "Unsigned Draft saved": "author.status.draftSaved", "Author mode locked": "author.status.modeLocked", "Image embedded": "author.status.imageEmbedded", "Published Protocol imported as an Unsigned Draft": "author.status.imported", "Published Protocol Forked as an Unsigned Draft": "author.status.forked", "Published Protocol and checksum saved": "author.status.published", "Recovery snapshot restored": "author.status.snapshotRestored", "Unsigned Draft closed without saving changes": "author.status.closedUnsaved",
};
const localizedAuthorStatus = computed(() => { const key = authorStatusKeys[status.value]; return key === undefined ? status.value : t(key); });
</script>
<template>
<footer
  class="operation-status z-30 flex min-h-8 items-center justify-between gap-4 border-t border-border bg-card px-3 py-[.35rem] text-[.72rem] text-muted-foreground"
>
  <span role="status" class="flex items-center gap-[.55rem]">
    <span
      class="mr-[.35rem] inline-block size-2 rounded-full bg-[var(--success)] data-[state=warning]:bg-[var(--warning)] data-[state=error]:bg-destructive"
      :data-state="snapshot.mode === 'save-failed' ? 'error' : props.hasUnsavedChanges ? 'warning' : 'ok'"
    />
    {{ snapshot.mode === "save-failed" ? t("author.status.saveFailed") : props.hasUnsavedChanges ? t("author.status.unsaved") : localizedAuthorStatus }}
  </span>
  <span class="status-metadata flex flex-wrap justify-end gap-x-3 gap-y-1 font-mono max-[48rem]:hidden">
    <span>{{ snapshot.mode === "locked" ? t("author.status.keyLocked") : t("author.status.keyUnlocked") }}</span>
    <span v-if="editing">{{ inspection?.playable ? "Playable checks pass" : `${inspection?.errors.length ?? 0} checks need attention` }}</span>
    <span v-if="props.bodyHeadingWarningCount">
      {{ props.bodyHeadingWarningCount }} heading hierarchy warning{{
        props.bodyHeadingWarningCount === 1 ? "" : "s"
      }}
    </span>
  </span>
</footer>

</template>
