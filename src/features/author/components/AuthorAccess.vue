<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { CircleHelp, FileKey2, KeyRound, Plus } from "@lucide/vue";
import {
  isAuthorActionFailure,
  useAuthorStore,
} from "@/features/author/store";
import AccessibleDialog from "@/components/shared/AccessibleDialog.vue";
import KeyBundleRecoveryActions from "@/features/author/components/KeyBundleRecoveryActions.vue";
import { Button } from "@/components/ui/button";
import { t } from "@/locales";

const props = defineProps<{
  pendingForkAction?: "create" | "return";
  requiredKeyId?: string;
  showNewKeyReminder?: boolean;
}>();
const emit = defineEmits<{
  help: [topic: string];
  ready: [];
  cancelFork: [];
}>();

type AccessMode = "recovery" | "import" | "create";
type RecoveryCandidate = {
  bundle: unknown;
  sourceFileName?: string;
};

const author = useAuthorStore();
const { capabilities, recoveryCopies, snapshot } = storeToRefs(author);
const accessMode = ref<AccessMode>("recovery");
const selectedKeyId = ref<string>();
const passphrase = ref("");
const confirmation = ref("");
const privateKeyPkcs8 = ref("");
const publicKeySpki = ref("");
const fileInput = ref<HTMLInputElement>();
const importedCandidate = ref<RecoveryCandidate>();
const replacementCandidate = ref<RecoveryCandidate>();
const replacementRequested = ref(false);
const forgetRequested = ref<string>();
const forgetAllRequested = ref(false);

const fileOpenAvailable =
  typeof HTMLInputElement !== "undefined" &&
  typeof File !== "undefined" &&
  typeof FileReader !== "undefined" &&
  "files" in HTMLInputElement.prototype;
const orderedRecoveryCopies = computed(() =>
  [...recoveryCopies.value].sort((left, right) => right.savedAt - left.savedAt),
);
const selectedRecoveryCopy = computed(() =>
  orderedRecoveryCopies.value.find(
    (recoveryCopy) => recoveryCopy.keyId === selectedKeyId.value,
  ),
);
const matchingRecoveryCopyAvailable = computed(
  () =>
    props.requiredKeyId !== undefined &&
    orderedRecoveryCopies.value.some(
      (recoveryCopy) => recoveryCopy.keyId === props.requiredKeyId,
    ),
);
const requiredRecoveryCopyMissing = computed(
  () =>
    props.requiredKeyId !== undefined && !matchingRecoveryCopyAvailable.value,
);
const fileLabel = computed(() =>
  props.requiredKeyId === undefined
    ? t("author.recovery.openFile")
    : t("author.recovery.importMatching"),
);
const unlockedKeyId = computed(() => currentKeyId());

function shortKeyId(keyId: string): string {
  return `${keyId.slice(0, 12)}…${keyId.slice(-6)}`;
}

function localizedTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function currentKeyId(): string | undefined {
  return snapshot.value.mode === "locked" ? undefined : snapshot.value.keyId;
}

function releaseCandidate(candidate: RecoveryCandidate | undefined): void {
  if (
    candidate !== undefined &&
    typeof candidate.bundle === "object" &&
    candidate.bundle !== null &&
    "ciphertext" in candidate.bundle &&
    typeof candidate.bundle.ciphertext === "string"
  ) {
    candidate.bundle.ciphertext = "";
  }
}

function clearSensitiveFormState(): void {
  passphrase.value = "";
  confirmation.value = "";
  privateKeyPkcs8.value = "";
  publicKeySpki.value = "";
  releaseCandidate(importedCandidate.value);
  importedCandidate.value = undefined;
  releaseCandidate(replacementCandidate.value);
  replacementCandidate.value = undefined;
  replacementRequested.value = false;
}

function selectRecoveryCopy(keyId: string): void {
  selectedKeyId.value = keyId;
  accessMode.value = "recovery";
}

function showImport(): void {
  accessMode.value = "import";
}

function showCreation(): void {
  accessMode.value = "create";
}

function openFilePicker(): void {
  if (!fileOpenAvailable || fileInput.value === undefined) {
    author.setStatus(t("author.recovery.fileUnavailable"));
    return;
  }
  try {
    fileInput.value.click();
  } catch (error) {
    author.setStatus(
      t("author.recovery.fileReadFailed", { message: errorMessage(error) }),
    );
  }
}

