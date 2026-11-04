import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseFrontmatter,
  updateFrontmatter,
  getSmartEnterContinuation,
  handleSmartIndent,
  handleSmartWrapping,
  extractWikiLinks,
  extractTags,
  extractHeadings,
  buildBacklinks,
  parseCalloutHeader,
  parseMarkdownTable,
  formatMarkdownTable,
  applyToolbarFormatAtCursor,
  indentLineRange,
  deleteLineRange,
  moveLineRange,
  duplicateLineRange,
  applyToolbarFormatToLineRange,
  parseHtmlImageTag,
  formatHtmlImageTag,
} from './markdownUtils';
import { FileItem } from '../types/obsidian';

test('parseFrontmatter extracts YAML metadata and separates body', () => {
  const content = `---
title: System Architecture
tags:
  - architecture
  - distributed
publish: true
priority: 1
---
# Main Content
This is the note body.`;

  const parsed = parseFrontmatter(content);
  assert.equal(parsed.hasFrontmatter, true);
  assert.equal(parsed.frontmatter.title, 'System Architecture');
  assert.deepEqual(parsed.frontmatter.tags, ['architecture', 'distributed']);
  assert.equal(parsed.frontmatter.publish, true);
  assert.equal(parsed.frontmatter.priority, 1);
  assert.equal(parsed.body.trim(), '# Main Content\nThis is the note body.');
});

test('updateFrontmatter modifies existing frontmatter properties and supports adding empty text properties', () => {
  const content = `---
tags:
  - doc
status: draft
---
Body text here`;

  const updated = updateFrontmatter(content, 'status', 'published');
  const reparsed = parseFrontmatter(updated);
  assert.equal(reparsed.frontmatter.status, 'published');
  assert.deepEqual(reparsed.frontmatter.tags, ['doc']);

  // Adding a new text property initialized to empty string '' should persist
  const withNewTextProp = updateFrontmatter(updated, 'author', '');
  const reparsedWithText = parseFrontmatter(withNewTextProp);
  assert.equal('author' in reparsedWithText.frontmatter, true);
  assert.equal(reparsedWithText.frontmatter.author, '');

  // Removing the property with undefined should delete it
  const afterRemove = updateFrontmatter(withNewTextProp, 'author', undefined);
  const reparsedAfterRemove = parseFrontmatter(afterRemove);
  assert.equal('author' in reparsedAfterRemove.frontmatter, false);
});

test('getSmartEnterContinuation continues tasks and lists, and breaks out on empty', () => {
  // Task continuation
  const res1 = getSmartEnterContinuation('- [ ] Write tests', 17);
  assert.equal(res1.shouldBreakOut, false);
  assert.equal(res1.continuationPrefix, '- [ ] ');

  // Task breakout on empty
  const res2 = getSmartEnterContinuation('- [ ] ', 6);
  assert.equal(res2.shouldBreakOut, true);

  // Numbered list continuation
  const res3 = getSmartEnterContinuation('1. First item', 13);
  assert.equal(res3.shouldBreakOut, false);
  assert.equal(res3.continuationPrefix, '2. ');

  // Bullet list breakout
  const res4 = getSmartEnterContinuation('  * ', 4);
  assert.equal(res4.shouldBreakOut, true);
});

test('handleSmartIndent indents and outdents correctly', () => {
  const line = '- List item';
  const indented = handleSmartIndent(line, 'indent');
  assert.equal(indented, '  - List item');

  const outdented = handleSmartIndent(indented, 'outdent');
  assert.equal(outdented, '- List item');
});

test('handleSmartWrapping wraps selected text with matching tokens', () => {
  const r1 = handleSmartWrapping('bold text', '*');
  assert.equal(r1.wrapped, '*bold text*');
  assert.equal(r1.handled, true);

  const r2 = handleSmartWrapping('inline code', '`');
  assert.equal(r2.wrapped, '`inline code`');
  assert.equal(r2.handled, true);

  const r3 = handleSmartWrapping('linked target', '[');
  assert.equal(r3.wrapped, '[linked target]');
  assert.equal(r3.handled, true);
});

test('extractWikiLinks finds internal links, subpaths, aliases, and transclusion embeds', () => {
  const text = `
Here is a link to [[Architecture]].
Check sub-heading [[Architecture#Database Layer]].
Link with alias [[Product Roadmaps|2026 Strategy]].
And an embed: ![[System Diagram#Component Overview]].
`;

  const links = extractWikiLinks(text);
  assert.equal(links.length, 4);

  assert.equal(links[0].target, 'Architecture');
  assert.equal(links[0].isEmbed, false);

  assert.equal(links[1].target, 'Architecture');
  assert.equal(links[1].subpath, 'Database Layer');

  assert.equal(links[2].target, 'Product Roadmaps');
  assert.equal(links[2].alias, '2026 Strategy');

  assert.equal(links[3].target, 'System Diagram');
  assert.equal(links[3].subpath, 'Component Overview');
  assert.equal(links[3].isEmbed, true);
});

