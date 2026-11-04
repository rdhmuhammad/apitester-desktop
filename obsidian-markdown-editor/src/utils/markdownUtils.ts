import { FrontmatterData, WikiLinkMatch, FileItem, BacklinkMention, FileBacklinks } from '../types/obsidian';

/**
 * Parses YAML frontmatter if present at line 1 (`--- ... ---`).
 */
export function parseFrontmatter(markdown: string): {
  frontmatter: FrontmatterData;
  rawFrontmatter: string;
  hasFrontmatter: boolean;
  body: string;
  frontmatterLineCount: number;
} {
  const lines = markdown.split('\n');
  if (lines.length < 2 || lines[0].trim() !== '---') {
    return {
      frontmatter: {},
      rawFrontmatter: '',
      hasFrontmatter: false,
      body: markdown,
      frontmatterLineCount: 0,
    };
  }

  let closingIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      closingIndex = i;
      break;
    }
  }

  if (closingIndex === -1) {
    return {
      frontmatter: {},
      rawFrontmatter: '',
      hasFrontmatter: false,
      body: markdown,
      frontmatterLineCount: 0,
    };
  }

  const fmContent = lines.slice(1, closingIndex).join('\n');
  const body = lines.slice(closingIndex + 1).join('\n');
  const frontmatter: FrontmatterData = {};

  // Simple clean YAML parser for standard key-values and lists
  let currentKey = '';
  for (const line of fmContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (trimmed.startsWith('- ') && currentKey) {
      const val = trimmed.slice(2).trim().replace(/^['"](.*)['"]$/, '$1');
      if (Array.isArray(frontmatter[currentKey])) {
        frontmatter[currentKey].push(val);
      } else {
        frontmatter[currentKey] = [val];
      }
      continue;
    }

    const colonIdx = line.indexOf(':');
    if (colonIdx !== -1) {
      const key = line.slice(0, colonIdx).trim();
      const rawVal = line.slice(colonIdx + 1).trim();
      currentKey = key;

      if (rawVal === '' || rawVal === '""' || rawVal === "''") {
        frontmatter[key] = '';
      } else if (rawVal.startsWith('[') && rawVal.endsWith(']')) {
        // inline array: [tag1, tag2]
        const items = rawVal
          .slice(1, -1)
          .split(',')
          .map((s) => s.trim().replace(/^['"](.*)['"]$/, '$1'))
          .filter(Boolean);
        frontmatter[key] = items;
      } else if (rawVal.toLowerCase() === 'true') {
        frontmatter[key] = true;
      } else if (rawVal.toLowerCase() === 'false') {
        frontmatter[key] = false;
      } else if (!isNaN(Number(rawVal)) && rawVal !== '' && !/^['"].*['"]$/.test(rawVal)) {
        frontmatter[key] = Number(rawVal);
      } else {
        frontmatter[key] = rawVal.replace(/^['"](.*)['"]$/, '$1');
      }
    }
  }

  return {
    frontmatter,
    rawFrontmatter: lines.slice(0, closingIndex + 1).join('\n'),
    hasFrontmatter: true,
    body,
    frontmatterLineCount: closingIndex + 1,
  };
}

/**
 * Updates or sets a property in the YAML frontmatter.
 */
export function updateFrontmatter(markdown: string, key: string, value: any): string {
  const parsed = parseFrontmatter(markdown);
  const data: FrontmatterData = { ...parsed.frontmatter };

  if (value === undefined || value === null) {
    delete data[key];
  } else {
    data[key] = value;
  }

  // Serialize back to YAML
  const lines: string[] = ['---'];
  for (const [k, v] of Object.entries(data)) {
    if (Array.isArray(v)) {
      if (v.length === 0) {
        lines.push(`${k}: []`);
      } else {
        lines.push(`${k}:`);
        for (const item of v) {
          lines.push(`  - ${item}`);
        }
      }
    } else if (typeof v === 'boolean' || typeof v === 'number') {
      lines.push(`${k}: ${v}`);
    } else if (v === '') {
      lines.push(`${k}: ""`);
    } else {
      lines.push(`${k}: ${v}`);
    }
  }
  lines.push('---');

  if (parsed.hasFrontmatter) {
    return lines.join('\n') + '\n' + parsed.body;
  } else {
    return lines.join('\n') + '\n\n' + markdown;
  }
}

/**
 * Handles smart list & task continuation when user hits Enter.
 */
export function getSmartEnterContinuation(
  line: string,
  cursorCol: number
): { shouldBreakOut: boolean; continuationPrefix: string; cleanCurrentLine?: string } {
  const lineBeforeCursor = line.slice(0, cursorCol);

  // 1. Task continuation: `- [ ] ` or `- [x] ` or `* [ ] `
  const taskMatch = lineBeforeCursor.match(/^(\s*)([-*])\s+\[([ xX])\]\s*(.*)$/);
  if (taskMatch) {
    const indent = taskMatch[1];
    const bullet = taskMatch[2];
    const textAfter = taskMatch[4];
    // If empty item: break out of task
    if (textAfter.trim() === '') {
      return {
        shouldBreakOut: true,
        continuationPrefix: '',
        cleanCurrentLine: indent,
      };
    }
    return {
      shouldBreakOut: false,
      continuationPrefix: `${indent}${bullet} [ ] `,
    };
  }

  // 2. Numbered list continuation: `1. `
  const numMatch = lineBeforeCursor.match(/^(\s*)(\d+)\.\s*(.*)$/);
  if (numMatch) {
    const indent = numMatch[1];
    const num = parseInt(numMatch[2], 10);
    const textAfter = numMatch[3];
    if (textAfter.trim() === '') {
      return {
        shouldBreakOut: true,
        continuationPrefix: '',
        cleanCurrentLine: indent,
      };
    }
    return {
      shouldBreakOut: false,
      continuationPrefix: `${indent}${num + 1}. `,
    };
  }

  // 3. Bullet continuation: `- ` or `* `
  const bulletMatch = lineBeforeCursor.match(/^(\s*)([-*+])\s*(.*)$/);
  if (bulletMatch) {
    const indent = bulletMatch[1];
    const bullet = bulletMatch[2];
    const textAfter = bulletMatch[3];
    if (textAfter.trim() === '') {
      return {
        shouldBreakOut: true,
        continuationPrefix: '',
        cleanCurrentLine: indent,
      };
    }
    return {
      shouldBreakOut: false,
      continuationPrefix: `${indent}${bullet} `,
    };
  }

  // 4. Blockquote continuation: `> `
  const quoteMatch = lineBeforeCursor.match(/^(\s*>+)\s*(.*)$/);
  if (quoteMatch) {
    const quotePrefix = quoteMatch[1];
    const textAfter = quoteMatch[2];
    if (textAfter.trim() === '') {
      return {
        shouldBreakOut: true,
        continuationPrefix: '',
        cleanCurrentLine: '',
      };
    }
    return {
      shouldBreakOut: false,
      continuationPrefix: `${quotePrefix} `,
    };
  }

  return {
    shouldBreakOut: false,
    continuationPrefix: '',
  };
}

/**
 * Handles Tab and Shift-Tab for smart indentation/outdentation of lists.
 */
export function handleSmartIndent(
  line: string,
  direction: 'indent' | 'outdent'
): string {
  if (direction === 'indent') {
    return '  ' + line;
  } else {
    // Outdent up to 2 spaces or 1 tab
    if (line.startsWith('  ')) {
      return line.slice(2);
    } else if (line.startsWith(' ')) {
      return line.slice(1);
    } else if (line.startsWith('\t')) {
      return line.slice(1);
    }
    return line;
  }
}

/**
 * Handles pairing characters when text is selected (smart wrapping).
 */
export function handleSmartWrapping(
  selectedText: string,
  char: string
): { wrapped: string; handled: boolean } {
  const pairs: Record<string, [string, string]> = {
    '*': ['*', '*'],
    '_': ['_', '_'],
    '`': ['`', '`'],
    '[': ['[', ']'],
    '(': ['(', ')'],
    '{': ['{', '}'],
    '"': ['"', '"'],
    "'": ["'", "'"],
    '~': ['~~', '~~'],
    '$': ['$', '$'],
  };

  if (pairs[char]) {
    const [open, close] = pairs[char];
    return {
      wrapped: `${open}${selectedText}${close}`,
      handled: true,
    };
  }

  return {
    wrapped: selectedText,
    handled: false,
  };
}

/**
 * Extracts wiki-links `[[Target]]`, `[[Target#Heading]]`, `[[Target|Alias]]`, `![[Target]]`.
 */
export function extractWikiLinks(markdown: string): WikiLinkMatch[] {
  const regex = /(!?\[\[(.*?)\]\])/g;
  const matches: WikiLinkMatch[] = [];
  let match;

  while ((match = regex.exec(markdown)) !== null) {
    const raw = match[1];
    const isEmbed = raw.startsWith('!');
    const inner = match[2];

    let target = inner;
    let alias: string | undefined = undefined;
    let subpath: string | undefined = undefined;

    // Check for alias |
    if (target.includes('|')) {
      const parts = target.split('|');
      target = parts[0].trim();
      alias = parts.slice(1).join('|').trim();
    }

    // Check for subpath #
    if (target.includes('#')) {
      const parts = target.split('#');
      target = parts[0].trim();
      subpath = parts.slice(1).join('#').trim();
    }

    matches.push({
      raw,
      target,
      subpath,
      alias,
      isEmbed,
    });
  }

  return matches;
}

/**
 * Extracts hashtags (#tag) from markdown, excluding heading lines.
 */
export function extractTags(markdown: string): string[] {
  const tagsSet = new Set<string>();
  const lines = markdown.split('\n');

  for (const line of lines) {
    // Ignore markdown headings (starts with #, ##, etc.)
    if (/^\s*#{1,6}\s+/.test(line)) continue;

    const regex = /(?:^|\s)#([a-zA-Z0-9_\-\/]+)/g;
    let match;
    while ((match = regex.exec(line)) !== null) {
      const tag = match[1];
      // Exclude pure numbers
      if (!/^\d+$/.test(tag)) {
        tagsSet.add(tag);
      }
    }
  }

  // Also add frontmatter tags
  const fm = parseFrontmatter(markdown);
  if (Array.isArray(fm.frontmatter.tags)) {
    for (const t of fm.frontmatter.tags) {
      const clean = String(t).replace(/^#/, '');
      if (clean) tagsSet.add(clean);
    }
  }

  return Array.from(tagsSet);
}

/**
 * Extracts all headings (# to ######) from markdown.
 */
export function extractHeadings(
  markdown: string
): Array<{ level: number; text: string; id: string; lineIndex: number }> {
  const headings: Array<{ level: number; text: string; id: string; lineIndex: number }> = [];
  const lines = markdown.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^(#{1,6})\s+(.*)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim();
      const id = text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      headings.push({ level, text, id, lineIndex: i });
    }
  }

  return headings;
}

/**
 * Builds incoming backlinks (linked mentions and unlinked mentions) across all workspace files.
 */
export function buildBacklinks(
  currentFile: FileItem,
  allFiles: FileItem[]
): FileBacklinks {
  const linkedMentions: BacklinkMention[] = [];
  const unlinkedMentions: BacklinkMention[] = [];

  const targetTitle = currentFile.title.toLowerCase();
  const targetId = currentFile.id;

  // Frontmatter aliases
  const targetFm = parseFrontmatter(currentFile.content);
  const aliases = Array.isArray(targetFm.frontmatter.aliases)
    ? targetFm.frontmatter.aliases.map((a) => String(a).toLowerCase())
    : [];
  const validNames = [targetTitle, ...aliases].filter(Boolean);

  for (const file of allFiles) {
    if (file.id === targetId) continue;

    const lines = file.content.split('\n');
    const links = extractWikiLinks(file.content);

    // 1. Linked mentions
    for (const link of links) {
      const linkTarget = link.target.toLowerCase();
      if (
        linkTarget === targetTitle ||
        linkTarget === currentFile.path.toLowerCase() ||
        aliases.includes(linkTarget)
      ) {
        // Find line snippet
        const lineIdx = lines.findIndex((l) => l.includes(link.raw));
        const snippet = lineIdx !== -1 ? lines[lineIdx].trim() : file.content.slice(0, 80);
        linkedMentions.push({
          fileId: file.id,
          fileTitle: file.title,
          filePath: file.path,
          snippet,
          lineIndex: lineIdx !== -1 ? lineIdx : 0,
        });
      }
    }

    // 2. Unlinked mentions: occurs as plain word but not inside [[...]]
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const name of validNames) {
        if (!name || name.length < 3) continue;
        const regex = new RegExp(`\\b${escapeRegExp(name)}\\b`, 'i');
        if (regex.test(line)) {
          // Verify it's not already inside a [[...]] link on this line
          const isInsideLink = /\[\[[^\]]*\b/.test(line);
          if (!isInsideLink) {
            unlinkedMentions.push({
              fileId: file.id,
              fileTitle: file.title,
              filePath: file.path,
              snippet: line.trim(),
              lineIndex: i,
            });
            break;
          }
        }
      }
    }
  }

  return { linkedMentions, unlinkedMentions };
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Callout detection and parsing:
 * `> [!type] Title`
 */
export function parseCalloutHeader(line: string): {
  isCallout: boolean;
  type: string;
  foldable: boolean;
  defaultFolded: boolean;
  title: string;
} | null {
  const match = line.match(/^>\s*\[!([a-zA-Z0-9_-]+)\]([+-]?)\s*(.*)$/);
  if (!match) return null;

  const type = match[1].toLowerCase();
  const foldSymbol = match[2];
  const title = match[3].trim() || type.charAt(0).toUpperCase() + type.slice(1);

  return {
    isCallout: true,
    type,
    foldable: foldSymbol === '+' || foldSymbol === '-',
    defaultFolded: foldSymbol === '-',
    title,
  };
}

/**
 * Markdown pipe table parser & generator
 */
export interface ParsedTable {
  headers: string[];
  alignments: Array<'left' | 'center' | 'right'>;
  rows: string[][];
  isValid: boolean;
}

export function parseMarkdownTable(lines: string[]): ParsedTable {
  if (lines.length < 2) {
    return { headers: [], alignments: [], rows: [], isValid: false };
  }

  const cleanRow = (rowStr: string) => {
    let str = rowStr.trim();
    if (str.startsWith('|')) str = str.slice(1);
    if (str.endsWith('|')) str = str.slice(0, -1);
    return str.split('|').map((c) => c.trim());
  };

  const headerCells = cleanRow(lines[0]);
  const delimiterCells = cleanRow(lines[1]);

  if (delimiterCells.length < headerCells.length || !delimiterCells.some((c) => /^:?-+:?$/.test(c))) {
    return { headers: [], alignments: [], rows: [], isValid: false };
  }

  const alignments: Array<'left' | 'center' | 'right'> = delimiterCells.map((c) => {
    const leftColon = c.startsWith(':');
    const rightColon = c.endsWith(':');
    if (leftColon && rightColon) return 'center';
    if (rightColon) return 'right';
    return 'left';
  });

  const rows: string[][] = [];
  for (let i = 2; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed.startsWith('|')) break;
    const cells = cleanRow(lines[i]);
    // Pad to match header length
    while (cells.length < headerCells.length) cells.push('');
    rows.push(cells.slice(0, headerCells.length));
  }

  return {
    headers: headerCells,
    alignments,
    rows,
    isValid: true,
  };
}

export function formatMarkdownTable(
  headers: string[],
  rows: string[][],
  alignments: Array<'left' | 'center' | 'right'> = []
): string {
  const colCount = headers.length;
  const colWidths = new Array(colCount).fill(3);

  // Measure max width for each column
  for (let c = 0; c < colCount; c++) {
    colWidths[c] = Math.max(colWidths[c], (headers[c] || '').length);
    for (const row of rows) {
      colWidths[c] = Math.max(colWidths[c], (row[c] || '').length);
    }
  }

  const pad = (str: string, len: number, align: 'left' | 'center' | 'right' = 'left') => {
    const s = str || '';
    if (s.length >= len) return s;
    const diff = len - s.length;
    if (align === 'right') return ' '.repeat(diff) + s;
    if (align === 'center') {
      const left = Math.floor(diff / 2);
      const right = diff - left;
      return ' '.repeat(left) + s + ' '.repeat(right);
    }
    return s + ' '.repeat(diff);
  };

  const headerLine = '| ' + headers.map((h, i) => pad(h, colWidths[i], alignments[i] || 'left')).join(' | ') + ' |';

  const delimiterLine =
    '| ' +
    headers
      .map((_, i) => {
        const align = alignments[i] || 'left';
        const dashes = '-'.repeat(Math.max(3, colWidths[i] - (align === 'center' ? 2 : align === 'right' ? 1 : 0)));
        if (align === 'center') return `:${dashes}:`;
        if (align === 'right') return `${dashes}:`;
        return `${dashes}`;
      })
      .join(' | ') +
    ' |';

  const rowLines = rows.map(
    (row) =>
      '| ' +
      headers
        .map((_, i) => pad(row[i] || '', colWidths[i], alignments[i] || 'left'))
        .join(' | ') +
      ' |'
  );

  return [headerLine, delimiterLine, ...rowLines].join('\n');
}

export interface CursorPosition {
  lineIndex: number;
  start: number;
  end: number;
}

export interface ToolbarFormatResult {
  content: string;
  nextActiveLineIndex: number | null;
  nextSelection: { start: number; end: number } | null;
}

/**
 * Inserts or wraps markdown syntax at the current cursor line and column.
 */
export function applyToolbarFormatAtCursor(
  markdown: string,
  actionType: string,
  cursor: CursorPosition
): ToolbarFormatResult {
  const lines = markdown.split('\n');
  const lineIdx = Math.max(0, Math.min(lines.length - 1, cursor.lineIndex));
  const currentLine = lines[lineIdx] ?? '';
  const selStart = Math.max(0, Math.min(currentLine.length, cursor.start));
  const selEnd = Math.max(selStart, Math.min(currentLine.length, cursor.end));
  const selectedText = currentLine.slice(selStart, selEnd);

  // 1. Inline formatting actions
  const inlineMap: Record<
    string,
    { prefix: string; suffix: string; placeholder: string }
  > = {
    bold: { prefix: '**', suffix: '**', placeholder: 'bold text' },
    italic: { prefix: '*', suffix: '*', placeholder: 'italic text' },
    strike: { prefix: '~~', suffix: '~~', placeholder: 'strikethrough' },
    code: { prefix: '`', suffix: '`', placeholder: 'code' },
    link: { prefix: '[[', suffix: ']]', placeholder: 'Getting Started' },
  };

  if (inlineMap[actionType]) {
    const { prefix, suffix, placeholder } = inlineMap[actionType];
    const innerText = selectedText || placeholder;
    const inserted = `${prefix}${innerText}${suffix}`;
    lines[lineIdx] =
      currentLine.slice(0, selStart) + inserted + currentLine.slice(selEnd);
    const newStart = selStart + prefix.length;
    const newEnd = newStart + innerText.length;

    return {
      content: lines.join('\n'),
      nextActiveLineIndex: lineIdx,
      nextSelection: { start: newStart, end: newEnd },
    };
  }

  // 2. Single-line block items (Headings, Lists, Tasks, Blockquotes)
  const singleBlockMap: Record<string, { marker: string; placeholder: string }> = {
    h1: { marker: '# ', placeholder: 'New Heading 1' },
    h2: { marker: '## ', placeholder: 'New Heading 2' },
    h3: { marker: '### ', placeholder: 'New Heading 3' },
    bullet: { marker: '- ', placeholder: 'Bullet item' },
    number: { marker: '1. ', placeholder: 'Numbered item' },
    task: { marker: '- [ ] ', placeholder: 'Action item' },
    quote: { marker: '> ', placeholder: 'Quoted insight' },
  };

  if (singleBlockMap[actionType]) {
    const { marker, placeholder } = singleBlockMap[actionType];

    // If current line is empty or whitespace-only, insert directly on current line
    if (currentLine.trim() === '') {
      const indent = currentLine.slice(0, selStart);
      const newLine = `${indent}${marker}${placeholder}`;
      lines[lineIdx] = newLine;
      return {
        content: lines.join('\n'),
        nextActiveLineIndex: lineIdx,
        nextSelection: {
          start: indent.length + marker.length,
          end: newLine.length,
        },
      };
    }

    // If cursor is at column 0 on a non-empty line, insert at current line index before existing text
    if (selStart === 0 && selEnd === 0) {
      const newLine = `${marker}${placeholder}`;
      lines.splice(lineIdx, 0, newLine);
      return {
        content: lines.join('\n'),
        nextActiveLineIndex: lineIdx,
        nextSelection: { start: marker.length, end: newLine.length },
      };
    }

    // If cursor is in the middle of a line, split at cursor and place block item on new line
    if (selStart < currentLine.length) {
      const before = currentLine.slice(0, selStart);
      const after = currentLine.slice(selEnd);
      const textBody = selectedText || placeholder;
      const newLine = `${marker}${textBody}`;
      if (after.length > 0) {
        lines.splice(lineIdx, 1, before, newLine, after);
      } else {
        lines.splice(lineIdx, 1, before, newLine);
      }
      return {
        content: lines.join('\n'),
        nextActiveLineIndex: lineIdx + 1,
        nextSelection: { start: marker.length, end: newLine.length },
      };
    }

    // Cursor is at end of non-empty line: insert on the next line
    const newLine = `${marker}${placeholder}`;
    lines.splice(lineIdx + 1, 0, newLine);
    return {
      content: lines.join('\n'),
      nextActiveLineIndex: lineIdx + 1,
      nextSelection: { start: marker.length, end: newLine.length },
    };
  }

  // 3. Multi-line / Widget block items (Callout, Table, Embed, Image)
  const multiBlockMap: Record<string, string[]> = {
    callout: [
      '> [!tip] Practical Advice',
      '> Add your key recommendation here.',
    ],
    table: [
      '| Column 1 | Column 2 | Column 3 |',
      '| :--- | :---: | ---: |',
      '| Row 1 A | Row 1 B | Row 1 C |',
      '| Row 2 A | Row 2 B | Row 2 C |',
    ],
    embed: ['![[Component Overview]]'],
    image: ['<img src="https://example.com" alt="A cute kitten" width="300"/>'],
  };

  if (multiBlockMap[actionType]) {
    const blockLines = multiBlockMap[actionType];

    if (currentLine.trim() === '') {
      lines.splice(lineIdx, 1, ...blockLines, '');
      const trailingIdx = lineIdx + blockLines.length;
      return {
        content: lines.join('\n'),
        nextActiveLineIndex: trailingIdx,
        nextSelection: { start: 0, end: 0 },
      };
    }

    if (selStart === 0 && selEnd === 0) {
      lines.splice(lineIdx, 0, ...blockLines);
      return {
        content: lines.join('\n'),
        nextActiveLineIndex: lineIdx + blockLines.length,
        nextSelection: { start: 0, end: 0 },
      };
    }

    if (selStart < currentLine.length) {
      const before = currentLine.slice(0, selStart);
      const after = currentLine.slice(selEnd);
      lines.splice(lineIdx, 1, before, ...blockLines, after);
      return {
        content: lines.join('\n'),
        nextActiveLineIndex: lineIdx + 1 + blockLines.length,
        nextSelection: { start: 0, end: 0 },
      };
    }

    lines.splice(lineIdx + 1, 0, ...blockLines, '');
    const trailingIdx = lineIdx + 1 + blockLines.length;
    return {
      content: lines.join('\n'),
      nextActiveLineIndex: trailingIdx,
      nextSelection: { start: 0, end: 0 },
    };
  }

  return {
    content: markdown,
    nextActiveLineIndex: lineIdx,
    nextSelection: { start: selStart, end: selEnd },
  };
}

/**
 * Indents or outdents a contiguous range of lines [startLine, endLine].
 */
export function indentLineRange(
  markdown: string,
  startLine: number,
  endLine: number,
  direction: 'indent' | 'outdent'
): string {
  const lines = markdown.split('\n');
  const s = Math.max(0, Math.min(startLine, endLine));
  const e = Math.min(lines.length - 1, Math.max(startLine, endLine));

  for (let i = s; i <= e; i++) {
    lines[i] = handleSmartIndent(lines[i], direction);
  }
  return lines.join('\n');
}

/**
 * Deletes a contiguous range of lines [startLine, endLine] and leaves a clean cursor line.
 */
export function deleteLineRange(
  markdown: string,
  startLine: number,
  endLine: number,
  replacementText = ''
): { content: string; nextLineIndex: number; nextCol: number } {
  const lines = markdown.split('\n');
  const s = Math.max(0, Math.min(startLine, endLine));
  const e = Math.min(lines.length - 1, Math.max(startLine, endLine));
  const count = e - s + 1;

  const replacementLines = replacementText.split('\n');
  lines.splice(s, count, ...replacementLines);

  if (lines.length === 0) {
    lines.push('');
  }

  const nextLineIndex = Math.min(
    lines.length - 1,
    s + replacementLines.length - 1
  );
  const nextCol = (lines[nextLineIndex] || '').length;

  return {
    content: lines.join('\n'),
    nextLineIndex,
    nextCol,
  };
}

export interface ComponentBlockRange {
  startLine: number;
  endLine: number;
  type: 'code' | 'table' | 'callout';
}

/**
 * Identifies multi-line component blocks (fenced code blocks, pipe tables, callouts)
 * outside of the optional excluded line range [excludeRange.startLine, excludeRange.endLine].
 */
export function getComponentBlocks(
  lines: string[],
  excludeRange?: { startLine: number; endLine: number }
): ComponentBlockRange[] {
  const blocks: ComponentBlockRange[] = [];
  const isExcluded = (idx: number) =>
    excludeRange !== undefined &&
    idx >= excludeRange.startLine &&
    idx <= excludeRange.endLine;

  let i = 0;
  const fm = parseFrontmatter(lines.join('\n'));
  if (fm.hasFrontmatter) {
    i = fm.frontmatterLineCount;
  }

  while (i < lines.length) {
    if (isExcluded(i)) {
      i++;
      continue;
    }

    const line = lines[i];
    const trimmed = line.trim();

    // 1. Code Block: ``` ... ```
    if (trimmed.startsWith('```')) {
      const startLine = i;
      i++;
      while (
        i < lines.length &&
        !lines[i].trim().startsWith('```') &&
        !isExcluded(i)
      ) {
        i++;
      }
      const endLine = i < lines.length && !isExcluded(i) ? i : i - 1;
      blocks.push({ startLine, endLine, type: 'code' });
      i = endLine + 1;
      continue;
    }

    // 2. Pipe Table: | ... |
    if (trimmed.startsWith('|') && line.includes('|')) {
      const startLine = i;
      i++;
      while (
        i < lines.length &&
        lines[i].trim().startsWith('|') &&
        !isExcluded(i)
      ) {
        i++;
      }
      const endLine = i - 1;
      blocks.push({ startLine, endLine, type: 'table' });
      continue;
    }

    // 3. Callout: > [!type]
    if (parseCalloutHeader(line)) {
      const startLine = i;
      i++;
      while (
        i < lines.length &&
        lines[i].trim().startsWith('>') &&
        !parseCalloutHeader(lines[i]) &&
        !isExcluded(i)
      ) {
        i++;
      }
      const endLine = i - 1;
      blocks.push({ startLine, endLine, type: 'callout' });
      continue;
    }

    i++;
  }

  return blocks;
}

/**
 * Moves a contiguous range of lines [startLine, endLine] up or down.
 * When a multi-line component (Callout, Pipe Table, or Code Block) is in the way,
 * jumps over the entire component block as a unit so the selected lines never
 * merge into or split the component.
 */
export function moveLineRange(
  markdown: string,
  startLine: number,
  endLine: number,
  direction: 'up' | 'down',
  minAllowedLine = 0
): { content: string; newStartLine: number; newEndLine: number } {
  const lines = markdown.split('\n');
  const s = Math.max(0, Math.min(startLine, endLine));
  const e = Math.min(lines.length - 1, Math.max(startLine, endLine));
  const count = e - s + 1;

  const blocks = getComponentBlocks(lines, { startLine: s, endLine: e });

  if (direction === 'up') {
    if (s <= minAllowedLine) {
      return { content: markdown, newStartLine: s, newEndLine: e };
    }
    const targetAbove = s - 1;
    const compAbove = blocks.find(
      (b) => b.startLine <= targetAbove && targetAbove <= b.endLine
    );
    const stepUp = compAbove
      ? s - Math.max(minAllowedLine, compAbove.startLine)
      : 1;

    if (stepUp <= 0) {
      return { content: markdown, newStartLine: s, newEndLine: e };
    }

    const block = lines.splice(s, count);
    const newStart = s - stepUp;
    lines.splice(newStart, 0, ...block);
    return {
      content: lines.join('\n'),
      newStartLine: newStart,
      newEndLine: newStart + count - 1,
    };
  } else {
    if (e >= lines.length - 1) {
      return { content: markdown, newStartLine: s, newEndLine: e };
    }
    const targetBelow = e + 1;
    const compBelow = blocks.find(
      (b) => b.startLine <= targetBelow && targetBelow <= b.endLine
    );
    const stepDown = compBelow
      ? Math.min(lines.length - 1, compBelow.endLine) - e
      : 1;

    if (stepDown <= 0) {
      return { content: markdown, newStartLine: s, newEndLine: e };
    }

    const block = lines.splice(s, count);
    const newStart = s + stepDown;
    lines.splice(newStart, 0, ...block);
    return {
      content: lines.join('\n'),
      newStartLine: newStart,
      newEndLine: newStart + count - 1,
    };
  }
}

/**
 * Duplicates a contiguous range of lines [startLine, endLine] right below endLine.
 */
export function duplicateLineRange(
  markdown: string,
  startLine: number,
  endLine: number
): { content: string; newStartLine: number; newEndLine: number } {
  const lines = markdown.split('\n');
  const s = Math.max(0, Math.min(startLine, endLine));
  const e = Math.min(lines.length - 1, Math.max(startLine, endLine));
  const count = e - s + 1;

  const block = lines.slice(s, e + 1);
  lines.splice(e + 1, 0, ...block);

  return {
    content: lines.join('\n'),
    newStartLine: e + 1,
    newEndLine: e + count,
  };
}

/**
 * Applies a toolbar formatting action across all lines in [startLine, endLine].
 */
export function applyToolbarFormatToLineRange(
  markdown: string,
  actionType: string,
  startLine: number,
  endLine: number
): { content: string; newStartLine: number; newEndLine: number } {
  const lines = markdown.split('\n');
  const s = Math.max(0, Math.min(startLine, endLine));
  const e = Math.min(lines.length - 1, Math.max(startLine, endLine));

  const inlineMap: Record<string, { prefix: string; suffix: string }> = {
    bold: { prefix: '**', suffix: '**' },
    italic: { prefix: '*', suffix: '*' },
    strike: { prefix: '~~', suffix: '~~' },
    code: { prefix: '`', suffix: '`' },
    link: { prefix: '[[', suffix: ']]' },
  };

  if (inlineMap[actionType]) {
    const { prefix, suffix } = inlineMap[actionType];
    for (let i = s; i <= e; i++) {
      if (lines[i].trim() !== '') {
        lines[i] = `${prefix}${lines[i]}${suffix}`;
      }
    }
    return { content: lines.join('\n'), newStartLine: s, newEndLine: e };
  }

  if (actionType === 'bullet') {
    const allBullets = lines
      .slice(s, e + 1)
      .filter((l) => l.trim() !== '')
      .every((l) => /^\s*[-*+]\s+/.test(l));
    for (let i = s; i <= e; i++) {
      if (lines[i].trim() === '') continue;
      if (allBullets) {
        lines[i] = lines[i].replace(/^(\s*)[-*+]\s+/, '$1');
      } else {
        const stripped = lines[i].replace(/^(\s*)(?:[-*+]|\d+\.)\s+(?:\[[ xX]\]\s+)?/, '$1');
        lines[i] = stripped.replace(/^(\s*)/, '$1- ');
      }
    }
    return { content: lines.join('\n'), newStartLine: s, newEndLine: e };
  }

  if (actionType === 'number') {
    let counter = 1;
    for (let i = s; i <= e; i++) {
      if (lines[i].trim() === '') continue;
      const stripped = lines[i].replace(/^(\s*)(?:[-*+]|\d+\.)\s+(?:\[[ xX]\]\s+)?/, '$1');
      lines[i] = stripped.replace(/^(\s*)/, `$1${counter}. `);
      counter++;
    }
    return { content: lines.join('\n'), newStartLine: s, newEndLine: e };
  }

  if (actionType === 'task') {
    for (let i = s; i <= e; i++) {
      if (lines[i].trim() === '') continue;
      const stripped = lines[i].replace(/^(\s*)(?:[-*+]|\d+\.)\s+(?:\[[ xX]\]\s+)?/, '$1');
      lines[i] = stripped.replace(/^(\s*)/, '$1- [ ] ');
    }
    return { content: lines.join('\n'), newStartLine: s, newEndLine: e };
  }

  if (actionType === 'quote') {
    for (let i = s; i <= e; i++) {
      lines[i] = `> ${lines[i]}`;
    }
    return { content: lines.join('\n'), newStartLine: s, newEndLine: e };
  }

  const headingMap: Record<string, string> = {
    h1: '# ',
    h2: '## ',
    h3: '### ',
  };
  if (headingMap[actionType]) {
    const prefix = headingMap[actionType];
    for (let i = s; i <= e; i++) {
      if (lines[i].trim() === '') continue;
      const stripped = lines[i].replace(/^\s*#{1,6}\s+/, '');
      lines[i] = `${prefix}${stripped}`;
    }
    return { content: lines.join('\n'), newStartLine: s, newEndLine: e };
  }

  if (actionType === 'image') {
    const imgLine = '<img src="https://example.com" alt="A cute kitten" width="300"/>';
    lines.splice(e + 1, 0, imgLine);
    return { content: lines.join('\n'), newStartLine: e + 1, newEndLine: e + 1 };
  }

  return { content: lines.join('\n'), newStartLine: s, newEndLine: e };
}

export interface ParsedHtmlImage {
  src: string;
  alt: string;
  width: number;
  indentSpaces: number;
  raw: string;
}

/**
 * Parses an HTML <img src="..." alt="..." width="300"/> line.
 */
export function parseHtmlImageTag(line: string): ParsedHtmlImage | null {
  const match = line.match(/^(\s*)<img\b([^>]*?)\/?>\s*$/i);
  if (!match) return null;

  const indentSpaces = match[1].length;
  const attrs = match[2];

  const srcMatch =
    attrs.match(/\bsrc\s*=\s*"([^"]*)"/i) ||
    attrs.match(/\bsrc\s*=\s*'([^']*)'/i);
  const altMatch =
    attrs.match(/\balt\s*=\s*"([^"]*)"/i) ||
    attrs.match(/\balt\s*=\s*'([^']*)'/i);
  const widthMatch =
    attrs.match(/\bwidth\s*=\s*"(\d+)"/i) ||
    attrs.match(/\bwidth\s*=\s*'(\d+)'/i) ||
    attrs.match(/\bwidth\s*=\s*(\d+)/i);

  const src = srcMatch ? srcMatch[1] : '';
  const alt = altMatch ? altMatch[1] : 'A cute kitten';
  const width = widthMatch ? parseInt(widthMatch[1], 10) || 300 : 300;

  return {
    src,
    alt,
    width,
    indentSpaces,
    raw: line.trim(),
  };
}

/**
 * Formats an HTML <img src="..." alt="..." width="300"/> line.
 */
export function formatHtmlImageTag(
  src: string,
  alt: string,
  width = 300,
  indentSpaces = 0
): string {
  const indent = ' '.repeat(Math.max(0, indentSpaces));
  return `${indent}<img src="${src}" alt="${alt}" width="${width}"/>`;
}



