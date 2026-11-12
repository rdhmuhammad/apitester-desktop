import React from 'react';
import type { FileItem } from './types.ts';
import { ExternalLink, Layers } from 'lucide-react';
import { parseFrontmatter } from './markdownUtils.ts';

interface TransclusionEmbedProps {
  rawEmbed: string;
  target: string;
  subpath?: string;
  files: FileItem[];
  onNavigate: (fileId: string) => void;
}

export const TransclusionEmbed: React.FC<TransclusionEmbedProps> = ({
  rawEmbed,
  target,
  subpath,
  files,
  onNavigate,
}) => {
  const matchedFile = files.find(
    (f) =>
      f.title.toLowerCase() === target.trim().toLowerCase() ||
      f.path.toLowerCase() === target.trim().toLowerCase() ||
      f.id === target.trim()
  );

  if (!matchedFile) {
    return (
      <div className="my-3 p-3 rounded-lg border border-dashed border-red-400 dark:border-red-500/40 bg-red-50 dark:bg-red-950/10 text-xs text-red-700 dark:text-red-300 flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-mono">
          <Layers size={13} /> {rawEmbed} (Target document not found)
        </span>
        <button
          onClick={() => onNavigate(target)}
          className="text-red-600 dark:text-red-400 hover:underline font-sans text-[11px]"
        >
          Create "{target}"
        </button>
      </div>
    );
  }

  const { body } = parseFrontmatter(matchedFile.content || '');
  let renderedSnippet = body;

  // If subpath is specified, extract lines starting from that heading up to next heading
  if (subpath) {
    const lines = body.split('\n');
    const headingLower = subpath.toLowerCase();
    const headingIndex = lines.findIndex((l) => {
      const match = l.match(/^#{1,6}\s+(.*)$/);
      return match && match[1].trim().toLowerCase() === headingLower;
    });

    if (headingIndex !== -1) {
      const slice: string[] = [lines[headingIndex]];
      for (let i = headingIndex + 1; i < lines.length; i++) {
        if (/^#{1,6}\s+/.test(lines[i])) break;
        slice.push(lines[i]);
      }
      renderedSnippet = slice.join('\n');
    }
  }

  return (
    <div className="my-4 rounded-lg border border-border bg-card dark:bg-[#222222]/90 shadow-sm overflow-hidden text-sm group/embed">
      {/* Transclusion Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/60 dark:bg-[#2a2a2a] border-b border-border text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <Layers size={13} className="text-purple-600 dark:text-purple-400" />
          <span>{matchedFile.title}</span>
          {subpath && <span className="text-purple-600 dark:text-purple-300">#{subpath}</span>}
        </div>
        <button
          type="button"
          onClick={() => onNavigate(matchedFile.id)}
          className="opacity-0 group-hover/embed:opacity-100 flex items-center gap-1 text-[11px] text-purple-600 dark:text-purple-400 hover:text-purple-500 transition-opacity"
        >
          <span>Open File</span>
          <ExternalLink size={11} />
        </button>
      </div>

      {/* Transcluded Content Preview */}
      <div className="p-3 text-xs text-foreground/85 dark:text-[#cccccc] font-sans leading-relaxed space-y-2 max-h-64 overflow-y-auto">
        {renderedSnippet.split('\n\n').slice(0, 4).map((p, pi) => {
          if (p.startsWith('#')) {
            const hText = p.replace(/^#+\s*/, '');
            return <div key={pi} className="font-semibold text-foreground text-sm">{hText}</div>;
          }
          if (p.startsWith('>')) {
            return (
              <div key={pi} className="p-2 border-l-2 border-purple-500 bg-purple-50 dark:bg-white/5 italic text-muted-foreground">
                {p.replace(/^>\s*/gm, '')}
              </div>
            );
          }
          return <p key={pi}>{p}</p>;
        })}
      </div>
    </div>
  );
};
