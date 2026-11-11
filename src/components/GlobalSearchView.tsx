import React, { useState } from 'react';
import {
  BookItem,
  AnnotationItem,
  ColorSemanticConfig,
  HighlightColor,
  HighlightContextResult
} from '../../electron/types/ipc';
import { HighlightCard } from './HighlightCard';
import { CustomSelect } from './CustomSelect';
import {
  Search,
  X,
  BookOpen,
  Star,
  MessageSquare,
  Tag,
  Sparkles,
  SlidersHorizontal,
  ArrowUpRight
} from 'lucide-react';

export interface GlobalSearchViewProps {
  books: BookItem[];
  annotations: AnnotationItem[];
  searchResults?: AnnotationItem[];
  colorSemantics: ColorSemanticConfig[];
  availableTags: string[];
  searchKeyword: string;
  onSearchKeywordChange: (kw: string) => void;
  onSelectBook: (book: BookItem) => void;
  onManageTags: () => void;
  onToggleStar: (uuid: string) => void;
  onUpdateCustomNote: (uuid: string, note: string) => void;
  onAddTag: (uuid: string, tag: string) => void;
  onRemoveTag: (uuid: string, tag: string) => void;
  onOpenQuoteModal: (annotation: AnnotationItem) => void;
  onRequestContext: (annotation: AnnotationItem) => Promise<HighlightContextResult>;
  onOpenInGraph?: (annotation: AnnotationItem) => void;
}

