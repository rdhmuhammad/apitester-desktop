import React, { useEffect, useRef } from 'react';
import {
  FileText,
  Heading,
  Table as TableIcon,
  Image as ImageIcon,
  Code,
  CheckSquare,
  AlertCircle,
  Quote,
  Sparkles,
  Tag,
  Plus,
} from 'lucide-react';
import type { FileItem } from './types.ts';
import { extractHeadings } from './markdownUtils.ts';

export interface AutocompleteOption {
  id: string;
  label: string;
  detail?: string;
  icon?: React.ReactNode;
  insertText: string;
  isCreateNew?: boolean;
}

export type AutocompleteTrigger = '[[' | '/' | '{{' | '#' | null;

// eslint-disable-next-line react-refresh/only-export-components
export function getAutocompleteOptions(
  trigger: AutocompleteTrigger,
  query: string,
  files: FileItem[],
  allTags: string[],
  currentFile: FileItem
): AutocompleteOption[] {
  if (!trigger) return [];

  // 1. Wiki-link Trigger `[[`
  if (trigger === '[[') {
    const isHeadingSearch = query.includes('#');

    if (isHeadingSearch) {
      const [targetDoc, headingQuery] = query.split('#');
      const matchedFile = files.find(
        (f) =>
          f.title.toLowerCase() === targetDoc.trim().toLowerCase() ||
          f.id === targetDoc.trim()
      );

      if (matchedFile) {
        const headings = extractHeadings(matchedFile.content);
        const filtered = headings.filter((h) =>
          h.text.toLowerCase().includes((headingQuery || '').toLowerCase())
        );

        return filtered.map((h) => ({
          id: `heading-${h.id}`,
          label: `${'#'.repeat(h.level)} ${h.text}`,
          detail: `Heading in ${matchedFile.title}`,
          icon: <Heading size={14} className="text-purple-600 dark:text-purple-400" />,
          insertText: `${matchedFile.title}#${h.text}]]`,
        }));
      }
      return [];
    } else {
      // Document fuzzy match
      const filtered = files.filter((f) =>
        f.title.toLowerCase().includes(query.toLowerCase())
      );

      const options: AutocompleteOption[] = filtered.map((f) => ({
        id: f.id,
        label: f.title,
        detail: f.folder ? `${f.folder}/` : 'Root',
        icon: <FileText size={14} className="text-purple-600 dark:text-purple-400" />,
        insertText: `${f.title}]]`,
      }));

      // If no exact match, allow lazy creation!
      if (query.trim() && !files.some((f) => f.title.toLowerCase() === query.trim().toLowerCase())) {
        options.push({
          id: 'create-new',
          label: `Create note: "${query.trim()}"`,
          detail: 'New document',
          icon: <Plus size={14} className="text-emerald-600 dark:text-emerald-400" />,
          insertText: `${query.trim()}]]`,
          isCreateNew: true,
        });
      }
      return options;
    }
  }

  // 2. Slash Commands Trigger `/`
  if (trigger === '/') {
    const slashCommands: AutocompleteOption[] = [
      {
        id: 'h1',
        label: 'Heading 1',
        detail: '# Heading 1',
        icon: <Heading size={14} className="text-purple-600 dark:text-purple-400" />,
        insertText: '# ',
      },
      {
        id: 'h2',
        label: 'Heading 2',
        detail: '## Heading 2',
        icon: <Heading size={14} className="text-purple-600 dark:text-purple-400" />,
        insertText: '## ',
      },
      {
        id: 'h3',
        label: 'Heading 3',
        detail: '### Heading 3',
        icon: <Heading size={14} className="text-purple-600 dark:text-purple-400" />,
        insertText: '### ',
      },
      {
        id: 'task',
        label: 'Task List',
        detail: '- [ ] Interactive checkbox item',
        icon: <CheckSquare size={14} className="text-emerald-600 dark:text-emerald-400" />,
        insertText: '- [ ] ',
      },
      {
        id: 'callout-note',
        label: 'Callout: Note',
        detail: '> [!note] Information callout',
        icon: <AlertCircle size={14} className="text-blue-600 dark:text-blue-400" />,
        insertText: '> [!note] Note\n> ',
      },
      {
        id: 'callout-warning',
        label: 'Callout: Warning',
        detail: '> [!warning] Security/Caution notice',
        icon: <AlertCircle size={14} className="text-amber-600 dark:text-amber-400" />,
        insertText: '> [!warning] Warning\n> ',
      },
      {
        id: 'callout-tip',
        label: 'Callout: Tip',
        detail: '> [!tip] Practical recommendation',
        icon: <Sparkles size={14} className="text-emerald-600 dark:text-emerald-400" />,
        insertText: '> [!tip] Pro Tip\n> ',
      },
      {
        id: 'callout-todo',
        label: 'Callout: Todo',
        detail: '> [!todo] Actionable tasks box',
        icon: <CheckSquare size={14} className="text-cyan-600 dark:text-cyan-400" />,
        insertText: '> [!todo] Action Items\n> - [ ] ',
      },
      {
        id: 'table',
        label: 'Interactive Table',
        detail: '| Col 1 | Col 2 | spreadsheet widget',
        icon: <TableIcon size={14} className="text-indigo-600 dark:text-indigo-400" />,
        insertText: '| Header 1 | Header 2 | Header 3 |\n| :--- | :---: | ---: |\n| Value 1 | Value 2 | Value 3 |\n| Item A | Item B | Item C |\n',
      },
      {
        id: 'image',
        label: 'Image',
        detail: '<img src="https://example.com" alt="A cute kitten" width="300"/>',
        icon: <ImageIcon size={14} className="text-pink-600 dark:text-pink-400" />,
        insertText: '<img src="https://example.com" alt="A cute kitten" width="300"/>\n',
      },
      {
        id: 'code',
        label: 'Code Block',
        detail: '```typescript fenced code block',
        icon: <Code size={14} className="text-emerald-600 dark:text-emerald-400" />,
        insertText: '```typescript\n// your code here\n```\n',
      },
      {
        id: 'quote',
        label: 'Blockquote',
        detail: '> Cited quote block',
        icon: <Quote size={14} className="text-purple-600 dark:text-purple-400" />,
        insertText: '> ',
      },
    ];

    return slashCommands.filter(
      (c) =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        (c.detail && c.detail.toLowerCase().includes(query.toLowerCase()))
    );
  }

  // 3. Dynamic Variables `{{`
  if (trigger === '{{') {
    const vars: AutocompleteOption[] = [
      {
        id: 'title',
        label: 'title',
        detail: currentFile.title,
        icon: <Sparkles size={13} className="text-amber-500" />,
        insertText: 'title}}',
      },
      {
        id: 'created',
        label: 'created',
        detail: new Date(currentFile.updatedAt).toISOString().split('T')[0],
        icon: <Sparkles size={13} className="text-amber-500" />,
        insertText: 'created}}',
      },
      {
        id: 'status',
        label: 'status',
        detail: 'Document status tag',
        icon: <Sparkles size={13} className="text-amber-500" />,
        insertText: 'status}}',
      },
      {
        id: 'author',
        label: 'author',
        detail: 'Document author',
        icon: <Sparkles size={13} className="text-amber-500" />,
        insertText: 'author}}',
      },
      {
        id: 'today',
        label: 'date:today',
        detail: new Date().toLocaleDateString(),
        icon: <Sparkles size={13} className="text-amber-500" />,
        insertText: 'today}}',
      },
    ];

    return vars.filter((v) => v.label.toLowerCase().includes(query.toLowerCase()));
  }

  // 4. Tags Trigger `#`
  if (trigger === '#') {
    return allTags
      .filter((t) => t.toLowerCase().includes(query.toLowerCase()))
      .map((t) => ({
        id: `tag-${t}`,
        label: `#${t}`,
        detail: 'Workspace tag',
        icon: <Tag size={13} className="text-purple-600 dark:text-purple-400" />,
        insertText: `${t} `,
      }));
  }

  return [];
}

