<script setup lang="ts">
import { t } from "@/locales";

defineProps<{
  /** Currently declared Duration Unit of the Variable Definition. */
  unit: string;
}>();

const emit = defineEmits<{
  change: [unit: string];
}>();
</script>

<template>
  <!--
    The four-option Duration Unit picker (frozen enum, see ADR 0014) for the
    inspector's Duration Derived and Duration Input forms. The wrapping
    label stays at the call site so the accessible name is unchanged, and
    the new-variable form keeps its shadcn Select counterpart over the same
    four localized options.
  -->
  <select
    :value="unit"
    @change="emit('change', ($event.target as HTMLSelectElement).value)"
  >
    <option value="second">{{ t("author.variable.durationUnit.second") }}</option>
    <option value="minute">{{ t("author.variable.durationUnit.minute") }}</option>
    <option value="hour">{{ t("author.variable.durationUnit.hour") }}</option>
    <option value="day">{{ t("author.variable.durationUnit.day") }}</option>
  </select>
</template>
