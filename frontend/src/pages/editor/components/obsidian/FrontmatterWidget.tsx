import React, { useState } from 'react';
import {
  parseFrontmatter,
  updateFrontmatter,
} from './markdownUtils.ts';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Tag,
  Calendar,
  Hash,
  CheckSquare,
  Type,
} from 'lucide-react';

interface FrontmatterWidgetProps {
  content: string;
  onChange: (newContent: string) => void;
  onInteract?: () => void;
  isReadOnly?: boolean;
}

export const FrontmatterWidget: React.FC<FrontmatterWidgetProps> = ({
  content,
  onChange,
  onInteract,
  isReadOnly = false,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [isAddingProp, setIsAddingProp] = useState(false);
  const [newPropKey, setNewPropKey] = useState('');
  const [newPropType, setNewPropType] = useState<'text' | 'tags' | 'date' | 'number' | 'boolean'>('text');

  const { frontmatter, hasFrontmatter } = parseFrontmatter(content);
  const entries = Object.entries(frontmatter);

  if (!hasFrontmatter && entries.length === 0) {
    if (isReadOnly) return null;
    return (
      <div
        onClick={(e) => {
          e.stopPropagation();
          onInteract?.();
        }}
        onMouseDown={(e) => e.stopPropagation()}
        className="mb-4 pb-2 border-b border-border"
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onInteract?.();
            const withFM = updateFrontmatter(content, 'tags', ['untagged']);
            onChange(withFM);
          }}
          className="text-xs text-muted-foreground hover:text-purple-600 dark:hover:text-purple-400 flex items-center gap-1.5 py-1 px-2 rounded hover:bg-muted transition-colors"
        >
          <Plus size={12} /> Add document properties (YAML)
        </button>
      </div>
    );
  }

  const handleUpdate = (key: string, value: unknown) => {
    onInteract?.();
    const updated = updateFrontmatter(content, key, value);
    onChange(updated);
  };

  const handleRemove = (key: string) => {
    onInteract?.();
    const updated = updateFrontmatter(content, key, undefined);
    onChange(updated);
  };

  const handleAddPropertySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!newPropKey.trim()) return;
    const cleanKey = newPropKey.trim().toLowerCase().replace(/\s+/g, '_');

    let initialVal: unknown = '';
    if (newPropType === 'tags') initialVal = ['new-tag'];
    else if (newPropType === 'date') initialVal = new Date().toISOString().split('T')[0];
    else if (newPropType === 'number') initialVal = 0;
    else if (newPropType === 'boolean') initialVal = false;

    handleUpdate(cleanKey, initialVal);
    setNewPropKey('');
    setIsAddingProp(false);
  };

  const renderIconForValue = (key: string, val: unknown) => {
    if (key === 'tags' || Array.isArray(val)) return <Tag size={13} className="text-purple-600 dark:text-purple-400" />;
    if (typeof val === 'boolean') return <CheckSquare size={13} className="text-emerald-600 dark:text-emerald-400" />;
    if (typeof val === 'number') return <Hash size={13} className="text-blue-600 dark:text-blue-400" />;
    if (key.includes('date') || key === 'created' || /^\d{4}-\d{2}-\d{2}/.test(String(val))) {
      return <Calendar size={13} className="text-amber-600 dark:text-amber-400" />;
    }
    return <Type size={13} className="text-muted-foreground" />;
  };

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onInteract?.();
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        onInteract?.();
      }}
      className="mb-6 rounded-lg border border-border bg-card/60 dark:bg-[#222222]/60 overflow-hidden text-xs cursor-default"
    >
      {/* Header bar */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          onInteract?.();
          setIsOpen(!isOpen);
        }}
        className="flex items-center justify-between px-3 py-2 bg-muted/40 dark:bg-[#262626] cursor-pointer select-none border-b border-border/60 hover:bg-muted/70 dark:hover:bg-[#2b2b2b] transition-colors"
      >
        <div className="flex items-center gap-2 text-foreground font-medium">
          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span>Properties</span>
          <span className="text-[11px] text-muted-foreground px-1.5 py-0.2 bg-muted dark:bg-[#1a1a1a] rounded">
            {entries.length}
          </span>
        </div>

        {!isReadOnly && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onInteract?.();
              setIsOpen(true);
              setIsAddingProp(!isAddingProp);
            }}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-purple-600 dark:hover:text-purple-300 hover:bg-muted dark:hover:bg-[#333333] px-2 py-0.5 rounded transition-colors"
          >
            <Plus size={11} /> Property
          </button>
        )}
      </div>

      {isOpen && (
        <div className="p-2 space-y-1.5">
          {isAddingProp && (
            <form
              onSubmit={handleAddPropertySubmit}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2 p-2 bg-muted/60 dark:bg-[#2a2a2a] rounded border border-purple-500/40 mb-2"
            >
              <input
                type="text"
                placeholder="Property name..."
                value={newPropKey}
                onChange={(e) => setNewPropKey(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                autoFocus
                className="bg-background border border-border px-2 py-1 rounded text-xs text-foreground focus:outline-none focus:border-purple-500 flex-1"
              />
              <select
                value={newPropType}
                onChange={(e) => {
                  e.stopPropagation();
                  setNewPropType(e.target.value as 'text' | 'tags' | 'date' | 'number' | 'boolean');
                }}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                className="bg-background border border-border px-2 py-1 rounded text-xs text-foreground focus:outline-none"
              >
                <option value="text">Text</option>
                <option value="tags">Tags (List)</option>
                <option value="date">Date</option>
                <option value="number">Number</option>
                <option value="boolean">Checkbox</option>
              </select>
              <button
                type="submit"
                onClick={(e) => e.stopPropagation()}
                className="bg-purple-600 hover:bg-purple-500 text-white px-2.5 py-1 rounded text-xs font-medium"
              >
                Add
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsAddingProp(false);
                }}
                className="text-muted-foreground hover:text-foreground px-1 text-xs"
              >
                Cancel
              </button>
            </form>
          )}

          {entries.length === 0 ? (
            <div className="py-2 text-center text-muted-foreground italic text-[11px]">
              No properties defined.
            </div>
          ) : (
            entries.map(([key, val]) => (
              <div
                key={key}
                className="flex items-center gap-3 px-2 py-1 rounded hover:bg-muted/40 dark:hover:bg-[#282828] group transition-colors"
              >
                {/* Key Column */}
                <div className="flex items-center gap-1.5 w-32 shrink-0 text-muted-foreground">
                  {renderIconForValue(key, val)}
                  <span className="font-mono text-[11px] truncate">{key}</span>
                </div>

                {/* Value Column */}
                <div className="flex-1 min-w-0">
                  {Array.isArray(val) ? (
                    <div className="flex flex-wrap items-center gap-1">
                      {val.map((tagItem, ti) => (
                        <span
                          key={ti}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800/40 text-[11px]"
                        >
                          #{tagItem}
                          {!isReadOnly && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const nextList = val.filter((_, idx) => idx !== ti);
                                handleUpdate(key, nextList);
                              }}
                              className="hover:text-red-500"
                            >
                              ×
                            </button>
                          )}
                        </span>
                      ))}
                      {!isReadOnly && (
                        <input
                          type="text"
                          placeholder="+ tag"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                              e.preventDefault();
                              e.stopPropagation();
                              const newTag = e.currentTarget.value.trim().replace(/^#/, '');
                              handleUpdate(key, [...val, newTag]);
                              e.currentTarget.value = '';
                            }
                          }}
                          className="bg-transparent border-b border-border px-1 py-0.5 text-[11px] text-foreground w-16 focus:w-24 focus:border-purple-500 focus:outline-none transition-all"
                        />
                      )}
                    </div>
                  ) : typeof val === 'boolean' ? (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={val}
                        disabled={isReadOnly}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => handleUpdate(key, e.target.checked)}
                        className="rounded border-border text-purple-600 focus:ring-0 bg-background"
                      />
                      <span className="text-muted-foreground text-[11px]">{val ? 'true' : 'false'}</span>
                    </label>
                  ) : typeof val === 'number' ? (
                    <input
                      type="number"
                      value={val}
                      disabled={isReadOnly}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => handleUpdate(key, Number(e.target.value))}
                      className="bg-transparent border border-transparent hover:border-border focus:border-purple-500 focus:bg-background rounded px-1.5 py-0.5 text-foreground font-mono text-[11px] w-24 focus:outline-none"
                    />
                  ) : (
                    <input
                      type="text"
                      value={String(val)}
                      placeholder="Empty"
                      disabled={isReadOnly}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => handleUpdate(key, e.target.value)}
                      className="bg-transparent border border-transparent hover:border-border focus:border-purple-500 focus:bg-background rounded px-1.5 py-0.5 text-foreground placeholder:text-muted-foreground text-[11px] w-full focus:outline-none"
                    />
                  )}
                </div>

                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(key);
                    }}
                    title="Remove Property"
                    className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-red-500 rounded transition-opacity"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
