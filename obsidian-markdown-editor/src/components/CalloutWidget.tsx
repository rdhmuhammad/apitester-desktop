import React, { useState } from 'react';
import {
  Info,
  AlertTriangle,
  Lightbulb,
  CheckSquare,
  Flame,
  Quote,
  HelpCircle,
  FileText,
  ChevronDown,
  ChevronRight,
  Bug,
  ListTodo,
} from 'lucide-react';

interface CalloutWidgetProps {
  type: string;
  title: string;
  isFoldable?: boolean;
  defaultFolded?: boolean;
  children: React.ReactNode;
}

export const CalloutWidget: React.FC<CalloutWidgetProps> = ({
  type,
  title,
  isFoldable = false,
  defaultFolded = false,
  children,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(defaultFolded);

  // Callout styling configs matching Obsidian's color schemes
  const getCalloutTheme = (t: string) => {
    const norm = t.toLowerCase();
    switch (norm) {
      case 'tip':
      case 'hint':
        return {
          icon: <Lightbulb size={16} className="text-emerald-400" />,
          border: 'border-emerald-500/40',
          bg: 'bg-emerald-950/20',
          titleColor: 'text-emerald-300',
        };
      case 'warning':
      case 'caution':
      case 'attention':
        return {
          icon: <AlertTriangle size={16} className="text-amber-400" />,
          border: 'border-amber-500/40',
          bg: 'bg-amber-950/20',
          titleColor: 'text-amber-300',
        };
      case 'danger':
      case 'error':
        return {
          icon: <Flame size={16} className="text-rose-400" />,
          border: 'border-rose-500/40',
          bg: 'bg-rose-950/20',
          titleColor: 'text-rose-300',
        };
      case 'todo':
        return {
          icon: <ListTodo size={16} className="text-cyan-400" />,
          border: 'border-cyan-500/40',
          bg: 'bg-cyan-950/20',
          titleColor: 'text-cyan-300',
        };
      case 'quote':
      case 'cite':
        return {
          icon: <Quote size={16} className="text-purple-400" />,
          border: 'border-purple-500/40',
          bg: 'bg-purple-950/20',
          titleColor: 'text-purple-300',
        };
      case 'bug':
        return {
          icon: <Bug size={16} className="text-red-400" />,
          border: 'border-red-500/40',
          bg: 'bg-red-950/20',
          titleColor: 'text-red-300',
        };
      case 'success':
      case 'check':
      case 'done':
        return {
          icon: <CheckSquare size={16} className="text-emerald-400" />,
          border: 'border-emerald-500/40',
          bg: 'bg-emerald-950/20',
          titleColor: 'text-emerald-300',
        };
      case 'note':
      case 'info':
      default:
        return {
          icon: <Info size={16} className="text-blue-400" />,
          border: 'border-blue-500/40',
          bg: 'bg-blue-950/20',
          titleColor: 'text-blue-300',
        };
    }
  };

  const theme = getCalloutTheme(type);

  return (
    <div
      className={`my-3 rounded-lg border ${theme.border} ${theme.bg} overflow-hidden transition-all text-sm`}
    >
      <div
        onClick={() => isFoldable && setIsCollapsed(!isCollapsed)}
        className={`flex items-center gap-2 px-3 py-2 ${
          isFoldable ? 'cursor-pointer select-none hover:bg-white/5' : ''
        }`}
      >
        <span className="shrink-0">{theme.icon}</span>
        <span className={`font-semibold ${theme.titleColor} flex-1 tracking-tight`}>
          {title}
        </span>
        {isFoldable && (
          <span className="text-[#888888] hover:text-[#e0e0e0] transition-colors">
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </span>
        )}
      </div>

      {!isCollapsed && (
        <div className="px-3 pb-3 pt-1 text-[#cccccc] leading-relaxed border-t border-white/5">
          {children}
        </div>
      )}
    </div>
  );
};
