<script setup lang="ts">
import { computed, reactive, watch } from "vue";
import { Button } from "@/components/ui/button";
import { t } from "@/locales";
import {
  ProtocolCore,
  type Protocol,
  type VariableDefinition,
  type VariableValue,
  isDurationUnit,
} from "@/domain/protocol";

const props = defineProps<{
  protocol: Protocol;
  variableId: string;
  formula: string;
  /** Declared type of the Derived Variable being previewed. */
  valueType?: "numeric" | "duration";
  /** Declared Duration Unit used when valueType is "duration". */
  unit?: string;
}>();
const emit = defineEmits<{
  learn: [];
}>();

const previewValues = reactive<Record<string, VariableValue>>({});
const inputDefinitions = computed(() =>
  props.protocol.variables.filter(
    (variable) => variable.kind === "input",
  ),
);
const numericReferences = computed(() =>
  props.protocol.variables.filter(
    (variable) =>
      variable.id !== props.variableId &&
      (variable.kind === "derived" ||
        variable.valueType === "numeric" ||
        variable.valueType === "duration"),
  ),
);

function initialPreviewValue(
  variable: Extract<VariableDefinition, { kind: "input" }>,
): VariableValue {
  // Duration defaults are stored as canonical seconds; preview entries are
  // expressed in the declared Duration Unit like Reader entries.
  if (variable.valueType === "duration") {
    if (variable.defaultValue === undefined || !isDurationUnit(variable.unit)) {
      return "1";
    }
    return ProtocolCore.convertDurationSecondsToUnit(
      variable.defaultValue,
      variable.unit,
    );
  }
  if (variable.defaultValue !== undefined) return variable.defaultValue;
  if (variable.valueType === "boolean") return false;
  if (variable.valueType === "enum") return variable.options[0] ?? "";
  return variable.valueType === "numeric" ? "1" : "";
}

watch(
  inputDefinitions,
  (definitions) => {
    const currentIds = new Set(definitions.map((variable) => variable.id));
    for (const id of Object.keys(previewValues)) {
      if (!currentIds.has(id)) delete previewValues[id];
    }
    for (const variable of definitions) {
      if (!(variable.id in previewValues)) {
        previewValues[variable.id] = initialPreviewValue(variable);
      }
    }
  },
  { immediate: true },
);

const previewDefinition = computed<
  Extract<VariableDefinition, { kind: "derived" }> | undefined
>(() => {
  const variableId = props.variableId.trim();
  const formula = props.formula.trim();
  if (!variableId || !formula) return undefined;
  const existing = props.protocol.variables.find(
    (variable) => variable.id === variableId,
  );
  const valueType =
    existing?.kind === "derived"
      ? existing.valueType
      : props.valueType === "duration"
        ? "duration"
        : "numeric";
  const unit =
    existing?.kind === "derived" &&
    existing.valueType === "duration" &&
    isDurationUnit(existing.unit)
      ? existing.unit
      : props.unit !== undefined && isDurationUnit(props.unit)
        ? props.unit
        : "minute";
  const label = existing?.label ?? variableId;
  const precision = existing?.kind === "derived" ? existing.precision : 2;
  const roundingMode =
    existing?.kind === "derived" ? existing.roundingMode : "half-even";
  if (valueType === "duration") {
    return {
      kind: "derived",
      id: variableId,
      label,
      valueType: "duration",
      unit,
      formula,
      precision,
      roundingMode,
    };
  }
  return {
    kind: "derived",
    id: variableId,
    label,
    valueType: "numeric",
    formula,
    precision,
    roundingMode,
  };
});

const evaluation = computed(() => {
  const definition = previewDefinition.value;
  if (!definition) return undefined;
  const protocol: Protocol = {
    ...props.protocol,
    variables: [
      ...props.protocol.variables.filter(
        (variable) => variable.id !== definition.id,
      ),
      definition,
    ],
  };
  return ProtocolCore.evaluateProtocol(protocol, { ...previewValues });
});

const previewResult = computed(() => {
  const result = evaluation.value;
  const definition = previewDefinition.value;
  if (!result?.ok || !definition) return undefined;
  const value = result.values[definition.id];
  if (
    typeof value === "string" &&
    definition.valueType === "duration" &&
    isDurationUnit(definition.unit)
  ) {
    // Render through the single domain formatter so the Assistant presents
    // the value exactly as Readers will see it, e.g. "1.5 h". Storage
    // remains canonical seconds.
    return ProtocolCore.formatDurationValue(value, definition.unit);
  }
  return value;
});
</script>

