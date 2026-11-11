import React, { useState, useMemo } from 'react';
import {
  BookItem,
  AnnotationItem,
  ColorSemanticConfig,
  HighlightColor,
  AppleBooksReadingStats,
  DailyReadingStat
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
  Edit2,
  Clock,
  Flame,
  Hash,
  ArrowUpRight,
  Layers,
  Timer,
  Target,
  CheckCircle2
} from 'lucide-react';

export interface InsightsViewProps {
  books: BookItem[];
  annotations: AnnotationItem[];
  colorSemantics: ColorSemanticConfig[];
  hiddenBookIds?: string[];
  readingStats?: AppleBooksReadingStats | null;
  onSelectBook: (book: BookItem) => void;
  onOpenColorSettings?: () => void;
  onOpenTagInGraph?: (tag: string) => void;
  defaultSelectedDate?: string | null;
}

export function formatReadingDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0 分钟';
  if (seconds < 60) return `${Math.round(seconds)} 秒`;
  if (seconds < 3600) {
    const mins = seconds / 60;
    const formatted = mins < 10 ? mins.toFixed(1).replace(/\.0$/, '') : String(Math.round(mins));
    return `${formatted} 分钟`;
  }
  const hours = (seconds / 3600).toFixed(1).replace(/\.0$/, '');
  return `${hours} 小时`;
}

export function resolveAnnotationTimestamp(anno: AnnotationItem): number {
  if (anno.creationDateMs && anno.creationDateMs > 0) return anno.creationDateMs;
  if (anno.modificationDateMs && anno.modificationDateMs > 0) return anno.modificationDateMs;
  return 0;
}

