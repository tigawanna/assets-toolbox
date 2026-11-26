export function legacyBoardPath(hash: string): string | null {
  const match = /^#\/board\/([^/?#]+)/.exec(hash);
  if (!match?.[1]) return null;
  try {
    const projectId = decodeURIComponent(match[1]);
    return `/packages/screenshot-studio/board/${encodeURIComponent(projectId)}`;
  } catch {
    return null;
  }
}
