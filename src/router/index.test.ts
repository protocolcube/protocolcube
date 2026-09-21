import { describe, expect, it } from "vitest";
import { ProtocolCore, type Envelope } from "../domain/protocol";
import { translateLegacyHash } from "./legacy-hash";
import { classifyDocument } from "../stores/app-shell";

function documentWithEnvelope(envelope: Envelope): string {
  return `<script id="protocol-box-data" type="application/octet-stream">${ProtocolCore.encodeEnvelope(envelope)}</script>`;
}

describe("routing bootstrap helpers", () => {
  it("translates pre-router Help hashes without changing non-Help hashes", () => {
    expect(translateLegacyHash("#help")).toBe("#/help");
    expect(translateLegacyHash("#help/author")).toBe("#/help/author");
    expect(translateLegacyHash("#help/author/sections")).toBe(
      "#/help/author/sections",
    );
    expect(translateLegacyHash("#/help")).toBeUndefined();
    expect(translateLegacyHash("#reader")).toBeUndefined();
  });

  it("classifies a Published Protocol document from its inert envelope", () => {
    const envelope: Envelope = {
      documentKind: "protocol-box/published-protocol",
      formatVersion: 1,
      appVersion: "0.0.0",
      protocol: {
        protocolId: "018f7f3e-7b1d-7a91-bf10-8f767a9c0f51",
        title: "Example",
        sections: [],
        variables: [],
        formulaTestCases: [],
      },
      signature: {
        algorithm: "ECDSA-P256-SHA256",
        publicKeySpki: "cHVibGljLWtleQ",
        keyId: "a".repeat(64),
        value: "A".repeat(86),
      },
    };

    expect(classifyDocument(documentWithEnvelope(envelope))).toBe(
      "published-protocol",
    );
    expect(classifyDocument("<!doctype html><html></html>")).toBe(
      "application",
    );
  });
});
