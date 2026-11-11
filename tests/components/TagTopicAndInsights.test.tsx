import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TagTopicView, formatTagTopicMarkdown } from '../../src/components/TagTopicView';
import {
  InsightsView,
  resolveAnnotationTimestamp,
  toDateKey,
  buildCalendarWeeks,
  calculateStreaks,
  computeReadingRhythm
} from '../../src/components/InsightsView';
import { GlobalSearchView } from '../../src/components/GlobalSearchView';
import { BookItem, AnnotationItem, ColorSemanticConfig } from '../../electron/types/ipc';

const mockColorSemantics: ColorSemanticConfig[] = [
  { colorKey: 'yellow', label: '核心论点', hexColor: '#F5A623' },
  { colorKey: 'green', label: '行动与实践', hexColor: '#5CB85C' },
  { colorKey: 'blue', label: '概念与背景', hexColor: '#4A90E2' },
  { colorKey: 'pink', label: '灵感与金句', hexColor: '#E86F88' },
  { colorKey: 'purple', label: '存疑与深思', hexColor: '#9B6B9E' },
  { colorKey: 'underline', label: '重点下划线', hexColor: '#D9534F' }
];

const mockBooks: BookItem[] = [
  {
    assetId: 'book-1',
    title: '纳瓦尔宝典',
    author: '埃里克·乔根森',
    genre: '商业',
    epubPath: '/naval.epub',
    readingProgress: 0.9,
    lastOpenDateMs: 1700000000000,
    coverUrl: null,
    highlightsCount: 12
  },
  {
    assetId: 'book-2',
    title: '穷查理宝典',
    author: '查理·芒格',
    genre: '投资',
    epubPath: '/munger.epub',
    readingProgress: 0.75,
    lastOpenDateMs: 1700005000000,
    coverUrl: null,
    highlightsCount: 8
  }
];

const mockAnnotations: AnnotationItem[] = [
  {
    uuid: 'anno-1',
    assetId: 'book-1',
    bookTitle: '纳瓦尔宝典',
    selectedText: '追求财富，而不是追求金钱或地位。',
    note: '复利资产的本质',
    representativeText: null,
    colorKey: 'yellow',
    locationCfi: null,
    chapterTitle: '第一章 积累财富',
    creationDateMs: Date.now() - 86400000,
    modificationDateMs: Date.now() - 86400000,
    sortIndex: 1,
    customNote: '睡后收入资产',
    isStarred: true,
    tags: ['心智模型', '财富']
  },
  {
    uuid: 'anno-2',
    assetId: 'book-2',
    bookTitle: '穷查理宝典',
    selectedText: '反过来想，总是反过来想。',
    note: null,
    representativeText: null,
    colorKey: 'blue',
    locationCfi: null,
    chapterTitle: '第二讲 多元思维模型',
    creationDateMs: Date.now(),
    modificationDateMs: Date.now(),
    sortIndex: 1,
    customNote: '逆向思考法',
    isStarred: false,
    tags: ['心智模型']
  }
];

describe('TagTopicView Component', () => {
  it('should aggregate cross-book annotations matching the selected tag', () => {
    const html = renderToStaticMarkup(
      <TagTopicView
        tag="心智模型"
        annotations={mockAnnotations}
        books={mockBooks}
        colorSemantics={mockColorSemantics}
        onClearTag={vi.fn()}
        onSelectBook={vi.fn()}
        onToggleStar={vi.fn()}
        onUpdateCustomNote={vi.fn()}
        onAddTag={vi.fn()}
        onRemoveTag={vi.fn()}
        onOpenQuoteModal={vi.fn()}
        onRequestContext={vi.fn()}
      />
    );

    expect(html).toContain('#心智模型');
    expect(html).toContain('跨书主题聚合工作台');
    expect(html).toContain('《纳瓦尔宝典》');
    expect(html).toContain('《穷查理宝典》');
    expect(html).toContain('追求财富，而不是追求金钱或地位。');
    expect(html).toContain('反过来想，总是反过来想。');
    expect(html).toContain('导出主题综述 Markdown');
  });

  it('should format cross-book topic Markdown accurately', () => {
    const md = formatTagTopicMarkdown('心智模型', mockAnnotations, mockBooks);
    expect(md).toContain('topic: "#心智模型"');
    expect(md).toContain('booksCount: 2');
    expect(md).toContain('## 《纳瓦尔宝典》（埃里克·乔根森）');
    expect(md).toContain('## 《穷查理宝典》（查理·芒格）');
    expect(md).toContain('> “反过来想，总是反过来想。”');
  });
});

