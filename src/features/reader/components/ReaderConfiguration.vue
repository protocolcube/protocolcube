<script setup lang="ts">
import { Check } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useReaderStore, isReaderActionFailure } from "@/features/reader/store";
import {
  ProtocolCore,
  type ProtocolError,
  type VariableValue,
  isDurationUnit,
} from "@/domain/protocol";
import { t, type TranslationKey, type TranslationParams } from "@/locales";
import { Button } from "@/components/ui/button";

const emit = defineEmits<{ status: [key: TranslationKey, params?: TranslationParams] }>();
const readerStore = useReaderStore();
const { isPreview, persistence, protocol, snapshot, storageCapability } = storeToRefs(readerStore);
const persistentStorageConfirmed = ref(false);
const inputDefinitions = computed(() => protocol.value?.variables.filter((definition) => definition.kind === "input") ?? []);
const derivedDefinitions = computed(() => protocol.value?.variables.filter((definition) => definition.kind === "derived") ?? []);
const configurationErrors = computed(() => snapshot.value.mode === "configuring" || snapshot.value.mode === "ready" ? snapshot.value.errors : []);
const sessionStorageAvailable = computed(() => storageCapability.value === "available");
// Duration Input Variables are entered in their declared Duration Unit while
// Variable Values are stored as canonical seconds, so the field keeps the
// Reader's raw entry for display instead of the resolved seconds.
const durationEntries = ref<Record<string, string>>({});
watch(() => readerStore.protocol, () => { durationEntries.value = {}; });
function inputValue(id: string): VariableValue | undefined { return "values" in snapshot.value ? snapshot.value.values[id] : undefined; }
function durationInputValue(id: string): string {
  const entry = durationEntries.value[id];
  if (entry !== undefined) return entry;
  const value = inputValue(id);
  return typeof value === "string" ? value : "";
}
function derivedDisplayValue(definition: (typeof derivedDefinitions.value)[number]): VariableValue {
  // Duration Derived Variables resolve to canonical seconds; the panel
  // presents them through the single domain formatter in the declared
  // Duration Unit, exactly like step text and the Completion Summary.
  const value = inputValue(definition.id);
  if (
    definition.kind === "derived" &&
    definition.valueType === "duration" &&
    typeof value === "string" &&
    isDurationUnit(definition.unit)
  ) {
    return ProtocolCore.formatDurationValue(value, definition.unit);
  }
  return value ?? "—";
}
function setDurationInput(id: string, value: string): void {
  durationEntries.value[id] = value;
  setInput(id, value);
}
function constraintValue(definition: (typeof inputDefinitions.value)[number], key: "minimum" | "maximum"): string {
  if (definition.kind !== "input" || (definition.valueType !== "numeric" && definition.valueType !== "duration")) return "";
  const value = definition[key];
  if (value === undefined) return "";
  if (definition.valueType === "duration" && isDurationUnit(definition.unit)) {
    return ProtocolCore.convertDurationSecondsToUnit(value, definition.unit);
  }
  return value;
}
function reportFailure(error: unknown, key: TranslationKey): void { if (isReaderActionFailure(error)) { emit("status", key); return; } throw error; }
function setInput(id: string, value: VariableValue): void { try { readerStore.setInputValue(id, value); } catch (error) { reportFailure(error, "reader.status.inputFailed"); } }
function startPlayback(): void { try { readerStore.startPlayback({ sensitiveDataConfirmed: persistentStorageConfirmed.value }); emit("status", "reader.status.playbackStarted"); } catch (error) { reportFailure(error, "reader.status.playbackFailed"); } }
function errorSubject(error: ProtocolError): string {
  const directId = error.path.match(/(?:values|inputValues)\.([A-Za-z_][A-Za-z0-9_]*)/)?.[1];
  if (directId !== undefined) return protocol.value?.variables.find((definition) => definition.id === directId)?.label ?? directId;
  const variableIndex = Number(error.path.match(/variables\.(\d+)/)?.[1]);
  if (Number.isInteger(variableIndex)) return protocol.value?.variables[variableIndex]?.label ?? error.path;
  return error.path || t("reader.frame.published");
}
function translatedError(error: ProtocolError): string {
  const path = error.path || t("reader.frame.published");
  switch (error.code) {
    case "missing_input": case "missing_input_value": return t("reader.error.missingInput", { variable: errorSubject(error) });
    case "invalid_input": case "invalid_variable_constraints": case "invalid_variable_default": return t("reader.error.invalidInput", { variable: errorSubject(error) });
    case "invalid_duration": return t("reader.error.invalidDuration");
    case "invalid_duration_variable": return t("reader.error.invalidDurationVariable");
    case "invalid_duration_unit": return t("reader.error.invalidDurationUnit", { variable: errorSubject(error) });
    case "web_crypto_unavailable": return t("reader.error.webCrypto");
    case "invalid_playback_session": return t("reader.error.invalidSession");
    case "resource_limit": return t("reader.error.resourceLimit", { path });
    case "invalid_image": return t("reader.error.invalidImage", { path });
    case "formula_error": case "formula_test_failed": case "unknown_variable": case "non_numeric_variable": case "cyclic_dependency": case "missing_formula_test_case": case "missing_expected_value": return t("reader.error.formula", { path });
    case "invalid_envelope_encoding": case "unrecognized_field": case "duplicate_section": case "duplicate_variable": return t("reader.error.structure", { path });
    default: return t("reader.error.generic", { path, code: error.code });
  }
}
</script>
<template>
  <section v-if="snapshot.mode === 'configuring' || snapshot.mode === 'ready'" class="configuration-workbench" aria-labelledby="configuration-title">
    <div class="workbench-heading"><div><p>{{ t("reader.stage.configure") }}</p><h2 id="configuration-title">{{ t("reader.configuration.title") }}</h2></div><p>{{ t("reader.configuration.intro") }}</p></div>
    <div class="variable-sheet"><fieldset class="input-variable-panel"><legend>{{ t("reader.configuration.inputVariables") }}</legend><p v-if="inputDefinitions.length === 0" class="empty-note">{{ t("reader.configuration.noInputs") }}</p><div v-for="definition in inputDefinitions" :key="definition.id" class="variable-field"><div class="variable-label-row"><label :for="`reader-variable-${definition.id}`">{{ definition.label }}</label><span>{{ definition.id }}</span></div><div v-if="'minimum' in definition || 'maximum' in definition" class="variable-constraints"><span v-if="'minimum' in definition && definition.minimum !== undefined">{{ t("reader.configuration.minimum", { value: constraintValue(definition, "minimum") }) }}</span><span v-if="'maximum' in definition && definition.maximum !== undefined">{{ t("reader.configuration.maximum", { value: constraintValue(definition, "maximum") }) }}</span></div><select v-if="definition.valueType === 'enum'" :id="`reader-variable-${definition.id}`" :value="inputValue(definition.id)" @change="setInput(definition.id, ($event.target as HTMLSelectElement).value)"><option value="">{{ t("common.select") }}</option><option v-for="option in definition.options" :key="option" :value="option">{{ option }}</option></select><input v-else-if="definition.valueType === 'boolean'" :id="`reader-variable-${definition.id}`" type="checkbox" :checked="inputValue(definition.id) === true" @change="setInput(definition.id, ($event.target as HTMLInputElement).checked)"><template v-else-if="definition.valueType === 'duration'"><div class="variable-entry"><input :id="`reader-variable-${definition.id}`" type="text" inputmode="decimal" :value="durationInputValue(definition.id)" @input="setDurationInput(definition.id, ($event.target as HTMLInputElement).value)"><span class="variable-unit">{{ ProtocolCore.durationSymbol(definition.unit) }}</span></div></template><input v-else :id="`reader-variable-${definition.id}`" type="text" :value="inputValue(definition.id) ?? ''" :inputmode="definition.valueType === 'numeric' ? 'decimal' : undefined" @input="setInput(definition.id, ($event.target as HTMLInputElement).value)"></div></fieldset>
      <section class="derived-variable-panel" aria-labelledby="derived-variable-title"><h3 id="derived-variable-title">{{ t("reader.configuration.derivedVariables") }}</h3><p v-if="derivedDefinitions.length === 0" class="empty-note">{{ t("reader.configuration.noDerived") }}</p><dl v-else><div v-for="definition in derivedDefinitions" :key="definition.id"><dt><span>{{ definition.label }}</span><small>{{ definition.id }}</small></dt><dd><output>{{ derivedDisplayValue(definition) }}</output></dd></div></dl></section></div>
    <section v-if="configurationErrors.length" class="configuration-errors" aria-labelledby="configuration-errors-title"><h3 id="configuration-errors-title">{{ t("reader.configuration.errors") }}</h3><ul role="alert"><li v-for="error in configurationErrors" :key="`${error.path}:${error.code}`">{{ translatedError(error) }}</li></ul></section>
    <div class="configuration-footer"><div v-if="isPreview" class="preview-storage-card"><strong>{{ t("reader.preview.inMemory") }}</strong><p>{{ t("reader.storage.preview") }}</p></div><fieldset v-else class="storage-options"><legend>{{ t("reader.storage.legend") }}</legend><p>{{ sessionStorageAvailable ? t("reader.storage.warning") : t("reader.storage.unavailable") }}</p><label class="storage-choice" :data-selected="persistence === 'memory'"><input type="radio" value="memory" :checked="persistence === 'memory'" @change="readerStore.selectPersistence('memory')"><span>{{ t("reader.storage.memory") }}</span><span v-if="persistence === 'memory'" class="storage-selected"><Check aria-hidden="true" />{{ t("reader.storage.selected") }}</span></label><label class="storage-choice" :data-selected="persistence === 'persistent'"><input type="radio" value="persistent" :checked="persistence === 'persistent'" :disabled="!sessionStorageAvailable" @change="readerStore.selectPersistence('persistent')"><span>{{ t("reader.storage.persistent") }}</span><span v-if="persistence === 'persistent'" class="storage-selected"><Check aria-hidden="true" />{{ t("reader.storage.selected") }}</span></label><label v-if="persistence === 'persistent'" class="storage-confirmation"><input v-model="persistentStorageConfirmed" type="checkbox">{{ t("reader.storage.confirm") }}</label></fieldset><Button type="button" size="lg" :disabled="snapshot.mode !== 'ready' || (!isPreview && persistence === 'persistent' && !persistentStorageConfirmed)" @click="startPlayback">{{ t("reader.action.start") }}</Button></div>
  </section>
</template>
