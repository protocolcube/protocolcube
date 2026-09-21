<script setup lang="ts">
import { computed, ref } from "vue";
import { storeToRefs } from "pinia";
import {
  CircleHelp,
  FilePlus2,
  Files,
  FileText,
  FlaskConical,
  LockKeyhole,
  Search,
} from "@lucide/vue";
import { useRouter } from "vue-router";
import { useAuthorStore } from "@/features/author/store";
import type { Protocol } from "@/domain/protocol";
import { createBufferPreparationProtocol, exampleProtocolTitle } from "@/features/author/examples/buffer-preparation";
import { locale, t } from "@/locales";
import AccessibleDialog from "@/components/shared/AccessibleDialog.vue";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

const emit = defineEmits<{ help: [topic: string]; "draft-opened": [canonical?: string] }>();
const author = useAuthorStore();
const router = useRouter();
const { drafts, editing } = storeToRefs(author);
const draftSearch = ref("");
const draftSort = ref<"updated" | "title">("updated");
const newDraftRequested = ref(false);
const newTitle = ref("Untitled Protocol");
const blankDraftTitle = ref("Untitled Protocol");
const exampleDraftCustomTitle = ref(exampleProtocolTitle(locale.value));
const newDraftFromExample = ref(false);
const newDraftStarter = computed(() =>
  newDraftFromExample.value ? "example" : "blank",
);
const normalizedNewTitle = computed(() => newTitle.value.trim());
const newTitleValid = computed(() => normalizedNewTitle.value.length > 0);
const forkImport = ref(false);
const fileOpenAvailable = typeof globalThis.File === "function" && typeof globalThis.FileReader === "function" && "files" in HTMLInputElement.prototype;
const filteredDrafts = computed(() => { const query = draftSearch.value.trim().toLocaleLowerCase(); return [...drafts.value].filter((draft) => { const title = "title" in draft && typeof draft.title === "string" ? draft.title : draft.draftId; return title.toLocaleLowerCase().includes(query); }).sort((left, right) => { if (draftSort.value === "updated") return right.updatedAt - left.updatedAt; const leftTitle = "title" in left && typeof left.title === "string" ? left.title : left.draftId; const rightTitle = "title" in right && typeof right.title === "string" ? right.title : right.draftId; return leftTitle.localeCompare(rightTitle); }); });
function requestNewDraft(): void { blankDraftTitle.value = locale.value === "zh-CN" ? "未命名实验规程" : "Untitled Protocol"; exampleDraftCustomTitle.value = exampleProtocolTitle(locale.value); newDraftFromExample.value = false; newTitle.value = blankDraftTitle.value; newDraftRequested.value = true; }
function setNewDraftFromExample(selected: boolean): void { if (newDraftFromExample.value) exampleDraftCustomTitle.value = newTitle.value; else blankDraftTitle.value = newTitle.value; newDraftFromExample.value = selected; newTitle.value = selected ? exampleDraftCustomTitle.value : blankDraftTitle.value; }
function setNewDraftStarter(value: unknown): void {
  if (value === "blank" || value === "example") {
    setNewDraftFromExample(value === "example");
  }
}
function selectInputText(event: FocusEvent): void {
  if (event.currentTarget instanceof HTMLInputElement) {
    event.currentTarget.select();
  }
}
async function createDraft(): Promise<void> { if (!newTitleValid.value) return; const protocol: Protocol = newDraftFromExample.value ? createBufferPreparationProtocol(locale.value, normalizedNewTitle.value) : { protocolId: crypto.randomUUID(), title: normalizedNewTitle.value, sections: [{ sectionId: crypto.randomUUID(), title: locale.value === "zh-CN" ? "规程步骤" : "Procedure", markdown: "", duration: { kind: "untimed" }, endAction: "wait" }], variables: [], formulaTestCases: [] }; await author.createDraft(protocol); newDraftRequested.value = false; const draftId = editing.value?.draftId; if (!draftId) { author.setStatus("Unsigned Draft created but could not be opened"); return; } emit("draft-opened"); await router.push({ name: "author-authoring", params: { draftId } }); author.setStatus("Unsigned Draft created"); }
async function restoreDraft(draftId: string): Promise<void> { await router.push({ name: "author-authoring", params: { draftId } }); }
async function importPublishedProtocol(event: Event): Promise<void> { const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return; try { await author.importPublishedProtocol(await file.text(), { fork: forkImport.value }); emit("draft-opened"); author.setStatus(forkImport.value ? "Published Protocol Forked as an Unsigned Draft" : "Published Protocol imported as an Unsigned Draft"); if (editing.value) await router.push({ name: "author-authoring", params: { draftId: editing.value.draftId } }); } catch (error) { author.setStatus(error instanceof Error ? error.message : "Published Protocol import failed"); } }
async function lock(): Promise<void> { try { await author.lock(); await router.push({ name: "author-access" }); author.setStatus("Author mode locked"); } catch (error) { author.setStatus(error instanceof Error ? `Lock failed: ${error.message}` : "Lock failed"); } }
</script>
<template>
<section
  class="draft-workspace mx-auto min-h-full w-full max-w-[76rem] p-[clamp(1rem,2.5vw,2rem)] max-[48rem]:p-3"
  aria-labelledby="drafts-title"
