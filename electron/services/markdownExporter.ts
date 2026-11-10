import { BookItem, AnnotationItem, HighlightColor } from '../types/ipc';

const COLOR_EMOJIS: Record<HighlightColor, string> = {
  yellow: '🟡 核心论点',
  green: '🟢 行动与实践',
  blue: '🔵 概念与背景',
  pink: '🌸 灵感与金句',
  purple: '🟣 存疑与深思',
  underline: '🔴 重点下划线'
};

export class MarkdownExporter {
  public static groupAnnotationsByChapter(annotations: AnnotationItem[]): Map<string, AnnotationItem[]> {
    const map = new Map<string, AnnotationItem[]>();
    for (const anno of annotations) {
      const chapter = anno.chapterTitle || '默认章节';
      if (!map.has(chapter)) {
        map.set(chapter, []);
      }
      map.get(chapter)!.push(anno);
    }
    return map;
  }

  public static formatStandardMarkdown(book: BookItem, annotations: AnnotationItem[]): string {
    const lines: string[] = [];

    lines.push(`# ${book.title}`);
    lines.push('');
    lines.push(`- **作者**：${book.author || '未知'}`);
    lines.push(`- **分类**：${book.genre || '未分类'}`);
    lines.push(`- **笔记总数**：${annotations.length} 条`);
    lines.push(`- **导出时间**：${new Date().toLocaleDateString('zh-CN')}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    const grouped = this.groupAnnotationsByChapter(annotations);

    for (const [chapter, items] of grouped.entries()) {
      lines.push(`## ${chapter}`);
      lines.push('');

      for (const item of items) {
        const star = item.isStarred ? '⭐ ' : '';
        const tagLine = item.tags && item.tags.length > 0 ? item.tags.map(t => `\`#${t}\``).join(' ') : '';

        lines.push(`> ${star}${item.selectedText}`);
        lines.push('>');

        if (item.note) {
          lines.push(`> **批注**：${item.note}`);
        }
        if (item.customNote) {
          lines.push(`> **延伸思考**：${item.customNote}`);
        }
        if (tagLine) {
          lines.push(`> **标签**：${tagLine}`);
        }

        lines.push('');
      }
    }

    return lines.join('\n');
  }

  public static formatObsidianMarkdown(book: BookItem, annotations: AnnotationItem[]): string {
    const lines: string[] = [];

    // YAML Frontmatter
    lines.push('---');
    lines.push(`title: "${book.title.replace(/"/g, '\\"')}"`);
    lines.push(`author: "${(book.author || '未知').replace(/"/g, '\\"')}"`);
    lines.push(`highlights_count: ${annotations.length}`);
    lines.push(`exported_at: "${new Date().toISOString()}"`);
    lines.push('tags:');
    lines.push('  - books/highlights');
    lines.push('---');
    lines.push('');
    lines.push(`# ${book.title}`);
    lines.push('');

    const grouped = this.groupAnnotationsByChapter(annotations);

    for (const [chapter, items] of grouped.entries()) {
      lines.push(`## ${chapter}`);
      lines.push('');

      for (const item of items) {
        const calloutHeader = COLOR_EMOJIS[item.colorKey] || '🟡 高亮';
        lines.push(`> [!quote] ${calloutHeader}`);
        lines.push(`> ${item.selectedText}`);

        if (item.note) {
          lines.push(`> `);
          lines.push(`> **想法**：${item.note}`);
        }
        if (item.customNote) {
          lines.push(`> `);
          lines.push(`> **扩展**：${item.customNote}`);
        }
        if (item.tags && item.tags.length > 0) {
          lines.push(`> `);
          lines.push(`> ${item.tags.map(t => `#${t}`).join(' ')}`);
        }

        lines.push('');
      }
    }

    return lines.join('\n');
  }
}