test('extractTags finds tags and ignores markdown headings', () => {
  const text = `
# Markdown Heading 1
This paragraph has #planning and #obsidian-v2 tags.
## Heading 2
Another #priority/high tag here.
`;
  const tags = extractTags(text);
  assert.ok(tags.includes('planning'));
  assert.ok(tags.includes('obsidian-v2'));
  assert.ok(tags.includes('priority/high'));
  assert.ok(!tags.includes('Markdown'));
});

test('buildBacklinks accurately detects linked and unlinked mentions across documents', () => {
  const files: FileItem[] = [
    {
      id: 'f1',
      path: 'Architecture.md',
      title: 'Architecture',
      folder: 'Design',
      content: '# Architecture\nCore system patterns.',
      updatedAt: Date.now(),
    },
    {
      id: 'f2',
      path: 'Frontend.md',
      title: 'Frontend',
      folder: 'Design',
      content: 'We adhere to the [[Architecture]] guidelines for clean state.',
      updatedAt: Date.now(),
    },
    {
      id: 'f3',
      path: 'Notes.md',
      title: 'Notes',
      folder: 'Daily',
      content: 'Discussing Architecture decisions in yesterday standup.',
      updatedAt: Date.now(),
    },
  ];

  const backlinks = buildBacklinks(files[0], files);
  assert.equal(backlinks.linkedMentions.length, 1);
  assert.equal(backlinks.linkedMentions[0].fileTitle, 'Frontend');

  assert.equal(backlinks.unlinkedMentions.length, 1);
  assert.equal(backlinks.unlinkedMentions[0].fileTitle, 'Notes');
});

test('parseCalloutHeader identifies types and foldability', () => {
  const c1 = parseCalloutHeader('> [!warning] Security Risk');
  assert.ok(c1);
  assert.equal(c1.type, 'warning');
  assert.equal(c1.title, 'Security Risk');
  assert.equal(c1.foldable, false);

  const c2 = parseCalloutHeader('> [!info]- Collapsed Note');
  assert.ok(c2);
  assert.equal(c2.type, 'info');
  assert.equal(c2.foldable, true);
  assert.equal(c2.defaultFolded, true);
});

test('parseMarkdownTable and formatMarkdownTable parse and serialize tables correctly', () => {
  const lines = [
    '| Feature | Status | Priority |',
    '| :--- | :---: | ---: |',
    '| Live Preview | Complete | High |',
    '| Split Panes | In Progress | Medium |',
  ];

  const parsed = parseMarkdownTable(lines);
  assert.equal(parsed.isValid, true);
  assert.deepEqual(parsed.headers, ['Feature', 'Status', 'Priority']);
  assert.equal(parsed.rows.length, 2);
  assert.deepEqual(parsed.rows[0], ['Live Preview', 'Complete', 'High']);

  const formatted = formatMarkdownTable(parsed.headers, parsed.rows, parsed.alignments);
  assert.ok(formatted.includes('Live Preview'));
  assert.ok(formatted.includes('High'));
});

test('applyToolbarFormatAtCursor inserts inline and block items at the current cursor instead of the bottom', () => {
  const doc = ['First line', '', 'Middle paragraph', 'Bottom line'].join('\n');

  // 1. Inserting H1 on empty line 1 (middle of doc) places heading at line 1, not at bottom
  const h1Res = applyToolbarFormatAtCursor(doc, 'h1', { lineIndex: 1, start: 0, end: 0 });
  const h1Lines = h1Res.content.split('\n');
  assert.equal(h1Lines[1], '# New Heading 1');
  assert.equal(h1Lines[h1Lines.length - 1], 'Bottom line');
  assert.equal(h1Res.nextActiveLineIndex, 1);

  // 2. Inserting bold inside "Middle paragraph" at cursor col 7 ("Middle |paragraph")
  const boldRes = applyToolbarFormatAtCursor(doc, 'bold', { lineIndex: 2, start: 7, end: 7 });
  const boldLines = boldRes.content.split('\n');
  assert.equal(boldLines[2], 'Middle **bold text**paragraph');
  assert.equal(boldRes.nextActiveLineIndex, 2);
  assert.deepEqual(boldRes.nextSelection, { start: 9, end: 18 });

  // 3. Inserting a table on empty line 1 places table at line 1, keeping 'Bottom line' at the end
  const tableRes = applyToolbarFormatAtCursor(doc, 'table', { lineIndex: 1, start: 0, end: 0 });
  const tableLines = tableRes.content.split('\n');
  assert.ok(tableLines[1].startsWith('| Column 1 |'));
  assert.equal(tableLines[tableLines.length - 1], 'Bottom line');

  // 4. Inserting an image on empty line 1 places <img src="https://example.com" alt="A cute kitten" width="300"/> at line 1
  const imgRes = applyToolbarFormatAtCursor(doc, 'image', { lineIndex: 1, start: 0, end: 0 });
  const imgLines = imgRes.content.split('\n');
  assert.equal(imgLines[1], '<img src="https://example.com" alt="A cute kitten" width="300"/>');
  assert.equal(imgLines[imgLines.length - 1], 'Bottom line');
});

