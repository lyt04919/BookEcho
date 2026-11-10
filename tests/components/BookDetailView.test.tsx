import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BookDetailView, BookDetailViewProps } from '../../src/components/BookDetailView';
import { BookItem, AnnotationItem, ColorSemanticConfig } from '../../electron/types/ipc';

const mockColorSemantics: ColorSemanticConfig[] = [
  { colorKey: 'yellow', label: '核心论点', hexColor: '#F5A623' },
  { colorKey: 'green', label: '行动与实践', hexColor: '#5CB85C' },
  { colorKey: 'blue', label: '概念与背景', hexColor: '#4A90E2' },
  { colorKey: 'pink', label: '灵感与金句', hexColor: '#E86F88' },
  { colorKey: 'purple', label: '存疑与深思', hexColor: '#9B6B9E' },
  { colorKey: 'underline', label: '重点下划线', hexColor: '#D9534F' }
];

const mockBookWithCover: BookItem = {
  assetId: 'asset-test-book-1',
  title: '原则：应对变化中的世界秩序',
  author: '瑞·达利欧',
  genre: '经济金融',
  epubPath: '/books/principles.epub',
  readingProgress: 0.85,
  lastOpenDateMs: 1700000000000,
  coverUrl: 'https://example.com/principles-cover.jpg',
  highlightsCount: 2
};

const mockBookWithoutCover: BookItem = {
  assetId: 'asset-test-book-2',
  title: '传习录',
  author: null,
  genre: null,
  epubPath: null,
  readingProgress: 0.4,
  lastOpenDateMs: 1700010000000,
  coverUrl: null,
  highlightsCount: 0
};

const mockAnnotations: AnnotationItem[] = [
  {
    uuid: 'anno-ch1-1',
    assetId: 'asset-test-book-1',
    selectedText: '历史总是惊人地相似，而人们总是不长记性。',
    note: '大周期的必然规律',
    representativeText: '历史总是相似',
    colorKey: 'yellow',
    locationCfi: 'epubcfi(/6/2!/4/1:0)',
    chapterTitle: '第一章 大周期的运转机制',
    creationDateMs: 1700000000000,
    modificationDateMs: 1700001000000,
    sortIndex: 1,
    customNote: '宏观债务周期的递归性',
    isStarred: true,
    tags: ['宏观周期', '投资哲学']
  },
  {
    uuid: 'anno-ch1-2',
    assetId: 'asset-test-book-1',
    selectedText: '金融资产的本质是对未来现金流的索取权。',
    note: null,
    representativeText: '现金流索取权',
    colorKey: 'blue',
    locationCfi: 'epubcfi(/6/2!/4/10:0)',
    chapterTitle: '第一章 大周期的运转机制',
    creationDateMs: 1700002000000,
    modificationDateMs: 1700002000000,
    sortIndex: 2,
    isStarred: false,
    tags: ['资产负债']
  },
  {
    uuid: 'anno-ch2-1',
    assetId: 'asset-test-book-1',
    selectedText: '当国家的收入小于支出时，货币贬值往往不可避免。',
    note: '赤字货币化与去杠杆',
    representativeText: '货币贬值',
    colorKey: 'pink',
    locationCfi: 'epubcfi(/6/4!/4/2:0)',
    chapterTitle: '第二章 帝国的兴衰与大周期',
    creationDateMs: 1700003000000,
    modificationDateMs: 1700003000000,
    sortIndex: 1,
    isStarred: true,
    tags: ['财政政策']
  }
];

