import React from 'react';
import type { FileItem } from './types.ts';
import { FileText, ArrowUpRight, Folder } from 'lucide-react';
import { parseFrontmatter } from './markdownUtils.ts';

interface HoverPreviewProps {
  file: FileItem | null;
  targetTitle: string;
  position: { x: number; y: number };
  onNavigate: (fileId: string) => void;
  onClose: () => void;
}

export const HoverPreview: React.FC<HoverPreviewProps> = ({
  file,
  targetTitle,
  position,
  onNavigate,
  onClose,
}) => {
  if (!targetTitle) return null;

  const top = Math.min(window.innerHeight - 280, position.y + 16);
  const left = Math.min(window.innerWidth - 380, Math.max(20, position.x - 40));

  if (!file) {
    return (
      <div
        style={{ top, left }}
        className="fixed z-50 w-80 p-3 rounded-lg border border-border bg-popover shadow-xl text-xs text-muted-foreground pointer-events-auto"
        onMouseLeave={onClose}
      >
        <div className="flex items-center gap-1.5 text-foreground font-semibold mb-1">
          <FileText size={14} className="text-purple-600 dark:text-purple-400" />
          <span>{targetTitle}</span>
        </div>
        <p className="text-[11px] text-muted-foreground/80 italic mb-2">
          Note not found in workspace.
        </p>
        <button
          onClick={() => onNavigate(targetTitle)}
          className="text-purple-600 dark:text-purple-400 hover:text-purple-500 font-medium text-xs flex items-center gap-1"
        >
          Click to create note <ArrowUpRight size={12} />
        </button>
      </div>
    );
  }

  const { frontmatter, body } = parseFrontmatter(file.content || '');
  // Grab clean first 240 chars of body
  const previewText = body.replace(/^[#>\-*\s]+/gm, '').trim().slice(0, 240);

  // Normalize tags: frontmatter.tags can be string[], string, or non-array at runtime
  const rawTags = frontmatter.tags as unknown;
  const tags: string[] = Array.isArray(rawTags)
    ? rawTags.map(String).filter(Boolean)
    : typeof rawTags === 'string'
    ? rawTags.split(',').map((t: string) => t.trim()).filter(Boolean)
    : [];

  return (
    <div
      style={{ top, left }}
      className="fixed z-50 w-96 max-h-72 overflow-hidden rounded-lg border border-border bg-popover shadow-xl text-xs text-popover-foreground pointer-events-auto flex flex-col"
      onMouseLeave={onClose}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/60 border-b border-border">
        <div className="flex items-center gap-2 truncate">
          <FileText size={14} className="text-purple-600 dark:text-purple-400 shrink-0" />
          <span className="font-semibold text-foreground truncate">{file.title}</span>
          {file.folder && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 truncate">
              <Folder size={10} /> {file.folder}
            </span>
          )}
        </div>
        <button
          onClick={() => {
            onNavigate(file.id);
            onClose();
          }}
          className="text-[11px] text-purple-600 dark:text-purple-400 hover:text-purple-500 flex items-center gap-0.5 shrink-0 hover:underline"
        >
          Open <ArrowUpRight size={12} />
        </button>
      </div>

      {/* Body preview */}
      <div className="p-3 overflow-y-auto space-y-2 text-[12px] leading-relaxed text-muted-foreground">
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1">
            {tags.map((t) => (
              <span key={t} className="text-[10px] text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/40 px-1 py-0.5 rounded">
                #{t.replace(/^#/, '')}
              </span>
            ))}
          </div>
        )}
        <p className="line-clamp-6">{previewText || 'Empty note content.'}</p>
      </div>
    </div>
  );
};
