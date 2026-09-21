import { describe, expect, it } from "vitest";
import {
  ProtocolCore,
  type Envelope,
  type Protocol,
} from "./index";

const validProtocol: Protocol = {
  protocolId: "018f7f3e-7b1d-7a91-bf10-8f767a9c0f51",
  title: "细胞培养",
  sections: [
    {
      sectionId: "018f7f3e-7b1d-7a91-bf10-8f767a9c0f52",
      title: "准备",
      markdown: "准备培养基。",
      duration: { kind: "untimed" },
      endAction: "wait",
    },
  ],
  variables: [],
  formulaTestCases: [],
};

const formulaProtocol: Protocol = {
  ...validProtocol,
  variables: [
    {
      kind: "input",
      id: "sampleVolume",
      label: "Sample volume",
      valueType: "numeric",
      defaultValue: "0.1",
    },
    {
      kind: "derived",
      id: "adjustedVolume",
      label: "Adjusted volume",
      valueType: "numeric",
      formula: "sampleVolume + 0.2",
      precision: 2,
      roundingMode: "half-even",
    },
    {
      kind: "derived",
      id: "totalVolume",
      label: "Total volume",
      valueType: "numeric",
      formula: "round(max(adjustedVolume * 3, 0.89), 2)",
      precision: 2,
      roundingMode: "half-even",
    },
  ],
  formulaTestCases: [
    {
      testCaseId: "018f7f3e-7b1d-7a91-bf10-8f767a9c0f53",
      name: "Decimal calculation",
      inputValues: { sampleVolume: "0.1" },
      expectedDerivedValues: {
        adjustedVolume: "0.3",
        totalVolume: "0.9",
      },
      precision: 2,
      roundingMode: "half-even",
    },
  ],
};

function uuid(index: number): string {
  return `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`;
}

