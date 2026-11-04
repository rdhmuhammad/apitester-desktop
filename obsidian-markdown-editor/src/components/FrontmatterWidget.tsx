import React, { useState } from 'react';
import {
  parseFrontmatter,
  updateFrontmatter,
} from '../utils/markdownUtils';
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
  FileCode,
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
        className="mb-4 pb-2 border-b border-[#2d2d2d]"
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onInteract?.();
            const withFM = updateFrontmatter(content, 'tags', ['untagged']);
            onChange(withFM);
          }}
          className="text-xs text-[#888888] hover:text-purple-400 flex items-center gap-1.5 py-1 px-2 rounded hover:bg-[#282828] transition-colors"
        >
          <Plus size={12} /> Add document properties (YAML)
        </button>
      </div>
    );
  }

  const handleUpdate = (key: string, value: any) => {
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

    let initialVal: any = '';
    if (newPropType === 'tags') initialVal = ['new-tag'];
    else if (newPropType === 'date') initialVal = new Date().toISOString().split('T')[0];
    else if (newPropType === 'number') initialVal = 0;
    else if (newPropType === 'boolean') initialVal = false;

    handleUpdate(cleanKey, initialVal);
    setNewPropKey('');
    setIsAddingProp(false);
  };

  const renderIconForValue = (key: string, val: any) => {
    if (key === 'tags' || Array.isArray(val)) return <Tag size={13} className="text-purple-400" />;
    if (typeof val === 'boolean') return <CheckSquare size={13} className="text-emerald-400" />;
    if (typeof val === 'number') return <Hash size={13} className="text-blue-400" />;
    if (key.includes('date') || key === 'created' || /^\d{4}-\d{2}-\d{2}/.test(String(val))) {
      return <Calendar size={13} className="text-amber-400" />;
    }
    return <Type size={13} className="text-gray-400" />;
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
      className="mb-6 rounded-lg border border-[#333333] bg-[#222222]/60 overflow-hidden text-xs cursor-default"
    >
      {/* Header bar */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          onInteract?.();
          setIsOpen(!isOpen);
        }}
        className="flex items-center justify-between px-3 py-2 bg-[#262626] cursor-pointer select-none border-b border-[#333333]/60 hover:bg-[#2b2b2b] transition-colors"
      >
        <div className="flex items-center gap-2 text-[#cccccc] font-medium">
          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span>Properties</span>
          <span className="text-[11px] text-[#777777] px-1.5 py-0.2 bg-[#1a1a1a] rounded">
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
            className="flex items-center gap-1 text-[11px] text-[#888888] hover:text-purple-300 hover:bg-[#333333] px-2 py-0.5 rounded transition-colors"
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
              className="flex items-center gap-2 p-2 bg-[#2a2a2a] rounded border border-purple-500/30 mb-2"
            >
              <input
                type="text"
                placeholder="Property name..."
                value={newPropKey}
                onChange={(e) => setNewPropKey(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                autoFocus
                className="bg-[#1e1e1e] border border-[#444444] px-2 py-1 rounded text-xs text-white focus:outline-none focus:border-purple-400 flex-1"
              />
              <select
                value={newPropType}
                onChange={(e) => {
                  e.stopPropagation();
                  setNewPropType(e.target.value as 'text' | 'tags' | 'date' | 'number' | 'boolean');
                }}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                className="bg-[#1e1e1e] border border-[#444444] px-2 py-1 rounded text-xs text-[#cccccc] focus:outline-none"
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
                className="text-[#888888] hover:text-white px-1 text-xs"
              >
                Cancel
              </button>
            </form>
          )}

          {entries.length === 0 ? (
            <div className="py-2 text-center text-[#777777] italic text-[11px]">
              No properties defined.
            </div>
          ) : (
            entries.map(([key, val]) => (
              <div
                key={key}
                className="flex items-center gap-3 px-2 py-1 rounded hover:bg-[#282828] group transition-colors"
              >
                {/* Key Column */}
                <div className="flex items-center gap-1.5 w-32 shrink-0 text-[#a0a0a0]">
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
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-950/60 text-purple-300 border border-purple-800/40 text-[11px]"
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
                              className="hover:text-red-300"
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
                          className="bg-transparent border-b border-[#444] px-1 py-0.5 text-[11px] text-[#ccc] w-16 focus:w-24 focus:border-purple-400 focus:outline-none transition-all"
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
                        className="rounded border-[#444444] text-purple-600 focus:ring-0 bg-[#1e1e1e]"
                      />
                      <span className="text-[#999999] text-[11px]">{val ? 'true' : 'false'}</span>
                    </label>
                  ) : typeof val === 'number' ? (
                    <input
                      type="number"
                      value={val}
                      disabled={isReadOnly}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => handleUpdate(key, Number(e.target.value))}
                      className="bg-transparent border border-transparent hover:border-[#444444] focus:border-purple-500 focus:bg-[#1a1a1a] rounded px-1.5 py-0.5 text-[#e0e0e0] font-mono text-[11px] w-24 focus:outline-none"
                    />
                  ) : (
                    <input
                      type="text"
                      value={String(val)}
                      placeholder="Empty"
                      disabled={isReadOnly}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => handleUpdate(key, e.target.value)}
                      className="bg-transparent border border-transparent hover:border-[#444444] focus:border-purple-500 focus:bg-[#1a1a1a] rounded px-1.5 py-0.5 text-[#e0e0e0] placeholder:text-[#555555] text-[11px] w-full focus:outline-none"
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
                    className="opacity-0 group-hover:opacity-100 p-1 text-[#666666] hover:text-red-400 rounded transition-opacity"
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
