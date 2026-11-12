import type { FileItem } from './types.ts';

/**
 * Normalizes a workspace file ID or wiki-link target into a lowercase,
 * forward-slash-separated relative path without leading `./` or `/` or `.md`.
 */
export function normalizeLinkPath(value: string): string {
  return value
    .trim()
    .replace(/\\/g, '/')
    .replace(/^(?:\.\/|\/)+/, '')
    .replace(/\.md$/i, '')
    .toLowerCase();
}

export interface ParsedWikiLinkInner {
  target: string;
  subpath?: string;
  alias?: string;
  label: string;
}

/**
 * Parses the inner text of `[[...]]` or `![[...]]`, handling both `#heading`
 * subpaths and `|alias` display labels (including `[[doc#heading|alias]]`).
 */
export function parseWikiLinkInner(inner: string): ParsedWikiLinkInner {
  let targetPart = inner;
  let alias: string | undefined;

  const pipeIdx = inner.indexOf('|');
  if (pipeIdx !== -1) {
    targetPart = inner.slice(0, pipeIdx).trim();
    alias = inner.slice(pipeIdx + 1).trim();
  }

  let target = targetPart.trim();
  let subpath: string | undefined;

  const hashIdx = targetPart.indexOf('#');
  if (hashIdx !== -1) {
    target = targetPart.slice(0, hashIdx).trim();
    const rawSubpath = targetPart.slice(hashIdx + 1).trim();
    subpath = rawSubpath || undefined;
  }

  const label = alias || (subpath ? `${target} > ${subpath}` : target);
  return { target, subpath, alias, label };
}

function compareMatches(a: FileItem, b: FileItem): number {
  const depthDiff = a.id.split('/').length - b.id.split('/').length;
  if (depthDiff !== 0) return depthDiff;
  const lenDiff = a.id.length - b.id.length;
  if (lenDiff !== 0) return lenDiff;
  return a.id.localeCompare(b.id);
}

/**
 * Resolves an Obsidian-style wiki-link or transclusion target against workspace files.
 * Supports both folder-qualified paths (`[[concept/get-prompt]]`) and short names (`[[get-prompt]]`).
 */
export function resolveLinkTarget(files: FileItem[], rawTarget: string): FileItem | undefined {
  const rawTrimmed = rawTarget.trim().toLowerCase();
  const cleanTarget = normalizeLinkPath(rawTarget);
  if (!cleanTarget) return undefined;

  // 1. Exact vault-relative path match (e.g. `concept/get-prompt` -> `concept/get-prompt.md`)
  const exact = files.find(
    (f) =>
      normalizeLinkPath(f.id) === cleanTarget ||
      f.id.toLowerCase() === rawTrimmed ||
      f.path.toLowerCase() === rawTrimmed
  );
  if (exact) return exact;

  // 2. Suffix path / shortest-path match (Obsidian style)
  // Folder-qualified targets only match trailing folder segments, never a bare basename in another folder.
  const hasFolder = cleanTarget.includes('/');
  const suffix = `/${cleanTarget}`;
  const candidates = files.filter((f) => {
    const normId = normalizeLinkPath(f.id);
    if (normId.endsWith(suffix)) return true;
    return !hasFolder && f.title.toLowerCase() === cleanTarget;
  });

  if (candidates.length === 0) return undefined;
  return candidates.sort(compareMatches)[0];
}
