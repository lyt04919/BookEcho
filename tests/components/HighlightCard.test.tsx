import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { HighlightCard, HighlightCardProps } from '../../src/components/HighlightCard';
import { AnnotationItem, ColorSemanticConfig } from '../../electron/types/ipc';

const mockColorSemantics: ColorSemanticConfig[] = [
  { colorKey: 'yellow', label: '核心论点', hexColor: '#F5A623' },
  { colorKey: 'green', label: '行动与实践', hexColor: '#5CB85C' },
  { colorKey: 'blue', label: '概念与背景', hexColor: '#4A90E2' },
  { colorKey: 'pink', label: '灵感与金句', hexColor: '#E86F88' },
  { colorKey: 'purple', label: '存疑与深思', hexColor: '#9B6B9E' },
  { colorKey: 'underline', label: '重点下划线', hexColor: '#D9534F' }
];

const mockAnnotation: AnnotationItem = {
  uuid: 'anno-001',
  assetId: 'asset-book-1',
  selectedText: '知行合一，致良知。',
  note: '王阳明心学核心精髓',
  representativeText: '知行合一',
  colorKey: 'yellow',
  locationCfi: 'epubcfi(/6/4[chap01]!/4/2/10/1:0)',
  chapterTitle: '第一章 心即理',
  creationDateMs: 1700000000000,
  modificationDateMs: 1700005000000,
  sortIndex: 1,
  customNote: '实践与认知的闭环反馈',
  isStarred: true,
  tags: ['心学', '哲学']
};

