<script setup lang="ts">
import { computed } from "vue";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { locale, setLocale, t, type Locale } from "@/locales";

const selectedLocale = computed<Locale>({
  get: () => locale.value,
  set: (value) => setLocale(value),
});
</script>

<template>
  <div class="flex min-w-0 items-center gap-2">
    <span
      id="locale-select-label"
      class="text-xs font-[650] text-muted-foreground max-[34rem]:sr-only"
    >
      {{ t("locale.label") }}
    </span>
    <Select v-model="selectedLocale">
      <SelectTrigger
        aria-labelledby="locale-select-label"
        class="w-[8.75rem] max-w-full max-[34rem]:w-[7.5rem]"
        size="sm"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="en">{{ t("locale.en") }}</SelectItem>
        <SelectItem value="zh-CN">{{ t("locale.zh-CN") }}</SelectItem>
      </SelectContent>
    </Select>
  </div>
</template>
