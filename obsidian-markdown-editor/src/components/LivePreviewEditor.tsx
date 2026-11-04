import React, {
  useState,
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
} from 'react';
import { FileItem } from '../types/obsidian';
import {
  parseFrontmatter,
  getSmartEnterContinuation,
  handleSmartIndent,
  handleSmartWrapping,
  parseCalloutHeader,
  applyToolbarFormatAtCursor,
  indentLineRange,
  deleteLineRange,
  moveLineRange,
  duplicateLineRange,
  applyToolbarFormatToLineRange,
  parseHtmlImageTag,
  formatHtmlImageTag,
  CursorPosition,
} from '../utils/markdownUtils';
import { FrontmatterWidget } from './FrontmatterWidget';
import { CalloutWidget } from './CalloutWidget';
import { TableWidget } from './TableWidget';
import { CodeBlockWidget } from './CodeBlockWidget';
import { TransclusionEmbed } from './TransclusionEmbed';
import { ImageWidget } from './ImageWidget';
import { FormattedInlineText } from './FormattedInlineText';
import { AutocompletePopover, AutocompleteOption } from './AutocompletePopover';
import {
  ChevronDown,
  ChevronRight,
  Check,
  ArrowUp,
  ArrowDown,
  Indent,
  Outdent,
  Copy,
  CopyPlus,
  Trash2,
  X,
} from 'lucide-react';

export interface LivePreviewEditorHandle {
  applyFormatAction: (actionType: string) => void;
}

interface LivePreviewEditorProps {
  file: FileItem;
  files: FileItem[];
  allTags: string[];
  onChange: (newContent: string) => void;
  onNavigateFile: (target: string) => void;
  onHoverWikiLink: (target: string, e: React.MouseEvent) => void;
  onLeaveWikiLink: () => void;
  onTagClick?: (tag: string) => void;
}

export const LivePreviewEditor = forwardRef<
  LivePreviewEditorHandle,
  LivePreviewEditorProps
