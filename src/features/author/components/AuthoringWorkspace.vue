<script setup lang="ts">
import { EditorContent, useEditor } from "@tiptap/vue-3";
import type { Editor } from "@tiptap/core";
import { Markdown } from "@tiptap/markdown";
import {
  Bold as BoldIcon, Braces, CircleHelp, Heading3, Heading4, Heading5,
  Heading6, ImagePlus, Italic as ItalicIcon, List, ListOrdered, ListTodo,
  MoreHorizontal, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen,
  Pilcrow, Plus, Redo2, Settings2, Table2, Undo2, X,
} from "@lucide/vue";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useAuthorStore } from "@/features/author/store";
import { ProtocolCore, type FormulaTestCase, type VariableDefinition } from "@/domain/protocol";
import AccessibleDialog from "@/components/shared/AccessibleDialog.vue";
import FormulaAssistant from "@/features/author/components/FormulaAssistant.vue";
import ResizableSeparator from "@/features/author/components/ResizableSeparator.vue";
import VariableDependencyGraph from "@/features/author/components/VariableDependencyGraph.vue";
import { t } from "@/locales";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Switch } from "@/components/ui/switch";
import { createProtocolContentExtensions } from "@/shared/protocol-markdown";
import { authoringDirty, markAuthoringEditPending, savedAuthoringCanonical } from "@/features/author/components/authoring-session-state";