interface AutocompletePopoverProps {
  isOpen: boolean;
  trigger: AutocompleteTrigger;
  query?: string;
  files?: FileItem[];
  allTags?: string[];
  currentFile?: FileItem;
  options?: AutocompleteOption[];
  position: { top: number; left: number };
  selectedIndex: number;
  onSelect: (option: AutocompleteOption) => void;
  onClose: () => void;
}

export const AutocompletePopover: React.FC<AutocompletePopoverProps> = ({
  isOpen,
  trigger,
  query = '',
  files = [],
  allTags = [],
  currentFile,
  options: providedOptions,
  position,
  selectedIndex,
  onSelect,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      const activeEl = containerRef.current.querySelector('[data-selected="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen || !trigger) return null;

  const options =
    providedOptions ??
    (currentFile
      ? getAutocompleteOptions(trigger, query, files, allTags, currentFile)
      : []);

  if (options.length === 0) {
    return null;
  }

  const boundedIndex = Math.max(0, Math.min(selectedIndex, options.length - 1));

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: Math.min(window.innerHeight - 320, Math.max(60, position.top)),
        left: Math.min(window.innerWidth - 320, Math.max(20, position.left)),
      }}
      className="z-50 w-72 max-h-72 overflow-y-auto rounded-lg border border-border bg-popover shadow-2xl p-1 text-xs"
    >
      <div className="px-2 py-1 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider border-b border-border mb-1 flex items-center justify-between">
        <span>
          {trigger === '[[' ? 'Link Document or Heading' : trigger === '/' ? 'Slash Commands' : trigger === '{{' ? 'Dynamic Variables' : 'Tags'}
        </span>
        <span className="text-[9px] text-muted-foreground/70">ESC to close</span>
      </div>

      <div className="space-y-0.5">
        {options.map((opt, idx) => {
          const isSelected = idx === boundedIndex;
          return (
            <div
              key={opt.id}
              data-selected={isSelected}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(opt);
              }}
              className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded cursor-pointer transition-colors ${
                isSelected
                  ? 'bg-purple-600 text-white font-medium'
                  : 'text-foreground hover:bg-muted'
              }`}
            >
              <span className="shrink-0">{opt.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="truncate text-xs">{opt.label}</div>
                {opt.detail && (
                  <div
                    className={`truncate text-[10px] ${
                      isSelected ? 'text-purple-100' : 'text-muted-foreground'
                    }`}
                  >
                    {opt.detail}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