export function toDateKey(ms: number): string {
  if (!ms || ms <= 0) return '未知日期';
  const d = new Date(ms);
  if (isNaN(d.getTime())) return '未知日期';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export interface CalendarCell {
  dateKey: string;
  count: number;
  inRange: boolean;
  month: number;
  dayOfMonth: number;
}

/**
 * 构建真实周历矩阵（每列为完整 7 天：周一至周日）
 * rangeKey 为 'rolling_year'（最近 52 周）或具体四位年份（如 '2026'）
 */
export function buildCalendarWeeks(
  dateCountMap: Record<string, number>,
  rangeKey: string,
  referenceDate: Date = new Date()
): { weeks: CalendarCell[][]; monthLabels: { weekIndex: number; label: string }[] } {
  let startDate: Date;
  let endDate: Date;

  if (rangeKey === 'rolling_year') {
    endDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
    // 回溯大约 52 周
    startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 363);
  } else {
    const year = Number(rangeKey) || referenceDate.getFullYear();
    startDate = new Date(year, 0, 1);
    endDate = new Date(year, 11, 31);
  }

  // 将网格起点对齐到周一（JS getDay(): 0=周日, 1=周一 ... 6=周六）
  const startDow = (startDate.getDay() + 6) % 7; // 0=周一, 6=周日
  const gridStart = new Date(startDate);
  gridStart.setDate(gridStart.getDate() - startDow);

  const endDow = (endDate.getDay() + 6) % 7;
  const gridEnd = new Date(endDate);
  gridEnd.setDate(gridEnd.getDate() + (6 - endDow));

  const weeks: CalendarCell[][] = [];
  const monthLabels: { weekIndex: number; label: string }[] = [];
  let lastLabeledMonth = -1;

  const cursor = new Date(gridStart);
  while (cursor <= gridEnd) {
    const week: CalendarCell[] = [];
    const weekIndex = weeks.length;
    for (let i = 0; i < 7; i++) {
      const inRange = cursor >= startDate && cursor <= endDate;
      const key = toDateKey(cursor.getTime());
      const month = cursor.getMonth();
      const dayOfMonth = cursor.getDate();

      if (inRange && month !== lastLabeledMonth && dayOfMonth <= 7) {
        monthLabels.push({ weekIndex, label: `${month + 1}月` });
        lastLabeledMonth = month;
      }

      week.push({
        dateKey: key,
        count: inRange ? dateCountMap[key] || 0 : 0,
        inRange,
        month,
        dayOfMonth
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }

  return { weeks, monthLabels };
}

/**
 * 计算活跃天数、最长连续阅读天数与当前连续天数
 */
export function calculateStreaks(dateKeys: string[]): {
  activeDays: number;
  longestStreak: number;
  currentStreak: number;
} {
  const uniqueSorted = Array.from(new Set(dateKeys.filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k)))).sort();
  if (uniqueSorted.length === 0) {
    return { activeDays: 0, longestStreak: 0, currentStreak: 0 };
  }

  const toDayNumber = (k: string) => {
    const [y, m, d] = k.split('-').map(Number);
    return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
  };

  let longest = 1;
  let running = 1;
  for (let i = 1; i < uniqueSorted.length; i++) {
    if (toDayNumber(uniqueSorted[i]) - toDayNumber(uniqueSorted[i - 1]) === 1) {
      running++;
      if (running > longest) longest = running;
    } else {
      running = 1;
    }
  }

  // 计算截止今日或昨日的当前连续天数
  const today = new Date();
  const todayNum = Math.floor(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / 86400000);
  const lastNum = toDayNumber(uniqueSorted[uniqueSorted.length - 1]);
  let currentStreak = 0;
  if (todayNum - lastNum <= 1) {
    currentStreak = 1;
    for (let i = uniqueSorted.length - 2; i >= 0; i--) {
      if (toDayNumber(uniqueSorted[i + 1]) - toDayNumber(uniqueSorted[i]) === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  return {
    activeDays: uniqueSorted.length,
    longestStreak: longest,
    currentStreak
  };
}

/**
 * 统计 24 小时阅读生物钟与周一~周日活跃节律
 */
export function computeReadingRhythm(annotations: AnnotationItem[]): {
  hourlyCounts: number[];
  weekdayCounts: number[]; // 0=周一 .. 6=周日
  peakHour: number | null;
  chronotypeLabel: string;
} {
  const hourlyCounts = new Array<number>(24).fill(0);
  const weekdayCounts = new Array<number>(7).fill(0);

  for (const anno of annotations) {
    const ts = resolveAnnotationTimestamp(anno);
    if (!ts) continue;
    const d = new Date(ts);
    if (isNaN(d.getTime())) continue;
    hourlyCounts[d.getHours()]++;
    const dow = (d.getDay() + 6) % 7;
    weekdayCounts[dow]++;
  }

  let peakHour: number | null = null;
  let peakVal = 0;
  for (let h = 0; h < 24; h++) {
    if (hourlyCounts[h] > peakVal) {
      peakVal = hourlyCounts[h];
      peakHour = h;
    }
  }

  let chronotypeLabel = '等待更多划线记录';
  if (peakHour !== null) {
    if (peakHour >= 5 && peakHour < 9) chronotypeLabel = '🌅 清晨阅读者';
    else if (peakHour >= 9 && peakHour < 12) chronotypeLabel = '☀️ 上午专注型';
    else if (peakHour >= 12 && peakHour < 18) chronotypeLabel = '🌤 午后漫读型';
    else if (peakHour >= 18 && peakHour < 22) chronotypeLabel = '🌆 傍晚沉淀型';
    else chronotypeLabel = '🌙 深夜沉浸型';
  }

  return { hourlyCounts, weekdayCounts, peakHour, chronotypeLabel };
}

const WEEKDAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

export const InsightsView: React.FC<InsightsViewProps> = ({
  books,
  annotations,
  colorSemantics,
  hiddenBookIds = [],
  readingStats = null,
  onSelectBook,
  onOpenColorSettings,
  onOpenTagInGraph,
  defaultSelectedDate = null
}) => {
  const [selectedDate, setSelectedDate] = useState<string | null>(defaultSelectedDate);
  const [rangeKey, setRangeKey] = useState<string>('rolling_year');
  const [heatmapMode, setHeatmapMode] = useState<'highlights' | 'duration'>('highlights');

  const hiddenSet = useMemo(() => new Set(hiddenBookIds), [hiddenBookIds]);
  const visibleBooks = useMemo(
    () => books.filter(b => !hiddenSet.has(b.assetId)),
    [books, hiddenSet]
  );
  const bookMap = useMemo(() => new Map(books.map(b => [b.assetId, b])), [books]);
  const semanticMap = useMemo(
    () => new Map(colorSemantics.map(c => [c.colorKey, c])),
    [colorSemantics]
  );

  // 1. 核心阅读指标计算
  const totalBooks = visibleBooks.length;
  const booksWithNotes = visibleBooks.filter(b => (b.highlightsCount || 0) > 0);
  const totalHighlights = annotations.length;
  const notesAndStarredAnnos = annotations.filter(
    a => a.isStarred || Boolean(a.note?.trim() || a.customNote?.trim())
  );
  const notesAndStarredCount = notesAndStarredAnnos.length;
  const thinkingRatio =
    totalHighlights > 0 ? Math.round((notesAndStarredCount / totalHighlights) * 100) : 0;

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

  // 2. 按原始划线日期聚合足迹（修复 modificationDateMs 导致的足迹漂移问题）
  const { dateMap, dateCountMap, availableYears, monthCurrentCount, monthPrevCount } = useMemo(() => {
    const map: Record<string, AnnotationItem[]> = {};
    const counts: Record<string, number> = {};
    const years = new Set<string>();
    const now = new Date();
    const curMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthPrefix = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    let curMonth = 0;
    let prevMonth = 0;

    for (const anno of annotations) {
      const ts = resolveAnnotationTimestamp(anno);
      const key = toDateKey(ts);
      if (key !== '未知日期') {
        if (!map[key]) map[key] = [];
        map[key].push(anno);
        counts[key] = (counts[key] || 0) + 1;
        years.add(key.slice(0, 4));
        if (key.startsWith(curMonthPrefix)) curMonth++;
        else if (key.startsWith(prevMonthPrefix)) prevMonth++;
      }
    }

    if (readingStats?.dailyHistory) {
      for (const d of readingStats.dailyHistory) {
        if (d.date.length >= 4) years.add(d.date.slice(0, 4));
      }
    }

    return {
      dateMap: map,
      dateCountMap: counts,
      availableYears: Array.from(years).sort((a, b) => b.localeCompare(a)),
      monthCurrentCount: curMonth,
      monthPrevCount: prevMonth
    };
  }, [annotations, readingStats]);

  // Apple Books 每日阅读时长索引与当日打开书籍索引
  const { readingTimeMap, readingMinutesCountMap, recentReadingDays } = useMemo(() => {
    const tMap: Record<string, DailyReadingStat> = {};
    const mMap: Record<string, number> = {};
    const history = readingStats?.dailyHistory || [];
    for (const item of history) {
      tMap[item.date] = item;
      if (item.readingTimeSec > 0) {
        mMap[item.date] = Math.max(1, Math.round(item.readingTimeSec / 60));
      }
    }
    return {
      readingTimeMap: tMap,
      readingMinutesCountMap: mMap,
      recentReadingDays: history.slice(-14)
    };
  }, [readingStats]);

  const booksOpenedByDate = useMemo(() => {
    const map: Record<string, BookItem[]> = {};
    for (const b of visibleBooks) {
      if (b.lastOpenDateMs) {
        const key = toDateKey(b.lastOpenDateMs);
        if (key !== '未知日期') {
          if (!map[key]) map[key] = [];
          map[key].push(b);
        }
      }
    }
    return map;
  }, [visibleBooks]);

  const effectiveHeatmapMode = readingStats?.available && readingStats.dailyHistory.length > 0 ? heatmapMode : 'highlights';
  const activeHeatmapCounts = effectiveHeatmapMode === 'duration' ? readingMinutesCountMap : dateCountMap;

  const streaks = useMemo(() => {
    const keys =
      effectiveHeatmapMode === 'duration' ? Object.keys(readingMinutesCountMap) : Object.keys(dateMap);
    return calculateStreaks(keys);
  }, [effectiveHeatmapMode, readingMinutesCountMap, dateMap]);

  const { weeks, monthLabels } = useMemo(
    () => buildCalendarWeeks(activeHeatmapCounts, rangeKey),
    [activeHeatmapCounts, rangeKey]
  );

  const activeDatesSorted = useMemo(() => {
    if (effectiveHeatmapMode === 'duration') {
      const entries = Object.entries(readingTimeMap).filter(([, s]) => s.readingTimeSec > 0);
      const filtered =
        rangeKey === 'rolling_year' ? entries : entries.filter(([dateKey]) => dateKey.startsWith(rangeKey));
      return (filtered.length > 0 ? filtered : entries)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, 12)
        .map(([dateKey, stat]) => ({
          dateKey,
          label: `${dateKey} (${formatReadingDuration(stat.readingTimeSec)})`
        }));
    }

    const entries = Object.entries(dateMap);
    const filtered =
      rangeKey === 'rolling_year'
        ? entries
        : entries.filter(([dateKey]) => dateKey.startsWith(rangeKey));
    return (filtered.length > 0 ? filtered : entries)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 12)
      .map(([dateKey, items]) => ({
        dateKey,
        label: `${dateKey} (${items.length})`
      }));
  }, [effectiveHeatmapMode, readingTimeMap, dateMap, rangeKey]);

  // 3. 阅读生物钟 & 周节律
  const rhythm = useMemo(() => computeReadingRhythm(annotations), [annotations]);
  const maxHourCount = Math.max(1, ...rhythm.hourlyCounts);
  const maxWeekdayCount = Math.max(1, ...rhythm.weekdayCounts);

  // 4. Top 5 重点精读书籍（附加每本书批注思考密度）
  const bookNoteStats = useMemo(() => {
    const stats = new Map<string, { total: number; withNotes: number }>();
    for (const a of annotations) {
      const cur = stats.get(a.assetId) || { total: 0, withNotes: 0 };
      cur.total++;
      if (a.isStarred || a.note?.trim() || a.customNote?.trim()) cur.withNotes++;
      stats.set(a.assetId, cur);
    }
    return stats;
  }, [annotations]);

  const topBooks = [...booksWithNotes]
    .sort((a, b) => b.highlightsCount - a.highlightsCount)
    .slice(0, 5);
  const maxBookHighlights = topBooks[0]?.highlightsCount || 1;

  // 5. 6 种色彩语义占比与每色批注率
  const colorBreakdown = useMemo(() => {
    const counts: Partial<Record<HighlightColor, number>> = {};
    const withNotes: Partial<Record<HighlightColor, number>> = {};
    for (const anno of annotations) {
      counts[anno.colorKey] = (counts[anno.colorKey] || 0) + 1;
      if (anno.isStarred || anno.note?.trim() || anno.customNote?.trim()) {
        withNotes[anno.colorKey] = (withNotes[anno.colorKey] || 0) + 1;
      }
    }
    return colorSemantics.map(sem => {
      const count = counts[sem.colorKey] || 0;
      const noted = withNotes[sem.colorKey] || 0;
      const pct = totalHighlights > 0 ? Math.round((count / totalHighlights) * 100) : 0;
      const noteRate = count > 0 ? Math.round((noted / count) * 100) : 0;
      return { ...sem, count, pct, noteRate };
    });
  }, [annotations, colorSemantics, totalHighlights]);

  // 6. 主题标签与书籍领域分布
  const { topTags, topGenres } = useMemo(() => {
    const tagMap: Record<string, number> = {};
    for (const a of annotations) {
      if (a.tags) {
        for (const t of a.tags) {
          tagMap[t] = (tagMap[t] || 0) + 1;
        }
      }
    }
    const sortedTags = Object.entries(tagMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const genreMap: Record<string, number> = {};
    for (const b of booksWithNotes) {
      const g = b.genre?.trim();
      if (g && g !== '未分类') {
        genreMap[g] = (genreMap[g] || 0) + (b.highlightsCount || 1);
      }
    }
    const sortedGenres = Object.entries(genreMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    return { topTags: sortedTags, topGenres: sortedGenres };
  }, [annotations, booksWithNotes]);

  const selectedDateAnnotations = selectedDate ? dateMap[selectedDate] || [] : [];
  const selectedDayReading = selectedDate ? readingTimeMap[selectedDate] : undefined;
  const selectedDayOpenedBooks = selectedDate ? booksOpenedByDate[selectedDate] || [] : [];
  const monthDelta = monthCurrentCount - monthPrevCount;

  const todayGoalPct =
    readingStats && readingStats.dailyGoalSec > 0
      ? Math.min(100, Math.round((readingStats.todayReadingSec / readingStats.dailyGoalSec) * 100))
      : 0;
  const todayGoalMet = Boolean(
    readingStats && readingStats.dailyGoalSec > 0 && readingStats.todayReadingSec >= readingStats.dailyGoalSec
  );

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-paper-bg dark:bg-night-bg text-paper-text dark:text-night-text">
      {/* 标题区 */}
      <div className="pb-6 mb-8 border-b border-paper-border dark:border-night-border app-drag">
        <h2 className="text-3xl font-serif font-bold text-paper-text dark:text-night-text flex items-center gap-2.5">
          <BarChart3 className="w-7 h-7 text-paper-terracotta dark:text-night-terracotta" />
          <span>阅读足迹与思考洞察</span>
        </h2>
        <p className="text-sm text-paper-muted dark:text-night-muted mt-1.5">
          以真实阅读时间线与思考深度，回顾你的藏书脉络、阅读节律与知识沉淀
        </p>
      </div>

      {/* 1. 核心指标卡（5 列纸媒数据网格） */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <div className="p-4 rounded-xl bg-paper-card dark:bg-night-card border border-paper-border dark:border-night-border shadow-2xs">
          <div className="flex items-center justify-between text-xs text-paper-muted dark:text-night-muted mb-2">
            <span>总藏书量</span>
            <BookOpen className="w-4 h-4 text-paper-terracotta dark:text-night-terracotta" />
          </div>
          <div className="font-serif text-2xl font-bold text-paper-text dark:text-night-text">
            {totalBooks} <span className="text-xs font-normal text-paper-muted dark:text-night-muted">本</span>
          </div>
          <div className="text-[11px] text-paper-muted/80 dark:text-night-muted/80 mt-1">
            {hiddenSet.size > 0 ? `已排除隐藏 ${hiddenSet.size} 本` : '书架在读藏书'}
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
          <div className="text-[11px] text-paper-muted/80 dark:text-night-muted/80 mt-1">
            占比 {totalBooks > 0 ? Math.round((booksWithNotes.length / totalBooks) * 100) : 0}%
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
          <div className="text-[11px] text-paper-muted/80 dark:text-night-muted/80 mt-1">
            本月 {monthCurrentCount} 条{monthDelta !== 0 ? `（较上月 ${monthDelta > 0 ? `+${monthDelta}` : monthDelta}）` : ''}
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
          <div className="text-[11px] text-purple-600/90 dark:text-purple-400/90 mt-1 font-medium">
            深度思考率 {thinkingRatio}%
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
          <div className="text-[11px] text-paper-muted/80 dark:text-night-muted/80 mt-1">
            累计活跃 {streaks.activeDays} 天
          </div>
        </div>
      </div>

      {/* 1.5 Apple Books 每日阅读时长与目标卡片（直接读取 Apple Books 本地统计） */}
      {readingStats?.available && (
        <div
          data-testid="insights-reading-duration"
          className="mb-8 p-6 rounded-2xl bg-paper-card dark:bg-night-card border border-paper-border dark:border-night-border shadow-2xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4 text-paper-terracotta dark:text-night-terracotta" />
              <h3 className="font-serif text-base font-bold text-paper-text dark:text-night-text">
                Apple Books 每日阅读时长与目标
              </h3>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-paper-drawer dark:bg-night-drawer text-paper-muted dark:text-night-muted">
                同步自 Apple Books 统计
              </span>
            </div>
            {readingStats.yearlyBooksFinishedGoal > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-paper-muted dark:text-night-muted">
                <Target className="w-3.5 h-3.5 text-amber-500" />
                <span>
                  年度完书目标：<strong className="text-paper-text dark:text-night-text font-mono">{readingStats.currentYearBooksFinished} / {readingStats.yearlyBooksFinishedGoal}</strong> 本
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* 左：今日进度 & 累计统计 */}
            <div className="lg:col-span-5 space-y-4">
              <div className="p-4 rounded-xl bg-paper-drawer/70 dark:bg-night-drawer/70 border border-paper-border/50 dark:border-night-border/50 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-paper-muted dark:text-night-muted font-medium">今日阅读进度</span>
                  {todayGoalMet ? (
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>已达成目标</span>
                    </span>
                  ) : (
                    <span className="font-mono text-paper-muted dark:text-night-muted">{todayGoalPct}%</span>
                  )}
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="font-serif text-2xl font-bold text-paper-text dark:text-night-text">
                    {formatReadingDuration(readingStats.todayReadingSec)}
                  </span>
                  {readingStats.dailyGoalSec > 0 && (
                    <span className="text-xs text-paper-muted dark:text-night-muted">
                      每日目标 {formatReadingDuration(readingStats.dailyGoalSec)}
                    </span>
                  )}
                </div>
                <div className="w-full h-2 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      todayGoalMet
                        ? 'bg-emerald-500'
                        : 'bg-paper-terracotta dark:bg-night-terracotta'
                    }`}
                    style={{ width: `${Math.max(readingStats.todayReadingSec > 0 ? 4 : 0, todayGoalPct)}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-paper-drawer/50 dark:bg-night-drawer/50">
                  <div className="text-[11px] text-paper-muted dark:text-night-muted">累计记录时长</div>
                  <div className="font-serif text-base font-bold text-paper-text dark:text-night-text mt-0.5">
                    {formatReadingDuration(readingStats.totalReadingSec)}
                  </div>
                  <div className="text-[10px] text-paper-muted/80 dark:text-night-muted/80">
                    覆盖 {readingStats.dailyHistory.length} 个阅读日
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-paper-drawer/50 dark:bg-night-drawer/50">
                  <div className="text-[11px] text-paper-muted dark:text-night-muted">目标连续达标</div>
                  <div className="font-serif text-base font-bold text-paper-text dark:text-night-text mt-0.5">
                    {readingStats.currentStreakDays} 天
                  </div>
                  <div className="text-[10px] text-paper-muted/80 dark:text-night-muted/80">
                    历史最长 {readingStats.allTimeRecordStreakDays} 天
                  </div>
                </div>
              </div>
            </div>

            {/* 右：近期每日阅读时长趋势柱状图 */}
            <div className="lg:col-span-7">
              <div className="flex items-center justify-between text-xs text-paper-muted dark:text-night-muted mb-3">
                <span>近期活跃日每日阅读时长</span>
                <span className="text-[11px]">点击任意柱条可查看当日书籍与划线</span>
              </div>
              {recentReadingDays.length === 0 ? (
                <p className="text-xs text-paper-muted py-8 text-center">暂无每日阅读时长记录</p>
              ) : (
                <div className="h-32 flex items-end gap-2 pt-3 border-b border-paper-border/60 dark:border-night-border/60 pb-1">
                  {(() => {
                    const maxSec = Math.max(
                      readingStats.dailyGoalSec || 1200,
                      ...recentReadingDays.map(d => d.readingTimeSec)
                    );
                    return recentReadingDays.map(day => {
                      const pct = Math.max(8, Math.round((day.readingTimeSec / maxSec) * 100));
                      const isSelected = selectedDate === day.date;
                      const mins = Math.max(1, Math.round(day.readingTimeSec / 60));
                      return (
                        <button
                          type="button"
                          key={day.date}
                          onClick={() => setSelectedDate(isSelected ? null : day.date)}
                          title={`${day.date}：阅读 ${formatReadingDuration(day.readingTimeSec)}${day.goalMet ? '（已达标）' : ''}`}
                          className="flex-1 flex flex-col items-center justify-end h-full group cursor-pointer"
                        >
                          <span className="text-[9px] font-mono text-paper-muted dark:text-night-muted mb-1 opacity-80 group-hover:opacity-100">
                            {mins}m
                          </span>
                          <div
                            style={{ height: `${pct}%` }}
                            className={`w-full max-w-[26px] rounded-t-md transition-all ${
                              day.goalMet
                                ? 'bg-emerald-500/80 dark:bg-emerald-400/80 group-hover:bg-emerald-500'
                                : 'bg-paper-terracotta/65 dark:bg-night-terracotta/65 group-hover:bg-paper-terracotta'
                            } ${isSelected ? 'ring-2 ring-paper-text dark:ring-night-text' : ''}`}
                          />
                        </button>
                      );
                    });
                  })()}
                </div>
              )}
              {recentReadingDays.length > 0 && (
                <div className="flex gap-2 text-[9px] font-mono text-paper-muted dark:text-night-muted mt-1.5 text-center">
                  {recentReadingDays.map(day => (
                    <span key={day.date} className="flex-1 truncate">
                      {day.date.slice(5)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. 年度日历热力图与按日回溯 */}
      <div className="mb-8 p-6 rounded-2xl bg-paper-card dark:bg-night-card border border-paper-border dark:border-night-border shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-paper-terracotta dark:text-night-terracotta" />
              <h3 className="font-serif text-base font-bold text-paper-text dark:text-night-text">
                思考活跃度热力图
              </h3>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-paper-muted dark:text-night-muted bg-paper-drawer dark:bg-night-drawer px-2.5 py-1 rounded-full">
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              <span>活跃 {streaks.activeDays} 天</span>
              <span className="opacity-40">·</span>
              <span>最长连读 {streaks.longestStreak} 天</span>
              {streaks.currentStreak > 0 && (
                <>
                  <span className="opacity-40">·</span>
                  <span className="text-paper-terracotta dark:text-night-terracotta font-medium">
                    当前连读 {streaks.currentStreak} 天
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* 维度切换：按划线笔记 vs 按阅读时长 */}
            {readingStats?.available && readingStats.dailyHistory.length > 0 && (
              <div className="flex items-center gap-1 bg-paper-drawer dark:bg-night-drawer p-0.5 rounded-lg border border-paper-border/60 dark:border-night-border text-xs">
                <button
                  type="button"
                  onClick={() => setHeatmapMode('highlights')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    effectiveHeatmapMode === 'highlights'
                      ? 'bg-white dark:bg-night-card text-paper-text dark:text-night-text font-medium shadow-2xs'
                      : 'text-paper-muted dark:text-night-muted hover:text-paper-text dark:hover:text-night-text'
                  }`}
                >
                  按划线笔记
                </button>
                <button
                  type="button"
                  onClick={() => setHeatmapMode('duration')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    effectiveHeatmapMode === 'duration'
                      ? 'bg-white dark:bg-night-card text-paper-text dark:text-night-text font-medium shadow-2xs'
                      : 'text-paper-muted dark:text-night-muted hover:text-paper-text dark:hover:text-night-text'
                  }`}
                >
                  按阅读时长
                </button>
              </div>
            )}

            {/* 年份与周期切换 */}
            <div className="flex items-center gap-1 bg-paper-drawer dark:bg-night-drawer p-0.5 rounded-lg border border-paper-border/60 dark:border-night-border text-xs">
              <button
                type="button"
                onClick={() => setRangeKey('rolling_year')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  rangeKey === 'rolling_year'
                    ? 'bg-white dark:bg-night-card text-paper-text dark:text-night-text font-medium shadow-2xs'
                    : 'text-paper-muted dark:text-night-muted hover:text-paper-text dark:hover:text-night-text'
                }`}
              >
                近一年
              </button>
              {availableYears.slice(0, 4).map(yr => (
                <button
                  type="button"
                  key={yr}
                  onClick={() => setRangeKey(yr)}
                  className={`px-2.5 py-1 rounded-md transition-colors font-mono ${
                    rangeKey === yr
                      ? 'bg-white dark:bg-night-card text-paper-text dark:text-night-text font-medium shadow-2xs'
                      : 'text-paper-muted dark:text-night-muted hover:text-paper-text dark:hover:text-night-text'
                  }`}
                >
                  {yr}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 标准 GitHub 式 52 周 × 7 天日历热力矩阵 */}
        <div className="overflow-x-auto pb-2" data-testid="insights-heatmap">
          <div className="inline-flex flex-col min-w-max">
            {/* 月份标尺 */}
            <div className="flex items-center mb-1.5 pl-7 text-[10px] text-paper-muted dark:text-night-muted relative h-4">
              {monthLabels.map(m => (
                <span
                  key={`${m.weekIndex}-${m.label}`}
                  style={{ left: `${28 + m.weekIndex * 15}px` }}
                  className="absolute whitespace-nowrap"
                >
                  {m.label}
                </span>
              ))}
            </div>

            <div className="flex items-start gap-2">
              {/* 星期纵轴标签 */}
              <div className="grid grid-rows-7 gap-1 text-[10px] text-paper-muted dark:text-night-muted leading-none py-0.5 select-none">
                <span className="h-[11px] flex items-center">一</span>
                <span className="h-[11px]" />
                <span className="h-[11px] flex items-center">三</span>
                <span className="h-[11px]" />
                <span className="h-[11px] flex items-center">五</span>
                <span className="h-[11px]" />
                <span className="h-[11px] flex items-center">日</span>
              </div>

              {/* 52周纵向网格列 */}
              <div className="flex gap-1">
                {weeks.map((week, wIdx) => (
                  <div key={wIdx} className="grid grid-rows-7 gap-1">
                    {week.map(cell => {
                      if (!cell.inRange) {
                        return <div key={cell.dateKey} className="w-[11px] h-[11px]" />;
                      }
                      const isSelected = selectedDate === cell.dateKey;
                      const dayDuration = readingTimeMap[cell.dateKey];
                      let colorClass = 'bg-paper-drawer dark:bg-night-drawer';
                      if (effectiveHeatmapMode === 'duration') {
                        const sec = dayDuration?.readingTimeSec || 0;
                        const goal = dayDuration?.readingGoalSec || 1200;
                        if (sec > 0) {
                          if (sec < goal * 0.5) colorClass = 'bg-emerald-500/30 dark:bg-emerald-400/30';
                          else if (sec < goal) colorClass = 'bg-emerald-500/60 dark:bg-emerald-400/60';
                          else colorClass = 'bg-emerald-500 dark:bg-emerald-400';
                        }
                      } else if (cell.count > 0) {
                        colorClass =
                          cell.count <= 2
                            ? 'bg-paper-terracotta/35 dark:bg-night-terracotta/35'
                            : cell.count <= 5
                            ? 'bg-paper-terracotta/65 dark:bg-night-terracotta/65'
                            : 'bg-paper-terracotta dark:bg-night-terracotta';
                      }

                      const tooltip =
                        effectiveHeatmapMode === 'duration'
                          ? `${cell.dateKey}: ${
                              dayDuration ? `阅读 ${formatReadingDuration(dayDuration.readingTimeSec)}` : '无阅读记录'
                            }`
                          : `${cell.dateKey}: ${cell.count} 条划线${
                              dayDuration ? `（当日阅读 ${formatReadingDuration(dayDuration.readingTimeSec)}）` : ''
                            }`;

                      const isClickable = cell.count > 0 || Boolean(dayDuration && dayDuration.readingTimeSec > 0);

                      return (
                        <button
                          type="button"
                          key={cell.dateKey}
                          onClick={() =>
                            isClickable && setSelectedDate(isSelected ? null : cell.dateKey)
                          }
                          title={tooltip}
                          className={`w-[11px] h-[11px] rounded-[2px] transition-transform ${colorClass} ${
                            isClickable ? 'cursor-pointer hover:scale-125' : 'cursor-default'
                          } ${isSelected ? 'ring-2 ring-paper-text dark:ring-night-text ring-offset-1 dark:ring-offset-night-card' : ''}`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 图例 + 活跃日期快捷胶囊 */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-2 border-t border-paper-border/60 dark:border-night-border/60">
          {activeDatesSorted.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-paper-muted dark:text-night-muted mr-1">活跃阅读日：</span>
              {activeDatesSorted.map(({ dateKey, label }) => {
                const isSelected = selectedDate === dateKey;
                return (
                  <button
                    type="button"
                    key={dateKey}
                    onClick={() => setSelectedDate(isSelected ? null : dateKey)}
                    className={`px-2 py-0.5 rounded-full text-[11px] font-mono transition-colors ${
                      isSelected
                        ? 'bg-paper-terracotta dark:bg-night-terracotta text-white font-medium'
                        : 'bg-paper-drawer dark:bg-night-drawer text-paper-muted dark:text-night-muted hover:text-paper-text dark:hover:text-night-text'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          ) : (
            <span className="text-xs text-paper-muted dark:text-night-muted">暂无带时间戳的活跃记录</span>
          )}

          <div className="flex items-center gap-1.5 text-[10px] text-paper-muted dark:text-night-muted flex-shrink-0">
            <span>少</span>
            <span className="w-[10px] h-[10px] rounded-[2px] bg-paper-drawer dark:bg-night-drawer" />
            <span
              className={`w-[10px] h-[10px] rounded-[2px] ${
                effectiveHeatmapMode === 'duration'
                  ? 'bg-emerald-500/30 dark:bg-emerald-400/30'
                  : 'bg-paper-terracotta/35 dark:bg-night-terracotta/35'
              }`}
            />
            <span
              className={`w-[10px] h-[10px] rounded-[2px] ${
                effectiveHeatmapMode === 'duration'
                  ? 'bg-emerald-500/60 dark:bg-emerald-400/60'
                  : 'bg-paper-terracotta/65 dark:bg-night-terracotta/65'
              }`}
            />
            <span
              className={`w-[10px] h-[10px] rounded-[2px] ${
                effectiveHeatmapMode === 'duration'
                  ? 'bg-emerald-500 dark:bg-emerald-400'
                  : 'bg-paper-terracotta dark:bg-night-terracotta'
              }`}
            />
            <span>多</span>
          </div>
        </div>

        {/* 选中日期的当日完整阅读与思考回溯（联动阅读时长 + 活跃书籍 + 划线批注） */}
        {selectedDate &&
          (selectedDateAnnotations.length > 0 ||
            Boolean(selectedDayReading && selectedDayReading.readingTimeSec > 0) ||
            selectedDayOpenedBooks.length > 0) && (
          <div
            data-testid="insights-daily-review"
            className="mt-5 pt-4 border-t border-paper-border dark:border-night-border space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-paper-terracotta dark:text-night-terracotta">
                  📅 {selectedDate} 当日阅读回溯
                </span>
                {selectedDayReading && selectedDayReading.readingTimeSec > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-medium">
                    阅读 {formatReadingDuration(selectedDayReading.readingTimeSec)}
                    {selectedDayReading.goalMet ? ' · 已达标' : ''}
                  </span>
                )}
                <span className="text-paper-muted dark:text-night-muted">
                  （{selectedDateAnnotations.length} 条划线）
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDate(null)}
                className="text-paper-muted dark:text-night-muted hover:text-paper-text dark:hover:text-night-text"
              >
                收起
              </button>
            </div>

            {selectedDayOpenedBooks.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="text-paper-muted dark:text-night-muted">当日在读书籍：</span>
                {selectedDayOpenedBooks.map(b => (
                  <button
                    type="button"
                    key={b.assetId}
                    onClick={() => onSelectBook(b)}
                    className="px-2.5 py-1 rounded-md bg-paper-drawer dark:bg-night-drawer hover:text-paper-terracotta dark:hover:text-night-terracotta text-paper-text dark:text-night-text font-serif transition-colors flex items-center gap-1"
                  >
                    <span>《{b.title}》</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </button>
                ))}
              </div>
            )}

            {selectedDateAnnotations.length === 0 ? (
              <p className="text-xs text-paper-muted dark:text-night-muted py-3">
                当日有 Apple Books 阅读记录，但未留下新的划线笔记。
              </p>
            ) : (
            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {selectedDateAnnotations.map(a => {
                const targetBook = bookMap.get(a.assetId);
                const sem = semanticMap.get(a.colorKey);
                return (
                  <div
                    key={a.uuid}
                    className="p-3.5 rounded-xl bg-paper-drawer/70 dark:bg-night-drawer/70 border border-paper-border/50 dark:border-night-border/50 text-xs space-y-2 relative overflow-hidden"
                  >
                    <div
                      className="absolute left-0 top-0 bottom-0 w-1"
                      style={{ backgroundColor: sem?.hexColor || '#B85D3B' }}
                    />
                    <div className="flex items-center justify-between gap-2 pl-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {targetBook ? (
                          <button
                            type="button"
                            onClick={() => onSelectBook(targetBook)}
                            className="font-serif font-semibold text-paper-text dark:text-night-text hover:text-paper-terracotta dark:hover:text-night-terracotta flex items-center gap-1 truncate transition-colors"
                            title="点击进入本书精读详情"
                          >
                            <span>《{targetBook.title}》</span>
                            <ArrowUpRight className="w-3 h-3 flex-shrink-0" />
                          </button>
                        ) : (
                          <span className="font-serif font-semibold text-paper-text dark:text-night-text truncate">
                            《{a.bookTitle || '未知书籍'}》
                          </span>
                        )}
                        <span className="text-paper-muted dark:text-night-muted truncate">
                          · {a.chapterTitle || '默认章节'}
                        </span>
                      </div>
                      {sem && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/80 dark:bg-night-card text-paper-muted dark:text-night-muted flex-shrink-0">
                          {sem.label}
                        </span>
                      )}
                    </div>

                    <p className="font-serif text-sm text-paper-text dark:text-night-text leading-relaxed pl-2">
                      “{a.selectedText}”
                    </p>

                    {(a.note || a.customNote) && (
                      <div className="pl-2 space-y-1 text-[11px] text-paper-muted dark:text-night-muted">
                        {a.note && (
                          <p className="bg-white/60 dark:bg-night-card/60 px-2.5 py-1.5 rounded-md">
                            <span className="font-medium text-paper-text/80 dark:text-night-text/80">想法：</span>
                            {a.note}
                          </p>
                        )}
                        {a.customNote && (
                          <p className="bg-paper-terracotta/5 dark:bg-night-terracotta/10 px-2.5 py-1.5 rounded-md">
                            <span className="font-medium text-paper-terracotta dark:text-night-terracotta">
                              延伸思考：
                            </span>
                            {a.customNote}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            )}
          </div>
        )}
      </div>

      {/* 3. 阅读生物钟与每周节律 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* 左：24 小时阅读时段分布 */}
        <div
          data-testid="insights-hourly-rhythm"
          className="p-6 rounded-2xl bg-paper-card dark:bg-night-card border border-paper-border dark:border-night-border shadow-2xs"
        >
          <div className="flex items-center justify-between gap-2 mb-5">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-paper-terracotta dark:text-night-terracotta" />
              <h3 className="font-serif text-base font-bold text-paper-text dark:text-night-text">
                24 小时阅读生物钟
              </h3>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-paper-drawer dark:bg-night-drawer text-paper-terracotta dark:text-night-terracotta font-medium">
              {rhythm.chronotypeLabel}
              {rhythm.peakHour !== null ? ` · 峰值 ${String(rhythm.peakHour).padStart(2, '0')}:00` : ''}
            </span>
          </div>

          <div className="h-28 flex items-end gap-1 pt-2">
            {rhythm.hourlyCounts.map((count, hour) => {
              const heightPct = count > 0 ? Math.max(12, Math.round((count / maxHourCount) * 100)) : 4;
              const isPeak = hour === rhythm.peakHour && count > 0;
              return (
                <div key={hour} className="flex-1 flex flex-col items-center justify-end h-full group">
                  <div
                    style={{ height: `${heightPct}%` }}
                    title={`${String(hour).padStart(2, '0')}:00–${String(hour + 1).padStart(2, '0')}:00：${count} 条划线`}
                    className={`w-full rounded-t-sm transition-all ${
                      count === 0
                        ? 'bg-paper-drawer dark:bg-night-drawer'
                        : isPeak
                        ? 'bg-paper-terracotta dark:bg-night-terracotta'
                        : 'bg-paper-terracotta/45 dark:bg-night-terracotta/45 group-hover:bg-paper-terracotta/80'
                    }`}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] font-mono text-paper-muted dark:text-night-muted mt-2">
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>23:00</span>
          </div>
        </div>

        {/* 右：周内活跃节律 */}
        <div
          data-testid="insights-weekday-rhythm"
          className="p-6 rounded-2xl bg-paper-card dark:bg-night-card border border-paper-border dark:border-night-border shadow-2xs"
        >
          <div className="flex items-center justify-between gap-2 mb-5">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-paper-terracotta dark:text-night-terracotta" />
              <h3 className="font-serif text-base font-bold text-paper-text dark:text-night-text">
                每周阅读节律分布
              </h3>
            </div>
            <span className="text-xs text-paper-muted dark:text-night-muted">周一至周日累计分布</span>
          </div>

          <div className="h-28 flex items-end gap-3 pt-2">
            {rhythm.weekdayCounts.map((count, idx) => {
              const heightPct = count > 0 ? Math.max(12, Math.round((count / maxWeekdayCount) * 100)) : 5;
              const isWeekend = idx >= 5;
              return (
                <div key={WEEKDAY_NAMES[idx]} className="flex-1 flex flex-col items-center justify-end h-full">
                  <span className="text-[10px] font-mono text-paper-muted dark:text-night-muted mb-1">
                    {count > 0 ? count : ''}
                  </span>
                  <div
                    style={{ height: `${heightPct}%` }}
                    title={`${WEEKDAY_NAMES[idx]}：${count} 条记录`}
                    className={`w-full max-w-[32px] rounded-t-md transition-all ${
                      count === 0
                        ? 'bg-paper-drawer dark:bg-night-drawer'
                        : isWeekend
                        ? 'bg-amber-500/80 dark:bg-amber-400/80'
                        : 'bg-paper-terracotta/75 dark:bg-night-terracotta/75'
                    }`}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex gap-3 text-[11px] text-paper-muted dark:text-night-muted mt-2 text-center">
            {WEEKDAY_NAMES.map(name => (
              <span key={name} className="flex-1">
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 4. 双栏深度分布：Top 5 重点书籍 & 6 色语义分布 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
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
                const stat = bookNoteStats.get(b.assetId);
                return (
                  <div key={b.assetId} className="flex items-center gap-3">
                    <div className="w-8 h-11 rounded bg-paper-drawer dark:bg-night-drawer border border-paper-border/60 dark:border-night-border flex-shrink-0 overflow-hidden flex items-center justify-center">
                      {b.coverUrl ? (
                        <img src={b.coverUrl} alt={b.title} className="w-full h-full object-cover" />
                      ) : (
                        <BookOpen className="w-3.5 h-3.5 text-paper-muted/60" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center justify-between text-xs gap-2">
                        <button
                          type="button"
                          onClick={() => onSelectBook(b)}
                          className="font-serif font-medium text-paper-text dark:text-night-text hover:text-paper-terracotta dark:hover:text-night-terracotta truncate text-left transition-colors"
                        >
                          {idx + 1}. {b.title}
                        </button>
                        <span className="font-mono text-[11px] text-paper-muted dark:text-night-muted flex-shrink-0">
                          {b.highlightsCount} 条{stat && stat.withNotes > 0 ? ` · ${stat.withNotes} 批注` : ''} ·{' '}
                          {Math.round((b.readingProgress || 0) * 100)}%
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-paper-drawer dark:bg-night-drawer overflow-hidden">
                        <div
                          className="h-full rounded-full bg-paper-terracotta dark:bg-night-terracotta transition-all"
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
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
                type="button"
                onClick={onOpenColorSettings}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-paper-muted dark:text-night-muted hover:text-paper-terracotta dark:hover:text-night-terracotta hover:bg-paper-drawer dark:hover:bg-night-drawer transition-colors"
                title="编辑各高亮颜色代表的语义名称与色彩"
              >
                <Edit2 className="w-3 h-3" />
                <span>自定义语义</span>
              </button>
            )}
          </div>

          {/* 堆叠比例条（使用精确 flexGrow 比例，杜绝总宽度溢出 100%） */}
          <div className="w-full h-3 rounded-full bg-paper-drawer dark:bg-night-drawer overflow-hidden flex mb-6 gap-0.5">
            {colorBreakdown
              .filter(c => c.count > 0)
              .map(c => (
                <div
                  key={c.colorKey}
                  style={{
                    flexGrow: c.count,
                    flexBasis: '4px',
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
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: c.hexColor }}
                  />
                  <div className="min-w-0">
                    <div className="text-paper-text dark:text-night-text font-medium truncate">
                      {c.label}
                    </div>
                    {c.count > 0 && (
                      <div className="text-[10px] text-paper-muted dark:text-night-muted">
                        批注率 {c.noteRate}%
                      </div>
                    )}
                  </div>
                </div>
                <span className="font-mono text-paper-muted dark:text-night-muted flex-shrink-0">
                  {c.count} ({c.pct}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 5. 知识主题与领域分布（可选展示） */}
      {(topTags.length > 0 || topGenres.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {topTags.length > 0 && (
            <div className="p-6 rounded-2xl bg-paper-card dark:bg-night-card border border-paper-border dark:border-night-border shadow-2xs">
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <Hash className="w-4 h-4 text-paper-terracotta dark:text-night-terracotta" />
                  <h3 className="font-serif text-base font-bold text-paper-text dark:text-night-text">
                    高频思考主题标签
                  </h3>
                </div>
                {onOpenTagInGraph && (
                  <span className="text-[11px] text-paper-muted dark:text-night-muted">
                    点击标签前往知识网络
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {topTags.map(([tag, count]) => (
                  <button
                    type="button"
                    key={tag}
                    onClick={() => onOpenTagInGraph && onOpenTagInGraph(tag)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border border-paper-border dark:border-night-border bg-paper-drawer/60 dark:bg-night-drawer/60 text-paper-text dark:text-night-text ${
                      onOpenTagInGraph
                        ? 'hover:border-paper-terracotta dark:hover:border-night-terracotta hover:text-paper-terracotta transition-colors cursor-pointer'
                        : 'cursor-default'
                    }`}
                  >
                    <span>#{tag}</span>
                    <span className="text-[10px] font-mono text-paper-muted dark:text-night-muted">
                      {count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {topGenres.length > 0 && (
            <div className="p-6 rounded-2xl bg-paper-card dark:bg-night-card border border-paper-border dark:border-night-border shadow-2xs">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="w-4 h-4 text-paper-terracotta dark:text-night-terracotta" />
                <h3 className="font-serif text-base font-bold text-paper-text dark:text-night-text">
                  常读知识领域分布
                </h3>
              </div>
              <div className="space-y-3">
                {topGenres.map(([genre, count]) => {
                  const maxG = topGenres[0][1] || 1;
                  const pct = Math.max(10, Math.round((count / maxG) * 100));
                  return (
                    <div key={genre} className="space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-paper-text dark:text-night-text font-medium">{genre}</span>
                        <span className="font-mono text-paper-muted dark:text-night-muted">{count} 条笔记</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-paper-drawer dark:bg-night-drawer overflow-hidden">
                        <div
                          className="h-full rounded-full bg-amber-500/80 dark:bg-amber-400/80"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