test('parseHtmlImageTag and formatHtmlImageTag parse and format <img /> syntax accurately', () => {
  const raw = '<img src="https://example.com" alt="A cute kitten" width="300"/>';
  const parsed = parseHtmlImageTag(raw);
  assert.ok(parsed);
  assert.equal(parsed.src, 'https://example.com');
  assert.equal(parsed.alt, 'A cute kitten');
  assert.equal(parsed.width, 300);

  const formatted = formatHtmlImageTag('https://images.example.org/cat.png', 'A cute kitten', 300);
  assert.equal(formatted, '<img src="https://images.example.org/cat.png" alt="A cute kitten" width="300"/>');
});

test('multi-line selection helpers indent, move, duplicate, format, and delete selected line ranges', () => {
  const doc = ['Line A', 'Line B', 'Line C', 'Line D'].join('\n');

  // 1. Indent lines 1..2
  const indented = indentLineRange(doc, 1, 2, 'indent');
  assert.deepEqual(indented.split('\n'), ['Line A', '  Line B', '  Line C', 'Line D']);

  // 2. Move lines 1..2 up by 1
  const movedUp = moveLineRange(doc, 1, 2, 'up');
  assert.deepEqual(movedUp.content.split('\n'), ['Line B', 'Line C', 'Line A', 'Line D']);
  assert.equal(movedUp.newStartLine, 0);
  assert.equal(movedUp.newEndLine, 1);

  // 3. Duplicate lines 1..2
  const duplicated = duplicateLineRange(doc, 1, 2);
  assert.deepEqual(duplicated.content.split('\n'), [
    'Line A',
    'Line B',
    'Line C',
    'Line B',
    'Line C',
    'Line D',
  ]);
  assert.equal(duplicated.newStartLine, 3);
  assert.equal(duplicated.newEndLine, 4);

  // 4. Format lines 0..2 as numbered list
  const numbered = applyToolbarFormatToLineRange(doc, 'number', 0, 2);
  assert.deepEqual(numbered.content.split('\n'), [
    '1. Line A',
    '2. Line B',
    '3. Line C',
    'Line D',
  ]);

  // 5. Delete lines 1..2
  const deleted = deleteLineRange(doc, 1, 2);
  assert.deepEqual(deleted.content.split('\n'), ['Line A', '', 'Line D']);
  assert.equal(deleted.nextLineIndex, 1);

  // 6. Moving selected lines UP across a multi-line Callout jumps over the whole Callout without splitting/merging
  const docWithCallout = [
    'Intro paragraph',
    '> [!tip] Callout Title',
    '> Callout body line 1',
    '> Callout body line 2',
    '## Selected Heading',
    'Selected paragraph',
  ].join('\n');

  const movedPastCalloutUp = moveLineRange(docWithCallout, 4, 5, 'up');
  assert.deepEqual(movedPastCalloutUp.content.split('\n'), [
    'Intro paragraph',
    '## Selected Heading',
    'Selected paragraph',
    '> [!tip] Callout Title',
    '> Callout body line 1',
    '> Callout body line 2',
  ]);
  assert.equal(movedPastCalloutUp.newStartLine, 1);
  assert.equal(movedPastCalloutUp.newEndLine, 2);

  // 7. Moving selected lines DOWN across a multi-line Pipe Table jumps over the whole Table without merging
  const docWithTable = [
    '## Selected Heading',
    '- Selected item with [[Doc|Alias]]',
    '| Col A | Col B |',
    '| :--- | :--- |',
    '| Val 1 | Val 2 |',
    '| Val 3 | Val 4 |',
    'Footer text',
  ].join('\n');

  const movedPastTableDown = moveLineRange(docWithTable, 0, 1, 'down');
  assert.deepEqual(movedPastTableDown.content.split('\n'), [
    '| Col A | Col B |',
    '| :--- | :--- |',
    '| Val 1 | Val 2 |',
    '| Val 3 | Val 4 |',
    '## Selected Heading',
    '- Selected item with [[Doc|Alias]]',
    'Footer text',
  ]);
  assert.equal(movedPastTableDown.newStartLine, 4);
  assert.equal(movedPastTableDown.newEndLine, 5);
});




