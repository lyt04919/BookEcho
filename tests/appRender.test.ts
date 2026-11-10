import React, { ReactElement } from 'react';
import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { renderToStaticMarkup } from 'react-dom/server';
import App from '../src/App';
import { BookItem, AnnotationItem } from '../electron/types/ipc';

describe('App Build Artifact Integrity', () => {
  it('should verify all core components and pages exist', () => {
    const requiredFiles = [
      'src/App.tsx',
      'src/components/Sidebar.tsx',
      'src/components/BookshelfView.tsx',
      'src/components/BookDetailView.tsx',
      'src/components/HighlightCard.tsx',
      'src/components/DailyReviewView.tsx',
      'src/components/QuoteCardModal.tsx',
      'src/components/ExportModal.tsx',
      'src/components/PermissionGuide.tsx'
    ];

    for (const f of requiredFiles) {
      expect(fs.existsSync(path.resolve(__dirname, '..', f))).toBe(true);
    }
  });
});

describe('App State and Orchestration', () => {
  const mockBooks: BookItem[] = [
    {
      assetId: 'book-1',
      title: '纳瓦尔宝典',
      author: '埃里克·乔根森',
      genre: '自我提升',
      readingProgress: 0.85,
      coverUrl: null,
      epubPath: '/books/naval.epub',
      highlightsCount: 12,
      lastOpenDateMs: 1700000000000
    }
  ];

  const mockAnnotation: AnnotationItem = {
    uuid: 'anno-1',
    assetId: 'book-1',
    bookTitle: '纳瓦尔宝典',
    selectedText: '致富不是靠运气，而是靠技能。',
    representativeText: '致富不是靠运气',
    note: '关键观点',
    customNote: '需要复习实践',
    chapterTitle: '第一章 财富',
    colorKey: 'yellow',
    sortIndex: 1,
    locationCfi: 'epubcfi(/6/4[chap01]!/4/2/10)',
    creationDateMs: 1700000100000,
    modificationDateMs: 1700000200000,
    isStarred: true,
    tags: ['思维', '商业'],
    reviewCount: 2,
    reviewStatus: 'active'
  };

  it('should render default bookshelf view when no error exists', () => {
    const html = renderToStaticMarkup(React.createElement(App, null));
    expect(html).toContain('BookEcho');
    expect(html).toContain('全部书架');
    expect(html).toContain('每日回顾');
    expect(html).toContain('全局搜索');
    expect(html).toContain('我的书库');
  });

  it('should render PermissionGuide when hasPermissionError is true', () => {
    const dispatcher = (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher;
    const prevDispatcher = dispatcher.current;

    let stateCallIndex = 0;
    dispatcher.current = {
      useState: (initial: any) => {
        stateCallIndex++;
        // Index 15 in App is hasPermissionError
        if (stateCallIndex === 15) {
          return [true, vi.fn()];
        }
        return [initial, vi.fn()];
      },
      useEffect: () => {},
      useRef: () => ({ current: null })
    };

    try {
      const element = App() as ReactElement<any>;
      const html = renderToStaticMarkup(element);
      expect(html).toContain('需要 Apple Books 数据读取权限');
      expect(html).toContain('手动选择 iBooks 目录或备份');
      expect(html).toContain('重新检测系统权限');
    } finally {
      dispatcher.current = prevDispatcher;
    }
  });

  it('should render global search view when currentTab is search', () => {
    const dispatcher = (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher;
    const prevDispatcher = dispatcher.current;

    let stateCallIndex = 0;
    dispatcher.current = {
      useState: (initial: any) => {
        stateCallIndex++;
        // Index 1 is currentTab
        if (stateCallIndex === 1) {
          return ['search', vi.fn()];
        }
        // Index 10 is searchKeyword
        if (stateCallIndex === 10) {
          return ['财富', vi.fn()];
        }
        // Index 11 is searchResults
        if (stateCallIndex === 11) {
          return [[mockAnnotation], vi.fn()];
        }
        return [initial, vi.fn()];
      },
      useEffect: () => {},
      useRef: () => ({ current: null })
    };

    try {
      const element = App() as ReactElement<any>;
      const html = renderToStaticMarkup(element);
      expect(html).toContain('搜索高亮句子、想法或批注...');
      expect(html).toContain('致富不是靠运气，而是靠技能。');
      expect(html).toContain('划线批注: 关键观点');
    } finally {
      dispatcher.current = prevDispatcher;
    }
  });

  it('should navigate to book detail when clicking search result card', () => {
    const dispatcher = (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher;
    const prevDispatcher = dispatcher.current;

    let stateCallIndex = 0;
    const setTabMock = vi.fn();
    const setSelectedBookMock = vi.fn();

    dispatcher.current = {
      useState: (initial: any) => {
        stateCallIndex++;
        // Index 1 is currentTab
        if (stateCallIndex === 1) {
          return ['search', setTabMock];
        }
        // Index 2 is books
        if (stateCallIndex === 2) {
          return [mockBooks, vi.fn()];
        }
        // Index 3 is selectedBook
        if (stateCallIndex === 3) {
          return [null, setSelectedBookMock];
        }
        // Index 10 is searchKeyword
        if (stateCallIndex === 10) {
          return ['财富', vi.fn()];
        }
        // Index 11 is searchResults
        if (stateCallIndex === 11) {
          return [[mockAnnotation], vi.fn()];
        }
        return [initial, vi.fn()];
      },
      useEffect: () => {},
      useRef: () => ({ current: null })
    };

    try {
      const element = App() as ReactElement<any>;
      const main = element.props.children[1];
      const searchContainer = main.props.children;
      const resultList = searchContainer.props.children[1];
      const resultCard = resultList.props.children[0][0];

      expect(resultCard.props.onClick).toBeDefined();
      resultCard.props.onClick();
      expect(setSelectedBookMock).toHaveBeenCalledWith(mockBooks[0]);
      expect(setTabMock).toHaveBeenCalledWith('books');
    } finally {
      dispatcher.current = prevDispatcher;
    }
  });

  it('should render daily review view when currentTab is review', () => {
    const dispatcher = (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher;
    const prevDispatcher = dispatcher.current;

    let stateCallIndex = 0;
    dispatcher.current = {
      useState: (initial: any) => {
        stateCallIndex++;
        // Index 1 is currentTab
        if (stateCallIndex === 1) {
          return ['review', vi.fn()];
        }
        // Index 5 is reviewQueue
        if (stateCallIndex === 5) {
          return [[mockAnnotation], vi.fn()];
        }
        return [initial, vi.fn()];
      },
      useEffect: () => {},
      useRef: () => ({ current: null })
    };

    try {
      const element = App() as ReactElement<any>;
      const html = renderToStaticMarkup(element);
      expect(html).toContain('每日漫游 · 专注模式');
      expect(html).toContain('致富不是靠运气，而是靠技能。');
    } finally {
      dispatcher.current = prevDispatcher;
    }
  });

  it('should render book detail view and modals when selectedBook is set', () => {
    const dispatcher = (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher;
    const prevDispatcher = dispatcher.current;

    let stateCallIndex = 0;
    dispatcher.current = {
      useState: (initial: any) => {
        stateCallIndex++;
        // Index 3 is selectedBook
        if (stateCallIndex === 3) {
          return [mockBooks[0], vi.fn()];
        }
        // Index 4 is currentAnnotations
        if (stateCallIndex === 4) {
          return [[mockAnnotation], vi.fn()];
        }
        // Index 13 is activeQuoteItem
        if (stateCallIndex === 13) {
          return [mockAnnotation, vi.fn()];
        }
        // Index 14 is exportBookAssetId
        if (stateCallIndex === 14) {
          return ['book-1', vi.fn()];
        }
        return [initial, vi.fn()];
      },
      useEffect: () => {},
      useRef: () => ({ current: null })
    };

    try {
      const element = App() as ReactElement<any>;
      const html = renderToStaticMarkup(element);
      expect(html).toContain('纳瓦尔宝典');
      expect(html).toContain('致富不是靠运气，而是靠技能。');
      // Quote card modal rendered
      expect(html).toContain('金句卡片设计工坊');
      // Export modal rendered
      expect(html).toContain('导出 Markdown 笔记');
    } finally {
      dispatcher.current = prevDispatcher;
    }
  });
});
