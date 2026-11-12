import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Loader2, Sparkles } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks.ts';
import { openEditorTab, selectEditorActiveTab } from '@/app/slices/editorTabsSlice.ts';
import { useDocumentContent, useDocumentation } from '@/pages/editor/hooks/useDocumentation.ts';
import {
  computeDocumentDiff,
  dispatchDocumentToolbarState,
  DocumentationServices,
  documentTreeQueryKey,
  onDocumentToolbarAction,
} from '@/pages/editor/services/documentation.ts';
import { flattenTreeToFiles } from '@/pages/editor/utils/fileTree.ts';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import type { FileItem } from './obsidian/types.ts';
import { extractTags, getFormatHotkey, toggleInlineFormat } from './obsidian/markdownUtils.ts';
import {
  LivePreviewEditor,
  type LivePreviewEditorHandle,
} from './obsidian/LivePreviewEditor.tsx';
import { HoverPreview, type HoverAnchorRect } from './obsidian/HoverPreview.tsx';
import { parseWikiLinkInner, resolveLinkTarget } from './obsidian/linkResolver.ts';
import type { AxiosError } from 'axios';
import type { Response as ApiResponse } from '@/types/response.ts';

const BRACKET_PAIRS: Record<string, string> = {
  '`': '`',
  '[': ']',
  '{': '}',
  '(': ')',
  "'": "'",
  '"': '"',
  '<': '>',
  '*': '*',
  '~': '~',
  $: '$',
};

