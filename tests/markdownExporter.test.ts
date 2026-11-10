import { describe, it, expect } from 'vitest';
import { MarkdownExporter } from '../electron/services/markdownExporter';
import { BookItem, AnnotationItem } from '../electron/types/ipc';

describe('MarkdownExporter', () => {
  const mockBook: BookItem = {
    assetId: 'book-1',
    title: '纳瓦尔宝典',
    author: '埃里克·乔根森',
    genre: '个人成长',
    epubPath: '/path/to/book.epub',
    readingProgress: 1.0,
    lastOpenDateMs: 1678307200000,
    coverUrl: null,
    highlightsCount: 1
  };

  const mockAnnotations: AnnotationItem[] = [
    {
      uuid: 'anno-1',
      assetId: 'book-1',
      selectedText: '赚大钱的人从来不是靠运气。',
      note: '创造独特性与杠杆',
      representativeText: null,
      colorKey: 'yellow',
      locationCfi: 'cfi',
      chapterTitle: '第一章：财富',
      creationDateMs: 1678307200000,
      modificationDateMs: 1678307200000,
      sortIndex: 1,
      customNote: '必须找到自己的特定知识',
      isStarred: true,
      tags: ['财富', '杠杆']
    }
  ];

  it('should format clean standard markdown with quotes and metadata', () => {
    const md = MarkdownExporter.formatStandardMarkdown(mockBook, mockAnnotations);
    expect(md).toContain('# 纳瓦尔宝典');
    expect(md).toContain('**作者**：埃里克·乔根森');
    expect(md).toContain('## 第一章：财富');
    expect(md).toContain('> ⭐ 赚大钱的人从来不是靠运气。');
    expect(md).toContain('**批注**：创造独特性与杠杆');
    expect(md).toContain('**延伸思考**：必须找到自己的特定知识');
    expect(md).toContain('`#财富` `#杠杆`');
  });

  it('should format Obsidian-enhanced markdown with YAML frontmatter and Callout blocks', () => {
    const md = MarkdownExporter.formatObsidianMarkdown(mockBook, mockAnnotations);
    expect(md).toContain('---');
    expect(md).toContain('title: "纳瓦尔宝典"');
    expect(md).toContain('author: "埃里克·乔根森"');
    expect(md).toContain('highlights_count: 1');
    expect(md).toContain('tags:');
    expect(md).toContain('  - books/highlights');
    expect(md).toContain('> [!quote] 🟡 核心论点');
    expect(md).toContain('> 赚大钱的人从来不是靠运气。');
    expect(md).toContain('> **想法**：创造独特性与杠杆');
    expect(md).toContain('> **扩展**：必须找到自己的特定知识');
    expect(md).toContain('> #财富 #杠杆');
  });

  it('should handle null book metadata and empty chapter titles with defaults', () => {
    const minimalBook: BookItem = {
      assetId: 'book-2',
      title: '无名之书 "Special"',
      author: null,
      genre: null,
      epubPath: null,
      readingProgress: 0,
      lastOpenDateMs: null,
      coverUrl: null,
      highlightsCount: 1
    };

    const minimalAnnotations: AnnotationItem[] = [
      {
        uuid: 'anno-2',
        assetId: 'book-2',
        selectedText: '这是一句普通高亮。',
        note: null,
        representativeText: null,
        colorKey: 'pink',
        locationCfi: null,
        chapterTitle: '',
        creationDateMs: 1678307200000,
        modificationDateMs: 1678307200000,
        sortIndex: 1
      }
    ];

    const standardMd = MarkdownExporter.formatStandardMarkdown(minimalBook, minimalAnnotations);
    expect(standardMd).toContain('- **作者**：未知');
    expect(standardMd).toContain('- **分类**：未分类');
    expect(standardMd).toContain('## 默认章节');
    expect(standardMd).toContain('> 这是一句普通高亮。');
    expect(standardMd).not.toContain('⭐');
    expect(standardMd).not.toContain('**批注**');

    const obsidianMd = MarkdownExporter.formatObsidianMarkdown(minimalBook, minimalAnnotations);
    expect(obsidianMd).toContain('title: "无名之书 \\"Special\\""');
    expect(obsidianMd).toContain('author: "未知"');
    expect(obsidianMd).toContain('> [!quote] 🌸 灵感与金句');
    expect(obsidianMd).toContain('> 这是一句普通高亮。');
  });

  it('should correctly map all highlight colors to semantic emojis in Obsidian export', () => {
    const colors: Array<AnnotationItem['colorKey']> = ['yellow', 'green', 'blue', 'pink', 'purple', 'underline'];
    const expectedHeaders = [
      '🟡 核心论点',
      '🟢 行动与实践',
      '🔵 概念与背景',
      '🌸 灵感与金句',
      '🟣 存疑与深思',
      '🔴 重点下划线'
    ];

    const annotations: AnnotationItem[] = colors.map((colorKey, index) => ({
      uuid: `anno-color-${index}`,
      assetId: 'book-1',
      selectedText: `高亮内容 ${index}`,
      note: null,
      representativeText: null,
      colorKey,
      locationCfi: null,
      chapterTitle: `章节 ${index}`,
      creationDateMs: 1678307200000,
      modificationDateMs: 1678307200000,
      sortIndex: index
    }));

    const obsidianMd = MarkdownExporter.formatObsidianMarkdown(mockBook, annotations);
    for (const header of expectedHeaders) {
      expect(obsidianMd).toContain(`> [!quote] ${header}`);
    }
  });
});
