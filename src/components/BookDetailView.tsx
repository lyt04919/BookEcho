import React, { useState } from 'react';
import {
  BookItem,
  AnnotationItem,
  ColorSemanticConfig,
  HighlightColor,
  HighlightContextResult
} from '../../electron/types/ipc';
import { HighlightCard } from './HighlightCard';
import {
  ArrowLeft,
  ExternalLink,
  Download,
  Star,
  MessageSquare,
  Search,
  X
} from 'lucide-react';

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
  // 单书内专属筛选状态
  const [selectedColor, setSelectedColor] = useState<HighlightColor | null>(null);
  const [onlyStarred, setOnlyStarred] = useState(false);
  const [onlyNotes, setOnlyNotes] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');

  // 统计本书实际用过的颜色及数量
  const colorCountMap: Partial<Record<HighlightColor, number>> = {};
  let starredCount = 0;
  let notesCount = 0;

  for (const anno of annotations) {
    colorCountMap[anno.colorKey] = (colorCountMap[anno.colorKey] || 0) + 1;
    if (anno.isStarred) starredCount++;
    if (Boolean(anno.note || anno.customNote)) notesCount++;
  }

  const usedColors = colorSemantics
    .filter(s => (colorCountMap[s.colorKey] || 0) > 0)
    .map(s => ({
      ...s,
      count: colorCountMap[s.colorKey] || 0
    }));

  // 根据当前单书筛选器过滤高亮
  const kw = searchKeyword.trim().toLowerCase();
  const filteredAnnotations = annotations.filter(anno => {
    if (selectedColor && anno.colorKey !== selectedColor) return false;
    if (onlyStarred && !anno.isStarred) return false;
    if (onlyNotes && !(anno.note || anno.customNote)) return false;
    if (kw) {
      const textMatch = anno.selectedText?.toLowerCase().includes(kw);
      const noteMatch = anno.note?.toLowerCase().includes(kw);
      const customNoteMatch = anno.customNote?.toLowerCase().includes(kw);
      const tagMatch = anno.tags?.some(t => t.toLowerCase().includes(kw));
      if (!textMatch && !noteMatch && !customNoteMatch && !tagMatch) return false;
    }
    return true;
  });

  // 按章节分组并保持排序
  const chapterGroups = filteredAnnotations.reduce((acc, anno) => {
    const chapter = anno.chapterTitle?.trim() || '默认章节';
    if (!acc[chapter]) acc[chapter] = [];
    acc[chapter].push(anno);
    return acc;
  }, {} as Record<string, AnnotationItem[]>);

  Object.values(chapterGroups).forEach(list => {
    list.sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));
  });

  const isAnyFilterActive = Boolean(selectedColor || onlyStarred || onlyNotes || searchKeyword.trim());

  const handleResetFilters = () => {
    setSelectedColor(null);
    setOnlyStarred(false);
    setOnlyNotes(false);
    setSearchKeyword('');
  };

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
      <div className="flex gap-6 mb-8 pb-8 border-b border-paper-border/60 dark:border-night-border/60">
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

      {/* 本书内专属高亮筛选控制条 */}
      {annotations.length > 0 && (
        <div className="mb-8 p-3 rounded-xl bg-paper-card dark:bg-night-card border border-paper-border dark:border-night-border shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {/* 全部按钮 */}
            <button
              onClick={() => setSelectedColor(null)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                selectedColor === null
                  ? 'bg-paper-terracotta dark:bg-night-terracotta text-white shadow-xs'
                  : 'bg-paper-drawer dark:bg-night-drawer text-paper-muted dark:text-night-muted hover:text-paper-text dark:hover:text-night-text'
              }`}
            >
              全部 ({annotations.length})
            </button>

            {/* 本书用过的颜色胶囊 */}
            {usedColors.map(c => {
              const isSelected = selectedColor === c.colorKey;
              return (
                <button
                  key={c.colorKey}
                  onClick={() => setSelectedColor(isSelected ? null : c.colorKey)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    isSelected
                      ? 'bg-white dark:bg-night-sidebar text-paper-text dark:text-night-text border border-paper-border dark:border-night-border shadow-sm'
                      : 'bg-paper-drawer dark:bg-night-drawer text-paper-muted dark:text-night-muted hover:text-paper-text dark:hover:text-night-text'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.hexColor }} />
                  <span>{c.label}</span>
                  <span className="opacity-70 text-[11px]">({c.count})</span>
                </button>
              );
            })}

            {/* 仅看批注 */}
            {notesCount > 0 && (
              <button
                onClick={() => setOnlyNotes(prev => !prev)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  onlyNotes
                    ? 'bg-blue-500 text-white shadow-xs'
                    : 'bg-paper-drawer dark:bg-night-drawer text-paper-muted dark:text-night-muted hover:text-paper-text dark:hover:text-night-text'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>有批注 ({notesCount})</span>
              </button>
            )}

            {/* 仅看星标 */}
            {starredCount > 0 && (
              <button
                onClick={() => setOnlyStarred(prev => !prev)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  onlyStarred
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-paper-drawer dark:bg-night-drawer text-paper-muted dark:text-night-muted hover:text-paper-text dark:hover:text-night-text'
                }`}
              >
                <Star className="w-3.5 h-3.5 fill-current" />
                <span>星标 ({starredCount})</span>
              </button>
            )}
          </div>

          {/* 本书内实时搜索框与重置 */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-paper-muted dark:text-night-muted" />
              <input
                type="text"
                value={searchKeyword}
                onChange={e => setSearchKeyword(e.target.value)}
                placeholder="在本书中检索句子与想法..."
                className="pl-8 pr-7 py-1 text-xs rounded-lg border border-paper-border dark:border-night-border bg-paper-drawer dark:bg-night-drawer text-paper-text dark:text-night-text placeholder:text-paper-muted dark:placeholder:text-night-muted focus:outline-none focus:ring-1 focus:ring-paper-terracotta dark:focus:ring-night-terracotta w-48 sm:w-56"
              />
              {searchKeyword && (
                <button
                  onClick={() => setSearchKeyword('')}
                  className="absolute right-2 top-2 text-paper-muted dark:text-night-muted hover:text-paper-text dark:hover:text-night-text"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {isAnyFilterActive && (
              <button
                onClick={handleResetFilters}
                className="p-1.5 rounded-lg text-paper-muted dark:text-night-muted hover:text-red-500 transition-colors"
                title="重置本书筛选"
                aria-label="重置本书筛选"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 章节流式展示 */}
      {annotations.length === 0 ? (
        <div className="text-center py-16 text-paper-muted dark:text-night-muted">
          <p className="text-base font-serif">该书暂无划线高亮</p>
          <p className="text-xs mt-1">在 Apple Books 中阅读并添加划线后，将在此自动同步</p>
        </div>
      ) : filteredAnnotations.length === 0 ? (
        <div className="text-center py-16 text-paper-muted dark:text-night-muted">
          <p className="text-base font-serif">未找到符合当前筛选条件的高亮</p>
          <button
            onClick={handleResetFilters}
            className="mt-3 px-3 py-1 text-xs font-medium rounded-lg bg-paper-terracotta dark:bg-night-terracotta text-white shadow-sm"
          >
            重置筛选，查看全部
          </button>
        </div>
      ) : (
        <div className="space-y-10 max-w-4xl">
          {Object.entries(chapterGroups).map(([chapter, items]) => (
            <section key={chapter} id={`chapter-${encodeURIComponent(chapter)}`} className="space-y-4 scroll-mt-6">
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
