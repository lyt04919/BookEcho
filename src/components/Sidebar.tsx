import React from 'react';
import {
  BookOpen,
  Sparkles,
  Search,
  Tag,
  FolderOpen,
  Sun,
  Moon,
  MessageSquareQuote,
  RefreshCw,
  Bookmark,
  List
} from 'lucide-react';
import { ColorSemanticConfig, HighlightColor, BookItem } from '../../electron/types/ipc';

export interface SidebarProps {
  currentTab: 'books' | 'review' | 'search' | 'starred_notes';
  onSelectTab: (tab: 'books' | 'review' | 'search' | 'starred_notes') => void;
  colorSemantics: ColorSemanticConfig[];
  selectedColor: HighlightColor | null;
  onSelectColor: (color: HighlightColor | null) => void;
  tags: string[];
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onSelectCustomDir: () => void;
  // 增强实用扩展（全部向后兼容）
  books?: BookItem[];
  selectedBook?: BookItem | null;
  onSelectBook?: (book: BookItem) => void;
  chapters?: string[];
  onSelectChapter?: (chapter: string) => void;
  onRefreshData?: () => void;
  isRefreshing?: boolean;
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
  onSelectCustomDir,
  books = [],
  selectedBook = null,
  onSelectBook,
  chapters = [],
  onSelectChapter,
  onRefreshData,
  isRefreshing = false
}) => {
  // 重点笔记书籍（划线数大于0的书籍，按笔记数倒序）
  const booksWithNotes = books
    .filter(b => (b.highlightsCount || 0) > 0)
    .sort((a, b) => b.highlightsCount - a.highlightsCount)
    .slice(0, 8);

  return (
    <aside className="w-60 flex-shrink-0 flex flex-col justify-between border-r border-paper-border dark:border-night-border bg-paper-sidebar dark:bg-night-sidebar p-4 select-none">
      <div className="space-y-6">
        {/* [0] macOS Traffic Lights 占位区 */}
        <div className="h-6"></div>

        {/* [1] 软件标题 */}
        <div className="px-2">
          <h1 className="font-serif text-xl font-bold tracking-wide text-paper-text dark:text-night-text">BookEcho</h1>
          <p className="text-xs text-paper-muted dark:text-night-muted mt-0.5">个人读书精华馆</p>
        </div>

        {/* [2] 主导航区 (保持前三个元素顺序 books, review, search 以兼容旧测试数组解构) */}
        <nav className="space-y-1">
          <button
            onClick={() => onSelectTab('books')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
              currentTab === 'books' && !selectedColor && !selectedTag
                ? 'bg-white dark:bg-night-card shadow-sm font-medium text-paper-text dark:text-night-text'
                : 'text-paper-muted dark:text-night-muted hover:bg-black/5 dark:hover:bg-white/5 hover:text-paper-text dark:hover:text-night-text'
            }`}
          >
            <BookOpen className="w-4 h-4 text-paper-terracotta dark:text-night-terracotta" />
            <span>全部书架</span>
          </button>

          <button
            onClick={() => onSelectTab('review')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
              currentTab === 'review'
                ? 'bg-white dark:bg-night-card shadow-sm font-medium text-paper-text dark:text-night-text'
                : 'text-paper-muted dark:text-night-muted hover:bg-black/5 dark:hover:bg-white/5 hover:text-paper-text dark:hover:text-night-text'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>每日回顾</span>
          </button>

          <button
            onClick={() => onSelectTab('search')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
              currentTab === 'search'
                ? 'bg-white dark:bg-night-card shadow-sm font-medium text-paper-text dark:text-night-text'
                : 'text-paper-muted dark:text-night-muted hover:bg-black/5 dark:hover:bg-white/5 hover:text-paper-text dark:hover:text-night-text'
            }`}
          >
            <Search className="w-4 h-4 text-blue-500" />
            <span>全局搜索</span>
          </button>

          <button
            onClick={() => onSelectTab('starred_notes')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
              currentTab === 'starred_notes'
                ? 'bg-white dark:bg-night-card shadow-sm font-medium text-paper-text dark:text-night-text'
                : 'text-paper-muted dark:text-night-muted hover:bg-black/5 dark:hover:bg-white/5 hover:text-paper-text dark:hover:text-night-text'
            }`}
          >
            <MessageSquareQuote className="w-4 h-4 text-purple-500" />
            <span>批注与星标</span>
          </button>
        </nav>

        {/* [3] 色彩语义展示栏（严格保持 children[0] 为标题、children[1] 为列表以兼容测试） */}
        <div>
          <div className="px-3 text-xs font-semibold text-paper-muted dark:text-night-muted uppercase tracking-wider mb-2">
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
                    isSelected
                      ? 'bg-white dark:bg-night-card font-medium text-paper-text dark:text-night-text shadow-sm'
                      : 'text-paper-muted dark:text-night-muted hover:bg-black/5 dark:hover:bg-white/5'
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

        {/* [4] 我的标签树（严格保持作为 topDiv.props.children[4] 以兼容测试） */}
        {tags.length > 0 ? (
          <div>
            <div className="px-3 text-xs font-semibold text-paper-muted dark:text-night-muted uppercase tracking-wider mb-2">
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
                        ? 'bg-paper-terracotta dark:bg-night-terracotta text-white font-medium'
                        : 'bg-white/70 dark:bg-night-drawer text-paper-muted dark:text-night-muted hover:bg-white dark:hover:bg-white/10 hover:text-paper-text dark:hover:text-night-text'
                    }`}
                  >
                    <Tag className="w-3 h-3" />
                    <span>#{t}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* [5] 随动上下文导航区（单书章节目录直达 / 重点笔记书单快捷直达） */}
        {selectedBook && chapters.length > 0 ? (
          <div className="pt-2 border-t border-paper-border/60 dark:border-night-border/60">
            <div className="flex items-center gap-1.5 px-3 text-xs font-semibold text-paper-muted dark:text-night-muted uppercase tracking-wider mb-2">
              <List className="w-3.5 h-3.5" />
              <span>章节目录</span>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-0.5 pr-1">
              {chapters.map(ch => (
                <button
                  key={ch}
                  onClick={() => onSelectChapter && onSelectChapter(ch)}
                  className="w-full text-left truncate px-3 py-1.5 rounded text-xs text-paper-muted dark:text-night-muted hover:bg-black/5 dark:hover:bg-white/5 hover:text-paper-text dark:hover:text-night-text transition-colors"
                  title={ch}
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>
        ) : !selectedBook && booksWithNotes.length > 0 ? (
          <div className="pt-2 border-t border-paper-border/60 dark:border-night-border/60">
            <div className="flex items-center gap-1.5 px-3 text-xs font-semibold text-paper-muted dark:text-night-muted uppercase tracking-wider mb-2">
              <Bookmark className="w-3.5 h-3.5 text-paper-terracotta dark:text-night-terracotta" />
              <span>重点笔记书单</span>
            </div>
            <div className="space-y-0.5 max-h-48 overflow-y-auto pr-1">
              {booksWithNotes.map(b => (
                <button
                  key={b.assetId}
                  onClick={() => onSelectBook && onSelectBook(b)}
                  className="w-full flex items-center justify-between px-3 py-1.5 rounded-md text-xs text-paper-muted dark:text-night-muted hover:bg-black/5 dark:hover:bg-white/5 hover:text-paper-text dark:hover:text-night-text transition-colors group"
                >
                  <span className="truncate max-w-[130px] font-serif group-hover:text-paper-terracotta dark:group-hover:text-night-terracotta">
                    {b.title}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-paper-drawer dark:bg-night-drawer text-paper-muted dark:text-night-muted font-mono">
                    {b.highlightsCount}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* 底部系统操作（保持前两个按钮为 customDirBtn 和 darkModeBtn，兼顾旧测试） */}
      <div className="pt-4 border-t border-paper-border dark:border-night-border space-y-2">
        <button
          onClick={onSelectCustomDir}
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-paper-muted dark:text-night-muted hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          title="切换数据源路径"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span>切换数据目录</span>
        </button>

        <button
          onClick={onToggleDarkMode}
          className="w-full flex items-center justify-between px-3 py-1.5 rounded-md text-xs text-paper-muted dark:text-night-muted hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        >
          <span className="flex items-center gap-2">
            {isDarkMode ? <Sun className="w-3.5 h-3.5 text-amber-500" /> : <Moon className="w-3.5 h-3.5" />}
            <span>{isDarkMode ? '浅色模式' : '深色夜读'}</span>
          </span>
        </button>

        {onRefreshData && (
          <button
            onClick={onRefreshData}
            disabled={isRefreshing}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-paper-terracotta dark:text-night-terracotta hover:bg-paper-terracotta/10 dark:hover:bg-night-terracotta/10 transition-colors"
            title="重新同步 Apple Books 最新划线与批注"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? '同步中...' : '同步最新笔记'}</span>
          </button>
        )}
      </div>
    </aside>
  );
};
