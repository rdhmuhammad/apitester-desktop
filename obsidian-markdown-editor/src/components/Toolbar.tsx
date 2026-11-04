import React from 'react';
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
} from 'lucide-react';

interface ToolbarProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onFormatAction: (actionType: string) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onFormatAction,
}) => {
  return (
    <div
      onMouseDown={(e) => e.preventDefault()}
      className="flex items-center justify-between px-3 py-1.5 bg-[#202020] border-b border-[#2d2d2d] select-none text-xs gap-3"
    >
      {/* Formatting & History Actions */}
      <div className="flex items-center gap-1 overflow-x-auto py-0.5">
        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5 pr-1.5 border-r border-[#333333]">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className={`p-1.5 rounded transition-colors ${
              canUndo
                ? 'text-[#cccccc] hover:bg-[#303030] hover:text-white'
                : 'text-[#555555] cursor-not-allowed'
            }`}
          >
            <Undo2 size={14} />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
            className={`p-1.5 rounded transition-colors ${
              canRedo
                ? 'text-[#cccccc] hover:bg-[#303030] hover:text-white'
                : 'text-[#555555] cursor-not-allowed'
            }`}
          >
            <Redo2 size={14} />
          </button>
        </div>

        {/* Headings */}
        <div className="flex items-center gap-0.5 px-1 border-r border-[#333333]">
          <button
            type="button"
            onClick={() => onFormatAction('h1')}
            title="Heading 1"
            className="p-1.5 rounded text-[#aaaaaa] hover:text-white hover:bg-[#303030] transition-colors"
          >
            <Heading1 size={14} />
          </button>
          <button
            type="button"
            onClick={() => onFormatAction('h2')}
            title="Heading 2"
            className="p-1.5 rounded text-[#aaaaaa] hover:text-white hover:bg-[#303030] transition-colors"
          >
            <Heading2 size={14} />
          </button>
          <button
            type="button"
            onClick={() => onFormatAction('h3')}
            title="Heading 3"
            className="p-1.5 rounded text-[#aaaaaa] hover:text-white hover:bg-[#303030] transition-colors"
          >
            <Heading3 size={14} />
          </button>
        </div>

        {/* Basic typography styling */}
        <div className="flex items-center gap-0.5 px-1 border-r border-[#333333]">
          <button
            type="button"
            onClick={() => onFormatAction('bold')}
            title="Bold (**text**)"
            className="p-1.5 rounded text-[#aaaaaa] hover:text-white hover:bg-[#303030] transition-colors"
          >
            <Bold size={14} />
          </button>
          <button
            type="button"
            onClick={() => onFormatAction('italic')}
            title="Italic (*text*)"
            className="p-1.5 rounded text-[#aaaaaa] hover:text-white hover:bg-[#303030] transition-colors"
          >
            <Italic size={14} />
          </button>
          <button
            type="button"
            onClick={() => onFormatAction('strike')}
            title="Strikethrough (~~text~~)"
            className="p-1.5 rounded text-[#aaaaaa] hover:text-white hover:bg-[#303030] transition-colors"
          >
            <Strikethrough size={14} />
          </button>
          <button
            type="button"
            onClick={() => onFormatAction('code')}
            title="Inline Code (`code`)"
            className="p-1.5 rounded text-[#aaaaaa] hover:text-white hover:bg-[#303030] transition-colors"
          >
            <Code size={14} />
          </button>
        </div>

        {/* Lists & Tasks */}
        <div className="flex items-center gap-0.5 px-1 border-r border-[#333333]">
          <button
            type="button"
            onClick={() => onFormatAction('bullet')}
            title="Bullet List (- item)"
            className="p-1.5 rounded text-[#aaaaaa] hover:text-white hover:bg-[#303030] transition-colors"
          >
            <List size={14} />
          </button>
          <button
            type="button"
            onClick={() => onFormatAction('number')}
            title="Numbered List (1. item)"
            className="p-1.5 rounded text-[#aaaaaa] hover:text-white hover:bg-[#303030] transition-colors"
          >
            <ListOrdered size={14} />
          </button>
          <button
            type="button"
            onClick={() => onFormatAction('task')}
            title="Task List (- [ ] item)"
            className="p-1.5 rounded text-[#aaaaaa] hover:text-white hover:bg-[#303030] transition-colors"
          >
            <CheckSquare size={14} />
          </button>
        </div>

        {/* Blocks & Inserts */}
        <div className="flex items-center gap-0.5 px-1">
          <button
            type="button"
            onClick={() => onFormatAction('quote')}
            title="Blockquote (> quote)"
            className="p-1.5 rounded text-[#aaaaaa] hover:text-white hover:bg-[#303030] transition-colors"
          >
            <Quote size={14} />
          </button>
          <button
            type="button"
            onClick={() => onFormatAction('callout')}
            title="Insert Callout (> [!tip])"
            className="p-1.5 rounded text-[#aaaaaa] hover:text-purple-400 hover:bg-[#303030] transition-colors"
          >
            <Sparkles size={14} />
          </button>
          <button
            type="button"
            onClick={() => onFormatAction('table')}
            title="Insert Table"
            className="p-1.5 rounded text-[#aaaaaa] hover:text-white hover:bg-[#303030] transition-colors"
          >
            <TableIcon size={14} />
          </button>
          <button
            type="button"
            onClick={() => onFormatAction('image')}
            title='Insert Image (<img src="https://example.com" alt="A cute kitten" width="300"/>)'
            className="p-1.5 rounded text-[#aaaaaa] hover:text-purple-400 hover:bg-[#303030] transition-colors"
          >
            <ImageIcon size={14} />
          </button>
          <button
            type="button"
            onClick={() => onFormatAction('link')}
            title="Insert Wiki-Link ([[Document]])"
            className="p-1.5 rounded text-[#aaaaaa] hover:text-purple-400 hover:bg-[#303030] transition-colors"
          >
            <LinkIcon size={14} />
          </button>
          <button
            type="button"
            onClick={() => onFormatAction('embed')}
            title="Insert Transclusion Embed (![[Document]])"
            className="p-1.5 rounded text-[#aaaaaa] hover:text-purple-400 hover:bg-[#303030] transition-colors"
          >
            <Layers size={14} />
          </button>
        </div>
      </div>

      {/* Mode Indicator */}
      <div className="text-[11px] text-[#888888] shrink-0 hidden sm:block">
        Live Preview Mode
      </div>
    </div>
  );
};