>
  <div class="section-heading">
    <div>
      <p class="eyebrow">{{ t("author.drafts.eyebrow") }}</p>
      <h2 id="drafts-title">{{ t("author.drafts.title") }}</h2>
      <p>{{ t("author.drafts.intro") }}</p>
    </div>
    <div class="actions">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        data-help-topic="author/unsigned-draft"
        @click="emit('help', 'author/unsigned-draft')"
      >
        <CircleHelp aria-hidden="true" />
        {{ t("help.learn.drafts") }}
      </Button>
      <Button type="button" @click="requestNewDraft">
        <FilePlus2 aria-hidden="true" />
        {{ t("author.action.newDraft") }}
      </Button>
      <Button type="button" variant="outline" @click="lock">
        <LockKeyhole aria-hidden="true" />
        {{ t("author.action.lock") }}
      </Button>
    </div>
  </div>
  <div class="draft-tools">
    <label>
      <span>{{ t("author.drafts.search") }}</span>
      <span class="input-with-icon">
        <Search aria-hidden="true" />
        <input v-model="draftSearch" type="search" :placeholder="t('author.drafts.searchPlaceholder')">
      </span>
    </label>
    <label>
      {{ t("author.drafts.sort") }}
      <select v-model="draftSort">
        <option value="updated">{{ t("author.drafts.recent") }}</option>
        <option value="title">{{ t("author.drafts.byTitle") }}</option>
      </select>
    </label>
  </div>
  <div v-if="filteredDrafts.length" class="draft-grid">
    <article
      v-for="draft in filteredDrafts"
      :key="draft.draftId"
      class="draft-card"
      :data-state="draft.status"
    >
      <div>
        <div class="draft-badges">
          <span class="status-badge" :data-status="draft.status">
            {{ draft.status === "quarantined" ? "Quarantined" : "Unsigned Draft" }}
          </span>
          <span v-if="draft.source" class="status-badge" data-status="available">
            {{ t("author.fork.badge") }}
          </span>
        </div>
        <h3>{{ draft.title ?? `Draft ${draft.draftId.slice(0, 8)}` }}</h3>
        <p class="mono">{{ draft.draftId }}</p>
        <details v-if="draft.source" class="draft-source">
          <summary>
            {{ t("author.fork.from", {
              fingerprint: draft.source.fingerprint.slice(0, 16),
            }) }}
          </summary>
          <dl>
            <dt>{{ t("reader.integrity.fingerprint") }}</dt>
            <dd class="mono">{{ draft.source.fingerprint }}</dd>
            <dt>{{ t("reader.integrity.authorKeyId") }}</dt>
            <dd class="mono">{{ draft.source.keyId }}</dd>
          </dl>
        </details>
        <p>Updated {{ new Date(draft.updatedAt).toLocaleString() }}</p>
      </div>
      <Button
        type="button"
        variant="outline"
        :disabled="draft.status === 'quarantined'"
        @click="restoreDraft(draft.draftId)"
      >
        {{ t("author.action.openDraft") }}
      </Button>
      <p v-if="draft.status === 'quarantined'" role="alert">
        Authentication failed; encrypted ciphertext is quarantined and preserved.
      </p>
    </article>
  </div>
  <div v-else class="empty-state">
    <Files aria-hidden="true" />
    <h3>{{ t("author.drafts.empty") }}</h3>
    <p>{{ t("author.drafts.emptyBody") }}</p>
    <Button type="button" @click="requestNewDraft">{{ t("author.action.newDraft") }}</Button>
  </div>
  <fieldset class="import-panel">
    <legend>Import Published Protocol</legend>
    <label>
      Published Protocol HTML
      <input
        type="file"
        accept=".html,text/html"
        :disabled="!fileOpenAvailable"
        @change="importPublishedProtocol"
      >
    </label>
    <p v-if="!fileOpenAvailable" role="alert">
      File opening is unavailable in this browser.
    </p>
    <label class="check-label">
      <input v-model="forkImport" type="checkbox">
      Explicitly Fork under this Author Key
    </label>
  </fieldset>
  <div class="sr-only">
    <Button type="button" @click="createDraft">Create Unsigned Draft</Button>
    <Button type="button" variant="outline" @click="lock">
      Lock Author Mode
    </Button>
  </div>
