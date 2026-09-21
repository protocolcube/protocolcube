import { defineStore } from "pinia";
import { ProtocolCore } from "../domain/protocol";

export type DocumentClassification = "application" | "published-protocol";
export type PendingForkIntent = "create" | "return" | undefined;

interface AppShellState {
  documentClassification: DocumentClassification;
  originalPublishedProtocolHtml: string | undefined;
  pendingForkIntent: PendingForkIntent;
  editableForkDraftId: string | undefined;
  crossShellRouteIntent: string | undefined;
}

function classifyDocument(html: string): DocumentClassification {
  const envelope = ProtocolCore.extractEnvelope(html);
  return envelope.ok &&
    envelope.envelope.documentKind === "protocol-box/published-protocol"
    ? "published-protocol"
    : "application";
}

export const useAppShellStore = defineStore("app-shell", {
  state: (): AppShellState => ({
    documentClassification: "application",
    originalPublishedProtocolHtml: undefined,
    pendingForkIntent: undefined,
    editableForkDraftId: undefined,
    crossShellRouteIntent: undefined,
  }),
  getters: {
    readerMode: (state) => state.documentClassification === "published-protocol",
  },
  actions: {
    inspectDocument(html: string): void {
      this.documentClassification = classifyDocument(html);
      this.originalPublishedProtocolHtml =
        this.documentClassification === "published-protocol" ? html : undefined;
    },
    requestFork(intent: Exclude<PendingForkIntent, undefined>): void {
      this.pendingForkIntent = intent;
    },
    clearForkIntent(): void {
      this.pendingForkIntent = undefined;
    },
    setEditableForkDraft(draftId: string | undefined): void {
      this.editableForkDraftId = draftId;
    },
    setCrossShellRouteIntent(route: string | undefined): void {
      this.crossShellRouteIntent = route;
    },
  },
});

export { classifyDocument };
