import type { ReactElement } from 'react';
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BookshelfView, BookshelfViewProps } from '../../src/components/BookshelfView';
import { BookItem } from '../../electron/types/ipc';
import App from '../../src/App';

const mockBooks: BookItem[] = [
  {
    assetId: 'asset-book-b',
    title: 'B - 思考快与慢',
    author: '丹尼尔·卡尼曼',
    genre: '心理学',
    epubPath: '/books/thinking.epub',
    readingProgress: 0.75,
    lastOpenDateMs: 1700000000000,
    coverUrl: 'https://example.com/cover-b.jpg',
    highlightsCount: 50
  },
  {
    assetId: 'asset-book-a',
    title: 'A - 原则',
    author: '瑞·达利欧',
    genre: '商业与管理',
    epubPath: '/books/principles.epub',
    readingProgress: 0.3,
    lastOpenDateMs: 1700050000000,
    coverUrl: null, // Fallback cover test
    highlightsCount: 10
  },
  {
    assetId: 'asset-book-c',
    title: 'C - 暗时间',
    author: null, // Fallback author test
    genre: '自我提升',
    epubPath: '/books/dark-time.epub',
    readingProgress: 0, // No progress
    lastOpenDateMs: 1700020000000,
    coverUrl: null,
    highlightsCount: 30
  }
];