describe('InsightsView Component', () => {
  it('should render editorial statistics, activity heatmap, top books and color semantics breakdown', () => {
    const html = renderToStaticMarkup(
      <InsightsView
        books={mockBooks}
        annotations={mockAnnotations}
        colorSemantics={mockColorSemantics}
        onSelectBook={vi.fn()}
      />
    );

    expect(html).toContain('阅读足迹与思考洞察');
    expect(html).toContain('总藏书量');
    expect(html).toContain('有笔记书籍');
    expect(html).toContain('累计高亮条数');
    expect(html).toContain('思考活跃度热力图');
    expect(html).toContain('data-testid="insights-heatmap"');
    expect(html).toContain('重点精读书籍 Top 5');
    expect(html).toContain('1. 纳瓦尔宝典');
    expect(html).toContain('2. 穷查理宝典');
    expect(html).toContain('高亮色彩语义分布');
    expect(html).toContain('核心论点');
    expect(html).toContain('概念与背景');
    expect(html).toContain('深度思考率 100%');
    expect(html).toContain('24 小时阅读生物钟');
    expect(html).toContain('每周阅读节律分布');
    expect(html).toContain('高频思考主题标签');
    expect(html).toContain('#心智模型');
    expect(html).toContain('常读知识领域分布');
    expect(html).toContain('商业');
  });

  it('should render daily review card with notes, customNote and semantic label when a date is selected', () => {
    const targetDate = toDateKey(mockAnnotations[0].creationDateMs);
    const html = renderToStaticMarkup(
      <InsightsView
        books={mockBooks}
        annotations={mockAnnotations}
        colorSemantics={mockColorSemantics}
        onSelectBook={vi.fn()}
        defaultSelectedDate={targetDate}
      />
    );
    expect(html).toContain('data-testid="insights-daily-review"');
    expect(html).toContain('《纳瓦尔宝典》');
    expect(html).toContain('追求财富，而不是追求金钱或地位。');
    expect(html).toContain('复利资产的本质');
    expect(html).toContain('睡后收入资产');
    expect(html).toContain('核心论点');
  });

  it('should exclude hidden books from visible bookshelf stats when hiddenBookIds is provided', () => {
    const html = renderToStaticMarkup(
      <InsightsView
        books={mockBooks}
        annotations={mockAnnotations}
        colorSemantics={mockColorSemantics}
        hiddenBookIds={['book-2']}
        onSelectBook={vi.fn()}
      />
    );
    expect(html).toContain('已排除隐藏 1 本');
    expect(html).toContain('1. 纳瓦尔宝典');
    expect(html).not.toContain('2. 穷查理宝典');
  });

  it('should compute accurate calendar weeks, streaks, timestamps and reading rhythm', () => {
    // 1. Prefer creationDateMs over modificationDateMs
    const anno: AnnotationItem = {
      ...mockAnnotations[0],
      creationDateMs: 1700000000000,
      modificationDateMs: 1750000000000
    };
    expect(resolveAnnotationTimestamp(anno)).toBe(1700000000000);

    // 2. Calendar matrix has full 7-day weeks
    const { weeks, monthLabels } = buildCalendarWeeks({ '2026-03-15': 3 }, '2026', new Date(2026, 5, 1));
    expect(weeks.length).toBeGreaterThanOrEqual(52);
    expect(weeks.every(w => w.length === 7)).toBe(true);
    expect(monthLabels.length).toBe(12);

    // 3. Streaks calculation
    const streaks = calculateStreaks(['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-05']);
    expect(streaks.activeDays).toBe(4);
    expect(streaks.longestStreak).toBe(3);

    // 4. Reading rhythm
    const nightDate = new Date(2026, 4, 10, 23, 15, 0).getTime();
    const rhythm = computeReadingRhythm([
      { ...mockAnnotations[0], creationDateMs: nightDate, modificationDateMs: nightDate }
    ]);
    expect(rhythm.peakHour).toBe(23);
    expect(rhythm.chronotypeLabel).toContain('深夜沉浸型');
    expect(rhythm.hourlyCounts[23]).toBe(1);
  });

  it('should render Apple Books daily reading duration card and heatmap toggle when readingStats is provided', () => {
    const targetDate = toDateKey(mockAnnotations[0].creationDateMs);
    const html = renderToStaticMarkup(
      <InsightsView
        books={mockBooks}
        annotations={mockAnnotations}
        colorSemantics={mockColorSemantics}
        onSelectBook={vi.fn()}
        defaultSelectedDate={targetDate}
        readingStats={{
          available: true,
          todayReadingSec: 1500,
          dailyGoalSec: 1200,
          currentStreakDays: 3,
          allTimeRecordStreakDays: 7,
          currentYearBooksFinished: 4,
          yearlyBooksFinishedGoal: 12,
          totalReadingSec: 5400,
          dailyHistory: [
            { date: targetDate, readingTimeSec: 2640, readingGoalSec: 1200, goalMet: true }
          ]
        }}
      />
    );
    expect(html).toContain('data-testid="insights-reading-duration"');
    expect(html).toContain('Apple Books 每日阅读时长与目标');
    expect(html).toContain('已达成目标');
    expect(html).toContain('4 / 12');
    expect(html).toContain('按划线笔记');
    expect(html).toContain('按阅读时长');
    expect(html).toContain('阅读 44 分钟');
  });
});

