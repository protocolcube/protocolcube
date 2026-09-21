<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { storeToRefs } from "pinia";
import { CircleHelp, Play } from "@lucide/vue";
import { useAuthorStore } from "@/features/author/store";
import { canSavePublishedProtocol, createBrowserPublicationSaveAdapter } from "@/features/author/adapters/publication-save-adapter";
import AccessibleDialog from "@/components/shared/AccessibleDialog.vue";
import { Button } from "@/components/ui/button";
import { t } from "@/locales";
const props = defineProps<{ hasUnsavedChanges: boolean }>();
const emit = defineEmits<{ help: [topic: string]; preview: []; "publication-failure": [error: Error] }>();
const author = useAuthorStore();
const { editing, inspection, recoverySnapshots } = storeToRefs(author);
const publicationFileName = ref("protocol.html");
const publicationResult = ref<Awaited<ReturnType<typeof author.publishCurrentDraft>>>();
const publicationConfirmation = ref(false);
const publicationSaveAvailable = canSavePublishedProtocol(window);
const bodyHeadingWarningCount = computed(() => editing.value?.protocol.sections.filter((candidate) => /^(?:#|##)\s+\S/m.test(candidate.markdown)).length ?? 0);
async function copyPublicationValue(label: string, value: string): Promise<void> { try { await navigator.clipboard.writeText(value); author.setStatus(`${label} copied`); } catch (error) { author.setStatus(error instanceof Error ? `Copy failed: ${error.message}` : "Copy failed"); } }
async function restoreRecoverySnapshot(index: number): Promise<void> { try { await author.restoreRecoverySnapshot(index); author.setStatus("Recovery snapshot restored"); } catch (error) { author.setStatus(error instanceof Error ? error.message : "Snapshot restore failed"); } }
function requestPublication(): void { if (!canSavePublishedProtocol(window)) { author.setStatus("Explicit file saving is unavailable in this browser"); return; } publicationConfirmation.value = true; }
async function publishProtocol(): Promise<void> { publicationConfirmation.value = false; await nextTick(); try { const template = document.documentElement.cloneNode(true); if (!(template instanceof HTMLElement)) throw new Error("Application HTML template is unavailable"); const mountPoint = template.querySelector("#app"); if (!mountPoint) throw new Error("Application mount point is unavailable"); mountPoint.replaceChildren(); const body = template.querySelector("body"); if (!body) throw new Error("Application body is unavailable"); for (const child of [...body.children]) if (child !== mountPoint && child.tagName !== "SCRIPT") child.remove(); publicationResult.value = await author.publishCurrentDraft({ applicationHtml: `<!doctype html>\n${template.outerHTML}`, appVersion: "0.0.0", fileName: publicationFileName.value, saveAdapter: createBrowserPublicationSaveAdapter(window) }); await author.refreshDrafts(); author.setStatus("Published Protocol and checksum saved"); } catch (error) { if (error instanceof Error) emit("publication-failure", error); else author.setStatus("Publication failed"); } }
</script>
<template>
<section
  class="publish-workspace mx-auto min-h-full w-full max-w-[76rem] p-[clamp(1rem,2.5vw,2rem)] max-[48rem]:p-3"
  aria-labelledby="publish-workspace-title"
>
  <div class="section-heading">
    <div>
      <p class="eyebrow">{{ t("author.publish.eyebrow") }}</p>
      <h2 id="publish-workspace-title">{{ t("author.publish.title") }}</h2>
      <p>{{ t("author.publish.intro") }}</p>
    </div>
    <div class="actions">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        data-help-topic="author/author-preview"
        @click="emit('help', 'author/author-preview')"
      >
        <CircleHelp aria-hidden="true" />
        {{ t("help.learn.preview") }}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        data-help-topic="author/publish-recovery"
        @click="emit('help', 'author/publish-recovery')"
      >
        <CircleHelp aria-hidden="true" />
        {{ t("help.learn.publish") }}
      </Button>
      <Button type="button" variant="outline" @click="emit('preview')">
        <Play aria-hidden="true" />
        {{ t("author.publish.preview") }}
      </Button>
    </div>
  </div>
  <div v-if="editing" class="publish-grid">
    <article class="publish-step">
      <span>1</span>
      <h3>Readiness</h3>
      <p
        class="status-badge"
        :data-status="inspection?.playable ? 'available' : 'quarantined'"
      >
        {{ inspection?.playable ? "Playable" : "Blocked" }}
      </p>
      <ul v-if="inspection?.errors.length ?? 0" role="alert">
        <li v-for="error in inspection?.errors ?? []" :key="`${error.path}:${error.code}`">
          {{ error.message }}
        </li>
      </ul>
      <p v-else>Schema, formulas, Formula Test Cases, and resource limits pass.</p>
      <p v-if="bodyHeadingWarningCount" class="editor-warning" role="status">
        {{ bodyHeadingWarningCount }} Section{{
          bodyHeadingWarningCount === 1 ? "" : "s"
        }}
        contain body Heading 1 or Heading 2 blocks. Publication is allowed,
        but Heading 3-6 better preserves the Protocol hierarchy.
      </p>
    </article>
    <article class="publish-step">
      <span>2</span>
      <h3>Output</h3>
      <label>
        Published HTML filename
        <input v-model="publicationFileName">
      </label>
      <p>{{ publicationSaveAvailable ? "File saving is available." : "File saving is unavailable." }}</p>
    </article>
    <article class="publish-step">
      <span>3</span>
      <h3>Publish</h3>
      <p>Signs the current Protocol and saves the HTML with its `.sha256` checksum.</p>
      <Button
        type="button"
        :disabled="props.hasUnsavedChanges || !inspection?.playable"
        @click="requestPublication"
      >
        Publish Protocol
      </Button>
      <p v-if="props.hasUnsavedChanges">Save Unsigned Draft before publishing.</p>
    </article>
  </div>
  <article v-if="publicationResult" class="publication-result" aria-labelledby="publication-title">
    <h2 id="publication-title">Publication Complete</h2>
    <dl>
      <dt>Protocol Fingerprint</dt>
      <dd class="copy-value">
        <span class="mono">{{ publicationResult.protocolFingerprint }}</span>
        <Button
          type="button"
          size="xs"
          variant="outline"
          @click="copyPublicationValue('Protocol Fingerprint', publicationResult.protocolFingerprint)"
        >
          Copy
        </Button>
      </dd>
      <dt>Key ID</dt>
      <dd class="copy-value">
        <span class="mono">{{ publicationResult.keyId }}</span>
        <Button
          type="button"
          size="xs"
          variant="outline"
          @click="copyPublicationValue('Key ID', publicationResult.keyId)"
        >
          Copy
        </Button>
      </dd>
      <dt>Whole-file SHA-256</dt>
      <dd class="copy-value">
        <span class="mono">{{ publicationResult.wholeFileSha256 }}</span>
        <Button
          type="button"
          size="xs"
          variant="outline"
          @click="copyPublicationValue('Whole-file SHA-256', publicationResult.wholeFileSha256)"
        >
          Copy
        </Button>
      </dd>
    </dl>
  </article>
  <article v-if="editing" class="recovery-panel" aria-labelledby="recovery-title">
    <h3 id="recovery-title">Recovery Snapshots</h3>
    <p v-if="recoverySnapshots.length === 0">No prior snapshots.</p>
    <div v-else class="actions">
      <Button
        v-for="item in recoverySnapshots"
        :key="item.index"
        type="button"
        variant="outline"
        @click="restoreRecoverySnapshot(item.index)"
      >
        Restore snapshot {{ item.index + 1 }}
      </Button>
    </div>
  </article>
</section>
  <AccessibleDialog v-if="publicationConfirmation" id="publication-dialog" title="Publish Protocol files?" confirm-label="Continue to File Picker" @confirm="publishProtocol" @cancel="publicationConfirmation = false">
    <p>Prefer saving under a new filename. Overwriting an existing Published Protocol is not automatically backed up.</p>
  </AccessibleDialog>
</template>
