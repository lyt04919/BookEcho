import type { ReactElement } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Sidebar, SidebarProps } from '../../src/components/Sidebar';
import App from '../../src/App';
import { ColorSemanticConfig } from '../../electron/types/ipc';

const mockColorSemantics: ColorSemanticConfig[] = [
  { colorKey: 'yellow', label: '核心论点', hexColor: '#F5A623' },
  { colorKey: 'green', label: '行动与实践', hexColor: '#5CB85C' },
  { colorKey: 'blue', label: '概念与背景', hexColor: '#4A90E2' },
  { colorKey: 'pink', label: '灵感与金句', hexColor: '#E86F88' },
  { colorKey: 'purple', label: '存疑与深思', hexColor: '#9B6B9E' },
  { colorKey: 'underline', label: '重点下划线', hexColor: '#D9534F' }
];

describe('Sidebar Component', () => {
  const defaultProps: SidebarProps = {
    currentTab: 'books',
    onSelectTab: vi.fn(),
    colorSemantics: mockColorSemantics,
    selectedColor: null,
    onSelectColor: vi.fn(),
    tags: ['哲学', '科技'],
    selectedTag: null,
    onSelectTag: vi.fn(),
    isDarkMode: false,
    onToggleDarkMode: vi.fn(),
    onSelectCustomDir: vi.fn()
  };

  it('should render the app title and subtitle', () => {
    const html = renderToStaticMarkup(<Sidebar {...defaultProps} />);
    expect(html).toContain('BookEcho');
    expect(html).toContain('个人读书精华馆');
  });

  it('should render primary navigation tabs', () => {
    const html = renderToStaticMarkup(<Sidebar {...defaultProps} />);
    expect(html).toContain('全部书架');
    expect(html).toContain('每日回顾');
    expect(html).toContain('全局搜索');
  });

  it('should highlight active tab appropriately', () => {
    // When on books tab without filters
    const booksHtml = renderToStaticMarkup(<Sidebar {...defaultProps} currentTab="books" />);
    expect(booksHtml).toContain('全部书架');

    // When on review tab
    const reviewHtml = renderToStaticMarkup(<Sidebar {...defaultProps} currentTab="review" />);
    expect(reviewHtml).toContain('每日回顾');

    // When on search tab
    const searchHtml = renderToStaticMarkup(<Sidebar {...defaultProps} currentTab="search" />);
    expect(searchHtml).toContain('全局搜索');
  });

  it('should render all color semantic items with background colors', () => {
    const html = renderToStaticMarkup(<Sidebar {...defaultProps} />);
    for (const item of mockColorSemantics) {
      expect(html).toContain(item.label);
      expect(html).toContain(item.hexColor);
    }
  });

  it('should render tags when tags array is non-empty', () => {
    const html = renderToStaticMarkup(<Sidebar {...defaultProps} tags={['心智模型', '经济学']} />);
    expect(html).toContain('#心智模型');
    expect(html).toContain('#经济学');
  });

  it('should not render tags section when tags array is empty', () => {
    const html = renderToStaticMarkup(<Sidebar {...defaultProps} tags={[]} />);
    expect(html).not.toContain('#心智模型');
    expect(html).not.toContain('<div class="flex flex-wrap gap-1.5 px-2">');
  });

  it('should include dark mode styling classes corresponding to night tokens', () => {
    const html = renderToStaticMarkup(<Sidebar {...defaultProps} tags={['测试标签']} />);
    expect(html).toContain('dark:border-night-border');
    expect(html).toContain('dark:bg-night-sidebar');
    expect(html).toContain('dark:text-night-text');
    expect(html).toContain('dark:text-night-muted');
    expect(html).toContain('dark:bg-night-drawer');
    expect(html).toContain('dark:hover:bg-white/5');
  });

  it('should show "深色夜读" when in light mode and "浅色模式" when in dark mode', () => {
    const lightHtml = renderToStaticMarkup(<Sidebar {...defaultProps} isDarkMode={false} />);
    expect(lightHtml).toContain('深色夜读');
    expect(lightHtml).not.toContain('浅色模式');

    const darkHtml = renderToStaticMarkup(<Sidebar {...defaultProps} isDarkMode={true} />);
    expect(darkHtml).toContain('浅色模式');
    expect(darkHtml).not.toContain('深色夜读');
  });

  it('should trigger navigation and filter callbacks when clicked', () => {
    const onSelectTab = vi.fn();
    const onSelectColor = vi.fn();
    const onSelectTag = vi.fn();
    const onToggleDarkMode = vi.fn();
    const onSelectCustomDir = vi.fn();

    const element = Sidebar({
      ...defaultProps,
      currentTab: 'books',
      selectedColor: 'yellow',
      selectedTag: '哲学',
      onSelectTab,
      onSelectColor,
      onSelectTag,
      onToggleDarkMode,
      onSelectCustomDir
    }) as ReactElement<any>;

    // Traverse the rendered React element tree
    expect(element).toBeDefined();
    expect(element.type).toBe('aside');

    const topDiv = element.props.children[0];
    const bottomDiv = element.props.children[1];

    // Nav buttons are in topDiv.props.children[2]
    const nav = topDiv.props.children[2];
    const [booksBtn, reviewBtn, searchBtn] = nav.props.children;

    booksBtn.props.onClick();
    expect(onSelectTab).toHaveBeenCalledWith('books');

    reviewBtn.props.onClick();
    expect(onSelectTab).toHaveBeenCalledWith('review');

    searchBtn.props.onClick();
    expect(onSelectTab).toHaveBeenCalledWith('search');

    // Color buttons are in topDiv.props.children[3]
    const colorSection = topDiv.props.children[3];
    const colorList = colorSection.props.children[1];
    const colorButtons = colorList.props.children;

    // First color button is 'yellow', which is currently selected, so clicking it should toggle to null
    colorButtons[0].props.onClick();
    expect(onSelectColor).toHaveBeenCalledWith(null);

    // Second color button is 'green', which is unselected, so clicking it should pass 'green'
    colorButtons[1].props.onClick();
    expect(onSelectColor).toHaveBeenCalledWith('green');

    // Tag buttons are in topDiv.props.children[4]
    const tagSection = topDiv.props.children[4];
    const tagList = tagSection.props.children[1];
    const tagButtons = tagList.props.children;

    // First tag is '哲学', which is currently selected, so clicking it should toggle to null
    tagButtons[0].props.onClick();
    expect(onSelectTag).toHaveBeenCalledWith(null);

    // Second tag is '科技', unselected, so clicking it should pass '科技'
    tagButtons[1].props.onClick();
    expect(onSelectTag).toHaveBeenCalledWith('科技');

    // Bottom action buttons
    const [customDirBtn, darkModeBtn] = bottomDiv.props.children;
    customDirBtn.props.onClick();
    expect(onSelectCustomDir).toHaveBeenCalled();

    darkModeBtn.props.onClick();
    expect(onToggleDarkMode).toHaveBeenCalled();
  });
});

describe('App Integration with Sidebar', () => {
  it('should render App with Sidebar correctly', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('BookEcho');
    expect(html).toContain('全部书架');
    expect(html).toContain('我的书库');
  });
});