const DocumentEditor: React.FC = () => {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const activeTab = useAppSelector(selectEditorActiveTab);
  const documentId = activeTab?.type === 'document' ? activeTab.id : '';

  const documentQuery = useDocumentContent(documentId);
  const { documentTree } = useDocumentation(null, true);
  const projectFiles = useMemo(() => flattenTreeToFiles(documentTree), [documentTree]);

  const [markdown, setMarkdown] = useState('');
  const [sourceMode, setSourceMode] = useState(false);
  const [fileContentsCache, setFileContentsCache] = useState<Record<string, string>>({});

  // Hover preview state
  const [hoverPreview, setHoverPreview] = useState<{
    targetTitle: string;
    position: { x: number; y: number };
    anchorRect: HoverAnchorRect;
  } | null>(null);
  const hoverCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightContentRef = useRef<Set<string>>(new Set());

  const editorRef = useRef<LivePreviewEditorHandle | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const lastSentMarkdownRef = useRef('');
  const loadedDocIdRef = useRef('');
  const loadedVersionRef = useRef('');
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Undo / Redo history stacks
  const historyRef = useRef<string[]>(['']);
  const historyIndexRef = useRef<number>(0);

  const syncToolbarState = useCallback(
    (override?: Partial<{ sourceMode: boolean }>) => {
      dispatchDocumentToolbarState({
        sourceMode: override?.sourceMode ?? sourceMode,
        canUndo: historyIndexRef.current > 0,
        canRedo: historyIndexRef.current < historyRef.current.length - 1,
        headingLevel: 0,
      });
    },
    [sourceMode]
  );

  const scheduleSocketSync = useCallback(
    (nextMarkdown: string) => {
      if (!documentId) return;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        const prev = lastSentMarkdownRef.current;
        if (prev === nextMarkdown) return;
        const diff = computeDocumentDiff(prev, nextMarkdown);
        DocumentationServices.emitContentEdit({
          id: documentId,
          content: diff.content,
          startPos: diff.startPos,
          lenght: diff.lenght,
        });
        lastSentMarkdownRef.current = nextMarkdown;
      }, 500);
    },
    [documentId]
  );

  const pushHistoryAndSync = useCallback(
    (nextMarkdown: string) => {
      setMarkdown(nextMarkdown);
      setFileContentsCache((prev) => ({ ...prev, [documentId]: nextMarkdown }));

      if (historyRef.current[historyIndexRef.current] !== nextMarkdown) {
        const nextStack = historyRef.current.slice(0, historyIndexRef.current + 1);
        nextStack.push(nextMarkdown);
        if (nextStack.length > 100) nextStack.shift();
        historyRef.current = nextStack;
        historyIndexRef.current = nextStack.length - 1;
      }
      syncToolbarState();
      scheduleSocketSync(nextMarkdown);
    },
    [documentId, scheduleSocketSync, syncToolbarState]
  );

  const handleUndo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    const prevContent = historyRef.current[historyIndexRef.current];
    setMarkdown(prevContent);
    syncToolbarState();
    scheduleSocketSync(prevContent);
  }, [scheduleSocketSync, syncToolbarState]);

  const handleRedo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    const nextContent = historyRef.current[historyIndexRef.current];
    setMarkdown(nextContent);
    syncToolbarState();
    scheduleSocketSync(nextContent);
  }, [scheduleSocketSync, syncToolbarState]);

  // Initialize or refresh content when documentQuery data arrives
  useEffect(() => {
    if (!documentQuery.data) return;
    const { id, content, version } = documentQuery.data;
    const isNewDoc = loadedDocIdRef.current !== id;
    const isExternalRefresh =
      loadedVersionRef.current !== version && content !== lastSentMarkdownRef.current;

    if (isNewDoc || isExternalRefresh) {
      loadedDocIdRef.current = id;
      loadedVersionRef.current = version;
      lastSentMarkdownRef.current = content;
      setMarkdown(content);
      setFileContentsCache((prev) => ({ ...prev, [id]: content }));
      historyRef.current = [content];
      historyIndexRef.current = 0;
      syncToolbarState();
    }
  }, [documentQuery.data, syncToolbarState]);

  // Listen to socket `document:refresh`
  useEffect(() => {
    if (!documentId) return;
    return DocumentationServices.onDocumentRefresh((shouldRefresh) => {
      if (shouldRefresh) {
        void documentQuery.refetch();
      }
    });
  }, [documentId, documentQuery]);

  // Clean up timers on unmount and clear hover preview when switching documents
  useEffect(() => {
    setHoverPreview(null);
  }, [documentId]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (hoverCloseTimerRef.current) {
        clearTimeout(hoverCloseTimerRef.current);
      }
    };
  }, []);

  // Format helper for Source mode textarea
  const handleSourceModeFormat = useCallback(
    (action: string) => {
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const selected = markdown.slice(start, end);

      const wrapWith = (prefix: string, suffix: string, defaultText: string) => {
        const inner = selected || defaultText;
        const next = markdown.slice(0, start) + prefix + inner + suffix + markdown.slice(end);
        pushHistoryAndSync(next);
        setTimeout(() => {
          ta.focus();
          ta.setSelectionRange(start + prefix.length, start + prefix.length + inner.length);
        }, 0);
      };

      if (
        action === 'bold' ||
        action === 'italic' ||
        action === 'strike' ||
        action === 'code'
      ) {
        const res = toggleInlineFormat(markdown, start, end, action);
        pushHistoryAndSync(res.text);
        setTimeout(() => {
          ta.focus();
          ta.setSelectionRange(res.selStart, res.selEnd);
        }, 0);
        return;
      }

      if (action === 'link') wrapWith('[[', ']]', 'Document');
      else if (action === 'h1') wrapWith('# ', '', 'Heading 1');
      else if (action === 'h2') wrapWith('## ', '', 'Heading 2');
      else if (action === 'h3') wrapWith('### ', '', 'Heading 3');
      else if (action === 'bullet') wrapWith('- ', '', 'Bullet item');
      else if (action === 'number') wrapWith('1. ', '', 'Numbered item');
      else if (action === 'task') wrapWith('- [ ] ', '', 'Task item');
      else if (action === 'quote') wrapWith('> ', '', 'Quote text');
      else if (action === 'callout')
        wrapWith('> [!tip] Tip\n> ', '', 'Practical advice');
      else if (action === 'table')
        wrapWith(
          '| Column 1 | Column 2 |\n| :--- | :--- |\n| Value 1 | Value 2 |\n',
          '',
          ''
        );
      else if (action === 'image')
        wrapWith(
          '<img src="https://example.com" alt="Image" width="300"/>\n',
          '',
          ''
        );
      else if (action === 'embed') wrapWith('![[', ']]', 'Document');
    },
    [markdown, pushHistoryAndSync]
  );

  // Listen to toolbar actions from DocumentEditorHeader
  useEffect(() => {
    return onDocumentToolbarAction((action) => {
      if (action.type === 'undo') {
        handleUndo();
      } else if (action.type === 'redo') {
        handleRedo();
      } else if (action.type === 'toggle-source') {
        setSourceMode((prev) => {
          const next = !prev;
          syncToolbarState({ sourceMode: next });
          return next;
        });
      } else if (action.type === 'format') {
        if (!sourceMode) {
          editorRef.current?.applyFormatAction(action.action);
        } else {
          // Source mode textarea format
          handleSourceModeFormat(action.action);
        }
      } else if (action.type === 'bold') {
        if (!sourceMode) editorRef.current?.applyFormatAction('bold');
        else handleSourceModeFormat('bold');
      } else if (action.type === 'italic') {
        if (!sourceMode) editorRef.current?.applyFormatAction('italic');
        else handleSourceModeFormat('italic');
      } else if (action.type === 'strikethrough') {
        if (!sourceMode) editorRef.current?.applyFormatAction('strike');
        else handleSourceModeFormat('strike');
      } else if (action.type === 'code') {
        if (!sourceMode) editorRef.current?.applyFormatAction('code');
        else handleSourceModeFormat('code');
      } else if (action.type === 'heading') {
        const level = action.level;
        const act = level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3';
        if (!sourceMode) editorRef.current?.applyFormatAction(act);
        else handleSourceModeFormat(act);
      } else if (action.type === 'list') {
        const act = action.kind === 'ol' ? 'number' : action.kind === 'task' ? 'task' : 'bullet';
        if (!sourceMode) editorRef.current?.applyFormatAction(act);
        else handleSourceModeFormat(act);
      } else if (action.type === 'link') {
        if (!sourceMode) editorRef.current?.applyFormatAction('link');
        else handleSourceModeFormat('link');
      } else if (action.type === 'image') {
        if (!sourceMode) editorRef.current?.applyFormatAction('image');
        else handleSourceModeFormat('image');
      } else if (action.type === 'table') {
        if (!sourceMode) editorRef.current?.applyFormatAction('table');
        else handleSourceModeFormat('table');
      }
    });
  }, [handleRedo, handleSourceModeFormat, handleUndo, sourceMode, syncToolbarState]);

  // Convert project files into Obsidian FileItems for links, embeds, and autocomplete
  const files: FileItem[] = useMemo(() => {
    return projectFiles.map((file) => {
      const title = file.name.replace(/\.md$/i, '');
      const cachedContent =
        fileContentsCache[file.id] ?? (file.id === documentId ? markdown : '');
      const normalizedId = file.id.replace(/\\/g, '/');
      const folder = normalizedId.includes('/')
        ? normalizedId.substring(0, normalizedId.lastIndexOf('/'))
        : '';
      return {
        id: file.id,
        path: file.path,
        title,
        folder,
        content: cachedContent,
        updatedAt: Date.now(),
      };
    });
  }, [projectFiles, fileContentsCache, documentId, markdown]);

  // Active file item
  const currentActiveFile: FileItem = useMemo(() => {
    const normalizedId = documentId.replace(/\\/g, '/');
    const folder = normalizedId.includes('/')
      ? normalizedId.substring(0, normalizedId.lastIndexOf('/'))
      : '';
    return {
      id: documentId,
      path: documentQuery.data?.path || `${documentQuery.data?.name || 'document'}.md`,
      title: (documentQuery.data?.name || activeTab?.label || 'Document').replace(/\.md$/i, ''),
      folder,
      content: markdown,
      updatedAt: Date.now(),
    };
  }, [documentId, documentQuery.data, activeTab?.label, markdown]);

  // Extract all unique tags across workspace
  const allTags = useMemo(() => {
    return Array.from(new Set(files.flatMap((f) => extractTags(f.content))));
  }, [files]);

  const clearHoverCloseTimer = useCallback(() => {
    if (hoverCloseTimerRef.current) {
      clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
  }, []);

  const handleCloseHoverPreview = useCallback(() => {
    clearHoverCloseTimer();
    setHoverPreview(null);
  }, [clearHoverCloseTimer]);

  const preloadFileContent = useCallback(
    (fileId: string) => {
      if (fileContentsCache[fileId] !== undefined || inFlightContentRef.current.has(fileId)) {
        return;
      }
      inFlightContentRef.current.add(fileId);
      void DocumentationServices.getContent(fileId)
        .then((doc) => {
          if (doc && typeof doc.content === 'string') {
            setFileContentsCache((prev) => ({ ...prev, [fileId]: doc.content }));
          }
        })
        .catch(() => {
          // Ignore preload failure; explicit open handles errors
        })
        .finally(() => {
          inFlightContentRef.current.delete(fileId);
        });
    },
    [fileContentsCache]
  );

  // Wiki-link navigation & lazy file creation
  const handleNavigateFile = useCallback(
    async (target: string) => {
      handleCloseHoverPreview();
      const cleanTarget = target.trim();
      if (!cleanTarget) return;

      const existing = resolveLinkTarget(files, cleanTarget);

      if (existing) {
        dispatch(
          openEditorTab({
            id: existing.id,
            label: existing.title,
            method: 'DOC',
            type: 'document',
          })
        );
      } else {
        // Create document on demand in the project workspace (backend supports folder paths)
        try {
          toast.loading(`Creating note "${cleanTarget}"...`, { id: 'create-note' });
          const docName = cleanTarget.toLowerCase().endsWith('.md')
            ? cleanTarget
            : `${cleanTarget}.md`;
          const created = await DocumentationServices.createDocument(docName);
          if (created && typeof created.content === 'string') {
            setFileContentsCache((prev) => ({ ...prev, [created.id]: created.content }));
          }
          await queryClient.invalidateQueries({ queryKey: documentTreeQueryKey });
          toast.success(`Note "${cleanTarget}" created`, { id: 'create-note' });
          dispatch(
            openEditorTab({
              id: created.id,
              label: created.name || cleanTarget,
              method: 'DOC',
              type: 'document',
            })
          );
        } catch (err) {
          const axiosErr = err as AxiosError<ApiResponse<unknown>>;
          const message =
            axiosErr?.response?.data?.message ||
            (err instanceof Error ? err.message : `Failed to create note "${cleanTarget}"`);
          toast.error(message, { id: 'create-note' });
        }
      }
    },
    [dispatch, files, handleCloseHoverPreview, queryClient]
  );

  // Wiki-link hover: ensure target content is loaded in cache for preview
  const handleHoverWikiLink = useCallback(
    (targetTitle: string, e: React.MouseEvent) => {
      clearHoverCloseTimer();
      const cleanTarget = targetTitle.trim();
      const rect = e.currentTarget.getBoundingClientRect();
      const anchorRect: HoverAnchorRect = {
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
      };
      const position = { x: e.clientX, y: e.clientY };

      setHoverPreview((prev) => {
        if (
          prev &&
          prev.targetTitle === cleanTarget &&
          Math.abs(prev.anchorRect.top - anchorRect.top) < 2 &&
          Math.abs(prev.anchorRect.left - anchorRect.left) < 2
        ) {
          return prev;
        }
        return {
          targetTitle: cleanTarget,
          position,
          anchorRect,
        };
      });

      const matched = resolveLinkTarget(files, cleanTarget);
      if (matched) {
        preloadFileContent(matched.id);
      }
    },
    [clearHoverCloseTimer, files, preloadFileContent]
  );

  const handleLeaveWikiLink = useCallback(() => {
    clearHoverCloseTimer();
    hoverCloseTimerRef.current = setTimeout(() => {
      setHoverPreview(null);
      hoverCloseTimerRef.current = null;
    }, 150);
  }, [clearHoverCloseTimer]);

  // Pre-load content for transclusion embeds ![[...]]
  useEffect(() => {
    const embedRegex = /!\[\[(.*?)\]\]/g;
    let match;
    while ((match = embedRegex.exec(markdown)) !== null) {
      const { target } = parseWikiLinkInner(match[1]);
      if (!target) continue;
      const matched = resolveLinkTarget(files, target);
      if (matched) {
        preloadFileContent(matched.id);
      }
    }
  }, [markdown, files, preloadFileContent]);

  if (documentQuery.isLoading) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center gap-2 p-8 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-purple-600 dark:text-purple-400" />
        <span className="text-xs font-medium">Loading document...</span>
      </div>
    );
  }

  if (documentQuery.isError) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 p-8 text-muted-foreground">
        <FileText className="h-8 w-8 text-muted-foreground/50" />
        <span className="text-sm font-medium text-foreground">Failed to load document</span>
        <span className="text-xs text-muted-foreground">
          {documentQuery.error instanceof Error
            ? documentQuery.error.message
            : 'The document could not be found or read.'}
        </span>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-260px)] flex-col font-sans">
      {/* Subheader info bar */}
      <div className="flex items-center justify-between border-b border-border px-6 py-2.5 bg-muted/20">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-sky-600" />
          <h2 className="text-sm font-semibold text-foreground">
            {documentQuery.data?.name || activeTab?.label || 'Markdown Editor'}
          </h2>
          <span className="rounded bg-sky-100 dark:bg-sky-950/60 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 dark:text-sky-300">
            {documentId}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
          <span>
            {sourceMode
              ? 'Raw Markdown Source Mode'
              : 'Cursor-Aware Live Preview (Click any line to edit raw syntax)'}
          </span>
        </div>
      </div>

      {/* Editor Body */}
      {sourceMode ? (
        <div className="flex flex-1 flex-col p-6">
          <textarea
            ref={textareaRef}
            value={markdown}
            onChange={(e) => pushHistoryAndSync(e.target.value)}
            onKeyDown={(e) => {
              // Hotkeys for inline formatting: Ctrl+B (bold), Ctrl+I (italic), Ctrl+T (strikethrough)
              const hotkeyAction = getFormatHotkey(e);
              if (hotkeyAction) {
                e.preventDefault();
                handleSourceModeFormat(hotkeyAction);
                return;
              }

              // Bracket auto-pairing on selection
              if (BRACKET_PAIRS[e.key] && !e.ctrlKey && !e.metaKey && !e.altKey) {
                const ta = e.currentTarget;
                const start = ta.selectionStart;
                const end = ta.selectionEnd;
                if (start !== end) {
                  e.preventDefault();
                  const selected = markdown.slice(start, end);
                  const closeChar = BRACKET_PAIRS[e.key];
                  const next =
                    markdown.slice(0, start) +
                    e.key +
                    selected +
                    closeChar +
                    markdown.slice(end);
                  pushHistoryAndSync(next);
                  setTimeout(() => {
                    ta.setSelectionRange(start + 1, end + 1);
                  }, 0);
                  return;
                }
              }
              // Tab indentation
              if (e.key === 'Tab') {
                e.preventDefault();
                const ta = e.currentTarget;
                const start = ta.selectionStart;
                const end = ta.selectionEnd;
                if (!e.shiftKey) {
                  const next = markdown.slice(0, start) + '  ' + markdown.slice(end);
                  pushHistoryAndSync(next);
                  setTimeout(() => {
                    ta.setSelectionRange(start + 2, start + 2);
                  }, 0);
                } else {
                  const lineStart = markdown.lastIndexOf('\n', start - 1) + 1;
                  if (markdown.slice(lineStart, lineStart + 2) === '  ') {
                    const next =
                      markdown.slice(0, lineStart) + markdown.slice(lineStart + 2);
                    pushHistoryAndSync(next);
                    setTimeout(() => {
                      ta.setSelectionRange(
                        Math.max(lineStart, start - 2),
                        Math.max(lineStart, end - 2)
                      );
                    }, 0);
                  }
                }
              }
            }}
            placeholder="Type raw Markdown content here..."
            className="min-h-[520px] w-full flex-1 resize-y rounded-xl border border-border bg-background p-5 font-mono text-xs leading-relaxed text-foreground focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </div>
      ) : (
        <div className="flex-1 min-h-[520px] flex flex-col">
          <LivePreviewEditor
            ref={editorRef}
            file={currentActiveFile}
            files={files}
            allTags={allTags}
            onChange={(newContent) => pushHistoryAndSync(newContent)}
            onNavigateFile={handleNavigateFile}
            onHoverWikiLink={handleHoverWikiLink}
            onLeaveWikiLink={handleLeaveWikiLink}
            onTagClick={(tag) => {
              toast.info(`Tag: #${tag}`);
            }}
          />
        </div>
      )}

      {/* Floating Hover Preview Card */}
      {hoverPreview && (
        <HoverPreview
          file={resolveLinkTarget(files, hoverPreview.targetTitle) || null}
          targetTitle={hoverPreview.targetTitle}
          position={hoverPreview.position}
          anchorRect={hoverPreview.anchorRect}
          onNavigate={handleNavigateFile}
          onClose={handleCloseHoverPreview}
          onMouseEnter={clearHoverCloseTimer}
          onMouseLeave={handleLeaveWikiLink}
        />
      )}
    </div>
  );
};

export default DocumentEditor;
