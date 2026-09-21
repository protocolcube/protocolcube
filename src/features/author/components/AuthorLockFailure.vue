<script setup lang="ts">
import { AlertTriangle, RotateCw } from "@lucide/vue";
import { storeToRefs } from "pinia";
import { useAuthorStore } from "@/features/author/store";
import { Button } from "@/components/ui/button";
import { t } from "@/locales";

const emit = defineEmits<{ returnToDraft: []; locked: [] }>();
const author = useAuthorStore();
const { capabilities } = storeToRefs(author);

async function retrySaveAndLock(): Promise<void> {
  try {
    await author.lock();
    author.setStatus(t("author.status.modeLocked"));
    emit("locked");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    author.setStatus(
      t("author.recovery.retrySaveLockFailed", { message }),
    );
  }
}
</script>

<template>
  <section class="author-lock-failure" role="alert" aria-labelledby="lock-failure-title">
    <AlertTriangle aria-hidden="true" />
    <div>
      <p class="eyebrow">{{ t("author.status.saveFailed") }}</p>
      <h2 id="lock-failure-title">{{ t("author.recovery.saveFailedTitle") }}</h2>
      <p>{{ t("author.recovery.saveFailedBody") }}</p>
      <div class="actions">
        <Button
          type="button"
          :disabled="!capabilities.available"
          @click="retrySaveAndLock"
        >
          <RotateCw aria-hidden="true" />
          {{ t("author.recovery.retrySaveLock") }}
        </Button>
        <Button type="button" variant="outline" @click="emit('returnToDraft')">
          {{ t("author.recovery.returnToDraft") }}
        </Button>
      </div>
    </div>
  </section>
</template>
