import React, { useState, useEffect } from 'react';
import { AnnotationItem, ColorSemanticConfig } from '../../electron/types/ipc';
import { Sparkles, Check, RotateCcw, ChevronRight, BookOpen, Star } from 'lucide-react';

export interface DailyReviewViewProps {
  queue: AnnotationItem[];
  colorSemantics: ColorSemanticConfig[];
  onSubmitResult: (uuid: string, result: 'remembered' | 'mastered' | 'reset') => void;
  onRefreshQueue: () => void;
}

export function handleReviewKeyDown(
  e: { key: string; target?: EventTarget | null; preventDefault?: () => void },
  currentItem: AnnotationItem | undefined,
  onAction: (result: 'remembered' | 'mastered' | 'reset') => void
): boolean {
  const target = e.target as { tagName?: string } | null | undefined;
  const tagName = target?.tagName?.toUpperCase();
  if (tagName === 'INPUT' || tagName === 'TEXTAREA') {
    return false;
  }
  if (!currentItem) return false;
  if (e.key === 'ArrowRight' || e.key === ' ') {
    e.preventDefault?.();
    onAction('remembered');
    return true;
  } else if (e.key === 'Enter') {
    e.preventDefault?.();
    onAction('mastered');
    return true;
  }
  return false;
}

export const DailyReviewView: React.FC<DailyReviewViewProps> = ({
  queue,
  colorSemantics,
  onSubmitResult,
  onRefreshQueue
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const currentItem = queue[currentIndex];

  const handleAction = (result: 'remembered' | 'mastered' | 'reset') => {
    if (!currentItem) return;
    onSubmitResult(currentItem.uuid, result);
    if (currentIndex < queue.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setCurrentIndex(queue.length);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      handleReviewKeyDown(e, currentItem, handleAction);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [currentIndex, currentItem, queue.length]);

  if (!currentItem || currentIndex >= queue.length) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-paper-bg dark:bg-night-bg text-center">
        <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 mb-4">
          <Sparkles className="w-8 h-8" />
        </div>
        <h2 className="font-serif text-2xl font-bold text-paper-text dark:text-night-text mb-2">
          今日回顾已达成！
        </h2>
        <p className="text-sm text-paper-muted dark:text-night-muted max-w-sm mb-6">
          温故而知新。你已经完成今天全部读书高亮漫游，这些思考已深深印入知识体系中。
        </p>
        <button
          onClick={() => {
            setCurrentIndex(0);
            onRefreshQueue();
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-paper-terracotta dark:bg-night-terracotta text-white text-sm font-medium shadow-sm hover:opacity-95 transition-opacity"
        >
          <RotateCcw className="w-4 h-4" />
          <span>换一批再次漫游</span>
        </button>
      </div>
    );
  }

  const semantic = colorSemantics.find(s => s.colorKey === currentItem.colorKey);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-paper-bg dark:bg-night-bg">
      {/* 进度计数器 */}
      <div className="w-full max-w-xl flex items-center justify-between text-xs text-paper-muted dark:text-night-muted mb-4">
        <span className="flex items-center gap-1 font-medium">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>每日漫游 · 专注模式</span>
        </span>
        <span data-testid="review-progress">{currentIndex + 1} / {queue.length}</span>
      </div>

      {/* 沉浸式单卡 */}
      <div className="w-full max-w-xl bg-paper-card dark:bg-night-card border border-paper-border dark:border-night-border rounded-2xl p-8 shadow-sm relative overflow-hidden transition-colors">
        <div
          data-testid="color-accent-stripe"
          className="absolute top-0 left-0 right-0 h-1.5"
          style={{ backgroundColor: semantic?.hexColor || '#F5A623' }}
        />

        <div className="flex items-center justify-between text-xs text-paper-muted dark:text-night-muted mb-4">
          <div className="flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-paper-terracotta dark:text-night-terracotta" />
            <span className="font-medium text-paper-text dark:text-night-text">
              {currentItem.bookTitle || '未知书籍'}
            </span>
            <span>·</span>
            <span>{currentItem.chapterTitle || '默认章节'}</span>
          </div>
          {currentItem.isStarred && (
            <Star className="w-4 h-4 text-amber-500" fill="currentColor" data-testid="starred-icon" />
          )}
        </div>

        <blockquote className="font-serif text-lg leading-relaxed text-paper-text dark:text-night-text tracking-wide mb-6">
          “{currentItem.selectedText}”
        </blockquote>

        {currentItem.note && (
          <div
            data-testid="native-note-block"
            className="mb-4 p-3 rounded-lg bg-paper-drawer dark:bg-night-drawer text-xs text-paper-text/90 dark:text-night-text/90"
          >
            <span className="font-semibold text-paper-muted dark:text-night-muted mr-1">划线想法：</span>
            {currentItem.note}
          </div>
        )}

        {currentItem.customNote && (
          <div
            data-testid="custom-note-block"
            className="mb-4 text-xs text-paper-muted dark:text-night-muted"
          >
            <span className="font-semibold text-paper-terracotta dark:text-night-terracotta mr-1">延伸思考：</span>
            {currentItem.customNote}
          </div>
        )}

        {/* 快捷操作栏 */}
        <div className="flex items-center justify-between pt-6 border-t border-paper-border/60 dark:border-night-border/60">
          <span className="text-[11px] text-paper-muted dark:text-night-muted">
            按 <kbd className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 dark:text-night-text font-mono">空格</kbd> 下一条，<kbd className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 dark:text-night-text font-mono">Enter</kbd> 标为内化
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleAction('mastered')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-paper-border dark:border-night-border text-xs text-paper-muted dark:text-night-muted hover:text-green-600 dark:hover:text-green-400 hover:border-green-600/40 dark:hover:border-green-400/40 transition-colors"
              title="已彻底掌握，减少漫游频率"
              aria-label="已内化"
            >
              <Check className="w-3.5 h-3.5" />
              <span>已内化</span>
            </button>

            <button
              onClick={() => handleAction('remembered')}
              className="flex items-center gap-1 px-4 py-1.5 rounded-lg bg-paper-terracotta dark:bg-night-terracotta text-white text-xs font-medium hover:opacity-95 shadow-sm transition-opacity"
              aria-label="有启发"
            >
              <span>有启发</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
