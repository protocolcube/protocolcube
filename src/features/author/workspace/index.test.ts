import { indexedDB } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { ProtocolCore, type Protocol } from "../../../domain/protocol";
import {
  AuthorWorkspace,
  type EncryptedDraftRecord,
} from "./index";

const protocol: Protocol = {
  protocolId: "018f7f3e-7b1d-7a91-bf10-8f767a9c0f61",
  title: "细胞培养",
  sections: [
    {
      sectionId: "018f7f3e-7b1d-7a91-bf10-8f767a9c0f62",
      title: "准备",
      markdown: "准备培养基。",
      duration: { kind: "untimed" },
      endAction: "wait",
    },
  ],
  variables: [],
  formulaTestCases: [],
};

describe("AuthorWorkspace", () => {
  it("preserves encrypted records while upgrading IndexedDB", async () => {
    const databaseName = `author-upgrade-${crypto.randomUUID()}`;
    const seeded = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("drafts", { keyPath: "draftId" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const record: EncryptedDraftRecord = {
      draftId: crypto.randomUUID(),
      keyId: "a".repeat(64),
      updatedAt: 1,
      salt: "AA",
      iv: "AA",
      ciphertext: "AA",
      snapshots: [],
    };
    await new Promise<void>((resolve, reject) => {
      const request = seeded.transaction("drafts", "readwrite")
        .objectStore("drafts").put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    seeded.close();

    const workspace = await AuthorWorkspace.open({ databaseName, indexedDB });
    const upgraded = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 3);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const preserved = await new Promise<EncryptedDraftRecord>(
      (resolve, reject) => {
        const request = upgraded.transaction("drafts", "readonly")
          .objectStore("drafts").get(record.draftId);
        request.onsuccess = () => resolve(request.result as EncryptedDraftRecord);
        request.onerror = () => reject(request.error);
      },
    );

    expect(preserved).toEqual(record);
    expect(upgraded.objectStoreNames.contains("recoveryCopies")).toBe(true);
    upgraded.close();
    await workspace.close();
  });

  it("caches a validated Key Bundle and retrieves an isolated copy while locked", async () => {
    const keys = await ProtocolCore.generateAuthorKeyPair();
    const workspace = await AuthorWorkspace.open({
      databaseName: `author-recovery-${crypto.randomUUID()}`,
      indexedDB,
    });
    const bundle = await workspace.createKeyBundle({
      privateKeyPkcs8: await ProtocolCore.exportPrivateKeyPkcs8(
        keys.privateKey,
      ),
      publicKeySpki: await ProtocolCore.exportPublicKeySpki(keys.publicKey),
      passphrase: "recovery passphrase",
      iterations: 600_000,
    });

    await workspace.unlockKeyBundle(bundle, "recovery passphrase");
    const saved = await workspace.cacheRecoveryCopy(bundle, {
      sourceFileName: "author-key.json",
    });
    await workspace.lock();

    expect(await workspace.listRecoveryCopies()).toEqual([saved]);
    const recovered = await workspace.retrieveRecoveryCopy(bundle.keyId);
    expect(recovered).toEqual({ ...saved, keyBundle: bundle });
    recovered.keyBundle.ciphertext = "mutated";
    expect((await workspace.retrieveRecoveryCopy(bundle.keyId)).keyBundle).toEqual(
      bundle,
    );
  });

  it("requires explicit replacement for a different validated copy of the same Author Key", async () => {
    const keys = await ProtocolCore.generateAuthorKeyPair();
    const workspace = await AuthorWorkspace.open({
      databaseName: `author-recovery-${crypto.randomUUID()}`,
      indexedDB,
    });
    const privateKeyPkcs8 = await ProtocolCore.exportPrivateKeyPkcs8(
      keys.privateKey,
    );
    const publicKeySpki = await ProtocolCore.exportPublicKeySpki(keys.publicKey);
    const original = await workspace.createKeyBundle({
      privateKeyPkcs8,
      publicKeySpki,
      passphrase: "first passphrase",
      iterations: 600_000,
    });
    const replacement = await workspace.createKeyBundle({
      privateKeyPkcs8,
      publicKeySpki,
      passphrase: "second passphrase",
      iterations: 600_000,
    });

    await workspace.unlockKeyBundle(original, "first passphrase");
    const originalSummary = await workspace.cacheRecoveryCopy(original);
    expect(await workspace.cacheRecoveryCopy(original)).toEqual(originalSummary);

    await workspace.unlockKeyBundle(replacement, "second passphrase");
    await expect(workspace.cacheRecoveryCopy(replacement)).rejects.toMatchObject({
      code: "recovery_copy_replacement_required",
      path: "replace",
    });
    const replacementSummary = await workspace.cacheRecoveryCopy(replacement, {
      replace: true,
      sourceFileName: "replacement-key.json",
    });

    expect(await workspace.retrieveRecoveryCopy(original.keyId)).toEqual({
      ...replacementSummary,
      keyBundle: replacement,
    });
  });

  it("rejects unvalidated or mismatched Recovery Copies", async () => {
    const keys = await ProtocolCore.generateAuthorKeyPair();
    const otherKeys = await ProtocolCore.generateAuthorKeyPair();
    const workspace = await AuthorWorkspace.open({
      databaseName: `author-recovery-${crypto.randomUUID()}`,
      indexedDB,
    });
    const privateKeyPkcs8 = await ProtocolCore.exportPrivateKeyPkcs8(
      keys.privateKey,
    );
    const publicKeySpki = await ProtocolCore.exportPublicKeySpki(keys.publicKey);
    const bundle = await workspace.createKeyBundle({
      privateKeyPkcs8,
      publicKeySpki,
      passphrase: "matching passphrase",
      iterations: 600_000,
    });
    const unvalidatedSameKey = await workspace.createKeyBundle({
      privateKeyPkcs8,
      publicKeySpki,
      passphrase: "other passphrase",
      iterations: 600_000,
    });
    const otherBundle = await workspace.createKeyBundle({
      privateKeyPkcs8: await ProtocolCore.exportPrivateKeyPkcs8(
        otherKeys.privateKey,
      ),
      publicKeySpki: await ProtocolCore.exportPublicKeySpki(otherKeys.publicKey),
      passphrase: "different key passphrase",
      iterations: 600_000,
    });

    await workspace.unlockKeyBundle(bundle, "matching passphrase");
    await expect(workspace.cacheRecoveryCopy(unvalidatedSameKey)).rejects
      .toMatchObject({ code: "recovery_copy_not_validated", path: "keyBundle" });
    await expect(workspace.cacheRecoveryCopy(otherBundle)).rejects.toMatchObject({
      code: "recovery_copy_key_mismatch",
      path: "keyBundle.keyId",
    });
  });

  it("forgets Recovery Copies without deleting Drafts and identifies Draft keys while locked", async () => {
    const keys = await ProtocolCore.generateAuthorKeyPair();
    const otherKeys = await ProtocolCore.generateAuthorKeyPair();
    const workspace = await AuthorWorkspace.open({
      databaseName: `author-recovery-${crypto.randomUUID()}`,
      indexedDB,
    });
    const bundle = await workspace.createKeyBundle({
      privateKeyPkcs8: await ProtocolCore.exportPrivateKeyPkcs8(
        keys.privateKey,
      ),
      publicKeySpki: await ProtocolCore.exportPublicKeySpki(keys.publicKey),
      passphrase: "draft passphrase",
      iterations: 600_000,
    });
    const otherBundle = await workspace.createKeyBundle({
      privateKeyPkcs8: await ProtocolCore.exportPrivateKeyPkcs8(
        otherKeys.privateKey,
      ),
      publicKeySpki: await ProtocolCore.exportPublicKeySpki(otherKeys.publicKey),
      passphrase: "other draft passphrase",
      iterations: 600_000,
    });

    await workspace.unlockKeyBundle(bundle, "draft passphrase");
    const { draftId } = await workspace.createDraft(protocol);
    await workspace.saveDraft();
    await workspace.cacheRecoveryCopy(bundle);
    await workspace.unlockKeyBundle(otherBundle, "other draft passphrase");
    await workspace.cacheRecoveryCopy(otherBundle);
    await workspace.lock();

    expect(await workspace.identifyDraft(draftId)).toEqual({
      draftId,
      keyId: bundle.keyId,
    });
    await expect(workspace.identifyDraft("not-a-draft-id")).rejects.toMatchObject({
      code: "invalid_draft_id",
      path: "draftId",
    });
    await expect(workspace.identifyDraft(crypto.randomUUID())).rejects
      .toMatchObject({ code: "draft_not_found", path: "draftId" });

    await workspace.forgetRecoveryCopy(bundle.keyId);
    expect(await workspace.listRecoveryCopies()).toEqual([
      expect.objectContaining({ keyId: otherBundle.keyId }),
    ]);
    await workspace.forgetAllRecoveryCopies();
    expect(await workspace.listRecoveryCopies()).toEqual([]);

    await workspace.unlockKeyBundle(bundle, "draft passphrase");
    await workspace.restoreDraft(draftId);
    expect(workspace.snapshot()).toMatchObject({
      mode: "editing",
      draft: { draftId, protocol },
    });
  });

  it("does not cache a Key Bundle after unlock fails", async () => {
    const keys = await ProtocolCore.generateAuthorKeyPair();
    const workspace = await AuthorWorkspace.open({
      databaseName: `author-recovery-${crypto.randomUUID()}`,
      indexedDB,
    });
    const bundle = await workspace.createKeyBundle({
      privateKeyPkcs8: await ProtocolCore.exportPrivateKeyPkcs8(
        keys.privateKey,
      ),
      publicKeySpki: await ProtocolCore.exportPublicKeySpki(keys.publicKey),
      passphrase: "correct passphrase",
      iterations: 600_000,
    });

    await expect(workspace.unlockKeyBundle(bundle, "incorrect passphrase"))
      .rejects.toMatchObject({ code: "key_bundle_unlock_failed" });
    await expect(workspace.cacheRecoveryCopy(bundle)).rejects.toMatchObject({
      code: "workspace_locked",
      path: "keyBundle",
    });
    expect(await workspace.listRecoveryCopies()).toEqual([]);
  });

  it("restores an encrypted Unsigned Draft after unlocking its Key Bundle", async () => {
    const keys = await ProtocolCore.generateAuthorKeyPair();
    const privateKeyPkcs8 = await ProtocolCore.exportPrivateKeyPkcs8(
      keys.privateKey,
    );
    const publicKeySpki = await ProtocolCore.exportPublicKeySpki(
      keys.publicKey,
    );
    const databaseName = `author-workspace-${crypto.randomUUID()}`;
    const workspace = await AuthorWorkspace.open({ databaseName, indexedDB });
    const keyBundle = await workspace.createKeyBundle({
      privateKeyPkcs8,
      publicKeySpki,
      passphrase: "correct horse battery staple",
      iterations: 600_000,
    });

    await expect(
      workspace.unlockKeyBundle(keyBundle, "wrong passphrase"),
    ).rejects.toMatchObject({ code: "key_bundle_unlock_failed" });
    await workspace.unlockKeyBundle(
      keyBundle,
      "correct horse battery staple",
    );
    const created = await workspace.createDraft(protocol);
    await workspace.saveDraft();
    expect(await workspace.listDrafts()).toContainEqual({
      draftId: created.draftId,
      keyId: keyBundle.keyId,
      updatedAt: expect.any(Number),
      status: "available",
      title: protocol.title,
    });

    const restoredWorkspace = await AuthorWorkspace.open({
      databaseName,
      indexedDB,
    });
    await restoredWorkspace.unlockKeyBundle(
      keyBundle,
      "correct horse battery staple",
    );
    await restoredWorkspace.restoreDraft(created.draftId);

    expect(restoredWorkspace.snapshot()).toMatchObject({
      mode: "editing",
      keyId: keyBundle.keyId,
      draft: {
        draftId: created.draftId,
        protocol,
      },
    });
    restoredWorkspace.closeDraft();
    expect(restoredWorkspace.snapshot()).toEqual({
      mode: "unlocked",
      keyId: keyBundle.keyId,
    });
  });

  it("calibrates PBKDF2 without dropping below the security floor", async () => {
    const workspace = await AuthorWorkspace.open({
      databaseName: `author-workspace-${crypto.randomUUID()}`,
      indexedDB,
    });

    const iterations = await workspace.calibrateKeyBundleIterations({
      passphrase: "calibration passphrase",
      targetMilliseconds: 500,
    });

    expect(iterations).toBeGreaterThanOrEqual(600_000);
  });

  it("retains the two most recent encrypted recovery snapshots", async () => {
    const keys = await ProtocolCore.generateAuthorKeyPair();
    const workspace = await AuthorWorkspace.open({
      databaseName: `author-workspace-${crypto.randomUUID()}`,
      indexedDB,
    });
    const bundle = await workspace.createKeyBundle({
      privateKeyPkcs8: await ProtocolCore.exportPrivateKeyPkcs8(
        keys.privateKey,
      ),
      publicKeySpki: await ProtocolCore.exportPublicKeySpki(keys.publicKey),
      passphrase: "snapshot passphrase",
      iterations: 600_000,
    });
    await workspace.unlockKeyBundle(bundle, "snapshot passphrase");
    const { draftId } = await workspace.createDraft(protocol);
    await workspace.saveDraft();
    workspace.updateProtocol({ ...protocol, title: "Version 2" });
    await workspace.saveDraft();
    workspace.updateProtocol({ ...protocol, title: "Version 3" });
    await workspace.saveDraft();
    workspace.updateProtocol({ ...protocol, title: "Version 4" });
    await workspace.saveDraft();

    expect(await workspace.listRecoverySnapshots(draftId)).toHaveLength(2);
    await workspace.restoreRecoverySnapshot(draftId, 1);
    expect(workspace.snapshot()).toMatchObject({
      draft: { protocol: { title: "Version 2" } },
    });
  });

  it("saves the current Unsigned Draft before active lock", async () => {
    const keys = await ProtocolCore.generateAuthorKeyPair();
    const databaseName = `author-workspace-${crypto.randomUUID()}`;
    const workspace = await AuthorWorkspace.open({ databaseName, indexedDB });
    const bundle = await workspace.createKeyBundle({
      privateKeyPkcs8: await ProtocolCore.exportPrivateKeyPkcs8(
        keys.privateKey,
      ),
      publicKeySpki: await ProtocolCore.exportPublicKeySpki(keys.publicKey),
      passphrase: "lock passphrase",
      iterations: 600_000,
    });
    await workspace.unlockKeyBundle(bundle, "lock passphrase");
    const { draftId } = await workspace.createDraft(protocol);
    workspace.updateProtocol({ ...protocol, title: "Saved before lock" });

    await workspace.lock();

    expect(workspace.snapshot()).toEqual({ mode: "locked" });
    await workspace.unlockKeyBundle(bundle, "lock passphrase");
    await workspace.restoreDraft(draftId);
    expect(workspace.snapshot()).toMatchObject({
      draft: { protocol: { title: "Saved before lock" } },
    });
  });

  it("automatically locks 15 minutes after the latest Author activity", async () => {
    let scheduled:
      | { callback: () => void | Promise<void>; delay: number }
      | undefined;
    const scheduler = {
      setTimeout(callback: () => void | Promise<void>, delay: number) {
        scheduled = { callback, delay };
        return 1;
      },
      clearTimeout() {
        scheduled = undefined;
      },
    };
    const keys = await ProtocolCore.generateAuthorKeyPair();
    const workspace = await AuthorWorkspace.open({
      databaseName: `author-workspace-${crypto.randomUUID()}`,
      indexedDB,
      scheduler,
    });
    const bundle = await workspace.createKeyBundle({
      privateKeyPkcs8: await ProtocolCore.exportPrivateKeyPkcs8(
        keys.privateKey,
      ),
      publicKeySpki: await ProtocolCore.exportPublicKeySpki(keys.publicKey),
      passphrase: "timer passphrase",
      iterations: 600_000,
    });
    await workspace.unlockKeyBundle(bundle, "timer passphrase");
    await workspace.createDraft(protocol);

    workspace.recordActivity();

    expect(scheduled?.delay).toBe(15 * 60 * 1_000);
    await scheduled?.callback();
    expect(workspace.snapshot()).toEqual({ mode: "locked" });
  });

  it("reports malformed Key Bundle structure without guessing missing metadata", async () => {
    const workspace = await AuthorWorkspace.open({
      databaseName: `author-workspace-${crypto.randomUUID()}`,
      indexedDB,
    });

    await expect(
      workspace.unlockKeyBundle(
        {
          documentKind: "protocol-box/key-bundle",
          formatVersion: 1,
        } as unknown as Parameters<typeof workspace.unlockKeyBundle>[0],
        "passphrase",
      ),
    ).rejects.toMatchObject({
      code: "invalid_key_bundle",
      path: "keyBundle",
    });
  });

  it("quarantines an authentication-failed Draft without deleting it", async () => {
    const keys = await ProtocolCore.generateAuthorKeyPair();
    const databaseName = `author-workspace-${crypto.randomUUID()}`;
    const workspace = await AuthorWorkspace.open({ databaseName, indexedDB });
    const bundle = await workspace.createKeyBundle({
      privateKeyPkcs8: await ProtocolCore.exportPrivateKeyPkcs8(
        keys.privateKey,
      ),
      publicKeySpki: await ProtocolCore.exportPublicKeySpki(keys.publicKey),
      passphrase: "quarantine passphrase",
      iterations: 600_000,
    });
    await workspace.unlockKeyBundle(bundle, "quarantine passphrase");
    const { draftId } = await workspace.createDraft(protocol);
    await workspace.saveDraft();

    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const record = await new Promise<Record<string, unknown>>(
      (resolve, reject) => {
        const request = database
          .transaction("drafts", "readonly")
          .objectStore("drafts")
          .get(draftId);
        request.onsuccess = () =>
          resolve(request.result as Record<string, unknown>);
        request.onerror = () => reject(request.error);
      },
    );
    await new Promise<void>((resolve, reject) => {
      const request = database
        .transaction("drafts", "readwrite")
        .objectStore("drafts")
        .put({ ...record, ciphertext: "AAAA" });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    database.close();

    await expect(workspace.restoreDraft(draftId)).rejects.toMatchObject({
      code: "draft_authentication_failed",
    });
    expect(await workspace.listDrafts()).toContainEqual({
      draftId,
      keyId: bundle.keyId,
      status: "quarantined",
      updatedAt: expect.any(Number),
    });
  });

  it("normalizes supported Markdown deterministically and rejects raw HTML", async () => {
    const workspace = await AuthorWorkspace.open({
      databaseName: `author-workspace-${crypto.randomUUID()}`,
      indexedDB,
    });

    expect(
      workspace.normalizeMarkdown("# Title\n\nHello **world**.\n"),
    ).toEqual({
      markdown: "# Title\n\nHello **world**.",
      content: expect.objectContaining({ type: "doc" }),
    });
    expect(() =>
      workspace.normalizeMarkdown("Safe text<script>alert(1)</script>"),
    ).toThrowError(
      expect.objectContaining({
        code: "raw_html_forbidden",
        path: "markdown",
      }),
    );
    expect(
      workspace.normalizeMarkdown("```\n<div>literal example</div>\n```")
        .markdown,
    ).toContain("<div>literal example</div>");
  });

  it("interpolates Variable Values only as escaped plain text", async () => {
    const workspace = await AuthorWorkspace.open({
      databaseName: `author-workspace-${crypto.randomUUID()}`,
      indexedDB,
    });

    expect(
      workspace.interpolateMarkdown("Dose: {{ sample }}", {
        sample: "<script>**bold**",
      }),
    ).toBe("Dose: &lt;script&gt;\\*\\*bold\\*\\*");
    expect(() =>
      workspace.interpolateMarkdown("Dose: {{ missing }}", {}),
    ).toThrowError(
      expect.objectContaining({
        code: "unknown_interpolation",
        path: "markdown",
      }),
    );
  });

  it("creates new Section identities and preserves them while reordering", async () => {
    const keys = await ProtocolCore.generateAuthorKeyPair();
    const workspace = await AuthorWorkspace.open({
      databaseName: `author-workspace-${crypto.randomUUID()}`,
      indexedDB,
    });
    const bundle = await workspace.createKeyBundle({
      privateKeyPkcs8: await ProtocolCore.exportPrivateKeyPkcs8(
        keys.privateKey,
      ),
      publicKeySpki: await ProtocolCore.exportPublicKeySpki(keys.publicKey),
      passphrase: "section passphrase",
      iterations: 600_000,
    });
    await workspace.unlockKeyBundle(bundle, "section passphrase");
    await workspace.createDraft(protocol);

    const addedId = workspace.addSection({
      title: "培养",
      markdown: "开始培养。",
      duration: { kind: "fixed", seconds: "60" },
      endAction: "advance",
    });
    const copiedId = workspace.copySection(addedId);
    workspace.reorderSection(copiedId, 0);

    const snapshot = workspace.snapshot();
    const sections = snapshot.mode === "editing"
      ? snapshot.draft.protocol.sections
      : [];
    expect(copiedId).not.toBe(addedId);
    expect(sections.map((section) => section.sectionId)).toEqual([
      copiedId,
      protocol.sections[0]!.sectionId,
      addedId,
    ]);
  });

  it("surfaces Protocol Core formula feedback while editing", async () => {
    const keys = await ProtocolCore.generateAuthorKeyPair();
    const workspace = await AuthorWorkspace.open({
      databaseName: `author-workspace-${crypto.randomUUID()}`,
      indexedDB,
    });
    const bundle = await workspace.createKeyBundle({
      privateKeyPkcs8: await ProtocolCore.exportPrivateKeyPkcs8(
        keys.privateKey,
      ),
      publicKeySpki: await ProtocolCore.exportPublicKeySpki(keys.publicKey),
      passphrase: "formula passphrase",
      iterations: 600_000,
    });
    await workspace.unlockKeyBundle(bundle, "formula passphrase");
    await workspace.createDraft(protocol);
    workspace.replaceVariables([
      {
        kind: "derived",
        id: "volume",
        label: "Volume",
        valueType: "numeric",
        formula: "missing + 1",
        precision: 2,
        roundingMode: "half-even",
      },
    ]);
    workspace.replaceFormulaTestCases([]);

    expect(workspace.inspectDraft()).toMatchObject({
      format: "valid",
      playable: false,
      errors: expect.arrayContaining([
        expect.objectContaining({ code: "unknown_variable" }),
        expect.objectContaining({ code: "missing_formula_test_case" }),
      ]),
    });
  });

  it("surfaces duration dimension diagnostics while editing", async () => {
    const keys = await ProtocolCore.generateAuthorKeyPair();
    const workspace = await AuthorWorkspace.open({
      databaseName: `author-workspace-${crypto.randomUUID()}`,
      indexedDB,
    });
    const bundle = await workspace.createKeyBundle({
      privateKeyPkcs8: await ProtocolCore.exportPrivateKeyPkcs8(
        keys.privateKey,
      ),
      publicKeySpki: await ProtocolCore.exportPublicKeySpki(keys.publicKey),
      passphrase: "duration formula passphrase",
      iterations: 600_000,
    });
    await workspace.unlockKeyBundle(bundle, "duration formula passphrase");
    await workspace.createDraft(protocol);
    workspace.replaceVariables([
      {
        kind: "input",
        id: "soakMinutes",
        label: "Soak duration",
        valueType: "duration",
        unit: "minute",
      },
      {
        kind: "input",
        id: "dilutionRatio",
        label: "Dilution ratio",
        valueType: "numeric",
      },
      {
        kind: "derived",
        id: "totalMinutes",
        label: "Total duration",
        valueType: "duration",
        unit: "minute",
        formula: "dilutionRatio + soakMinutes",
        precision: 2,
        roundingMode: "half-even",
      },
    ]);
    workspace.replaceFormulaTestCases([]);

    const inspection = workspace.inspectDraft();
    expect(inspection).toMatchObject({
      format: "valid",
      playable: false,
      errors: expect.arrayContaining([
        expect.objectContaining({
          code: "numeric_plus_duration",
          path: "variables.2.formula",
        }),
        expect.objectContaining({ code: "missing_formula_test_case" }),
      ]),
    });
    // A Duration Input is a legal formula operand, so the numeric-only
    // rejection must not appear for referencing soakMinutes.
    expect(
      inspection.errors.map((error) => error.code),
    ).not.toContain("non_numeric_variable");
  });

  it("imports Published Protocol data without executing its HTML wrapper", async () => {
    const keys = await ProtocolCore.generateAuthorKeyPair();
    const workspace = await AuthorWorkspace.open({
      databaseName: `author-workspace-${crypto.randomUUID()}`,
      indexedDB,
    });
    const bundle = await workspace.createKeyBundle({
      privateKeyPkcs8: await ProtocolCore.exportPrivateKeyPkcs8(keys.privateKey),
      publicKeySpki: await ProtocolCore.exportPublicKeySpki(keys.publicKey),
      passphrase: "import passphrase",
      iterations: 600_000,
    });
    await workspace.unlockKeyBundle(bundle, "import passphrase");
    const signature = await ProtocolCore.signProtocol(
      protocol,
      keys.privateKey,
      keys.publicKey,
    );
    const envelope = {
      documentKind: "protocol-box/published-protocol" as const,
      formatVersion: 1 as const,
      appVersion: "0.0.0",
      protocol,
      signature,
    };
    const hostileHtml = `<script>globalThis.executed = true</script><script id="protocol-box-data" type="application/octet-stream">${ProtocolCore.encodeEnvelope(envelope)}</script>`;

    await workspace.importPublishedProtocol(hostileHtml);

    expect(workspace.snapshot()).toMatchObject({
      mode: "editing",
      draft: {
        protocol,
        source: {
          fingerprint: await ProtocolCore.fingerprintProtocol(protocol),
          keyId: bundle.keyId,
        },
      },
    });
    expect((globalThis as typeof globalThis & { executed?: boolean }).executed)
      .toBeUndefined();

    const otherKeys = await ProtocolCore.generateAuthorKeyPair();
    const otherSignature = await ProtocolCore.signProtocol(
      protocol,
      otherKeys.privateKey,
      otherKeys.publicKey,
    );
    const otherHtml = `<script id="protocol-box-data" type="application/octet-stream">${ProtocolCore.encodeEnvelope({ ...envelope, signature: otherSignature })}</script>`;
    await expect(workspace.importPublishedProtocol(otherHtml)).rejects
      .toMatchObject({ code: "fork_required" });

    const fork = await workspace.importPublishedProtocol(otherHtml, {
      fork: true,
    });
    expect(workspace.snapshot()).toMatchObject({
      draft: {
        draftId: fork.draftId,
        protocol: {
          derivedFromFingerprint: await ProtocolCore.fingerprintProtocol(
            protocol,
          ),
        },
      },
    });
    const forkSnapshot = workspace.snapshot();
    expect(
      forkSnapshot.mode === "editing"
        ? forkSnapshot.draft.protocol.protocolId
        : undefined,
    ).not.toBe(protocol.protocolId);
    await workspace.saveDraft();
    expect(await workspace.listDrafts()).toContainEqual(
      expect.objectContaining({
        draftId: fork.draftId,
        source: {
          fingerprint: await ProtocolCore.fingerprintProtocol(protocol),
          keyId: otherSignature.keyId,
        },
      }),
    );

    await workspace.close();
    expect(workspace.snapshot()).toEqual({ mode: "locked" });
  });

  it("publishes the current Draft as signed HTML and a matching checksum", async () => {
    const keys = await ProtocolCore.generateAuthorKeyPair();
    const workspace = await AuthorWorkspace.open({
      databaseName: `author-publish-${crypto.randomUUID()}`,
      indexedDB,
    });
    const privateKeyPkcs8 = await ProtocolCore.exportPrivateKeyPkcs8(
      keys.privateKey,
    );
    const bundle = await workspace.createKeyBundle({
      privateKeyPkcs8,
      publicKeySpki: await ProtocolCore.exportPublicKeySpki(keys.publicKey),
      passphrase: "publish passphrase",
      iterations: 600_000,
    });
    await workspace.unlockKeyBundle(bundle, "publish passphrase");
    const { draftId } = await workspace.createDraft(protocol);
    await workspace.saveDraft();
    const files = new Map<string, string>();
    const applicationEnvelope = ProtocolCore.encodeEnvelope({
      documentKind: "protocol-box/application",
      formatVersion: 1,
      appVersion: "0.0.0",
      protocol: null,
      signature: null,
    });
    const applicationHtml = `<!doctype html><html><head><style>body{color:#111}</style></head><body><div id="app"></div><script id="protocol-box-data" type="application/octet-stream">${applicationEnvelope}</script><script>globalThis.protocolBoxLoaded=true</script></body></html>`;

    let validationSaveAttempts = 0;
    workspace.updateProtocol({
      ...protocol,
      variables: [
        {
          kind: "derived",
          id: "invalid",
          label: "Invalid",
          valueType: "numeric",
          formula: "missing + 1",
          precision: 2,
          roundingMode: "half-even",
        },
      ],
    });
    await expect(
      workspace.publishCurrentDraft({
        applicationHtml,
        appVersion: "0.0.0",
        fileName: "invalid.html",
        saveAdapter: {
          async saveHtml() {
            validationSaveAttempts += 1;
            throw new Error("must not write");
          },
          async saveChecksum() {
            throw new Error("must not write");
          },
        },
      }),
    ).rejects.toMatchObject({
      code: "protocol_not_playable",
      path: "draft.protocol",
    });
    expect(validationSaveAttempts).toBe(0);
    workspace.updateProtocol(protocol);

    let externalSaveAttempts = 0;
    await expect(
      workspace.publishCurrentDraft({
        applicationHtml: applicationHtml.replace(
          "</head>",
          '<script src="./app.js"></script></head>',
        ),
        appVersion: "0.0.0",
        fileName: "unsafe.html",
        saveAdapter: {
          async saveHtml() {
            externalSaveAttempts += 1;
            throw new Error("must not write");
          },
          async saveChecksum() {
            throw new Error("must not write");
          },
        },
      }),
    ).rejects.toMatchObject({
      code: "external_runtime_resource",
      path: "applicationHtml",
    });
    expect(externalSaveAttempts).toBe(0);

    let oversizedSaveAttempts = 0;
    await expect(
      workspace.publishCurrentDraft({
        applicationHtml: applicationHtml.replace(
          '<div id="app"></div>',
          `<div id="app">${"x".repeat(25 * 1024 * 1024)}</div>`,
        ),
        appVersion: "0.0.0",
        fileName: "oversized.html",
        saveAdapter: {
          async saveHtml() {
            oversizedSaveAttempts += 1;
            throw new Error("must not write");
          },
          async saveChecksum() {
            throw new Error("must not write");
          },
        },
      }),
    ).rejects.toMatchObject({
      code: "publication_resource_limit",
      path: "publishedHtml",
    });
    expect(oversizedSaveAttempts).toBe(0);

    await expect(
      workspace.publishCurrentDraft({
        applicationHtml,
        appVersion: "0.0.0",
        fileName: "cancelled.html",
        saveAdapter: {
          async saveHtml() {
            throw new DOMException("Author cancelled", "AbortError");
          },
          async saveChecksum() {
            throw new Error("must not write");
          },
        },
      }),
    ).rejects.toMatchObject({
      code: "publication_cancelled",
      path: "htmlFile",
    });
    expect(workspace.snapshot()).toMatchObject({
      mode: "editing",
      draft: { draftId },
    });

    await expect(
      workspace.publishCurrentDraft({
        applicationHtml,
        appVersion: "0.0.0",
        fileName: "denied.html",
        saveAdapter: {
          async saveHtml() {
            throw new DOMException("Permission denied", "NotAllowedError");
          },
          async saveChecksum() {
            throw new Error("must not write");
          },
        },
      }),
    ).rejects.toMatchObject({
      code: "publication_permission_denied",
      path: "htmlFile",
    });

    await expect(
      workspace.publishCurrentDraft({
        applicationHtml: applicationHtml.replace(
          "</body>",
          `<script id="protocol-box-data" type="application/octet-stream">${applicationEnvelope}</script></body>`,
        ),
        appVersion: "0.0.0",
        fileName: "ambiguous.html",
        saveAdapter: {
          async saveHtml() {
            throw new Error("must not write");
          },
          async saveChecksum() {
            throw new Error("must not write");
          },
        },
      }),
    ).rejects.toMatchObject({
      code: "invalid_application_template",
      path: "applicationHtml",
    });

    await expect(
      workspace.publishCurrentDraft({
        applicationHtml,
        appVersion: "0.0.0",
        fileName: "partial.html",
        saveAdapter: {
          async saveHtml(file) {
            files.set(file.name, new TextDecoder().decode(file.bytes));
            return { name: file.name };
          },
          async saveChecksum() {
            throw new Error("disk full");
          },
        },
      }),
    ).rejects.toMatchObject({
      code: "partial_publication",
      path: "checksumFile",
      details: {
        fileName: "partial.html",
        wholeFileSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      },
    });
    expect(files.has("partial.html")).toBe(true);
    expect(workspace.snapshot()).toMatchObject({
      mode: "editing",
      draft: { draftId },
    });
    expect(await workspace.listDrafts()).toEqual(
      expect.arrayContaining([expect.objectContaining({ draftId })]),
    );
    files.clear();

    const result = await workspace.publishCurrentDraft({
      applicationHtml,
      appVersion: "0.0.0",
      fileName: "cell-culture.html",
      saveAdapter: {
        async saveHtml(file) {
          files.set("renamed-culture.html", new TextDecoder().decode(file.bytes));
          return { name: "renamed-culture.html" };
        },
        async saveChecksum(file) {
          files.set(file.name, new TextDecoder().decode(file.bytes));
          return { name: file.name };
        },
      },
    });

    const publishedHtml = files.get("renamed-culture.html")!;
    expect(publishedHtml).not.toContain("publish passphrase");
    expect(publishedHtml).not.toContain(privateKeyPkcs8);
    expect(publishedHtml).not.toContain(bundle.ciphertext);
    expect(publishedHtml).not.toContain(draftId);
    const csp = publishedHtml.match(
      /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/,
    )?.[1];
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("connect-src 'none'");
    expect(csp).toContain("img-src data:");
    expect(csp).toContain("font-src data:");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("form-action 'none'");
    expect(csp).toContain("script-src-elem ");
    expect(csp).toContain("script-src-attr 'none'");
    expect(csp).toContain("style-src 'unsafe-inline'");
    expect(csp).toContain("style-src-elem 'unsafe-inline'");
    expect(csp).toContain("style-src-attr 'unsafe-inline'");
    const executableScript = "globalThis.protocolBoxLoaded=true";
    const scriptHash = btoa(String.fromCharCode(
      ...new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(executableScript),
        ),
      ),
    ));
    expect(csp).toContain(`'sha256-${scriptHash}'`);
    const digest = [...new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(publishedHtml),
      ),
    )].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    expect(result).toMatchObject({
      status: "published",
      fileName: "renamed-culture.html",
      checksumFileName: "renamed-culture.html.sha256",
      keyId: bundle.keyId,
      wholeFileSha256: digest,
    });
    expect(files.get("renamed-culture.html.sha256")).toBe(
      `${digest}  renamed-culture.html\n`,
    );
    const decoded = ProtocolCore.extractEnvelope(publishedHtml);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) throw new Error("Expected a Published Protocol envelope");
    await expect(ProtocolCore.inspectEnvelope(decoded.envelope)).resolves
      .toMatchObject({
        format: "valid",
        signature: "match",
        protocol,
      });
    expect(workspace.snapshot()).toMatchObject({ mode: "unlocked" });
    expect(await workspace.listDrafts()).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ draftId })]),
    );
  });
});
