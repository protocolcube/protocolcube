import { ref } from "vue";

/** Ephemeral Authoring state shared by the command bar and the local editor. */
export const savedAuthoringCanonical = ref<string>();
export const authoringDirty = ref(false);

let authoringEditPending = false;
export function markAuthoringEditPending(): void { authoringEditPending = true; }
export function clearAuthoringEditPending(): void { authoringEditPending = false; }
export function hasAuthoringEditPending(): boolean { return authoringEditPending; }