async function readFileText(file: File): Promise<string> {
  if (typeof file.text === "function") return file.text();
  if (typeof FileReader === "undefined") {
    throw new Error(t("author.recovery.fileTextUnavailable"));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(reader.error ?? new Error(t("author.recovery.fileReadUnknown")));
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error(t("author.recovery.fileNoText")));
        return;
      }
      resolve(reader.result);
    };
    reader.readAsText(file);
  });
}

async function loadKeyBundleFile(event: Event): Promise<void> {
  const target = event.currentTarget;
  if (!(target instanceof HTMLInputElement)) {
    author.setStatus(
      t("author.recovery.fileReadFailed", {
        message: t("author.recovery.fileInputUnavailable"),
      }),
    );
    return;
  }
  const file = target.files?.item(0);
  target.value = "";
  if (file === null || file === undefined) return;

  let text: string;
  try {
    text = await readFileText(file);
  } catch (error) {
    author.setStatus(
      t("author.recovery.fileReadFailed", { message: errorMessage(error) }),
    );
    return;
  }

  let bundle: unknown;
  try {
    bundle = JSON.parse(text);
  } catch (error) {
    author.setStatus(
      t("author.recovery.invalidJson", { message: errorMessage(error) }),
    );
    return;
  } finally {
    text = "";
  }

  releaseCandidate(importedCandidate.value);
  importedCandidate.value = { bundle, sourceFileName: file.name };
  accessMode.value = "import";
  author.setStatus(t("author.recovery.imported"));
}

function statusForUnlockFailure(error: unknown): string {
  if (isAuthorActionFailure(error)) {
    if (error.code === "key_bundle_unlock_failed") {
      return t("author.recovery.passwordFailed");
    }
    if (error.code === "invalid_key_bundle") {
      return t("author.recovery.malformed");
    }
  }
  return t("author.recovery.retrievalFailed", { message: errorMessage(error) });
}

async function completeUnlock(
  bundle: unknown,
  options: { sourceFileName?: string } = {},
): Promise<"completed" | "replacement"> {
  const recoveryCopy = await author.unlockKeyBundle(
    bundle,
    passphrase.value,
    options,
  );
  const keyId = currentKeyId();
  if (keyId === undefined) {
    throw new Error(t("author.recovery.unlockLost"));
  }
  if (props.requiredKeyId !== undefined && keyId !== props.requiredKeyId) {
    await author.lock();
    author.setStatus(t("author.recovery.keyMismatch"));
    return "completed";
  }
  passphrase.value = "";
  if (recoveryCopy.status === "replacement-required") {
    author.setStatus(t("author.recovery.replacementTitle"));
    return "replacement";
  }
  author.setStatus(t("author.recovery.cached"));
  emit("ready");
  return "completed";
}

async function unlockSelectedRecoveryCopy(): Promise<void> {
  if (selectedKeyId.value === undefined) return;
  let recovery:
    | Awaited<ReturnType<typeof author.retrieveRecoveryCopy>>
    | undefined;
  try {
    recovery = await author.retrieveRecoveryCopy(selectedKeyId.value);
    const result = await completeUnlock(recovery.keyBundle);
    if (result === "replacement") {
      replacementCandidate.value = { bundle: recovery.keyBundle };
      recovery = undefined;
      replacementRequested.value = true;
    }
  } catch (error) {
    author.setStatus(statusForUnlockFailure(error));
  } finally {
    if (recovery !== undefined) {
      recovery.keyBundle.ciphertext = "";
      recovery = undefined;
    }
  }
}

async function unlockImportedKeyBundle(): Promise<void> {
  const candidate = importedCandidate.value;
  if (candidate === undefined) {
    author.setStatus(t("author.recovery.openFile"));
    return;
  }
  try {
    const result = await completeUnlock(candidate.bundle, {
      ...(candidate.sourceFileName === undefined
        ? {}
        : { sourceFileName: candidate.sourceFileName }),
    });
    if (result === "replacement") {
      replacementCandidate.value = candidate;
      importedCandidate.value = undefined;
      replacementRequested.value = true;
      return;
    }
    releaseCandidate(candidate);
    importedCandidate.value = undefined;
  } catch (error) {
    author.setStatus(statusForUnlockFailure(error));
  }
}

