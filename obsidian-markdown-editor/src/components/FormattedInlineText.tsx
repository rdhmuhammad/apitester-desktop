import React from 'react';
import { FileItem } from '../types/obsidian';
import { parseFrontmatter } from '../utils/markdownUtils';

interface FormattedInlineTextProps {
  text: string;
  files: FileItem[];
  currentFile: FileItem;
  onWikiLinkClick: (target: string) => void;
  onWikiLinkHover: (target: string, e: React.MouseEvent) => void;
  onWikiLinkLeave: () => void;
  onTagClick?: (tag: string) => void;
}

export const FormattedInlineText: React.FC<FormattedInlineTextProps> = ({
  text,
  files,
  currentFile,
  onWikiLinkClick,
  onWikiLinkHover,
  onWikiLinkLeave,
  onTagClick,
}) => {
  const { frontmatter } = parseFrontmatter(currentFile.content);

  // Parse inline tokens:
  // 1. Wiki-links [[target|alias]] or [[target#heading]] or [[target]]
  // 2. Dynamic variables {{var}}
  // 3. Bold **text**
  // 4. Italic *text* or _text_
  // 5. Code `text`
  // 6. Strikethrough ~~text~~
  // 7. Tags #tag
  const tokenRegex = /(\[\[.*?\]\]|\{\{.*?\}\}|\*\*.*?\*\*|\*.*?\*|`.*?`|~~.*?~~|(?:^|\s)#[a-zA-Z0-9_\-\/]+)/g;

  const parts = text.split(tokenRegex);

  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null;

        // 1. Wiki-link [[...]]
        if (part.startsWith('[[') && part.endsWith(']]')) {
          const inner = part.slice(2, -2);
          let target = inner;
          let label = inner;
          if (inner.includes('|')) {
            const split = inner.split('|');
            target = split[0].trim();
            label = split[1].trim();
          } else if (inner.includes('#')) {
            const split = inner.split('#');
            target = split[0].trim();
            label = `${split[0].trim()} > ${split[1].trim()}`;
          }

          // Check if file exists in workspace
          const exists = files.some(
            (f) =>
              f.title.toLowerCase() === target.toLowerCase() ||
              f.path.toLowerCase() === target.toLowerCase() ||
              f.id === target
          );

          return (
            <span
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                onWikiLinkClick(target);
              }}
              onMouseEnter={(e) => onWikiLinkHover(target, e)}
              onMouseLeave={onWikiLinkLeave}
              className={`cursor-pointer px-1 py-0.5 rounded transition-colors inline-flex items-center gap-0.5 font-medium ${
                exists
                  ? 'text-purple-300 hover:text-purple-200 bg-purple-950/40 hover:bg-purple-900/60 underline decoration-purple-500/50 underline-offset-2'
                  : 'text-rose-400 hover:text-rose-300 bg-rose-950/20 hover:bg-rose-900/40 line-through decoration-rose-500'
              }`}
              title={exists ? `Internal link to: ${target}` : `Note "${target}" does not exist (click to create)`}
            >
              {label}
            </span>
          );
        }

        // 2. Dynamic variable {{var}}
        if (part.startsWith('{{') && part.endsWith('}}')) {
          const varName = part.slice(2, -2).trim();
          let resolvedVal = (frontmatter as any)[varName];
          if (varName === 'title') resolvedVal = currentFile.title;
          if (varName === 'today') resolvedVal = new Date().toLocaleDateString();
          const isResolved = resolvedVal !== undefined && resolvedVal !== null;

          return (
            <span
              key={i}
              className={`inline-block px-1.5 py-0.5 rounded font-mono text-[11px] border cursor-help ${
                isResolved
                  ? 'bg-amber-950/30 text-amber-300 border-amber-600/40'
                  : 'bg-red-950/30 text-red-300 border-red-600/40'
              }`}
              title={
                isResolved
                  ? `Variable {{${varName}}} = "${String(resolvedVal)}"`
                  : `Unresolved dynamic variable {{${varName}}}`
              }
            >
              {isResolved ? String(resolvedVal) : `{{${varName}}}`}
            </span>
          );
        }

        // 3. Bold **text**
        if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
          return (
            <strong key={i} className="font-bold text-white">
              {part.slice(2, -2)}
            </strong>
          );
        }

        // 4. Strikethrough ~~text~~
        if (part.startsWith('~~') && part.endsWith('~~') && part.length >= 4) {
          return (
            <del key={i} className="line-through text-[#888888]">
              {part.slice(2, -2)}
            </del>
          );
        }

        // 5. Italic *text*
        if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
          return (
            <em key={i} className="italic text-[#e6e6e6]">
              {part.slice(1, -1)}
            </em>
          );
        }

        // 6. Inline code `text`
        if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
          return (
            <code
              key={i}
              className="bg-[#292929] text-purple-300 font-mono text-[12px] px-1.5 py-0.5 rounded border border-[#3a3a3a]"
            >
              {part.slice(1, -1)}
            </code>
          );
        }

        // 7. Tag #tag
        const tagMatch = part.match(/^(\s*)#([a-zA-Z0-9_\-\/]+)$/);
        if (tagMatch) {
          const prefixSpace = tagMatch[1];
          const tag = tagMatch[2];
          return (
            <React.Fragment key={i}>
              {prefixSpace}
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onTagClick?.(tag);
                }}
                className="cursor-pointer text-[11px] font-medium text-purple-300 bg-purple-950/50 hover:bg-purple-900/70 border border-purple-800/40 px-1.5 py-0.5 rounded transition-colors inline-block my-0.5"
              >
                #{tag}
              </span>
            </React.Fragment>
          );
        }

        return <span key={i}>{part}</span>;
      })}
    </>
  );
};
