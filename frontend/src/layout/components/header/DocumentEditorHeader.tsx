import React, { useEffect, useState } from 'react';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Table as TableIcon,
  Image as ImageIcon,
  Link as LinkIcon,
  Layers,
  Heading1,
  Heading2,
  Heading3,
  Undo2,
  Redo2,
  Sparkles,
  Code2,
  FileText,
} from 'lucide-react';
import { useAppSelector } from '@/app/store/hooks.ts';
import { selectEditorActiveTab } from '@/app/slices/editorTabsSlice.ts';
import {
  dispatchDocumentToolbarAction,
  type DocumentToolbarState,
  onDocumentToolbarState,
} from '@/pages/editor/services/documentation.ts';
import { cn } from '@/lib/utils.ts';

const preventBlur = (e: React.MouseEvent) => {
  e.preventDefault();
};

const DocumentEditorHeader: React.FC = () => {
  const activeTab = useAppSelector(selectEditorActiveTab);
  const [toolbarState, setToolbarState] = useState<DocumentToolbarState>({
    sourceMode: false,
    canUndo: false,
    canRedo: false,
    headingLevel: 0,
  });

  useEffect(() => {
    return onDocumentToolbarState((nextState) => {
      setToolbarState(nextState);
    });
  }, []);

  const handleFormatAction = (actionType: string) => {
    dispatchDocumentToolbarAction({ type: 'format', action: actionType });
  };

  return (
    <div
      onMouseDown={preventBlur}
      className="flex w-full items-center justify-between gap-3 text-xs select-none"
    >
      {/* Formatting & History Actions */}
      <div className="flex items-center gap-1 overflow-x-auto py-0.5">
        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5 pr-1 border-r border-border">
          <button
            type="button"
            onMouseDown={preventBlur}
            onClick={() => dispatchDocumentToolbarAction({ type: 'undo' })}
            disabled={!toolbarState.canUndo}
            title="Undo (Ctrl+Z)"
            className={cn(
              'p-1.5 rounded transition-colors flex items-center justify-center',
              toolbarState.canUndo
                ? 'text-foreground hover:bg-muted'
                : 'text-muted-foreground/40 cursor-not-allowed'
            )}
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={preventBlur}
            onClick={() => dispatchDocumentToolbarAction({ type: 'redo' })}
            disabled={!toolbarState.canRedo}
            title="Redo (Ctrl+Y)"
            className={cn(
              'p-1.5 rounded transition-colors flex items-center justify-center',
              toolbarState.canRedo
                ? 'text-foreground hover:bg-muted'
                : 'text-muted-foreground/40 cursor-not-allowed'
            )}
          >
            <Redo2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Source Mode Toggle */}
        <div className="flex items-center px-1 border-r border-border">
          <button
            type="button"
            onMouseDown={preventBlur}
            onClick={() => dispatchDocumentToolbarAction({ type: 'toggle-source' })}
            title={toolbarState.sourceMode ? 'Switch to Live Preview' : 'View Raw Markdown Source'}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded font-medium text-xs transition-colors',
              toolbarState.sourceMode
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            <Code2 className="h-3.5 w-3.5" />
            <span>Source</span>
          </button>
        </div>

        {/* Headings */}
        <div className="flex items-center gap-0.5 px-1 border-r border-border">
          <button
            type="button"
            onMouseDown={preventBlur}
            onClick={() => handleFormatAction('h1')}
            title="Heading 1 (# Heading)"
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Heading1 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={preventBlur}
            onClick={() => handleFormatAction('h2')}
            title="Heading 2 (## Heading)"
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Heading2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={preventBlur}
            onClick={() => handleFormatAction('h3')}
            title="Heading 3 (### Heading)"
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Heading3 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Basic typography styling */}
        <div className="flex items-center gap-0.5 px-1 border-r border-border">
          <button
            type="button"
            onMouseDown={preventBlur}
            onClick={() => handleFormatAction('bold')}
            title="Bold (Ctrl+B / **text**)"
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Bold className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={preventBlur}
            onClick={() => handleFormatAction('italic')}
            title="Italic (Ctrl+I / *text*)"
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Italic className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={preventBlur}
            onClick={() => handleFormatAction('strike')}
            title="Strikethrough (Ctrl+T / ~~text~~)"
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Strikethrough className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={preventBlur}
            onClick={() => handleFormatAction('code')}
            title="Inline Code (`code`)"
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Code className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Lists & Tasks */}
        <div className="flex items-center gap-0.5 px-1 border-r border-border">
          <button
            type="button"
            onMouseDown={preventBlur}
            onClick={() => handleFormatAction('bullet')}
            title="Bullet List (- item)"
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <List className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={preventBlur}
            onClick={() => handleFormatAction('number')}
            title="Numbered List (1. item)"
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ListOrdered className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={preventBlur}
            onClick={() => handleFormatAction('task')}
            title="Task List (- [ ] item)"
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <CheckSquare className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Blocks & Inserts */}
        <div className="flex items-center gap-0.5 px-1">
          <button
            type="button"
            onMouseDown={preventBlur}
            onClick={() => handleFormatAction('quote')}
            title="Blockquote (> quote)"
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Quote className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={preventBlur}
            onClick={() => handleFormatAction('callout')}
            title="Insert Callout (> [!tip])"
            className="p-1.5 rounded text-muted-foreground hover:text-purple-600 dark:hover:text-purple-400 hover:bg-muted transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={preventBlur}
            onClick={() => handleFormatAction('table')}
            title="Insert Table"
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <TableIcon className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={preventBlur}
            onClick={() => handleFormatAction('image')}
            title='Insert Image (<img src="..." alt="..." width="300"/>)'
            className="p-1.5 rounded text-muted-foreground hover:text-purple-600 dark:hover:text-purple-400 hover:bg-muted transition-colors"
          >
            <ImageIcon className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={preventBlur}
            onClick={() => handleFormatAction('link')}
            title="Insert Wiki-Link ([[Document]])"
            className="p-1.5 rounded text-muted-foreground hover:text-purple-600 dark:hover:text-purple-400 hover:bg-muted transition-colors"
          >
            <LinkIcon className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={preventBlur}
            onClick={() => handleFormatAction('embed')}
            title="Insert Transclusion Embed (![[Document]])"
            className="p-1.5 rounded text-muted-foreground hover:text-purple-600 dark:hover:text-purple-400 hover:bg-muted transition-colors"
          >
            <Layers className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Mode Indicator & Active Tab Info */}
      <div className="flex items-center gap-3 shrink-0">
        <span className="hidden md:inline-flex items-center rounded-full bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/40 px-2 py-0.5 text-[10px] font-medium text-purple-700 dark:text-purple-300">
          {toolbarState.sourceMode ? 'Raw Source Mode' : 'Live Preview Mode'}
        </span>
        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground shrink-0">
          <FileText className="h-3.5 w-3.5 text-sky-600" />
          <span className="max-w-[200px] truncate font-medium text-foreground">
            {activeTab?.label || 'Document'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default DocumentEditorHeader;
