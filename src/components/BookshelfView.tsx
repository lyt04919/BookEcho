import React, { useState } from 'react';
import {
  BookItem,
  AnnotationItem,
  ColorSemanticConfig,
  HighlightColor,
  HighlightContextResult
} from '../../electron/types/ipc';
import {
  Book,
  Highlighter,
  Clock,
  ArrowUpDown,
  Bookmark,
  Library
} from 'lucide-react';

export interface BookshelfViewProps {
  books: BookItem[];
  onSelectBook: (book: BookItem) => void;
  defaultSortBy?: 'recent' | 'highlights' | 'title';
  pinnedBookIds?: string[];
  onTogglePinBook?: (assetId: string) => void;
  selectedColor?: HighlightColor | null;
  selectedTag?: string | null;
  colorSemantics?: ColorSemanticConfig[];
  matchingAnnotations?: AnnotationItem[];
  filteredCountMap?: Record<string, number>;
  onClearFilter?: () => void;
  onToggleStar?: (uuid: string) => void;
  onUpdateCustomNote?: (uuid: string, note: string) => void;
  onAddTag?: (uuid: string, tag: string) => void;
  onRemoveTag?: (uuid: string, tag: string) => void;
  onOpenQuoteModal?: (annotation: AnnotationItem) => void;
  onRequestContext?: (annotation: AnnotationItem) => Promise<HighlightContextResult>;
}

