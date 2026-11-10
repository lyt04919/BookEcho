import React, { useState } from 'react';
import {
  BookItem,
  AnnotationItem,
  ColorSemanticConfig,
  HighlightContextResult
} from '../../electron/types/ipc';
import { HighlightCard } from './HighlightCard';
import { Tag, ArrowLeft, BookOpen, Copy, Check, Sparkles } from 'lucide-react';

export interface TagTopicViewProps {
  tag: string;
  annotations: AnnotationItem[];
  books: BookItem[];
  colorSemantics: ColorSemanticConfig[];
  onClearTag: () => void;
  onSelectBook: (book: BookItem) => void;
  onToggleStar: (uuid: string) => void;
  onUpdateCustomNote: (uuid: string, note: string) => void;
  onAddTag: (uuid: string, tag: string) => void;
  onRemoveTag: (uuid: string, tag: string) => void;
  onOpenQuoteModal: (annotation: AnnotationItem) => void;
  onRequestContext: (annotation: AnnotationItem) => Promise<HighlightContextResult>;
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
  tag,
  annotations,
  books,
  colorSemantics,
  onClearTag,
  onSelectBook,
  onToggleStar,
  onUpdateCustomNote,
  onAddTag,
  onRemoveTag,
  onOpenQuoteModal,
  onRequestContext
}) => {
  const [copied, setCopied] = useState(false);

  const taggedAnnotations = annotations.filter(a => (a.tags || []).includes(tag));

  // 按书籍聚合
  const bookGroups = taggedAnnotations.reduce((acc, anno) => {
    if (!acc[anno.assetId]) acc[anno.assetId] = [];
    acc[anno.assetId].push(anno);
    return acc;
  }, {} as Record<string, AnnotationItem[]>);

  const bookEntries = Object.entries(bookGroups);

  const handleCopyTopicMarkdown = async () => {
    const md = formatTagTopicMarkdown(tag, taggedAnnotations, books);
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
      {/* 顶部返回与操作栏 */}
      <div className="flex items-center justify-between pb-6 mb-8 border-b border-paper-border dark:border-night-border">
        <button
          onClick={onClearTag}
          className="flex items-center gap-1.5 text-sm text-paper-muted dark:text-night-muted hover:text-paper-text dark:hover:text-night-text transition-colors"
          aria-label="退出标签专题"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>返回上一视图</span>
        </button>

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

      {/* 专题横幅 */}
      <div className="mb-10 pb-6 border-b border-paper-border/60 dark:border-night-border/60">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-paper-terracotta/10 dark:bg-night-terracotta/15 text-paper-terracotta dark:text-night-terracotta text-xs font-medium mb-3">
          <Tag className="w-3.5 h-3.5" />
          <span>跨书主题聚合工作台</span>
        </div>
        <h1 className="font-serif text-3xl font-bold text-paper-text dark:text-night-text">
          #{tag}
        </h1>
        <p className="text-sm text-paper-muted dark:text-night-muted mt-2">
          跨越 <span className="font-semibold text-paper-text dark:text-night-text">{bookEntries.length}</span> 本书 · 共聚合{' '}
          <span className="font-semibold text-paper-text dark:text-night-text">{taggedAnnotations.length}</span> 条核心高亮与思考
        </p>
      </div>

      {/* 按书分组展示 */}
      {taggedAnnotations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Sparkles className="w-10 h-10 text-paper-muted/40 dark:text-night-muted/40 mb-3" />
          <p className="font-serif text-base text-paper-text dark:text-night-text">
            该标签下暂无关联的高亮笔记
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
  );
};
