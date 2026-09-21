const legacyHelpHashPattern = /^#help(?:(\/.*)?)$/;

export function translateLegacyHash(hash: string): string | undefined {
  const match = legacyHelpHashPattern.exec(hash);
  if (match === null) return undefined;
  return `#/help${match[1] ?? ""}`;
}
