import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnnotationItem, ColorSemanticConfig, HighlightContextResult } from '../../electron/types/ipc';
import { Star, MessageSquare, Image, Tag, Plus, Check, Copy, Waypoints, ArrowUpRight, X, BookOpen, Quote } from 'lucide-react';

/**
 * 在核心段落文本中定位高亮选区范围，用于二次强调渲染
 */
export function findHighlightMatchRange(
  paragraph: string,
  selectedText: string
): { start: number; end: number } | null {
  if (!paragraph || !selectedText) return null;
  const trimmed = selectedText.trim();
  if (!trimmed) return null;

  // 1. 优先尝试完全精确匹配
  const exactIndex = paragraph.indexOf(trimmed);
  if (exactIndex !== -1) {
    return { start: exactIndex, end: exactIndex + trimmed.length };
  }

  // 2. 尝试容忍空白符/换行差异的匹配（按空白分词，允许词间出现任意 \s*）
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length > 0 && tokens.length <= 150) {
    const escapedTokens = tokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    try {
      const regex = new RegExp(escapedTokens.join('\\s*'));
      const match = regex.exec(paragraph);
      if (match && match.index !== undefined) {
        return { start: match.index, end: match.index + match[0].length };
      }
    } catch {
      // 忽略异常回退
    }
  }

  return null;
}

/**
 * 在自然段内渲染二次高光文本节点
 */
function renderParagraphWithHighlight(
  paragraph: string,
  selectedText: string,
  colorHex: string
): React.ReactNode {
  const target = paragraph || selectedText;
  const range = findHighlightMatchRange(target, selectedText);

  if (!range) {
    // 如果段落本身就是整句未匹配到子串，仍然高亮展示全文或保持段落展示
    if (!paragraph && selectedText) {
      return (
        <mark
          className="px-1 py-0.5 rounded-sm font-semibold text-paper-text dark:text-night-text"
          style={{
            backgroundColor: `${colorHex}45`,
            boxShadow: `inset 0 -2px 0 ${colorHex}`
          }}
        >
          {selectedText}
        </mark>
      );
    }
    return target;
  }

  const before = target.slice(0, range.start);
  const matched = target.slice(range.start, range.end);
  const after = target.slice(range.end);

  return (
    <>
      {before && <span>{before}</span>}
      <mark
        className="px-1 py-0.5 rounded-sm font-semibold text-paper-text dark:text-night-text"
        style={{
          backgroundColor: `${colorHex}45`,
          boxShadow: `inset 0 -2px 0 ${colorHex}`
        }}
        data-testid="modal-secondary-highlight"
      >
        {matched}
      </mark>
      {after && <span>{after}</span>}
    </>
  );
}

export interface HighlightCardProps {
  annotation: AnnotationItem;
  colorSemantics: ColorSemanticConfig[];
  availableTags?: string[];
  allAnnotations?: AnnotationItem[];
  onOpenInGraph?: (annotation: AnnotationItem) => void;
  onManageTags?: () => void;
  onToggleStar: (uuid: string) => void;
  onUpdateCustomNote: (uuid: string, note: string) => void;
  onAddTag: (uuid: string, tag: string) => void;
  onRemoveTag: (uuid: string, tag: string) => void;
  onOpenQuoteModal: (annotation: AnnotationItem) => void;
  onRequestContext: (annotation: AnnotationItem) => Promise<HighlightContextResult>;
}