describe('BookDetailView Component', () => {
  const createDefaultProps = (overrides?: Partial<BookDetailViewProps>): BookDetailViewProps => ({
    book: mockBookWithCover,
    annotations: mockAnnotations,
    colorSemantics: mockColorSemantics,
    onBack: vi.fn(),
    onOpenInAppleBooks: vi.fn(),
    onExportMarkdown: vi.fn(),
    onToggleStar: vi.fn(),
    onUpdateCustomNote: vi.fn(),
    onAddTag: vi.fn(),
    onRemoveTag: vi.fn(),
    onOpenQuoteModal: vi.fn(),
    onRequestContext: vi.fn().mockResolvedValue({
      available: true,
      beforeParagraphs: [],
      currentParagraph: '测试段落',
      selectedText: '测试',
      afterParagraphs: []
    }),
    ...overrides
  });

  it('should render navigation bar with back, Apple Books, and export buttons', () => {
    const props = createDefaultProps();
    const html = renderToStaticMarkup(<BookDetailView {...props} />);

    expect(html).toContain('返回全部书架');
    expect(html).toContain('在 Apple Books 中阅读');
    expect(html).toContain('导出 Markdown');
  });

  it('should render book metadata including title, author, genre and reading progress', () => {
    const props = createDefaultProps();
    const html = renderToStaticMarkup(<BookDetailView {...props} />);

    expect(html).toContain('原则：应对变化中的世界秩序');
    expect(html).toContain('瑞·达利欧 · 经济金融');
    expect(html).toContain('共精选 3 条划线笔记 · 阅读进度 85%');
  });

  it('should render cover image when coverUrl is available', () => {
    const props = createDefaultProps();
    const html = renderToStaticMarkup(<BookDetailView {...props} />);

    expect(html).toContain('src="https://example.com/principles-cover.jpg"');
    expect(html).toContain('alt="原则：应对变化中的世界秩序"');
  });

  it('should render fallback title cover and default author/genre when missing', () => {
    const props = createDefaultProps({
      book: mockBookWithoutCover,
      annotations: []
    });
    const html = renderToStaticMarkup(<BookDetailView {...props} />);

    expect(html).toContain('未知作者 · 未分类');
    expect(html).toContain('阅读进度 40%');
    expect(html).not.toContain('<img');
  });

  it('should group annotations into chapters with chapter titles and item counts', () => {
    const props = createDefaultProps();
    const html = renderToStaticMarkup(<BookDetailView {...props} />);

    expect(html).toContain('第一章 大周期的运转机制');
    expect(html).toContain('(2条)');

    expect(html).toContain('第二章 帝国的兴衰与大周期');
    expect(html).toContain('(1条)');
  });

  it('should fall back to "默认章节" when chapterTitle is empty or whitespace', () => {
    const emptyChapterAnno: AnnotationItem = {
      ...mockAnnotations[0],
      uuid: 'anno-empty-chap',
      chapterTitle: '   '
    };
    const props = createDefaultProps({
      annotations: [emptyChapterAnno]
    });
    const html = renderToStaticMarkup(<BookDetailView {...props} />);

    expect(html).toContain('默认章节');
    expect(html).toContain('(1条)');
  });

  it('should render all highlight cards with their quotes and notes', () => {
    const props = createDefaultProps();
    const html = renderToStaticMarkup(<BookDetailView {...props} />);

    expect(html).toContain('“历史总是惊人地相似，而人们总是不长记性。”');
    expect(html).toContain('“金融资产的本质是对未来现金流的索取权。”');
    expect(html).toContain('“当国家的收入小于支出时，货币贬值往往不可避免。”');
    expect(html).toContain('大周期的必然规律');
    expect(html).toContain('赤字货币化与去杠杆');
  });

  it('should render empty state message when book has no annotations', () => {
    const props = createDefaultProps({
      annotations: []
    });
    const html = renderToStaticMarkup(<BookDetailView {...props} />);

    expect(html).toContain('该书暂无划线高亮');
    expect(html).toContain('在 Apple Books 中阅读并添加划线后，将在此自动同步');
  });

  it('should contain dark mode styling tokens for night reading theme', () => {
    const props = createDefaultProps();
    const html = renderToStaticMarkup(<BookDetailView {...props} />);

    expect(html).toContain('dark:bg-night-bg');
    expect(html).toContain('dark:text-night-text');
    expect(html).toContain('dark:border-night-border');
    expect(html).toContain('dark:bg-night-card');
  });

  it('should support invoking action callbacks', () => {
    const onBack = vi.fn();
    const onOpenInAppleBooks = vi.fn();
    const onExportMarkdown = vi.fn();

    const props = createDefaultProps({
      onBack,
      onOpenInAppleBooks,
      onExportMarkdown
    });

    props.onBack();
    expect(onBack).toHaveBeenCalledTimes(1);

    props.onOpenInAppleBooks(props.book.assetId, props.book.epubPath);
    expect(onOpenInAppleBooks).toHaveBeenCalledWith('asset-test-book-1', '/books/principles.epub');

    props.onExportMarkdown(props.book.assetId);
    expect(onExportMarkdown).toHaveBeenCalledWith('asset-test-book-1');

    props.onToggleStar('anno-ch1-1');
    expect(props.onToggleStar).toHaveBeenCalledWith('anno-ch1-1');

    props.onUpdateCustomNote('anno-ch1-1', '新思考');
    expect(props.onUpdateCustomNote).toHaveBeenCalledWith('anno-ch1-1', '新思考');

    props.onAddTag('anno-ch1-1', '宏观经济');
    expect(props.onAddTag).toHaveBeenCalledWith('anno-ch1-1', '宏观经济');

    props.onRemoveTag('anno-ch1-1', '投资哲学');
    expect(props.onRemoveTag).toHaveBeenCalledWith('anno-ch1-1', '投资哲学');

    props.onOpenQuoteModal(props.annotations[0]);
    expect(props.onOpenQuoteModal).toHaveBeenCalledWith(props.annotations[0]);
  });

  it('should sort annotations within each chapter by sortIndex', () => {
    // Pass out-of-order annotations within chapter 1
    const unSortedAnnos: AnnotationItem[] = [
      { ...mockAnnotations[1], sortIndex: 2 },
      { ...mockAnnotations[0], sortIndex: 1 }
    ];
    const props = createDefaultProps({ annotations: unSortedAnnos });
    const html = renderToStaticMarkup(<BookDetailView {...props} />);

    const posFirst = html.indexOf('历史总是惊人地相似');
    const posSecond = html.indexOf('金融资产的本质是对未来现金流的索取权');

    expect(posFirst).toBeGreaterThan(-1);
    expect(posSecond).toBeGreaterThan(-1);
    expect(posFirst).toBeLessThan(posSecond);
  });

  it('should format 0% reading progress correctly', () => {
    const props = createDefaultProps({
      book: { ...mockBookWithCover, readingProgress: 0 }
    });
    const html = renderToStaticMarkup(<BookDetailView {...props} />);
    expect(html).toContain('阅读进度 0%');
  });

  it('should render chapter reader panel when readingChapterContent is provided', () => {
    const props = createDefaultProps({
      readingChapterContent: {
        available: true,
        chapterTitle: '第三章 尚无划线的章节',
        paragraphs: ['这是第三章的第一段原文内容。', '这是第三章的第二段原文内容。']
      },
      onCloseChapterReader: vi.fn(),
      onReadChapter: vi.fn()
    });
    const html = renderToStaticMarkup(<BookDetailView {...props} />);
    expect(html).toContain('data-testid="chapter-reader-panel"');
    expect(html).toContain('第三章 尚无划线的章节');
    expect(html).toContain('这是第三章的第一段原文内容。');
    expect(html).toContain('收起原文');
    expect(html).toContain('阅读本章原文');
  });
});

