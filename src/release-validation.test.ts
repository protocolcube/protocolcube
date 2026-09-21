import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("release validation", () => {
  it("provides one command that runs every automated release gate", async () => {
    const packageJson = JSON.parse(
      await readFile(new URL("../package.json", import.meta.url), "utf8"),
    ) as { scripts?: Record<string, string> };

    expect(packageJson.scripts?.validate).toBe(
      "pnpm test && pnpm typecheck && pnpm build && playwright test",
    );
  });
});
