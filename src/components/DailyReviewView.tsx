import React, { useState, useEffect } from 'react';
import {
  AnnotationItem,
  BookItem,
  ColorSemanticConfig,
  HighlightContextResult
} from '../../electron/types/ipc';
import {
  Sparkles,
  Check,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  Star,
  Eye,
  EyeOff,
  Copy,
  Image,
  MessageSquare,
  Plus,
  Tag,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export interface DailyReviewViewProps {
  queue: AnnotationItem[];
  colorSemantics: ColorSemanticConfig[];
  onSubmitResult: (uuid: string, result: 'remembered' | 'mastered' | 'reset') => void;
  onRefreshQueue: () => void;
  initialClozeMode?: boolean;
  allAnnotations?: AnnotationItem[];
  books?: BookItem[];
  availableTags?: string[];
  onSelectBook?: (book: BookItem) => void;
  onToggleStar?: (uuid: string) => void;
  onUpdateCustomNote?: (uuid: string, note: string) => void;
  onAddTag?: (uuid: string, tag: string) => void;
  onRemoveTag?: (uuid: string, tag: string) => void;
  onOpenQuoteModal?: (annotation: AnnotationItem) => void;
  onRequestContext?: (annotation: AnnotationItem) => Promise<HighlightContextResult>;
  onManageTags?: () => void;
}

export function handleReviewKeyDown(
  e: { key: string; target?: EventTarget | null; preventDefault?: () => void },
  currentItem: AnnotationItem | undefined,
  onAction: (result: 'remembered' | 'mastered' | 'reset') => void,
  onToggleReveal?: () => void,
  onPrev?: () => void
): boolean {
  const target = e.target as { tagName?: string } | null | undefined;
  const tagName = target?.tagName?.toUpperCase();
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
    return false;
  }
  if (!currentItem) return false;
  if (e.key === 'Tab' && onToggleReveal) {
    e.preventDefault?.();
    onToggleReveal();
    return true;
  }
  if (e.key === 'ArrowLeft' && onPrev) {
    e.preventDefault?.();
    onPrev();
    return true;
  }
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
  onRefreshQueue,
  initialClozeMode = false,
  allAnnotations = [],
  books = [],
  availableTags = [],
  onSelectBook,
  onToggleStar,
  onUpdateCustomNote,
  onAddTag,
  onRemoveTag,
  onOpenQuoteModal,
  onRequestContext,
  onManageTags
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isClozeMode, setIsClozeMode] = useState(initialClozeMode);
  const [isRevealed, setIsRevealed] = useState(false);

  // 漫游范围模式：推荐队列 / 星标精选 / 深度批注 / 按书筛选
  const [reviewScope, setReviewScope] = useState<'recommended' | 'starred' | 'notes'>('recommended');
  const [selectedBookId, setSelectedBookId] = useState<string>('all');

  // 卡片内实时交互状态
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [isTagPickerOpen, setIsTagPickerOpen] = useState(false);
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [isLoadingContext, setIsLoadingContext] = useState(false);
  const [contextData, setContextData] = useState<HighlightContextResult | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  // 计算当前激活的漫游队列
  const sourcePool = allAnnotations.length > 0 ? allAnnotations : queue;
  const activeQueue =
    reviewScope === 'recommended' && selectedBookId === 'all'
      ? queue
      : sourcePool
          .filter(a => {
            if (selectedBookId !== 'all' && a.assetId !== selectedBookId) return false;
            if (reviewScope === 'starred' && !a.isStarred) return false;
            if (reviewScope === 'notes' && !Boolean(a.note?.trim() || a.customNote?.trim())) return false;
            return true;
          })
          .slice(0, 20);

  const currentItem = activeQueue[currentIndex];

  // 切换卡片时重置局部展开态
  const resetCardTransientState = () => {
    setIsRevealed(false);
    setIsEditingNote(false);
    setIsTagPickerOpen(false);
    setIsContextOpen(false);
    setContextData(null);
  };

  const handleAction = (result: 'remembered' | 'mastered' | 'reset') => {
    if (!currentItem) return;
    onSubmitResult(currentItem.uuid, result);
    resetCardTransientState();
    if (currentIndex < activeQueue.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setCurrentIndex(activeQueue.length);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      resetCardTransientState();
      setCurrentIndex(currentIndex - 1);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      handleReviewKeyDown(
        e,
        currentItem,
        handleAction,
        isClozeMode ? () => setIsRevealed(prev => !prev) : undefined,
        currentIndex > 0 ? handlePrev : undefined
      );
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [currentIndex, currentItem, activeQueue.length, isClozeMode]);

  const handleCopyQuote = async () => {
    if (!currentItem) return;
    const text = `“${currentItem.selectedText}”\n——《${currentItem.bookTitle || '未知书籍'} · ${currentItem.chapterTitle || '默认章节'}》`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 1800);
      } catch {
        // ignore
      }
    }
  };

  const handleToggleContext = async () => {
    if (!currentItem || !onRequestContext) return;
    if (!isContextOpen) {
      setIsContextOpen(true);
      if (!contextData) {
        setIsLoadingContext(true);
        try {
          const res = await onRequestContext(currentItem);
          setContextData(res);
        } catch {
          setContextData({
            available: false,
            reason: 'NOT_FOUND',
            beforeParagraphs: [],
            currentParagraph: '',
            selectedText: currentItem.selectedText,
            afterParagraphs: []
          });
        } finally {
          setIsLoadingContext(false);
        }
      }
    } else {
      setIsContextOpen(false);
    }
  };

  const booksWithNotes = books.filter(b => (b.highlightsCount || 0) > 0);

  if (!currentItem || currentIndex >= activeQueue.length) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-paper-bg dark:bg-night-bg text-center overflow-y-auto">
        <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 mb-4">
          <Sparkles className="w-8 h-8" />
        </div>
        <h2 className="font-serif text-2xl font-bold text-paper-text dark:text-night-text mb-2">
          今日回顾已达成！
        </h2>
        <p className="text-sm text-paper-muted dark:text-night-muted max-w-sm mb-6">
          温故而知新。你已经完成今天全部读书高亮漫游，这些思考已深深印入知识体系中。
        </p>
        <div className="flex items-center gap-3">
          {(reviewScope !== 'recommended' || selectedBookId !== 'all') && (
            <button
              onClick={() => {
                setReviewScope('recommended');
                setSelectedBookId('all');
                setCurrentIndex(0);
              }}
              className="px-4 py-2 rounded-lg border border-paper-border dark:border-night-border text-xs text-paper-muted dark:text-night-muted hover:text-paper-text dark:hover:text-night-text transition-colors"
            >
              返回默认推荐队列
            </button>
          )}
          <button
            onClick={() => {
              setCurrentIndex(0);
              resetCardTransientState();
              onRefreshQueue();
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-paper-terracotta dark:bg-night-terracotta text-white text-sm font-medium shadow-sm hover:opacity-95 transition-opacity"
          >
            <RotateCcw className="w-4 h-4" />
            <span>换一批再次漫游</span>
          </button>
        </div>
      </div>
    );
  }

  const semantic = colorSemantics.find(s => s.colorKey === currentItem.colorKey);
  const colorHex = semantic?.hexColor || '#F5A623';
  const progressPct = Math.round(((currentIndex + 1) / Math.max(1, activeQueue.length)) * 100);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-paper-bg dark:bg-night-bg overflow-y-auto">
      {/* 顶部模式切换与范围筛选工作栏 */}
      <div className="w-full max-w-2xl mb-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-paper-muted dark:text-night-muted">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 font-medium text-paper-text dark:text-night-text mr-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>每日漫游 · 专注模式</span>
            </span>

            {/* 范围切换胶囊 */}
            <div className="flex items-center bg-paper-drawer dark:bg-night-drawer p-0.5 rounded-lg">
              {(
                [
                  { key: 'recommended', label: '智能推荐' },
                  { key: 'starred', label: '星标精选' },
                  { key: 'notes', label: '有批注' }
                ] as const
              ).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => {
                    setReviewScope(tab.key);
                    setCurrentIndex(0);
                    resetCardTransientState();
                  }}
                  className={`px-2.5 py-1 rounded-md text-[11px] transition-colors ${
                    reviewScope === tab.key
                      ? 'bg-paper-card dark:bg-night-card text-paper-text dark:text-night-text font-medium shadow-2xs'
                      : 'text-paper-muted dark:text-night-muted hover:text-paper-text dark:hover:text-night-text'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* 书籍筛选下拉 */}
            {booksWithNotes.length > 0 && (
              <select
                value={selectedBookId}
                onChange={e => {
                  setSelectedBookId(e.target.value);
                  setCurrentIndex(0);
                  resetCardTransientState();
                }}
                aria-label="按书籍筛选回顾范围"
                className="px-2 py-1 rounded-lg text-[11px] bg-paper-drawer dark:bg-night-drawer border border-paper-border/60 dark:border-night-border/60 text-paper-text dark:text-night-text max-w-[140px] truncate focus:outline-none"
              >
                <option value="all">全部书籍</option>
                {booksWithNotes.map(b => (
                  <option key={b.assetId} value={b.assetId}>
                    《{b.title}》
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setIsClozeMode(prev => !prev);
                setIsRevealed(false);
              }}
              data-testid="cloze-mode-toggle"
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] transition-colors ${
                isClozeMode
                  ? 'bg-paper-terracotta dark:bg-night-terracotta text-white font-medium'
                  : 'bg-paper-drawer dark:bg-night-drawer text-paper-muted dark:text-night-muted hover:text-paper-text dark:hover:text-night-text'
              }`}
              title="开启后遮挡高亮原句，先通过章节和想法主动回忆，按 Tab 键或点击原句揭晓"
            >
              {isClozeMode ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              <span>主动回忆遮挡</span>
            </button>
            <span data-testid="review-progress" className="font-mono font-medium">
              {currentIndex + 1} / {activeQueue.length}
            </span>
          </div>
        </div>

        {/* 线性进度条 */}
        <div className="w-full h-1 rounded-full bg-paper-drawer dark:bg-night-drawer overflow-hidden">
          <div
            className="h-full bg-paper-terracotta dark:bg-night-terracotta transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* 沉浸式精读单卡 */}
      <div className="w-full max-w-2xl bg-paper-card dark:bg-night-card border border-paper-border dark:border-night-border rounded-2xl p-8 shadow-sm relative overflow-hidden transition-colors">
        <div
          data-testid="color-accent-stripe"
          className="absolute top-0 left-0 right-0 h-1.5"
          style={{ backgroundColor: colorHex }}
        />

        {/* 卡片头部：出处信息 + 快捷动作工具 */}
        <div className="flex items-center justify-between text-xs text-paper-muted dark:text-night-muted mb-5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <BookOpen className="w-3.5 h-3.5 text-paper-terracotta dark:text-night-terracotta flex-shrink-0" />
            <span
              onClick={() => {
                if (onSelectBook) {
                  const matched = books.find(b => b.assetId === currentItem.assetId);
                  if (matched) onSelectBook(matched);
                }
              }}
              className={`font-medium text-paper-text dark:text-night-text ${
                onSelectBook ? 'cursor-pointer hover:text-paper-terracotta dark:hover:text-night-terracotta transition-colors' : ''
              }`}
            >
              {currentItem.bookTitle || '未知书籍'}
            </span>
            <span>·</span>
            <span>{currentItem.chapterTitle || '默认章节'}</span>
            {semantic && (
              <span
                className="ml-1 px-2 py-0.5 rounded text-[10px] font-medium"
                style={{ backgroundColor: `${colorHex}20`, color: colorHex }}
              >
                {semantic.label}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCopyQuote}
              className="p-1.5 rounded-lg text-paper-muted dark:text-night-muted hover:text-paper-text dark:hover:text-night-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              title="复制引用文字"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            {onOpenQuoteModal && (
              <button
                onClick={() => onOpenQuoteModal(currentItem)}
                className="p-1.5 rounded-lg text-paper-muted dark:text-night-muted hover:text-paper-terracotta dark:hover:text-night-terracotta hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                title="生成金句分享卡片"
              >
                <Image className="w-3.5 h-3.5" />
              </button>
            )}

            {currentItem.isStarred ? (
              <button
                onClick={() => onToggleStar?.(currentItem.uuid)}
                className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                title="取消星标"
              >
                <Star className="w-4 h-4 text-amber-500" fill="currentColor" data-testid="starred-icon" />
              </button>
            ) : (
              onToggleStar && (
                <button
                  onClick={() => onToggleStar(currentItem.uuid)}
                  className="p-1.5 rounded-lg text-paper-muted dark:text-night-muted hover:text-amber-500 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  title="标记星标重点"
                >
                  <Star className="w-3.5 h-3.5" fill="none" />
                </button>
              )
            )}
          </div>
        </div>

        {/* 核心引文 */}
        <blockquote
          onClick={() => isClozeMode && setIsRevealed(prev => !prev)}
          data-testid="review-quote-block"
          className={`font-serif text-lg leading-relaxed text-paper-text dark:text-night-text tracking-wide mb-6 transition-all ${
            isClozeMode && !isRevealed ? 'blur-sm select-none cursor-pointer' : ''
          }`}
        >
          “{currentItem.selectedText}”
        </blockquote>
        {isClozeMode && !isRevealed && (
          <p className="text-[11px] text-paper-terracotta dark:text-night-terracotta mb-4 -mt-3">
            💡 主动回忆中：点击上方遮挡句子或按 <kbd className="px-1 py-0.5 rounded bg-paper-drawer dark:bg-night-drawer font-mono">Tab</kbd> 键揭晓原文
          </p>
        )}

        {/* Apple Books 原生划线想法 */}
        {currentItem.note && (
          <div
            data-testid="native-note-block"
            className="mb-4 p-3 rounded-lg bg-paper-drawer dark:bg-night-drawer text-xs text-paper-text/90 dark:text-night-text/90"
          >
            <span className="font-semibold text-paper-muted dark:text-night-muted mr-1">划线想法：</span>
            {currentItem.note}
          </div>
        )}

        {/* 二次延伸思考（支持当场展示与内联编辑） */}
        {currentItem.customNote && !isEditingNote && (
          <div
            data-testid="custom-note-block"
            onClick={() => {
              if (onUpdateCustomNote) {
                setNoteDraft(currentItem.customNote || '');
                setIsEditingNote(true);
              }
            }}
            className={`mb-4 p-3 rounded-lg bg-paper-terracotta/5 dark:bg-night-terracotta/10 border border-paper-terracotta/20 dark:border-night-terracotta/20 text-xs text-paper-muted dark:text-night-muted ${
              onUpdateCustomNote ? 'cursor-pointer hover:border-paper-terracotta/50 transition-colors' : ''
            }`}
          >
            <span className="font-semibold text-paper-terracotta dark:text-night-terracotta mr-1">延伸思考：</span>
            {currentItem.customNote}
          </div>
        )}

        {isEditingNote && onUpdateCustomNote && (
          <div className="mb-4 space-y-2">
            <textarea
              value={noteDraft}
              onChange={e => setNoteDraft(e.target.value)}
              placeholder="在温故时写下新的思考与感悟..."
              className="w-full text-xs p-3 rounded-xl border border-paper-border dark:border-night-border bg-paper-drawer dark:bg-night-drawer text-paper-text dark:text-night-text focus:outline-none focus:ring-1 focus:ring-paper-terracotta dark:focus:ring-night-terracotta resize-none h-20"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsEditingNote(false)}
                className="px-2.5 py-1 text-xs text-paper-muted dark:text-night-muted hover:text-paper-text"
              >
                取消
              </button>
              <button
                onClick={() => {
                  onUpdateCustomNote(currentItem.uuid, noteDraft);
                  setIsEditingNote(false);
                }}
                className="px-3 py-1 text-xs rounded-lg bg-paper-terracotta dark:bg-night-terracotta text-white font-medium"
              >
                保存思考
              </button>
            </div>
          </div>
        )}

        {/* 卡片中段辅助栏：写思考 / 贴标签 / 展开原文语境 */}
        {(onUpdateCustomNote || onAddTag || onRequestContext) && (
          <div className="flex flex-wrap items-center gap-2 mb-5 pt-2">
            {currentItem.tags?.map(t => (
              <span
                key={t}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-paper-drawer dark:bg-night-drawer text-[11px] text-paper-muted dark:text-night-muted"
              >
                <Tag className="w-2.5 h-2.5" />
                <span>#{t}</span>
              </span>
            ))}

            {onUpdateCustomNote && !currentItem.customNote && !isEditingNote && (
              <button
                onClick={() => {
                  setNoteDraft('');
                  setIsEditingNote(true);
                }}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-paper-drawer/70 dark:bg-night-drawer/70 text-[11px] text-paper-muted dark:text-night-muted hover:text-paper-terracotta dark:hover:text-night-terracotta transition-colors"
              >
                <MessageSquare className="w-3 h-3" />
                <span>+ 补充思考</span>
              </button>
            )}

            {onAddTag && (
              <button
                onClick={() => setIsTagPickerOpen(prev => !prev)}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-paper-drawer/70 dark:bg-night-drawer/70 text-[11px] text-paper-muted dark:text-night-muted hover:text-paper-terracotta dark:hover:text-night-terracotta transition-colors"
              >
                <Plus className="w-3 h-3" />
                <span>标签</span>
              </button>
            )}

            {onRequestContext && (
              <button
                onClick={handleToggleContext}
                className="ml-auto flex items-center gap-1 text-[11px] text-paper-muted dark:text-night-muted hover:text-paper-text dark:hover:text-night-text transition-colors"
              >
                <span>{isContextOpen ? '收起原文语境' : '展开原文语境'}</span>
                {isContextOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}
          </div>
        )}

        {/* 标签点选抽屉 */}
        {isTagPickerOpen && onAddTag && onRemoveTag && (
          <div className="mb-4 p-2.5 rounded-lg bg-paper-drawer/80 dark:bg-night-drawer/80 border border-paper-border/60 dark:border-night-border/60 flex flex-wrap items-center gap-1.5 text-xs">
            {availableTags.length > 0 ? (
              availableTags.map(t => {
                const isAttached = (currentItem.tags || []).includes(t);
                return (
                  <button
                    key={t}
                    onClick={() =>
                      isAttached
                        ? onRemoveTag(currentItem.uuid, t)
                        : onAddTag(currentItem.uuid, t)
                    }
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] transition-colors ${
                      isAttached
                        ? 'bg-paper-terracotta dark:bg-night-terracotta text-white font-medium'
                        : 'bg-paper-card dark:bg-night-card text-paper-text dark:text-night-text border border-paper-border dark:border-night-border'
                    }`}
                  >
                    {isAttached && <Check className="w-2.5 h-2.5" />}
                    <span>#{t}</span>
                  </button>
                );
              })
            ) : (
              <div className="w-full flex items-center justify-between text-[11px] text-paper-muted dark:text-night-muted">
                <span>暂无全局标签</span>
                {onManageTags && (
                  <button
                    onClick={onManageTags}
                    className="text-paper-terracotta dark:text-night-terracotta hover:underline"
                  >
                    去标签管理创建 →
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* 原文前后语境展开抽屉 */}
        {isContextOpen && (
          <div className="mb-5 p-4 rounded-xl bg-paper-drawer dark:bg-night-drawer border border-paper-border/60 dark:border-night-border/60 text-xs font-serif leading-relaxed text-paper-text/85 dark:text-night-text/85 space-y-2">
            {isLoadingContext ? (
              <p className="text-paper-muted dark:text-night-muted animate-pulse">正在提取 EPUB 原文前后段落...</p>
            ) : contextData && contextData.available ? (
              <>
                {contextData.beforeParagraphs.map((p, i) => (
                  <p key={`b-${i}`} className="opacity-65">{p}</p>
                ))}
                <p
                  className="font-medium p-2 rounded"
                  style={{ backgroundColor: `${colorHex}25`, borderLeft: `3px solid ${colorHex}` }}
                >
                  {contextData.currentParagraph}
                </p>
                {contextData.afterParagraphs.map((p, i) => (
                  <p key={`a-${i}`} className="opacity-65">{p}</p>
                ))}
              </>
            ) : (
              <p className="text-paper-muted dark:text-night-muted italic">未能读取到对应章节的本地 EPUB 上下文</p>
            )}
          </div>
        )}

        {/* 快捷操作栏 */}
        <div className="flex items-center justify-between pt-5 border-t border-paper-border/60 dark:border-night-border/60">
          <span className="text-[11px] text-paper-muted dark:text-night-muted">
            按 <kbd className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 dark:text-night-text font-mono">空格</kbd> / <kbd className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 dark:text-night-text font-mono">→</kbd> 下一条，<kbd className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 dark:text-night-text font-mono">Enter</kbd> 标为内化
          </span>

          <div className="flex items-center gap-2">
            {currentIndex > 0 && (
              <button
                onClick={handlePrev}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-paper-border dark:border-night-border text-xs text-paper-muted dark:text-night-muted hover:text-paper-text dark:hover:text-night-text transition-colors"
                title="返回上一条 (←)"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>上一条</span>
              </button>
            )}

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

      {/* 底部卡片圆点跳选器 */}
      {activeQueue.length > 1 && (
        <div className="flex items-center gap-1.5 mt-5">
          {activeQueue.map((item, idx) => (
            <button
              key={item.uuid}
              onClick={() => {
                resetCardTransientState();
                setCurrentIndex(idx);
              }}
              title={`第 ${idx + 1} 条`}
              className={`h-1.5 rounded-full transition-all ${
                idx === currentIndex
                  ? 'w-5 bg-paper-terracotta dark:bg-night-terracotta'
                  : 'w-1.5 bg-paper-border dark:bg-night-border hover:bg-paper-muted'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
