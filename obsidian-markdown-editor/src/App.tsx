import React, { useState, useRef } from 'react';
import { FileItem } from './types/obsidian';
import { INITIAL_VAULT_FILES } from './data/seedVault';
import { extractTags } from './utils/markdownUtils';
import { Toolbar } from './components/Toolbar';
import { LivePreviewEditor, LivePreviewEditorHandle } from './components/LivePreviewEditor';
import { HoverPreview } from './components/HoverPreview';

export default function App() {
  const [files, setFiles] = useState<FileItem[]>(INITIAL_VAULT_FILES);
  const [activeFileId, setActiveFileId] = useState<string>('note-welcome');
  const editorRef = useRef<LivePreviewEditorHandle | null>(null);

  // Undo / Redo history stacks
  const [history, setHistory] = useState<Record<string, string[]>>({});
  const [redoHistory, setRedoHistory] = useState<Record<string, string[]>>({});

  // Hover preview state
  const [hoverPreview, setHoverPreview] = useState<{
    targetTitle: string;
    position: { x: number; y: number };
  } | null>(null);

  // Extract all unique tags across workspace for inline #tag autocomplete
  const allTags = Array.from(
    new Set(files.flatMap((f) => extractTags(f.content)))
  );

  // Active file
  const currentActiveFile =
    files.find((f) => f.id === activeFileId) || files[0];

  // Content update handler with history capture
  const handleUpdateContent = (fileId: string, newContent: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, content: newContent, isDirty: true } : f))
    );

    setHistory((prev) => {
      const fileHistory = prev[fileId] || [];
      const current = files.find((f) => f.id === fileId)?.content || '';
      if (fileHistory[fileHistory.length - 1] !== current) {
        return { ...prev, [fileId]: [...fileHistory.slice(-20), current] };
      }
      return prev;
    });
    setRedoHistory((prev) => ({ ...prev, [fileId]: [] }));
  };

  const handleUndo = () => {
    const fileId = currentActiveFile.id;
    const past = history[fileId] || [];
    if (past.length === 0) return;

    const previousContent = past[past.length - 1];
    const newPast = past.slice(0, -1);

    setRedoHistory((prev) => ({
      ...prev,
      [fileId]: [...(prev[fileId] || []), currentActiveFile.content],
    }));

    setHistory((prev) => ({ ...prev, [fileId]: newPast }));
    setFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, content: previousContent } : f))
    );
  };

  const handleRedo = () => {
    const fileId = currentActiveFile.id;
    const future = redoHistory[fileId] || [];
    if (future.length === 0) return;

    const nextContent = future[future.length - 1];
    const newFuture = future.slice(0, -1);

    setHistory((prev) => ({
      ...prev,
      [fileId]: [...(prev[fileId] || []), currentActiveFile.content],
    }));

    setRedoHistory((prev) => ({ ...prev, [fileId]: newFuture }));
    setFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, content: nextContent } : f))
    );
  };

  // Format action buttons (e.g., Bold, Headings, Callout, Table, Image) applied at current cursor
  const handleFormatAction = (actionType: string) => {
    editorRef.current?.applyFormatAction(actionType);
  };

  // Navigate to or lazy-create file by title/id
  const handleNavigateFile = (target: string) => {
    const cleanTarget = target.trim();
    const existing = files.find(
      (f) =>
        f.title.toLowerCase() === cleanTarget.toLowerCase() ||
        f.id === cleanTarget ||
        f.path.toLowerCase() === cleanTarget.toLowerCase()
    );

    if (existing) {
      setActiveFileId(existing.id);
    } else {
      // Lazy creation: file doesn't exist, create it on demand
      const newFile: FileItem = {
        id: `note-${Date.now()}`,
        path: `${cleanTarget}.md`,
        title: cleanTarget,
        folder: '',
        content: `# ${cleanTarget}\n\nStart writing notes for ${cleanTarget}...\n`,
        updatedAt: Date.now(),
      };
      setFiles((prev) => [...prev, newFile]);
      setActiveFileId(newFile.id);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#1e1e1e] text-[#dcddde] font-sans">
      {/* Standalone Editor Workspace (Live Preview Only) */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Formatting Toolbar */}
        <Toolbar
          canUndo={(history[currentActiveFile.id] || []).length > 0}
          canRedo={(redoHistory[currentActiveFile.id] || []).length > 0}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onFormatAction={handleFormatAction}
        />

        {/* Single Editor Pane */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden bg-[#1e1e1e]">
          <LivePreviewEditor
            ref={editorRef}
            file={currentActiveFile}
            files={files}
            allTags={allTags}
            onChange={(newContent) =>
              handleUpdateContent(currentActiveFile.id, newContent)
            }
            onNavigateFile={handleNavigateFile}
            onHoverWikiLink={(target, e) =>
              setHoverPreview({
                targetTitle: target,
                position: { x: e.clientX, y: e.clientY },
              })
            }
            onLeaveWikiLink={() => setHoverPreview(null)}
          />
        </div>
      </div>

      {/* Hover preview floating card */}
      {hoverPreview && (
        <HoverPreview
          file={
            files.find(
              (f) =>
                f.title.toLowerCase() === hoverPreview.targetTitle.toLowerCase() ||
                f.id === hoverPreview.targetTitle
            ) || null
          }
          targetTitle={hoverPreview.targetTitle}
          position={hoverPreview.position}
          onNavigate={handleNavigateFile}
          onClose={() => setHoverPreview(null)}
        />
      )}
    </div>
  );
}


