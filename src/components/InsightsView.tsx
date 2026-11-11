import React, { useState } from 'react';
import {
  BookItem,
  AnnotationItem,
  ColorSemanticConfig,
  HighlightColor
} from '../../electron/types/ipc';
import {
  BarChart3,
  BookOpen,
  Highlighter,
  MessageSquareQuote,
  FileText,
  Calendar,
  Award,
  Palette,
  Edit2
} from 'lucide-react';

export interface InsightsViewProps {
  books: BookItem[];
  annotations: AnnotationItem[];
  colorSemantics: ColorSemanticConfig[];
  onSelectBook: (book: BookItem) => void;
  onOpenColorSettings?: () => void;
}

function toDateKey(ms: number): string {
  if (!ms || ms <= 0) return '未知日期';
  const d = new Date(ms);
  if (isNaN(d.getTime())) return '未知日期';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export const InsightsView: React.FC<InsightsViewProps> = ({
  books,
  annotations,
  colorSemantics,
  onSelectBook,
  onOpenColorSettings
}) => {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // 1. 核心阅读指标计算
  const totalBooks = books.length;
  const booksWithNotes = books.filter(b => (b.highlightsCount || 0) > 0);
  const totalHighlights = annotations.length;
  const notesAndStarredCount = annotations.filter(
    a => a.isStarred || Boolean(a.note?.trim() || a.customNote?.trim())
  ).length;

  const totalChars = annotations.reduce((sum, a) => {
    const selLen = (a.selectedText || '').length;
    const noteLen = (a.note || '').length;
    const customLen = (a.customNote || '').length;
    return sum + selLen + noteLen + customLen;
  }, 0);

  const formattedChars =
    totalChars >= 10000
      ? `${(totalChars / 10000).toFixed(1)} 万`
      : totalChars.toLocaleString();

  // 2. 按日期聚合思考活跃度（用于热力图与按日回溯）
  const dateMap: Record<string, AnnotationItem[]> = {};
  for (const anno of annotations) {
    const key = toDateKey(anno.modificationDateMs || anno.creationDateMs);
    if (key !== '未知日期') {
      if (!dateMap[key]) dateMap[key] = [];
      dateMap[key].push(anno);
    }
  }

  // 生成最近 84 天（12 周）的日历矩阵，如果历史数据不在最近 84 天，同时提供活跃日期榜单
  const today = new Date();
  const recentDays: { dateKey: string; count: number }[] = [];
  for (let i = 83; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000);
    const key = toDateKey(d.getTime());
    recentDays.push({
      dateKey: key,
      count: dateMap[key]?.length || 0
    });
  }

  const activeDatesSorted = Object.entries(dateMap)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 12);

  // 3. Top 5 重点精读书籍
  const topBooks = [...booksWithNotes]
    .sort((a, b) => b.highlightsCount - a.highlightsCount)
    .slice(0, 5);
  const maxBookHighlights = topBooks[0]?.highlightsCount || 1;

  // 4. 6 种色彩语义占比
  const colorCounts: Partial<Record<HighlightColor, number>> = {};
  for (const anno of annotations) {
    colorCounts[anno.colorKey] = (colorCounts[anno.colorKey] || 0) + 1;
  }

  const colorBreakdown = colorSemantics.map(sem => {
    const count = colorCounts[sem.colorKey] || 0;
    const pct = totalHighlights > 0 ? Math.round((count / totalHighlights) * 100) : 0;
    return {
      ...sem,
      count,
      pct
    };
  });

  const selectedDateAnnotations = selectedDate ? dateMap[selectedDate] || [] : [];

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-paper-bg dark:bg-night-bg text-paper-text dark:text-night-text">
      {/* 标题区 */}
      <div className="pb-6 mb-8 border-b border-paper-border dark:border-night-border app-drag">
        <h2 className="text-3xl font-serif font-bold text-paper-text dark:text-night-text flex items-center gap-2.5">
          <BarChart3 className="w-7 h-7 text-paper-terracotta dark:text-night-terracotta" />
          <span>阅读足迹与思考洞察</span>
        </h2>
        <p className="text-sm text-paper-muted dark:text-night-muted mt-1.5">
          以纸媒信息图视角，量化回顾你的藏书脉络、划线偏好与思考沉淀
        </p>
      </div>

      {/* 1. 核心指标卡（5 列纸媒数据网格） */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-10">
        <div className="p-4 rounded-xl bg-paper-card dark:bg-night-card border border-paper-border dark:border-night-border shadow-2xs">
          <div className="flex items-center justify-between text-xs text-paper-muted dark:text-night-muted mb-2">
            <span>总藏书量</span>
            <BookOpen className="w-4 h-4 text-paper-terracotta dark:text-night-terracotta" />
          </div>
          <div className="font-serif text-2xl font-bold text-paper-text dark:text-night-text">
            {totalBooks} <span className="text-xs font-normal text-paper-muted dark:text-night-muted">本</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-paper-card dark:bg-night-card border border-paper-border dark:border-night-border shadow-2xs">
          <div className="flex items-center justify-between text-xs text-paper-muted dark:text-night-muted mb-2">
            <span>有笔记书籍</span>
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          <div className="font-serif text-2xl font-bold text-paper-text dark:text-night-text">
            {booksWithNotes.length} <span className="text-xs font-normal text-paper-muted dark:text-night-muted">本</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-paper-card dark:bg-night-card border border-paper-border dark:border-night-border shadow-2xs">
          <div className="flex items-center justify-between text-xs text-paper-muted dark:text-night-muted mb-2">
            <span>累计高亮条数</span>
            <Highlighter className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="font-serif text-2xl font-bold text-paper-text dark:text-night-text">
            {totalHighlights} <span className="text-xs font-normal text-paper-muted dark:text-night-muted">条</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-paper-card dark:bg-night-card border border-paper-border dark:border-night-border shadow-2xs">
          <div className="flex items-center justify-between text-xs text-paper-muted dark:text-night-muted mb-2">
            <span>批注与思考</span>
            <MessageSquareQuote className="w-4 h-4 text-purple-500" />
          </div>
          <div className="font-serif text-2xl font-bold text-paper-text dark:text-night-text">
            {notesAndStarredCount} <span className="text-xs font-normal text-paper-muted dark:text-night-muted">条</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-paper-card dark:bg-night-card border border-paper-border dark:border-night-border shadow-2xs">
          <div className="flex items-center justify-between text-xs text-paper-muted dark:text-night-muted mb-2">
            <span>累计摘录字数</span>
            <FileText className="w-4 h-4 text-blue-500" />
          </div>
          <div className="font-serif text-2xl font-bold text-paper-text dark:text-night-text">
            {formattedChars} <span className="text-xs font-normal text-paper-muted dark:text-night-muted">字</span>
          </div>
        </div>
      </div>

      {/* 2. 思考活跃度热力图与按日回溯 */}
      <div className="mb-10 p-6 rounded-2xl bg-paper-card dark:bg-night-card border border-paper-border dark:border-night-border shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-paper-terracotta dark:text-night-terracotta" />
            <h3 className="font-serif text-base font-bold text-paper-text dark:text-night-text">
              思考活跃度热力图
            </h3>
          </div>
          <span className="text-xs text-paper-muted dark:text-night-muted">
            点击下方活跃日期可回溯当日记录的所有高亮
          </span>
        </div>

        {/* 12 周热力矩阵 */}
        <div className="grid grid-cols-12 sm:grid-cols-21 gap-1.5 mb-5" data-testid="insights-heatmap">
          {recentDays.map(({ dateKey, count }) => {
            const isSelected = selectedDate === dateKey;
            const colorClass =
              count === 0
                ? 'bg-paper-drawer dark:bg-night-drawer'
                : count <= 2
                ? 'bg-paper-terracotta/35 dark:bg-night-terracotta/35'
                : count <= 5
                ? 'bg-paper-terracotta/65 dark:bg-night-terracotta/65'
                : 'bg-paper-terracotta dark:bg-night-terracotta';

            return (
              <button
                key={dateKey}
                onClick={() => count > 0 && setSelectedDate(isSelected ? null : dateKey)}
                title={`${dateKey}: ${count} 条记录`}
                className={`h-4 rounded-xs transition-transform ${colorClass} ${
                  count > 0 ? 'cursor-pointer hover:scale-110' : 'cursor-default'
                } ${isSelected ? 'ring-2 ring-paper-text dark:ring-night-text' : ''}`}
              />
            );
          })}
        </div>

        {/* 历史活跃日期快捷胶囊 */}
        {activeDatesSorted.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-paper-border/60 dark:border-night-border/60">
            <span className="text-xs text-paper-muted dark:text-night-muted">活跃阅读日：</span>
            {activeDatesSorted.map(([dateKey, items]) => {
              const isSelected = selectedDate === dateKey;
              return (
                <button
                  key={dateKey}
                  onClick={() => setSelectedDate(isSelected ? null : dateKey)}
                  className={`px-2.5 py-1 rounded-full text-xs font-mono transition-colors ${
                    isSelected
                      ? 'bg-paper-terracotta dark:bg-night-terracotta text-white font-medium'
                      : 'bg-paper-drawer dark:bg-night-drawer text-paper-muted dark:text-night-muted hover:text-paper-text dark:hover:text-night-text'
                  }`}
                >
                  {dateKey} ({items.length})
                </button>
              );
            })}
          </div>
        )}

        {/* 选中日期的当日摘录回溯 */}
        {selectedDate && selectedDateAnnotations.length > 0 && (
          <div className="mt-5 pt-4 border-t border-paper-border dark:border-night-border space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-paper-terracotta dark:text-night-terracotta">
                📅 {selectedDate} 当日记录（{selectedDateAnnotations.length} 条）
              </span>
              <button
                onClick={() => setSelectedDate(null)}
                className="text-paper-muted dark:text-night-muted hover:text-paper-text dark:hover:text-night-text"
              >
                收起
              </button>
            </div>
            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {selectedDateAnnotations.map(a => (
                <div
                  key={a.uuid}
                  className="p-3 rounded-lg bg-paper-drawer/70 dark:bg-night-drawer/70 text-xs space-y-1"
                >
                  <div className="text-paper-muted dark:text-night-muted font-medium">
                    《{a.bookTitle || '未知书籍'}》 · {a.chapterTitle || '默认章节'}
                  </div>
                  <p className="font-serif text-paper-text dark:text-night-text">
                    “{a.selectedText}”
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 3. 双栏深度分布：Top 5 重点书籍 & 6 色语义分布 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左栏：Top 5 书籍榜单 */}
        <div className="p-6 rounded-2xl bg-paper-card dark:bg-night-card border border-paper-border dark:border-night-border shadow-2xs">
          <div className="flex items-center gap-2 mb-5">
            <Award className="w-4 h-4 text-paper-terracotta dark:text-night-terracotta" />
            <h3 className="font-serif text-base font-bold text-paper-text dark:text-night-text">
              重点精读书籍 Top 5
            </h3>
          </div>

          {topBooks.length === 0 ? (
            <p className="text-xs text-paper-muted dark:text-night-muted py-6 text-center">
              暂无带划线笔记的书籍
            </p>
          ) : (
            <div className="space-y-4">
              {topBooks.map((b, idx) => {
                const widthPct = Math.max(8, Math.round((b.highlightsCount / maxBookHighlights) * 100));
                return (
                  <div key={b.assetId} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <button
                        onClick={() => onSelectBook(b)}
                        className="font-serif font-medium text-paper-text dark:text-night-text hover:text-paper-terracotta dark:hover:text-night-terracotta truncate max-w-[240px] text-left transition-colors"
                      >
                        {idx + 1}. {b.title}
                      </button>
                      <span className="font-mono text-paper-muted dark:text-night-muted">
                        {b.highlightsCount} 条 · {Math.round((b.readingProgress || 0) * 100)}%
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-paper-drawer dark:bg-night-drawer overflow-hidden">
                      <div
                        className="h-full rounded-full bg-paper-terracotta dark:bg-night-terracotta transition-all"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 右栏：6 种色彩语义占比 */}
        <div className="p-6 rounded-2xl bg-paper-card dark:bg-night-card border border-paper-border dark:border-night-border shadow-2xs">
          <div className="flex items-center justify-between gap-2 mb-5">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-paper-terracotta dark:text-night-terracotta" />
              <h3 className="font-serif text-base font-bold text-paper-text dark:text-night-text">
                高亮色彩语义分布
              </h3>
            </div>
            {onOpenColorSettings && (
              <button
                onClick={onOpenColorSettings}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-paper-muted dark:text-night-muted hover:text-paper-terracotta dark:hover:text-night-terracotta hover:bg-paper-drawer dark:hover:bg-night-drawer transition-colors"
                title="编辑各高亮颜色代表的语义名称与色彩"
              >
                <Edit2 className="w-3 h-3" />
                <span>自定义语义</span>
              </button>
            )}
          </div>

          {/* 堆叠比例条 */}
          <div className="w-full h-3 rounded-full bg-paper-drawer dark:bg-night-drawer overflow-hidden flex mb-6">
            {colorBreakdown
              .filter(c => c.count > 0)
              .map(c => (
                <div
                  key={c.colorKey}
                  style={{
                    width: `${Math.max(4, c.pct)}%`,
                    backgroundColor: c.hexColor
                  }}
                  title={`${c.label}: ${c.count} 条 (${c.pct}%)`}
                />
              ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {colorBreakdown.map(c => (
              <div
                key={c.colorKey}
                className="flex items-center justify-between p-2.5 rounded-lg bg-paper-drawer/60 dark:bg-night-drawer/60 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: c.hexColor }}
                  />
                  <span className="text-paper-text dark:text-night-text font-medium">
                    {c.label}
                  </span>
                </div>
                <span className="font-mono text-paper-muted dark:text-night-muted">
                  {c.count} ({c.pct}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
