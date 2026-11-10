import React, { useState } from 'react';
import {
  BookItem,
  AnnotationItem,
  ColorSemanticConfig,
  HighlightContextResult
} from '../../electron/types/ipc';
import { HighlightCard } from './HighlightCard';
import {
  Tag,
  BookOpen,
  Copy,
  Check,
  Sparkles,
  Plus,
  Pencil,
  Trash2,
  X,
  Waypoints
} from 'lucide-react';

export interface TagTopicViewProps {
  tag?: string | null;
  tags?: string[];
  annotations: AnnotationItem[];
  books: BookItem[];
  colorSemantics: ColorSemanticConfig[];
  onSelectTag?: (tag: string | null) => void;
  onCreateGlobalTag?: (tag: string) => void;
  onRenameGlobalTag?: (oldTag: string, newTag: string) => void;
  onDeleteGlobalTag?: (tag: string) => void;
  onClearTag?: () => void;
  onSelectBook: (book: BookItem) => void;
  onToggleStar: (uuid: string) => void;
  onUpdateCustomNote: (uuid: string, note: string) => void;
  onAddTag: (uuid: string, tag: string) => void;
  onRemoveTag: (uuid: string, tag: string) => void;
  onOpenQuoteModal: (annotation: AnnotationItem) => void;
  onRequestContext: (annotation: AnnotationItem) => Promise<HighlightContextResult>;
  onOpenInGraph?: (annotation: AnnotationItem) => void;
  onSwitchToGraph?: () => void;
}

