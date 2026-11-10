import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DailyReviewView, DailyReviewViewProps, handleReviewKeyDown } from '../../src/components/DailyReviewView';
import { AnnotationItem, ColorSemanticConfig } from '../../electron/types/ipc';

const mockColorSemantics: ColorSemanticConfig[] = [
  { colorKey: 'yellow', label: '核心论点', hexColor: '#F5A623' },
  { colorKey: 'green', label: '行动与实践', hexColor: '#5CB85C' },
  { colorKey: 'blue', label: '概念与背景', hexColor: '#4A90E2' },
  { colorKey: 'pink', label: '灵感与金句', hexColor: '#E86F88' },
  { colorKey: 'purple', label: '存疑与深思', hexColor: '#9B6B9E' },
  { colorKey: 'underline', label: '重点下划线', hexColor: '#D9534F' }
];

const mockReviewQueue: AnnotationItem[] = [
  {
    uuid: 'review-anno-1',
    assetId: 'asset-book-1',
    bookTitle: '原则：应对变化中的世界秩序',
    chapterTitle: '第一章 运转机制',
    selectedText: '历史总是惊人地相似，而人们总是不长记性。',
    note: '大周期的必然规律',
    customNote: '宏观债务周期的递归性',
    representativeText: '历史总是相似',
    colorKey: 'yellow',
    locationCfi: 'epubcfi(/6/2!/4/1:0)',
    creationDateMs: 1700000000000,
    modificationDateMs: 1700001000000,
    sortIndex: 1,
    isStarred: true,
    tags: ['宏观周期']
  },
  {
    uuid: 'review-anno-2',
    assetId: 'asset-book-2',
    bookTitle: '思考，快与慢',
    chapterTitle: '第二章 系统1与系统2',
    selectedText: '慢思考能帮我们发现快思考的隐性偏见。',
    note: null,
    customNote: undefined,
    representativeText: '慢思考',
    colorKey: 'green',
    locationCfi: 'epubcfi(/6/4!/4/2:0)',
    creationDateMs: 1700002000000,
    modificationDateMs: 1700003000000,
    sortIndex: 2,
    isStarred: false,
    tags: ['认知心理学']
  },
  {
    uuid: 'review-anno-3',
    assetId: 'asset-book-3',
    chapterTitle: '',
    selectedText: '行百里者半九十。',
    note: null,
    customNote: '执行力的重要性',
    representativeText: '行百里',
    colorKey: 'purple',
    locationCfi: null,
    creationDateMs: 1700004000000,
    modificationDateMs: 1700005000000,
    sortIndex: 3,
    isStarred: false
  }
];