async function createKeyBundle(): Promise<void> {
  if (!passphrase.value) {
    author.setStatus(t("author.recovery.passwordRequired"));
    return;
  }
  if (passphrase.value !== confirmation.value) {
    author.setStatus(t("author.recovery.passwordMismatch"));
    return;
  }

  let created:
    | Awaited<ReturnType<typeof author.createKeyBundle>>
    | undefined;
  try {
    created = await author.createKeyBundle({
      passphrase: passphrase.value,
      ...(privateKeyPkcs8.value
        ? { privateKeyPkcs8: privateKeyPkcs8.value }
        : {}),
      ...(publicKeySpki.value ? { publicKeySpki: publicKeySpki.value } : {}),
    });
    const keyId = created.bundle.keyId;
    passphrase.value = "";
    confirmation.value = "";
    privateKeyPkcs8.value = "";
    publicKeySpki.value = "";
    if (created.recoveryCopy.status === "replacement-required") {
      replacementCandidate.value = { bundle: created.bundle };
      created = undefined;
      replacementRequested.value = true;
      author.setStatus(t("author.recovery.replacementTitle"));
      return;
    }
    author.markNewKeyRecoveryReminder(keyId);
    author.setStatus(t("author.recovery.created"));
    created.bundle.ciphertext = "";
    created = undefined;
  } catch (error) {
    author.setStatus(statusForUnlockFailure(error));
  } finally {
    if (created !== undefined) {
      created.bundle.ciphertext = "";
      created = undefined;
    }
  }
}

async function replaceRecoveryCopy(): Promise<void> {
  const candidate = replacementCandidate.value;
  if (candidate === undefined) return;
  try {
    await author.cacheRecoveryCopy(candidate.bundle, {
      replace: true,
      ...(candidate.sourceFileName === undefined
        ? {}
        : { sourceFileName: candidate.sourceFileName }),
    });
    releaseCandidate(candidate);
    replacementCandidate.value = undefined;
    replacementRequested.value = false;
    author.setStatus(t("author.recovery.replaced"));
    emit("ready");
  } catch (error) {
    author.setStatus(statusForUnlockFailure(error));
  }
}

function keepExistingRecoveryCopy(): void {
  releaseCandidate(replacementCandidate.value);
  replacementCandidate.value = undefined;
  replacementRequested.value = false;
  author.setStatus(t("author.recovery.replacementCancelled"));
  emit("ready");
}

async function forgetRecoveryCopy(): Promise<void> {
  const keyId = forgetRequested.value;
  if (keyId === undefined) return;
  try {
    await author.forgetRecoveryCopy(keyId);
    if (selectedKeyId.value === keyId) {
      selectedKeyId.value = orderedRecoveryCopies.value[0]?.keyId;
    }
    forgetRequested.value = undefined;
    author.setStatus(t("author.recovery.forgot"));
  } catch (error) {
    author.setStatus(
      t("author.recovery.forgetFailed", { message: errorMessage(error) }),
    );
  }
}

async function forgetAllRecoveryCopies(): Promise<void> {
  try {
    await author.forgetAllRecoveryCopies();
    selectedKeyId.value = undefined;
    forgetAllRequested.value = false;
    author.setStatus(t("author.recovery.forgotAll"));
  } catch (error) {
    author.setStatus(
      t("author.recovery.forgetFailed", { message: errorMessage(error) }),
    );
  }
}

watch(
  [orderedRecoveryCopies, () => props.requiredKeyId],
  () => {
    const required = props.requiredKeyId;
    if (
      required !== undefined &&
      orderedRecoveryCopies.value.some(
        (recoveryCopy) => recoveryCopy.keyId === required,
      )
    ) {
      selectedKeyId.value = required;
      accessMode.value = "recovery";
      return;
    }
    if (
      selectedKeyId.value === undefined ||
      !orderedRecoveryCopies.value.some(
        (recoveryCopy) => recoveryCopy.keyId === selectedKeyId.value,
      )
    ) {
      selectedKeyId.value = orderedRecoveryCopies.value[0]?.keyId;
    }
  },
  { immediate: true },
);

watch(
  () => snapshot.value.mode,
  (mode) => {
    if (mode === "locked") clearSensitiveFormState();
  },
);

onBeforeUnmount(clearSensitiveFormState);
</script>