<template>
  <section
    class="my-3 mb-4 rounded-[var(--radius)] border border-border border-l-4 border-l-primary p-[.9rem] [background:linear-gradient(90deg,color-mix(in_oklab,var(--primary)_7%,transparent),transparent_35%),var(--card)]"
    role="region"
    aria-labelledby="formula-preview-title"
  >
    <div class="flex items-start justify-between gap-4">
      <div>
        <p class="m-0 text-[.7rem] font-[750] tracking-[.12em] text-primary uppercase">
          Formula guide
        </p>
        <h4 id="formula-preview-title" class="mt-[.15rem] mb-0 text-base">
          Formula preview
        </h4>
      </div>
      <div class="flex items-center gap-[.35rem]">
        <Button
          type="button"
          size="xs"
          variant="ghost"
          data-help-topic="author/formulas"
          @click="emit('learn')"
        >
          {{ t("help.learn.formulas") }}
        </Button>
        <code class="rounded-full border border-border bg-background px-[.4rem] py-[.2rem] text-[.68rem] text-muted-foreground">
          decimal only
        </code>
      </div>
    </div>

    <p class="my-3 text-[.8rem] leading-normal text-muted-foreground">
      Use decimal numbers, Variable IDs, <code>+ - * /</code>, and parentheses.
    </p>
    <div class="flex flex-wrap gap-[.35rem]" aria-label="Supported Formula functions">
      <code class="rounded-[.25rem] bg-muted px-[.4rem] py-[.2rem] text-[.72rem] text-foreground">min(a, b)</code>
      <code class="rounded-[.25rem] bg-muted px-[.4rem] py-[.2rem] text-[.72rem] text-foreground">max(a, b)</code>
      <code class="rounded-[.25rem] bg-muted px-[.4rem] py-[.2rem] text-[.72rem] text-foreground">round(value, places)</code>
      <code class="rounded-[.25rem] bg-muted px-[.4rem] py-[.2rem] text-[.72rem] text-foreground">ceil(value)</code>
      <code class="rounded-[.25rem] bg-muted px-[.4rem] py-[.2rem] text-[.72rem] text-foreground">floor(value)</code>
    </div>
    <p class="my-3 text-[.8rem] leading-normal text-muted-foreground">
      Example:
      <code class="rounded-[.25rem] bg-muted px-[.4rem] py-[.2rem] text-[.72rem] text-foreground">round(max(sampleVolume * 3, 0.89), 2)</code>
    </p>

    <div class="mt-3 grid gap-[.45rem] border-t border-border pt-3 text-[.76rem]">
      <strong>Available numeric and Duration Variable IDs</strong>
      <div v-if="numericReferences.length" class="flex flex-wrap gap-[.35rem]">
        <code
          v-for="variable in numericReferences"
          :key="variable.id"
          class="rounded-[.25rem] bg-muted px-[.4rem] py-[.2rem] text-[.72rem] text-foreground"
        >
          {{ variable.id }}
        </code>
      </div>
      <span v-else class="text-muted-foreground">
        Add a Numeric or Duration Input Variable before referencing it.
      </span>
    </div>

    <div
      v-if="inputDefinitions.some(variable => variable.valueType === 'numeric' || variable.valueType === 'duration')"
      class="mt-3 grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-[.6rem]"
    >
      <label
        v-for="variable in inputDefinitions.filter(
          candidate => candidate.valueType === 'numeric' || candidate.valueType === 'duration',
        )"
        :key="variable.id"
        class="m-0 text-[.74rem]"
      >
        Preview value for {{ variable.label }}<template v-if="variable.valueType === 'duration' && isDurationUnit(variable.unit)"> ({{ ProtocolCore.durationSymbol(variable.unit) }})</template>
        <input
          class="mt-[.35rem] w-full rounded-[calc(var(--radius)-2px)] border border-input bg-background p-2 font-mono text-foreground"
          :value="previewValues[variable.id]"
          inputmode="decimal"
          @input="
            previewValues[variable.id] =
              ($event.currentTarget as HTMLInputElement).value
          "
        >
      </label>
    </div>

    <div
      class="mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-3 rounded-[calc(var(--radius)-2px)] border border-border bg-background px-3 py-[.65rem] text-[.78rem]"
      :data-state="previewResult === undefined ? 'pending' : 'ready'"
    >
      <span class="font-bold text-muted-foreground uppercase">Result</span>
      <strong
        v-if="previewResult !== undefined"
        data-testid="formula-result"
        class="font-mono text-[1.05rem] text-primary"
      >
        {{ previewResult }}
      </strong>
      <span v-else-if="!previewDefinition">
        Enter a Variable ID and Formula to preview.
      </span>
      <ul v-else-if="evaluation && !evaluation.ok" role="alert" class="m-0 pl-[1.1rem] text-destructive">
        <li
          v-for="error in evaluation.errors"
          :key="`${error.path}:${error.code}`"
        >
          {{ error.message }}
        </li>
      </ul>
    </div>
    <p class="mt-3 mb-0 text-[.72rem] leading-normal text-muted-foreground">
      Preview uses the same deterministic Decimal evaluator as publication.
      Add a Formula Test Case to make expected results part of the signed
      Protocol.
    </p>
  </section>
</template>