export const HighlightCard: React.FC<HighlightCardProps> = ({
  annotation,
  colorSemantics,
  availableTags = [],
  allAnnotations = [],
  onOpenInGraph,
  onManageTags,
  onToggleStar,
  onUpdateCustomNote,
  onAddTag,
  onRemoveTag,
  onOpenQuoteModal,
  onRequestContext
}) => {
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteText, setNoteText] = useState(annotation.customNote || '');
  const [isTagSelectorOpen, setIsTagSelectorOpen] = useState(false);
  const [isContextModalOpen, setIsContextModalOpen] = useState(false);
  const [isLoadingContext, setIsLoadingContext] = useState(false);
  const [contextData, setContextData] = useState<HighlightContextResult | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isCopiedContext, setIsCopiedContext] = useState(false);

  // 计算共享标签的同门高亮
  const linkedHighlights = useMemo(() => {
    const myTags = annotation.tags || [];
    if (myTags.length === 0 || allAnnotations.length === 0) return [];
    const tagSet = new Set(myTags);
    return allAnnotations.filter(
      a => a.uuid !== annotation.uuid && (a.tags || []).some(t => tagSet.has(t))
    );
  }, [annotation.tags, annotation.uuid, allAnnotations]);

  const semantic = colorSemantics.find(s => s.colorKey === annotation.colorKey);
  const colorHex = semantic?.hexColor || '#F5A623';

  // 监听 Esc 键关闭居中原文弹窗
  useEffect(() => {
    if (!isContextModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsContextModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isContextModalOpen]);

  const handleCopyQuote = async () => {
    const lines = [`“${annotation.selectedText}”`];
    if (annotation.note) {
      lines.push(`划线想法：${annotation.note}`);
    }
    if (annotation.customNote) {
      lines.push(`延伸思考：${annotation.customNote}`);
    }
    const sourceParts: string[] = [];
    if (annotation.bookTitle) sourceParts.push(annotation.bookTitle);
    if (annotation.chapterTitle && annotation.chapterTitle !== '默认章节') {
      sourceParts.push(annotation.chapterTitle);
    }
    if (sourceParts.length > 0) {
      lines.push(`——《${sourceParts.join(' · ')}》`);
    }

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(lines.join('\n'));
      }
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy quote', err);
    }
  };

  const handleCopyFullContext = async () => {
    if (!contextData || !contextData.available) return;
    const parts: string[] = [];
    if (contextData.beforeParagraphs?.length) {
      parts.push(...contextData.beforeParagraphs);
    }
    parts.push(`【原文划线】${contextData.currentParagraph || annotation.selectedText}`);
    if (contextData.afterParagraphs?.length) {
      parts.push(...contextData.afterParagraphs);
    }
    if (annotation.bookTitle) {
      parts.push(`——《${annotation.bookTitle}》${annotation.chapterTitle ? ` · ${annotation.chapterTitle}` : ''}`);
    }

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(parts.join('\n\n'));
      }
      setIsCopiedContext(true);
      setTimeout(() => setIsCopiedContext(false), 2000);
    } catch (err) {
      console.error('Failed to copy context', err);
    }
  };

  const handleOpenContextModal = async () => {
    setIsContextModalOpen(true);
    if (!contextData) {
      setIsLoadingContext(true);
      try {
        const res = await onRequestContext(annotation);
        setContextData(res);
      } catch {
        setContextData({
          available: false,
          reason: 'NOT_FOUND',
          beforeParagraphs: [],
          currentParagraph: '',
          selectedText: annotation.selectedText,
          afterParagraphs: []
        });
      } finally {
        setIsLoadingContext(false);
      }
    }
  };

  const handleStartEditNote = () => {
    setNoteText(annotation.customNote || '');
    setIsEditingNote(true);
  };

  const handleSaveNote = () => {
    onUpdateCustomNote(annotation.uuid, noteText);
    setIsEditingNote(false);
  };

  const handleCancelNote = () => {
    setNoteText(annotation.customNote || '');
    setIsEditingNote(false);
  };

  // 居中原文语境弹窗组件内容
  const contextModalContent = isContextModalOpen && (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={() => setIsContextModalOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`context-modal-title-${annotation.uuid}`}
    >
      <div
        className="relative w-full max-w-2xl max-h-[85vh] bg-paper-card dark:bg-night-card border border-paper-border dark:border-night-border rounded-2xl shadow-2xl flex flex-col overflow-hidden text-paper-text dark:text-night-text animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* 顶部彩色强调指示条 */}
        <div className="h-1.5 w-full flex-shrink-0" style={{ backgroundColor: colorHex }} />

        {/* 弹窗头部 */}
        <div className="px-5 py-4 border-b border-paper-border/70 dark:border-night-border/70 flex items-center justify-between gap-3 bg-paper-sidebar/40 dark:bg-night-sidebar/40">
          <div className="flex items-center gap-2.5 min-w-0">
            <BookOpen className="w-4 h-4 text-paper-terracotta dark:text-night-terracotta flex-shrink-0" />
            <div className="min-w-0">
              <h3
                id={`context-modal-title-${annotation.uuid}`}
                className="font-serif font-bold text-sm sm:text-base text-paper-text dark:text-night-text truncate"
              >
                《{annotation.bookTitle || '书籍原文语境'}》
              </h3>
              <p className="text-xs text-paper-muted dark:text-night-muted truncate">
                {annotation.chapterTitle && annotation.chapterTitle !== '默认章节'
                  ? annotation.chapterTitle
                  : '原文上下文全览'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span
              className="px-2 py-0.5 rounded text-[11px] font-medium"
              style={{ backgroundColor: `${colorHex}20`, color: colorHex }}
            >
              {semantic?.label || '高亮'}
            </span>
            <button
              onClick={() => setIsContextModalOpen(false)}
              className="p-1.5 rounded-lg text-paper-muted dark:text-night-muted hover:text-paper-text dark:hover:text-night-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              title="关闭窗口 (Esc)"
              aria-label="关闭原文窗口"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 弹窗主体正文：EPUB 原文语境展示 */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 font-serif text-[15px] leading-relaxed text-paper-text/90 dark:text-night-text/90">
          {isLoadingContext ? (
            <div className="py-12 text-center space-y-3">
              <div className="inline-block w-6 h-6 border-2 border-paper-terracotta border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-paper-muted dark:text-night-muted">
                正在从 EPUB 文件中定位并提取前后自然段...
              </p>
            </div>
          ) : contextData && contextData.available ? (
            <>
              {/* 前置自然段 */}
              {contextData.beforeParagraphs && contextData.beforeParagraphs.length > 0 && (
                <div className="space-y-3 opacity-60 text-sm">
                  {contextData.beforeParagraphs.map((para, i) => (
                    <p key={`before-${i}`}>{para}</p>
                  ))}
                </div>
              )}

              {/* 当前划线所在自然段（段落柔和聚焦 + 划线句二次高光强调） */}
              <div
                className="p-3.5 sm:p-4 rounded-xl relative my-3 shadow-xs"
                style={{
                  backgroundColor: `${colorHex}12`,
                  borderLeft: `4px solid ${colorHex}`
                }}
              >
                <div className="flex items-center gap-1.5 text-xs font-sans font-medium mb-1.5" style={{ color: colorHex }}>
                  <Quote className="w-3.5 h-3.5" />
                  <span>核心划线段落</span>
                </div>
                <p className="text-[15.5px] leading-relaxed">
                  {renderParagraphWithHighlight(
                    contextData.currentParagraph,
                    annotation.selectedText,
                    colorHex
                  )}
                </p>
              </div>

              {/* 原生想法与二次批注展示 */}
              {(annotation.note || annotation.customNote) && (
                <div className="space-y-2 py-2">
                  {annotation.note && (
                    <div className="px-3.5 py-2.5 rounded-lg bg-paper-sidebar/70 dark:bg-night-sidebar/70 border border-paper-border/60 dark:border-night-border/60 text-xs">
                      <span className="font-sans font-semibold text-paper-muted dark:text-night-muted mr-1.5">
                        当时划线想法：
                      </span>
                      <span>{annotation.note}</span>
                    </div>
                  )}
                  {annotation.customNote && (
                    <div className="px-3.5 py-2.5 rounded-lg bg-paper-drawer dark:bg-night-drawer border border-paper-border/60 dark:border-night-border/60 text-xs flex items-start gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-paper-terracotta dark:text-night-terracotta mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-sans font-semibold text-paper-terracotta dark:text-night-terracotta mr-1.5">
                          二次延伸思考：
                        </span>
                        <span>{annotation.customNote}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 后置自然段 */}
              {contextData.afterParagraphs && contextData.afterParagraphs.length > 0 && (
                <div className="space-y-3 opacity-60 text-sm">
                  {contextData.afterParagraphs.map((para, i) => (
                    <p key={`after-${i}`}>{para}</p>
                  ))}
                </div>
              )}

              {/* 跨书思想连接拓展区 */}
              {linkedHighlights.length > 0 && (
                <div className="mt-6 pt-4 border-t border-paper-border/60 dark:border-night-border/60">
                  <div className="flex items-center justify-between text-xs mb-2.5">
                    <div className="flex items-center gap-1.5 font-medium text-paper-terracotta dark:text-night-terracotta">
                      <Waypoints className="w-3.5 h-3.5" />
                      <span>跨书思想共振（{linkedHighlights.length} 条相连）</span>
                    </div>
                    {onOpenInGraph && (
                      <button
                        onClick={() => {
                          setIsContextModalOpen(false);
                          onOpenInGraph(annotation);
                        }}
                        className="flex items-center gap-0.5 text-[11px] text-paper-terracotta hover:underline font-medium"
                      >
                        <span>在图谱中全景漫游</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {linkedHighlights.slice(0, 3).map(h => (
                      <div
                        key={h.uuid}
                        className="p-2.5 rounded-lg bg-paper-sidebar/50 dark:bg-night-sidebar/50 border border-paper-border/40 dark:border-night-border/40 text-xs"
                      >
                        <span className="font-serif font-medium text-paper-text/90 dark:text-night-text/90">
                          《{h.bookTitle || '未知书籍'}》
                        </span>
                        <span className="text-paper-muted dark:text-night-muted">
                          ：{h.selectedText.length > 50 ? h.selectedText.slice(0, 50) + '...' : h.selectedText}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="py-8 text-center space-y-3">
              <div
                className="p-4 rounded-xl text-left font-serif text-[15px] leading-relaxed shadow-xs"
                style={{
                  backgroundColor: `${colorHex}12`,
                  borderLeft: `4px solid ${colorHex}`
                }}
              >
                <mark
                  className="px-1 py-0.5 rounded-sm font-semibold text-paper-text dark:text-night-text"
                  style={{
                    backgroundColor: `${colorHex}45`,
                    boxShadow: `inset 0 -2px 0 ${colorHex}`
                  }}
                >
                  “{annotation.selectedText}”
                </mark>
              </div>
              <p className="text-xs text-paper-muted dark:text-night-muted italic">
                {contextData?.reason === 'FILE_NOT_DOWNLOADED'
                  ? '此书籍为 iCloud 在线资源，未在本地发现解压 .epub 文件包'
                  : '受 Apple Books DRM 保护或未找到对应章节原文，已为您呈现完整划线内容'}
              </p>
            </div>
          )}
        </div>

        {/* 弹窗底部操作条 */}
        <div className="px-5 py-3 border-t border-paper-border/70 dark:border-night-border/70 flex items-center justify-between gap-3 bg-paper-sidebar/20 dark:bg-night-sidebar/20">
          <div className="flex items-center gap-2">
            {contextData?.available && (
              <button
                onClick={handleCopyFullContext}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-paper-border dark:border-night-border hover:border-paper-terracotta text-paper-muted hover:text-paper-text bg-paper-card dark:bg-night-card transition-colors shadow-2xs"
              >
                {isCopiedContext ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{isCopiedContext ? '已复制全段语境' : '复制全段语境'}</span>
              </button>
            )}
            <button
              onClick={() => {
                setIsContextModalOpen(false);
                onOpenQuoteModal(annotation);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-paper-border dark:border-night-border hover:border-paper-terracotta text-paper-muted hover:text-paper-text bg-paper-card dark:bg-night-card transition-colors shadow-2xs"
            >
              <Image className="w-3.5 h-3.5" />
              <span>制作金句卡片</span>
            </button>
          </div>

          <button
            onClick={() => setIsContextModalOpen(false)}
            className="px-4 py-1.5 rounded-lg bg-paper-terracotta dark:bg-night-terracotta text-white text-xs font-medium hover:opacity-90 transition-opacity"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* 
        统一卡片高度 h-[264px]，采用 flex flex-col justify-between 确保所有卡片大小一致
      */}
      <div className="h-[264px] bg-paper-card dark:bg-night-card border border-paper-border dark:border-night-border rounded-xl p-4 sm:p-5 relative overflow-hidden transition-all hover:shadow-md flex flex-col justify-between group">
        {/* 左侧 4px 语义色标 */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1"
          style={{ backgroundColor: colorHex }}
          data-testid="semantic-color-bar"
        />

        {/* 顶部工具栏：语义胶囊与操作按钮 */}
        <div className="flex items-center justify-between pl-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span
              className="px-2 py-0.5 rounded text-[11px] font-medium"
              style={{ backgroundColor: `${colorHex}20`, color: colorHex }}
            >
              {semantic?.label || '高亮'}
            </span>
            <span className="text-[11px] text-paper-muted dark:text-night-muted">
              {new Date(annotation.creationDateMs).toLocaleDateString('zh-CN')}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleCopyQuote}
              className={`p-1 rounded transition-colors ${
                isCopied
                  ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
                  : 'text-paper-muted dark:text-night-muted hover:text-paper-text dark:hover:text-night-text hover:bg-black/5 dark:hover:bg-white/5'
              }`}
              title={isCopied ? '已复制到剪贴板' : '复制引用文字'}
              aria-label={isCopied ? '已复制到剪贴板' : '复制引用文字'}
            >
              {isCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={() => onOpenQuoteModal(annotation)}
              className="p-1 rounded text-paper-muted dark:text-night-muted hover:text-paper-terracotta dark:hover:text-night-terracotta hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              title="生成金句卡片"
              aria-label="生成金句卡片"
            >
              <Image className="w-4 h-4" />
            </button>
            <button
              onClick={() => onToggleStar(annotation.uuid)}
              className={`p-1 rounded transition-colors ${
                annotation.isStarred
                  ? 'text-amber-500'
                  : 'text-paper-muted dark:text-night-muted hover:text-amber-500 hover:bg-black/5 dark:hover:bg-white/5'
              }`}
              title="标记核心重点"
              aria-label={annotation.isStarred ? '取消核心重点' : '标记核心重点'}
            >
              <Star className="w-4 h-4" fill={annotation.isStarred ? 'currentColor' : 'none'} />
            </button>
          </div>
        </div>

        {/* 卡片正文主体：引文限制 line-clamp-4，保证视觉高度整齐一致 */}
        <div className="flex-1 min-h-0 flex flex-col justify-between py-2 pl-2">
          <blockquote
            className="font-serif text-[15px] leading-relaxed text-paper-text dark:text-night-text tracking-wide line-clamp-4 select-text"
            title={annotation.selectedText}
          >
            “{annotation.selectedText}”
          </blockquote>

          {/* 原生划线想法与二次延伸思考紧凑摘要 */}
          <div className="mt-1.5 space-y-1">
            {annotation.note && (
              <div
                className="px-2.5 py-1 rounded-md bg-paper-sidebar/60 dark:bg-night-sidebar/60 border border-paper-border/60 dark:border-night-border/60 text-[11px] text-paper-text/90 dark:text-night-text/90 truncate"
                title={`原文划线想法：${annotation.note}`}
              >
                <span className="font-semibold text-paper-muted dark:text-night-muted mr-1">原文划线想法：</span>
                {annotation.note}
              </div>
            )}

            {annotation.customNote ? (
              <div
                onClick={handleStartEditNote}
                className="cursor-pointer group/note flex items-center gap-1.5 text-[11px] text-paper-muted dark:text-night-muted hover:text-paper-text dark:hover:text-night-text truncate"
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleStartEditNote(); }}
                aria-label="编辑深度想法"
                title={`二次思考：${annotation.customNote}`}
              >
                <MessageSquare className="w-3 h-3 text-paper-terracotta dark:text-night-terracotta flex-shrink-0" />
                <span className="truncate">{annotation.customNote}</span>
              </div>
            ) : (
              <button
                onClick={handleStartEditNote}
                className="flex items-center gap-1 text-[11px] text-paper-muted/70 dark:text-night-muted/70 hover:text-paper-terracotta dark:hover:text-night-terracotta transition-colors"
              >
                <Plus className="w-3 h-3" />
                <span>补充深度想法</span>
              </button>
            )}
          </div>
        </div>

        {/* 底部工具条：标签点选与居中原文弹窗入口 */}
        <div className="pl-2 pt-2 border-t border-paper-border/40 dark:border-night-border/40 flex items-center justify-between gap-1 flex-shrink-0">
          {/* 标签胶囊区 */}
          <div className="flex items-center gap-1 overflow-hidden flex-1 min-w-0 pr-1">
            {(annotation.tags || []).map(t => (
              <span
                key={t}
                className="group/tag inline-flex items-center gap-0.5 bg-paper-drawer dark:bg-night-drawer px-1.5 py-0.5 rounded text-[10px] text-paper-muted dark:text-night-muted border border-paper-border/40 dark:border-night-border/40 flex-shrink-0 max-w-[90px] truncate"
              >
                <Tag className="w-2.5 h-2.5 flex-shrink-0" />
                <span className="truncate">#{t}</span>
                <button
                  onClick={() => onRemoveTag(annotation.uuid, t)}
                  className="hidden group-hover/tag:inline hover:text-red-500 ml-0.5 transition-colors"
                  title={`删除标签 ${t}`}
                  aria-label={`删除标签 ${t}`}
                >
                  ×
                </button>
              </span>
            ))}

            {/* 标签管理点选按钮 */}
            <button
              onClick={() => setIsTagSelectorOpen(prev => !prev)}
              className={`text-[10.5px] px-1.5 py-0.5 rounded flex items-center gap-0.5 transition-colors flex-shrink-0 ${
                isTagSelectorOpen
                  ? 'bg-paper-terracotta dark:bg-night-terracotta text-white font-medium'
                  : 'bg-paper-drawer/70 dark:bg-night-drawer/70 text-paper-muted dark:text-night-muted hover:text-paper-terracotta dark:hover:text-night-terracotta'
              }`}
            >
              <Plus className="w-2.5 h-2.5" />
              <span>标签</span>
            </button>
          </div>

          {/* 右侧：弹出居中原文语境窗口按钮 */}
          <button
            onClick={handleOpenContextModal}
            className="flex-shrink-0 flex items-center gap-1 text-[11px] text-paper-muted dark:text-night-muted hover:text-paper-terracotta dark:hover:text-night-terracotta transition-colors py-0.5"
            title="打开居中窗口查看原文语境"
          >
            <BookOpen className="w-3 h-3 text-paper-terracotta/80" />
            <span>查看原文语境</span>
            <ArrowUpRight className="w-3 h-3 opacity-75" />
          </button>
        </div>

        {/* 内部浮层：思考编辑浮层（就地浮层，不改变卡片高度） */}
        {isEditingNote && (
          <div className="absolute inset-0 z-20 bg-paper-card dark:bg-night-card p-4 flex flex-col justify-between animate-in fade-in duration-100">
            <div className="space-y-1.5 flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between text-xs font-medium text-paper-muted dark:text-night-muted">
                <span>二次思考与联想</span>
                <button onClick={handleCancelNote} className="p-0.5 hover:text-paper-text">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="记录你的二次联想与思考..."
                className="w-full flex-1 text-xs p-2.5 rounded-lg border border-paper-border dark:border-night-border bg-paper-drawer dark:bg-night-drawer text-paper-text dark:text-night-text focus:outline-none focus:ring-1 focus:ring-paper-terracotta dark:focus:ring-night-terracotta resize-none"
                aria-label="二次联想与思考"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 flex-shrink-0">
              <button
                onClick={handleCancelNote}
                className="px-2.5 py-1 text-xs text-paper-muted dark:text-night-muted hover:text-paper-text dark:hover:text-night-text transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveNote}
                className="px-3 py-1 text-xs bg-paper-terracotta dark:bg-night-terracotta text-white rounded font-medium hover:opacity-90 transition-opacity"
              >
                保存思考
              </button>
            </div>
          </div>
        )}

        {/* 内部浮层：标签点选浮层 */}
        {isTagSelectorOpen && (
          <div className="absolute inset-x-3 bottom-12 z-20 p-2.5 rounded-xl bg-paper-card dark:bg-night-card border border-paper-border dark:border-night-border shadow-lg flex flex-wrap items-center gap-1.5 text-xs max-h-36 overflow-y-auto animate-in fade-in slide-in-from-bottom-2 duration-100">
            <div className="w-full flex items-center justify-between pb-1 border-b border-paper-border/40 text-[10.5px] text-paper-muted">
              <span>点选添加标签：</span>
              <button onClick={() => setIsTagSelectorOpen(false)} className="hover:text-paper-text">
                <X className="w-3 h-3" />
              </button>
            </div>
            {availableTags.length > 0 ? (
              <>
                {availableTags.map(t => {
                  const isAttached = (annotation.tags || []).includes(t);
                  return (
                    <button
                      key={t}
                      onClick={() =>
                        isAttached
                          ? onRemoveTag(annotation.uuid, t)
                          : onAddTag(annotation.uuid, t)
                      }
                      className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] transition-colors ${
                        isAttached
                          ? 'bg-paper-terracotta dark:bg-night-terracotta text-white font-medium'
                          : 'bg-paper-drawer dark:bg-night-drawer text-paper-text dark:text-night-text border border-paper-border dark:border-night-border hover:border-paper-terracotta'
                      }`}
                    >
                      {isAttached && <Check className="w-2.5 h-2.5" />}
                      <span>#{t}</span>
                    </button>
                  );
                })}
                {onManageTags && (
                  <button
                    onClick={onManageTags}
                    className="ml-auto text-[11px] text-paper-terracotta dark:text-night-terracotta hover:underline"
                  >
                    管理标签库 →
                  </button>
                )}
              </>
            ) : (
              <div className="w-full flex items-center justify-between text-[11px] text-paper-muted dark:text-night-muted">
                <span>暂无标签</span>
                {onManageTags && (
                  <button
                    onClick={onManageTags}
                    className="text-paper-terracotta dark:text-night-terracotta font-medium hover:underline"
                  >
                    新建标签 →
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 
        居中弹出的原文语境 Modal：
        通过 createPortal 渲染在 document.body 上，居中并带有全屏半透明毛玻璃背景
      */}
      {typeof document !== 'undefined' && contextModalContent
        ? createPortal(contextModalContent, document.body)
        : contextModalContent}
    </>
  );
};