<template>
  <section
    v-if="snapshot.mode === 'locked' || props.showNewKeyReminder"
    class="access-workspace mx-auto min-h-full w-full max-w-[76rem] p-[clamp(1rem,2.5vw,2rem)] max-[48rem]:p-3"
    aria-labelledby="author-key-title"
  >
    <div class="section-heading">
      <div>
        <p class="eyebrow">{{ t("author.access.eyebrow") }}</p>
        <h2 id="author-key-title">{{ t("author.access.title") }}</h2>
        <p>{{ t("author.access.intro") }}</p>
      </div>
      <div class="actions">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          data-help-topic="author/author-key"
          @click="emit('help', 'author/author-key')"
        >
          <CircleHelp aria-hidden="true" />
          {{ t("help.learn.authorKey") }}
        </Button>
        <KeyRound aria-hidden="true" />
      </div>
    </div>

    <aside v-if="props.showNewKeyReminder" class="recovery-new-key-reminder" role="alert">
      <div>
        <strong>{{ t("author.recovery.reminderTitle") }}</strong>
        <p>{{ t("author.recovery.reminderBody") }}</p>
      </div>
      <KeyBundleRecoveryActions
        v-if="unlockedKeyId"
        :key-id="unlockedKeyId"
      />
      <Button type="button" variant="outline" @click="emit('ready')">
        {{ t("author.recovery.continue") }}
      </Button>
    </aside>

    <template v-if="snapshot.mode === 'locked'">
      <aside v-if="props.pendingForkAction" class="fork-access-context" role="note">
        <FileKey2 aria-hidden="true" />
        <div>
          <strong>{{ t("author.fork.accessTitle") }}</strong>
          <p>{{ t("author.fork.accessBody") }}</p>
        </div>
        <Button type="button" variant="outline" @click="emit('cancelFork')">
          {{ t("author.fork.cancel") }}
        </Button>
      </aside>

    <aside
      v-if="requiredRecoveryCopyMissing && props.requiredKeyId"
      class="recovery-required-message"
      role="alert"
    >
      <strong>{{ t("author.recovery.requiredTitle") }}</strong>
      <p>{{ t("author.recovery.requiredBody", { keyId: props.requiredKeyId }) }}</p>
      <Button type="button" @click="showImport">
        {{ t("author.recovery.importMatching") }}
      </Button>
    </aside>

    <section class="recovery-panel" :aria-labelledby="'recovery-copy-title'">
      <div class="recovery-panel-heading">
        <div>
          <p class="eyebrow">{{ t("author.recovery.eyebrow") }}</p>
          <h3 id="recovery-copy-title">{{ t("author.recovery.title") }}</h3>
          <p>{{ t("author.recovery.intro") }}</p>
        </div>
        <Button
          v-if="orderedRecoveryCopies.length"
          type="button"
          size="sm"
          variant="destructive"
          @click="forgetAllRequested = true"
        >
          {{ t("author.recovery.forgetAll") }}
        </Button>
      </div>

      <p v-if="orderedRecoveryCopies.length === 0" class="recovery-empty">
        {{ t("author.recovery.none") }}
      </p>
      <div
        v-else
        class="recovery-copy-list"
        role="list"
        :aria-label="t('author.recovery.select')"
      >
        <article
          v-for="recoveryCopy in orderedRecoveryCopies"
          :key="recoveryCopy.keyId"
          class="recovery-copy-card"
          :data-selected="recoveryCopy.keyId === selectedKeyId"
          role="listitem"
        >
          <button
            type="button"
            class="recovery-copy-select"
            :aria-pressed="recoveryCopy.keyId === selectedKeyId"
            :aria-label="`${t('author.recovery.select')}: ${recoveryCopy.keyId}`"
            @click="selectRecoveryCopy(recoveryCopy.keyId)"
          >
            <span>{{ shortKeyId(recoveryCopy.keyId) }}</span>
            <small>{{ t("author.recovery.savedAt", { time: localizedTime(recoveryCopy.savedAt) }) }}</small>
          </button>
          <p v-if="recoveryCopy.sourceFileName">
            {{ t("author.recovery.sourceFile", { fileName: recoveryCopy.sourceFileName }) }}
          </p>
          <details>
            <summary>{{ t("author.recovery.keyId") }}</summary>
            <code class="mono">{{ recoveryCopy.keyId }}</code>
          </details>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            @click="forgetRequested = recoveryCopy.keyId"
          >
            {{ t("author.recovery.forget") }}
          </Button>
        </article>
      </div>

      <div
        v-if="selectedRecoveryCopy && accessMode === 'recovery'"
        class="recovery-unlock-area"
      >
        <p class="recovery-warning">{{ t("author.recovery.exportWarning") }}</p>
        <KeyBundleRecoveryActions :key-id="selectedRecoveryCopy.keyId" compact />
        <label>
          {{ t("author.recovery.password") }}
          <input
            v-model="passphrase"
            type="password"
            autocomplete="current-password"
          >
        </label>
        <Button
          type="button"
          :disabled="!capabilities.available || !passphrase"
          @click="unlockSelectedRecoveryCopy"
        >
          {{ t("author.recovery.unlockSelected") }}
        </Button>
      </div>
    </section>

    <section
      v-if="accessMode === 'import'"
      class="recovery-entry-panel"
      :aria-labelledby="'import-key-bundle-title'"
    >
      <h3 id="import-key-bundle-title">{{ t("author.recovery.importTitle") }}</h3>
      <p>{{ t("author.recovery.importIntro") }}</p>
      <input
        ref="fileInput"
        class="sr-only"
        type="file"
        accept="application/json,.json"
        :disabled="!fileOpenAvailable || !capabilities.available"
        :aria-label="t('author.recovery.fileInput')"
        @change="loadKeyBundleFile"
      >
      <Button
        type="button"
        :disabled="!fileOpenAvailable || !capabilities.available"
        @click="openFilePicker"
      >
        {{ fileLabel }}
      </Button>
      <p v-if="!fileOpenAvailable" role="alert">
        {{ t("author.recovery.fileUnavailable") }}
      </p>
      <template v-if="importedCandidate">
        <label>
          {{ t("author.recovery.password") }}
          <input
            v-model="passphrase"
            type="password"
            autocomplete="current-password"
          >
        </label>
        <Button
          type="button"
          :disabled="!capabilities.available || !passphrase"
          @click="unlockImportedKeyBundle"
        >
          {{ t("author.recovery.unlockImported") }}
        </Button>
      </template>
    </section>

    <section
      v-if="accessMode === 'create'"
      class="recovery-entry-panel"
      :aria-labelledby="'create-key-bundle-title'"
    >
      <h3 id="create-key-bundle-title">{{ t("author.recovery.createTitle") }}</h3>
      <p>{{ t("author.recovery.createIntro") }}</p>
      <label>
        {{ t("author.recovery.password") }}
        <input v-model="passphrase" type="password" autocomplete="new-password">
      </label>
      <label>
        {{ t("author.recovery.confirmPassword") }}
        <input v-model="confirmation" type="password" autocomplete="new-password">
      </label>
      <details>
        <summary>{{ t("author.recovery.convertExisting") }}</summary>
        <label>
          {{ t("author.recovery.privateKey") }}
          <textarea v-model="privateKeyPkcs8" rows="4" spellcheck="false" />
        </label>
        <label>
          {{ t("author.recovery.publicKey") }}
          <textarea v-model="publicKeySpki" rows="4" spellcheck="false" />
        </label>
      </details>
      <Button
        type="button"
        :disabled="!capabilities.available"
        @click="createKeyBundle"
      >
        <Plus aria-hidden="true" />
        {{ t("author.recovery.createAction") }}
      </Button>
    </section>

    <div class="actions recovery-entry-actions">
      <Button
        type="button"
        :variant="orderedRecoveryCopies.length ? 'outline' : 'default'"
        :disabled="!capabilities.available || !fileOpenAvailable"
        @click="accessMode === 'import' ? openFilePicker() : showImport()"
      >
        {{ orderedRecoveryCopies.length ? t("author.recovery.openAnother") : t("author.recovery.openFile") }}
      </Button>
      <Button
        type="button"
        :variant="orderedRecoveryCopies.length ? 'outline' : 'secondary'"
        :disabled="!capabilities.available"
        @click="showCreation"
      >
        {{ t("author.recovery.createNew") }}
      </Button>
    </div>
    </template>
  </section>

  <AccessibleDialog
    v-if="replacementRequested"
    id="replace-recovery-copy-dialog"
    :title="t('author.recovery.replacementTitle')"
    :confirm-label="t('author.recovery.replace')"
    :cancel-label="t('author.recovery.keepExisting')"
    @confirm="replaceRecoveryCopy"
    @cancel="keepExistingRecoveryCopy"
  >
    <p>{{ t("author.recovery.replacementBody") }}</p>
  </AccessibleDialog>
  <AccessibleDialog
    v-if="forgetRequested"
    id="forget-recovery-copy-dialog"
    :title="t('author.recovery.forgetTitle')"
    :confirm-label="t('common.forget')"
    @confirm="forgetRecoveryCopy"
    @cancel="forgetRequested = undefined"
  >
    <p>{{ t("author.recovery.forgetBody") }}</p>
  </AccessibleDialog>
  <AccessibleDialog
    v-if="forgetAllRequested"
    id="forget-all-recovery-copies-dialog"
    :title="t('author.recovery.forgetAllTitle')"
    :confirm-label="t('author.recovery.forgetAll')"
    @confirm="forgetAllRecoveryCopies"
    @cancel="forgetAllRequested = false"
  >
    <p>{{ t("author.recovery.forgetAllBody") }}</p>
  </AccessibleDialog>
</template>
