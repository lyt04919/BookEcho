import React from 'react';
import { BookItem, AnnotationItem, ColorSemanticConfig, HighlightContextResult } from '../../electron/types/ipc';
import { HighlightCard } from './HighlightCard';
import { ArrowLeft, ExternalLink, Download } from 'lucide-react';

export interface BookDetailViewProps {
  book: BookItem;
  annotations: AnnotationItem[];
  colorSemantics: ColorSemanticConfig[];
  onBack: () => void;
  onOpenInAppleBooks: (assetId: string, epubPath?: string | null) => void;
  onExportMarkdown: (assetId: string) => void;
  onToggleStar: (uuid: string) => void;
  onUpdateCustomNote: (uuid: string, note: string) => void;
  onAddTag: (uuid: string, tag: string) => void;
  onRemoveTag: (uuid: string, tag: string) => void;
  onOpenQuoteModal: (annotation: AnnotationItem) => void;
  onRequestContext: (annotation: AnnotationItem) => Promise<HighlightContextResult>;
}

export const BookDetailView: React.FC<BookDetailViewProps> = ({
  book,
  annotations,
  colorSemantics,
  onBack,
  onOpenInAppleBooks,
  onExportMarkdown,
  onToggleStar,
  onUpdateCustomNote,
  onAddTag,
  onRemoveTag,
  onOpenQuoteModal,
  onRequestContext
}) => {
  // 按章节分组并保持排序
  const chapterGroups = annotations.reduce((acc, anno) => {
    const chapter = anno.chapterTitle?.trim() || '默认章节';
    if (!acc[chapter]) acc[chapter] = [];
    acc[chapter].push(anno);
    return acc;
  }, {} as Record<string, AnnotationItem[]>);

  // 章节内按 sortIndex 排序
  Object.values(chapterGroups).forEach(list => {
    list.sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));
  });

  return (
    <div className="flex-1 overflow-y-auto bg-paper-bg dark:bg-night-bg text-paper-text dark:text-night-text p-8">
      {/* 顶栏导航 */}
      <div className="flex items-center justify-between pb-6 mb-8 border-b border-paper-border dark:border-night-border">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-paper-muted dark:text-night-muted hover:text-paper-text dark:hover:text-night-text transition-colors"
          aria-label="返回全部书架"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>返回全部书架</span>
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onOpenInAppleBooks(book.assetId, book.epubPath)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card text-xs text-paper-muted dark:text-night-muted hover:text-paper-text dark:hover:text-night-text shadow-sm transition-colors"
            title="在 Apple Books 中阅读"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>在 Apple Books 中阅读</span>
          </button>

          <button
            onClick={() => onExportMarkdown(book.assetId)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-paper-terracotta dark:bg-night-terracotta text-white text-xs font-medium shadow-sm hover:opacity-95 transition-opacity"
            title="导出 Markdown"
          >
            <Download className="w-3.5 h-3.5" />
            <span>导出 Markdown</span>
          </button>
        </div>
      </div>

      {/* 书籍信息横幅 */}
      <div className="flex gap-6 mb-10 pb-8 border-b border-paper-border/60 dark:border-night-border/60">
        <div className="w-24 h-32 rounded-lg bg-paper-card dark:bg-night-card border border-paper-border dark:border-night-border flex-shrink-0 overflow-hidden shadow-sm">
          {book.coverUrl ? (
            <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center font-serif text-center p-2 text-xs font-bold text-paper-muted dark:text-night-muted">
              {book.title}
            </div>
          )}
        </div>

        <div className="flex flex-col justify-center">
          <h1 className="font-serif text-2xl font-bold text-paper-text dark:text-night-text mb-1">{book.title}</h1>
          <p className="text-sm text-paper-muted dark:text-night-muted mb-3">
            {book.author || '未知作者'} · {book.genre || '未分类'}
          </p>
          <p className="text-xs text-paper-muted/80 dark:text-night-muted/80">
            共精选 {annotations.length} 条划线笔记 · 阅读进度 {Math.round((book.readingProgress || 0) * 100)}%
          </p>
        </div>
      </div>

      {/* 章节流式展示 */}
      {annotations.length === 0 ? (
        <div className="text-center py-16 text-paper-muted dark:text-night-muted">
          <p className="text-base font-serif">该书暂无划线高亮</p>
          <p className="text-xs mt-1">在 Apple Books 中阅读并添加划线后，将在此自动同步</p>
        </div>
      ) : (
        <div className="space-y-10 max-w-4xl">
          {Object.entries(chapterGroups).map(([chapter, items]) => (
            <section key={chapter} className="space-y-4">
              <h2 className="font-serif text-lg font-bold text-paper-text dark:text-night-text flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-paper-terracotta dark:bg-night-terracotta" />
                <span>{chapter}</span>
                <span className="text-xs font-normal text-paper-muted dark:text-night-muted">({items.length}条)</span>
              </h2>

              <div className="space-y-4">
                {items.map(anno => (
                  <HighlightCard
                    key={anno.uuid}
                    annotation={anno}
                    colorSemantics={colorSemantics}
                    onToggleStar={onToggleStar}
                    onUpdateCustomNote={onUpdateCustomNote}
                    onAddTag={onAddTag}
                    onRemoveTag={onRemoveTag}
                    onOpenQuoteModal={onOpenQuoteModal}
                    onRequestContext={onRequestContext}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
