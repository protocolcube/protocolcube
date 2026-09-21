import type { AuthorScreenshotId } from "./author-guide-content";

// Populate these values after uploading files from screenshot/ to a stable CDN.
export const helpScreenshotUrls: Record<AuthorScreenshotId, string | undefined> = {
  "author-access": undefined,
  authoring: undefined,
  "publish-readiness": undefined,
};

export function configuredHelpScreenshotUrl(
  id: AuthorScreenshotId,
): string | undefined {
  const value = helpScreenshotUrls[id];
  if (value === undefined) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}
