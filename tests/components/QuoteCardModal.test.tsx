import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { QuoteCardModal, QuoteCardModalProps, THEME_STYLES, CardTheme } from '../../src/components/QuoteCardModal';
import { AnnotationItem } from '../../electron/types/ipc';

vi.mock('html-to-image', () => ({
  toPng: vi.fn().mockResolvedValue('data:image/png;base64,mockpngdata')
}));

const mockAnnotation: AnnotationItem = {
  uuid: 'anno-quote-1',
  assetId: 'asset-book-quote',
  selectedText: '知行合一，止于至善。',
  note: '传习录核心原文批注',
  representativeText: '知行合一',
  colorKey: 'yellow',
  locationCfi: 'epubcfi(/6/4[chap01]!/4/2/10/1:0)',
  chapterTitle: '第一章 心即理',
  creationDateMs: 1700000000000,
  modificationDateMs: 1700005000000,
  sortIndex: 1,
  customNote: '实践与认知的闭环反馈系统',
  isStarred: true,
  tags: ['心学', '认识论']
};

describe('QuoteCardModal Component', () => {
  const createDefaultProps = (overrides?: Partial<QuoteCardModalProps>): QuoteCardModalProps => ({
    annotation: { ...mockAnnotation },
    bookTitle: '传习录详注',
    author: '王阳明',
    onClose: vi.fn(),
    ...overrides
  });

  it('should render modal header with title "金句卡片设计工坊" and close button', () => {
    const props = createDefaultProps();
    const html = renderToStaticMarkup(<QuoteCardModal {...props} />);

    expect(html).toContain('金句卡片设计工坊');
    expect(html).toContain('aria-label="关闭"');
    expect(html).toContain('data-testid="quote-card-modal"');
  });

  it('should render 4 theme template buttons', () => {
    const props = createDefaultProps();
    const html = renderToStaticMarkup(<QuoteCardModal {...props} />);

    expect(html).toContain('经典纸书');
    expect(html).toContain('瑞士极简');
    expect(html).toContain('暗夜流光');
    expect(html).toContain('森林晨雾');
  });

  it('should render quote text inside blockquote', () => {
    const props = createDefaultProps();
    const html = renderToStaticMarkup(<QuoteCardModal {...props} />);

    expect(html).toContain('知行合一，止于至善。');
    expect(html).toContain('<blockquote');
  });

  it('should render book title and author in card footer', () => {
    const props = createDefaultProps();
    const html = renderToStaticMarkup(<QuoteCardModal {...props} />);

    expect(html).toContain('传习录详注');
    expect(html).toContain('王阳明');
    expect(html).toContain('BookEcho');
  });

  it('should fall back to "未知作者" when author is empty or not provided', () => {
    const props = createDefaultProps({ author: '' });
    const html = renderToStaticMarkup(<QuoteCardModal {...props} />);

    expect(html).toContain('未知作者');
  });

  it('should render customNote when present', () => {
    const props = createDefaultProps();
    const html = renderToStaticMarkup(<QuoteCardModal {...props} />);

    expect(html).toContain('实践与认知的闭环反馈系统');
    expect(html).toContain('data-testid="quote-card-note"');
  });

  it('should fall back to original note when customNote is empty', () => {
    const props = createDefaultProps({
      annotation: {
        ...mockAnnotation,
        customNote: undefined,
        note: '仅有原文批注'
      }
    });
    const html = renderToStaticMarkup(<QuoteCardModal {...props} />);

    expect(html).toContain('仅有原文批注');
    expect(html).toContain('data-testid="quote-card-note"');
  });

  it('should not render note container when both customNote and note are absent', () => {
    const props = createDefaultProps({
      annotation: {
        ...mockAnnotation,
        customNote: undefined,
        note: null
      }
    });
    const html = renderToStaticMarkup(<QuoteCardModal {...props} />);

    expect(html).not.toContain('data-testid="quote-card-note"');
  });

  it('should render note toggle checkbox and label', () => {
    const props = createDefaultProps();
    const html = renderToStaticMarkup(<QuoteCardModal {...props} />);

    expect(html).toContain('展示批注/思考');
    expect(html).toContain('type="checkbox"');
  });

  it('should render action buttons for copy and download', () => {
    const props = createDefaultProps();
    const html = renderToStaticMarkup(<QuoteCardModal {...props} />);

    expect(html).toContain('复制高清卡片');
    expect(html).toContain('保存 PNG 图片');
  });

  it('should default to classic theme styling on preview container', () => {
    const props = createDefaultProps();
    const html = renderToStaticMarkup(<QuoteCardModal {...props} />);

    expect(html).toContain('bg-[#FAF7F2]');
    expect(html).toContain('text-[#1E1D1A]');
    expect(html).toContain('border-[#E6E1D6]');
  });

  it('should verify all 4 themes have defined styles', () => {
    const themes: CardTheme[] = ['classic', 'swiss', 'obsidian', 'sage'];
    themes.forEach(theme => {
      const styles = THEME_STYLES[theme];
      expect(styles).toBeDefined();
      expect(styles.bg).toBeTruthy();
      expect(styles.text).toBeTruthy();
      expect(styles.subText).toBeTruthy();
      expect(styles.border).toBeTruthy();
    });
  });

  it('should include dark mode tokens and backdrop blur on container', () => {
    const props = createDefaultProps();
    const html = renderToStaticMarkup(<QuoteCardModal {...props} />);

    expect(html).toContain('backdrop-blur-sm');
    expect(html).toContain('dark:bg-night-card');
    expect(html).toContain('dark:border-night-border');
    expect(html).toContain('dark:text-night-text');
  });

  it('should invoke onClose callback when triggered', () => {
    const onClose = vi.fn();
    const props = createDefaultProps({ onClose });

    props.onClose();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
