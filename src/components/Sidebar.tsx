import React from 'react';
import {
  BookOpen,
  Search,
  FolderOpen,
  Sun,
  Moon,
  MessageSquareQuote,
  RefreshCw,
  Bookmark,
  List,
  BarChart3,
  ArrowLeft,
  Waypoints,
  Sparkles,
  Palette,
  X,
  Plus,
  Settings
} from 'lucide-react';
import { ColorSemanticConfig, HighlightColor, BookItem } from '../../electron/types/ipc';
import appIcon from '../assets/icon.png';

export type NavTab = 'books' | 'search' | 'starred_notes' | 'insights' | 'tags' | 'graph';

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
  pinnedBookIds?: string[];
  onTogglePinBook?: (assetId: string) => void;
  onBatchPinBooks?: (assetIds: string[]) => void;
  selectedBook?: BookItem | null;
  onSelectBook?: (book: BookItem) => void;
  chapters?: (string | { title: string; notesCount: number })[];
  onSelectChapter?: (chapter: string) => void;
  activeChapter?: string | null;
  onlyChaptersWithNotes?: boolean;
  onToggleChaptersFilter?: () => void;
  onRefreshData?: () => void;
  isRefreshing?: boolean;
  isDemoMode?: boolean;
  onToggleDemoMode?: () => void;
  onOpenColorSettings?: () => void;
  onOpenSettings?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  tags,
  selectedTag,
  isDarkMode,
  onToggleDarkMode,
  onSelectCustomDir,
  books = [],
  pinnedBookIds = [],
  onTogglePinBook,
  onBatchPinBooks,
  selectedBook = null,
  onSelectBook,
  chapters = [],
  onSelectChapter,
  activeChapter = null,
  onlyChaptersWithNotes = false,
  onToggleChaptersFilter,
  onRefreshData,
  isRefreshing = false,
  isDemoMode = false,
  onToggleDemoMode,
  onOpenColorSettings,
  onOpenSettings
}) => {
  // 用户手动标记的重点书单（支持在书架、书页及侧边栏增删）
  const pinnedSet = new Set(pinnedBookIds);
  const pinnedBooks = books
    .filter(b => pinnedSet.has(b.assetId))
    .sort((a, b) => (b.highlightsCount || 0) - (a.highlightsCount || 0));

  // 有笔记的书籍（仅用于引导快捷导入，不擅自替用户设为重点）
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
        {/* macOS Traffic Lights 占位与窗口拖拽区 */}
        <div className="h-6 -mt-4 pt-4 -mx-4 px-4 app-drag"></div>

        {/* 软件标题（支持按住拖拽窗口） */}
        <div className="px-2 app-drag flex items-center gap-2.5">
          <img src={appIcon} alt="BookEcho" className="w-8 h-8 rounded-lg shadow-xs flex-shrink-0" />
          <div className="min-w-0">
            <h1 className="font-serif text-xl font-bold tracking-wide text-paper-text dark:text-night-text leading-tight">BookEcho</h1>
            <p className="text-xs text-paper-muted dark:text-night-muted mt-0.5">个人读书精华馆</p>
          </div>
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
              onClick={() => onSelectTab('graph')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                currentTab === 'graph' || currentTab === 'tags' || Boolean(selectedTag)
                  ? 'bg-white dark:bg-night-card shadow-sm font-medium text-paper-text dark:text-night-text'
                  : 'text-paper-muted dark:text-night-muted hover:bg-black/5 dark:hover:bg-white/5 hover:text-paper-text dark:hover:text-night-text'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Waypoints className="w-4 h-4 text-amber-500" />
                <span>知识网络</span>
              </span>
              {tags.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-paper-drawer dark:bg-night-drawer text-paper-muted dark:text-night-muted font-mono">
                  {tags.length}
                </span>
              )}
            </button>

            <button
              onClick={() => onSelectTab('insights')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                currentTab === 'insights'
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
        ) : !selectedBook && books.length > 0 ? (
          /* 状态 B: 处于书架等全局视图时，展示用户自选的重点书单 */
          <div>
            <div className="flex items-center justify-between px-3 text-xs font-semibold text-paper-muted dark:text-night-muted uppercase tracking-wider mb-2">
              <div className="flex items-center gap-1.5">
                <Bookmark className="w-3.5 h-3.5 text-paper-terracotta dark:text-night-terracotta" />
                <span>重点笔记书单</span>
              </div>
              {pinnedBooks.length > 0 && (
                <span className="text-[10px] font-mono text-paper-muted/80 dark:text-night-muted/80">
                  {pinnedBooks.length}
                </span>
              )}
            </div>

            {pinnedBooks.length > 0 ? (
              <div className="space-y-0.5">
                {pinnedBooks.map(b => (
                  <div
                    key={b.assetId}
                    className="group flex items-center justify-between px-3 py-1.5 rounded-md text-xs text-paper-muted dark:text-night-muted hover:bg-black/5 dark:hover:bg-white/5 hover:text-paper-text dark:hover:text-night-text transition-colors cursor-pointer"
                    onClick={() => onSelectBook && onSelectBook(b)}
                  >
                    <span className="truncate max-w-[125px] font-serif group-hover:text-paper-terracotta dark:group-hover:text-night-terracotta">
                      {b.title}
                    </span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-paper-drawer dark:bg-night-drawer text-paper-muted dark:text-night-muted font-mono">
                        {b.highlightsCount}
                      </span>
                      {onTogglePinBook && (
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            onTogglePinBook(b.assetId);
                          }}
                          className="hidden group-hover:inline-flex p-0.5 rounded text-paper-muted hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                          title="从重点书单移出"
                          aria-label={`从重点书单移出 ${b.title}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-3 py-2.5 rounded-lg bg-paper-drawer/50 dark:bg-night-drawer/50 border border-dashed border-paper-border/80 dark:border-night-border/80 space-y-2 text-[11px] text-paper-muted dark:text-night-muted">
                <p className="leading-relaxed">
                  暂未选择重点书籍，可在书架卡片或书籍详情页点按书签加入。
                </p>
                {booksWithNotes.length > 0 && onBatchPinBooks && (
                  <button
                    type="button"
                    onClick={() => onBatchPinBooks(booksWithNotes.map(b => b.assetId))}
                    className="w-full flex items-center justify-center gap-1 py-1 px-2 rounded bg-paper-card dark:bg-night-card border border-paper-border dark:border-night-border text-paper-terracotta dark:text-night-terracotta hover:border-paper-terracotta font-medium transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    <span>加入有笔记的 {booksWithNotes.length} 本书</span>
                  </button>
                )}
              </div>
            )}
          </div>
        ) : null}
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

        {onToggleDemoMode && (!onOpenSettings || isDemoMode) && (
          <button
            onClick={onToggleDemoMode}
            className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md text-xs transition-colors ${
              isDemoMode
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium'
                : 'text-paper-muted dark:text-night-muted hover:bg-black/5 dark:hover:bg-white/5'
            }`}
            title="一键加载/退出 6 本经典书籍与 20+ 条跨书互联测试数据"
          >
            <span className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>{isDemoMode ? '切回原生数据' : '体验测试数据'}</span>
            </span>
            {isDemoMode && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-mono">
                DEMO
              </span>
            )}
          </button>
        )}

        {onOpenColorSettings && !onOpenSettings && (
          <button
            onClick={onOpenColorSettings}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-paper-muted dark:text-night-muted hover:bg-black/5 dark:hover:bg-white/5 hover:text-paper-terracotta dark:hover:text-night-terracotta transition-colors"
            title="自定义不同高亮颜色代表的含义与配色"
          >
            <Palette className="w-3.5 h-3.5 text-paper-terracotta/80" />
            <span>颜色语义配置</span>
          </button>
        )}

        {!onOpenSettings && (
          <button
            onClick={onSelectCustomDir}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-paper-muted dark:text-night-muted hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            title="切换数据源路径"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>切换数据目录</span>
          </button>
        )}

        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="w-full flex items-center justify-between px-3 py-1.5 rounded-md text-xs text-paper-muted dark:text-night-muted hover:bg-black/5 dark:hover:bg-white/5 hover:text-paper-terracotta dark:hover:text-night-terracotta transition-colors"
            title="偏好设置 (⌘,)"
          >
            <span className="flex items-center gap-2">
              <Settings className="w-3.5 h-3.5 text-paper-terracotta/80" />
              <span>偏好设置</span>
            </span>
            <kbd className="px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/10 font-mono text-[10px] text-paper-muted/80">
              ⌘,
            </kbd>
          </button>
        )}

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
