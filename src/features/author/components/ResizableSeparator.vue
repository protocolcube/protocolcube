<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    label: string;
    step?: number;
  }>(),
  {
    step: 16,
  },
);

const emit = defineEmits<{
  resize: [delta: number];
  reset: [];
}>();

let previousX = 0;

function startResize(event: PointerEvent): void {
  previousX = event.clientX;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}

function resize(event: PointerEvent): void {
  const target = event.currentTarget as HTMLElement;
  if (!target.hasPointerCapture(event.pointerId)) return;
  const delta = event.clientX - previousX;
  previousX = event.clientX;
  emit("resize", delta);
}

function handleKey(event: KeyboardEvent): void {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  emit("resize", event.key === "ArrowLeft" ? -props.step : props.step);
}
</script>

<template>
  <div
    class="resize-separator group relative z-10 -mx-1 w-2 cursor-col-resize touch-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-[-1px]"
    role="separator"
    aria-orientation="vertical"
    :aria-label="label"
    tabindex="0"
    @pointerdown="startResize"
    @pointermove="resize"
    @keydown="handleKey"
    @dblclick="emit('reset')"
  >
    <span
      aria-hidden="true"
      class="absolute inset-y-0 left-[calc(50%-1px)] w-0.5 bg-border transition-colors duration-150 ease-out group-hover:bg-primary group-focus-visible:bg-primary"
    />
  </div>
</template>
