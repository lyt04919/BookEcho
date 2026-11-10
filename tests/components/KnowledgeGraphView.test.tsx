import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { KnowledgeGraphView } from '../../src/components/KnowledgeGraphView';
import { BookItem, AnnotationItem, ColorSemanticConfig } from '../../electron/types/ipc';

const mockColorSemantics: ColorSemanticConfig[] = [
  { colorKey: 'yellow', label: '核心论点', hexColor: '#F5A623' },
  { colorKey: 'blue', label: '概念与背景', hexColor: '#4A90E2' }
];

const mockBooks: BookItem[] = [
  {
    assetId: 'book-1',
    title: '纳瓦尔宝典',
    author: '埃里克·乔根森',
    genre: '商业',
    epubPath: '/naval.epub',
    readingProgress: 0.9,
    lastOpenDateMs: 1700000000000,
    coverUrl: null,
    highlightsCount: 12
  },
  {
    assetId: 'book-2',
    title: '穷查理宝典',
    author: '查理·芒格',
    genre: '投资',
    epubPath: '/munger.epub',
    readingProgress: 0.75,
    lastOpenDateMs: 1700005000000,
    coverUrl: null,
    highlightsCount: 8
  }
];

const mockAnnotations: AnnotationItem[] = [
  {
    uuid: 'anno-1',
    assetId: 'book-1',
    bookTitle: '纳瓦尔宝典',
    selectedText: '追求财富，而不是追求金钱或地位。',
    note: '复利资产',
    representativeText: null,
    colorKey: 'yellow',
    locationCfi: null,
    chapterTitle: '第一章 积累财富',
    creationDateMs: Date.now() - 86400000,
    modificationDateMs: Date.now() - 86400000,
    sortIndex: 1,
    customNote: '睡后收入资产',
    isStarred: true,
    tags: ['心智模型', '财富']
  },
  {
    uuid: 'anno-2',
    assetId: 'book-2',
    bookTitle: '穷查理宝典',
    selectedText: '反过来想，总是反过来想。',
    note: null,
    representativeText: null,
    colorKey: 'blue',
    locationCfi: null,
    chapterTitle: '第二讲 多元思维模型',
    creationDateMs: Date.now(),
    modificationDateMs: Date.now(),
    sortIndex: 1,
    customNote: '逆向思考法',
    isStarred: false,
    tags: ['心智模型']
  }
];

describe('KnowledgeGraphView Component', () => {
  it('should render the graph header, canvas and filter controls correctly', () => {
    const html = renderToStaticMarkup(
      <KnowledgeGraphView
        annotations={mockAnnotations}
        books={mockBooks}
        colorSemantics={mockColorSemantics}
        availableTags={['心智模型', '财富']}
        onSelectBook={vi.fn()}
        onManageTags={vi.fn()}
        onToggleStar={vi.fn()}
        onUpdateCustomNote={vi.fn()}
        onAddTag={vi.fn()}
        onRemoveTag={vi.fn()}
        onOpenQuoteModal={vi.fn()}
        onRequestContext={vi.fn()}
      />
    );

    expect(html).toContain('知识网络图谱');
    expect(html).toContain('同标签高亮自动在网络中聚簇互联');
    expect(html).toContain('全部标签星团');
    expect(html).toContain('全书库范围');
    expect(html).toContain('仅看连接');
    expect(html).toContain('标签枢纽');
    expect(html).toContain('读书高亮节点');
    expect(html).toContain('<canvas');
  });

  it('should render the connected node drawer when initialFocusedNodeId is provided', () => {
    const html = renderToStaticMarkup(
      <KnowledgeGraphView
        annotations={mockAnnotations}
        books={mockBooks}
        colorSemantics={mockColorSemantics}
        availableTags={['心智模型', '财富']}
        initialFocusedNodeId="tag:心智模型"
        onSelectBook={vi.fn()}
        onManageTags={vi.fn()}
        onToggleStar={vi.fn()}
        onUpdateCustomNote={vi.fn()}
        onAddTag={vi.fn()}
        onRemoveTag={vi.fn()}
        onOpenQuoteModal={vi.fn()}
        onRequestContext={vi.fn()}
      />
    );

    expect(html).toContain('标签网络中心');
    expect(html).toContain('#心智模型');
    expect(html).toContain('相连思考 (2)');
    expect(html).toContain('追求财富，而不是追求金钱或地位。');
    expect(html).toContain('反过来想，总是反过来想。');
  });
});