export const GlobalSearchView: React.FC<GlobalSearchViewProps> = ({
  books,
  annotations,
  searchResults = [],
  colorSemantics,
  availableTags,
  searchKeyword,
  onSearchKeywordChange,
  onSelectBook,
  onManageTags,
  onToggleStar,
  onUpdateCustomNote,
  onAddTag,
  onRemoveTag,
  onOpenQuoteModal,
  onRequestContext,
  onOpenInGraph
}) => {
  const [selectedBookId, setSelectedBookId] = useState<string>('all');
  const [selectedColor, setSelectedColor] = useState<HighlightColor | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [onlyWithNotes, setOnlyWithNotes] = useState(false);
  const [onlyStarred, setOnlyStarred] = useState(false);
  const [sortBy, setSortBy] = useState<'recent' | 'book'>('recent');

  // 合并全量笔记与 IPC 搜索结果（按 uuid 去重）
  const sourceMap = new Map<string, AnnotationItem>();
  for (const a of annotations || []) {
    sourceMap.set(a.uuid, a);
  }
  for (const r of searchResults || []) {
    if (!sourceMap.has(r.uuid)) {
      sourceMap.set(r.uuid, r);
    }
  }
  const sourceAnnotations = Array.from(sourceMap.values());

  const bookMap = new Map((books || []).map(b => [b.assetId, b]));
  const booksWithNotes = (books || []).filter(b => (b.highlightsCount || 0) > 0);

  // 统计每种色彩在全库中的数量
  const colorCounts: Partial<Record<HighlightColor, number>> = {};
  for (const a of sourceAnnotations) {
    colorCounts[a.colorKey] = (colorCounts[a.colorKey] || 0) + 1;
  }

  const kw = searchKeyword.trim().toLowerCase();
  const hasActiveFilter = Boolean(
    kw || selectedBookId !== 'all' || selectedColor || selectedTag || onlyWithNotes || onlyStarred
  );

  // 组合过滤与排序
  const searchResultUuids = new Set((searchResults || []).map(r => r.uuid));
  const rawList = sourceAnnotations.filter(a => {
    if (selectedBookId !== 'all' && a.assetId !== selectedBookId) return false;
    if (selectedColor && a.colorKey !== selectedColor) return false;
    if (selectedTag && !(a.tags || []).includes(selectedTag)) return false;
    if (onlyStarred && !a.isStarred) return false;
    if (onlyWithNotes && !Boolean(a.note?.trim() || a.customNote?.trim())) return false;

    if (kw) {
      if (searchResultUuids.has(a.uuid)) return true;
      const book = bookMap.get(a.assetId);
      const bookTitle = (a.bookTitle || book?.title || '').toLowerCase();
      const chapterTitle = (a.chapterTitle || '').toLowerCase();
      const selText = (a.selectedText || '').toLowerCase();
      const noteText = (a.note || '').toLowerCase();
      const customText = (a.customNote || '').toLowerCase();
      const tagMatch = (a.tags || []).some(t => t.toLowerCase().includes(kw));

      return (
        selText.includes(kw) ||
        noteText.includes(kw) ||
        customText.includes(kw) ||
        bookTitle.includes(kw) ||
        chapterTitle.includes(kw) ||
        tagMatch
      );
    }

    return true;
  });

  const filteredResults =
    sortBy === 'book'
      ? [...rawList].sort((a, b) => {
          if (a.assetId !== b.assetId) return a.assetId.localeCompare(b.assetId);
          return (a.sortIndex || 0) - (b.sortIndex || 0);
        })
      : [...rawList].sort(
          (a, b) =>
            (b.modificationDateMs || b.creationDateMs || 0) -
            (a.modificationDateMs || a.creationDateMs || 0)
        );

  const displayedResults = hasActiveFilter ? filteredResults : filteredResults.slice(0, 20);
  const matchedBookCount = new Set(filteredResults.map(r => r.assetId)).size;

  const handleResetAll = () => {
    onSearchKeywordChange('');
    setSelectedBookId('all');
    setSelectedColor(null);
    setSelectedTag(null);
    setOnlyWithNotes(false);
    setOnlyStarred(false);
  };

  return (
    <div className="flex-1 flex flex-col p-8 overflow-y-auto bg-paper-bg dark:bg-night-bg text-paper-text dark:text-night-text">
      {/* 1. 顶部标题与大尺寸智能搜索框 */}
      <div className="max-w-4xl w-full mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="font-serif text-3xl font-bold text-paper-text dark:text-night-text flex items-center gap-2.5">
              <Search className="w-7 h-7 text-paper-terracotta dark:text-night-terracotta" />
              <span>全局探索与检索</span>
            </h1>
            <p className="text-xs text-paper-muted dark:text-night-muted mt-1">
              跨书检索高亮原句、批注思考、书名章节与标签，支持多维交叉过滤（快捷键 <kbd className="px-1.5 py-0.5 rounded bg-paper-drawer dark:bg-night-drawer font-mono">⌘K</kbd>）
            </p>
          </div>
        </div>

        {/* 主搜索框 */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-4 top-3.5 text-paper-muted dark:text-night-muted" />
          <input
            type="text"
            value={searchKeyword}
            onChange={e => onSearchKeywordChange(e.target.value)}
            placeholder="搜索高亮句子、想法或批注...（支持跨书检索书名、章节与 #标签）"
            className="w-full pl-11 pr-10 py-3 text-sm rounded-2xl border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card text-paper-text dark:text-night-text placeholder:text-paper-muted dark:placeholder:text-night-muted shadow-xs focus:outline-none focus:ring-2 focus:ring-paper-terracotta/50 dark:focus:ring-night-terracotta/50 transition-all"
            autoFocus
          />
          {searchKeyword && (
            <button
              onClick={() => onSearchKeywordChange('')}
              className="absolute right-3.5 top-3.5 text-paper-muted hover:text-paper-text dark:hover:text-night-text"
              title="清空关键词"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 2. 多维交叉筛选面板 */}
      <div className="max-w-4xl w-full mb-8 p-4 rounded-2xl bg-paper-card dark:bg-night-card border border-paper-border dark:border-night-border shadow-2xs space-y-3">
        {/* 第一行：书籍下拉 + 状态过滤 + 排序 */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-paper-muted dark:text-night-muted font-medium mr-1">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>筛选：</span>
            </span>

            {/* 按书籍过滤 */}
            <CustomSelect
              value={selectedBookId}
              onChange={setSelectedBookId}
              ariaLabel="按书籍过滤"
              icon={<BookOpen className="w-3.5 h-3.5" />}
              searchPlaceholder="搜索书名..."
              dropdownWidthClass="w-72"
              options={[
                { value: 'all', label: `全部书籍 (${booksWithNotes.length})` },
                ...booksWithNotes.map(b => ({
                  value: b.assetId,
                  label: b.title,
                  subLabel: b.author || undefined,
                  count: b.highlightsCount
                }))
              ]}
            />

            {/* 仅看有批注 */}
            <button
              onClick={() => setOnlyWithNotes(prev => !prev)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                onlyWithNotes
                  ? 'bg-blue-500 text-white'
                  : 'bg-paper-drawer dark:bg-night-drawer text-paper-muted dark:text-night-muted hover:text-paper-text dark:hover:text-night-text'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>有批注/思考</span>
            </button>

            {/* 仅看星标 */}
            <button
              onClick={() => setOnlyStarred(prev => !prev)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                onlyStarred
                  ? 'bg-amber-500 text-white'
                  : 'bg-paper-drawer dark:bg-night-drawer text-paper-muted dark:text-night-muted hover:text-paper-text dark:hover:text-night-text'
              }`}
            >
              <Star className="w-3.5 h-3.5 fill-current" />
              <span>星标金句</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* 排序切换 */}
            <div className="flex items-center bg-paper-drawer dark:bg-night-drawer p-0.5 rounded-lg text-[11px]">
              <button
                onClick={() => setSortBy('recent')}
                className={`px-2 py-1 rounded-md transition-colors ${
                  sortBy === 'recent'
                    ? 'bg-paper-card dark:bg-night-card text-paper-text dark:text-night-text font-medium shadow-2xs'
                    : 'text-paper-muted dark:text-night-muted'
                }`}
              >
                按时间最新
              </button>
              <button
                onClick={() => setSortBy('book')}
                className={`px-2 py-1 rounded-md transition-colors ${
                  sortBy === 'book'
                    ? 'bg-paper-card dark:bg-night-card text-paper-text dark:text-night-text font-medium shadow-2xs'
                    : 'text-paper-muted dark:text-night-muted'
                }`}
              >
                按书籍聚合
              </button>
            </div>

            {hasActiveFilter && (
              <button
                onClick={handleResetAll}
                className="px-2.5 py-1 rounded-lg text-xs text-red-500 hover:bg-red-500/10 transition-colors"
              >
                重置全部
              </button>
            )}
          </div>
        </div>

        {/* 第二行：6 色语义快捷筛选条 */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-paper-border/50 dark:border-night-border/50 text-xs">
          <span className="text-[11px] text-paper-muted dark:text-night-muted mr-1">色彩：</span>
          {colorSemantics.map(c => {
            const count = colorCounts[c.colorKey] || 0;
            const isSelected = selectedColor === c.colorKey;
            return (
              <button
                key={c.colorKey}
                onClick={() => setSelectedColor(isSelected ? null : c.colorKey)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] transition-colors ${
                  isSelected
                    ? 'bg-paper-text dark:bg-night-text text-paper-bg dark:text-night-bg font-medium'
                    : 'bg-paper-drawer/70 dark:bg-night-drawer/70 text-paper-muted dark:text-night-muted hover:text-paper-text dark:hover:text-night-text'
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.hexColor }} />
                <span>{c.label}</span>
                <span className="opacity-65 font-mono">({count})</span>
              </button>
            );
          })}
        </div>

        {/* 第三行：若存在全局标签，提供标签过滤行 */}
        {availableTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-paper-border/50 dark:border-night-border/50 text-xs">
            <span className="text-[11px] text-paper-muted dark:text-night-muted mr-1">标签：</span>
            {availableTags.map(t => {
              const isSelected = selectedTag === t;
              return (
                <button
                  key={t}
                  onClick={() => setSelectedTag(isSelected ? null : t)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] transition-colors ${
                    isSelected
                      ? 'bg-paper-terracotta dark:bg-night-terracotta text-white font-medium'
                      : 'bg-paper-drawer/70 dark:bg-night-drawer/70 text-paper-muted dark:text-night-muted hover:text-paper-text dark:hover:text-night-text'
                  }`}
                >
                  <Tag className="w-2.5 h-2.5" />
                  <span>#{t}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. 结果统计提示栏 */}
      <div className="max-w-4xl w-full flex items-center justify-between text-xs text-paper-muted dark:text-night-muted mb-4 px-1">
        <span>
          {hasActiveFilter ? (
            <>
              共检索到 <strong className="text-paper-text dark:text-night-text">{filteredResults.length}</strong> 条匹配记录（分布于{' '}
              <strong className="text-paper-text dark:text-night-text">{matchedBookCount}</strong> 本书中）
            </>
          ) : (
            <>✨ 探索流：最近记录的 {displayedResults.length} 条高亮与思考（可输入关键词或点击上方胶囊精确筛选）</>
          )}
        </span>
      </div>

      {/* 4. 检索结果卡片流 */}
      <div className="max-w-4xl w-full space-y-5">
        {displayedResults.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-paper-card dark:bg-night-card border border-paper-border dark:border-night-border rounded-2xl">
            <Sparkles className="w-10 h-10 text-paper-muted/40 dark:text-night-muted/40 mb-3" />
            <p className="font-serif text-base text-paper-text dark:text-night-text">
              未找到匹配的高亮或批注
            </p>
            <p className="text-xs text-paper-muted dark:text-night-muted mt-1">
              尝试更换搜索词，或点击下方按钮重置筛选条件
            </p>
            {hasActiveFilter && (
              <button
                onClick={handleResetAll}
                className="mt-4 px-3.5 py-1.5 rounded-lg bg-paper-terracotta dark:bg-night-terracotta text-white text-xs font-medium shadow-xs"
              >
                重置所有筛选条件
              </button>
            )}
          </div>
        ) : (
          displayedResults.map(item => {
            const matchedBook = bookMap.get(item.assetId);
            const bookTitle = item.bookTitle || matchedBook?.title || '未知书籍';
            const chapterTitle = item.chapterTitle || '默认章节';

            return (
              <div key={item.uuid} className="space-y-1.5">
                {/* 卡片顶部书籍与章节来源导航条 */}
                <div className="flex items-center justify-between px-1.5 text-xs">
                  <div className="flex items-center gap-1.5 text-paper-muted dark:text-night-muted truncate">
                    <BookOpen className="w-3.5 h-3.5 text-paper-terracotta dark:text-night-terracotta flex-shrink-0" />
                    <button
                      onClick={() => matchedBook && onSelectBook(matchedBook)}
                      className="font-serif font-bold text-paper-text dark:text-night-text hover:text-paper-terracotta dark:hover:text-night-terracotta transition-colors truncate"
                    >
                      《{bookTitle}》
                    </button>
                    <span>·</span>
                    <span className="truncate">{chapterTitle}</span>
                  </div>

                  {matchedBook && (
                    <button
                      onClick={() => onSelectBook(matchedBook)}
                      className="flex items-center gap-0.5 text-[11px] text-paper-terracotta dark:text-night-terracotta hover:underline flex-shrink-0"
                    >
                      <span>定位原书</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* 完整功能的高亮卡片 */}
                <HighlightCard
                  annotation={item}
                  colorSemantics={colorSemantics}
                  availableTags={availableTags}
                  allAnnotations={annotations}
                  onOpenInGraph={onOpenInGraph}
                  onManageTags={onManageTags}
                  onToggleStar={onToggleStar}
                  onUpdateCustomNote={onUpdateCustomNote}
                  onAddTag={onAddTag}
                  onRemoveTag={onRemoveTag}
                  onOpenQuoteModal={onOpenQuoteModal}
                  onRequestContext={onRequestContext}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
