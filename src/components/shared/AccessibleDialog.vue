<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const props = withDefaults(
  defineProps<{
    title: string;
    confirmLabel: string;
    secondaryLabel?: string;
    cancelLabel?: string;
    dismissible?: boolean;
    confirmDisabled?: boolean;
  }>(),
  {
    cancelLabel: "Cancel",
    dismissible: true,
  },
);

const emit = defineEmits<{
  confirm: [];
  secondary: [];
  cancel: [];
}>();

const confirmButton = ref<{ $el: HTMLButtonElement }>();
const opener =
  document.activeElement instanceof HTMLElement
    ? document.activeElement
    : undefined;

function confirm(): void {
  emit("confirm");
}

function cancel(): void {
  if (props.dismissible) emit("cancel");
}

function handleOpen(open: boolean): void {
  if (!open) cancel();
}

function focusPrimary(event: Event): void {
  event.preventDefault();
  confirmButton.value?.$el.focus();
}

function handleEscape(event: KeyboardEvent): void {
  if (!props.dismissible) event.preventDefault();
}

function preventOutsideDismissal(event: Event): void {
  event.preventDefault();
}

onBeforeUnmount(() => {
  opener?.focus();
});
</script>

<template>
  <Dialog :open="true" @update:open="handleOpen">
    <DialogContent
      :id="$attrs.id as string"
      :show-close-button="false"
      @open-auto-focus="focusPrimary"
      @escape-key-down="handleEscape"
      @pointer-down-outside="preventOutsideDismissal"
      @interact-outside="preventOutsideDismissal"
    >
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription as-child>
          <div class="space-y-3 text-left">
            <slot />
          </div>
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button
          ref="confirmButton"
          type="button"
          :disabled="confirmDisabled"
          @click="confirm"
        >
          {{ confirmLabel }}
        </Button>
        <Button
          v-if="secondaryLabel"
          type="button"
          variant="outline"
          @click="emit('secondary')"
        >
          {{ secondaryLabel }}
        </Button>
        <Button
          v-if="dismissible"
          type="button"
          variant="outline"
          @click="cancel"
        >
          {{ cancelLabel }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
