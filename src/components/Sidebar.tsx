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
  List,
  BarChart3,
  ArrowLeft
} from 'lucide-react';
import { ColorSemanticConfig, HighlightColor, BookItem } from '../../electron/types/ipc';

export type NavTab = 'books' | 'review' | 'search' | 'starred_notes' | 'insights';

export interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  colorSemantics?: ColorSemanticConfig[];
  selectedColor?: HighlightColor | null;
  onSelectColor?: (color: HighlightColor | null) => void;
  tags: string[];
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onSelectCustomDir: () => void;
  books?: BookItem[];
  selectedBook?: BookItem | null;
  onSelectBook?: (book: BookItem) => void;
  chapters?: (string | { title: string; notesCount: number })[];
  onSelectChapter?: (chapter: string) => void;
  activeChapter?: string | null;
  onlyChaptersWithNotes?: boolean;
  onToggleChaptersFilter?: () => void;
  onRefreshData?: () => void;
  isRefreshing?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
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
  activeChapter = null,
  onlyChaptersWithNotes = false,
  onToggleChaptersFilter,
  onRefreshData,
  isRefreshing = false
}) => {
  // 重点笔记书籍（划线数大于0的书籍，按笔记数倒序）
  const booksWithNotes = books
    .filter(b => (b.highlightsCount || 0) > 0)
    .sort((a, b) => b.highlightsCount - a.highlightsCount)
    .slice(0, 10);

  const visibleChapters = onlyChaptersWithNotes
    ? chapters.filter(item => (typeof item === 'string' ? true : item.notesCount > 0))
    : chapters;

  return (
    <aside className="w-60 h-full flex-shrink-0 flex flex-col justify-between border-r border-paper-border dark:border-night-border bg-paper-sidebar dark:bg-night-sidebar p-4 select-none overflow-hidden">
      {/* 1. 顶部固定区域：Traffic Lights + 应用标题 + 主导航 */}
      <div className="flex-shrink-0 space-y-4 mb-4">
        {/* macOS Traffic Lights 占位区 */}
        <div className="h-4"></div>

        {/* 软件标题 */}
        <div className="px-2">
          <h1 className="font-serif text-xl font-bold tracking-wide text-paper-text dark:text-night-text">BookEcho</h1>
          <p className="text-xs text-paper-muted dark:text-night-muted mt-0.5">个人读书精华馆</p>
        </div>

        {/* 主导航区：单书精读模式下仅保留「返回全部书架」，释放侧边栏空间给章节目录 */}
        {selectedBook ? (
          <nav className="space-y-1">
            <button
              onClick={() => onSelectTab('books')}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-white dark:bg-night-card shadow-2xs text-paper-text dark:text-night-text hover:text-paper-terracotta dark:hover:text-night-terracotta transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-paper-terracotta dark:text-night-terracotta" />
              <span>返回全部书架</span>
            </button>
          </nav>
        ) : (
          <nav className="space-y-1">
            <button
              onClick={() => onSelectTab('books')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                currentTab === 'books' && !selectedBook && !selectedTag
                  ? 'bg-white dark:bg-night-card shadow-sm font-medium text-paper-text dark:text-night-text'
                  : 'text-paper-muted dark:text-night-muted hover:bg-black/5 dark:hover:bg-white/5 hover:text-paper-text dark:hover:text-night-text'
              }`}
            >
              <BookOpen className="w-4 h-4 text-paper-terracotta dark:text-night-terracotta" />
              <span>全部书架</span>
            </button>

            <button
              onClick={() => onSelectTab('starred_notes')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                currentTab === 'starred_notes' && !selectedTag
                  ? 'bg-white dark:bg-night-card shadow-sm font-medium text-paper-text dark:text-night-text'
                  : 'text-paper-muted dark:text-night-muted hover:bg-black/5 dark:hover:bg-white/5 hover:text-paper-text dark:hover:text-night-text'
              }`}
            >
              <MessageSquareQuote className="w-4 h-4 text-purple-500" />
              <span>批注与星标</span>
            </button>

            <button
              onClick={() => onSelectTab('review')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                currentTab === 'review' && !selectedTag
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
                currentTab === 'search' && !selectedTag
                  ? 'bg-white dark:bg-night-card shadow-sm font-medium text-paper-text dark:text-night-text'
                  : 'text-paper-muted dark:text-night-muted hover:bg-black/5 dark:hover:bg-white/5 hover:text-paper-text dark:hover:text-night-text'
              }`}
            >
              <Search className="w-4 h-4 text-blue-500" />
              <span>全局搜索</span>
            </button>

            <button
              onClick={() => onSelectTab('insights')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                currentTab === 'insights' && !selectedTag
                  ? 'bg-white dark:bg-night-card shadow-sm font-medium text-paper-text dark:text-night-text'
                  : 'text-paper-muted dark:text-night-muted hover:bg-black/5 dark:hover:bg-white/5 hover:text-paper-text dark:hover:text-night-text'
              }`}
            >
              <BarChart3 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>阅读足迹</span>
            </button>
          </nav>
        )}
      </div>

      {/* 2. 中间自适应独立滚动区：重点笔记书单 / 单书章节目录 / 标签 */}
      <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-1">
        {/* 状态 A: 处于单书精读时，展示本书章节目录导航 */}
        {selectedBook && chapters.length > 0 ? (
          <div>
            <div className="flex items-center justify-between px-3 text-xs font-semibold text-paper-muted dark:text-night-muted uppercase tracking-wider mb-2">
              <div className="flex items-center gap-1.5">
                <List className="w-3.5 h-3.5 text-paper-terracotta dark:text-night-terracotta" />
                <span>章节目录</span>
              </div>
              {onToggleChaptersFilter && (
                <button
                  onClick={onToggleChaptersFilter}
                  className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-paper-drawer dark:bg-night-drawer text-paper-muted dark:text-night-muted hover:text-paper-terracotta dark:hover:text-night-terracotta transition-colors"
                  title="切换显示全部章节或仅显示有笔记的章节"
                >
                  {onlyChaptersWithNotes ? '仅看有笔记' : '全部章节'}
                </button>
              )}
            </div>
            <div className="space-y-0.5">
              {visibleChapters.map(item => {
                const title = typeof item === 'string' ? item : item.title;
                const notesCount = typeof item === 'string' ? 0 : item.notesCount;
                const isActive = activeChapter === title;
                return (
                  <button
                    key={title}
                    onClick={() => onSelectChapter && onSelectChapter(title)}
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded text-xs transition-colors group ${
                      isActive
                        ? 'bg-white dark:bg-night-card text-paper-terracotta dark:text-night-terracotta font-medium shadow-2xs'
                        : 'text-paper-muted dark:text-night-muted hover:bg-black/5 dark:hover:bg-white/5 hover:text-paper-text dark:hover:text-night-text'
                    }`}
                    title={title}
                  >
                    <span className="truncate max-w-[135px] font-serif group-hover:text-paper-terracotta dark:group-hover:text-night-terracotta">
                      {title}
                    </span>
                    {notesCount > 0 && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-paper-drawer dark:bg-night-drawer text-paper-terracotta dark:text-night-terracotta font-mono font-medium">
                        {notesCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ) : !selectedBook && booksWithNotes.length > 0 ? (
          /* 状态 B: 处于书架首页时，展示常读重点笔记书单 */
          <div>
            <div className="flex items-center gap-1.5 px-3 text-xs font-semibold text-paper-muted dark:text-night-muted uppercase tracking-wider mb-2">
              <Bookmark className="w-3.5 h-3.5 text-paper-terracotta dark:text-night-terracotta" />
              <span>重点笔记书单</span>
            </div>
            <div className="space-y-0.5">
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

        {/* 标签树：仅在非单书精读页展示，且即使尚无标签也展示入口提示 */}
        {!selectedBook && (
          <div>
            <div className="flex items-center gap-1.5 px-3 text-xs font-semibold text-paper-muted dark:text-night-muted uppercase tracking-wider mb-2">
              <Tag className="w-3.5 h-3.5 text-paper-terracotta dark:text-night-terracotta" />
              <span>主题标签</span>
            </div>
            {tags.length > 0 ? (
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
            ) : (
              <p className="px-3 text-[11px] leading-relaxed text-paper-muted/70 dark:text-night-muted/70">
                在书籍高亮卡片下方点击「+ 标签」，即可在此按跨书主题归档
              </p>
            )}
          </div>
        )}
      </div>

      {/* 3. 底部固定操作区：永远固定在左下角，绝不溢出被遮挡 */}
      <div className="flex-shrink-0 pt-3 mt-2 border-t border-paper-border dark:border-night-border space-y-1.5">
        {onRefreshData && (
          <button
            onClick={onRefreshData}
            disabled={isRefreshing}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-paper-terracotta dark:text-night-terracotta hover:bg-paper-terracotta/10 dark:hover:bg-night-terracotta/10 transition-colors"
            title="重新同步 Apple Books 最新划线与批注"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? '正在同步数据...' : '同步最新划线'}</span>
          </button>
        )}

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
      </div>
    </aside>
  );
};
