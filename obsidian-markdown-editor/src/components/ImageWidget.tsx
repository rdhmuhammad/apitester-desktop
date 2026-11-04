import React, { useState, useRef, useEffect } from 'react';
import { Image as ImageIcon, Upload, Copy, Check, Code2 } from 'lucide-react';

interface ImageWidgetProps {
  src: string;
  alt: string;
  width: number;
  indentSpaces?: number;
  onUpdateSrc: (newSrc: string) => void;
  onEditSyntax: () => void;
}

export const ImageWidget: React.FC<ImageWidgetProps> = ({
  src,
  alt,
  width,
  indentSpaces = 0,
  onUpdateSrc,
  onEditSyntax,
}) => {
  const [hasError, setHasError] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Reset image load error state whenever src changes
  useEffect(() => {
    setHasError(false);
  }, [src]);

  const isDefaultPlaceholderUrl =
    !src.trim() ||
    src.trim() === 'https://example.com' ||
    src.trim() === 'http://example.com' ||
    src.trim() === 'https://example.com/';

  const showPlaceholder = isDefaultPlaceholderUrl || hasError;
  const displayWidth = width > 0 ? width : 300;

  const handleUploadClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    onUpdateSrc(objectUrl);
    e.target.value = '';
  };

  const handleCopyUrl = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(src).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div
      style={
        indentSpaces > 0 ? { paddingLeft: `${indentSpaces * 12}px` } : undefined
      }
      className="my-2 select-none"
    >
      <div
        onClick={(e) => {
          e.stopPropagation();
          onEditSyntax();
        }}
        style={{ width: `${displayWidth}px`, maxWidth: '100%' }}
        title="Click to edit <img /> syntax"
        className="group/image relative rounded-lg border border-[#383838] bg-[#1e1e1e] overflow-hidden shadow-md hover:border-purple-500/60 transition-all cursor-pointer"
      >
        {/* Hidden file input for Upload button */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          onClick={(e) => e.stopPropagation()}
          className="hidden"
          aria-label="Upload image file"
        />

        {/* Hover Action Buttons: Always shown on hover whether placeholder or custom image */}
        <div
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute top-2 right-2 z-10 flex items-center gap-1.5 opacity-0 group-hover/image:opacity-100 focus-within:opacity-100 transition-opacity duration-150"
        >
          <button
            type="button"
            onClick={handleUploadClick}
            title="Upload image from device"
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#181818]/90 hover:bg-purple-600 text-xs font-medium text-[#e5e5e5] hover:text-white border border-[#444444] hover:border-purple-400 shadow-lg backdrop-blur-sm transition-colors"
          >
            <Upload size={12} />
            <span>Upload</span>
          </button>

          <button
            type="button"
            onClick={handleCopyUrl}
            title={`Copy image URL (${src})`}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#181818]/90 hover:bg-[#2d2d2d] text-xs font-medium text-[#e5e5e5] hover:text-white border border-[#444444] shadow-lg backdrop-blur-sm transition-colors"
          >
            {copied ? (
              <>
                <Check size={12} className="text-emerald-400" />
                <span className="text-emerald-300">Copied!</span>
              </>
            ) : (
              <>
                <Copy size={12} />
                <span>Copy URL</span>
              </>
            )}
          </button>
        </div>

        {/* Image Content or Default Size Placeholder */}
        {showPlaceholder ? (
          <div
            style={{ minHeight: `${Math.round(displayWidth * 0.62)}px` }}
            className="flex flex-col items-center justify-center p-5 text-center bg-gradient-to-br from-[#232329] to-[#1a1a20]"
          >
            <div className="w-11 h-11 rounded-full bg-purple-950/60 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-2.5">
              <ImageIcon size={22} />
            </div>
            <div className="text-xs font-medium text-[#e0e0e0] line-clamp-1">
              {alt || 'Image Placeholder'}
            </div>
            <div className="mt-1 text-[11px] font-mono text-[#888888] truncate max-w-full px-2">
              {src}
            </div>
            <div className="mt-2.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#2a2a32] border border-[#3a3a44] text-[10px] font-mono text-purple-300">
              <span>width: {displayWidth}px</span>
              <span className="text-[#666666]">•</span>
              <span className="inline-flex items-center gap-0.5 text-[#aaaaaa]">
                <Code2 size={10} /> click to edit
              </span>
            </div>
          </div>
        ) : (
          <div className="relative bg-[#141414]">
            <img
              src={src}
              alt={alt}
              width={displayWidth}
              onError={() => setHasError(true)}
              style={{ width: `${displayWidth}px`, maxWidth: '100%' }}
              className="block h-auto object-cover"
            />
            {alt && (
              <div className="px-2.5 py-1 bg-[#1b1b1b] border-t border-[#2d2d2d] flex items-center justify-between text-[11px] text-[#999999]">
                <span className="truncate">{alt}</span>
                <span className="font-mono text-[10px] text-[#666666] shrink-0 ml-2">
                  {displayWidth}px
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