</section>
  <AccessibleDialog
    v-if="newDraftRequested"
    id="new-draft-dialog"
    :title="t('author.action.newDraft')"
    :confirm-label="t('author.action.createDraft')"
    :cancel-label="t('common.cancel')"
    :confirm-disabled="!newTitleValid"
    @confirm="createDraft"
    @cancel="newDraftRequested = false"
  >
    <div class="new-draft-form">
      <p class="new-draft-intro">{{ t("author.draft.dialogIntro") }}</p>
      <Field :data-invalid="!newTitleValid">
        <FieldLabel for="new-draft-title">
          {{ t("author.draft.titleLabel") }}
        </FieldLabel>
        <Input
          id="new-draft-title"
          v-model="newTitle"
          class="new-draft-title-input"
          :aria-invalid="!newTitleValid"
          aria-describedby="new-draft-title-help new-draft-title-error"
          @focus="selectInputText"
        />
        <FieldDescription id="new-draft-title-help">
          {{ t("author.draft.titleHelp") }}
        </FieldDescription>
        <FieldError v-if="!newTitleValid" id="new-draft-title-error">
          {{ t("author.draft.titleRequired") }}
        </FieldError>
      </Field>

      <fieldset class="new-draft-starter">
        <legend>{{ t("author.draft.startingPoint") }}</legend>
        <RadioGroup
          :model-value="newDraftStarter"
          @update:model-value="setNewDraftStarter"
        >
          <Label
            for="new-draft-blank"
            class="new-draft-option"
            :data-selected="newDraftStarter === 'blank'"
          >
            <span class="new-draft-option-icon">
              <FileText aria-hidden="true" />
            </span>
            <span class="new-draft-option-copy">
              <strong>{{ t("author.draft.blankTitle") }}</strong>
              <span>{{ t("author.draft.blankDescription") }}</span>
            </span>
            <RadioGroupItem id="new-draft-blank" value="blank" />
          </Label>
          <Label
            for="new-draft-example"
            class="new-draft-option"
            :data-selected="newDraftStarter === 'example'"
          >
            <span class="new-draft-option-icon">
              <FlaskConical aria-hidden="true" />
            </span>
            <span class="new-draft-option-copy">
              <strong>{{ t("author.draft.exampleTitle") }}</strong>
              <span>{{ t("author.draft.exampleDescription") }}</span>
            </span>
            <RadioGroupItem id="new-draft-example" value="example" />
          </Label>
        </RadioGroup>
      </fieldset>
    </div>
  </AccessibleDialog>
</template>
