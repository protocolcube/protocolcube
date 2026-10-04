import { describe, expect, it } from "vitest";
import {
  DURATION_UNIT_SYMBOLS,
  ProtocolCore,
  type Envelope,
  type Protocol,
  type VariableDefinition,
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

  it("accepts Duration and Numeric Input Variables as Section duration references", () => {
    const durationInputResult = ProtocolCore.inspectProtocol({
      ...validProtocol,
      sections: [
        {
          ...validProtocol.sections[0],
          duration: { kind: "derived", variableId: "soak" },
        },
      ],
      variables: [
        {
          kind: "input",
          id: "soak",
          label: "Soak",
          valueType: "duration",
          unit: "minute",
          minimum: "60",
          maximum: "3600",
        },
      ],
    });
    const numericInputResult = ProtocolCore.inspectProtocol({
      ...validProtocol,
      sections: [
        {
          ...validProtocol.sections[0],
          duration: { kind: "derived", variableId: "wait" },
        },
      ],
      variables: [
        { kind: "input", id: "wait", label: "Wait", valueType: "numeric" },
      ],
    });
    const derivedResult = ProtocolCore.inspectProtocol({
      ...validProtocol,
      sections: [
        {
          ...validProtocol.sections[0],
          duration: { kind: "derived", variableId: "timer" },
        },
      ],
      variables: [
        {
          kind: "derived",
          id: "timer",
          label: "Timer",
          valueType: "numeric",
          formula: "60",
          precision: 0,
          roundingMode: "half-even",
        },
      ],
      formulaTestCases: [
        {
          testCaseId: uuid(1),
          name: "Resolves the timer",
          inputValues: {},
          expectedDerivedValues: { timer: "60" },
          precision: 0,
          roundingMode: "half-even",
        },
      ],
    });

    expect(durationInputResult.playable).toBe(true);
    expect(durationInputResult.errors).toEqual([]);
    expect(numericInputResult.playable).toBe(true);
    expect(numericInputResult.errors).toEqual([]);
    expect(derivedResult.playable).toBe(true);
    expect(derivedResult.errors).toEqual([]);
  });

  it("rejects text, boolean, and enum references for derived Section durations", () => {
    const rejectedVariables: Array<
      Extract<VariableDefinition, { kind: "input" }>
    > = [
      { kind: "input", id: "notes", label: "Notes", valueType: "text" },
      { kind: "input", id: "flag", label: "Flag", valueType: "boolean" },
      {
        kind: "input",
        id: "mode",
        label: "Mode",
        valueType: "enum",
        options: ["fast", "slow"],
      },
    ];
    for (const variable of rejectedVariables) {
      const result = ProtocolCore.inspectProtocol({
        ...validProtocol,
        sections: [
          {
            ...validProtocol.sections[0],
            duration: { kind: "derived", variableId: variable.id },
          },
        ],
        variables: [variable],
      });
      expect(result.playable).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "invalid_duration_variable",
            path: "sections.0.duration.variableId",
          }),
        ]),
      );
    }
  });

  it("owns Section duration candidate admissibility on the domain seam", () => {
    // The same predicate behind the `invalid_duration_variable` check: any
    // Derived Variable plus Numeric and Duration Input Variables.
    const candidates: VariableDefinition[] = [
      { kind: "input", id: "wait", label: "Wait", valueType: "numeric" },
      {
        kind: "input",
        id: "soak",
        label: "Soak",
        valueType: "duration",
        unit: "minute",
      },
      {
        kind: "derived",
        id: "timer",
        label: "Timer",
        valueType: "numeric",
        formula: "60",
        precision: 0,
        roundingMode: "half-even",
      },
      {
        kind: "derived",
        id: "span",
        label: "Span",
        valueType: "duration",
        unit: "hour",
        formula: "soak",
        precision: 2,
        roundingMode: "half-even",
      },
    ];
    for (const definition of candidates) {
      expect(ProtocolCore.isSectionDurationCandidate(definition)).toBe(true);
    }

    const rejected: Array<
      Extract<VariableDefinition, { kind: "input" }>
    > = [
      { kind: "input", id: "notes", label: "Notes", valueType: "text" },
      { kind: "input", id: "flag", label: "Flag", valueType: "boolean" },
      {
        kind: "input",
        id: "mode",
        label: "Mode",
        valueType: "enum",
        options: ["fast", "slow"],
      },
    ];
    for (const definition of rejected) {
      expect(ProtocolCore.isSectionDurationCandidate(definition)).toBe(false);
    }
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

  it("accepts a duration Input Variable and reports an unknown Duration Unit distinctly", () => {
    const valid = ProtocolCore.inspectProtocol({
      ...validProtocol,
      variables: [
        {
          kind: "input",
          id: "incubateMinutes",
          label: "Incubation",
          valueType: "duration",
          unit: "minute",
          defaultValue: "300",
          minimum: "60",
          maximum: "3600",
        },
      ],
    });
    expect(valid.format).toBe("valid");
    expect(valid.playable).toBe(true);
    expect(valid.errors).toEqual([]);

    const invalidUnit = ProtocolCore.inspectProtocol({
      ...validProtocol,
      variables: [
        {
          kind: "input",
          id: "incubateMinutes",
          label: "Incubation",
          valueType: "duration",
          unit: "fortnight",
        },
      ],
    });
    expect(invalidUnit.format).toBe("valid");
    expect(invalidUnit.playable).toBe(false);
    expect(invalidUnit.errors).toEqual([
      {
        code: "invalid_duration_unit",
        path: "variables.0.unit",
        message: "Duration Variable unit must be second, minute, hour, or day",
      },
    ]);
  });

  it("rejects non-canonical duration seconds and inconsistent duration constraints", () => {
    const nonCanonical = ProtocolCore.inspectProtocol({
      ...validProtocol,
      variables: [
        {
          kind: "input",
          id: "incubateMinutes",
          label: "Incubation",
          valueType: "duration",
          unit: "minute",
          minimum: "060",
        },
      ],
    });
    expect(nonCanonical.format).toBe("invalid");
    expect(nonCanonical.playable).toBe(false);

    const inconsistent = ProtocolCore.inspectProtocol({
      ...validProtocol,
      variables: [
        {
          kind: "input",
          id: "incubateMinutes",
          label: "Incubation",
          valueType: "duration",
          unit: "minute",
          defaultValue: "30",
          minimum: "120",
          maximum: "60",
        },
      ],
    });
    expect(inconsistent.format).toBe("valid");
    expect(inconsistent.playable).toBe(false);
    expect(inconsistent.errors.map((error) => error.code)).toEqual([
      "invalid_variable_constraints",
      "invalid_variable_default",
    ]);
    expect(inconsistent.errors.map((error) => error.path)).toEqual([
      "variables.0",
      "variables.0.defaultValue",
    ]);
  });

  it("resolves duration entries from the declared unit into canonical seconds", () => {
    const durationDefinition: Extract<
      Protocol["variables"][number],
      { valueType: "duration" }
    > = {
      kind: "input",
      id: "incubateMinutes",
      label: "Incubation",
      valueType: "duration",
      unit: "minute",
      defaultValue: "300",
    };
    const protocol: Protocol = {
      ...validProtocol,
      variables: [durationDefinition],
      formulaTestCases: [],
    };

    expect(
      ProtocolCore.evaluateProtocol(protocol, { incubateMinutes: "2.5" }),
    ).toEqual({ ok: true, values: { incubateMinutes: "150" } });
    expect(ProtocolCore.evaluateProtocol(protocol, { incubateMinutes: "0" }))
      .toEqual({ ok: true, values: { incubateMinutes: "0" } });
    expect(ProtocolCore.evaluateProtocol(protocol, {})).toEqual({
      ok: true,
      values: { incubateMinutes: "300" },
    });

    const bounded: Protocol = {
      ...protocol,
      variables: [{ ...durationDefinition, minimum: "60", maximum: "3600" }],
    };
    expect(
      ProtocolCore.evaluateProtocol(bounded, { incubateMinutes: "90" }),
    ).toEqual({
      ok: false,
      errors: [
        {
          code: "invalid_input",
          path: "inputValues.incubateMinutes",
          message:
            "incubateMinutes must be a non-negative decimal within its constraints",
        },
      ],
    });
  });

  it("rejects invalid duration entries", () => {
    const protocol: Protocol = {
      ...validProtocol,
      variables: [
        {
          kind: "input",
          id: "incubateHours",
          label: "Incubation",
          valueType: "duration",
          unit: "hour",
        },
      ],
      formulaTestCases: [],
    };

    for (const entry of ["overnight", "-1", "1.2.3"]) {
      expect(
        ProtocolCore.evaluateProtocol(protocol, { incubateHours: entry }),
      ).toEqual({
        ok: false,
        errors: [
          {
            code: "invalid_input",
            path: "inputValues.incubateHours",
            message:
              "incubateHours must be a non-negative decimal within its constraints",
          },
        ],
      });
    }

    // Entered decimals are lenient like the numeric kind and persist in
    // canonical seconds.
    expect(
      ProtocolCore.evaluateProtocol(protocol, { incubateHours: "1e2" }),
    ).toEqual({ ok: true, values: { incubateHours: "360000" } });
  });

  it("validates stored duration Variable Values without re-interpreting units", () => {
    const protocol: Protocol = {
      ...validProtocol,
      variables: [
        {
          kind: "input",
          id: "incubateMinutes",
          label: "Incubation",
          valueType: "duration",
          unit: "minute",
          minimum: "60",
          maximum: "3600",
        },
      ],
      formulaTestCases: [],
    };

    expect(
      ProtocolCore.resolveVariableValues(
        protocol,
        { incubateMinutes: "300" },
        "playback-session",
      ),
    ).toEqual({ ok: true, values: { incubateMinutes: "300" } });

    // The stored "5" is canonical seconds, not a 5-minute entry: it violates
    // the 60-second minimum instead of resolving to 300 seconds.
    expect(
      ProtocolCore.resolveVariableValues(
        protocol,
        { incubateMinutes: "5" },
        "playback-session",
      ),
    ).toEqual({
      ok: false,
      errors: [
        {
          code: "invalid_input",
          path: "values.incubateMinutes",
          message:
            "incubateMinutes must be a non-negative decimal within its constraints",
        },
      ],
    });

    expect(
      ProtocolCore.resolveVariableValues(
        protocol,
        { incubateMinutes: "0301.5" },
        "playback-session",
      ),
    ).toMatchObject({ ok: false });

    expect(
      ProtocolCore.resolveVariableValues(protocol, {}, "playback-session"),
    ).toMatchObject({ ok: false });
  });

  it("formats duration values deterministically in the declared unit", () => {
    // Exact conversions: 5400 seconds is 90 minutes, 1.5 hours, and
    // 0.0625 days, rendered as plain decimals with unit symbols.
    expect(ProtocolCore.formatDurationValue("5400", "second")).toBe("5400 s");
    expect(ProtocolCore.formatDurationValue("5400", "minute")).toBe("90 min");
    expect(ProtocolCore.formatDurationValue("5400", "hour")).toBe("1.5 h");
    expect(ProtocolCore.formatDurationValue("5400", "day")).toBe("0.0625 d");
    expect(ProtocolCore.formatDurationValue("60", "minute")).toBe("1 min");
    expect(ProtocolCore.formatDurationValue("3600", "hour")).toBe("1 h");
    expect(ProtocolCore.formatDurationValue("86400", "day")).toBe("1 d");

    // Canonical zero normalizes in every unit.
    expect(ProtocolCore.formatDurationValue("0", "second")).toBe("0 s");
    expect(ProtocolCore.formatDurationValue("0", "minute")).toBe("0 min");
    expect(ProtocolCore.formatDurationValue("0", "hour")).toBe("0 h");
    expect(ProtocolCore.formatDurationValue("0", "day")).toBe("0 d");

    // A value with maximum practical precision converts exactly in every
    // unit: 0.000027 seconds is exactly divisible by each unit factor.
    expect(ProtocolCore.formatDurationValue("0.000027", "second")).toBe(
      "0.000027 s",
    );
    expect(ProtocolCore.formatDurationValue("0.000027", "minute")).toBe(
      "0.00000045 min",
    );
    expect(ProtocolCore.formatDurationValue("0.000027", "hour")).toBe(
      "0.0000000075 h",
    );
    expect(ProtocolCore.formatDurationValue("0.000027", "day")).toBe(
      "0.0000000003125 d",
    );

    // Very small values stay plain decimals (never exponent notation) and
    // round-trip exactly back to the stored canonical seconds.
    const tiny = "0.000000000000000000000027";
    for (const unit of ["second", "minute", "hour", "day"] as const) {
      const rendered = ProtocolCore.formatDurationValue(tiny, unit);
      expect(rendered).not.toMatch(/[eE]/);
      expect(
        ProtocolCore.convertDurationEntryToSeconds(
          rendered.slice(0, rendered.length - DURATION_UNIT_SYMBOLS[unit].length - 1),
          unit,
        ),
      ).toBe(tiny);
    }

    // Repeating expansions stay deterministic at the Decimal clone's
    // precision and agree with the raw unit converter.
    const repeating = ProtocolCore.formatDurationValue("1", "minute");
    expect(repeating).toBe(ProtocolCore.formatDurationValue("1", "minute"));
    const digits = repeating.slice(2, repeating.length - " min".length);
    expect(digits).toMatch(/^01666+7$/);
    expect(digits.length).toBe(121);
    expect(repeating).toBe(
      `${ProtocolCore.convertDurationSecondsToUnit("1", "minute")} min`,
    );
  });

  it("renders Duration Unit symbols through one seam helper", () => {
    expect(ProtocolCore.durationSymbol("second")).toBe("s");
    expect(ProtocolCore.durationSymbol("minute")).toBe("min");
    expect(ProtocolCore.durationSymbol("hour")).toBe("h");
    expect(ProtocolCore.durationSymbol("day")).toBe("d");
    // An unknown unit falls back to the raw string instead of inventing a
    // symbol, matching the formatter's language-independent output.
    expect(ProtocolCore.durationSymbol("fortnight")).toBe("fortnight");
  });

  it("keeps protocols without duration Variables inspecting identically", () => {
    for (const protocol of [validProtocol, formulaProtocol]) {
      const inspection = ProtocolCore.inspectProtocol(protocol);
      expect(inspection.format).toBe("valid");
      expect(inspection.playable).toBe(true);
      expect(
        inspection.errors.filter(
          (error) =>
            error.code === "invalid_duration_unit" ||
            error.code === "invalid_variable_constraints" ||
            error.code === "invalid_variable_default",
        ),
      ).toEqual([]);
    }
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

  const durationInput = (
    id: string,
    label: string,
    unit: "second" | "minute" | "hour" | "day",
  ): Extract<Protocol["variables"][number], { kind: "input" }> => ({
    kind: "input",
    id,
    label,
    valueType: "duration",
    unit,
  });

  const durationDerived = (
    id: string,
    label: string,
    formula: string,
    unit: "second" | "minute" | "hour" | "day" = "minute",
    valueType: "numeric" | "duration" = "duration",
  ): Extract<Protocol["variables"][number], { kind: "derived" }> =>
    valueType === "duration"
      ? {
          kind: "derived",
          id,
          label,
          valueType: "duration",
          unit,
          formula,
          precision: 2,
          roundingMode: "half-even",
        }
      : {
          kind: "derived",
          id,
          label,
          valueType: "numeric",
          formula,
          precision: 2,
          roundingMode: "half-even",
        };

  it("evaluates every legal duration operator combination into canonical seconds", () => {
    const protocol: Protocol = {
      ...validProtocol,
      variables: [
        durationInput("soakMinutes", "Soak", "minute"),
        durationDerived("added", "Added", "soakMinutes + soakMinutes"),
        durationDerived("scaled", "Scaled", "soakMinutes * 3"),
        durationDerived("scaledReversed", "Scaled reversed", "3 * soakMinutes"),
        durationDerived("difference", "Difference", "added - soakMinutes"),
        durationDerived("floored", "Floored", "floor(soakMinutes / 7)"),
        durationDerived("ceiled", "Ceiled", "ceil(soakMinutes / 7)"),
        durationDerived("rounded", "Rounded", "round(soakMinutes / 7)"),
        durationDerived("doubleNegated", "Double negated", "-(-soakMinutes)"),
        durationDerived(
          "homogeneousMin",
          "Homogeneous min",
          "min(soakMinutes, soakMinutes / 2)",
        ),
        durationDerived("halvedHours", "Halved hours", "soakMinutes / 2", "hour"),
        durationDerived(
          "soakRatio",
          "Soak ratio",
          "soakMinutes / halvedHours",
          "minute",
          "numeric",
        ),
        durationDerived(
          "recovered",
          "Recovered",
          "soakRatio * halvedHours",
        ),
      ],
    };

    // soakMinutes entered as 90 minutes resolves to 5400 canonical seconds;
    // every result below is stored in canonical seconds.
    expect(
      ProtocolCore.evaluateProtocol(protocol, { soakMinutes: "90" }),
    ).toEqual({
      ok: true,
      values: {
        soakMinutes: "5400",
        added: "10800",
        scaled: "16200",
        scaledReversed: "16200",
        difference: "5400",
        floored: "720",
        ceiled: "780",
        rounded: "780",
        doubleNegated: "5400",
        homogeneousMin: "2700",
        halvedHours: "2700",
        soakRatio: "2",
        recovered: "5400",
      },
    });
  });

  it("converts cross-unit duration references exactly", () => {
    const protocol: Protocol = {
      ...validProtocol,
      variables: [
        durationInput("incubateHours", "Incubation", "hour"),
        durationInput("prepareHours", "Preparation", "hour"),
        durationDerived("hoursAsMinutes", "Hours as minutes", "incubateHours"),
        durationDerived("hoursAsSeconds", "Hours as seconds", "incubateHours", "second"),
        durationDerived("hoursAsDays", "Hours as days", "prepareHours", "day"),
        durationDerived("scaledToDays", "Scaled to days", "incubateHours * 48", "day"),
        durationDerived("daysAsSeconds", "Days as seconds", "prepareHours", "second"),
        durationDerived("daysAsMinutes", "Days as minutes", "prepareHours"),
      ],
    };

    expect(
      ProtocolCore.evaluateProtocol(protocol, {
        incubateHours: "1",
        prepareHours: "48",
      }),
    ).toEqual({
      ok: true,
      values: {
        incubateHours: "3600",
        prepareHours: "172800",
        hoursAsMinutes: "3600",
        hoursAsSeconds: "3600",
        hoursAsDays: "172800",
        scaledToDays: "172800",
        daysAsSeconds: "172800",
        daysAsMinutes: "172800",
      },
    });
  });

  it("rounds duration results in the declared unit", () => {
    const protocol: Protocol = {
      ...validProtocol,
      variables: [
        durationInput("soakHours", "Soak", "hour"),
        durationInput("prepareDays", "Preparation", "day"),
        durationDerived("roundedHours", "Rounded hours", "soakHours", "hour"),
        durationDerived(
          "roundedExplicit",
          "Rounded explicit",
          "round(soakHours, 1)",
          "hour",
        ),
        durationDerived("ceiledHours", "Ceiled hours", "ceil(soakHours)", "hour"),
        durationDerived("flooredHours", "Floored hours", "floor(soakHours)", "hour"),
        durationDerived("secondsKept", "Seconds kept", "soakHours", "second"),
        durationDerived("wholeDays", "Whole days", "round(prepareDays)", "day"),
      ],
    };

    // 1.005 hours resolves to 3618 seconds. Rounding happens in the declared
    // unit (hour precision 2 half-even collapses 1.005 to 1.00; ceil in hour
    // space reaches 2 h; round without places is zero decimals of the
    // declared unit), never in seconds.
    expect(
      ProtocolCore.evaluateProtocol(protocol, {
        soakHours: "1.005",
        prepareDays: "1.5",
      }),
    ).toEqual({
      ok: true,
      values: {
        soakHours: "3618",
        prepareDays: "129600",
        roundedHours: "3600",
        roundedExplicit: "3600",
        ceiledHours: "7200",
        flooredHours: "3600",
        secondsKept: "3618",
        wholeDays: "172800",
      },
    });
  });

  it("reports a negative final duration while intermediate negatives evaluate freely", () => {
    const baseVariables = [
      durationInput("soakMinutes", "Soak", "minute"),
      durationInput("restMinutes", "Rest", "minute"),
    ];
    const negativeFinal: Protocol = {
      ...validProtocol,
      variables: [
        ...baseVariables,
        durationDerived("delta", "Delta", "soakMinutes - restMinutes"),
      ],
    };
    const intermediateNegative: Protocol = {
      ...validProtocol,
      variables: [
        ...baseVariables,
        durationDerived(
          "recovered",
          "Recovered",
          "soakMinutes - restMinutes + restMinutes",
        ),
        durationDerived("balance", "Balance", "1 - 4", "minute", "numeric"),
      ],
    };

    expect(
      ProtocolCore.evaluateProtocol(negativeFinal, {
        soakMinutes: "30",
        restMinutes: "90",
      }),
    ).toEqual({
      ok: false,
      errors: [
        {
          code: "negative_duration",
          path: "variables.2.formula",
          message: "A Duration Derived Variable result may not be negative",
        },
      ],
    });
    expect(
      ProtocolCore.evaluateProtocol(intermediateNegative, {
        soakMinutes: "30",
        restMinutes: "90",
      }),
    ).toEqual({
      ok: true,
      values: {
        soakMinutes: "1800",
        restMinutes: "5400",
        recovered: "1800",
        balance: "-3",
      },
    });
  });

  it.each([
    ["duration_plus_numeric", "soakMinutes + ratio", "duration"],
    ["numeric_plus_duration", "ratio + soakMinutes", "duration"],
    ["duration_minus_numeric", "soakMinutes - ratio", "duration"],
    ["numeric_minus_duration", "ratio - soakMinutes", "duration"],
    ["duration_times_duration", "soakMinutes * soakMinutes", "duration"],
    ["numeric_divided_by_duration", "ratio / soakMinutes", "duration"],
    ["mixed_min_max_arguments", "min(soakMinutes, ratio)", "duration"],
    ["duration_result_in_numeric_formula", "soakMinutes", "numeric"],
    ["numeric_result_in_duration_formula", "ratio", "duration"],
  ] as const)(
    "rejects %s at Authoring time and during evaluation",
    (code, formula, valueType) => {
      const protocol: Protocol = {
        ...validProtocol,
        variables: [
          durationInput("soakMinutes", "Soak", "minute"),
          {
            kind: "input",
            id: "ratio",
            label: "Ratio",
            valueType: "numeric",
          },
          durationDerived("target", "Target", formula, "minute", valueType),
        ],
      };

      // Inspection surfaces the distinct dimension diagnostic without
      // evaluating: the dependency graph reports it even though no Formula
      // Test Case exists yet.
      const inspection = ProtocolCore.inspectProtocol(protocol);
      expect(inspection.playable).toBe(false);
      expect(inspection.errors).toEqual(
        expect.arrayContaining([
          {
            code,
            path: "variables.2.formula",
            message: expect.any(String),
          },
        ]),
      );

      const graph = ProtocolCore.inspectVariableDependencyGraph(protocol);
      expect(graph.diagnostics).toEqual([
        expect.objectContaining({
          kind: "dimension-mismatch",
          code,
          path: "variables.2.formula",
          variableId: "target",
          variableIndex: 2,
        }),
      ]);
      expect(
        graph.nodes.find((node) => node.id === "target"),
      ).toMatchObject({
        diagnosticCodes: [code],
      });

      const evaluation = ProtocolCore.evaluateProtocol(protocol, {
        soakMinutes: "30",
        ratio: "2",
      });
      expect(evaluation).toMatchObject({
        ok: false,
        errors: [expect.objectContaining({ code })],
      });
    },
  );

  it("reports a duration-derived target with a non-numeric reference as non-numeric", () => {
    const graph = ProtocolCore.inspectVariableDependencyGraph({
      ...validProtocol,
      variables: [
        {
          kind: "input",
          id: "flag",
          label: "Flag",
          valueType: "boolean",
        },
        durationInput("soakMinutes", "Soak", "minute"),
        durationDerived("target", "Target", "flag + soakMinutes"),
      ],
    });

    expect(graph.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "non-numeric-reference",
          code: "non_numeric_variable",
          referencedVariableId: "flag",
        }),
      ]),
    );
  });

  it("carries dimension diagnostics on the matching graph nodes and edges", () => {
    const protocol: Protocol = {
      ...validProtocol,
      variables: [
        {
          kind: "input",
          id: "ratio",
          label: "Ratio",
          valueType: "numeric",
        },
        durationInput("soakMinutes", "Soak", "minute"),
        durationDerived("total", "Total", "ratio + soakMinutes"),
      ],
    };
    const graph = ProtocolCore.inspectVariableDependencyGraph(protocol);

    expect(graph.diagnostics).toEqual([
      {
        kind: "dimension-mismatch",
        code: "numeric_plus_duration",
        path: "variables.2.formula",
        message: "A formula cannot add a Duration to a number",
        variableId: "total",
        variableIndex: 2,
        referencedVariableIds: ["ratio", "soakMinutes"],
        nodeIds: ["ratio", "soakMinutes", "total"],
        edgeIds: ["ratio->total", "soakMinutes->total"],
      },
    ]);
    expect(
      graph.edges.map(({ id, diagnosticCodes }) => ({ id, diagnosticCodes })),
    ).toEqual([
      { id: "ratio->total", diagnosticCodes: ["numeric_plus_duration"] },
      {
        id: "soakMinutes->total",
        diagnosticCodes: ["numeric_plus_duration"],
      },
    ]);
    expect(
      graph.nodes.map(({ id, diagnosticCodes }) => ({ id, diagnosticCodes })),
    ).toEqual([
      { id: "ratio", diagnosticCodes: [] },
      { id: "soakMinutes", diagnosticCodes: [] },
      { id: "total", diagnosticCodes: ["numeric_plus_duration"] },
    ]);

    const inspection = ProtocolCore.inspectProtocol(protocol);
    expect(inspection.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "numeric_plus_duration",
          path: "variables.2.formula",
        }),
      ]),
    );
  });

  it("compares duration Formula Test Case expectations in the declared unit", () => {
    const baseProtocol: Protocol = {
      ...validProtocol,
      variables: [
        durationInput("soakHours", "Soak", "hour"),
        durationDerived("inMinutes", "In minutes", "soakHours"),
        durationDerived("inHours", "In hours", "soakHours", "hour"),
      ],
    };
    const withExpectations = (
      expected: Record<string, string>,
      precision = 2,
    ): Protocol => ({
      ...baseProtocol,
      formulaTestCases: [
        {
          testCaseId: uuid(4_001),
          name: "Duration expectations",
          inputValues: { soakHours: "1" },
          expectedDerivedValues: expected,
          precision,
          roundingMode: "half-even",
        },
      ],
    });

    // Canonical-seconds expectations pass for both declared units.
    expect(
      ProtocolCore.inspectProtocol(
        withExpectations({ inMinutes: "3600", inHours: "3600" }),
      ),
    ).toMatchObject({ playable: true, errors: [] });

    // The declared unit is the rounding authority: 3601 seconds differs from
    // 3600 by 0.00028 hours, which collapses at test-case precision 2 in hour
    // space (while minutes keep full resolution).
    expect(
      ProtocolCore.inspectProtocol(
        withExpectations({ inMinutes: "3600", inHours: "3601" }),
      ),
    ).toMatchObject({ playable: true, errors: [] });

    expect(
      ProtocolCore.inspectProtocol(
        withExpectations({ inMinutes: "3900", inHours: "3600" }),
      ),
    ).toMatchObject({
      playable: false,
      errors: [
        expect.objectContaining({
          code: "formula_test_failed",
          path: "formulaTestCases.0.expectedDerivedValues.inMinutes",
        }),
      ],
    });
  });

  it("reports an unknown Duration Unit on a Duration Derived Variable distinctly", () => {
    const inspection = ProtocolCore.inspectProtocol({
      ...validProtocol,
      variables: [durationDerived("fortnightTotal", "Fortnight", "1", "fortnight" as never)],
    });
    expect(inspection.format).toBe("valid");
    expect(inspection.playable).toBe(false);
    expect(inspection.errors).toEqual(
      expect.arrayContaining([
        {
          code: "invalid_duration_unit",
          path: "variables.0.unit",
          message: "Duration Variable unit must be second, minute, hour, or day",
        },
      ]),
    );

    const evaluation = ProtocolCore.evaluateProtocol(
      {
        ...validProtocol,
        variables: [
          durationDerived("fortnightTotal", "Fortnight", "60 + 60", "fortnight" as never),
        ],
      },
      {},
    );
    expect(evaluation).toMatchObject({
      ok: false,
      errors: [
        expect.objectContaining({
          code: "invalid_duration_unit",
          path: "variables.0.formula",
        }),
      ],
    });
  });
});
