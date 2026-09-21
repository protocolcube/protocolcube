// @vitest-environment jsdom

import { indexedDB } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { AuthorWorkspace } from "./index";

describe("AuthorWorkspace content policy", () => {
  it("reduces pasted rich text to safe supported content", async () => {
    const workspace = await AuthorWorkspace.open({
      databaseName: `author-content-${crypto.randomUUID()}`,
      indexedDB,
    });
    const sanitized = workspace.sanitizePastedHtml(`
      <h2 onclick="alert(1)">Step</h2>
      <script>alert(1)</script>
      <iframe src="https://attacker.example"></iframe>
      <a href="javascript:alert(1)">bad</a>
      <a href="https://example.com">good</a>
      <img src="https://example.com/tracker.png">
    `);

    expect(sanitized).toContain("<h2>Step</h2>");
    expect(sanitized).toContain('href="https://example.com"');
    expect(sanitized).not.toMatch(
      /script|iframe|onclick|javascript:|tracker\.png/i,
    );
  });

  it("sanitizes SVG into an inert embedded image", async () => {
    const workspace = await AuthorWorkspace.open({
      databaseName: `author-content-${crypto.randomUUID()}`,
      indexedDB,
    });
    const sanitized = workspace.sanitizeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)">
        <script>alert(1)</script>
        <foreignObject><iframe src="https://attacker.example"></iframe></foreignObject>
        <image href="https://attacker.example/tracker.png"></image>
        <animate attributeName="x"></animate>
        <rect width="10" height="10"></rect>
      </svg>
    `);

    expect(sanitized).toContain("<rect");
    expect(sanitized).not.toMatch(
      /script|foreignObject|iframe|onload|https:|animate/i,
    );
    expect(
      workspace.sanitizeSvg(
        '<svg xmlns="http://www.w3.org/2000/svg" style="fill:url(https://attacker.example/a)"><rect width="1" height="1"></rect></svg>',
      ),
    ).not.toMatch(/url\(|https:/i);
  });

  it("embeds only supported images whose signatures and limits agree", async () => {
    const workspace = await AuthorWorkspace.open({
      databaseName: `author-content-${crypto.randomUUID()}`,
      indexedDB,
    });
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    expect(
      workspace.importImage({
        bytes: png,
        mimeType: "image/png",
        width: 10,
        height: 10,
      }),
    ).toMatch(/^data:image\/png;base64,/);
    expect(() =>
      workspace.importImage({
        bytes: new Uint8Array([0x00, 0x01]),
        mimeType: "image/png",
        width: 10,
        height: 10,
      }),
    ).toThrowError(
      expect.objectContaining({
        code: "image_format_mismatch",
        path: "image",
      }),
    );
    expect(() =>
      workspace.importImage({
        bytes: png,
        mimeType: "image/png",
        width: 10_000,
        height: 5_001,
      }),
    ).toThrowError(
      expect.objectContaining({ code: "image_dimensions_exceeded" }),
    );
  });

  it("downloads a remote image only after explicit Author confirmation", async () => {
    let downloads = 0;
    const workspace = await AuthorWorkspace.open({
      databaseName: `author-content-${crypto.randomUUID()}`,
      indexedDB,
      remoteImageLoader: async () => {
        downloads += 1;
        return {
          bytes: new Uint8Array([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
          ]),
          mimeType: "image/png",
          width: 10,
          height: 10,
        };
      },
    });

    await expect(
      workspace.importRemoteImage({
        url: "https://example.test/diagram.png",
        confirmed: false,
      }),
    ).rejects.toMatchObject({ code: "remote_image_confirmation_required" });
    expect(downloads).toBe(0);

    await expect(
      workspace.importRemoteImage({
        url: "https://example.test/diagram.png",
        confirmed: true,
      }),
    ).resolves.toMatch(/^data:image\/png;base64,/);
    expect(downloads).toBe(1);
  });
});
