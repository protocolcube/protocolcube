import { indexedDB } from "fake-indexeddb";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
import type { Protocol } from "../../domain/protocol";
import { useAuthorStore } from "./store";

function protocol(): Protocol {
  return {
    protocolId: crypto.randomUUID(),
    title: "Store test Protocol",
    sections: [
      {
        sectionId: crypto.randomUUID(),
        title: "Procedure",
        markdown: "",
        duration: { kind: "untimed" },
        endAction: "wait",
      },
    ],
    variables: [],
    formulaTestCases: [],
  };
}

describe("Author store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("keeps its Workspace private while synchronizing lifecycle snapshots", async () => {
    const author = useAuthorStore();

    expect("workspace" in author).toBe(false);
    expect(await author.openWorkspace({
      databaseName: `author-store-${crypto.randomUUID()}`,
      indexedDB,
    })).toBe(true);
    expect(author.capabilities.workspaceOpen).toBe(true);
    expect(author.snapshot).toEqual({ mode: "locked" });

    const { bundle, recoveryCopy } = await author.createKeyBundle({
      passphrase: "store test passphrase",
    });
    expect(recoveryCopy).toEqual({ status: "cached" });
    expect(author.snapshot).toMatchObject({
      mode: "unlocked",
      keyId: bundle.keyId,
    });
    expect(author.recoveryCopies).toHaveLength(1);

    await author.createDraft(protocol());
    expect(author.editing?.protocol.title).toBe("Store test Protocol");
    author.updateSection(author.editing!.protocol.sections[0]!.sectionId, {
      title: "Updated Procedure",
    });
    expect(author.editing?.protocol.sections[0]?.title).toBe("Updated Procedure");

    await author.lock();
    expect(author.snapshot).toEqual({ mode: "locked" });
    await author.closeWorkspace();
  });

  it("caches validated bundles during unlock and retrieves a recovery copy on demand", async () => {
    const author = useAuthorStore();
    await author.openWorkspace({
      databaseName: `author-store-recovery-${crypto.randomUUID()}`,
      indexedDB,
    });
    const { bundle } = await author.createKeyBundle({
      passphrase: "recovery passphrase",
    });
    await author.lock();

    expect(
      await author.unlockKeyBundle(bundle, "recovery passphrase"),
    ).toEqual({ status: "cached" });
    await author.lock();

    const recovery = await author.retrieveRecoveryCopy(bundle.keyId);
    expect(recovery.keyBundle).toEqual(bundle);
    expect(author.recoveryCopies).toEqual([
      expect.objectContaining({ keyId: bundle.keyId }),
    ]);
    await author.closeWorkspace();
  });

  it("exposes recovery-copy metadata and forgetting without exposing its Key Bundle", async () => {
    const author = useAuthorStore();
    await author.openWorkspace({
      databaseName: `author-store-forget-recovery-${crypto.randomUUID()}`,
      indexedDB,
    });
    const { bundle } = await author.createKeyBundle({
      passphrase: "forget recovery passphrase",
    });

    expect(author.recoveryCopies).toEqual([
      expect.objectContaining({
        keyId: bundle.keyId,
        savedAt: expect.any(Number),
      }),
    ]);
    expect(author.recoveryCopies[0]).not.toHaveProperty("keyBundle");

    author.markNewKeyRecoveryReminder(bundle.keyId);
    expect(author.newKeyRecoveryReminderKeyId).toBe(bundle.keyId);
    author.clearNewKeyRecoveryReminder(bundle.keyId);
    expect(author.newKeyRecoveryReminderKeyId).toBeUndefined();

    await author.forgetRecoveryCopy(bundle.keyId);
    expect(author.recoveryCopies).toEqual([]);
    await expect(author.retrieveRecoveryCopy(bundle.keyId)).rejects.toMatchObject({
      code: "recovery_copy_not_found",
    });
    await author.closeWorkspace();
  });
});
