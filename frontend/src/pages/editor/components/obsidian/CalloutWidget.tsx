import React, { useState } from 'react';
import {
  Info,
  AlertTriangle,
  Lightbulb,
  CheckSquare,
  Flame,
  Quote,
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

  // Callout styling configs matching Obsidian semantics adapted to Apitester light/dark mode
  const getCalloutTheme = (t: string) => {
    const norm = t.toLowerCase();
    switch (norm) {
      case 'tip':
      case 'hint':
        return {
          icon: <Lightbulb size={16} className="text-emerald-600 dark:text-emerald-400" />,
          border: 'border-emerald-300 dark:border-emerald-500/40',
          bg: 'bg-emerald-50/60 dark:bg-emerald-950/20',
          titleColor: 'text-emerald-800 dark:text-emerald-300',
        };
      case 'warning':
      case 'caution':
      case 'attention':
        return {
          icon: <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400" />,
          border: 'border-amber-300 dark:border-amber-500/40',
          bg: 'bg-amber-50/60 dark:bg-amber-950/20',
          titleColor: 'text-amber-800 dark:text-amber-300',
        };
      case 'danger':
      case 'error':
        return {
          icon: <Flame size={16} className="text-rose-600 dark:text-rose-400" />,
          border: 'border-rose-300 dark:border-rose-500/40',
          bg: 'bg-rose-50/60 dark:bg-rose-950/20',
          titleColor: 'text-rose-800 dark:text-rose-300',
        };
      case 'todo':
        return {
          icon: <ListTodo size={16} className="text-cyan-600 dark:text-cyan-400" />,
          border: 'border-cyan-300 dark:border-cyan-500/40',
          bg: 'bg-cyan-50/60 dark:bg-cyan-950/20',
          titleColor: 'text-cyan-800 dark:text-cyan-300',
        };
      case 'quote':
      case 'cite':
        return {
          icon: <Quote size={16} className="text-purple-600 dark:text-purple-400" />,
          border: 'border-purple-300 dark:border-purple-500/40',
          bg: 'bg-purple-50/60 dark:bg-purple-950/20',
          titleColor: 'text-purple-800 dark:text-purple-300',
        };
      case 'bug':
        return {
          icon: <Bug size={16} className="text-red-600 dark:text-red-400" />,
          border: 'border-red-300 dark:border-red-500/40',
          bg: 'bg-red-50/60 dark:bg-red-950/20',
          titleColor: 'text-red-800 dark:text-red-300',
        };
      case 'success':
      case 'check':
      case 'done':
        return {
          icon: <CheckSquare size={16} className="text-emerald-600 dark:text-emerald-400" />,
          border: 'border-emerald-300 dark:border-emerald-500/40',
          bg: 'bg-emerald-50/60 dark:bg-emerald-950/20',
          titleColor: 'text-emerald-800 dark:text-emerald-300',
        };
      case 'note':
      case 'info':
      default:
        return {
          icon: <Info size={16} className="text-blue-600 dark:text-blue-400" />,
          border: 'border-blue-300 dark:border-blue-500/40',
          bg: 'bg-blue-50/60 dark:bg-blue-950/20',
          titleColor: 'text-blue-800 dark:text-blue-300',
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
          isFoldable ? 'cursor-pointer select-none hover:bg-muted/40' : ''
        }`}
      >
        <span className="shrink-0">{theme.icon}</span>
        <span className={`font-semibold ${theme.titleColor} flex-1 tracking-tight`}>
          {title}
        </span>
        {isFoldable && (
          <span className="text-muted-foreground hover:text-foreground transition-colors">
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </span>
        )}
      </div>

      {!isCollapsed && (
        <div className="px-3 pb-3 pt-1 text-foreground/90 dark:text-[#cccccc] leading-relaxed border-t border-border/50">
          {children}
        </div>
      )}
    </div>
  );
};
