import React, { useState, useMemo, useEffect } from 'react';
import { BookItem } from '../../electron/types/ipc';
import {
  X,
  Search,
  Check,
  Eye,
  EyeOff,
  Book,
  Highlighter,
  Sparkles,
  CheckSquare,
  Square
} from 'lucide-react';

export interface BookshelfVisibilityModalProps {
  books: BookItem[];
  hiddenBookIds: string[];
  onSave: (nextHiddenIds: string[]) => void;
  onClose: () => void;
}

export const BookshelfVisibilityModal: React.FC<BookshelfVisibilityModalProps> = ({
  books,
  hiddenBookIds,
  onSave,
  onClose
}) => {
  const [hiddenDraft, setHiddenDraft] = useState<Set<string>>(() => new Set(hiddenBookIds));
  const [searchKeyword, setSearchKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'visible' | 'hidden'>('all');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [onClose]);

  const sortedBooks = useMemo(() => {
    return [...books].sort((a, b) => {
      const notesDiff = (b.highlightsCount || 0) - (a.highlightsCount || 0);
      if (notesDiff !== 0) return notesDiff;
      return (b.lastOpenDateMs || 0) - (a.lastOpenDateMs || 0);
    });
  }, [books]);

  const filteredBooks = useMemo(() => {
    const kw = searchKeyword.trim().toLowerCase();
    return sortedBooks.filter(b => {
      const isHidden = hiddenDraft.has(b.assetId);
      if (statusFilter === 'visible' && isHidden) return false;
      if (statusFilter === 'hidden' && !isHidden) return false;
      if (kw) {
        const matchTitle = b.title.toLowerCase().includes(kw);
        const matchAuthor = (b.author || '').toLowerCase().includes(kw);
        return matchTitle || matchAuthor;
      }
      return true;
    });
  }, [sortedBooks, hiddenDraft, searchKeyword, statusFilter]);

  const visibleCount = books.filter(b => !hiddenDraft.has(b.assetId)).length;
  const hiddenCount = books.length - visibleCount;

  const toggleBookVisibility = (assetId: string) => {
    setHiddenDraft(prev => {
      const next = new Set(prev);
      if (next.has(assetId)) {
        next.delete(assetId);
      } else {
        next.add(assetId);
      }
      return next;
    });
  };

  const handleShowAll = () => {
    setHiddenDraft(new Set());
  };

  const handleKeepOnlyWithNotes = () => {
    const next = new Set<string>();
    for (const b of books) {
      if ((b.highlightsCount || 0) <= 0) {
        next.add(b.assetId);
      }
    }
    setHiddenDraft(next);
  };

  const handleHideAll = () => {
    setHiddenDraft(new Set(books.map(b => b.assetId)));
  };

  const handleConfirm = () => {
    onSave(Array.from(hiddenDraft));
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="bookshelf-visibility-modal-title"
      data-testid="bookshelf-visibility-modal"
    >
      <div
        className="bg-paper-card dark:bg-night-card border border-paper-border dark:border-night-border rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden text-paper-text dark:text-night-text animate-in zoom-in-95 duration-150 max-h-[88vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* 头部标题 */}
        <div className="px-6 py-4 border-b border-paper-border dark:border-night-border flex items-center justify-between bg-paper-sidebar/40 dark:bg-night-sidebar/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-paper-terracotta/15 dark:bg-night-terracotta/15 text-paper-terracotta dark:text-night-terracotta flex items-center justify-center">
              <Eye className="w-4 h-4" />
            </div>
            <div>
              <h3 id="bookshelf-visibility-modal-title" className="font-serif text-base font-bold">
                管理书架展示书籍
              </h3>
              <p className="text-xs text-paper-muted dark:text-night-muted">
                自由勾选需要在书架中显示的藏书（隐藏仅作用于展示，不会删除原有笔记与书籍）
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-paper-muted dark:text-night-muted hover:text-paper-text dark:hover:text-night-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            aria-label="关闭书架管理"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 过滤与快捷批操作栏 */}
        <div className="px-6 py-3.5 border-b border-paper-border/70 dark:border-night-border/70 space-y-3 bg-paper-bg/50 dark:bg-night-bg/50">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* 搜索框 */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-paper-muted dark:text-night-muted" />
              <input
                type="text"
                value={searchKeyword}
                onChange={e => setSearchKeyword(e.target.value)}
                placeholder="搜索书名或作者..."
                className="w-full pl-8 pr-8 py-1.5 text-xs rounded-lg border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card text-paper-text dark:text-night-text placeholder:text-paper-muted/70 focus:outline-none focus:ring-1 focus:ring-paper-terracotta dark:focus:ring-night-terracotta"
              />
              {searchKeyword && (
                <button
                  onClick={() => setSearchKeyword('')}
                  className="absolute right-2.5 top-2 text-paper-muted hover:text-paper-text"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* 状态过滤胶囊 */}
            <div className="flex items-center bg-paper-drawer dark:bg-night-drawer p-0.5 rounded-lg border border-paper-border/60 dark:border-night-border text-xs">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-white dark:bg-night-card font-medium text-paper-text dark:text-night-text shadow-2xs'
                    : 'text-paper-muted hover:text-paper-text'
                }`}
              >
                全部 ({books.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('visible')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  statusFilter === 'visible'
                    ? 'bg-white dark:bg-night-card font-medium text-paper-text dark:text-night-text shadow-2xs'
                    : 'text-paper-muted hover:text-paper-text'
                }`}
              >
                展示中 ({visibleCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('hidden')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  statusFilter === 'hidden'
                    ? 'bg-white dark:bg-night-card font-medium text-paper-text dark:text-night-text shadow-2xs'
                    : 'text-paper-muted hover:text-paper-text'
                }`}
              >
                已隐藏 ({hiddenCount})
              </button>
            </div>
          </div>

          {/* 一键批处理 */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-[11px] text-paper-muted dark:text-night-muted mr-1">快捷挑选：</span>
            <button
              type="button"
              onClick={handleShowAll}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card hover:border-paper-terracotta text-paper-text dark:text-night-text transition-colors"
            >
              <CheckSquare className="w-3 h-3 text-emerald-500" />
              <span>全部展示</span>
            </button>
            <button
              type="button"
              onClick={handleKeepOnlyWithNotes}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card hover:border-paper-terracotta text-paper-text dark:text-night-text transition-colors"
            >
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>仅保留有笔记的书</span>
            </button>
            <button
              type="button"
              onClick={handleHideAll}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card hover:border-paper-terracotta text-paper-muted hover:text-paper-text transition-colors"
            >
              <Square className="w-3 h-3" />
              <span>清空勾选（逐本自选）</span>
            </button>
          </div>
        </div>

        {/* 书籍复选清单 */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2">
          {filteredBooks.length === 0 ? (
            <div className="py-12 text-center text-xs text-paper-muted dark:text-night-muted">
              没有符合筛选条件的书籍
            </div>
          ) : (
            filteredBooks.map(book => {
              const isVisible = !hiddenDraft.has(book.assetId);
              return (
                <div
                  key={book.assetId}
                  onClick={() => toggleBookVisibility(book.assetId)}
                  className={`flex items-center justify-between gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${
                    isVisible
                      ? 'border-paper-terracotta/40 dark:border-night-terracotta/40 bg-paper-terracotta/5 dark:bg-night-terracotta/5 hover:border-paper-terracotta'
                      : 'border-paper-border/60 dark:border-night-border/60 bg-paper-drawer/40 dark:bg-night-drawer/40 opacity-65 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* 复选状态方块 */}
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 border transition-colors ${
                        isVisible
                          ? 'bg-paper-terracotta dark:bg-night-terracotta border-paper-terracotta dark:border-night-terracotta text-white'
                          : 'bg-paper-card dark:bg-night-card border-paper-border dark:border-night-border'
                      }`}
                    >
                      {isVisible && <Check className="w-3.5 h-3.5" />}
                    </div>

                    {/* 封面缩略 */}
                    <div className="w-8 h-11 rounded bg-paper-drawer dark:bg-night-drawer border border-paper-border/60 dark:border-night-border overflow-hidden flex items-center justify-center flex-shrink-0">
                      {book.coverUrl ? (
                        <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
                      ) : (
                        <Book className="w-4 h-4 text-paper-muted/60" />
                      )}
                    </div>

                    {/* 书名与作者 */}
                    <div className="min-w-0 flex-1">
                      <div className="font-serif text-xs sm:text-sm font-semibold text-paper-text dark:text-night-text truncate">
                        {book.title}
                      </div>
                      <div className="text-[11px] text-paper-muted dark:text-night-muted truncate">
                        {book.author || '未知作者'}
                      </div>
                    </div>
                  </div>

                  {/* 右侧笔记数与显隐标记 */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {(book.highlightsCount || 0) > 0 && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[11px] font-mono">
                        <Highlighter className="w-3 h-3" />
                        <span>{book.highlightsCount}</span>
                      </span>
                    )}
                    <span
                      className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded ${
                        isVisible
                          ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                          : 'text-paper-muted dark:text-night-muted bg-black/5 dark:bg-white/5'
                      }`}
                    >
                      {isVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      <span>{isVisible ? '显示' : '隐藏'}</span>
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 底部汇总保存栏 */}
        <div className="px-6 py-3.5 border-t border-paper-border dark:border-night-border flex items-center justify-between bg-paper-sidebar/20 dark:bg-night-sidebar/20">
          <span className="text-xs text-paper-muted dark:text-night-muted">
            书架将展示 <strong className="text-paper-text dark:text-night-text">{visibleCount}</strong> / {books.length} 本书籍
            {hiddenCount > 0 ? `（隐藏 ${hiddenCount} 本）` : ''}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-xs text-paper-muted dark:text-night-muted hover:text-paper-text dark:hover:text-night-text transition-colors"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-paper-terracotta dark:bg-night-terracotta text-white text-xs font-medium hover:opacity-90 transition-opacity shadow-2xs"
            >
              <Check className="w-3.5 h-3.5" />
              <span>保存设置</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