describe("ProtocolCore", () => {
  it("accepts a valid Protocol", () => {
    const result = ProtocolCore.inspectProtocol(validProtocol);

    expect(result).toEqual({
      format: "valid",
      playable: true,
      errors: [],
    });
  });

  it("validates the Task Item Completion Requirement against Section Markdown", () => {
    const requiredSection = {
      ...validProtocol.sections[0]!,
      markdown: [
        "- [ ] First item",
        "- [x] Authored as checked",
        "",
        "```md",
        "- [ ] Not a rendered task item",
        "```",
      ].join("\n"),
      completionRequirement: "all-task-items" as const,
    };

    expect(ProtocolCore.countTaskItems(requiredSection.markdown)).toBe(2);
    expect(
      ProtocolCore.inspectProtocol({
        ...validProtocol,
        sections: [requiredSection],
      }),
    ).toMatchObject({
      format: "valid",
      playable: true,
      errors: [],
    });

    expect(
      ProtocolCore.inspectProtocol({
        ...validProtocol,
        sections: [
          {
            ...requiredSection,
            markdown: "No checklist is present.",
          },
        ],
      }),
    ).toMatchObject({
      format: "valid",
      playable: false,
      errors: [
        {
          code: "missing_task_items",
          path: "sections.0.completionRequirement",
          message: expect.any(String),
        },
      ],
    });
  });

  it("returns structured errors for an invalid Protocol", () => {
    const result = ProtocolCore.inspectProtocol({
      ...validProtocol,
      unexpected: true,
      sections: [{ ...validProtocol.sections[0], title: 42 }],
    });

    expect(result.format).toBe("invalid");
    expect(result.playable).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        {
          code: "unrecognized_field",
          path: "unexpected",
          message: expect.any(String),
        },
        {
          code: "invalid_type",
          path: "sections.0.title",
          message: expect.any(String),
        },
      ]),
    );
  });

  it("round-trips a Unicode Published Protocol Envelope", () => {
    const envelope: Envelope = {
      documentKind: "protocol-box/published-protocol",
      formatVersion: 1,
      appVersion: "0.0.0",
      protocol: validProtocol,
      signature: {
        algorithm: "ECDSA-P256-SHA256",
        publicKeySpki: "cHVibGljLWtleQ",
        keyId: "a".repeat(64),
        value: "A".repeat(86),
      },
    };

    const encoded = ProtocolCore.encodeEnvelope(envelope);

    expect(ProtocolCore.decodeEnvelope(encoded)).toEqual({
      ok: true,
      envelope,
    });
  });

  it("extracts exactly one inert Envelope data block without executing HTML", () => {
    const envelope: Envelope = {
      documentKind: "protocol-box/application",
      formatVersion: 1,
      appVersion: "0.0.0",
      protocol: null,
      signature: null,
    };
    const html = `<script>globalThis.hostile = true</script>
      <script id="protocol-box-data" type="application/octet-stream">
        ${ProtocolCore.encodeEnvelope(envelope)}
      </script>`;

    expect(ProtocolCore.extractEnvelope(html)).toEqual({
      ok: true,
      envelope,
    });
    expect("hostile" in globalThis).toBe(false);

    expect(ProtocolCore.extractEnvelope(`${html}${html}`)).toEqual({
      ok: false,
      errors: [
        {
          code: "ambiguous_data_block",
          path: "",
          message: expect.any(String),
        },
      ],
    });
  });

  it("canonicalizes and fingerprints only the Protocol content", async () => {
    expect(ProtocolCore.canonicalizeProtocol(validProtocol)).toBe(
      '{"formulaTestCases":[],"protocolId":"018f7f3e-7b1d-7a91-bf10-8f767a9c0f51","sections":[{"duration":{"kind":"untimed"},"endAction":"wait","markdown":"准备培养基。","sectionId":"018f7f3e-7b1d-7a91-bf10-8f767a9c0f52","title":"准备"}],"title":"细胞培养","variables":[]}',
    );
    await expect(ProtocolCore.fingerprintProtocol(validProtocol)).resolves.toBe(
      "3aeb6dff5a61c4474a3564098bb4e43daf0f6fe8dadc5540284b923feb2f968b",
    );
  });

  it("signs the canonical Protocol and detects changed content", async () => {
    const keys = await ProtocolCore.generateAuthorKeyPair();
    const signature = await ProtocolCore.signProtocol(
      validProtocol,
      keys.privateKey,
      keys.publicKey,
    );

    await expect(
      ProtocolCore.verifyProtocol(validProtocol, signature),
    ).resolves.toBe("match");
    await expect(
      ProtocolCore.verifyProtocol(
        { ...validProtocol, title: "被修改的标题" },
        signature,
      ),
    ).resolves.toBe("mismatch");
    expect(signature.keyId).toMatch(/^[0-9a-f]{64}$/);
  });

  it("evaluates Derived Variables with decimal arithmetic", () => {
    expect(
      ProtocolCore.evaluateProtocol(formulaProtocol, {
        sampleVolume: "0.1",
      }),
    ).toEqual({
      ok: true,
      values: {
        sampleVolume: "0.1",
        adjustedVolume: "0.3",
        totalVolume: "0.9",
      },
    });
  });

  it("blocks Playable Protocol when a Formula Test Case fails", () => {
    expect(ProtocolCore.inspectProtocol(formulaProtocol).playable).toBe(true);

    const result = ProtocolCore.inspectProtocol({
      ...formulaProtocol,
      formulaTestCases: [
        {
          ...formulaProtocol.formulaTestCases[0]!,
          expectedDerivedValues: { adjustedVolume: "99", totalVolume: "0.9" },
        },
      ],
    });

    expect(result.format).toBe("valid");
    expect(result.playable).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        {
          code: "formula_test_failed",
          path: "formulaTestCases.0.expectedDerivedValues.adjustedVolume",
          message: expect.any(String),
        },
      ]),
    );
  });

  it("measures Markdown resource limits in UTF-8 bytes", () => {
    const result = ProtocolCore.inspectProtocol({
      ...validProtocol,
      sections: [
        {
          ...validProtocol.sections[0],
          markdown: "界".repeat(Math.floor((200 * 1024) / 3) + 1),
        },
      ],
    });

    expect(result.format).toBe("valid");
    expect(result.playable).toBe(false);
    expect(result.errors).toEqual([
      {
        code: "resource_limit",
        path: "sections.0.markdown",
        message: expect.any(String),
      },
    ]);
  });

  it("reports format, Signature Match, and Playable Protocol independently", async () => {
    const keys = await ProtocolCore.generateAuthorKeyPair();
    const signature = await ProtocolCore.signProtocol(
      formulaProtocol,
      keys.privateKey,
      keys.publicKey,
    );
    const envelope: Envelope = {
      documentKind: "protocol-box/published-protocol",
      formatVersion: 1,
      appVersion: "0.0.0",
      protocol: formulaProtocol,
      signature,
    };

    await expect(ProtocolCore.inspectEnvelope(envelope)).resolves.toMatchObject({
      format: "valid",
      signature: "match",
      playable: true,
      errors: [],
    });
    await expect(
      ProtocolCore.inspectEnvelope({
        ...envelope,
        protocol: { ...formulaProtocol, title: "Changed" },
      }),
    ).resolves.toMatchObject({
      format: "valid",
      signature: "mismatch",
      playable: true,
    });
  });

  it("rejects file and image resource usage above the documented limits", () => {
    const result = ProtocolCore.inspectProtocol(validProtocol, {
      importedHtmlBytes: 30 * 1024 * 1024 + 1,
      publishedHtmlBytes: 25 * 1024 * 1024 + 1,
      images: [
        {
          path: "sections.0.markdown",
          encodedBytes: 5 * 1024 * 1024 + 1,
          pixels: 50_000_001,
        },
      ],
    });

    expect(result.format).toBe("valid");
    expect(result.playable).toBe(false);
    expect(result.errors.map((error) => error.code)).toEqual([
      "resource_limit",
      "resource_limit",
      "resource_limit",
      "resource_limit",
    ]);
  });

  it("measures embedded image dimensions from signed Markdown content", () => {
    const pngDataUrl = (width: number, height: number): string => {
      const bytes = new Uint8Array(24);
      bytes.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
      bytes.set([73, 72, 68, 82], 12);
      const view = new DataView(bytes.buffer);
      view.setUint32(16, width);
      view.setUint32(20, height);
      return `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;
    };
    const withImage = (height: number): Protocol => ({
      ...validProtocol,
      sections: [
        {
          ...validProtocol.sections[0]!,
          markdown: `![diagram](${pngDataUrl(10_000, height)})`,
        },
      ],
    });

    expect(ProtocolCore.inspectProtocol(withImage(5_000)).playable).toBe(true);
    expect(ProtocolCore.inspectProtocol(withImage(5_001))).toMatchObject({
      playable: false,
      errors: [
        expect.objectContaining({
          code: "resource_limit",
          path: "sections.0.markdown",
        }),
      ],
    });
  });

  it("imports PKCS#8 and SPKI P-256 keys with a non-extractable private key", async () => {
    const generated = await ProtocolCore.generateAuthorKeyPair();
    const pkcs8 = await ProtocolCore.exportPrivateKeyPkcs8(
      generated.privateKey,
    );
    const spki = await ProtocolCore.exportPublicKeySpki(generated.publicKey);

    const privateKey = await ProtocolCore.importPrivateKeyPkcs8(pkcs8);
    const publicKey = await ProtocolCore.importPublicKeySpki(spki);
    const signature = await ProtocolCore.signProtocol(
      validProtocol,
      privateKey,
      publicKey,
    );

    expect(privateKey.extractable).toBe(false);
    await expect(
      ProtocolCore.verifyProtocol(validProtocol, signature),
    ).resolves.toBe("match");
  });

  it("reports malformed key material with a structured error", async () => {
    await expect(
      ProtocolCore.importPrivateKeyPkcs8("bm90LWEtcHJpdmF0ZS1rZXk"),
    ).rejects.toMatchObject({
      code: "invalid_private_key",
      path: "privateKeyPkcs8",
    });
    await expect(
      ProtocolCore.importPublicKeySpki("bm90LWEtcHVibGljLWtleQ"),
    ).rejects.toMatchObject({
      code: "invalid_public_key",
      path: "publicKeySpki",
    });
  });

  it("requires every Derived Variable in each Formula Test Case", () => {
    const result = ProtocolCore.inspectProtocol({
      ...formulaProtocol,
      formulaTestCases: [
        {
          ...formulaProtocol.formulaTestCases[0]!,
          expectedDerivedValues: { adjustedVolume: "0.3" },
        },
      ],
    });

    expect(result.playable).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        {
          code: "missing_expected_value",
          path: "formulaTestCases.0.expectedDerivedValues.totalVolume",
          message: expect.any(String),
        },
      ]),
    );
  });

  it("rejects duplicate Section and Variable Definition identities", () => {
    const inputVariable = {
      kind: "input" as const,
      id: "temperature",
      label: "Temperature",
      valueType: "numeric" as const,
      defaultValue: "25",
    };
    const result = ProtocolCore.inspectProtocol({
      ...validProtocol,
      sections: [validProtocol.sections[0], validProtocol.sections[0]],
      variables: [inputVariable, inputVariable],
    });

    expect(result.playable).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        {
          code: "duplicate_section",
          path: "sections.1.sectionId",
          message: expect.any(String),
        },
        {
          code: "duplicate_variable",
          path: "variables.1.id",
          message: expect.any(String),
        },
      ]),
    );
  });

  it("reports unsafe formula syntax even when Formula Test Cases are missing", () => {
    const result = ProtocolCore.inspectProtocol({
      ...validProtocol,
      variables: [
        {
          kind: "derived",
          id: "unsafeValue",
          label: "Unsafe value",
          valueType: "numeric",
          formula: "globalThis.process.exit()",
          precision: 2,
          roundingMode: "half-even",
        },
      ],
    });

    expect(result.playable).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        {
          code: "invalid_token",
          path: "variables.0.formula",
          message: expect.any(String),
        },
        {
          code: "missing_formula_test_case",
          path: "formulaTestCases",
          message: expect.any(String),
        },
      ]),
    );
  });

  it("rejects non-canonical persisted decimal strings", () => {
    const result = ProtocolCore.inspectProtocol({
      ...validProtocol,
      variables: [
        {
          kind: "input",
          id: "volume",
          label: "Volume",
          valueType: "numeric",
          defaultValue: "1.0",
        },
      ],
    });

    expect(result.format).toBe("invalid");
    expect(result.errors).toEqual(
      expect.arrayContaining([
        {
          code: "custom",
          path: "variables.0.defaultValue",
          message: expect.any(String),
        },
      ]),
    );
  });

  it("rejects imported HTML above 30 MB before data-block extraction", () => {
    const result = ProtocolCore.extractEnvelope(
      "x".repeat(30 * 1024 * 1024 + 1),
    );

    expect(result).toEqual({
      ok: false,
      errors: [
        {
          code: "resource_limit",
          path: "importedHtml",
          message: expect.any(String),
        },
      ],
    });
  });

  it("keeps ProtocolCore methods usable as standalone interface references", () => {
    const { inspectProtocol, extractEnvelope, encodeEnvelope } = ProtocolCore;
    expect(inspectProtocol(formulaProtocol).playable).toBe(true);

    const envelope: Envelope = {
      documentKind: "protocol-box/application",
      formatVersion: 1,
      appVersion: "0.0.0",
      protocol: null,
      signature: null,
    };
    const html = `<script id="protocol-box-data" type="application/octet-stream">${encodeEnvelope(envelope)}</script>`;
    expect(extractEnvelope(html)).toEqual({ ok: true, envelope });
  });

  it("rejects a malformed data block beside a valid data block as ambiguous", () => {
    const envelope: Envelope = {
      documentKind: "protocol-box/application",
      formatVersion: 1,
      appVersion: "0.0.0",
      protocol: null,
      signature: null,
    };
    const html = `
      <script id="protocol-box-data" type="application/octet-stream">!</script>
      <script id="protocol-box-data" type="application/octet-stream">${ProtocolCore.encodeEnvelope(envelope)}</script>`;

    expect(ProtocolCore.extractEnvelope(html)).toMatchObject({
      ok: false,
      errors: [{ code: "ambiguous_data_block" }],
    });
  });

  it("requires Section durations to be non-negative and reference Numeric Variables", () => {
    const fixedResult = ProtocolCore.inspectProtocol({
      ...validProtocol,
      sections: [
        {
          ...validProtocol.sections[0],
          duration: { kind: "fixed", seconds: "-1" },
        },
      ],
    });
    const derivedResult = ProtocolCore.inspectProtocol({
      ...validProtocol,
      sections: [
        {
          ...validProtocol.sections[0],
          duration: { kind: "derived", variableId: "missingDuration" },
        },
      ],
    });

    expect(fixedResult.playable).toBe(false);
    expect(fixedResult.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "invalid_duration" }),
      ]),
    );
    expect(derivedResult.playable).toBe(false);
    expect(derivedResult.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "invalid_duration_variable" }),
      ]),
    );
  });

  it("rejects invalid Input Variable defaults and constraints", () => {
    const result = ProtocolCore.inspectProtocol({
      ...validProtocol,
      variables: [
        {
          kind: "input",
          id: "temperature",
          label: "Temperature",
          valueType: "numeric",
          defaultValue: "25",
          minimum: "30",
          maximum: "20",
        },
        {
          kind: "input",
          id: "medium",
          label: "Medium",
          valueType: "enum",
          options: ["DMEM", "DMEM"],
          defaultValue: "RPMI",
        },
      ],
    });

    expect(result.playable).toBe(false);
    expect(result.errors.map((error) => error.code)).toEqual([
      "invalid_variable_constraints",
      "invalid_variable_default",
      "invalid_variable_constraints",
      "invalid_variable_default",
    ]);
  });

  it("keeps decimal division deterministic at the maximum declared precision", () => {
    const result = ProtocolCore.evaluateProtocol(
      {
        ...validProtocol,
        variables: [
          {
            kind: "input",
            id: "numerator",
            label: "Numerator",
            valueType: "numeric",
          },
          {
            kind: "derived",
            id: "quotient",
            label: "Quotient",
            valueType: "numeric",
            formula: "numerator / 3",
            precision: 30,
            roundingMode: "half-even",
          },
        ],
        formulaTestCases: [],
      },
      { numerator: "1" },
    );

    expect(result).toEqual({
      ok: true,
      values: {
        numerator: "1",
        quotient: "0.333333333333333333333333333333",
      },
    });
  });

  it("treats malformed signature metadata as invalid format, not Signature Mismatch", async () => {
    const result = await ProtocolCore.inspectEnvelope({
      documentKind: "protocol-box/published-protocol",
      formatVersion: 1,
      appVersion: "0.0.0",
      protocol: validProtocol,
      signature: {
        algorithm: "ECDSA-P256-SHA256",
        publicKeySpki: "bm90LWEtcHVibGljLWtleQ",
        keyId: "not-a-sha256-fingerprint",
        value: "dG9vLXNob3J0",
      },
    });

    expect(result).toMatchObject({
      format: "invalid",
      signature: "unverified",
      playable: false,
    });
  });

  it("applies resource context while inspecting a Published Protocol Envelope", async () => {
    const keys = await ProtocolCore.generateAuthorKeyPair();
    const signature = await ProtocolCore.signProtocol(
      validProtocol,
      keys.privateKey,
      keys.publicKey,
    );
    const result = await ProtocolCore.inspectEnvelope(
      {
        documentKind: "protocol-box/published-protocol",
        formatVersion: 1,
        appVersion: "0.0.0",
        protocol: validProtocol,
        signature,
      },
      { publishedHtmlBytes: 25 * 1024 * 1024 + 1 },
    );

    expect(result).toMatchObject({
      format: "valid",
      signature: "match",
      playable: false,
      errors: [expect.objectContaining({ code: "resource_limit" })],
    });
  });

  it("refuses to sign a Protocol that is not Playable Protocol", async () => {
    const keys = await ProtocolCore.generateAuthorKeyPair();
    const failingProtocol: Protocol = {
      ...formulaProtocol,
      formulaTestCases: [
        {
          ...formulaProtocol.formulaTestCases[0]!,
          expectedDerivedValues: {
            adjustedVolume: "99",
            totalVolume: "0.9",
          },
        },
      ],
    };

    await expect(
      ProtocolCore.signProtocol(
        failingProtocol,
        keys.privateKey,
        keys.publicKey,
      ),
    ).rejects.toMatchObject({
      code: "protocol_not_playable",
      path: "protocol",
    });
  });

  it("reports an unusable embedded SPKI key as an invalid Envelope", async () => {
    const result = await ProtocolCore.inspectEnvelope({
      documentKind: "protocol-box/published-protocol",
      formatVersion: 1,
      appVersion: "0.0.0",
      protocol: validProtocol,
      signature: {
        algorithm: "ECDSA-P256-SHA256",
        publicKeySpki: "A".repeat(122),
        keyId: "a".repeat(64),
        value: "A".repeat(86),
      },
    });

    expect(result).toMatchObject({
      format: "invalid",
      signature: "unverified",
      playable: false,
      errors: [expect.objectContaining({ code: "invalid_public_key" })],
    });
  });

  it.each([
    ["unknown_variable", "missing + 1"],
    ["division_by_zero", "1 / 0"],
    ["invalid_function", "sqrt(4)"],
    ["invalid_token", "globalThis.value"],
  ])("reports %s without executing the formula", (code, formula) => {
    const result = ProtocolCore.evaluateProtocol(
      {
        ...validProtocol,
        variables: [
          {
            kind: "derived",
            id: "result",
            label: "Result",
            valueType: "numeric",
            formula,
            precision: 2,
            roundingMode: "half-even",
          },
        ],
      },
      {},
    );

    expect(result).toMatchObject({
      ok: false,
      errors: [expect.objectContaining({ code })],
    });
  });

  it("reports cyclic Derived Variable dependencies", () => {
    const result = ProtocolCore.inspectProtocol({
      ...validProtocol,
      variables: [
        {
          kind: "derived",
          id: "a",
          label: "A",
          valueType: "numeric",
          formula: "b + 1",
          precision: 2,
          roundingMode: "half-even",
        },
        {
          kind: "derived",
          id: "b",
          label: "B",
          valueType: "numeric",
          formula: "a + 1",
          precision: 2,
          roundingMode: "half-even",
        },
      ],
      formulaTestCases: [
        {
          testCaseId: uuid(99),
          name: "Cycle",
          inputValues: {},
          expectedDerivedValues: { a: "1", b: "1" },
          precision: 2,
          roundingMode: "half-even",
        },
      ],
    });

    expect(result).toMatchObject({
      format: "valid",
      playable: false,
      errors: expect.arrayContaining([
        expect.objectContaining({ code: "cyclic_dependency" }),
      ]),
    });
  });

  it("returns an ordered Variable dependency graph for a valid chain", () => {
    const graph = ProtocolCore.inspectVariableDependencyGraph(formulaProtocol);

    expect(graph.nodes.map(({ id }) => id)).toEqual([
      "sampleVolume",
      "adjustedVolume",
      "totalVolume",
    ]);
    expect(graph.edges).toEqual([
      {
        id: "sampleVolume->adjustedVolume",
        sourceId: "sampleVolume",
        targetId: "adjustedVolume",
        derivedVariableIndex: 1,
        referenceIndex: 0,
        diagnosticCodes: [],
        cycleMember: false,
      },
      {
        id: "adjustedVolume->totalVolume",
        sourceId: "adjustedVolume",
        targetId: "totalVolume",
        derivedVariableIndex: 2,
        referenceIndex: 0,
        diagnosticCodes: [],
        cycleMember: false,
      },
    ]);
    expect(graph.diagnostics).toEqual([]);
  });

  it("adds an ordered placeholder and diagnostic for an unknown reference", () => {
    const graph = ProtocolCore.inspectVariableDependencyGraph({
      ...validProtocol,
      variables: [
        {
          kind: "derived",
          id: "result",
          label: "Result",
          valueType: "numeric",
          formula: "missing + 1",
          precision: 2,
          roundingMode: "half-even",
        },
      ],
    });

    expect(graph.nodes).toMatchObject([
      {
        kind: "variable",
        id: "result",
        diagnosticCodes: ["unknown_variable"],
        cycleMember: false,
      },
      {
        kind: "unknown",
        id: "missing",
        referencedVariableId: "missing",
        diagnosticCodes: ["unknown_variable"],
        cycleMember: false,
      },
    ]);
    expect(graph.edges).toEqual([
      {
        id: "missing->result",
        sourceId: "missing",
        targetId: "result",
        derivedVariableIndex: 0,
        referenceIndex: 0,
        diagnosticCodes: ["unknown_variable"],
        cycleMember: false,
      },
    ]);
    expect(graph.diagnostics).toEqual([
      {
        kind: "unknown-reference",
        code: "unknown_variable",
        path: "variables.0.formula",
        message: "Unknown variable: missing",
        variableId: "result",
        variableIndex: 0,
        referencedVariableId: "missing",
        nodeIds: ["missing", "result"],
        edgeIds: ["missing->result"],
      },
    ]);
  });

  it("identifies nonnumeric Input Variable references without evaluating", () => {
    const graph = ProtocolCore.inspectVariableDependencyGraph({
      ...validProtocol,
      variables: [
        {
          kind: "input",
          id: "name",
          label: "Name",
          valueType: "text",
        },
        {
          kind: "derived",
          id: "result",
          label: "Result",
          valueType: "numeric",
          formula: "name + 1",
          precision: 2,
          roundingMode: "half-even",
        },
      ],
    });

    expect(graph.edges[0]).toMatchObject({
      sourceId: "name",
      targetId: "result",
      diagnosticCodes: ["non_numeric_variable"],
    });
    expect(graph.diagnostics).toEqual([
      expect.objectContaining({
        kind: "non-numeric-reference",
        code: "non_numeric_variable",
        referencedVariableId: "name",
        nodeIds: ["name", "result"],
        edgeIds: ["name->result"],
      }),
    ]);
  });

  it("returns a deterministic cycle path and marks only cycle members", () => {
    const graph = ProtocolCore.inspectVariableDependencyGraph({
      ...validProtocol,
      variables: [
        {
          kind: "input",
          id: "input",
          label: "Input",
          valueType: "numeric",
        },
        {
          kind: "derived",
          id: "a",
          label: "A",
          valueType: "numeric",
          formula: "c + input",
          precision: 2,
          roundingMode: "half-even",
        },
        {
          kind: "derived",
          id: "b",
          label: "B",
          valueType: "numeric",
          formula: "a + 1",
          precision: 2,
          roundingMode: "half-even",
        },
        {
          kind: "derived",
          id: "c",
          label: "C",
          valueType: "numeric",
          formula: "b + 1",
          precision: 2,
          roundingMode: "half-even",
        },
      ],
    });

    expect(
      graph.nodes.map(({ id, cycleMember }) => ({ id, cycleMember })),
    ).toEqual([
      { id: "input", cycleMember: false },
      { id: "a", cycleMember: true },
      { id: "b", cycleMember: true },
      { id: "c", cycleMember: true },
    ]);
    expect(
      graph.edges.map(({ id, cycleMember }) => ({ id, cycleMember })),
    ).toEqual([
      { id: "c->a", cycleMember: true },
      { id: "input->a", cycleMember: false },
      { id: "a->b", cycleMember: true },
      { id: "b->c", cycleMember: true },
    ]);
    expect(graph.diagnostics).toEqual([
      {
        kind: "cycle",
        code: "cyclic_dependency",
        path: "variables",
        message: "Cyclic Derived Variable dependency: a",
        cyclePath: ["a", "b", "c", "a"],
        nodeIds: ["a", "b", "c"],
        edgeIds: ["c->a", "a->b", "b->c"],
      },
    ]);
  });

  it("returns an invalid-formula diagnostic instead of throwing", () => {
    const graph = ProtocolCore.inspectVariableDependencyGraph({
      ...validProtocol,
      variables: [
        {
          kind: "derived",
          id: "result",
          label: "Result",
          valueType: "numeric",
          formula: "input +",
          precision: 2,
          roundingMode: "half-even",
        },
      ],
    });

    expect(graph).toEqual({
      nodes: [
        expect.objectContaining({
          kind: "variable",
          id: "result",
          diagnosticCodes: ["invalid_formula"],
          cycleMember: false,
        }),
      ],
      edges: [],
      diagnostics: [
        {
          kind: "invalid-formula",
          code: "invalid_formula",
          path: "variables.0.formula",
          message: "Expected an expression at 7",
          variableId: "result",
          variableIndex: 0,
          nodeIds: ["result"],
          edgeIds: [],
        },
      ],
    });
  });

  it("supports precedence, unary signs, parentheses, min, max, ceil, and floor", () => {
    const result = ProtocolCore.evaluateProtocol(
      {
        ...validProtocol,
        variables: [
          {
            kind: "derived",
            id: "result",
            label: "Result",
            valueType: "numeric",
            formula: "-(2 + 3) * 4 + min(10, max(ceil(1.1), floor(2.9)))",
            precision: 2,
            roundingMode: "half-even",
          },
        ],
      },
      {},
    );

    expect(result).toEqual({
      ok: true,
      values: { result: "-18" },
    });
  });

  it.each([
    ["invalid base64url", "!"],
    ["malformed JSON", "bm90LWpzb24"],
  ])("rejects %s Envelope data", (_name, encoded) => {
    expect(ProtocolCore.decodeEnvelope(encoded)).toMatchObject({
      ok: false,
      errors: [expect.objectContaining({ code: "invalid_envelope_encoding" })],
    });
  });

  it("rejects unsupported Envelope versions and unknown fields", () => {
    const encoded = Buffer.from(
      JSON.stringify({
        documentKind: "protocol-box/application",
        formatVersion: 2,
        appVersion: "0.0.0",
        protocol: null,
        signature: null,
        unexpected: true,
      }),
    ).toString("base64url");

    expect(ProtocolCore.decodeEnvelope(encoded)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({ path: "formatVersion" }),
      ]),
    });
  });

  it("accepts count and source limits at their exact boundaries", () => {
    const sections = Array.from({ length: 500 }, (_, index) => ({
      ...validProtocol.sections[0],
      sectionId: uuid(index + 1),
    }));
    const variables: Protocol["variables"] = Array.from(
      { length: 250 },
      (_, index) => ({
        kind: "input",
        id: `input_${index}`,
        label: `Input ${index}`,
        valueType: "numeric",
      }),
    );
    const formulaTestCases: Protocol["formulaTestCases"] = Array.from(
      { length: 100 },
      (_, index) => ({
        testCaseId: uuid(index + 1_000),
        name: `Case ${index}`,
        inputValues: {},
        expectedDerivedValues: {},
        precision: 2,
        roundingMode: "half-even",
      }),
    );

    expect(
      ProtocolCore.inspectProtocol({ ...validProtocol, sections }).playable,
    ).toBe(true);
    expect(
      ProtocolCore.inspectProtocol({
        ...validProtocol,
        sections: [...sections, { ...validProtocol.sections[0], sectionId: uuid(999) }],
      }).errors,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "resource_limit", path: "sections" }),
      ]),
    );
    expect(
      ProtocolCore.inspectProtocol({ ...validProtocol, variables }).playable,
    ).toBe(true);
    expect(
      ProtocolCore.inspectProtocol({
        ...validProtocol,
        variables: [
          ...variables,
          {
            kind: "input",
            id: "input_250",
            label: "Input 250",
            valueType: "numeric",
          },
        ],
      }).errors,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "resource_limit", path: "variables" }),
      ]),
    );
    expect(
      ProtocolCore.inspectProtocol({
        ...validProtocol,
        formulaTestCases,
      }).playable,
    ).toBe(true);
    expect(
      ProtocolCore.inspectProtocol({
        ...validProtocol,
        formulaTestCases: [
          ...formulaTestCases,
          {
            testCaseId: uuid(1_100),
            name: "Case 100",
            inputValues: {},
            expectedDerivedValues: {},
            precision: 2,
            roundingMode: "half-even",
          },
        ],
      }).errors,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "resource_limit",
          path: "formulaTestCases",
        }),
      ]),
    );
    expect(
      ProtocolCore.inspectProtocol({
        ...validProtocol,
        sections: [
          {
            ...validProtocol.sections[0],
            markdown: "x".repeat(200 * 1024),
          },
        ],
      }).playable,
    ).toBe(true);
    expect(
      ProtocolCore.inspectProtocol(validProtocol, {
        importedHtmlBytes: 30 * 1024 * 1024,
        publishedHtmlBytes: 25 * 1024 * 1024,
        images: [
          {
            path: "sections.0.markdown",
            encodedBytes: 5 * 1024 * 1024,
            pixels: 50_000_000,
          },
        ],
      }).playable,
    ).toBe(true);
  });

  it("accepts a 2,000-character formula and rejects one additional character", () => {
    const createProtocol = (formula: string): Protocol => ({
      ...validProtocol,
      variables: [
        {
          kind: "derived",
          id: "result",
          label: "Result",
          valueType: "numeric",
          formula,
          precision: 0,
          roundingMode: "half-even",
        },
      ],
      formulaTestCases: [
        {
          testCaseId: uuid(2_000),
          name: "Formula length",
          inputValues: {},
          expectedDerivedValues: { result: "1" },
          precision: 0,
          roundingMode: "half-even",
        },
      ],
    });

    expect(
      ProtocolCore.inspectProtocol(createProtocol("1".padEnd(2_000))).playable,
    ).toBe(true);
    expect(
      ProtocolCore.inspectProtocol(createProtocol("1".padEnd(2_001))).errors,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "resource_limit",
          path: "variables.0.formula",
        }),
      ]),
    );
  });

  it("measures the 5 MB total Markdown boundary independently", () => {
    const sections = Array.from({ length: 26 }, (_, index) => ({
      ...validProtocol.sections[0],
      sectionId: uuid(index + 3_000),
      markdown: "x".repeat((index === 25 ? 120 : 200) * 1024),
    }));

    expect(
      ProtocolCore.inspectProtocol({ ...validProtocol, sections }).playable,
    ).toBe(true);
    sections[25] = { ...sections[25]!, markdown: `${sections[25]!.markdown}x` };
    expect(
      ProtocolCore.inspectProtocol({ ...validProtocol, sections }).errors,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "resource_limit",
          path: "sections",
        }),
      ]),
    );
  });
});
