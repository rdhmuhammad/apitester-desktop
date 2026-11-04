import React, { useState } from 'react';
import { parseMarkdownTable, formatMarkdownTable } from '../utils/markdownUtils';
import { Plus, Trash2, AlignLeft, AlignCenter, AlignRight, Code2, CheckSquare } from 'lucide-react';

interface TableWidgetProps {
  markdownTable: string[];
  onChange?: (newTableMarkdown: string) => void;
  onInteract?: () => void;
  onEditSyntax?: () => void;
  onSelectSyntax?: () => void;
  isReadOnly?: boolean;
}

export const TableWidget: React.FC<TableWidgetProps> = ({
  markdownTable,
  onChange,
  onInteract,
  onEditSyntax,
  onSelectSyntax,
  isReadOnly = false,
}) => {
  const parsed = parseMarkdownTable(markdownTable);

  const [headers, setHeaders] = useState<string[]>(parsed.headers);
  const [rows, setRows] = useState<string[][]>(parsed.rows);
  const [alignments, setAlignments] = useState<Array<'left' | 'center' | 'right'>>(
    parsed.alignments
  );
  const [editingCell, setEditingCell] = useState<{ r: number; c: number } | null>(null);

  if (!parsed.isValid) {
    return (
      <div className="font-code text-xs text-amber-400 bg-[#2d2212] p-2 rounded">
        {markdownTable.join('\n')}
      </div>
    );
  }

  const notifyChange = (
    newHeaders: string[],
    newRows: string[][],
    newAligns: Array<'left' | 'center' | 'right'>
  ) => {
    onInteract?.();
    setHeaders(newHeaders);
    setRows(newRows);
    setAlignments(newAligns);
    if (onChange) {
      const formatted = formatMarkdownTable(newHeaders, newRows, newAligns);
      onChange(formatted);
    }
  };

  const handleHeaderChange = (colIdx: number, val: string) => {
    const next = [...headers];
    next[colIdx] = val;
    notifyChange(next, rows, alignments);
  };

  const handleCellChange = (rowIdx: number, colIdx: number, val: string) => {
    const next = rows.map((r, ri) => (ri === rowIdx ? [...r] : r));
    next[rowIdx][colIdx] = val;
    notifyChange(headers, next, alignments);
  };

  const addColumn = () => {
    const nextH = [...headers, `Col ${headers.length + 1}`];
    const nextR = rows.map((r) => [...r, '']);
    const nextA = [...alignments, 'left' as const];
    notifyChange(nextH, nextR, nextA);
  };

  const addRow = () => {
    const newRow = new Array(headers.length).fill('');
    const nextR = [...rows, newRow];
    notifyChange(headers, nextR, alignments);
  };

  const deleteRow = (rIdx: number) => {
    const nextR = rows.filter((_, i) => i !== rIdx);
    notifyChange(headers, nextR, alignments);
  };

  const deleteColumn = (cIdx: number) => {
    if (headers.length <= 1) return;
    const nextH = headers.filter((_, i) => i !== cIdx);
    const nextR = rows.map((r) => r.filter((_, i) => i !== cIdx));
    const nextA = alignments.filter((_, i) => i !== cIdx);
    notifyChange(nextH, nextR, nextA);
  };

  const cycleAlignment = (cIdx: number) => {
    const current = alignments[cIdx] || 'left';
    const cycle: Record<'left' | 'center' | 'right', 'left' | 'center' | 'right'> = {
      left: 'center',
      center: 'right',
      right: 'left',
    };
    const nextA = [...alignments];
    nextA[cIdx] = cycle[current];
    notifyChange(headers, rows, nextA);
  };

  return (
    <div
      onClick={(e) => {
        if (e.shiftKey && onSelectSyntax) {
          e.stopPropagation();
          onSelectSyntax();
          return;
        }
        e.stopPropagation();
        onInteract?.();
      }}
      onMouseDown={(e) => {
        if (e.shiftKey) return;
        e.stopPropagation();
        onInteract?.();
      }}
      className="my-4 overflow-x-auto rounded-lg border border-[#333333] bg-[#222222]/80 group/table transition-all cursor-default"
    >
      <table className="w-full text-left text-sm border-collapse">
        <thead>
          <tr className="border-b border-[#333333] bg-[#2a2a2a]/60">
            {headers.map((h, cIdx) => {
              const align = alignments[cIdx] || 'left';
              return (
                <th
                  key={cIdx}
                  className={`p-2.5 font-semibold text-[#e0e0e0] group/th relative border-r border-[#333333]/50 last:border-r-0 ${
                    align === 'center'
                      ? 'text-center'
                      : align === 'right'
                      ? 'text-right'
                      : 'text-left'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    {isReadOnly ? (
                      <span className="flex-1">{h}</span>
                    ) : (
                      <input
                        type="text"
                        value={h}
                        onChange={(e) => handleHeaderChange(cIdx, e.target.value)}
                        className="bg-transparent text-[#e0e0e0] font-semibold focus:outline-none focus:bg-[#333333]/70 px-1 py-0.5 rounded w-full"
                      />
                    )}

                    {!isReadOnly && (
                      <div className="opacity-0 group-hover/th:opacity-100 flex items-center gap-0.5 shrink-0 transition-opacity">
                        <button
                          type="button"
                          onClick={() => cycleAlignment(cIdx)}
                          title="Toggle Alignment"
                          className="p-1 text-[#888888] hover:text-[#e0e0e0] rounded hover:bg-[#3a3a3a]"
                        >
                          {align === 'center' ? (
                            <AlignCenter size={12} />
                          ) : align === 'right' ? (
                            <AlignRight size={12} />
                          ) : (
                            <AlignLeft size={12} />
                          )}
                        </button>
                        {headers.length > 1 && (
                          <button
                            type="button"
                            onClick={() => deleteColumn(cIdx)}
                            title="Delete Column"
                            className="p-1 text-[#888888] hover:text-red-400 rounded hover:bg-[#3a3a3a]"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </th>
              );
            })}
            {!isReadOnly && (
              <th className="w-8 p-1.5 text-center">
                <button
                  type="button"
                  onClick={addColumn}
                  title="Add Column"
                  className="p-1 text-[#888888] hover:text-purple-400 hover:bg-[#333333] rounded transition-colors"
                >
                  <Plus size={14} />
                </button>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rIdx) => (
            <tr
              key={rIdx}
              className="border-b border-[#333333]/40 hover:bg-[#282828]/50 group/tr transition-colors"
            >
              {headers.map((_, cIdx) => {
                const align = alignments[cIdx] || 'left';
                const cellVal = row[cIdx] || '';
                return (
                  <td
                    key={cIdx}
                    className={`p-2 border-r border-[#333333]/40 last:border-r-0 ${
                      align === 'center'
                        ? 'text-center'
                        : align === 'right'
                        ? 'text-right'
                        : 'text-left'
                    }`}
                  >
                    {isReadOnly ? (
                      <span className="text-[#cccccc]">{cellVal || '\u00A0'}</span>
                    ) : (
                      <input
                        type="text"
                        value={cellVal}
                        onChange={(e) => handleCellChange(rIdx, cIdx, e.target.value)}
                        onFocus={() => setEditingCell({ r: rIdx, c: cIdx })}
                        onBlur={() => setEditingCell(null)}
                        className="bg-transparent text-[#cccccc] focus:text-[#ffffff] focus:outline-none focus:bg-[#333333]/70 px-1.5 py-0.5 rounded w-full"
                      />
                    )}
                  </td>
                );
              })}
              {!isReadOnly && (
                <td className="w-8 p-1 text-center">
                  <button
                    type="button"
                    onClick={() => deleteRow(rIdx)}
                    title="Delete Row"
                    className="opacity-0 group-hover/tr:opacity-100 p-1 text-[#777777] hover:text-red-400 hover:bg-[#333333] rounded transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {!isReadOnly && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-2 border-t border-[#333333]/40 bg-[#1e1e1e]/40 text-xs text-[#888888]">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={addRow}
              className="flex items-center gap-1.5 px-2 py-1 text-xs text-[#a0a0a0] hover:text-purple-300 hover:bg-[#2d2d2d] rounded transition-colors"
            >
              <Plus size={12} /> Add Row
            </button>
            {onSelectSyntax && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectSyntax();
                }}
                title="Select entire table as raw Markdown syntax"
                className="flex items-center gap-1.5 px-2 py-1 text-xs text-purple-300 hover:text-white hover:bg-purple-900/50 border border-purple-500/30 rounded transition-colors"
              >
                <CheckSquare size={12} /> Select as Syntax
              </button>
            )}
            {onEditSyntax && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditSyntax();
                }}
                title="Edit raw Markdown pipe syntax"
                className="flex items-center gap-1.5 px-2 py-1 text-xs text-[#a0a0a0] hover:text-purple-300 hover:bg-[#2d2d2d] rounded transition-colors"
              >
                <Code2 size={12} /> Edit Syntax
              </button>
            )}
          </div>
          <span className="text-[11px] text-[#666666]">
            {rows.length} rows × {headers.length} columns
          </span>
        </div>
      )}
    </div>
  );
};
