<script setup lang="ts">
import { Clipboard, Download } from "@lucide/vue";
import { useAuthorStore } from "@/features/author/store";
import { Button } from "@/components/ui/button";
import { t } from "@/locales";

const props = defineProps<{
  keyId: string;
  compact?: boolean;
}>();

const author = useAuthorStore();

function fileNameFor(keyId: string): string {
  return `protocol-box-key-${keyId.slice(0, 12)}.json`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function withRecoveryJson(
  action: (json: string) => Promise<void> | void,
  failureKey:
    | "author.recovery.copyFailed"
    | "author.recovery.downloadFailed",
): Promise<void> {
  let recovery:
    | Awaited<ReturnType<typeof author.retrieveRecoveryCopy>>
    | undefined;
  let json = "";
  try {
    recovery = await author.retrieveRecoveryCopy(props.keyId);
  } catch (error) {
    author.setStatus(
      t("author.recovery.retrievalFailed", { message: errorMessage(error) }),
    );
    return;
  }
  try {
    const serialized = JSON.stringify(recovery.keyBundle, null, 2);
    if (serialized === undefined) {
      throw new Error(t("author.recovery.malformed"));
    }
    json = serialized;
    await action(json);
    author.clearNewKeyRecoveryReminder(props.keyId);
  } catch (error) {
    author.setStatus(t(failureKey, { message: errorMessage(error) }));
  } finally {
    json = "";
    if (recovery !== undefined) {
      recovery.keyBundle.ciphertext = "";
      recovery = undefined;
    }
  }
}

async function copyJson(): Promise<void> {
  await withRecoveryJson(async (json) => {
    if (navigator.clipboard === undefined) {
      throw new Error(t("author.recovery.clipboardUnavailable"));
    }
    await navigator.clipboard.writeText(json);
    author.setStatus(t("author.recovery.copied"));
  }, "author.recovery.copyFailed");
}

async function downloadJson(): Promise<void> {
  await withRecoveryJson((json) => {
    const objectUrl = URL.createObjectURL(
      new Blob([json], { type: "application/json" }),
    );
    try {
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileNameFor(props.keyId);
      link.click();
    } finally {
      globalThis.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    }
    author.setStatus(t("author.recovery.downloaded"));
  }, "author.recovery.downloadFailed");
}

async function copyKeyId(): Promise<void> {
  try {
    if (navigator.clipboard === undefined) {
      throw new Error(t("author.recovery.clipboardUnavailable"));
    }
    await navigator.clipboard.writeText(props.keyId);
    author.setStatus(t("author.recovery.keyIdCopied"));
  } catch (error) {
    author.setStatus(
      t("author.recovery.keyIdCopyFailed", { message: errorMessage(error) }),
    );
  }
}
</script>

<template>
  <div class="key-bundle-recovery-actions">
    <Button type="button" :size="compact ? 'sm' : 'default'" @click="downloadJson">
      <Download aria-hidden="true" />
      {{ t("author.recovery.downloadJson") }}
    </Button>
    <Button
      type="button"
      :size="compact ? 'sm' : 'default'"
      variant="outline"
      @click="copyJson"
    >
      <Clipboard aria-hidden="true" />
      {{ t("author.recovery.copyJson") }}
    </Button>
    <Button
      type="button"
      :size="compact ? 'sm' : 'default'"
      variant="ghost"
      @click="copyKeyId"
    >
      {{ t("author.recovery.copyKeyId") }}
    </Button>
  </div>
</template>
