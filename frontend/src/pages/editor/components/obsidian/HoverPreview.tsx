import React, { useLayoutEffect, useRef, useState } from 'react';
import type { FileItem } from './types.ts';
import { FileText, ArrowUpRight, Folder } from 'lucide-react';
import { parseFrontmatter } from './markdownUtils.ts';

export interface HoverAnchorRect {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

interface HoverPreviewProps {
  file: FileItem | null;
  targetTitle: string;
  position: { x: number; y: number };
  anchorRect?: HoverAnchorRect;
  onNavigate: (fileId: string) => void;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

interface PopoverLayout {
  top?: number;
  bottom?: number;
  left: number;
  maxHeight: number;
}

const VIEWPORT_MARGIN = 8;
const DEFAULT_MAX_HEIGHT = 288;

export const HoverPreview: React.FC<HoverPreviewProps> = ({
  file,
  targetTitle,
  position,
  anchorRect,
  onNavigate,
  onClose,
  onMouseEnter,
  onMouseLeave,
}) => {
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [layout, setLayout] = useState<PopoverLayout | null>(null);

  useLayoutEffect(() => {
    const el = popoverRef.current;
    if (!el || !targetTitle) return;

    const prevMaxHeight = el.style.maxHeight;
    el.style.maxHeight = `${DEFAULT_MAX_HEIGHT}px`;
    const rect = el.getBoundingClientRect();
    el.style.maxHeight = prevMaxHeight;

    const width = rect.width || (file ? 384 : 320);
    const height = Math.min(DEFAULT_MAX_HEIGHT, rect.height || (file ? 240 : 120));

    const anchorTop = anchorRect ? anchorRect.top : position.y;
    const anchorBottom = anchorRect ? anchorRect.bottom : position.y;
    const anchorLeft = anchorRect ? anchorRect.left : position.x - 40;

    const spaceBelow = window.innerHeight - anchorBottom - VIEWPORT_MARGIN;
    const spaceAbove = anchorTop - VIEWPORT_MARGIN;

    let top: number | undefined;
    let bottom: number | undefined;
    let maxHeight = DEFAULT_MAX_HEIGHT;

    if (spaceBelow >= height) {
      top = anchorBottom + VIEWPORT_MARGIN;
      maxHeight = Math.min(DEFAULT_MAX_HEIGHT, Math.max(80, spaceBelow));
    } else if (spaceAbove >= height) {
      // Anchor by CSS `bottom` so async content growth expands upward away from the link
      bottom = window.innerHeight - anchorTop + VIEWPORT_MARGIN;
      maxHeight = Math.min(DEFAULT_MAX_HEIGHT, Math.max(80, spaceAbove));
    } else if (spaceAbove > spaceBelow) {
      bottom = window.innerHeight - anchorTop + VIEWPORT_MARGIN;
      maxHeight = Math.max(80, spaceAbove);
    } else {
      top = anchorBottom + VIEWPORT_MARGIN;
      maxHeight = Math.max(80, spaceBelow);
    }

    const left = Math.max(
      VIEWPORT_MARGIN,
      Math.min(window.innerWidth - width - VIEWPORT_MARGIN, anchorLeft)
    );

    setLayout({ top, bottom, left, maxHeight });
  }, [
    targetTitle,
    file,
    file?.id,
    file?.content,
    position.x,
    position.y,
    anchorRect,
  ]);

  if (!targetTitle) return null;

  const style: React.CSSProperties = layout
    ? {
        top: layout.top,
        bottom: layout.bottom,
        left: layout.left,
        maxHeight: layout.maxHeight,
        visibility: 'visible',
      }
    : {
        top: (anchorRect?.bottom ?? position.y) + VIEWPORT_MARGIN,
        left: Math.max(VIEWPORT_MARGIN, (anchorRect?.left ?? position.x - 40)),
        maxHeight: DEFAULT_MAX_HEIGHT,
        visibility: 'hidden',
      };

  const handleLeave = onMouseLeave ?? onClose;

  if (!file) {
    return (
      <div
        ref={popoverRef}
        style={style}
        className="fixed z-50 w-80 p-3 rounded-lg border border-border bg-popover shadow-xl text-xs text-muted-foreground pointer-events-auto"
        onMouseEnter={onMouseEnter}
        onMouseLeave={handleLeave}
      >
        <div className="flex items-center gap-1.5 text-foreground font-semibold mb-1">
          <FileText size={14} className="text-purple-600 dark:text-purple-400" />
          <span className="truncate">{targetTitle}</span>
        </div>
        <p className="text-[11px] text-muted-foreground/80 italic mb-2">
          Note not found in workspace.
        </p>
        <button
          type="button"
          onClick={() => {
            onClose();
            onNavigate(targetTitle);
          }}
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
      ref={popoverRef}
      style={style}
      className="fixed z-50 w-96 overflow-hidden rounded-lg border border-border bg-popover shadow-xl text-xs text-popover-foreground pointer-events-auto flex flex-col"
      onMouseEnter={onMouseEnter}
      onMouseLeave={handleLeave}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/60 border-b border-border shrink-0">
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
          type="button"
          onClick={() => {
            onClose();
            onNavigate(file.id);
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