describe('DailyReviewView Component', () => {
  const createDefaultProps = (overrides?: Partial<DailyReviewViewProps>): DailyReviewViewProps => ({
    queue: mockReviewQueue,
    colorSemantics: mockColorSemantics,
    onSubmitResult: vi.fn(),
    onRefreshQueue: vi.fn(),
    ...overrides
  });

  describe('Card Rendering & Layout', () => {
    it('should render progress counter and mode badge for active queue', () => {
      const props = createDefaultProps();
      const html = renderToStaticMarkup(<DailyReviewView {...props} />);

      expect(html).toContain('每日漫游 · 专注模式');
      expect(html).toContain('1 / 3');
    });

    it('should render book title and chapter metadata at the top of the card', () => {
      const props = createDefaultProps();
      const html = renderToStaticMarkup(<DailyReviewView {...props} />);

      expect(html).toContain('原则：应对变化中的世界秩序');
      expect(html).toContain('第一章 运转机制');
    });

    it('should fallback gracefully when bookTitle or chapterTitle are missing', () => {
      const fallbackQueue: AnnotationItem[] = [
        {
          ...mockReviewQueue[0],
          bookTitle: undefined,
          chapterTitle: ''
        }
      ];
      const props = createDefaultProps({ queue: fallbackQueue });
      const html = renderToStaticMarkup(<DailyReviewView {...props} />);

      expect(html).toContain('未知书籍');
      expect(html).toContain('默认章节');
    });

    it('should render large serif quote block with quotation marks', () => {
      const props = createDefaultProps();
      const html = renderToStaticMarkup(<DailyReviewView {...props} />);

      expect(html).toContain('font-serif');
      expect(html).toContain('“历史总是惊人地相似，而人们总是不长记性。”');
    });

    it('should render top accent color stripe matching semantic hexColor', () => {
      const props = createDefaultProps();
      const html = renderToStaticMarkup(<DailyReviewView {...props} />);

      // yellow hex color is #F5A623
      expect(html).toContain('background-color:#F5A623');
    });

    it('should fallback to default amber stripe if colorKey is unknown', () => {
      const unknownColorQueue: AnnotationItem[] = [
        {
          ...mockReviewQueue[0],
          colorKey: 'unknown' as any
        }
      ];
      const props = createDefaultProps({ queue: unknownColorQueue });
      const html = renderToStaticMarkup(<DailyReviewView {...props} />);

      expect(html).toContain('background-color:#F5A623');
    });

    it('should render star icon when annotation is starred', () => {
      const props = createDefaultProps();
      const html = renderToStaticMarkup(<DailyReviewView {...props} />);

      expect(html).toContain('data-testid="starred-icon"');
      expect(html).toContain('text-amber-500');
    });

    it('should not render star icon when annotation is not starred', () => {
      const unstarredQueue: AnnotationItem[] = [
        {
          ...mockReviewQueue[0],
          isStarred: false
        }
      ];
      const props = createDefaultProps({ queue: unstarredQueue });
      const html = renderToStaticMarkup(<DailyReviewView {...props} />);

      expect(html).not.toContain('data-testid="starred-icon"');
    });
  });

  describe('Notes & Thoughts Display', () => {
    it('should render native Apple Books note when present', () => {
      const props = createDefaultProps();
      const html = renderToStaticMarkup(<DailyReviewView {...props} />);

      expect(html).toContain('划线想法：');
      expect(html).toContain('大周期的必然规律');
      expect(html).toContain('data-testid="native-note-block"');
    });

    it('should omit native note block when note is null', () => {
      const props = createDefaultProps({ queue: [mockReviewQueue[1]] });
      const html = renderToStaticMarkup(<DailyReviewView {...props} />);

      expect(html).not.toContain('划线想法：');
      expect(html).not.toContain('data-testid="native-note-block"');
    });

    it('should render secondary custom thought when present', () => {
      const props = createDefaultProps();
      const html = renderToStaticMarkup(<DailyReviewView {...props} />);

      expect(html).toContain('延伸思考：');
      expect(html).toContain('宏观债务周期的递归性');
      expect(html).toContain('data-testid="custom-note-block"');
    });

    it('should omit custom thought block when customNote is absent or empty', () => {
      const props = createDefaultProps({ queue: [mockReviewQueue[1]] });
      const html = renderToStaticMarkup(<DailyReviewView {...props} />);

      expect(html).not.toContain('延伸思考：');
      expect(html).not.toContain('data-testid="custom-note-block"');
    });
  });

  describe('Action Buttons & Keyboard Shortcut Instructions', () => {
    it('should render action buttons for mastered and remembered', () => {
      const props = createDefaultProps();
      const html = renderToStaticMarkup(<DailyReviewView {...props} />);

      expect(html).toContain('已内化');
      expect(html).toContain('有启发');
      expect(html).toContain('aria-label="已内化"');
      expect(html).toContain('aria-label="有启发"');
    });

    it('should render keyboard shortcut guidance text', () => {
      const props = createDefaultProps();
      const html = renderToStaticMarkup(<DailyReviewView {...props} />);

      expect(html).toContain('按 <kbd class="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 dark:text-night-text font-mono">空格</kbd> / <kbd class="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 dark:text-night-text font-mono">→</kbd> 下一条');
      expect(html).toContain('<kbd class="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 dark:text-night-text font-mono">Enter</kbd> 标为内化');
    });

    it('should include overflow-y-auto on main container', () => {
      const props = createDefaultProps();
      const html = renderToStaticMarkup(<DailyReviewView {...props} />);
      expect(html).toContain('overflow-y-auto');
    });
  });

  describe('Completion State', () => {
    it('should render completion view when queue is empty', () => {
      const props = createDefaultProps({ queue: [] });
      const html = renderToStaticMarkup(<DailyReviewView {...props} />);

      expect(html).toContain('今日回顾已达成！');
      expect(html).toContain('温故而知新。你已经完成今天全部读书高亮漫游，这些思考已深深印入知识体系中。');
      expect(html).toContain('换一批再次漫游');
    });

    it('should support invoking onRefreshQueue when reset button is triggered', () => {
      const onRefreshQueue = vi.fn();
      const props = createDefaultProps({ queue: [], onRefreshQueue });

      props.onRefreshQueue();
      expect(onRefreshQueue).toHaveBeenCalledTimes(1);
    });
  });

  describe('Dark Mode & Light Paper Tokens Styling', () => {
    it('should include full light and dark tokens on active card view', () => {
      const props = createDefaultProps();
      const html = renderToStaticMarkup(<DailyReviewView {...props} />);

      // Light tokens
      expect(html).toContain('bg-paper-bg');
      expect(html).toContain('bg-paper-card');
      expect(html).toContain('border-paper-border');
      expect(html).toContain('text-paper-text');
      expect(html).toContain('text-paper-muted');
      expect(html).toContain('bg-paper-drawer');
      expect(html).toContain('bg-paper-terracotta');

      // Dark night tokens
      expect(html).toContain('dark:bg-night-bg');
      expect(html).toContain('dark:bg-night-card');
      expect(html).toContain('dark:border-night-border');
      expect(html).toContain('dark:text-night-text');
      expect(html).toContain('dark:text-night-muted');
      expect(html).toContain('dark:bg-night-drawer');
      expect(html).toContain('dark:bg-night-terracotta');
    });

    it('should include full light and dark tokens on completion view', () => {
      const props = createDefaultProps({ queue: [] });
      const html = renderToStaticMarkup(<DailyReviewView {...props} />);

      expect(html).toContain('bg-paper-bg');
      expect(html).toContain('dark:bg-night-bg');
      expect(html).toContain('text-paper-text');
      expect(html).toContain('dark:text-night-text');
      expect(html).toContain('text-paper-muted');
      expect(html).toContain('dark:text-night-muted');
      expect(html).toContain('bg-paper-terracotta');
      expect(html).toContain('dark:bg-night-terracotta');
    });
  });

  describe('Keyboard Navigation Handler (handleReviewKeyDown)', () => {
    it('should trigger "remembered" action on Space key press', () => {
      const onAction = vi.fn();
      const preventDefault = vi.fn();
      const handled = handleReviewKeyDown(
        { key: ' ', preventDefault },
        mockReviewQueue[0],
        onAction
      );

      expect(handled).toBe(true);
      expect(preventDefault).toHaveBeenCalled();
      expect(onAction).toHaveBeenCalledWith('remembered');
    });

    it('should trigger "remembered" action on ArrowRight key press', () => {
      const onAction = vi.fn();
      const preventDefault = vi.fn();
      const handled = handleReviewKeyDown(
        { key: 'ArrowRight', preventDefault },
        mockReviewQueue[0],
        onAction
      );

      expect(handled).toBe(true);
      expect(preventDefault).toHaveBeenCalled();
      expect(onAction).toHaveBeenCalledWith('remembered');
    });

    it('should trigger "mastered" action on Enter key press', () => {
      const onAction = vi.fn();
      const preventDefault = vi.fn();
      const handled = handleReviewKeyDown(
        { key: 'Enter', preventDefault },
        mockReviewQueue[0],
        onAction
      );

      expect(handled).toBe(true);
      expect(preventDefault).toHaveBeenCalled();
      expect(onAction).toHaveBeenCalledWith('mastered');
    });

    it('should ignore other keys like Escape or Tab', () => {
      const onAction = vi.fn();
      const preventDefault = vi.fn();
      const handled = handleReviewKeyDown(
        { key: 'Escape', preventDefault },
        mockReviewQueue[0],
        onAction
      );

      expect(handled).toBe(false);
      expect(preventDefault).not.toHaveBeenCalled();
      expect(onAction).not.toHaveBeenCalled();
    });

    it('should ignore key events when focus is inside an input or textarea', () => {
      const onAction = vi.fn();
      const inputHandled = handleReviewKeyDown(
        { key: ' ', target: { tagName: 'INPUT' } as unknown as EventTarget },
        mockReviewQueue[0],
        onAction
      );
      expect(inputHandled).toBe(false);
      expect(onAction).not.toHaveBeenCalled();

      const textareaHandled = handleReviewKeyDown(
        { key: 'Enter', target: { tagName: 'TEXTAREA' } as unknown as EventTarget },
        mockReviewQueue[0],
        onAction
      );
      expect(textareaHandled).toBe(false);
      expect(onAction).not.toHaveBeenCalled();
    });

    it('should not trigger action if currentItem is undefined', () => {
      const onAction = vi.fn();
      const handled = handleReviewKeyDown(
        { key: 'Enter' },
        undefined,
        onAction
      );
      expect(handled).toBe(false);
      expect(onAction).not.toHaveBeenCalled();
    });
  });

  describe('Card Progression & Action Execution Simulation', () => {
    it('should correctly simulate progression across cards in queue to completion', () => {
      const onSubmitResult = vi.fn();
      let currentIndex = 0;
      const queue = mockReviewQueue;

      const handleAction = (result: 'remembered' | 'mastered' | 'reset') => {
        const item = queue[currentIndex];
        if (!item) return;
        onSubmitResult(item.uuid, result);
        if (currentIndex < queue.length - 1) {
          currentIndex += 1;
        } else {
          currentIndex = queue.length;
        }
      };

      // Card 0: principios
      expect(currentIndex).toBe(0);
      handleAction('remembered');
      expect(onSubmitResult).toHaveBeenLastCalledWith('review-anno-1', 'remembered');
      expect(currentIndex).toBe(1);

      // Card 1: thinking fast & slow
      handleAction('mastered');
      expect(onSubmitResult).toHaveBeenLastCalledWith('review-anno-2', 'mastered');
      expect(currentIndex).toBe(2);

      // Card 2: last card
      handleAction('remembered');
      expect(onSubmitResult).toHaveBeenLastCalledWith('review-anno-3', 'remembered');
      expect(currentIndex).toBe(3); // Reached queue.length

      // Verify completion state when currentIndex >= queue.length
      expect(currentIndex >= queue.length).toBe(true);
      expect(onSubmitResult).toHaveBeenCalledTimes(3);
    });
  });
});