describe('GlobalSearchView Component', () => {
  it('should render discovery stream when searchKeyword is empty and filter by keyword when entered', () => {
    const discoveryHtml = renderToStaticMarkup(
      <GlobalSearchView
        books={mockBooks}
        annotations={mockAnnotations}
        colorSemantics={mockColorSemantics}
        availableTags={['心智模型', '财富']}
        searchKeyword=""
        onSearchKeywordChange={vi.fn()}
        onSelectBook={vi.fn()}
        onManageTags={vi.fn()}
        onToggleStar={vi.fn()}
        onUpdateCustomNote={vi.fn()}
        onAddTag={vi.fn()}
        onRemoveTag={vi.fn()}
        onOpenQuoteModal={vi.fn()}
        onRequestContext={vi.fn()}
      />
    );

    expect(discoveryHtml).toContain('全局探索与检索');
    expect(discoveryHtml).toContain('探索流：最近记录的');
    expect(discoveryHtml).toContain('追求财富，而不是追求金钱或地位。');
    expect(discoveryHtml).toContain('反过来想，总是反过来想。');

    const filteredHtml = renderToStaticMarkup(
      <GlobalSearchView
        books={mockBooks}
        annotations={mockAnnotations}
        colorSemantics={mockColorSemantics}
        availableTags={['心智模型', '财富']}
        searchKeyword="穷查理"
        onSearchKeywordChange={vi.fn()}
        onSelectBook={vi.fn()}
        onManageTags={vi.fn()}
        onToggleStar={vi.fn()}
        onUpdateCustomNote={vi.fn()}
        onAddTag={vi.fn()}
        onRemoveTag={vi.fn()}
        onOpenQuoteModal={vi.fn()}
        onRequestContext={vi.fn()}
      />
    );

    expect(filteredHtml).toContain('共检索到');
    expect(filteredHtml).toContain('反过来想，总是反过来想。');
    expect(filteredHtml).not.toContain('追求财富，而不是追求金钱或地位。');
  });
});
