import React from 'react';
import { BookOpen, Sparkles, Search, Tag, FolderOpen, Sun, Moon } from 'lucide-react';
import { ColorSemanticConfig, HighlightColor } from '../../electron/types/ipc';

export interface SidebarProps {
  currentTab: 'books' | 'review' | 'search';
  onSelectTab: (tab: 'books' | 'review' | 'search') => void;
  colorSemantics: ColorSemanticConfig[];
  selectedColor: HighlightColor | null;
  onSelectColor: (color: HighlightColor | null) => void;
  tags: string[];
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onSelectCustomDir: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  colorSemantics,
  selectedColor,
  onSelectColor,
  tags,
  selectedTag,
  onSelectTag,
  isDarkMode,
  onToggleDarkMode,
  onSelectCustomDir
}) => {
  return (
    <aside className="w-60 flex-shrink-0 flex flex-col justify-between border-r border-paper-border bg-paper-sidebar p-4 select-none">
      <div className="space-y-6">
        {/* macOS Traffic Lights 占位区 */}
        <div className="h-6"></div>

        {/* 软件标题 */}
        <div className="px-2">
          <h1 className="font-serif text-xl font-bold tracking-wide text-paper-text">BookEcho</h1>
          <p className="text-xs text-paper-muted mt-0.5">个人读书精华馆</p>
        </div>

        {/* 主导航区 */}
        <nav className="space-y-1">
          <button
            onClick={() => onSelectTab('books')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
              currentTab === 'books' && !selectedColor && !selectedTag
                ? 'bg-white shadow-sm font-medium text-paper-text'
                : 'text-paper-muted hover:bg-black/5 hover:text-paper-text'
            }`}
          >
            <BookOpen className="w-4 h-4 text-paper-terracotta" />
            <span>全部书架</span>
          </button>

          <button
            onClick={() => onSelectTab('review')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
              currentTab === 'review'
                ? 'bg-white shadow-sm font-medium text-paper-text'
                : 'text-paper-muted hover:bg-black/5 hover:text-paper-text'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>每日回顾</span>
          </button>

          <button
            onClick={() => onSelectTab('search')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
              currentTab === 'search'
                ? 'bg-white shadow-sm font-medium text-paper-text'
                : 'text-paper-muted hover:bg-black/5 hover:text-paper-text'
            }`}
          >
            <Search className="w-4 h-4 text-blue-500" />
            <span>全局搜索</span>
          </button>
        </nav>

        {/* 色彩语义快速过滤 */}
        <div>
          <div className="px-3 text-xs font-semibold text-paper-muted uppercase tracking-wider mb-2">
            色彩语义
          </div>
          <div className="space-y-0.5">
            {colorSemantics.map(s => {
              const isSelected = selectedColor === s.colorKey;
              return (
                <button
                  key={s.colorKey}
                  onClick={() => onSelectColor(isSelected ? null : s.colorKey)}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md text-xs transition-colors ${
                    isSelected ? 'bg-white font-medium text-paper-text shadow-sm' : 'text-paper-muted hover:bg-black/5'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: s.hexColor }}
                    />
                    <span>{s.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 我的标签树 */}
        {tags.length > 0 && (
          <div>
            <div className="px-3 text-xs font-semibold text-paper-muted uppercase tracking-wider mb-2">
              标签
            </div>
            <div className="flex flex-wrap gap-1.5 px-2">
              {tags.map(t => {
                const isSelected = selectedTag === t;
                return (
                  <button
                    key={t}
                    onClick={() => onSelectTag(isSelected ? null : t)}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                      isSelected
                        ? 'bg-paper-terracotta text-white font-medium'
                        : 'bg-white/70 text-paper-muted hover:bg-white hover:text-paper-text'
                    }`}
                  >
                    <Tag className="w-3 h-3" />
                    <span>#{t}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 底部系统操作 */}
      <div className="pt-4 border-t border-paper-border space-y-2">
        <button
          onClick={onSelectCustomDir}
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-paper-muted hover:bg-black/5"
          title="切换数据源路径"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span>切换数据目录</span>
        </button>

        <button
          onClick={onToggleDarkMode}
          className="w-full flex items-center justify-between px-3 py-1.5 rounded-md text-xs text-paper-muted hover:bg-black/5"
        >
          <span className="flex items-center gap-2">
            {isDarkMode ? <Sun className="w-3.5 h-3.5 text-amber-500" /> : <Moon className="w-3.5 h-3.5" />}
            <span>{isDarkMode ? '浅色模式' : '深色夜读'}</span>
          </span>
        </button>
      </div>
    </aside>
  );
};
