import React, { useState } from 'react';
import { Copy, Check, Terminal } from 'lucide-react';

interface CodeBlockWidgetProps {
  language: string;
  code: string;
}

export const CodeBlockWidget: React.FC<CodeBlockWidgetProps> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Light syntax highlighting simulation for keywords, strings, numbers, and comments
  const highlightCode = (rawCode: string) => {
    return rawCode.split('\n').map((line, idx) => {
      // Check for comments
      if (line.trim().startsWith('//') || line.trim().startsWith('#')) {
        return (
          <div key={idx} className="text-[#6a9955] italic">
            {line}
          </div>
        );
      }

      // Tokenize line simply
      const parts = line.split(/(\b(?:const|let|var|function|return|import|export|from|type|interface|class|if|else|for|while|true|false|null|async|await|package|func|def)\b|"[^"]*"|'[^']*'|`[^`]*`|\d+)/g);

      return (
        <div key={idx} className="table-row">
          <span className="table-cell pr-4 select-none text-[#555555] text-right font-mono text-[11px] w-8">
            {idx + 1}
          </span>
          <span className="table-cell">
            {parts.map((part, pIdx) => {
              if (
                /^(const|let|var|function|return|import|export|from|type|interface|class|if|else|for|while|async|await|package|func|def)$/.test(
                  part
                )
              ) {
                return (
                  <span key={pIdx} className="text-[#c586c0] font-semibold">
                    {part}
                  </span>
                );
              }
              if (/^(true|false|null)$/.test(part)) {
                return (
                  <span key={pIdx} className="text-[#569cd6] font-semibold">
                    {part}
                  </span>
                );
              }
              if (/^["'`].*["'`]$/.test(part)) {
                return (
                  <span key={pIdx} className="text-[#ce9178]">
                    {part}
                  </span>
                );
              }
              if (/^\d+$/.test(part)) {
                return (
                  <span key={pIdx} className="text-[#b5cea8]">
                    {part}
                  </span>
                );
              }
              return <span key={pIdx}>{part}</span>;
            })}
          </span>
        </div>
      );
    });
  };

  return (
    <div className="my-4 rounded-lg border border-[#333333] bg-[#1a1a1a] overflow-hidden text-xs shadow-md">
      {/* Code Header Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#242424] border-b border-[#333333] select-none text-[#a0a0a0]">
        <div className="flex items-center gap-2">
          <Terminal size={12} className="text-purple-400" />
          <span className="font-mono text-[11px] uppercase tracking-wider text-[#cccccc]">
            {language || 'plaintext'}
          </span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] text-[#aaaaaa] hover:text-white hover:bg-[#333333] transition-colors"
        >
          {copied ? (
            <>
              <Check size={12} className="text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy size={12} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Content */}
      <div className="p-3 overflow-x-auto font-mono text-[12px] leading-relaxed text-[#d4d4d4]">
        <div className="table w-full">{highlightCode(code)}</div>
      </div>
    </div>
  );
};