>(
  (
    {
      file,
      files,
      allTags,
      onChange,
      onNavigateFile,
      onHoverWikiLink,
      onLeaveWikiLink,
      onTagClick,
    },
    ref
  ) => {
    const lines = file.content.split('\n');

    // Default to line 0 active when document is empty so cursor starts immediately at 0
    const [activeLineIndex, setActiveLineIndex] = useState<number | null>(() =>
      file.content.trim() === '' ? 0 : null
    );
    // Multi-line selection state: [startLine, endLine] inclusive
    const [selectedLineRange, setSelectedLineRange] = useState<{
      startLine: number;
      endLine: number;
    } | null>(null);
    const [selectionAnchorLine, setSelectionAnchorLine] = useState<number | null>(
      null
    );
    const [collapsedHeadings, setCollapsedHeadings] = useState<Set<number>>(
      new Set()
    );

    // Refs for active line input, cursor column, and mouse drag selection
    const activeInputRef = useRef<HTMLInputElement | null>(null);
    const pendingCursorRange = useRef<{ start: number; end: number } | null>(
      null
    );
    const lastCursorPos = useRef<CursorPosition | null>(
      file.content.trim() === '' ? { lineIndex: 0, start: 0, end: 0 } : null
    );
    const dragStartLineRef = useRef<number | null>(null);
    const didDragSelectRef = useRef<boolean>(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Reset mouse drag state on window mouseup
    useEffect(() => {
      const handleGlobalMouseUp = () => {
        dragStartLineRef.current = null;
      };
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }, []);

    // When switching files, if the new file is empty, activate line 0 at col 0
    useEffect(() => {
      setSelectedLineRange(null);
      setSelectionAnchorLine(null);
      if (file.content.trim() === '') {
        setActiveLineIndex(0);
        pendingCursorRange.current = { start: 0, end: 0 };
        lastCursorPos.current = { lineIndex: 0, start: 0, end: 0 };
      } else {
        setActiveLineIndex(null);
        lastCursorPos.current = null;
      }
    }, [file.id]);

    // Expose toolbar formatting at the current cursor position or multi-line selection
    useImperativeHandle(
      ref,
      () => ({
        applyFormatAction: (actionType: string) => {
          // If multiple lines are selected, apply formatting across the selected range
          if (selectedLineRange !== null) {
            const res = applyToolbarFormatToLineRange(
              file.content,
              actionType,
              selectedLineRange.startLine,
              selectedLineRange.endLine
            );
            onChange(res.content);
            setSelectedLineRange({
              startLine: res.newStartLine,
              endLine: res.newEndLine,
            });
            containerRef.current?.focus();
            return;
          }

          let cursor: CursorPosition;
          if (activeLineIndex !== null) {
            const lineLen = (lines[activeLineIndex] || '').length;
            const start =
              activeInputRef.current?.selectionStart ??
              lastCursorPos.current?.start ??
              lineLen;
            const end =
              activeInputRef.current?.selectionEnd ??
              lastCursorPos.current?.end ??
              start;
            cursor = { lineIndex: activeLineIndex, start, end };
          } else if (lastCursorPos.current !== null) {
            cursor = lastCursorPos.current;
          } else {
            const { frontmatterLineCount } = parseFrontmatter(file.content);
            const defaultLine = Math.min(
              Math.max(0, lines.length - 1),
              frontmatterLineCount
            );
            cursor = { lineIndex: defaultLine, start: 0, end: 0 };
          }

          const result = applyToolbarFormatAtCursor(
            file.content,
            actionType,
            cursor
          );
          pendingCursorRange.current = result.nextSelection;
          if (result.nextActiveLineIndex !== null && result.nextSelection) {
            lastCursorPos.current = {
              lineIndex: result.nextActiveLineIndex,
              start: result.nextSelection.start,
              end: result.nextSelection.end,
            };
          }
          onChange(result.content);
          setActiveLineIndex(result.nextActiveLineIndex);
        },
      }),
      [activeLineIndex, selectedLineRange, file.content, lines, onChange]
    );

    // Apply focus and cursor position whenever activeLineIndex or lines change
    useEffect(() => {
      if (selectedLineRange !== null) {
        return;
      }
      if (activeLineIndex !== null && activeInputRef.current) {
        const input = activeInputRef.current;
        const activeEl = document.activeElement;
        const isWidgetControlFocused =
          activeEl &&
          activeEl !== input &&
          (activeEl.tagName === 'INPUT' ||
            activeEl.tagName === 'SELECT' ||
            activeEl.tagName === 'TEXTAREA');

        if (activeEl !== input && !isWidgetControlFocused) {
          input.focus();
        }
        if (pendingCursorRange.current && !isWidgetControlFocused) {
          const { start, end } = pendingCursorRange.current;
          const maxLen = input.value.length;
          input.setSelectionRange(
            Math.min(maxLen, Math.max(0, start)),
            Math.min(maxLen, Math.max(0, end))
          );
          pendingCursorRange.current = null;
        }
      }
    }, [activeLineIndex, selectedLineRange, file.content]);

    // Autocomplete state
    const [autocomplete, setAutocomplete] = useState<{
      isOpen: boolean;
      trigger: '[[' | '/' | '{{' | '#' | null;
      query: string;
      position: { top: number; left: number };
      selectedIndex: number;
      triggerLineIndex: number;
    }>({
      isOpen: false,
      trigger: null,
      query: '',
      position: { top: 0, left: 0 },
      selectedIndex: 0,
      triggerLineIndex: -1,
    });

    // Mouse down on a line: start potential drag selection or Shift+Click range selection
    const handleLineMouseDown = (lineIdx: number, e: React.MouseEvent) => {
      if (e.button !== 0) return;

      if (e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        const anchor = selectionAnchorLine ?? activeLineIndex ?? lineIdx;
        setSelectionAnchorLine(anchor);
        setSelectedLineRange({
          startLine: Math.min(anchor, lineIdx),
          endLine: Math.max(anchor, lineIdx),
        });
        setActiveLineIndex(lineIdx);
        containerRef.current?.focus();
        return;
      }

      dragStartLineRef.current = lineIdx;
      didDragSelectRef.current = false;
    };

    // Mouse enter on a line while dragging: select range from drag start to hovered line
    const handleLineMouseEnter = (lineIdx: number, e: React.MouseEvent) => {
      if (
        e.buttons === 1 &&
        dragStartLineRef.current !== null &&
        dragStartLineRef.current !== lineIdx
      ) {
        didDragSelectRef.current = true;
        window.getSelection()?.removeAllRanges();
        const anchor = dragStartLineRef.current;
        setSelectionAnchorLine(anchor);
        setSelectedLineRange({
          startLine: Math.min(anchor, lineIdx),
          endLine: Math.max(anchor, lineIdx),
        });
        setActiveLineIndex(lineIdx);
        containerRef.current?.focus();
      }
    };

    // Activate a specific line (or extend range if Shift+Click / drag)
    const handleLineClick = (lineIdx: number, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();

      if (didDragSelectRef.current) {
        didDragSelectRef.current = false;
        return;
      }

      if (e?.shiftKey) {
        const anchor = selectionAnchorLine ?? activeLineIndex ?? lineIdx;
        setSelectionAnchorLine(anchor);
        setSelectedLineRange({
          startLine: Math.min(anchor, lineIdx),
          endLine: Math.max(anchor, lineIdx),
        });
        setActiveLineIndex(lineIdx);
        containerRef.current?.focus();
        return;
      }

      setSelectedLineRange(null);
      setSelectionAnchorLine(lineIdx);
      const targetLen = (lines[lineIdx] || '').length;
      pendingCursorRange.current = { start: targetLen, end: targetLen };
      lastCursorPos.current = {
        lineIndex: lineIdx,
        start: targetLen,
        end: targetLen,
      };
      setActiveLineIndex(lineIdx);
    };

    // Shared interaction props for any rendered line
    const getLineInteractionProps = (lineIdx: number) => ({
      'data-line-index': lineIdx,
      onMouseDown: (e: React.MouseEvent) => handleLineMouseDown(lineIdx, e),
      onMouseEnter: (e: React.MouseEvent) => handleLineMouseEnter(lineIdx, e),
      onClick: (e: React.MouseEvent) => handleLineClick(lineIdx, e),
    });

    // Clicking non-component space in the editor:
    // If the document is completely empty, activate line 0 at column 0;
    // otherwise deselect any active raw line or multi-line selection without jumping to the bottom.
    const handleContainerClick = () => {
      if (didDragSelectRef.current) {
        didDragSelectRef.current = false;
        return;
      }
      setSelectedLineRange(null);
      if (lines.length === 1 && lines[0] === '') {
        pendingCursorRange.current = { start: 0, end: 0 };
        lastCursorPos.current = { lineIndex: 0, start: 0, end: 0 };
        setActiveLineIndex(0);
      } else {
        pendingCursorRange.current = null;
        setActiveLineIndex(null);
        if (autocomplete.isOpen) {
          setAutocomplete((prev) => ({ ...prev, isOpen: false }));
        }
      }
    };

    // Multi-line action helpers
    const handleMultiIndent = (direction: 'indent' | 'outdent') => {
      if (!selectedLineRange) return;
      const updated = indentLineRange(
        file.content,
        selectedLineRange.startLine,
        selectedLineRange.endLine,
        direction
      );
      onChange(updated);
      containerRef.current?.focus();
    };

    const handleMultiMove = (direction: 'up' | 'down') => {
      if (!selectedLineRange) return;
      const { frontmatterLineCount } = parseFrontmatter(file.content);
      const moved = moveLineRange(
        file.content,
        selectedLineRange.startLine,
        selectedLineRange.endLine,
        direction,
        frontmatterLineCount
      );
      onChange(moved.content);
      setSelectedLineRange({
        startLine: moved.newStartLine,
        endLine: moved.newEndLine,
      });
      setActiveLineIndex(
        direction === 'up' ? moved.newStartLine : moved.newEndLine
      );
      containerRef.current?.focus();
    };

    const handleMultiDuplicate = () => {
      if (!selectedLineRange) return;
      const dup = duplicateLineRange(
        file.content,
        selectedLineRange.startLine,
        selectedLineRange.endLine
      );
      onChange(dup.content);
      setSelectedLineRange({
        startLine: dup.newStartLine,
        endLine: dup.newEndLine,
      });
      setActiveLineIndex(dup.newEndLine);
      containerRef.current?.focus();
    };

    const handleMultiDelete = (replacement = '') => {
      if (!selectedLineRange) return;
      const del = deleteLineRange(
        file.content,
        selectedLineRange.startLine,
        selectedLineRange.endLine,
        replacement
      );
      setSelectedLineRange(null);
      setSelectionAnchorLine(del.nextLineIndex);
      pendingCursorRange.current = { start: del.nextCol, end: del.nextCol };
      lastCursorPos.current = {
        lineIndex: del.nextLineIndex,
        start: del.nextCol,
        end: del.nextCol,
      };
      onChange(del.content);
      setActiveLineIndex(del.nextLineIndex);
    };

    const handleMultiCopy = () => {
      if (!selectedLineRange) return;
      const text = lines
        .slice(selectedLineRange.startLine, selectedLineRange.endLine + 1)
        .join('\n');
      navigator.clipboard?.writeText(text).catch(() => {});
      containerRef.current?.focus();
    };

    // Keyboard handler when multiple lines are selected
    const handleContainerKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!selectedLineRange) return;

      const { frontmatterLineCount } = parseFrontmatter(file.content);
      const minLine = frontmatterLineCount;

      // Escape: clear multi-line selection
      if (e.key === 'Escape') {
        e.preventDefault();
        setSelectedLineRange(null);
        return;
      }

      // Shift + ArrowUp / ArrowDown: expand or shrink multi-line selection
      if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && e.shiftKey) {
        e.preventDefault();
        const anchor =
          selectionAnchorLine ?? selectedLineRange.startLine;
        const currentHead = activeLineIndex ?? selectedLineRange.endLine;
        const nextHead =
          e.key === 'ArrowUp'
            ? Math.max(minLine, currentHead - 1)
            : Math.min(lines.length - 1, currentHead + 1);
        setSelectionAnchorLine(anchor);
        setSelectedLineRange({
          startLine: Math.min(anchor, nextHead),
          endLine: Math.max(anchor, nextHead),
        });
        setActiveLineIndex(nextHead);
        return;
      }

      // Alt + ArrowUp / ArrowDown: move selected lines up or down
      if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && e.altKey) {
        e.preventDefault();
        handleMultiMove(e.key === 'ArrowUp' ? 'up' : 'down');
        return;
      }

      // Plain ArrowUp / ArrowDown: collapse selection to start or end line
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const targetIdx =
          e.key === 'ArrowUp'
            ? selectedLineRange.startLine
            : selectedLineRange.endLine;
        setSelectedLineRange(null);
        setSelectionAnchorLine(targetIdx);
        const len = (lines[targetIdx] || '').length;
        pendingCursorRange.current = { start: len, end: len };
        setActiveLineIndex(targetIdx);
        return;
      }

      // Tab / Shift+Tab: indent or outdent all selected lines
      if (e.key === 'Tab') {
        e.preventDefault();
        handleMultiIndent(e.shiftKey ? 'outdent' : 'indent');
        return;
      }

      // Backspace / Delete: delete all selected lines
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        handleMultiDelete('');
        return;
      }

      // Ctrl/Cmd + D: duplicate selected lines
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleMultiDuplicate();
        return;
      }

      // Ctrl/Cmd + A: select all body lines
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setSelectionAnchorLine(minLine);
        setSelectedLineRange({
          startLine: minLine,
          endLine: Math.max(minLine, lines.length - 1),
        });
        return;
      }

      // Ctrl/Cmd + C: copy selected lines
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleMultiCopy();
        return;
      }

      // Ctrl/Cmd + X: cut selected lines
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') {
        e.preventDefault();
        handleMultiCopy();
        handleMultiDelete('');
        return;
      }

      // Enter: replace selected lines with empty line
      if (e.key === 'Enter') {
        e.preventDefault();
        handleMultiDelete('');
        return;
      }

      // Printable character: replace selected lines with typed character
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        handleMultiDelete(e.key);
      }
    };

    // Detect autocomplete triggers based on current line text and cursor column
    const checkAutocompleteTriggers = (
      lineIdx: number,
      lineText: string,
      cursorCol: number
    ) => {
      const textBeforeCursor = lineText.slice(0, cursorCol);
      const inputEl = activeInputRef.current;
      const rect = inputEl
        ? inputEl.getBoundingClientRect()
        : { top: 120, left: 300, height: 24 };

      const approxTop = rect.top + rect.height + 4;
      const approxLeft = rect.left + Math.min(400, cursorCol * 8);

      // 1. `[[` Wiki-link trigger
      const wikiMatch = textBeforeCursor.match(/\[\[([^\]]*)$/);
      if (wikiMatch) {
        setAutocomplete({
          isOpen: true,
          trigger: '[[',
          query: wikiMatch[1],
          position: { top: approxTop, left: approxLeft },
          selectedIndex: 0,
          triggerLineIndex: lineIdx,
        });
        return;
      }

      // 2. `/` Slash command trigger (at start of line or after whitespace)
      const slashMatch = textBeforeCursor.match(/(?:^|\s)\/([a-zA-Z0-9_\-]*)$/);
      if (slashMatch) {
        setAutocomplete({
          isOpen: true,
          trigger: '/',
          query: slashMatch[1],
          position: { top: approxTop, left: approxLeft },
          selectedIndex: 0,
          triggerLineIndex: lineIdx,
        });
        return;
      }

      // 3. `{{` Dynamic variable trigger
      const varMatch = textBeforeCursor.match(/\{\{([a-zA-Z0-9_]*)$/);
      if (varMatch) {
        setAutocomplete({
          isOpen: true,
          trigger: '{{',
          query: varMatch[1],
          position: { top: approxTop, left: approxLeft },
          selectedIndex: 0,
          triggerLineIndex: lineIdx,
        });
        return;
      }

      // 4. `#` Tag trigger (not a heading)
      const tagMatch = textBeforeCursor.match(/(?:^|\s)#([a-zA-Z0-9_\-\/]+)$/);
      if (tagMatch && !/^\s*#{1,6}\s/.test(lineText)) {
        setAutocomplete({
          isOpen: true,
          trigger: '#',
          query: tagMatch[1],
          position: { top: approxTop, left: approxLeft },
          selectedIndex: 0,
          triggerLineIndex: lineIdx,
        });
        return;
      }

      if (autocomplete.isOpen) {
        setAutocomplete((prev) => ({ ...prev, isOpen: false }));
      }
    };

    // Update a single line's text (or multi-line paste)
    const handleLineChange = (
      lineIdx: number,
      newValue: string,
      cursorCol: number
    ) => {
      const nextLines = [...lines];

      if (newValue.includes('\n')) {
        const splitNew = newValue.split('\n');
        nextLines.splice(lineIdx, 1, ...splitNew);
        const nextActive = lineIdx + splitNew.length - 1;
        const lastLen = splitNew[splitNew.length - 1].length;
        pendingCursorRange.current = { start: lastLen, end: lastLen };
        onChange(nextLines.join('\n'));
        setActiveLineIndex(nextActive);
        return;
      }

      nextLines[lineIdx] = newValue;
      pendingCursorRange.current = { start: cursorCol, end: cursorCol };
      lastCursorPos.current = {
        lineIndex: lineIdx,
        start: cursorCol,
        end: cursorCol,
      };
      onChange(nextLines.join('\n'));
      checkAutocompleteTriggers(lineIdx, newValue, cursorCol);
    };

    // Keydown handler on the active single-line input
    const handleLineKeyDown = (
      lineIdx: number,
      e: React.KeyboardEvent<HTMLInputElement>
    ) => {
      const input = e.currentTarget;
      const selStart = input.selectionStart ?? 0;
      const selEnd = input.selectionEnd ?? 0;
      const currentLineText = lines[lineIdx] || '';
      const { frontmatterLineCount } = parseFrontmatter(file.content);
      const minLine = frontmatterLineCount;

      // 0. Multi-line selection via Shift + ArrowUp / Shift + ArrowDown
      if (
        (e.key === 'ArrowUp' || e.key === 'ArrowDown') &&
        e.shiftKey &&
        !autocomplete.isOpen
      ) {
        e.preventDefault();
        e.stopPropagation();
        const anchor = selectionAnchorLine ?? lineIdx;
        const nextHead =
          e.key === 'ArrowUp'
            ? Math.max(minLine, lineIdx - 1)
            : Math.min(lines.length - 1, lineIdx + 1);
        setSelectionAnchorLine(anchor);
        setSelectedLineRange({
          startLine: Math.min(anchor, nextHead),
          endLine: Math.max(anchor, nextHead),
        });
        setActiveLineIndex(nextHead);
        containerRef.current?.focus();
        return;
      }

      // Move current line up/down via Alt + ArrowUp / Alt + ArrowDown
      if (
        (e.key === 'ArrowUp' || e.key === 'ArrowDown') &&
        e.altKey &&
        !autocomplete.isOpen
      ) {
        e.preventDefault();
        e.stopPropagation();
        const moved = moveLineRange(
          file.content,
          lineIdx,
          lineIdx,
          e.key === 'ArrowUp' ? 'up' : 'down',
          minLine
        );
        pendingCursorRange.current = { start: selStart, end: selEnd };
        onChange(moved.content);
        setActiveLineIndex(moved.newStartLine);
        return;
      }

      // Ctrl/Cmd + A when entire line is already selected (or empty): select all document body lines
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === 'a' &&
        selStart === 0 &&
        selEnd === currentLineText.length &&
        lines.length > minLine + 1
      ) {
        e.preventDefault();
        e.stopPropagation();
        setSelectionAnchorLine(minLine);
        setSelectedLineRange({
          startLine: minLine,
          endLine: lines.length - 1,
        });
        containerRef.current?.focus();
        return;
      }

      // 1. Autocomplete navigation
      if (autocomplete.isOpen) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setAutocomplete((prev) => ({
            ...prev,
            selectedIndex: prev.selectedIndex + 1,
          }));
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setAutocomplete((prev) => ({
            ...prev,
            selectedIndex: Math.max(0, prev.selectedIndex - 1),
          }));
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          setAutocomplete((prev) => ({ ...prev, isOpen: false }));
          return;
        }
      }

      // 2. Smart Selection Wrapping (*, _, `, [, (, {, ", ~)
      if (
        selStart !== selEnd &&
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        const selected = currentLineText.slice(selStart, selEnd);
        const wrapResult = handleSmartWrapping(selected, e.key);
        if (wrapResult.handled) {
          e.preventDefault();
          const nextLine =
            currentLineText.slice(0, selStart) +
            wrapResult.wrapped +
            currentLineText.slice(selEnd);
          const nextLines = [...lines];
          nextLines[lineIdx] = nextLine;
          const openTokenLen = (wrapResult.wrapped.length - selected.length) / 2;
          pendingCursorRange.current = {
            start: selStart + openTokenLen,
            end: selStart + wrapResult.wrapped.length - openTokenLen,
          };
          onChange(nextLines.join('\n'));
          return;
        }
      }

      // 3. Smart Indentation on Tab / Shift+Tab (moves cursor forward/backward)
      if (e.key === 'Tab') {
        e.preventDefault();
        const nextLines = [...lines];

        if (!e.shiftKey) {
          const isListLine = /^(\s*)([-*+]|\d+\.)\s/.test(currentLineText);
          if (isListLine) {
            const modifiedLine = handleSmartIndent(currentLineText, 'indent');
            nextLines[lineIdx] = modifiedLine;
            pendingCursorRange.current = {
              start: selStart + 2,
              end: selEnd + 2,
            };
          } else {
            const indentStr = '  ';
            const modifiedLine =
              currentLineText.slice(0, selStart) +
              indentStr +
              currentLineText.slice(selEnd);
            nextLines[lineIdx] = modifiedLine;
            pendingCursorRange.current = {
              start: selStart + indentStr.length,
              end: selStart + indentStr.length,
            };
          }
        } else {
          const modifiedLine = handleSmartIndent(currentLineText, 'outdent');
          const removedCount = currentLineText.length - modifiedLine.length;
          nextLines[lineIdx] = modifiedLine;
          pendingCursorRange.current = {
            start: Math.max(0, selStart - removedCount),
            end: Math.max(0, selEnd - removedCount),
          };
        }

        onChange(nextLines.join('\n'));
        return;
      }

      // 4. Smart Enter continuation & line splitting
      if (e.key === 'Enter' && !autocomplete.isOpen) {
        e.preventDefault();
        const continuation = getSmartEnterContinuation(
          currentLineText,
          selStart
        );

        if (continuation.shouldBreakOut) {
          const nextLines = [...lines];
          const cleaned = continuation.cleanCurrentLine || '';
          nextLines[lineIdx] = cleaned;
          pendingCursorRange.current = {
            start: cleaned.length,
            end: cleaned.length,
          };
          onChange(nextLines.join('\n'));
          return;
        }

        let prefix = continuation.continuationPrefix;
        if (!prefix) {
          const leadingMatch = currentLineText
            .slice(0, selStart)
            .match(/^(\s+)/);
          if (leadingMatch) {
            prefix = leadingMatch[1];
          }
        }

        const beforeCursor = currentLineText.slice(0, selStart);
        const afterCursor = currentLineText.slice(selEnd);
        const nextLines = [...lines];
        nextLines[lineIdx] = beforeCursor;
        nextLines.splice(lineIdx + 1, 0, prefix + afterCursor);

        pendingCursorRange.current = {
          start: prefix.length,
          end: prefix.length,
        };
        onChange(nextLines.join('\n'));
        setSelectionAnchorLine(lineIdx + 1);
        setActiveLineIndex(lineIdx + 1);
        return;
      }

      // 5. Backspace at column 0 merges with previous line
      if (e.key === 'Backspace' && selStart === 0 && selEnd === 0) {
        if (lineIdx > minLine) {
          e.preventDefault();
          const prevLine = lines[lineIdx - 1];
          const mergedLine = prevLine + currentLineText;
          const nextLines = [...lines];
          nextLines.splice(lineIdx - 1, 2, mergedLine);
          pendingCursorRange.current = {
            start: prevLine.length,
            end: prevLine.length,
          };
          onChange(nextLines.join('\n'));
          setSelectionAnchorLine(lineIdx - 1);
          setActiveLineIndex(lineIdx - 1);
        }
        return;
      }

      // 6. Delete at end of line merges next line into current line
      if (
        e.key === 'Delete' &&
        selStart === currentLineText.length &&
        selEnd === currentLineText.length
      ) {
        if (lineIdx < lines.length - 1) {
          e.preventDefault();
          const nextLine = lines[lineIdx + 1];
          const mergedLine = currentLineText + nextLine;
          const nextLines = [...lines];
          nextLines.splice(lineIdx, 2, mergedLine);
          pendingCursorRange.current = {
            start: selStart,
            end: selStart,
          };
          onChange(nextLines.join('\n'));
        }
        return;
      }

      // 7. Up/Down arrow navigation between lines
      if (e.key === 'ArrowUp' && !autocomplete.isOpen && lineIdx > minLine) {
        e.preventDefault();
        const targetLen = lines[lineIdx - 1].length;
        const col = Math.min(targetLen, selStart);
        pendingCursorRange.current = { start: col, end: col };
        setSelectionAnchorLine(lineIdx - 1);
        setActiveLineIndex(lineIdx - 1);
        return;
      }

      if (
        e.key === 'ArrowDown' &&
        !autocomplete.isOpen &&
        lineIdx < lines.length - 1
      ) {
        e.preventDefault();
        const targetLen = lines[lineIdx + 1].length;
        const col = Math.min(targetLen, selStart);
        pendingCursorRange.current = { start: col, end: col };
        setSelectionAnchorLine(lineIdx + 1);
        setActiveLineIndex(lineIdx + 1);
        return;
      }
    };

    // Handle Autocomplete Selection
    const handleAutocompleteSelect = (option: AutocompleteOption) => {
      const currentLineIdx =
        autocomplete.triggerLineIndex >= 0
          ? autocomplete.triggerLineIndex
          : activeLineIndex ?? 0;
      const currentLine = lines[currentLineIdx] || '';

      let newLine = currentLine;

      if (autocomplete.trigger === '[[') {
        const idx = currentLine.lastIndexOf('[[');
        if (idx !== -1) {
          newLine = currentLine.slice(0, idx + 2) + option.insertText;
        }
      } else if (autocomplete.trigger === '/') {
        const idx = currentLine.lastIndexOf('/');
        if (idx !== -1) {
          newLine = currentLine.slice(0, idx) + option.insertText;
        }
      } else if (autocomplete.trigger === '{{') {
        const idx = currentLine.lastIndexOf('{{');
        if (idx !== -1) {
          newLine = currentLine.slice(0, idx + 2) + option.insertText;
        }
      } else if (autocomplete.trigger === '#') {
        const idx = currentLine.lastIndexOf('#');
        if (idx !== -1) {
          newLine = currentLine.slice(0, idx + 1) + option.insertText;
        }
      }

      const nextLines = [...lines];
      if (newLine.includes('\n')) {
        const splitInserted = newLine.split('\n');
        nextLines.splice(currentLineIdx, 1, ...splitInserted);
        const targetIdx = currentLineIdx + splitInserted.length - 1;
        const lastLen = splitInserted[splitInserted.length - 1].length;
        pendingCursorRange.current = { start: lastLen, end: lastLen };
        onChange(nextLines.join('\n'));
        setActiveLineIndex(targetIdx);
      } else {
        nextLines[currentLineIdx] = newLine;
        pendingCursorRange.current = {
          start: newLine.length,
          end: newLine.length,
        };
        onChange(nextLines.join('\n'));
        setActiveLineIndex(currentLineIdx);
      }

      setAutocomplete((prev) => ({ ...prev, isOpen: false }));

      if (option.isCreateNew) {
        onNavigateFile(option.label.replace(/^Create note: "([^"]+)"$/, '$1'));
      }
    };

    // Toggle task checkbox directly in markdown
    const handleToggleTask = (lineIdx: number) => {
      const targetLine = lines[lineIdx];
      let toggled = targetLine;
      if (targetLine.includes('- [ ]')) {
        toggled = targetLine.replace('- [ ]', '- [x]');
      } else if (targetLine.includes('- [x]')) {
        toggled = targetLine.replace('- [x]', '- [ ]');
      }
      const nextLines = [...lines];
      nextLines[lineIdx] = toggled;
      onChange(nextLines.join('\n'));
    };

    // Toggle folding for a heading
    const toggleFoldHeading = (lineIdx: number) => {
      setCollapsedHeadings((prev) => {
        const next = new Set(prev);
        if (next.has(lineIdx)) next.delete(lineIdx);
        else next.add(lineIdx);
        return next;
      });
    };

    // Check if a line or range is part of the current multi-line selection
    const isLineSelected = (lineIdx: number) =>
      selectedLineRange !== null &&
      lineIdx >= selectedLineRange.startLine &&
      lineIdx <= selectedLineRange.endLine;

    const isBlockOverlappingSelection = (startIdx: number, endIdx: number) =>
      selectedLineRange !== null &&
      startIdx <= selectedLineRange.endLine &&
      endIdx >= selectedLineRange.startLine;

    // Render a block of markdown lines
    const renderDocumentBlocks = () => {
      const renderedElements: React.ReactNode[] = [];
      let i = 0;

      // Check if line 0 is frontmatter
      const { hasFrontmatter, frontmatterLineCount } = parseFrontmatter(
        file.content
      );
      if (hasFrontmatter) {
        renderedElements.push(
          <FrontmatterWidget
            key="frontmatter"
            content={file.content}
            onInteract={() => {
              pendingCursorRange.current = null;
              setSelectedLineRange(null);
              setActiveLineIndex(null);
            }}
            onChange={(updatedContent) => {
              pendingCursorRange.current = null;
              setSelectedLineRange(null);
              setActiveLineIndex(null);
              onChange(updatedContent);
            }}
          />
        );
        i = frontmatterLineCount;
      }

      while (i < lines.length) {
        const line = lines[i];
        const isCursorOnLine =
          activeLineIndex === i && selectedLineRange === null;

        // 1. Check for Code Block: ```lang ... ```
        if (line.trim().startsWith('```')) {
          const lang = line.trim().slice(3).trim();
          const codeLines: string[] = [];
          const startLineIdx = i;
          i++;
          while (i < lines.length && !lines[i].trim().startsWith('```')) {
            codeLines.push(lines[i]);
            i++;
          }
          const endLineIdx = Math.min(lines.length - 1, i);
          const isCursorInCodeBlock =
            (activeLineIndex !== null &&
              activeLineIndex >= startLineIdx &&
              activeLineIndex <= endLineIdx) ||
            isBlockOverlappingSelection(startLineIdx, endLineIdx);

          if (isCursorInCodeBlock) {
            for (let li = startLineIdx; li <= endLineIdx; li++) {
              renderedElements.push(renderRawEditableLine(li));
            }
          } else {
            renderedElements.push(
              <div
                key={`code-${startLineIdx}`}
                {...getLineInteractionProps(startLineIdx)}
                className="cursor-pointer"
              >
                <CodeBlockWidget language={lang} code={codeLines.join('\n')} />
              </div>
            );
          }
          i = endLineIdx + 1;
          continue;
        }

        // 2. Check for Pipe Table: | Col | Col |
        if (line.trim().startsWith('|') && line.includes('|')) {
          const tableLines: string[] = [];
          const startLineIdx = i;
          while (i < lines.length && lines[i].trim().startsWith('|')) {
            tableLines.push(lines[i]);
            i++;
          }
          const endLineIdx = i - 1;
          const isCursorInTable =
            (activeLineIndex !== null &&
              activeLineIndex >= startLineIdx &&
              activeLineIndex <= endLineIdx) ||
            isBlockOverlappingSelection(startLineIdx, endLineIdx);

          if (isCursorInTable) {
            for (let li = startLineIdx; li <= endLineIdx; li++) {
              renderedElements.push(renderRawEditableLine(li));
            }
          } else {
            renderedElements.push(
              <div
                key={`table-${startLineIdx}`}
                onMouseEnter={(e) => {
                  if (
                    e.buttons === 1 &&
                    dragStartLineRef.current !== null &&
                    dragStartLineRef.current !== startLineIdx
                  ) {
                    didDragSelectRef.current = true;
                    window.getSelection()?.removeAllRanges();
                    const anchor = dragStartLineRef.current;
                    setSelectionAnchorLine(anchor);
                    setSelectedLineRange({
                      startLine: Math.min(anchor, startLineIdx),
                      endLine: Math.max(anchor, endLineIdx),
                    });
                    setActiveLineIndex(endLineIdx);
                    containerRef.current?.focus();
                  }
                }}
              >
                <TableWidget
                  markdownTable={tableLines}
                  onInteract={() => {
                    pendingCursorRange.current = null;
                    setSelectedLineRange(null);
                    setActiveLineIndex(null);
                  }}
                  onEditSyntax={() => {
                    setSelectedLineRange(null);
                    setSelectionAnchorLine(startLineIdx);
                    const len = (lines[startLineIdx] || '').length;
                    pendingCursorRange.current = { start: len, end: len };
                    lastCursorPos.current = {
                      lineIndex: startLineIdx,
                      start: len,
                      end: len,
                    };
                    setActiveLineIndex(startLineIdx);
                  }}
                  onSelectSyntax={() => {
                    setSelectionAnchorLine(startLineIdx);
                    setSelectedLineRange({
                      startLine: startLineIdx,
                      endLine: endLineIdx,
                    });
                    setActiveLineIndex(endLineIdx);
                    containerRef.current?.focus();
                  }}
                  onChange={(newTableMd) => {
                    pendingCursorRange.current = null;
                    setSelectedLineRange(null);
                    setActiveLineIndex(null);
                    const newTableLines = newTableMd.split('\n');
                    const nextLines = [...lines];
                    nextLines.splice(
                      startLineIdx,
                      tableLines.length,
                      ...newTableLines
                    );
                    onChange(nextLines.join('\n'));
                  }}
                />
              </div>
            );
          }
          continue;
        }

        // 3. Check for Callout Admonition: > [!type] Title
        const calloutHeader = parseCalloutHeader(line);
        if (calloutHeader) {
          const calloutLines: string[] = [];
          const startLineIdx = i;
          i++;
          while (
            i < lines.length &&
            lines[i].trim().startsWith('>') &&
            !parseCalloutHeader(lines[i])
          ) {
            calloutLines.push(lines[i].replace(/^>\s?/, ''));
            i++;
          }
          const endLineIdx = i - 1;
          const isCursorInCallout =
            (activeLineIndex !== null &&
              activeLineIndex >= startLineIdx &&
              activeLineIndex <= endLineIdx) ||
            isBlockOverlappingSelection(startLineIdx, endLineIdx);

          if (isCursorInCallout) {
            for (let li = startLineIdx; li <= endLineIdx; li++) {
              renderedElements.push(renderRawEditableLine(li));
            }
          } else {
            renderedElements.push(
              <div
                key={`callout-${startLineIdx}`}
                {...getLineInteractionProps(startLineIdx)}
                className="cursor-pointer"
              >
                <CalloutWidget
                  type={calloutHeader.type}
                  title={calloutHeader.title}
                  isFoldable={calloutHeader.foldable}
                  defaultFolded={calloutHeader.defaultFolded}
                >
                  <div className="space-y-1.5">
                    {calloutLines.map((cL, cIdx) => (
                      <div key={cIdx}>
                        <FormattedInlineText
                          text={cL}
                          files={files}
                          currentFile={file}
                          onWikiLinkClick={onNavigateFile}
                          onWikiLinkHover={onHoverWikiLink}
                          onWikiLinkLeave={onLeaveWikiLink}
                          onTagClick={onTagClick}
                        />
                      </div>
                    ))}
                  </div>
                </CalloutWidget>
              </div>
            );
          }
          continue;
        }

        // 4. Check for Transclusion Embed: ![[Target]] or ![[Target#Heading]]
        const embedMatch = line.trim().match(/^!\[\[(.*?)\]\]$/);
        if (embedMatch && !isCursorOnLine && !isLineSelected(i)) {
          let target = embedMatch[1];
          let subpath: string | undefined = undefined;
          if (target.includes('#')) {
            const parts = target.split('#');
            target = parts[0].trim();
            subpath = parts[1].trim();
          }
          renderedElements.push(
            <div
              key={`embed-${i}`}
              {...getLineInteractionProps(i)}
              className="cursor-pointer"
            >
              <TransclusionEmbed
                rawEmbed={line.trim()}
                target={target}
                subpath={subpath}
                files={files}
                onNavigate={onNavigateFile}
              />
            </div>
          );
          i++;
          continue;
        }

        // 4.5. Check for HTML Image Tag: <img src="https://example.com" alt="A cute kitten" width="300"/>
        const htmlImgMatch = parseHtmlImageTag(line);
        if (htmlImgMatch && !isCursorOnLine && !isLineSelected(i)) {
          const imgLineIdx = i;
          renderedElements.push(
            <div key={`img-${imgLineIdx}`} {...getLineInteractionProps(imgLineIdx)}>
              <ImageWidget
                src={htmlImgMatch.src}
                alt={htmlImgMatch.alt}
                width={htmlImgMatch.width}
                indentSpaces={htmlImgMatch.indentSpaces}
                onUpdateSrc={(newSrc) => {
                  const updatedLine = formatHtmlImageTag(
                    newSrc,
                    htmlImgMatch.alt,
                    htmlImgMatch.width,
                    htmlImgMatch.indentSpaces
                  );
                  const nextLines = [...lines];
                  nextLines[imgLineIdx] = updatedLine;
                  pendingCursorRange.current = null;
                  setSelectedLineRange(null);
                  setActiveLineIndex(null);
                  onChange(nextLines.join('\n'));
                }}
                onEditSyntax={() => handleLineClick(imgLineIdx)}
              />
            </div>
          );
          i++;
          continue;
        }

        // 5. Standard line rendering (Live Preview Hybrid or Multi-Line Selected)
        if (isCursorOnLine || isLineSelected(i)) {
          renderedElements.push(renderRawEditableLine(i));
        } else {
          renderedElements.push(renderFormattedLine(i));
        }

        i++;
      }

      return renderedElements;
    };

    // Render line in Raw Markdown format (for active line editing OR multi-line selection)
    const renderRawEditableLine = (lineIdx: number) => {
      const lineText = lines[lineIdx] ?? '';
      const isMultiSelected = isLineSelected(lineIdx);
      const isFocusedSingleLine =
        selectedLineRange === null && activeLineIndex === lineIdx;

      return (
        <div
          key={`raw-${lineIdx}`}
          {...getLineInteractionProps(lineIdx)}
          className={`flex items-center w-full min-h-[26px] px-2.5 py-0.5 font-code text-sm transition-colors text-white ${
            isMultiSelected
              ? 'bg-purple-600/25 border-l-2 border-purple-400 select-none'
              : 'bg-purple-950/20 rounded border border-purple-500/40'
          }`}
        >
          <span className="select-none text-purple-400 text-xs font-mono min-w-[24px] pr-2 text-left shrink-0 tabular-nums">
            {lineIdx + 1}
          </span>
          {isFocusedSingleLine ? (
            <input
              ref={activeInputRef}
              type="text"
              value={lineText}
              onChange={(e) =>
                handleLineChange(
                  lineIdx,
                  e.target.value,
                  e.target.selectionStart ?? e.target.value.length
                )
              }
              onKeyDown={(e) => handleLineKeyDown(lineIdx, e)}
              onSelect={(e) => {
                const target = e.currentTarget;
                lastCursorPos.current = {
                  lineIndex: lineIdx,
                  start: target.selectionStart ?? 0,
                  end: target.selectionEnd ?? 0,
                };
              }}
              onClick={(e) => e.stopPropagation()}
              spellCheck={false}
              aria-label={`Line ${lineIdx + 1} editor`}
              placeholder={
                lines.length === 1 && lineText === ''
                  ? 'Start typing at column 0 (press Tab to indent, [[ for links, / for commands)...'
                  : ''
              }
              className="flex-1 w-full bg-transparent font-mono text-sm text-purple-100 placeholder:text-[#555555] focus:outline-none caret-purple-400"
            />
          ) : (
            <span className="flex-1 whitespace-pre font-mono text-purple-100 text-left">
              {lineText || '\u00A0'}
            </span>
          )}
        </div>
      );
    };

    // Render line in collapsed formatted representation (Live Preview)
    const renderFormattedLine = (lineIdx: number) => {
      const lineText = lines[lineIdx];

      // Check for empty line
      if (!lineText.trim()) {
        return (
          <div
            key={`formatted-${lineIdx}`}
            {...getLineInteractionProps(lineIdx)}
            className="w-full h-6 hover:bg-white/5 rounded cursor-text"
          />
        );
      }

      // Heading # (supports optional leading indentation if user explicitly indents)
      const headingMatch = lineText.match(/^(\s*)(#{1,6})\s+(.*)$/);
      if (headingMatch) {
        const indentSpaces = headingMatch[1].length;
        const level = headingMatch[2].length;
        const headingContent = headingMatch[3];
        const isCollapsed = collapsedHeadings.has(lineIdx);

        const sizeClasses =
          {
            1: 'text-2xl font-bold text-white border-b border-[#333333] pb-1.5 mt-5 mb-2',
            2: 'text-xl font-semibold text-white mt-4 mb-2',
            3: 'text-lg font-semibold text-[#f0f0f0] mt-3 mb-1.5',
            4: 'text-base font-semibold text-[#e0e0e0] mt-2.5 mb-1',
            5: 'text-sm font-semibold text-[#cccccc] mt-2 mb-1',
            6: 'text-xs font-semibold text-[#aaaaaa] mt-2 mb-1',
          }[level] || 'text-base';

        return (
          <div
            key={`formatted-${lineIdx}`}
            {...getLineInteractionProps(lineIdx)}
            style={
              indentSpaces > 0
                ? { paddingLeft: `${indentSpaces * 12}px` }
                : undefined
            }
            className={`group/heading relative flex items-center justify-between cursor-pointer hover:bg-white/5 rounded transition-colors ${sizeClasses}`}
          >
            <div className="flex-1 min-w-0">
              <FormattedInlineText
                text={headingContent}
                files={files}
                currentFile={file}
                onWikiLinkClick={onNavigateFile}
                onWikiLinkHover={onHoverWikiLink}
                onWikiLinkLeave={onLeaveWikiLink}
                onTagClick={onTagClick}
              />
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleFoldHeading(lineIdx);
              }}
              title="Fold section"
              className="opacity-0 group-hover/heading:opacity-100 text-[#777777] hover:text-white transition-opacity p-0.5 rounded shrink-0 ml-2"
            >
              {isCollapsed ? (
                <ChevronRight size={14} />
              ) : (
                <ChevronDown size={14} />
              )}
            </button>
          </div>
        );
      }

      // Task list item: - [ ] or - [x]
      const taskMatch = lineText.match(/^(\s*)([-*])\s+\[([ xX])\]\s*(.*)$/);
      if (taskMatch) {
        const indentSpaces = taskMatch[1].length;
        const isChecked = taskMatch[3].toLowerCase() === 'x';
        const taskBody = taskMatch[4];

        return (
          <div
            key={`formatted-${lineIdx}`}
            {...getLineInteractionProps(lineIdx)}
            style={
              indentSpaces > 0
                ? { paddingLeft: `${indentSpaces * 12}px` }
                : undefined
            }
            className="flex items-start gap-2.5 py-0.5 hover:bg-white/5 rounded cursor-pointer transition-colors"
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleTask(lineIdx);
              }}
              className={`mt-1 w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                isChecked
                  ? 'bg-purple-600 border-purple-500 text-white'
                  : 'border-[#555555] bg-[#222222] hover:border-purple-400'
              }`}
            >
              {isChecked && <Check size={11} strokeWidth={3} />}
            </button>
            <div
              className={`flex-1 text-sm ${
                isChecked ? 'line-through text-[#777777]' : 'text-[#dddddd]'
              }`}
            >
              <FormattedInlineText
                text={taskBody}
                files={files}
                currentFile={file}
                onWikiLinkClick={onNavigateFile}
                onWikiLinkHover={onHoverWikiLink}
                onWikiLinkLeave={onLeaveWikiLink}
                onTagClick={onTagClick}
              />
            </div>
          </div>
        );
      }

      // Bullet list item: - or *
      const bulletMatch = lineText.match(/^(\s*)([-*+])\s+(.*)$/);
      if (bulletMatch) {
        const indentSpaces = bulletMatch[1].length;
        const bulletBody = bulletMatch[3];
        return (
          <div
            key={`formatted-${lineIdx}`}
            {...getLineInteractionProps(lineIdx)}
            style={
              indentSpaces > 0
                ? { paddingLeft: `${indentSpaces * 12}px` }
                : undefined
            }
            className="flex items-start gap-2 py-0.5 hover:bg-white/5 rounded cursor-pointer transition-colors"
          >
            <span className="text-purple-400 font-bold select-none mt-0.5">
              •
            </span>
            <div className="flex-1 text-sm text-[#dddddd]">
              <FormattedInlineText
                text={bulletBody}
                files={files}
                currentFile={file}
                onWikiLinkClick={onNavigateFile}
                onWikiLinkHover={onHoverWikiLink}
                onWikiLinkLeave={onLeaveWikiLink}
                onTagClick={onTagClick}
              />
            </div>
          </div>
        );
      }

      // Numbered list item: 1.
      const numMatch = lineText.match(/^(\s*)(\d+)\.\s+(.*)$/);
      if (numMatch) {
        const indentSpaces = numMatch[1].length;
        const num = numMatch[2];
        const numBody = numMatch[3];
        return (
          <div
            key={`formatted-${lineIdx}`}
            {...getLineInteractionProps(lineIdx)}
            style={
              indentSpaces > 0
                ? { paddingLeft: `${indentSpaces * 12}px` }
                : undefined
            }
            className="flex items-start gap-2 py-0.5 hover:bg-white/5 rounded cursor-pointer transition-colors"
          >
            <span className="text-[#888888] font-mono text-xs select-none mt-0.5 text-left shrink-0 tabular-nums">
              {num}.
            </span>
            <div className="flex-1 text-sm text-[#dddddd]">
              <FormattedInlineText
                text={numBody}
                files={files}
                currentFile={file}
                onWikiLinkClick={onNavigateFile}
                onWikiLinkHover={onHoverWikiLink}
                onWikiLinkLeave={onLeaveWikiLink}
                onTagClick={onTagClick}
              />
            </div>
          </div>
        );
      }

      // Blockquote >
      if (lineText.startsWith('>')) {
        return (
          <div
            key={`formatted-${lineIdx}`}
            {...getLineInteractionProps(lineIdx)}
            className="border border-purple-500/30 bg-purple-950/10 px-3 py-1 my-1 italic text-[#b5b5b5] hover:bg-white/5 rounded cursor-pointer transition-colors text-sm"
          >
            <FormattedInlineText
              text={lineText.replace(/^>\s?/, '')}
              files={files}
              currentFile={file}
              onWikiLinkClick={onNavigateFile}
              onWikiLinkHover={onHoverWikiLink}
              onWikiLinkLeave={onLeaveWikiLink}
              onTagClick={onTagClick}
            />
          </div>
        );
      }

      // Standard paragraph line (preserves leading Tab/space indentation)
      return (
        <div
          key={`formatted-${lineIdx}`}
          {...getLineInteractionProps(lineIdx)}
          className="w-full py-0.5 leading-relaxed text-sm text-[#d4d4d4] hover:bg-white/5 rounded cursor-pointer transition-colors min-h-[24px] whitespace-pre-wrap"
        >
          <FormattedInlineText
            text={lineText}
            files={files}
            currentFile={file}
            onWikiLinkClick={onNavigateFile}
            onWikiLinkHover={onHoverWikiLink}
            onWikiLinkLeave={onLeaveWikiLink}
            onTagClick={onTagClick}
          />
        </div>
      );
    };

    const selectedCount = selectedLineRange
      ? selectedLineRange.endLine - selectedLineRange.startLine + 1
      : 0;

    return (
      <div
        ref={containerRef}
        tabIndex={0}
        onClick={handleContainerClick}
        onKeyDown={handleContainerKeyDown}
        onPaste={(e) => {
          if (selectedLineRange) {
            e.preventDefault();
            const pasted = e.clipboardData.getData('text/plain');
            handleMultiDelete(pasted);
          }
        }}
        className="relative flex-1 w-full h-full overflow-y-auto px-6 py-6 focus:outline-none cursor-text"
      >
        {/* Contextual Multi-Line Selection Action Bar */}
        {selectedLineRange && (
          <div
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className="sticky top-0 z-20 mb-3 flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-[#252031]/95 border border-purple-500/40 shadow-lg backdrop-blur-sm text-xs"
          >
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-purple-600 text-white font-semibold tabular-nums">
                {selectedCount} {selectedCount === 1 ? 'line' : 'lines'} selected
              </span>
              <span className="text-purple-300/80 font-mono text-[11px]">
                Lines {selectedLineRange.startLine + 1}–{selectedLineRange.endLine + 1}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleMultiMove('up')}
                title="Move Lines Up (Alt+Up)"
                className="flex items-center gap-1 px-2 py-1 rounded bg-[#1e1e1e] hover:bg-purple-900/50 text-[#cccccc] hover:text-white border border-[#3a3a3a] transition-colors"
              >
                <ArrowUp size={12} /> Up
              </button>
              <button
                type="button"
                onClick={() => handleMultiMove('down')}
                title="Move Lines Down (Alt+Down)"
                className="flex items-center gap-1 px-2 py-1 rounded bg-[#1e1e1e] hover:bg-purple-900/50 text-[#cccccc] hover:text-white border border-[#3a3a3a] transition-colors"
              >
                <ArrowDown size={12} /> Down
              </button>
              <button
                type="button"
                onClick={() => handleMultiIndent('indent')}
                title="Indent Selected Lines (Tab)"
                className="flex items-center gap-1 px-2 py-1 rounded bg-[#1e1e1e] hover:bg-purple-900/50 text-[#cccccc] hover:text-white border border-[#3a3a3a] transition-colors"
              >
                <Indent size={12} /> Indent
              </button>
              <button
                type="button"
                onClick={() => handleMultiIndent('outdent')}
                title="Outdent Selected Lines (Shift+Tab)"
                className="flex items-center gap-1 px-2 py-1 rounded bg-[#1e1e1e] hover:bg-purple-900/50 text-[#cccccc] hover:text-white border border-[#3a3a3a] transition-colors"
              >
                <Outdent size={12} /> Outdent
              </button>
              <button
                type="button"
                onClick={handleMultiDuplicate}
                title="Duplicate Selected Lines (Ctrl+D)"
                className="flex items-center gap-1 px-2 py-1 rounded bg-[#1e1e1e] hover:bg-purple-900/50 text-[#cccccc] hover:text-white border border-[#3a3a3a] transition-colors"
              >
                <CopyPlus size={12} /> Duplicate
              </button>
              <button
                type="button"
                onClick={handleMultiCopy}
                title="Copy Selected Lines (Ctrl+C)"
                className="flex items-center gap-1 px-2 py-1 rounded bg-[#1e1e1e] hover:bg-purple-900/50 text-[#cccccc] hover:text-white border border-[#3a3a3a] transition-colors"
              >
                <Copy size={12} /> Copy
              </button>
              <button
                type="button"
                onClick={() => handleMultiDelete('')}
                title="Delete Selected Lines (Backspace / Delete)"
                className="flex items-center gap-1 px-2 py-1 rounded bg-red-950/60 hover:bg-red-900/80 text-red-300 hover:text-white border border-red-800/50 transition-colors"
              >
                <Trash2 size={12} /> Delete
              </button>
              <button
                type="button"
                onClick={() => setSelectedLineRange(null)}
                title="Clear Selection (Esc)"
                className="p-1 rounded text-[#999999] hover:text-white hover:bg-[#333333] transition-colors ml-1"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Rendered Live Preview Document Tree - Full Width Left Aligned */}
        <div className="w-full space-y-0.5 pb-24">{renderDocumentBlocks()}</div>

        {/* Autocomplete Popover for Wiki-links, Slash Commands, Variables, and Tags */}
        <AutocompletePopover
          isOpen={autocomplete.isOpen}
          trigger={autocomplete.trigger}
          query={autocomplete.query}
          files={files}
          allTags={allTags}
          currentFile={file}
          position={autocomplete.position}
          selectedIndex={autocomplete.selectedIndex}
          onSelect={handleAutocompleteSelect}
          onClose={() => setAutocomplete((prev) => ({ ...prev, isOpen: false }))}
        />
      </div>
    );
  }
);