export function formatTagTopicMarkdown(
  tag: string,
  annotations: AnnotationItem[],
  books: BookItem[]
): string {
  const bookMap = new Map(books.map(b => [b.assetId, b]));
  const grouped = new Map<string, AnnotationItem[]>();

  for (const anno of annotations) {
    const list = grouped.get(anno.assetId) || [];
    list.push(anno);
    grouped.set(anno.assetId, list);
  }

  const lines: string[] = [
    '---',
    `topic: "#${tag}"`,
    `booksCount: ${grouped.size}`,
    `highlightsCount: ${annotations.length}`,
    `exportedAt: "${new Date().toISOString().split('T')[0]}"`,
    '---',
    '',
    `# 专题综述：#${tag}`,
    '',
    `> 共跨越 **${grouped.size}** 本书籍，汇集 **${annotations.length}** 条核心划线与思考。`,
    ''
  ];

  for (const [assetId, items] of grouped.entries()) {
    const book = bookMap.get(assetId);
    const title = book?.title || items[0]?.bookTitle || '未知书籍';
    const author = book?.author ? `（${book.author}）` : '';
    lines.push(`## 《${title}》${author}`);
    lines.push('');

    for (const item of items) {
      lines.push(`> “${item.selectedText}”`);
      lines.push(`> — *${item.chapterTitle || '默认章节'}*`);
      if (item.note) {
        lines.push('');
        lines.push(`- **划线批注**：${item.note}`);
      }
      if (item.customNote) {
        lines.push('');
        lines.push(`- **延伸思考**：${item.customNote}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

export const TagTopicView: React.FC<TagTopicViewProps> = ({
  tag = null,
  tags = [],
  annotations,
  books,
  colorSemantics,
  onSelectTag,
  onCreateGlobalTag,
  onRenameGlobalTag,
  onDeleteGlobalTag,
  onSelectBook,
  onToggleStar,
  onUpdateCustomNote,
  onAddTag,
  onRemoveTag,
  onOpenQuoteModal,
  onRequestContext,
  onOpenInGraph,
  onSwitchToGraph
}) => {
  const [copied, setCopied] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

  // 汇总所有可用标签（包含全局定义标签 + 笔记上已有标签）
  const allTags = Array.from(
    new Set([
      ...tags,
      ...(tag ? [tag] : []),
      ...annotations.flatMap(a => a.tags || [])
    ])
  ).filter(Boolean);

  // 统计每个标签关联的笔记数
  const tagCounts: Record<string, number> = {};
  for (const t of allTags) {
    tagCounts[t] = 0;
  }
  for (const anno of annotations) {
    for (const t of anno.tags || []) {
      tagCounts[t] = (tagCounts[t] || 0) + 1;
    }
  }

  // 当前激活查看的标签（优先使用传入的 tag，否则默认第一个标签）
  const activeTag = tag && allTags.includes(tag) ? tag : tag || allTags[0] || null;

  const taggedAnnotations = activeTag
    ? annotations.filter(a => (a.tags || []).includes(activeTag))
    : [];

  // 按书籍聚合
  const bookGroups = taggedAnnotations.reduce((acc, anno) => {
    if (!acc[anno.assetId]) acc[anno.assetId] = [];
    acc[anno.assetId].push(anno);
    return acc;
  }, {} as Record<string, AnnotationItem[]>);

  const bookEntries = Object.entries(bookGroups);

  const handleCreateTag = () => {
    const cleaned = newTagName.trim().replace(/^#+/, '');
    if (!cleaned) return;
    onCreateGlobalTag?.(cleaned);
    onSelectTag?.(cleaned);
    setNewTagName('');
  };

  const handleConfirmRename = (oldName: string) => {
    const cleaned = editingValue.trim().replace(/^#+/, '');
    if (cleaned && cleaned !== oldName) {
      onRenameGlobalTag?.(oldName, cleaned);
      if (activeTag === oldName) {
        onSelectTag?.(cleaned);
      }
    }
    setEditingTag(null);
    setEditingValue('');
  };

  const handleCopyTopicMarkdown = async () => {
    if (!activeTag) return;
    const md = formatTagTopicMarkdown(activeTag, taggedAnnotations, books);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(md);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // ignore clipboard error in non-secure test env
      }
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-paper-bg dark:bg-night-bg text-paper-text dark:text-night-text">
      {/* 1. 顶部标题与新建标签栏 */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between pb-6 mb-8 border-b border-paper-border dark:border-night-border gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-paper-terracotta/10 dark:bg-night-terracotta/15 text-paper-terracotta dark:text-night-terracotta text-xs font-medium mb-2">
            <Tag className="w-3.5 h-3.5" />
            <span>跨书主题聚合工作台</span>
          </div>
          <h1 className="font-serif text-3xl font-bold text-paper-text dark:text-night-text">
            标签管理与主题馆
          </h1>
          <p className="text-xs text-paper-muted dark:text-night-muted mt-1.5">
            在此统一新建、重命名或删除标签；在书籍高亮卡片中可直接点选已有标签，无需重复输入
          </p>
        </div>

        {/* 右上角操作区：新建全局标签与切换网络图谱 */}
        <div className="flex flex-wrap items-center gap-2">
          {onSwitchToGraph && (
            <button
              onClick={onSwitchToGraph}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card text-paper-text dark:text-night-text hover:text-paper-terracotta dark:hover:text-night-terracotta text-xs font-medium shadow-2xs hover:shadow-sm transition-all"
              title="切换至 Obsidian 式网状关系图谱"
            >
              <Waypoints className="w-3.5 h-3.5 text-amber-500" />
              <span>知识网络图谱</span>
            </button>
          )}

          <div className="relative">
            <input
              type="text"
              value={newTagName}
              onChange={e => setNewTagName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreateTag();
              }}
              placeholder="输入新标签名（如：心智模型）"
              className="pl-3 pr-3 py-2 text-xs rounded-lg border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card text-paper-text dark:text-night-text placeholder:text-paper-muted dark:placeholder:text-night-muted focus:outline-none focus:ring-1 focus:ring-paper-terracotta dark:focus:ring-night-terracotta w-44"
            />
          </div>
          <button
            onClick={handleCreateTag}
            className="flex items-center gap-1 px-3.5 py-2 rounded-lg bg-paper-terracotta dark:bg-night-terracotta text-white text-xs font-medium shadow-sm hover:opacity-95 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>新建标签</span>
          </button>
        </div>
      </div>

      {/* 2. 全局标签管理墙 */}
      <div className="mb-8 p-5 rounded-2xl bg-paper-card dark:bg-night-card border border-paper-border dark:border-night-border shadow-2xs">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-paper-muted dark:text-night-muted uppercase tracking-wider">
            全部标签库 ({allTags.length})
          </span>
          <span className="text-[11px] text-paper-muted dark:text-night-muted">
            点击标签查看跨书笔记 · 悬停可重命名或删除
          </span>
        </div>

        {allTags.length === 0 ? (
          <div className="py-6 text-center text-xs text-paper-muted dark:text-night-muted">
            标签库为空，请在右上角输入框创建你的第一个主题标签（例如：<span className="font-mono">#心理学</span>、<span className="font-mono">#商业思考</span>）
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {allTags.map(t => {
              const isSelected = activeTag === t;
              const isEditing = editingTag === t;
              const count = tagCounts[t] || 0;

              if (isEditing) {
                return (
                  <div
                    key={t}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-paper-terracotta dark:border-night-terracotta bg-paper-bg dark:bg-night-bg"
                  >
                    <input
                      type="text"
                      value={editingValue}
                      onChange={e => setEditingValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleConfirmRename(t);
                        if (e.key === 'Escape') setEditingTag(null);
                      }}
                      className="text-xs bg-transparent text-paper-text dark:text-night-text focus:outline-none w-24"
                      autoFocus
                    />
                    <button
                      onClick={() => handleConfirmRename(t)}
                      className="text-emerald-600 hover:opacity-80"
                      title="保存重命名"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setEditingTag(null)}
                      className="text-paper-muted hover:text-paper-text"
                      title="取消"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              }

              return (
                <div
                  key={t}
                  className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all ${
                    isSelected
                      ? 'bg-paper-terracotta dark:bg-night-terracotta text-white border-paper-terracotta dark:border-night-terracotta shadow-xs font-medium'
                      : 'bg-paper-drawer/70 dark:bg-night-drawer/70 text-paper-text dark:text-night-text border-paper-border/60 dark:border-night-border/60 hover:border-paper-terracotta/50'
                  }`}
                >
                  <button
                    onClick={() => onSelectTag?.(t)}
                    className="flex items-center gap-1.5 text-left"
                  >
                    <span>#{t}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-paper-card dark:bg-night-card text-paper-muted dark:text-night-muted'
                      }`}
                    >
                      {count}
                    </span>
                  </button>

                  {/* 编辑与删除按钮 */}
                  <div className="hidden group-hover:flex items-center gap-1 ml-1 pl-1 border-l border-current/20">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        setEditingTag(t);
                        setEditingValue(t);
                      }}
                      className="opacity-80 hover:opacity-100"
                      title={`重命名标签 #${t}`}
                      aria-label={`重命名标签 ${t}`}
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        onDeleteGlobalTag?.(t);
                      }}
                      className="opacity-80 hover:opacity-100 hover:text-red-300"
                      title={`删除标签 #${t}`}
                      aria-label={`删除标签 ${t}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. 当前选中标签的跨书笔记流 */}
      {activeTag && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-paper-border/60 dark:border-night-border/60">
            <div>
              <h2 className="font-serif text-2xl font-bold text-paper-text dark:text-night-text">
                #{activeTag}
              </h2>
              <p className="text-xs text-paper-muted dark:text-night-muted mt-1">
                跨越 <span className="font-semibold text-paper-text dark:text-night-text">{bookEntries.length}</span> 本书 · 共聚合{' '}
                <span className="font-semibold text-paper-text dark:text-night-text">{taggedAnnotations.length}</span> 条核心高亮与思考
              </p>
            </div>

            {taggedAnnotations.length > 0 && (
              <button
                onClick={handleCopyTopicMarkdown}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-paper-terracotta dark:bg-night-terracotta text-white text-xs font-medium shadow-sm hover:opacity-95 transition-opacity"
                title="将该主题下的所有跨书笔记生成并复制为 Markdown 综述"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? '已复制专题 Markdown' : '导出主题综述 Markdown'}</span>
              </button>
            )}
          </div>

          {taggedAnnotations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Sparkles className="w-10 h-10 text-paper-muted/40 dark:text-night-muted/40 mb-3" />
              <p className="font-serif text-base text-paper-text dark:text-night-text">
                「#{activeTag}」下暂无关联的高亮笔记
              </p>
              <p className="text-xs text-paper-muted dark:text-night-muted mt-1">
                进入任意书籍详情页，在高亮卡片左下角点击「+ 标签」即可直接点选绑定此标签
              </p>
            </div>
          ) : (
            <div className="space-y-10 max-w-4xl">
              {bookEntries.map(([assetId, items]) => {
                const matchedBook = books.find(b => b.assetId === assetId);
                const bookTitle = matchedBook?.title || items[0]?.bookTitle || '未知书籍';
                const bookAuthor = matchedBook?.author || '未知作者';

                return (
                  <section key={assetId} className="space-y-4">
                    <div className="flex items-center justify-between bg-paper-card dark:bg-night-card border border-paper-border dark:border-night-border rounded-xl px-4 py-3 shadow-2xs">
                      <div className="flex items-center gap-3">
                        <BookOpen className="w-4 h-4 text-paper-terracotta dark:text-night-terracotta flex-shrink-0" />
                        <div>
                          <button
                            onClick={() => matchedBook && onSelectBook(matchedBook)}
                            className="font-serif font-bold text-base text-paper-text dark:text-night-text hover:text-paper-terracotta dark:hover:text-night-terracotta transition-colors text-left"
                          >
                            《{bookTitle}》
                          </button>
                          <span className="text-xs text-paper-muted dark:text-night-muted ml-2">
                            {bookAuthor} · {items.length} 条相关笔记
                          </span>
                        </div>
                      </div>

                      {matchedBook && (
                        <button
                          onClick={() => onSelectBook(matchedBook)}
                          className="text-xs text-paper-terracotta dark:text-night-terracotta hover:underline"
                        >
                          进入本书精读 →
                        </button>
                      )}
                    </div>

                    <div className="space-y-4 pl-2 border-l-2 border-paper-border/70 dark:border-night-border/70">
                      {items.map(anno => (
                        <div key={anno.uuid} className="space-y-1">
                          <div className="text-[11px] text-paper-muted dark:text-night-muted px-1">
                            章节：{anno.chapterTitle || '默认章节'}
                          </div>
                          <HighlightCard
                            annotation={anno}
                            colorSemantics={colorSemantics}
                            availableTags={allTags}
                            allAnnotations={annotations}
                            onOpenInGraph={onOpenInGraph}
                            onToggleStar={onToggleStar}
                            onUpdateCustomNote={onUpdateCustomNote}
                            onAddTag={onAddTag}
                            onRemoveTag={onRemoveTag}
                            onOpenQuoteModal={onOpenQuoteModal}
                            onRequestContext={onRequestContext}
                          />
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
