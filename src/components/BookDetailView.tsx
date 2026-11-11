import React, { useState } from 'react';
import {
  BookItem,
  AnnotationItem,
  ColorSemanticConfig,
  HighlightColor,
  HighlightContextResult,
  ChapterContentResult
} from '../../electron/types/ipc';
import { HighlightCard } from './HighlightCard';
import {
  ArrowLeft,
  ExternalLink,
  Download,
  Star,
  MessageSquare,
  Search,
  X,
  BookOpen,
  Palette,
  Bookmark
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
  activeChapter?: string | null;
  onActiveChapterChange?: (chapter: string) => void;
  readingChapterContent?: ChapterContentResult | null;
  isLoadingChapterContent?: boolean;
  onReadChapter?: (chapterTitle: string) => void;
  onCloseChapterReader?: () => void;
  availableTags?: string[];
  onManageTags?: () => void;
  allAnnotations?: AnnotationItem[];
  onOpenInGraph?: (annotation: AnnotationItem) => void;
  onOpenColorSettings?: () => void;
  onUpdateChapter?: (uuid: string, chapterTitle: string) => void;
  chapterSuggestions?: string[];
  isPinned?: boolean;
  onTogglePinBook?: (assetId: string) => void;
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
  onRequestContext,
  activeChapter = null,
  onActiveChapterChange,
  readingChapterContent = null,
  isLoadingChapterContent = false,
  onReadChapter,
  onCloseChapterReader,
  availableTags = [],
  onManageTags,
  allAnnotations = [],
  onOpenInGraph,
  onOpenColorSettings,
  onUpdateChapter,
  chapterSuggestions = [],
  isPinned = false,
  onTogglePinBook
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

  // Scroll Spy: 滚动时检测当前处于视口顶部的章节
  const handleContainerScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!onActiveChapterChange) return;
    const container = e.currentTarget;
    const sections = container.querySelectorAll('section[data-chapter-title]');
    let currentChap: string | null = null;

    for (let i = 0; i < sections.length; i++) {
      const sec = sections[i] as HTMLElement;
      const rect = sec.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      if (rect.top - containerRect.top <= 140) {
        currentChap = sec.getAttribute('data-chapter-title');
      }
    }

    if (currentChap) {
      onActiveChapterChange(currentChap);
    }
  };

  return (
    <div
      onScroll={handleContainerScroll}
      className="flex-1 overflow-y-auto bg-paper-bg dark:bg-night-bg text-paper-text dark:text-night-text p-8"
    >
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
          {onTogglePinBook && (
            <button
              onClick={() => onTogglePinBook(book.assetId)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors shadow-sm ${
                isPinned
                  ? 'border-paper-terracotta/50 bg-paper-terracotta/10 text-paper-terracotta dark:text-night-terracotta font-medium'
                  : 'border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card text-paper-muted dark:text-night-muted hover:text-paper-terracotta dark:hover:text-night-terracotta'
              }`}
              title={isPinned ? '点击移出左侧重点笔记书单' : '点击加入左侧重点笔记书单'}
            >
              <Bookmark className="w-3.5 h-3.5" fill={isPinned ? 'currentColor' : 'none'} />
              <span>{isPinned ? '已在重点书单' : '加入重点书单'}</span>
            </button>
          )}

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

            {onOpenColorSettings && (
              <button
                onClick={onOpenColorSettings}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-paper-muted dark:text-night-muted hover:text-paper-terracotta dark:hover:text-night-terracotta hover:bg-paper-drawer dark:hover:bg-night-drawer transition-colors"
                title="自定义高亮颜色代表的含义与配色"
              >
                <Palette className="w-3.5 h-3.5" />
                <span>编辑语义</span>
              </button>
            )}

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

      {/* 章节原文阅读面板（当点击无笔记章节或点击「阅读本章原文」时展开） */}
      {(isLoadingChapterContent || readingChapterContent) && (
        <div
          data-testid="chapter-reader-panel"
          className="mb-8 p-6 rounded-2xl bg-paper-card dark:bg-night-card border border-paper-terracotta/40 dark:border-night-terracotta/40 shadow-sm max-w-4xl"
        >
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-paper-border dark:border-night-border">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-paper-terracotta dark:text-night-terracotta" />
              <h3 className="font-serif text-lg font-bold text-paper-text dark:text-night-text">
                {readingChapterContent?.chapterTitle || '正在加载章节原文...'}
              </h3>
              {readingChapterContent?.available && (
                <span className="text-xs text-paper-muted dark:text-night-muted">
                  （共 {readingChapterContent.paragraphs.length} 段正文）
                </span>
              )}
            </div>
            {onCloseChapterReader && (
              <button
                onClick={onCloseChapterReader}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-paper-drawer dark:bg-night-drawer text-paper-muted dark:text-night-muted hover:text-paper-text dark:hover:text-night-text transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                <span>收起原文</span>
              </button>
            )}
          </div>

          {isLoadingChapterContent ? (
            <p className="text-xs text-paper-muted dark:text-night-muted py-6 text-center">
              正在从本地 EPUB 解析本章正文段落...
            </p>
          ) : readingChapterContent && readingChapterContent.available ? (
            <div className="space-y-3.5 max-h-[460px] overflow-y-auto pr-2 font-serif text-sm leading-loose text-paper-text/90 dark:text-night-text/90">
              {readingChapterContent.paragraphs.map((para, idx) => (
                <p key={idx} className="indent-0">
                  {para}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-xs text-paper-muted dark:text-night-muted py-6 text-center">
              未能在本地 EPUB 文件中提取到该章节的正文内容（可能书籍尚未下载到本地或受 DRM 保护）。
            </p>
          )}
        </div>
      )}

      {/* 选中的无高光章节优雅空状态（方案 A：无高光章节不强行用全文取而代之） */}
      {activeChapter && !chapterGroups[activeChapter] && annotations.length > 0 && (
        <div
          data-testid="empty-chapter-state"
          className="mb-8 p-6 rounded-2xl bg-paper-card dark:bg-night-card border border-paper-border dark:border-night-border shadow-xs flex flex-col items-center justify-center text-center py-8 max-w-4xl"
        >
          <div className="w-12 h-12 rounded-full bg-paper-drawer dark:bg-night-drawer flex items-center justify-center text-paper-terracotta dark:text-night-terracotta mb-3">
            <BookOpen className="w-5 h-5" />
          </div>
          <h3 className="font-serif text-base font-bold text-paper-text dark:text-night-text mb-1">
            《{activeChapter}》暂无划线笔记
          </h3>
          <p className="text-xs text-paper-muted dark:text-night-muted mb-4 max-w-md leading-relaxed">
            你在此章节中尚未留下划线或批注。可直接前往 Apple Books 继续阅读并勾画重点。
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onOpenInAppleBooks(book.assetId, book.epubPath)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-paper-terracotta dark:bg-night-terracotta text-white text-xs font-medium shadow-sm hover:opacity-95 transition-opacity"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>在 Apple Books 中阅读本章</span>
            </button>
            {onActiveChapterChange && (
              <button
                onClick={() => onActiveChapterChange('')}
                className="px-3 py-1.5 rounded-lg bg-paper-drawer dark:bg-night-drawer text-paper-muted dark:text-night-muted hover:text-paper-text dark:hover:text-night-text text-xs transition-colors"
              >
                查看全部章节笔记
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
            <section
              key={chapter}
              id={`chapter-${encodeURIComponent(chapter)}`}
              data-chapter-title={chapter}
              className="space-y-4 scroll-mt-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-lg font-bold text-paper-text dark:text-night-text flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-paper-terracotta dark:bg-night-terracotta" />
                  <span>{chapter}</span>
                  <span className="text-xs font-normal text-paper-muted dark:text-night-muted">({items.length}条)</span>
                </h2>

                {onReadChapter && book.epubPath && (
                  <button
                    onClick={() => onReadChapter(chapter)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs text-paper-muted dark:text-night-muted hover:text-paper-terracotta dark:hover:text-night-terracotta hover:bg-paper-drawer dark:hover:bg-night-drawer transition-colors"
                    title="展开阅读本章完整 EPUB 原文"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>阅读本章原文</span>
                  </button>
                )}
              </div>

              <div className="space-y-4">
                {items.map(anno => (
                  <HighlightCard
                    key={anno.uuid}
                    annotation={anno}
                    colorSemantics={colorSemantics}
                    availableTags={availableTags}
                    allAnnotations={allAnnotations}
                    chapterSuggestions={chapterSuggestions}
                    onOpenInGraph={onOpenInGraph}
                    onManageTags={onManageTags}
                    onOpenColorSettings={onOpenColorSettings}
                    onUpdateChapter={onUpdateChapter}
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