const emit = defineEmits<{ help: [topic: string]; preview: [] }>();
const author = useAuthorStore();
const { editing, snapshot } = storeToRefs(author);
type AuthorPanel = "summary" | "details" | "variables" | "formula-tests";
type BodyBlockType = "paragraph" | "3" | "4" | "5" | "6";
const authorPanels = computed(() => [
  { id: "summary" as const, label: t("author.workspace.summary") },
  { id: "details" as const, label: t("author.workspace.details") },
  { id: "variables" as const, label: t("author.workspace.variables") },
  { id: "formula-tests" as const, label: t("author.workspace.formulaTests") },
]);
const finalMarkdown = ref("");
let synchronizingEditorContent = false;
const selectedSectionId = ref("");
const activeAuthorPanel = ref<AuthorPanel>("details");
const selectedVariableId = ref("");
const selectedTestCaseId = ref("");
const variableView = ref<"table" | "graph">("table");
const outlineOpen = ref(true);
const inspectorOpen = ref(true);
const outlineWidth = ref(readStoredPaneWidth("outline", 248));
const inspectorWidth = ref(readStoredPaneWidth("inspector", 304));
const draggedSectionId = ref<string>();
const deleteSectionRequested = ref<string>();
const outlineHeading = ref<HTMLElement>();
const inspectorHeading = ref<HTMLElement>();
const sectionTitleInput = ref<HTMLInputElement>();
const outlineFocusIndex = ref(0);
const inspectorFocusIndex = ref(0);
const variableId = ref("");
const variableLabel = ref("");
const variableType = ref<"text" | "numeric" | "boolean" | "enum" | "derived">("text");
const variableFormula = ref("");
const variableOptions = ref("");
const variableFormOpen = ref(false);
const testCaseName = ref("");
const testCaseDescription = ref("");
const testCaseFormOpen = ref(false);
const testInputValues = ref<Record<string, string | boolean>>({});
const testExpectedValues = ref<Record<string, string>>({});
const remoteImageUrl = ref("");
const remoteImageConfirmation = ref(false);
const linkPopoverOpen = ref(false);
const blockTypePopoverOpen = ref(false);
const variablePopoverOpen = ref(false);
const linkUrl = ref("");
const currentBlockType = ref<BodyBlockType>("paragraph");
const pendingLinkHistory = ref<{ before: string; after: string }>();
const redoLinkHistory = ref<{ before: string; after: string }>();
const section = computed(() => editing.value?.protocol.sections.find((candidate) => candidate.sectionId === selectedSectionId.value) ?? editing.value?.protocol.sections[0]);
const selectedVariable = computed(() => editing.value?.protocol.variables.find((variable) => variable.id === selectedVariableId.value));
const selectedTestCase = computed(() => editing.value?.protocol.formulaTestCases.find((testCase) => testCase.testCaseId === selectedTestCaseId.value));
const inputVariableDefinitions = computed(() => editing.value?.protocol.variables.filter((variable) => variable.kind === "input") ?? []);
const derivedVariableDefinitions = computed(() => editing.value?.protocol.variables.filter((variable) => variable.kind === "derived") ?? []);
const dependencyGraph = computed(() => editing.value ? ProtocolCore.inspectVariableDependencyGraph(editing.value.protocol) : { nodes: [], edges: [], diagnostics: [] });
const headingHierarchyWarning = computed(() => /^(?:#|##)\s+\S/m.test(section.value?.markdown ?? ""));
const taskItemCount = computed(() => ProtocolCore.countTaskItems(section.value?.markdown ?? ""));
const hasUnsavedChanges = computed(() => editing.value !== undefined && (savedAuthoringCanonical.value === undefined || ProtocolCore.canonicalizeProtocol(editing.value.protocol) !== savedAuthoringCanonical.value));
const currentBlockTypeLabel = computed(() => currentBlockType.value === "paragraph" ? "Paragraph" : `Heading ${currentBlockType.value}`);
const currentBlockTypeIcon = computed(() => ({
  paragraph: Pilcrow,
  "3": Heading3,
  "4": Heading4,
  "5": Heading5,
  "6": Heading6,
})[currentBlockType.value]);
watch(hasUnsavedChanges, (dirty) => { authoringDirty.value = dirty; }, { immediate: true });
watch(() => editing.value?.draftId, () => { selectedSectionId.value = editing.value?.protocol.sections[0]?.sectionId ?? ""; }, { immediate: true });
let compactPaneQuery: MediaQueryList | undefined;
function closePanesForCompactWorkspace(event: MediaQueryListEvent | MediaQueryList): void {
  if (!event.matches) return;
  outlineOpen.value = false;
  inspectorOpen.value = false;
}
onMounted(() => {
  compactPaneQuery = window.matchMedia("(max-width: 63.999rem)");
  closePanesForCompactWorkspace(compactPaneQuery);
  compactPaneQuery.addEventListener("change", closePanesForCompactWorkspace);
});
onBeforeUnmount(() => compactPaneQuery?.removeEventListener("change", closePanesForCompactWorkspace));
function readStoredPaneWidth(name: string, fallback: number): number { try { const storedValue = localStorage.getItem(`protocol-box:pane:${name}`); if (storedValue === null) return fallback; const value = Number(storedValue); return Number.isFinite(value) ? value : fallback; } catch { return fallback; } }
function updatePaneWidth(pane: "outline" | "inspector", delta: number): void { const target = pane === "outline" ? outlineWidth : inspectorWidth; target.value = Math.min(420, Math.max(200, target.value + delta * (pane === "outline" ? 1 : -1))); try { localStorage.setItem(`protocol-box:pane:${pane}`, String(target.value)); } catch { /* Pane persistence is optional. */ } }
function resetPaneWidth(pane: "outline" | "inspector"): void { const value = pane === "outline" ? 248 : 304; if (pane === "outline") outlineWidth.value = value; else inspectorWidth.value = value; try { localStorage.removeItem(`protocol-box:pane:${pane}`); } catch { /* Pane persistence is optional. */ } }
const editor = useEditor({ extensions: [...createProtocolContentExtensions(), Markdown], content: "", contentType: "markdown", editorProps: { transformPastedHTML: (html) => author.sanitizePastedHtml(html) ?? "" }, onUpdate: ({ editor: currentEditor }) => { if (synchronizingEditorContent || !section.value) return; author.updateSection(section.value.sectionId, { markdown: currentEditor.getMarkdown().trimEnd() }); finalMarkdown.value = section.value.markdown; }, onTransaction: ({ editor: currentEditor }) => { currentBlockType.value = getCurrentBlockType(currentEditor); } });
function getCurrentBlockType(currentEditor: Editor): BodyBlockType { const currentNode = currentEditor.state.selection.$from.parent; const level = currentNode.type.name === "heading" ? currentNode.attrs.level : undefined; return level === 3 || level === 4 || level === 5 || level === 6 ? String(level) as BodyBlockType : "paragraph"; }
function synchronizeEditorContent(): void { const markdown = section.value?.markdown ?? ""; finalMarkdown.value = markdown; synchronizingEditorContent = true; editor.value?.commands.setContent(markdown, { contentType: "markdown", emitUpdate: false }); synchronizingEditorContent = false; }
watch(() => section.value?.sectionId, synchronizeEditorContent);
watch(editor, (currentEditor) => { if (currentEditor) synchronizeEditorContent(); }, { flush: "post" });
function toggleBold(): void { editor.value?.chain().focus().toggleBold().run(); }
function toggleItalic(): void { editor.value?.chain().focus().toggleItalic().run(); }
function toggleBulletList(): void { editor.value?.chain().focus().toggleBulletList().run(); }
function toggleOrderedList(): void { editor.value?.chain().focus().toggleOrderedList().run(); }
function toggleTaskList(): void { editor.value?.chain().focus().toggleTaskList().run(); }
function insertTable(): void { editor.value?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); }
function undoEditorChange(): void { const currentEditor = editor.value; if (!currentEditor) return; const href = currentEditor.getAttributes("link").href; if (typeof href === "string" && currentEditor.isActive("link")) { redoLinkHistory.value = { before: "", after: href }; pendingLinkHistory.value = undefined; currentEditor.chain().focus().selectAll().unsetLink().run(); return; } if (pendingLinkHistory.value) { const history = pendingLinkHistory.value; redoLinkHistory.value = history; pendingLinkHistory.value = undefined; currentEditor.commands.setContent(history.before, { contentType: "markdown" }); currentEditor.commands.focus(); return; } currentEditor.chain().focus().undo().run(); }
function redoEditorChange(): void { const currentEditor = editor.value; if (!currentEditor) return; if (redoLinkHistory.value) { const history = redoLinkHistory.value; redoLinkHistory.value = undefined; if (history.before === "") { currentEditor.chain().focus().selectAll().setLink({ href: history.after }).run(); return; } pendingLinkHistory.value = history; currentEditor.commands.setContent(history.after, { contentType: "markdown" }); currentEditor.commands.focus(); return; } currentEditor.chain().focus().redo().run(); }
function setBlockType(value: BodyBlockType): void { const chain = editor.value?.chain().focus(); if (!chain) return; value === "paragraph" ? chain.setParagraph().run() : chain.setHeading({ level: Number(value) as 3 | 4 | 5 | 6 }).run(); blockTypePopoverOpen.value = false; }
function insertVariable(id: string): void { editor.value?.chain().focus().insertContent(`{{ ${id} }}`).run(); variablePopoverOpen.value = false; }
function focusEditorEnd(event: MouseEvent): void { if (event.target instanceof Element && event.target.closest(".tiptap")) return; const currentEditor = editor.value; if (!currentEditor) return; const finalNode = currentEditor.state.doc.lastChild; if (finalNode?.type.name !== "paragraph" || finalNode.content.size > 0) currentEditor.commands.insertContentAt(currentEditor.state.doc.content.size, { type: "paragraph" }); currentEditor.commands.focus("end"); }
function requestLink(): void { const href = editor.value?.getAttributes("link").href; linkUrl.value = typeof href === "string" ? href : ""; linkPopoverOpen.value = true; }
function applyLink(): void { const before = editor.value?.getMarkdown() ?? ""; const href = linkUrl.value.trim(); if (!/^(https?:\/\/|mailto:)/i.test(href)) { author.setStatus("Link URL must use HTTP, HTTPS, or mailto"); return; } const currentEditor = editor.value; if (!currentEditor) return; if (currentEditor.isActive("link")) currentEditor.chain().focus().extendMarkRange("link").setLink({ href }).run(); else if (currentEditor.state.selection.empty) currentEditor.chain().focus().insertContent({ type: "text", text: href, marks: [{ type: "link", attrs: { href } }] }).run(); else currentEditor.chain().focus().setLink({ href }).run(); pendingLinkHistory.value = { before, after: currentEditor.getMarkdown() }; redoLinkHistory.value = undefined; linkPopoverOpen.value = false; }
function updateLinkPopover(open: boolean): void { if (open) requestLink(); else linkPopoverOpen.value = false; }
function openHelp(topic: string): void { emit("help", topic); }
function selectAuthorPanel(panel: AuthorPanel): void { activeAuthorPanel.value = panel; }
function selectVariable(id: string): void { selectedVariableId.value = id; activeAuthorPanel.value = "variables"; }
function selectTestCase(id: string): void { selectedTestCaseId.value = id; activeAuthorPanel.value = "formula-tests"; }
async function addSection(): Promise<void> { if (!editing.value) return; const currentIndex = editing.value.protocol.sections.findIndex((candidate) => candidate.sectionId === selectedSectionId.value); const sectionId = author.addSection({ title: "Untitled Section", markdown: "", duration: { kind: "untimed" }, endAction: "wait" }); if (currentIndex >= 0) author.reorderSection(sectionId, currentIndex + 1); selectedSectionId.value = sectionId; await nextTick(); sectionTitleInput.value?.scrollIntoView({ block: "center" }); sectionTitleInput.value?.focus(); sectionTitleInput.value?.select(); }
function copySection(sectionId = section.value?.sectionId): void { if (!editing.value || !sectionId) return; const sourceIndex = editing.value.protocol.sections.findIndex((candidate) => candidate.sectionId === sectionId); const copyId = author.copySection(sectionId); if (sourceIndex >= 0) author.reorderSection(copyId, sourceIndex + 1); selectedSectionId.value = copyId; }
function requestDeleteSection(id = section.value?.sectionId): void { if (id) deleteSectionRequested.value = id; }
function confirmDeleteSection(): void { if (!editing.value || !deleteSectionRequested.value) return; const id = deleteSectionRequested.value; const index = editing.value.protocol.sections.findIndex((candidate) => candidate.sectionId === id); if (editing.value.protocol.sections.length === 1) { const replacementId = author.addSection({ title: "Untitled Section", markdown: "", duration: { kind: "untimed" }, endAction: "wait" }); author.removeSection(id); selectedSectionId.value = replacementId; } else { author.removeSection(id); selectedSectionId.value = editing.value.protocol.sections[Math.min(Math.max(index, 0), editing.value.protocol.sections.length - 1)]?.sectionId ?? ""; } deleteSectionRequested.value = undefined; }
function paneFocusableElements(selector: string): HTMLElement[] { return Array.from(document.querySelectorAll<HTMLElement>(`${selector} button:not([disabled]), ${selector} input:not([disabled]), ${selector} select:not([disabled]), ${selector} textarea:not([disabled]), ${selector} [tabindex]:not([tabindex="-1"])`)); }
function rememberPaneFocus(event: FocusEvent, pane: "outline" | "inspector"): void { if (!(event.target instanceof HTMLElement)) return; const index = paneFocusableElements(pane === "outline" ? ".protocol-outline" : ".context-inspector").indexOf(event.target); if (index >= 0) { if (pane === "outline") outlineFocusIndex.value = index; else inspectorFocusIndex.value = index; } }
async function setOutlineOpen(open: boolean): Promise<void> { outlineOpen.value = open; if (open) { await nextTick(); (paneFocusableElements(".protocol-outline")[outlineFocusIndex.value] ?? outlineHeading.value)?.focus(); } }
async function setInspectorOpen(open: boolean): Promise<void> { inspectorOpen.value = open; if (open) { await nextTick(); (paneFocusableElements(".context-inspector")[inspectorFocusIndex.value] ?? inspectorHeading.value)?.focus(); } }
function moveSection(offset: number): void { if (!section.value || !editing.value) return; const index = editing.value.protocol.sections.findIndex((candidate) => candidate.sectionId === section.value?.sectionId); author.reorderSection(section.value.sectionId, Math.max(0, Math.min(editing.value.protocol.sections.length - 1, index + offset))); }
function dropSection(targetSectionId: string): void { if (!editing.value || !draggedSectionId.value) return; const targetIndex = editing.value.protocol.sections.findIndex((candidate) => candidate.sectionId === targetSectionId); if (targetIndex < 0) return; author.reorderSection(draggedSectionId.value, targetIndex); author.setStatus(`Section moved to position ${targetIndex + 1}`); draggedSectionId.value = undefined; }
function updateSectionDuration(kind: "untimed" | "fixed" | "derived", value = ""): void { if (!section.value) return; author.updateSection(section.value.sectionId, { duration: kind === "fixed" ? { kind, seconds: value || "0" } : kind === "derived" ? { kind, variableId: value } : { kind } }); }
function updateSectionEndAction(endAction: "wait" | "advance"): void { if (section.value) author.updateSection(section.value.sectionId, { endAction }); }
function updateSectionCompletionRequirement(enabled: boolean): void {
  if (!section.value || (enabled && taskItemCount.value === 0)) return;
  author.updateSection(section.value.sectionId, {
    completionRequirement: enabled ? "all-task-items" : undefined,
  });
}
function openVariableForm(): void { variableFormOpen.value = true; }
function closeVariableForm(): void {
  variableFormOpen.value = false;
  variableId.value = "";
  variableLabel.value = "";
  variableType.value = "text";
  variableFormula.value = "";
  variableOptions.value = "";
}
function addVariable(): void { if (!editing.value || !variableId.value || !variableLabel.value) { author.setStatus("Variable ID and label are required"); return; } let variable: VariableDefinition; if (variableType.value === "derived") variable = { kind: "derived", id: variableId.value, label: variableLabel.value, valueType: "numeric", formula: variableFormula.value, precision: 2, roundingMode: "half-even" }; else if (variableType.value === "enum") variable = { kind: "input", id: variableId.value, label: variableLabel.value, valueType: "enum", options: variableOptions.value.split(",").map((option) => option.trim()).filter(Boolean) }; else if (variableType.value === "boolean") variable = { kind: "input", id: variableId.value, label: variableLabel.value, valueType: "boolean" }; else if (variableType.value === "numeric") variable = { kind: "input", id: variableId.value, label: variableLabel.value, valueType: "numeric" }; else variable = { kind: "input", id: variableId.value, label: variableLabel.value, valueType: "text" }; author.replaceVariables([...editing.value.protocol.variables, variable]); selectedVariableId.value = variable.id; closeVariableForm(); }
function removeVariable(id: string): void { if (editing.value) author.replaceVariables(editing.value.protocol.variables.filter((variable) => variable.id !== id)); }
function updateVariable(id: string, update: (variable: VariableDefinition) => VariableDefinition): void { if (editing.value) author.replaceVariables(editing.value.protocol.variables.map((variable) => variable.id === id ? update(variable) : variable)); }
function updateVariableLabel(id: string, label: string): void { updateVariable(id, (variable) => ({ ...variable, label })); }
function updateVariableDetail(id: string, value: string | boolean): void { updateVariable(id, (variable) => variable.kind === "derived" ? { ...variable, formula: String(value) } : variable.valueType === "enum" ? { ...variable, options: String(value).split(",").map((option) => option.trim()).filter(Boolean) } : variable.valueType === "boolean" ? { ...variable, defaultValue: Boolean(value) } : { ...variable, defaultValue: String(value) }); }
function updateFormulaTestCase(id: string, update: Partial<FormulaTestCase>): void { if (editing.value) author.replaceFormulaTestCases(editing.value.protocol.formulaTestCases.map((testCase) => testCase.testCaseId === id ? { ...testCase, ...update } : testCase)); }
function removeFormulaTestCase(id: string): void { if (editing.value) author.replaceFormulaTestCases(editing.value.protocol.formulaTestCases.filter((testCase) => testCase.testCaseId !== id)); }
function initialTestInputValue(variable: Extract<VariableDefinition, { kind: "input" }>): string | boolean {
  if (variable.valueType === "boolean") return variable.defaultValue ?? false;
  if (variable.valueType === "enum") return variable.defaultValue ?? variable.options[0] ?? "";
  return variable.defaultValue ?? "";
}
function openFormulaTestCaseForm(): void {
  testInputValues.value = Object.fromEntries(
    inputVariableDefinitions.value.map((variable) => [variable.id, initialTestInputValue(variable)]),
  );
  testExpectedValues.value = Object.fromEntries(
    derivedVariableDefinitions.value.map((variable) => [variable.id, ""]),
  );
  testCaseFormOpen.value = true;
}
function closeFormulaTestCaseForm(): void {
  testCaseFormOpen.value = false;
  testCaseName.value = "";
  testCaseDescription.value = "";
  testInputValues.value = {};
  testExpectedValues.value = {};
}
function updateTestBooleanInput(id: string, value: string): void {
  testInputValues.value[id] = value === "true";
}
function addFormulaTestCase(): void {
  if (!editing.value || !testCaseName.value) {
    author.setStatus("Formula Test Case title is required");
    return;
  }
  const description = testCaseDescription.value.trim();
  const testCase: FormulaTestCase = {
    testCaseId: crypto.randomUUID(),
    name: testCaseName.value,
    ...(description ? { description } : {}),
    inputValues: { ...testInputValues.value },
    expectedDerivedValues: { ...testExpectedValues.value },
    precision: 2,
    roundingMode: "half-even",
  };
  author.replaceFormulaTestCases([...editing.value.protocol.formulaTestCases, testCase]);
  selectedTestCaseId.value = testCase.testCaseId;
  closeFormulaTestCaseForm();
}
async function importLocalImage(event: Event): Promise<void> { const file = (event.target as HTMLInputElement).files?.[0]; if (!file || !editor.value) return; try { if (!["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(file.type)) throw new Error("Unsupported image type"); let bytes = new Uint8Array(await file.arrayBuffer()); let decodeSource: Blob = file; if (file.type === "image/svg+xml") { const sanitized = author.sanitizeSvg(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); bytes = new TextEncoder().encode(sanitized); decodeSource = new Blob([bytes], { type: file.type }); } const bitmap = await createImageBitmap(decodeSource); const source = author.importImage({ bytes, mimeType: file.type as "image/png" | "image/jpeg" | "image/webp" | "image/svg+xml", width: bitmap.width, height: bitmap.height }); bitmap.close(); editor.value.chain().focus().setImage({ src: source }).run(); author.setStatus("Image embedded"); } catch (error) { author.setStatus(error instanceof Error ? error.message : "Image import failed"); } }
function requestRemoteImageImport(): void { if (editor.value && remoteImageUrl.value) remoteImageConfirmation.value = true; }
async function importRemoteImage(): Promise<void> { if (!editor.value || !remoteImageUrl.value) return; remoteImageConfirmation.value = false; try { const source = await author.importRemoteImage({ url: remoteImageUrl.value, confirmed: true }); editor.value.chain().focus().setImage({ src: source }).run(); remoteImageUrl.value = ""; } catch (error) { author.setStatus(error instanceof Error ? error.message : "Remote image import failed"); } }
function updateTitle(event: Event): void { if (editing.value) { authoringDirty.value = true; markAuthoringEditPending(); author.updateProtocol({ ...editing.value.protocol, title: (event.target as HTMLInputElement).value }); } }
</script>

<template>
<section
  class="authoring-workspace"
  aria-labelledby="editor-title"
>
  <div class="workspace-heading">
    <div class="workspace-title-stack">
      <p id="editor-title" class="eyebrow">
        {{ t("author.workspace.title") }}
      </p>
      <h1 class="workspace-protocol-title">
        <label>
          <span class="sr-only">Protocol title</span>
          <input
            :value="editing?.protocol.title"
            @input="updateTitle"
          >
        </label>
      </h1>
    </div>
    <div class="pane-actions">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        :aria-label="outlineOpen ? 'Close Outline' : 'Open Outline'"
        :aria-expanded="outlineOpen"
        title="Toggle Outline (B)"
        @click="setOutlineOpen(!outlineOpen)"
      >
        <PanelLeftClose v-if="outlineOpen" aria-hidden="true" />
        <PanelLeftOpen v-else aria-hidden="true" />
        {{ t("author.workspace.outline") }}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        :aria-label="inspectorOpen ? 'Close Inspector' : 'Open Inspector'"
        :aria-expanded="inspectorOpen"
        title="Toggle Inspector (I)"
        @click="setInspectorOpen(!inspectorOpen)"
      >
        <PanelRightClose v-if="inspectorOpen" aria-hidden="true" />
        <PanelRightOpen v-else aria-hidden="true" />
        {{ t("author.workspace.inspector") }}
      </Button>
    </div>
  </div>
  <p v-if="snapshot.mode === 'save-failed'" class="blocking-message" role="alert">
    Save failed. Retry Save Unsigned Draft before locking or closing.
  </p>
  <div
    class="workbench-grid"
    :style="{
      '--outline-width': `${outlineWidth}px`,
      '--inspector-width': `${inspectorWidth}px`,
    }"
  >
    <aside
      v-if="outlineOpen"
      class="protocol-outline"
      @focusin="rememberPaneFocus($event, 'outline')"
    >
      <div class="pane-title">
        <span
          ref="outlineHeading"
          tabindex="-1"
        >{{ t("author.workspace.protocolOutline") }}</span>
        <span class="status-badge">Unsigned</span>
      </div>
      <ScrollArea class="outline-scroll-area">
        <nav aria-label="Protocol structure" class="structure-tree">
          <section class="tree-section">
          <div class="tree-group-heading">
            <span>
              {{ t("author.workspace.sections") }}
              <small>{{ editing?.protocol.sections.length }}</small>
            </span>
          </div>
          <nav aria-label="Protocol Sections" class="tree-children">
            <div
              v-for="(candidate, candidateIndex) in editing?.protocol.sections"
              :key="candidate.sectionId"
              class="tree-node-row"
              draggable="true"
              @dragstart="draggedSectionId = candidate.sectionId"
              @dragend="draggedSectionId = undefined"
              @dragover.prevent
              @drop="dropSection(candidate.sectionId)"
            >
              <Button
                type="button"
                :variant="
                  candidate.sectionId === section?.sectionId
                    ? 'secondary'
                    : 'ghost'
                "
                class="tree-node"
                @click="
                  selectedSectionId = candidate.sectionId;
                  selectAuthorPanel('details')
                "
                @keydown.alt.up.prevent="
                  selectedSectionId = candidate.sectionId;
                  moveSection(-1)
                "
                @keydown.alt.down.prevent="
                  selectedSectionId = candidate.sectionId;
                  moveSection(1)
                "
              >
                <span class="mono">{{ candidateIndex + 1 }}</span>
                {{ candidate.title }}
              </Button>
              <Popover>
                <PopoverTrigger as-child>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    :aria-label="`More actions for Section ${candidateIndex + 1}`"
                  >
                    <MoreHorizontal aria-hidden="true" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" class="section-actions-menu">
                  <Button
                    type="button"
                    variant="ghost"
                    @click="
                      selectedSectionId = candidate.sectionId;
                      copySection(candidate.sectionId)
                    "
                  >
                    Duplicate
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    @click="
                      selectedSectionId = candidate.sectionId;
                      moveSection(-1)
                    "
                  >
                    Move up
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    @click="
                      selectedSectionId = candidate.sectionId;
                      moveSection(1)
                    "
                  >
                    Move down
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    class="danger-action"
                    @click="requestDeleteSection(candidate.sectionId)"
                  >
                    Delete
                  </Button>
                </PopoverContent>
              </Popover>
            </div>
          </nav>
          <Button
            type="button"
            size="sm"
            variant="outline"
            class="outline-add-section"
            :aria-label="t('author.workspace.addSection')"
            @click="addSection"
          >
            <Plus aria-hidden="true" />
            {{ t("author.workspace.addSection") }}
          </Button>
          </section>
        </nav>
      </ScrollArea>
    </aside>
    <button
      v-else
      type="button"
      class="pane-recovery-rail pane-recovery-rail-left"
      aria-label="Open Outline from edge"
      @click="setOutlineOpen(true)"
    >
      <PanelLeftOpen aria-hidden="true" />
    </button>
    <ResizableSeparator
      v-if="outlineOpen"
      label="Resize Protocol outline"
      @resize="updatePaneWidth('outline', $event)"
      @reset="resetPaneWidth('outline')"
    />

    <div class="workbench-canvas">
      <Tabs v-model="activeAuthorPanel" class="author-tabs">
        <ScrollArea orientation="horizontal" class="tabs-scroll-area">
          <TabsList
            aria-label="Author workspace"
            class="view-switcher"
          >
            <TabsTrigger
          v-for="panel in authorPanels"
          :id="`author-tab-${panel.id}`"
          :key="panel.id"
          :value="panel.id"
          :aria-controls="`author-panel-${panel.id}`"
            >
              {{ panel.label }}
            </TabsTrigger>
          </TabsList>
        </ScrollArea>

      <ScrollArea
        v-show="activeAuthorPanel === 'summary'"
        id="author-panel-summary"
        role="tabpanel"
        aria-labelledby="author-tab-summary"
        class="author-panel-scroll"
      >
        <div class="author-summary-panel">
        <div class="section-heading">
          <div>
            <h3>{{ t("author.workspace.summaryTitle") }}</h3>
            <p>{{ t("author.workspace.summaryBody") }}</p>
          </div>
        </div>
        <div class="author-summary-grid">
          <article>
            <strong>{{ editing?.protocol.sections.length ?? 0 }}</strong>
            <span>{{ t("author.workspace.summarySections") }}</span>
          </article>
          <article>
            <strong>{{ editing?.protocol.variables.length ?? 0 }}</strong>
            <span>{{ t("author.workspace.summaryVariables") }}</span>
          </article>
          <article>
            <strong>{{ editing?.protocol.formulaTestCases.length ?? 0 }}</strong>
            <span>{{ t("author.workspace.summaryTests") }}</span>
          </article>
        </div>
        <ol class="author-summary-sections">
          <li
            v-for="(candidate, candidateIndex) in editing?.protocol.sections"
            :key="candidate.sectionId"
          >
            <span class="mono">{{ String(candidateIndex + 1).padStart(2, "0") }}</span>
            <button
              type="button"
              @click="
                selectedSectionId = candidate.sectionId;
                selectAuthorPanel('details')
              "
            >
              {{ candidate.title }}
            </button>
          </li>
        </ol>
        </div>
      </ScrollArea>

      <div
        v-show="activeAuthorPanel === 'details'"
        id="author-panel-details"
        role="tabpanel"
        aria-labelledby="author-tab-details"
      >
        <div class="document-editor">
          <div class="document-heading">
            <label>
              <span>Section title</span>
              <input
                ref="sectionTitleInput"
                class="document-section-title"
                :value="section?.title"
                @input="author.updateSection(section!.sectionId, {
                  title: ($event.target as HTMLInputElement).value,
                })"
              >
            </label>
          </div>
          <ScrollArea orientation="horizontal" class="editor-toolbar-scroll">
            <TooltipProvider :delay-duration="300">
              <div
                role="toolbar"
                aria-label="Formatting"
                class="editor-toolbar"
              >
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Undo"
                      @click="undoEditorChange"
                    >
                      <Undo2 aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Undo</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Redo"
                      @click="redoEditorChange"
                    >
                      <Redo2 aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Redo</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      type="button"
                      size="icon-sm"
                      :variant="editor?.isActive('bold') ? 'secondary' : 'ghost'"
                      aria-label="Bold"
                      :aria-pressed="editor?.isActive('bold')"
                      @click="toggleBold"
                    >
                      <BoldIcon aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Bold</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      type="button"
                      size="icon-sm"
                      :variant="editor?.isActive('italic') ? 'secondary' : 'ghost'"
                      aria-label="Italic"
                      :aria-pressed="editor?.isActive('italic')"
                      @click="toggleItalic"
                    >
                      <ItalicIcon aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Italic</TooltipContent>
                </Tooltip>
                <Popover v-model:open="blockTypePopoverOpen">
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <PopoverTrigger as-child>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          class="block-type-trigger"
                          :aria-label="`Block type: ${currentBlockTypeLabel}`"
                        >
                          <component :is="currentBlockTypeIcon" aria-hidden="true" />
                        </Button>
                      </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Block type: {{ currentBlockTypeLabel }}</TooltipContent>
                  </Tooltip>
                  <PopoverContent
                    aria-label="Block type"
                    aria-labelledby="block-type-popover-title"
                    align="start"
                    class="toolbar-menu"
                  >
                    <h4 id="block-type-popover-title" class="sr-only">
                      Block type
                    </h4>
                    <Button
                      v-for="option in [
                        { value: 'paragraph', label: 'Paragraph' },
                        { value: '3', label: 'Heading 3' },
                        { value: '4', label: 'Heading 4' },
                        { value: '5', label: 'Heading 5' },
                        { value: '6', label: 'Heading 6' },
                      ] as const"
                      :key="option.value"
                      type="button"
                      variant="ghost"
                      :aria-current="
                        currentBlockType === option.value ? 'true' : undefined
                      "
                      @click="setBlockType(option.value)"
                    >
                      {{ option.label }}
                    </Button>
                  </PopoverContent>
                </Popover>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      type="button"
                      size="icon-sm"
                      :variant="editor?.isActive('bulletList') ? 'secondary' : 'ghost'"
                      aria-label="Bullet List"
                      :aria-pressed="editor?.isActive('bulletList')"
                      @click="toggleBulletList"
                    >
                      <List aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Bullet List</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      type="button"
                      size="icon-sm"
                      :variant="editor?.isActive('orderedList') ? 'secondary' : 'ghost'"
                      aria-label="Ordered List"
                      :aria-pressed="editor?.isActive('orderedList')"
                      @click="toggleOrderedList"
                    >
                      <ListOrdered aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Ordered List</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      type="button"
                      size="icon-sm"
                      :variant="editor?.isActive('taskList') ? 'secondary' : 'ghost'"
                      aria-label="Task List"
                      :aria-pressed="editor?.isActive('taskList')"
                      @click="toggleTaskList"
                    >
                      <ListTodo aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Task List</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Insert Table"
                      @click="insertTable"
                    >
                      <Table2 aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Insert Table</TooltipContent>
                </Tooltip>
                <Popover v-model:open="variablePopoverOpen">
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <PopoverTrigger as-child>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Insert Variable"
                        >
                          <Braces aria-hidden="true" />
                        </Button>
                      </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Insert Variable</TooltipContent>
                  </Tooltip>
                  <PopoverContent
                    aria-labelledby="variable-popover-title"
                    align="start"
                    class="toolbar-menu variable-menu"
                  >
                    <h4 id="variable-popover-title">Insert Variable</h4>
                    <Button
                      v-for="variable in editing?.protocol.variables"
                      :key="variable.id"
                      type="button"
                      variant="ghost"
                      @click="insertVariable(variable.id)"
                    >
                      <span>{{ variable.label }}</span>
                      <span class="mono">({{ variable.id }})</span>
                    </Button>
                    <Button
                      v-if="editing?.protocol.variables.length === 0"
                      type="button"
                      variant="outline"
                      @click="
                        variablePopoverOpen = false;
                        selectAuthorPanel('variables')
                      "
                    >
                      Create Variable Definition
                    </Button>
                  </PopoverContent>
                </Popover>
                <Popover
                  :open="linkPopoverOpen"
                  @update:open="updateLinkPopover"
                >
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <PopoverTrigger as-child>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Edit link"
                        >
                          <LinkIcon aria-hidden="true" />
                        </Button>
                      </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Edit link</TooltipContent>
                  </Tooltip>
                  <PopoverContent
                    aria-labelledby="link-popover-title"
                    align="start"
                  >
                    <h4 id="link-popover-title" class="font-medium">Edit link</h4>
                    <label class="text-foreground mt-3">
                      Link URL
                      <Input
                        v-model="linkUrl"
                        type="url"
                        placeholder="https://example.com"
                      />
                    </label>
                    <div class="mt-3 flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        @click="linkPopoverOpen = false"
                      >
                        Cancel
                      </Button>
                      <Button type="button" @click="applyLink">
                        Apply Link
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      :aria-label="t('help.learn.sections')"
                      data-help-topic="author/sections"
                      @click="openHelp('author/sections')"
                    >
                      <CircleHelp aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{{ t("help.learn.sections") }}</TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </ScrollArea>
          <p
            v-if="headingHierarchyWarning"
            class="editor-warning"
            role="status"
          >
            Body content contains Heading 1 or Heading 2. Preserve these
            blocks for imported content, but use Heading 3-6 for procedure
            structure.
          </p>
          <ScrollArea class="document-canvas" @click="focusEditorEnd">
            <h3 class="sr-only">Procedure</h3>
            <EditorContent
              class="protocol-content author-protocol-content"
              :editor="editor"
            />
          </ScrollArea>
        </div>
      </div>

      <ScrollArea
        v-show="activeAuthorPanel === 'variables'"
        id="author-panel-variables"
        role="tabpanel"
        aria-labelledby="author-tab-variables"
        class="author-panel-scroll"
      >
        <section class="definitions-panel">
        <Collapsible v-model:open="variableFormOpen" class="contents">
          <div class="section-heading definitions-heading">
            <div>
              <p class="eyebrow">Protocol inputs and calculations</p>
              <h3>Variable Definitions</h3>
            </div>
            <div class="actions">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                data-help-topic="author/variables"
                @click="openHelp('author/variables')"
              >
                <CircleHelp data-icon="inline-start" aria-hidden="true" />
                {{ t("help.learn.variables") }}
              </Button>
              <ToggleGroup
                v-model="variableView"
                type="single"
                variant="outline"
                size="sm"
                aria-label="Variable view"
              >
                <ToggleGroupItem value="table" aria-label="Table view">
                  Table
                </ToggleGroupItem>
                <ToggleGroupItem value="graph" aria-label="Graph view">
                  Graph
                </ToggleGroupItem>
              </ToggleGroup>
              <CollapsibleTrigger v-if="!variableFormOpen" as-child>
                <Button type="button" size="sm" @click="openVariableForm">
                  <Plus data-icon="inline-start" aria-hidden="true" />
                  Add Variable
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
          <CollapsibleContent>
            <Card class="definition-form-card">
              <CardHeader>
                <CardTitle>New Variable Definition</CardTitle>
                <CardDescription>
                  Give the value a stable ID, a reader-facing label, and one declared type.
                </CardDescription>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  class="definition-form-close"
                  aria-label="Cancel adding Variable Definition"
                  @click="closeVariableForm"
                >
                  <X aria-hidden="true" />
                </Button>
              </CardHeader>
              <CardContent>
                <FieldGroup class="definition-form-grid">
                  <Field>
                    <FieldLabel for="new-variable-id">Variable ID</FieldLabel>
                    <Input id="new-variable-id" v-model="variableId" placeholder="sampleVolume" />
                  </Field>
                  <Field>
                    <FieldLabel for="new-variable-label">Label</FieldLabel>
                    <Input id="new-variable-label" v-model="variableLabel" placeholder="Sample volume" />
                  </Field>
                  <Field>
                    <FieldLabel for="new-variable-type">Type</FieldLabel>
                    <Select v-model="variableType">
                      <SelectTrigger id="new-variable-type" class="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="text">Text Input</SelectItem>
                          <SelectItem value="numeric">Numeric Input</SelectItem>
                          <SelectItem value="boolean">Boolean Input</SelectItem>
                          <SelectItem value="enum">Enum Input</SelectItem>
                          <SelectItem value="derived">Numeric Derived</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field v-if="variableType === 'enum'">
                    <FieldLabel for="new-variable-options">Options</FieldLabel>
                    <Input
                      id="new-variable-options"
                      v-model="variableOptions"
                      placeholder="low, medium, high"
                    />
                  </Field>
                  <Field v-if="variableType === 'derived'" class="definition-form-span">
                    <FieldLabel for="new-variable-formula">Formula</FieldLabel>
                    <Input
                      id="new-variable-formula"
                      v-model="variableFormula"
                      class="font-mono"
                    />
                  </Field>
                </FieldGroup>
                <FormulaAssistant
                  v-if="variableType === 'derived' && editing"
                  :protocol="editing.protocol"
                  :variable-id="variableId"
                  :formula="variableFormula"
                  @learn="openHelp('author/formulas')"
                />
              </CardContent>
              <CardFooter class="justify-end">
                <Button type="button" variant="outline" @click="closeVariableForm">
                  Cancel
                </Button>
                <Button type="button" @click="addVariable">
                  Add Variable Definition
                </Button>
              </CardFooter>
            </Card>
          </CollapsibleContent>
        </Collapsible>
        <VariableDependencyGraph
          v-if="variableView === 'graph'"
          :inspection="dependencyGraph"
          :selected-id="selectedVariableId"
          @select="selectVariable"
        />
        <ScrollArea v-else orientation="horizontal" class="definition-table-scroll">
          <Table class="definition-table" aria-label="Variable Definitions">
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Default / Formula</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow
                v-for="variable in editing?.protocol.variables"
                :key="variable.id"
                tabindex="0"
                :aria-selected="selectedVariableId === variable.id"
                :data-state="selectedVariableId === variable.id ? 'selected' : undefined"
                @click="selectVariable(variable.id)"
                @keydown.enter.prevent="selectVariable(variable.id)"
                @keydown.space.prevent="selectVariable(variable.id)"
              >
                <TableCell class="mono font-semibold">{{ variable.id }}</TableCell>
                <TableCell>{{ variable.label }}</TableCell>
                <TableCell>{{ variable.kind === "derived" ? "Derived" : variable.valueType }}</TableCell>
                <TableCell class="mono">
                  {{
                    variable.kind === "derived"
                      ? variable.formula
                      : variable.valueType === "enum"
                        ? variable.options.join(", ")
                        : variable.defaultValue ?? "—"
                  }}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <p v-if="editing?.protocol.variables.length === 0" class="definition-empty">
            No Variable Definitions yet. Add the first value used by this Protocol.
          </p>
        </ScrollArea>
        </section>
      </ScrollArea>

      <ScrollArea
        v-show="activeAuthorPanel === 'formula-tests'"
        id="author-panel-formula-tests"
        role="tabpanel"
        aria-labelledby="author-tab-formula-tests"
        class="author-panel-scroll"
      >
        <section class="definitions-panel">
        <Collapsible v-model:open="testCaseFormOpen" class="contents">
          <div class="section-heading definitions-heading">
            <div>
              <p class="eyebrow">Deterministic examples</p>
              <h3>Formula Test Cases</h3>
            </div>
            <CollapsibleTrigger v-if="!testCaseFormOpen" as-child>
              <Button type="button" size="sm" @click="openFormulaTestCaseForm">
                <Plus data-icon="inline-start" aria-hidden="true" />
                Add Formula Test
              </Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
            <Card class="definition-form-card">
              <CardHeader>
                <CardTitle>New Formula Test Case</CardTitle>
                <CardDescription>
                  Record known inputs and the Derived Variable values the formula must produce.
                </CardDescription>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  class="definition-form-close"
                  aria-label="Cancel adding Formula Test Case"
                  @click="closeFormulaTestCaseForm"
                >
                  <X aria-hidden="true" />
                </Button>
              </CardHeader>
              <CardContent class="formula-test-form">
                <FieldGroup>
                  <Field>
                    <FieldLabel for="new-test-title">{{ t("author.formulaTest.title") }}</FieldLabel>
                    <Input id="new-test-title" v-model="testCaseName" />
                  </Field>
                  <Field>
                    <FieldLabel for="new-test-description">
                      {{ t("author.formulaTest.description") }}
                    </FieldLabel>
                    <Textarea
                      id="new-test-description"
                      v-model="testCaseDescription"
                      rows="3"
                      :placeholder="t('author.formulaTest.descriptionPlaceholder')"
                    />
                  </Field>
                </FieldGroup>
                <section class="test-value-group" aria-labelledby="test-input-values">
                  <div>
                    <h4 id="test-input-values">Input Values</h4>
                    <p>Values supplied before the Derived Variables are evaluated.</p>
                  </div>
                  <FieldGroup v-if="inputVariableDefinitions.length" class="test-value-grid">
                    <Field v-for="variable in inputVariableDefinitions" :key="variable.id">
                      <FieldLabel :for="`test-input-${variable.id}`">
                        {{ variable.label }}
                        <code>{{ variable.id }}</code>
                      </FieldLabel>
                      <Select
                        v-if="variable.valueType === 'boolean'"
                        :model-value="String(testInputValues[variable.id])"
                        @update:model-value="updateTestBooleanInput(variable.id, String($event))"
                      >
                        <SelectTrigger :id="`test-input-${variable.id}`" class="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="true">True</SelectItem>
                            <SelectItem value="false">False</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <Select
                        v-else-if="variable.valueType === 'enum'"
                        :model-value="String(testInputValues[variable.id] ?? '')"
                        @update:model-value="testInputValues[variable.id] = String($event)"
                      >
                        <SelectTrigger :id="`test-input-${variable.id}`" class="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem
                              v-for="option in variable.options"
                              :key="option"
                              :value="option"
                            >
                              {{ option }}
                            </SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <Input
                        v-else
                        :id="`test-input-${variable.id}`"
                        :model-value="String(testInputValues[variable.id] ?? '')"
                        @update:model-value="testInputValues[variable.id] = String($event)"
                        :class="variable.valueType === 'numeric' ? 'font-mono' : undefined"
                        :inputmode="variable.valueType === 'numeric' ? 'decimal' : undefined"
                      />
                    </Field>
                  </FieldGroup>
                  <p v-else class="definition-empty">
                    Add an Input Variable before defining test inputs.
                  </p>
                </section>
                <section class="test-value-group" aria-labelledby="test-expected-values">
                  <div>
                    <h4 id="test-expected-values">Expected Derived Values</h4>
                    <p>The exact decimal result expected from each formula.</p>
                  </div>
                  <FieldGroup v-if="derivedVariableDefinitions.length" class="test-value-grid">
                    <Field v-for="variable in derivedVariableDefinitions" :key="variable.id">
                      <FieldLabel :for="`test-expected-${variable.id}`">
                        {{ variable.label }}
                        <code>{{ variable.id }}</code>
                      </FieldLabel>
                      <Input
                        :id="`test-expected-${variable.id}`"
                        v-model="testExpectedValues[variable.id]"
                        class="font-mono"
                        inputmode="decimal"
                      />
                    </Field>
                  </FieldGroup>
                  <p v-else class="definition-empty">
                    Add a Derived Variable before defining expected values.
                  </p>
                </section>
              </CardContent>
              <CardFooter class="justify-end">
                <Button type="button" variant="outline" @click="closeFormulaTestCaseForm">
                  Cancel
                </Button>
                <Button type="button" @click="addFormulaTestCase">
                  Add Formula Test Case
                </Button>
              </CardFooter>
            </Card>
          </CollapsibleContent>
        </Collapsible>
        <ScrollArea orientation="horizontal" class="definition-table-scroll">
          <Table class="definition-table test-table" aria-label="Formula Test Cases">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Inputs</TableHead>
                <TableHead>Expected</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow
                v-for="testCase in editing?.protocol.formulaTestCases"
                :key="testCase.testCaseId"
                tabindex="0"
                :aria-selected="selectedTestCaseId === testCase.testCaseId"
                :data-state="selectedTestCaseId === testCase.testCaseId ? 'selected' : undefined"
                @click="selectTestCase(testCase.testCaseId)"
                @keydown.enter.prevent="selectTestCase(testCase.testCaseId)"
                @keydown.space.prevent="selectTestCase(testCase.testCaseId)"
              >
                <TableCell class="font-medium">{{ testCase.name }}</TableCell>
                <TableCell class="mono">{{ JSON.stringify(testCase.inputValues) }}</TableCell>
                <TableCell class="mono">{{ JSON.stringify(testCase.expectedDerivedValues) }}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <p v-if="editing?.protocol.formulaTestCases.length === 0" class="definition-empty">
            No Formula Test Cases yet. Add one known scenario to guard formula behavior.
          </p>
        </ScrollArea>
      </section>
      </ScrollArea>
      </Tabs>
    </div>
    <ResizableSeparator
      v-if="inspectorOpen"
      label="Resize Inspector"
      @resize="updatePaneWidth('inspector', $event)"
      @reset="resetPaneWidth('inspector')"
    />
    <aside
      v-if="inspectorOpen"
      class="context-inspector"
      @focusin="rememberPaneFocus($event, 'inspector')"
    >
      <div class="pane-title">
        <span
          ref="inspectorHeading"
          tabindex="-1"
        >{{ t("author.workspace.inspector") }}</span>
        <Settings2 aria-hidden="true" />
      </div>
      <ScrollArea class="inspector-scroll-area">
      <div v-if="activeAuthorPanel === 'summary'" class="inspector-body">
        <p class="eyebrow">{{ t("author.workspace.summary") }}</p>
        <p>{{ t("author.workspace.summaryInspector") }}</p>
      </div>
      <div v-else-if="activeAuthorPanel === 'details' && section" class="inspector-body">
        <p class="eyebrow">Selected Section</p>
        <label>
          Section title
          <input
            :value="section.title"
            @input="author.updateSection(section.sectionId, {
              title: ($event.target as HTMLInputElement).value,
            })"
          >
        </label>
        <label>
          Duration
          <select
            :value="section.duration.kind"
            @change="updateSectionDuration(
              ($event.target as HTMLSelectElement).value as 'untimed' | 'fixed' | 'derived',
            )"
          >
            <option value="untimed">Untimed</option>
            <option value="fixed">Fixed timer</option>
            <option value="derived">Derived timer</option>
          </select>
        </label>
        <label v-if="section.duration.kind === 'fixed'">
          Seconds
          <input
            :value="section.duration.seconds"
            inputmode="decimal"
            @input="updateSectionDuration(
              'fixed',
              ($event.target as HTMLInputElement).value,
            )"
          >
        </label>
        <label v-else-if="section.duration.kind === 'derived'">
          Numeric Derived Variable
          <select
            :value="section.duration.variableId"
            @change="updateSectionDuration(
              'derived',
              ($event.target as HTMLSelectElement).value,
            )"
          >
            <option
              v-for="variable in editing?.protocol.variables.filter(
                candidate => candidate.kind === 'derived',
              )"
              :key="variable.id"
              :value="variable.id"
            >
              {{ variable.label }}
            </option>
          </select>
        </label>
        <label>
          End action
          <select
            :value="section.endAction"
            @change="updateSectionEndAction(
              ($event.target as HTMLSelectElement).value as 'wait' | 'advance',
            )"
          >
            <option value="wait">Wait for acknowledgement</option>
            <option value="advance">Advance automatically</option>
          </select>
        </label>
        <div
          class="inspector-rule"
          :data-invalid="section.completionRequirement === 'all-task-items' && taskItemCount === 0"
        >
          <div class="inspector-rule-control">
            <Label for="task-item-completion-requirement">
              {{ t("author.section.taskItemCompletionRequirement") }}
            </Label>
            <Switch
              id="task-item-completion-requirement"
              :model-value="section.completionRequirement === 'all-task-items'"
              :disabled="taskItemCount === 0 && section.completionRequirement !== 'all-task-items'"
              @update:model-value="updateSectionCompletionRequirement"
            />
          </div>
          <p
            :role="section.completionRequirement === 'all-task-items' && taskItemCount === 0 ? 'alert' : undefined"
          >
            {{ taskItemCount > 0
              ? t("author.section.taskItemsDetected", { count: taskItemCount })
              : t("author.section.taskItemsRequired") }}
          </p>
        </div>
        <div class="inspector-group">
          <h3>Insert image</h3>
          <label>
            Local image
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              @change="importLocalImage"
            >
          </label>
          <label>
            Remote image URL
            <input v-model="remoteImageUrl" type="url">
          </label>
          <Button type="button" size="sm" @click="requestRemoteImageImport">
            <ImagePlus aria-hidden="true" />
            Download and Embed
          </Button>
        </div>
      </div>
      <div v-else-if="activeAuthorPanel === 'variables'" class="inspector-body">
        <template v-if="selectedVariable">
          <p class="eyebrow">Selected Variable</p>
          <p class="mono">{{ selectedVariable.id }}</p>
          <label>
            Label
            <input
              :value="selectedVariable.label"
              @input="updateVariableLabel(
                selectedVariable.id,
                ($event.target as HTMLInputElement).value,
              )"
            >
          </label>
          <template v-if="selectedVariable.kind === 'derived'">
            <label>
              Formula
              <input
                :value="selectedVariable.formula"
                class="mono"
                @input="updateVariableDetail(
                  selectedVariable.id,
                  ($event.target as HTMLInputElement).value,
                )"
              >
            </label>
            <FormulaAssistant
              v-if="editing"
              :protocol="editing.protocol"
              :variable-id="selectedVariable.id"
              :formula="selectedVariable.formula"
              @learn="openHelp('author/formulas')"
            />
          </template>
          <label v-else-if="selectedVariable.valueType === 'enum'">
            Options
            <input
              :value="selectedVariable.options.join(', ')"
              @input="updateVariableDetail(
                selectedVariable.id,
                ($event.target as HTMLInputElement).value,
              )"
            >
          </label>
          <label v-else-if="selectedVariable.valueType === 'boolean'" class="check-label">
            <input
              type="checkbox"
              :checked="selectedVariable.defaultValue"
              @change="updateVariableDetail(
                selectedVariable.id,
                ($event.target as HTMLInputElement).checked,
              )"
            >
            Default value
          </label>
          <label v-else>
            Default value
            <input
              :value="selectedVariable.defaultValue"
              @input="updateVariableDetail(
                selectedVariable.id,
                ($event.target as HTMLInputElement).value,
              )"
            >
          </label>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            @click="removeVariable(selectedVariable.id)"
          >
            Remove Variable
          </Button>
        </template>
        <p v-else>Select a Variable from the table or Protocol outline.</p>
      </div>
      <div v-else-if="activeAuthorPanel === 'formula-tests'" class="inspector-body">
        <template v-if="selectedTestCase">
          <p class="eyebrow">Selected Formula Test Case</p>
          <label>
            {{ t("author.formulaTest.title") }}
            <input
              :value="selectedTestCase.name"
              @input="updateFormulaTestCase(selectedTestCase.testCaseId, {
                name: ($event.target as HTMLInputElement).value,
              })"
            >
          </label>
          <label>
            {{ t("author.formulaTest.description") }}
            <textarea
              :value="selectedTestCase.description ?? ''"
              rows="6"
              :placeholder="t('author.formulaTest.descriptionPlaceholder')"
              @input="updateFormulaTestCase(selectedTestCase.testCaseId, {
                description: ($event.target as HTMLTextAreaElement).value,
              })"
            />
          </label>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            @click="removeFormulaTestCase(selectedTestCase.testCaseId)"
          >
            Remove Formula Test Case
          </Button>
        </template>
        <p v-else>Select a Formula Test Case from the list.</p>
      </div>
      </ScrollArea>
    </aside>
    <button
      v-else
      type="button"
      class="pane-recovery-rail pane-recovery-rail-right"
      aria-label="Open Inspector from edge"
      @click="setInspectorOpen(true)"
    >
      <PanelRightOpen aria-hidden="true" />
    </button>
  </div>
</section>
  <AccessibleDialog v-if="remoteImageConfirmation" id="remote-image-dialog" title="Download remote image?" confirm-label="Download and Embed" @confirm="importRemoteImage" @cancel="remoteImageConfirmation = false">
    <p>The image will be downloaded once and embedded in the Unsigned Draft.</p>
    <p class="break-anywhere">{{ remoteImageUrl }}</p>
  </AccessibleDialog>
  <AccessibleDialog v-if="deleteSectionRequested" id="delete-section-dialog" :title="editing?.protocol.sections.length === 1 ? 'Replace final Section?' : 'Delete Section?'" :confirm-label="editing?.protocol.sections.length === 1 ? 'Replace with blank Section' : 'Delete Section'" @confirm="confirmDeleteSection" @cancel="deleteSectionRequested = undefined">
    <p v-if="editing?.protocol.sections.length === 1">A Protocol must retain a working Section. This will replace the current Section with a new, empty “Untitled Section”.</p>
    <p v-else>This removes the Section and its procedure content from the Unsigned Draft.</p>
  </AccessibleDialog>
</template>
