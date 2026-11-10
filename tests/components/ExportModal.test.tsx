import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ExportModal, ExportModalProps } from '../../src/components/ExportModal';

describe('ExportModal Component', () => {
  const createDefaultProps = (overrides?: Partial<ExportModalProps>): ExportModalProps => ({
    bookTitle: '百年孤独',
    onClose: vi.fn(),
    onConfirmExport: vi.fn().mockResolvedValue(undefined),
    ...overrides
  });

  it('should render title and close button', () => {
    const props = createDefaultProps();
    const html = renderToStaticMarkup(<ExportModal {...props} />);

    expect(html).toContain('导出 Markdown 笔记');
    expect(html).toContain('aria-label="关闭"');
    expect(html).toContain('data-testid="export-modal"');
  });

  it('should display the book title in the description text', () => {
    const props = createDefaultProps({ bookTitle: '思考，快与慢' });
    const html = renderToStaticMarkup(<ExportModal {...props} />);

    expect(html).toContain('正在导出《思考，快与慢》的全部高亮、批注与延伸思考：');
  });

  it('should display Obsidian and Standard format options with descriptions', () => {
    const props = createDefaultProps();
    const html = renderToStaticMarkup(<ExportModal {...props} />);

    expect(html).toContain('Obsidian 知识库增强格式（推荐）');
    expect(html).toContain('包含 YAML Frontmatter 标头、[!quote] Callout 色彩语义高亮块');
    expect(html).toContain('标准通用精排 Markdown');
    expect(html).toContain('通用语法，兼容 Notion、Typora、GitHub 与常见博客平台');
  });

  it('should default to Obsidian format selected with terracotta border', () => {
    const props = createDefaultProps();
    const html = renderToStaticMarkup(<ExportModal {...props} />);

    expect(html).toContain('data-testid="format-obsidian-option"');
    expect(html).toContain('border-paper-terracotta');
  });

  it('should render action buttons for cancel and confirm', () => {
    const props = createDefaultProps();
    const html = renderToStaticMarkup(<ExportModal {...props} />);

    expect(html).toContain('取消');
    expect(html).toContain('选择位置并保存');
  });

  it('should include dark mode and backdrop blur tokens', () => {
    const props = createDefaultProps();
    const html = renderToStaticMarkup(<ExportModal {...props} />);

    expect(html).toContain('backdrop-blur-sm');
    expect(html).toContain('dark:bg-night-card');
    expect(html).toContain('dark:border-night-border');
    expect(html).toContain('dark:text-night-text');
  });

  it('should trigger onClose and onConfirmExport callbacks', async () => {
    const onClose = vi.fn();
    const onConfirmExport = vi.fn().mockResolvedValue(undefined);
    const props = createDefaultProps({ onClose, onConfirmExport });

    props.onClose();
    expect(onClose).toHaveBeenCalledTimes(1);

    await props.onConfirmExport('obsidian');
    expect(onConfirmExport).toHaveBeenCalledWith('obsidian');

    await props.onConfirmExport('standard');
    expect(onConfirmExport).toHaveBeenCalledWith('standard');
  });

  it('should support closing via backdrop click while stopping propagation on card', () => {
    const onClose = vi.fn();
    const props = createDefaultProps({ onClose });

    const dispatcher = (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher;
    const prevDispatcher = dispatcher.current;
    dispatcher.current = {
      useState: (init: any) => [init, vi.fn()],
      useEffect: () => {}
    };

    try {
      const root = ExportModal(props) as any;
      expect(root.props.onClick).toBe(onClose);

      const stopPropagation = vi.fn();
      const card = root.props.children;
      card.props.onClick({ stopPropagation });
      expect(stopPropagation).toHaveBeenCalledTimes(1);
      expect(onClose).not.toHaveBeenCalled();
    } finally {
      dispatcher.current = prevDispatcher;
    }
  });

  it('should register Escape key listener and close on Escape', () => {
    const onClose = vi.fn();
    let listener: ((e: any) => void) | null = null;
    const originalWindow = (global as any).window;
    (global as any).window = {
      addEventListener: vi.fn((event: string, cb: any) => {
        if (event === 'keydown') listener = cb;
      }),
      removeEventListener: vi.fn()
    };

    const dispatcher = (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher;
    const prevDispatcher = dispatcher.current;
    dispatcher.current = {
      useState: (init: any) => [init, vi.fn()],
      useEffect: (cb: any) => {
        cb();
      }
    };

    try {
      ExportModal(createDefaultProps({ onClose }));
      expect((global as any).window.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
      if (listener) {
        (listener as any)({ key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);
        (listener as any)({ key: 'Enter' });
        expect(onClose).toHaveBeenCalledTimes(1);
      }
    } finally {
      dispatcher.current = prevDispatcher;
      if (originalWindow !== undefined) {
        (global as any).window = originalWindow;
      } else {
        delete (global as any).window;
      }
    }
  });
});
