<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { t } from "@/locales";

type Appearance = "light" | "dark" | "system";

const storageKey = "protocol-box:appearance";
const systemDark = window.matchMedia("(prefers-color-scheme: dark)");

function readAppearance(): Appearance {
  try {
    const stored = localStorage.getItem(storageKey);
    return stored === "light" || stored === "dark" || stored === "system"
      ? stored
      : "system";
  } catch {
    return "system";
  }
}

const appearance = ref<Appearance>(readAppearance());

function applyAppearance(): void {
  const dark =
    appearance.value === "dark" ||
    (appearance.value === "system" && systemDark.matches);
  document.documentElement.classList.toggle("dark", dark);
}

function saveAppearance(value: Appearance): void {
  try {
    localStorage.setItem(storageKey, value);
  } catch {
    // Appearance storage is optional; the selected mode remains active.
  }
}

function handleSystemAppearance(): void {
  if (appearance.value === "system") applyAppearance();
}

watch(appearance, (value) => {
  applyAppearance();
  saveAppearance(value);
});

applyAppearance();

onMounted(() => {
  systemDark.addEventListener("change", handleSystemAppearance);
});

onBeforeUnmount(() => {
  systemDark.removeEventListener("change", handleSystemAppearance);
});
</script>

<template>
  <div class="flex max-w-full items-center gap-2">
    <span id="appearance-label" class="sr-only text-sm font-medium sm:not-sr-only">
      {{ t("appearance.label") }}
    </span>
    <Select v-model="appearance">
      <SelectTrigger
        aria-labelledby="appearance-label"
        class="w-28 max-w-full"
        size="sm"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="light">{{ t("appearance.light") }}</SelectItem>
        <SelectItem value="dark">{{ t("appearance.dark") }}</SelectItem>
        <SelectItem value="system">{{ t("appearance.system") }}</SelectItem>
      </SelectContent>
    </Select>
  </div>
</template>
