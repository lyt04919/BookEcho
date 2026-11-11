import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ColorSemanticsModal,
  DEFAULT_COLOR_SEMANTICS,
  SEMANTIC_PRESETS
} from '../../src/components/ColorSemanticsModal';
import { AnnotationItem } from '../../electron/types/ipc';

const mockAnnotations: AnnotationItem[] = [
  {
    uuid: 'a1',
    assetId: 'b1',
    selectedText: 'First quote',
    note: null,
    representativeText: null,
    colorKey: 'yellow',
    locationCfi: 'cfi1',
    chapterTitle: 'Ch1',
    creationDateMs: 1700000000000,
    modificationDateMs: 1700000000000,
    sortIndex: 1
  },
  {
    uuid: 'a2',
    assetId: 'b1',
    selectedText: 'Second quote',
    note: null,
    representativeText: null,
    colorKey: 'yellow',
    locationCfi: 'cfi2',
    chapterTitle: 'Ch1',
    creationDateMs: 1700000001000,
    modificationDateMs: 1700000001000,
    sortIndex: 2
  },
  {
    uuid: 'a3',
    assetId: 'b1',
    selectedText: 'Third quote',
    note: null,
    representativeText: null,
    colorKey: 'green',
    locationCfi: 'cfi3',
    chapterTitle: 'Ch2',
    creationDateMs: 1700000002000,
    modificationDateMs: 1700000002000,
    sortIndex: 3
  }
];

describe('ColorSemanticsModal Component', () => {
  it('should render modal header, all 6 color semantics rows, and usage counts', () => {
    const html = renderToStaticMarkup(
      <ColorSemanticsModal
        colorSemantics={DEFAULT_COLOR_SEMANTICS}
        annotations={mockAnnotations}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(html).toContain('高亮颜色语义自定义');
    expect(html).toContain('data-testid="color-semantics-modal"');
    expect(html).toContain('黄色高亮');
    expect(html).toContain('绿色高亮');
    expect(html).toContain('蓝色高亮');
    expect(html).toContain('粉色高亮');
    expect(html).toContain('紫色高亮');
    expect(html).toContain('红色下划线');
    expect(html).toContain('2 条');
    expect(html).toContain('1 条');
    expect(html).toContain('0 条');
  });

  it('should render preset reading workflow templates', () => {
    const html = renderToStaticMarkup(
      <ColorSemanticsModal
        colorSemantics={DEFAULT_COLOR_SEMANTICS}
        annotations={mockAnnotations}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(html).toContain('经典精读流');
    expect(html).toContain('卡片盒写作流');
    expect(html).toContain('外语精学流');
  });

  it('should verify presets and defaults cover all 6 highlight color keys', () => {
    const expectedKeys = ['yellow', 'green', 'blue', 'pink', 'purple', 'underline'];
    expect(DEFAULT_COLOR_SEMANTICS.map(c => c.colorKey)).toEqual(expectedKeys);
    for (const preset of SEMANTIC_PRESETS) {
      for (const k of expectedKeys) {
        expect(preset.labels[k as keyof typeof preset.labels]).toBeTruthy();
      }
    }
  });

  it('should support dark mode classes and action buttons', () => {
    const html = renderToStaticMarkup(
      <ColorSemanticsModal
        colorSemantics={DEFAULT_COLOR_SEMANTICS}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(html).toContain('dark:bg-night-card');
    expect(html).toContain('dark:border-night-border');
    expect(html).toContain('恢复系统默认');
    expect(html).toContain('保存并应用');
    expect(html).toContain('取消');
  });
});