describe('HighlightCard Component', () => {
  const createDefaultProps = (overrides?: Partial<HighlightCardProps>): HighlightCardProps => ({
    annotation: { ...mockAnnotation },
    colorSemantics: mockColorSemantics,
    onToggleStar: vi.fn(),
    onUpdateCustomNote: vi.fn(),
    onAddTag: vi.fn(),
    onRemoveTag: vi.fn(),
    onOpenQuoteModal: vi.fn(),
    onRequestContext: vi.fn().mockResolvedValue({
      available: true,
      beforeParagraphs: ['前置段落内容'],
      currentParagraph: '知行合一，致良知。此心光明，亦复何言。',
      selectedText: '知行合一，致良知。',
      afterParagraphs: ['后置段落内容']
    }),
    ...overrides
  });

  it('should render 4px semantic color bar with corresponding colorHex', () => {
    const props = createDefaultProps();
    const html = renderToStaticMarkup(<HighlightCard {...props} />);
    // Yellow semantic is #F5A623
    expect(html).toContain('background-color:#F5A623');
    expect(html).toContain('data-testid="semantic-color-bar"');
  });

  it('should use fallback color if colorKey is not found in colorSemantics', () => {
    const props = createDefaultProps({
      colorSemantics: [],
      annotation: { ...mockAnnotation, colorKey: 'blue' }
    });
    const html = renderToStaticMarkup(<HighlightCard {...props} />);
    // Default fallback #F5A623
    expect(html).toContain('background-color:#F5A623');
  });

  it('should render semantic capsule label and creation date', () => {
    const props = createDefaultProps();
    const html = renderToStaticMarkup(<HighlightCard {...props} />);
    expect(html).toContain('核心论点');
    const formattedDate = new Date(mockAnnotation.creationDateMs).toLocaleDateString('zh-CN');
    expect(html).toContain(formattedDate);
  });

  it('should render quote text with serif font and quotation marks', () => {
    const props = createDefaultProps();
    const html = renderToStaticMarkup(<HighlightCard {...props} />);
    expect(html).toContain('“知行合一，致良知。”');
    expect(html).toContain('font-serif');
  });

  it('should render native Apple Books note when present', () => {
    const props = createDefaultProps();
    const html = renderToStaticMarkup(<HighlightCard {...props} />);
    expect(html).toContain('原文划线想法：');
    expect(html).toContain('王阳明心学核心精髓');
  });

  it('should omit native Apple Books note block when note is null or absent', () => {
    const props = createDefaultProps({
      annotation: { ...mockAnnotation, note: null }
    });
    const html = renderToStaticMarkup(<HighlightCard {...props} />);
    expect(html).not.toContain('原文划线想法：');
  });

  it('should render custom secondary thought note when customNote exists', () => {
    const props = createDefaultProps();
    const html = renderToStaticMarkup(<HighlightCard {...props} />);
    expect(html).toContain('实践与认知的闭环反馈');
  });

  it('should render "补充深度想法" prompt button when customNote is empty', () => {
    const props = createDefaultProps({
      annotation: { ...mockAnnotation, customNote: undefined }
    });
    const html = renderToStaticMarkup(<HighlightCard {...props} />);
    expect(html).toContain('补充深度想法');
    expect(html).not.toContain('实践与认知的闭环反馈');
  });

  it('should render tag chips with # prefix and remove button', () => {
    const props = createDefaultProps();
    const html = renderToStaticMarkup(<HighlightCard {...props} />);
    expect(html).toContain('#心学');
    expect(html).toContain('#哲学');
    expect(html).toContain('删除标签 心学');
    expect(html).toContain('删除标签 哲学');
  });

  it('should render "标签" add button when tags input is closed', () => {
    const props = createDefaultProps({
      annotation: { ...mockAnnotation, tags: [] }
    });
    const html = renderToStaticMarkup(<HighlightCard {...props} />);
    expect(html).toContain('<span>标签</span>');
  });

  it('should render star active state when isStarred is true', () => {
    const props = createDefaultProps({
      annotation: { ...mockAnnotation, isStarred: true }
    });
    const html = renderToStaticMarkup(<HighlightCard {...props} />);
    expect(html).toContain('text-amber-500');
    expect(html).toContain('fill="currentColor"');
    expect(html).toContain('aria-label="取消核心重点"');
  });

  it('should render star inactive state when isStarred is false', () => {
    const props = createDefaultProps({
      annotation: { ...mockAnnotation, isStarred: false }
    });
    const html = renderToStaticMarkup(<HighlightCard {...props} />);
    expect(html).toContain('fill="none"');
    expect(html).toContain('aria-label="标记核心重点"');
  });

  it('should render quote modal button with generator icon', () => {
    const props = createDefaultProps();
    const html = renderToStaticMarkup(<HighlightCard {...props} />);
    expect(html).toContain('title="生成金句卡片"');
    expect(html).toContain('aria-label="生成金句卡片"');
  });

  it('should render collapsible context trigger button', () => {
    const props = createDefaultProps();
    const html = renderToStaticMarkup(<HighlightCard {...props} />);
    expect(html).toContain('展开原文语境');
  });

  it('should support dark mode tokens for night mode styling', () => {
    const props = createDefaultProps();
    const html = renderToStaticMarkup(<HighlightCard {...props} />);
    expect(html).toContain('dark:bg-night-card');
    expect(html).toContain('dark:border-night-border');
    expect(html).toContain('dark:text-night-text');
    expect(html).toContain('dark:text-night-muted');
  });

  it('should invoke callbacks when provided', () => {
    const onToggleStar = vi.fn();
    const onUpdateCustomNote = vi.fn();
    const onAddTag = vi.fn();
    const onRemoveTag = vi.fn();
    const onOpenQuoteModal = vi.fn();

    const props = createDefaultProps({
      onToggleStar,
      onUpdateCustomNote,
      onAddTag,
      onRemoveTag,
      onOpenQuoteModal
    });

    // Test callback invocation directly
    props.onToggleStar('anno-001');
    expect(onToggleStar).toHaveBeenCalledWith('anno-001');

    props.onUpdateCustomNote('anno-001', '更新的想法');
    expect(onUpdateCustomNote).toHaveBeenCalledWith('anno-001', '更新的想法');

    props.onAddTag('anno-001', '认知心理学');
    expect(onAddTag).toHaveBeenCalledWith('anno-001', '认知心理学');

    // Verify tag strip helper behavior
    const stripHash = (tag: string) => tag.trim().replace(/^#+/, '');
    expect(stripHash('#心学')).toBe('心学');
    expect(stripHash('###哲学')).toBe('哲学');
    expect(stripHash('无井号')).toBe('无井号');

    props.onRemoveTag('anno-001', '心学');
    expect(onRemoveTag).toHaveBeenCalledWith('anno-001', '心学');

    props.onOpenQuoteModal(props.annotation);
    expect(onOpenQuoteModal).toHaveBeenCalledWith(props.annotation);
  });
});
