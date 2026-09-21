<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/cn"

const props = defineProps<{
  class?: HTMLAttributes["class"]
  ariaLabel?: string
}>()
</script>

<template>
  <div data-slot="table-container" class="relative w-full overflow-auto">
    <table
      data-slot="table"
      :aria-label="props.ariaLabel"
      :class="cn('w-full caption-bottom text-sm', props.class)"
    >
      <slot />
    </table>
  </div>
</template>
