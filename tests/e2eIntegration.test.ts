import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createMockAppleBooksDatabases } from './fixtures/mockDbGenerator';
import { createMockEpubDirectory } from './fixtures/mockEpubGenerator';
import { SnapshotSyncer } from '../electron/services/snapshotSyncer';
import { UserVaultDb } from '../electron/services/userVaultDb';
import { EpubContextEngine } from '../electron/services/epubContextEngine';
import { MarkdownExporter } from '../electron/services/markdownExporter';

describe('Full End-to-End System Pipeline', () => {
  let tempDir: string;
  let vault: UserVaultDb | null = null;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bookecho-e2e-'));
    vault = null;
  });

  afterEach(() => {
    if (vault) {
      try { vault.close(); } catch {}
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should run through extraction, context expansion, tagging, review, and markdown export seamlessly', () => {
    // 1. 初始化模拟 Apple Books 数据库与 EPUB 文件
    const mockDb = createMockAppleBooksDatabases(tempDir);
    const mockEpub = createMockEpubDirectory(tempDir);

    const cacheDir = path.join(tempDir, 'cache');
    const vaultPath = path.join(tempDir, 'user_vault.sqlite');

    const syncer = new SnapshotSyncer({
      customBkDir: mockDb.bkDir,
      customAeDir: mockDb.aeDir,
      cacheDir
    });
    vault = new UserVaultDb(vaultPath);
    const epubEngine = new EpubContextEngine();

    // 2. 提取书籍
    const books = syncer.extractBooks();
    expect(books.length).toBe(1);
    const book = books[0];
    expect(book.title).toBe('思考，快与慢');

    // 3. 提取高亮并关联 EPUB
    const annos = syncer.extractAnnotations(book.assetId);
    expect(annos.length).toBe(2);

    // 4. 解析第一条高亮的 EPUB 章节与前后文
    const firstAnno = annos[0];
    const resolved = epubEngine.resolveChapter(mockEpub, firstAnno.locationCfi);
    expect(resolved.chapterTitle).toBe('第一章：直觉与理性');

    const context = epubEngine.extractParagraphContext(
      mockEpub,
      firstAnno.locationCfi,
      firstAnno.selectedText
    );
    expect(context.available).toBe(true);
    expect(context.currentParagraph).toContain('系统1的运行是无意识且快速的');
    expect(context.beforeParagraphs.length).toBeGreaterThan(0);
    expect(context.afterParagraphs.length).toBeGreaterThan(0);

    // 5. 用户二次操作：补充思考、标星、打标签
    vault.updateAnnotationMeta(firstAnno.uuid, {
      customNote: '直觉系统虽然快，但在金融决策中容易引发过度自信偏差',
      isStarred: true,
      resolvedChapter: resolved.chapterTitle
    });
    vault.addTag(firstAnno.uuid, '行为经济学');
    vault.addTag(firstAnno.uuid, '思维陷阱');

    const meta = vault.getAnnotationMeta(firstAnno.uuid);
    expect(meta?.isStarred).toBe(true);
    expect(meta?.customNote).toContain('金融决策');

    const tags = vault.getTagsForAnnotation(firstAnno.uuid);
    expect(tags).toHaveLength(2);
    expect(tags).toContain('行为经济学');
    expect(tags).toContain('思维陷阱');

    // 6. 每日回顾评分验证
    const reviewQueue = vault.getReviewCandidates([firstAnno.uuid, annos[1].uuid]);
    expect(reviewQueue[0].uuid).toBe(firstAnno.uuid); // 标星者优先

    // 7. 无损导出 Obsidian Markdown 验证
    const exportItem = {
      ...firstAnno,
      chapterTitle: resolved.chapterTitle,
      customNote: meta?.customNote,
      isStarred: meta?.isStarred,
      tags
    };

    const md = MarkdownExporter.formatObsidianMarkdown(book, [exportItem]);
    expect(md).toContain('> [!quote] 🟡 核心论点');
    expect(md).toContain('系统1的运行是无意识且快速的');
    expect(md).toContain('**扩展**：直觉系统虽然快');
    expect(md).toContain('#行为经济学');
    expect(md).toContain('#思维陷阱');
  });
});