describe('BookshelfView Component', () => {
  const defaultProps: BookshelfViewProps = {
    books: mockBooks,
    onSelectBook: vi.fn()
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render header with book counts and total highlights', () => {
    const html = renderToStaticMarkup(<BookshelfView {...defaultProps} />);
    expect(html).toContain('我的书库');
    // Total highlights = 50 + 10 + 30 = 90
    expect(html).toContain('共收录 3 本书 · 累计 90 条高亮与思考');
  });

  it('should render empty state when books array is empty', () => {
    const html = renderToStaticMarkup(<BookshelfView books={[]} onSelectBook={vi.fn()} />);
    expect(html).toContain('共收录 0 本书 · 累计 0 条高亮与思考');
    expect(html).toContain('暂无书籍');
    expect(html).toContain('请在 Apple Books 中阅读并添加高亮，或检查数据源目录');
  });

  it('should render cover image when coverUrl is provided, and fallback typography when null', () => {
    const html = renderToStaticMarkup(<BookshelfView {...defaultProps} />);

    // Book B has coverUrl
    expect(html).toContain('src="https://example.com/cover-b.jpg"');
    expect(html).toContain('alt="B - 思考快与慢"');

    // Book A has null coverUrl, should render fallback title and icon
    expect(html).toContain('A - 原则');
  });

  it('should render author name or fallback to "未知作者" when author is null', () => {
    const html = renderToStaticMarkup(<BookshelfView {...defaultProps} />);
    expect(html).toContain('丹尼尔·卡尼曼');
    expect(html).toContain('瑞·达利欧');
    expect(html).toContain('未知作者');
  });

  it('should render highlight count badges for all books', () => {
    const html = renderToStaticMarkup(<BookshelfView {...defaultProps} />);
    expect(html).toContain('<span>50</span>');
    expect(html).toContain('<span>10</span>');
    expect(html).toContain('<span>30</span>');
  });

  it('should render reading progress percentage and progress bar for books with progress > 0', () => {
    const html = renderToStaticMarkup(<BookshelfView {...defaultProps} />);
    // Book B has readingProgress 0.75 -> 75%
    expect(html).toContain('75%');
    expect(html).toContain('style="width:75%"');

    // Book A has readingProgress 0.3 -> 30%
    expect(html).toContain('30%');
    expect(html).toContain('style="width:30%"');
  });

  it('should render last open date when lastOpenDateMs is present', () => {
    const html = renderToStaticMarkup(<BookshelfView {...defaultProps} />);
    const expectedDateB = new Date(1700000000000).toLocaleDateString('zh-CN');
    const expectedDateA = new Date(1700050000000).toLocaleDateString('zh-CN');
    expect(html).toContain(expectedDateB);
    expect(html).toContain(expectedDateA);
  });

  it('should sort books by recent (lastOpenDateMs desc) by default', () => {
    const html = renderToStaticMarkup(<BookshelfView {...defaultProps} defaultSortBy="recent" />);
    // Expected order: Book A (1700050000000), Book C (1700020000000), Book B (1700000000000)
    const posA = html.indexOf('A - 原则');
    const posC = html.indexOf('C - 暗时间');
    const posB = html.indexOf('B - 思考快与慢');

    expect(posA).toBeGreaterThan(-1);
    expect(posC).toBeGreaterThan(-1);
    expect(posB).toBeGreaterThan(-1);
    expect(posA).toBeLessThan(posC);
    expect(posC).toBeLessThan(posB);
  });

  it('should sort books by highlights count desc when defaultSortBy is "highlights"', () => {
    const html = renderToStaticMarkup(<BookshelfView {...defaultProps} defaultSortBy="highlights" />);
    // Expected order: Book B (50), Book C (30), Book A (10)
    const posB = html.indexOf('B - 思考快与慢');
    const posC = html.indexOf('C - 暗时间');
    const posA = html.indexOf('A - 原则');

    expect(posB).toBeGreaterThan(-1);
    expect(posC).toBeGreaterThan(-1);
    expect(posA).toBeGreaterThan(-1);
    expect(posB).toBeLessThan(posC);
    expect(posC).toBeLessThan(posA);
  });

  it('should sort books by title alphabetically when defaultSortBy is "title"', () => {
    const html = renderToStaticMarkup(<BookshelfView {...defaultProps} defaultSortBy="title" />);
    // Expected order: Book A, Book B, Book C
    const posA = html.indexOf('A - 原则');
    const posB = html.indexOf('B - 思考快与慢');
    const posC = html.indexOf('C - 暗时间');

    expect(posA).toBeGreaterThan(-1);
    expect(posB).toBeGreaterThan(-1);
    expect(posC).toBeGreaterThan(-1);
    expect(posA).toBeLessThan(posB);
    expect(posB).toBeLessThan(posC);
  });

  it('should include night mode tokens for dark mode compatibility', () => {
    const html = renderToStaticMarkup(<BookshelfView {...defaultProps} />);
    expect(html).toContain('dark:bg-night-bg');
    expect(html).toContain('dark:text-night-text');
    expect(html).toContain('dark:border-night-border');
    expect(html).toContain('dark:bg-night-card');
    expect(html).toContain('dark:bg-night-drawer');
    expect(html).toContain('dark:text-night-muted');
    expect(html).toContain('dark:hover:border-night-terracotta/40');
  });

  it('should handle sorting controls and book card selection callbacks', () => {
    const onSelectBook = vi.fn();
    const setSortBy = vi.fn();

    const dispatcher = (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher;
    const prevDispatcher = dispatcher.current;
    dispatcher.current = {
      useState: (initial: any) => [initial, setSortBy]
    };

    try {
      const element = BookshelfView({
        books: mockBooks,
        onSelectBook
      }) as ReactElement<any>;

      expect(element).toBeDefined();

      // Check header controls
      const [headerDiv, gridDiv] = element.props.children;
      const sortControlsDiv = headerDiv.props.children[1];
      const [_icon, _label, recentBtn, highlightsBtn, titleBtn] = sortControlsDiv.props.children;

      recentBtn.props.onClick();
      expect(setSortBy).toHaveBeenCalledWith('recent');

      highlightsBtn.props.onClick();
      expect(setSortBy).toHaveBeenCalledWith('highlights');

      titleBtn.props.onClick();
      expect(setSortBy).toHaveBeenCalledWith('title');

      // Check book card clicks
      const bookCards = gridDiv.props.children;
      expect(bookCards.length).toBe(3);

      // Click the first card
      bookCards[0].props.onClick();
      expect(onSelectBook).toHaveBeenCalled();
    } finally {
      dispatcher.current = prevDispatcher;
    }
  });

  it('should render book collection quick filters for all and notes-only', () => {
    const html = renderToStaticMarkup(<BookshelfView {...defaultProps} />);
    expect(html).toContain('data-testid="filter-all-books"');
    expect(html).toContain('data-testid="filter-notes-books"');
    expect(html).toContain('全部藏书 (3)');
    expect(html).toContain('有笔记的书 (3)');
  });

  it('should render pinned books filter tab and per-card bookmark pin toggles', () => {
    const html = renderToStaticMarkup(
      <BookshelfView
        {...defaultProps}
        pinnedBookIds={['asset-book-b']}
        onTogglePinBook={vi.fn()}
      />
    );
    expect(html).toContain('data-testid="filter-pinned-books"');
    expect(html).toContain('重点书单 (1)');
    expect(html).toContain('从重点书单移出 B - 思考快与慢');
    expect(html).toContain('将 A - 原则 加入重点书单');
  });

  it('should filter out hidden books and render manage bookshelf trigger', () => {
    const html = renderToStaticMarkup(
      <BookshelfView
        {...defaultProps}
        hiddenBookIds={['asset-book-c']}
        onUpdateHiddenBooks={vi.fn()}
      />
    );
    expect(html).toContain('data-testid="manage-bookshelf-btn"');
    expect(html).toContain('管理书架 (已隐藏 1 本)');
    expect(html).toContain('共展示 2 本书（已隐藏 1 本）');
    expect(html).not.toContain('C - 暗时间');
    expect(html).toContain('从书架隐藏 B - 思考快与慢');
  });

  it('should render empty state recovery button when all books are hidden', () => {
    const html = renderToStaticMarkup(
      <BookshelfView
        {...defaultProps}
        hiddenBookIds={mockBooks.map(b => b.assetId)}
        onUpdateHiddenBooks={vi.fn()}
      />
    );
    expect(html).toContain('当前已隐藏全部藏书');
    expect(html).toContain('选择要展示的书籍');
  });
});

describe('App Integration with BookshelfView', () => {
  it('should render App with BookshelfView by default', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('我的书库');
    expect(html).toContain('全部书架');
  });
});