export const BookshelfView: React.FC<BookshelfViewProps> = ({
  books,
  onSelectBook,
  defaultSortBy = 'recent',
  pinnedBookIds = [],
  onTogglePinBook
}) => {
  const [sortBy, setSortBy] = useState<'recent' | 'highlights' | 'title'>(defaultSortBy);
  const [filterMode, setFilterMode] = useState<'all' | 'has_notes' | 'pinned'>('all');

  // 计算有笔记的书籍、重点书单与总高亮数
  const pinnedSet = new Set(pinnedBookIds);
  const pinnedBooks = books.filter(b => pinnedSet.has(b.assetId));
  const booksWithNotes = books.filter(b => (b.highlightsCount || 0) > 0);
  const totalHighlights = books.reduce((acc, b) => acc + (b.highlightsCount || 0), 0);

  // 根据当前过滤器获取目标书籍
  const displayBooks =
    filterMode === 'has_notes'
      ? booksWithNotes
      : filterMode === 'pinned'
      ? pinnedBooks
      : books;

  // 排序
  const sortedBooks = [...displayBooks].sort((a, b) => {
    if (sortBy === 'highlights') {
      return b.highlightsCount - a.highlightsCount;
    }
    if (sortBy === 'title') return a.title.localeCompare(b.title, 'zh-CN');
    return (b.lastOpenDateMs || 0) - (a.lastOpenDateMs || 0);
  });

  const renderBookCard = (book: BookItem) => {
    const isPinned = pinnedSet.has(book.assetId);
    const progressPercent =
      typeof book.readingProgress === 'number' && book.readingProgress > 0
        ? Math.min(100, Math.round(book.readingProgress <= 1 ? book.readingProgress * 100 : book.readingProgress))
        : 0;

    return (
      <div
        key={book.assetId}
        data-testid={`book-card-${book.assetId}`}
        onClick={() => onSelectBook(book)}
        className="group cursor-pointer flex flex-col bg-paper-card dark:bg-night-card border border-paper-border dark:border-night-border rounded-xl p-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-md hover:border-paper-terracotta/40 dark:hover:border-night-terracotta/40"
      >
        {/* 封面拟真区域 */}
        <div className="aspect-[3/4] w-full rounded-lg bg-paper-drawer dark:bg-night-drawer border border-paper-border/60 dark:border-night-border flex items-center justify-center overflow-hidden mb-3 relative group-hover:border-paper-terracotta/40 dark:group-hover:border-night-terracotta/40 transition-colors">
          {book.coverUrl ? (
            <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
          ) : (
            <div className="p-4 text-center">
              <Book className="w-8 h-8 mx-auto text-paper-muted/60 dark:text-night-muted/60 mb-2" />
              <span className="font-serif text-xs font-semibold text-paper-text dark:text-night-text line-clamp-3">
                {book.title}
              </span>
            </div>
          )}

          {/* 右上角：加入/移出重点书单书签按钮 */}
          {onTogglePinBook && (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                onTogglePinBook(book.assetId);
              }}
              className={`absolute top-2 right-2 p-1.5 rounded-full backdrop-blur-sm transition-all ${
                isPinned
                  ? 'bg-paper-terracotta dark:bg-night-terracotta text-white shadow-sm opacity-100'
                  : 'bg-black/45 text-white/85 opacity-0 group-hover:opacity-100 hover:bg-paper-terracotta hover:text-white'
              }`}
              title={isPinned ? '从重点书单移出' : '加入重点书单'}
              aria-label={isPinned ? `从重点书单移出 ${book.title}` : `将 ${book.title} 加入重点书单`}
            >
              <Bookmark className="w-3.5 h-3.5" fill={isPinned ? 'currentColor' : 'none'} />
            </button>
          )}

          {/* 划线数量标签 */}
          <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm text-white px-2 py-0.5 rounded text-[11px]">
            <Highlighter className="w-3 h-3 text-amber-400" />
            <span>{book.highlightsCount}</span>
          </div>

          {/* 阅读进度条 (封面底部) */}
          {progressPercent > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20 overflow-hidden">
              <div
                className="h-full bg-paper-terracotta dark:bg-night-terracotta transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}
        </div>

        {/* 书籍信息 */}
        <h3 className="font-serif text-sm font-bold text-paper-text dark:text-night-text line-clamp-1 group-hover:text-paper-terracotta dark:group-hover:text-night-terracotta transition-colors">
          {book.title}
        </h3>
        <p className="text-xs text-paper-muted dark:text-night-muted line-clamp-1 mt-0.5">
          {book.author || '未知作者'}
        </p>

        {(book.lastOpenDateMs || progressPercent > 0) && (
          <div className="flex items-center justify-between text-[11px] text-paper-muted/80 dark:text-night-muted/80 mt-2 pt-2 border-t border-paper-border/40 dark:border-night-border/40">
            {book.lastOpenDateMs ? (
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{new Date(book.lastOpenDateMs).toLocaleDateString('zh-CN')}</span>
              </div>
            ) : (
              <span />
            )}
            {progressPercent > 0 && (
              <span className="text-[10px] font-mono text-paper-muted dark:text-night-muted font-medium">
                {progressPercent}%
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-paper-bg dark:bg-night-bg text-paper-text dark:text-night-text">
      {/* 顶部统计横幅 */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between pb-6 border-b border-paper-border dark:border-night-border mb-8 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-serif font-bold text-paper-text dark:text-night-text">我的书库</h2>
            {/* 书架范围快捷筛选胶囊 */}
            <div className="flex items-center bg-paper-drawer dark:bg-night-drawer p-0.5 rounded-lg border border-paper-border/60 dark:border-night-border text-xs">
              <button
                data-testid="filter-all-books"
                onClick={() => setFilterMode('all')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${
                  filterMode === 'all'
                    ? 'bg-white dark:bg-night-card font-medium text-paper-text dark:text-night-text shadow-xs'
                    : 'text-paper-muted dark:text-night-muted hover:text-paper-text dark:hover:text-night-text'
                }`}
              >
                <Library className="w-3.5 h-3.5" />
                <span>全部藏书 ({books.length})</span>
              </button>
              <button
                data-testid="filter-notes-books"
                onClick={() => setFilterMode('has_notes')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${
                  filterMode === 'has_notes'
                    ? 'bg-white dark:bg-night-card font-medium text-paper-text dark:text-night-text shadow-xs'
                    : 'text-paper-muted dark:text-night-muted hover:text-paper-text dark:hover:text-night-text'
                }`}
              >
                <Highlighter className="w-3.5 h-3.5 text-amber-500" />
                <span>有笔记的书 ({booksWithNotes.length})</span>
              </button>
              {onTogglePinBook && (
                <button
                  data-testid="filter-pinned-books"
                  onClick={() => setFilterMode('pinned')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${
                    filterMode === 'pinned'
                      ? 'bg-white dark:bg-night-card font-medium text-paper-text dark:text-night-text shadow-xs'
                      : 'text-paper-muted dark:text-night-muted hover:text-paper-text dark:hover:text-night-text'
                  }`}
                >
                  <Bookmark className="w-3.5 h-3.5 text-paper-terracotta dark:text-night-terracotta" />
                  <span>重点书单 ({pinnedBooks.length})</span>
                </button>
              )}
            </div>
          </div>
          <p className="text-sm text-paper-muted dark:text-night-muted mt-1.5">
            共收录 {books.length} 本书 · 累计 {totalHighlights} 条高亮与思考
          </p>
        </div>

        {/* 排序切换 */}
        <div className="flex items-center gap-2 text-xs text-paper-muted dark:text-night-muted">
          <ArrowUpDown className="w-3.5 h-3.5" />
          <span>排序方式:</span>
          <button
            onClick={() => setSortBy('recent')}
            className={`px-2.5 py-1 rounded transition-colors ${
              sortBy === 'recent'
                ? 'bg-white dark:bg-night-card text-paper-text dark:text-night-text font-medium shadow-sm border border-paper-border/60 dark:border-night-border'
                : 'hover:text-paper-text dark:hover:text-night-text hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            最近阅读
          </button>
          <button
            onClick={() => setSortBy('highlights')}
            className={`px-2.5 py-1 rounded transition-colors ${
              sortBy === 'highlights'
                ? 'bg-white dark:bg-night-card text-paper-text dark:text-night-text font-medium shadow-sm border border-paper-border/60 dark:border-night-border'
                : 'hover:text-paper-text dark:hover:text-night-text hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            笔记数量
          </button>
          <button
            onClick={() => setSortBy('title')}
            className={`px-2.5 py-1 rounded transition-colors ${
              sortBy === 'title'
                ? 'bg-white dark:bg-night-card text-paper-text dark:text-night-text font-medium shadow-sm border border-paper-border/60 dark:border-night-border'
                : 'hover:text-paper-text dark:hover:text-night-text hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            书名
          </button>
        </div>
      </div>

      {/* 书籍网格与空状态 */}
      {sortedBooks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Book className="w-12 h-12 text-paper-muted/40 dark:text-night-muted/40 mb-3" />
          <p className="text-base font-serif font-medium text-paper-text dark:text-night-text">
            {filterMode === 'has_notes' ? '暂无包含笔记的书籍' : '暂无书籍'}
          </p>
          <p className="text-xs text-paper-muted dark:text-night-muted mt-1">
            {filterMode === 'has_notes'
              ? '可切换回“全部藏书”查看所有书籍'
              : '请在 Apple Books 中阅读并添加高亮，或检查数据源目录'}
          </p>
          {filterMode === 'has_notes' && (
            <button
              onClick={() => setFilterMode('all')}
              className="mt-4 px-3.5 py-1.5 rounded-lg bg-paper-terracotta dark:bg-night-terracotta text-white text-xs font-medium shadow-sm"
            >
              查看全部藏书 ({books.length})
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {sortedBooks.map(renderBookCard)}
        </div>
      )}
    </div>
  );
};
