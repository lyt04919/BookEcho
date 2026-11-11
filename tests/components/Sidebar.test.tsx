import type { ReactElement } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Sidebar, SidebarProps } from '../../src/components/Sidebar';
import App from '../../src/App';
import { BookItem } from '../../electron/types/ipc';

const mockBooks: BookItem[] = [
  {
    assetId: 'book-1',
    title: '纳瓦尔宝典',
    author: '埃里克·乔根森',
    genre: '商业',
    epubPath: '/naval.epub',
    readingProgress: 0.8,
    lastOpenDateMs: 1700000000000,
    coverUrl: null,
    highlightsCount: 74
  }
];

describe('Sidebar Component', () => {
  const defaultProps: SidebarProps = {
    currentTab: 'books',
    onSelectTab: vi.fn(),
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
    expect(html).toContain('批注与星标');
    expect(html).toContain('全局搜索');
    expect(html).toContain('知识网络');
    expect(html).toContain('阅读足迹');
    expect(html).not.toContain('每日回顾');
  });

  it('should highlight active tab appropriately', () => {
    const booksHtml = renderToStaticMarkup(<Sidebar {...defaultProps} currentTab="books" />);
    expect(booksHtml).toContain('全部书架');

    const starredHtml = renderToStaticMarkup(<Sidebar {...defaultProps} currentTab="starred_notes" />);
    expect(starredHtml).toContain('批注与星标');

    const searchHtml = renderToStaticMarkup(<Sidebar {...defaultProps} currentTab="search" />);
    expect(searchHtml).toContain('全局搜索');

    const graphHtml = renderToStaticMarkup(<Sidebar {...defaultProps} currentTab="graph" />);
    expect(graphHtml).toContain('知识网络');
  });

  it('should render book notes shortcut list when books with highlights are provided', () => {
    const html = renderToStaticMarkup(<Sidebar {...defaultProps} books={mockBooks} />);
    expect(html).toContain('重点笔记书单');
    expect(html).toContain('纳瓦尔宝典');
    expect(html).toContain('74');
  });

  it('should render chapters list when in book detail mode and hide redundant global tabs', () => {
    const html = renderToStaticMarkup(
      <Sidebar
        {...defaultProps}
        selectedBook={mockBooks[0]}
        chapters={[
          { title: '第一章 财富', notesCount: 5 },
          { title: '第二章 判断力', notesCount: 0 }
        ]}
        activeChapter="第一章 财富"
        onlyChaptersWithNotes={false}
        onToggleChaptersFilter={vi.fn()}
      />
    );
    expect(html).toContain('返回全部书架');
    expect(html).not.toContain('批注与星标');
    expect(html).not.toContain('每日回顾');
    expect(html).not.toContain('阅读足迹');
    expect(html).toContain('章节目录');
    expect(html).toContain('全部章节');
    expect(html).toContain('第一章 财富');
    expect(html).toContain('第二章 判断力');
  });

  it('should filter out chapters with 0 notes when onlyChaptersWithNotes is true', () => {
    const html = renderToStaticMarkup(
      <Sidebar
        {...defaultProps}
        selectedBook={mockBooks[0]}
        chapters={[
          { title: '第一章 财富', notesCount: 5 },
          { title: '第二章 判断力', notesCount: 0 }
        ]}
        onlyChaptersWithNotes={true}
        onToggleChaptersFilter={vi.fn()}
      />
    );
    expect(html).toContain('仅看有笔记');
    expect(html).toContain('第一章 财富');
    expect(html).not.toContain('第二章 判断力');
  });

  it('should render knowledge network nav item with count badge when tags array is non-empty', () => {
    const html = renderToStaticMarkup(<Sidebar {...defaultProps} tags={['心智模型', '经济学']} />);
    expect(html).toContain('知识网络');
    expect(html).toContain('>2<');
  });

  it('should not render tag count badge when tags array is empty', () => {
    const html = renderToStaticMarkup(<Sidebar {...defaultProps} tags={[]} />);
    expect(html).toContain('知识网络');
    expect(html).not.toContain('标签管理');
    expect(html).not.toContain('#心智模型');
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

  it('should trigger navigation and action callbacks when clicked', () => {
    const onSelectTab = vi.fn();
    const onSelectTag = vi.fn();
    const onToggleDarkMode = vi.fn();
    const onSelectCustomDir = vi.fn();
    const onRefreshData = vi.fn();

    const element = Sidebar({
      ...defaultProps,
      currentTab: 'books',
      selectedTag: '哲学',
      onSelectTab,
      onSelectTag,
      onToggleDarkMode,
      onSelectCustomDir,
      onRefreshData
    }) as ReactElement<any>;

    expect(element).toBeDefined();
    expect(element.type).toBe('aside');

    const [topDiv, _middleDiv, bottomDiv] = element.props.children;

    // 导航区
    const nav = topDiv.props.children[2];
    const [booksBtn, starredBtn, searchBtn, graphBtn] = nav.props.children;

    booksBtn.props.onClick();
    expect(onSelectTab).toHaveBeenCalledWith('books');

    starredBtn.props.onClick();
    expect(onSelectTab).toHaveBeenCalledWith('starred_notes');

    searchBtn.props.onClick();
    expect(onSelectTab).toHaveBeenCalledWith('search');

    graphBtn.props.onClick();
    expect(onSelectTab).toHaveBeenCalledWith('graph');

    // 底部系统操作
    const bottomBtns = bottomDiv.props.children.filter(Boolean);
    const [refreshBtn, customDirBtn, darkModeBtn] = bottomBtns;
    refreshBtn.props.onClick();
    expect(onRefreshData).toHaveBeenCalled();

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
    expect(html).toContain('颜色语义配置');
  });
});
