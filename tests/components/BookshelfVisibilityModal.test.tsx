import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BookshelfVisibilityModal } from '../../src/components/BookshelfVisibilityModal';
import { BookItem } from '../../electron/types/ipc';

const mockBooks: BookItem[] = [
  {
    assetId: 'b1',
    title: '纳瓦尔宝典',
    author: '埃里克·乔根森',
    genre: '商业',
    epubPath: '/b1.epub',
    readingProgress: 0.9,
    lastOpenDateMs: 1700000000000,
    coverUrl: null,
    highlightsCount: 30
  },
  {
    assetId: 'b2',
    title: '样例试读书籍',
    author: '测试作者',
    genre: null,
    epubPath: '/b2.epub',
    readingProgress: 0.1,
    lastOpenDateMs: 1699000000000,
    coverUrl: null,
    highlightsCount: 0
  }
];

describe('BookshelfVisibilityModal Component', () => {
  it('should render modal header, search bar, status filters, and book list', () => {
    const html = renderToStaticMarkup(
      <BookshelfVisibilityModal
        books={mockBooks}
        hiddenBookIds={['b2']}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(html).toContain('管理书架展示书籍');
    expect(html).toContain('data-testid="bookshelf-visibility-modal"');
    expect(html).toContain('全部 (2)');
    expect(html).toContain('展示中 (1)');
    expect(html).toContain('已隐藏 (1)');
    expect(html).toContain('纳瓦尔宝典');
    expect(html).toContain('样例试读书籍');
  });

  it('should render quick batch selection tools', () => {
    const html = renderToStaticMarkup(
      <BookshelfVisibilityModal
        books={mockBooks}
        hiddenBookIds={[]}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(html).toContain('全部展示');
    expect(html).toContain('仅保留有笔记的书');
    expect(html).toContain('清空勾选（逐本自选）');
  });

  it('should support dark mode classes and save/cancel buttons', () => {
    const html = renderToStaticMarkup(
      <BookshelfVisibilityModal
        books={mockBooks}
        hiddenBookIds={['b2']}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(html).toContain('dark:bg-night-card');
    expect(html).toContain('dark:border-night-border');
    expect(html).toContain('保存设置');
    expect(html).toContain('取消');
    expect(html).toContain('（隐藏 1 本）');
  });
});
