import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  createMockEpubDirectory,
  createMockEpubZip,
  createMockEpub2WithNcx
} from './fixtures/mockEpubGenerator';
import { EpubContextEngine } from '../electron/services/epubContextEngine';

describe('EpubContextEngine & Paragraph Context Extractor', () => {
  let tempDir: string;
  let epubPath: string;
  let engine: EpubContextEngine;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bookecho-epub-'));
    epubPath = createMockEpubDirectory(tempDir);
    engine = new EpubContextEngine();
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should resolve chapter title and sortIndex from EPUB CFI', () => {
    const result = engine.resolveChapter(epubPath, 'epubcfi(/6/2[chapter1]!/4/2/6/1:0)');
    expect(result.chapterTitle).toBe('第一章：直觉与理性');
    expect(result.sortIndex).toBeGreaterThan(0);
  });

  it('should extract before, current, and after paragraphs around the highlight', () => {
    const selectedText = '系统1的运行是无意识且快速的';
    const context = engine.extractParagraphContext(
      epubPath,
      'epubcfi(/6/2[chapter1]!/4/2/6/1:0)',
      selectedText
    );

    expect(context.available).toBe(true);
    expect(context.chapterTitle).toBe('第一章：直觉与理性');
    expect(context.currentParagraph).toContain('系统1的运行是无意识且快速的');
    expect(context.beforeParagraphs.length).toBeGreaterThanOrEqual(1);
    expect(context.beforeParagraphs[context.beforeParagraphs.length - 1]).toContain('心理学研究表明');
    expect(context.afterParagraphs[0]).toContain('相比之下，系统2则需要调动注意力');
  });

  it('should support zip-compressed epub archives', () => {
    const zipEpubPath = createMockEpubZip(tempDir);
    const chapter = engine.resolveChapter(zipEpubPath, 'epubcfi(/6/2[chapter1]!/4/2/6/1:0)');
    expect(chapter.chapterTitle).toBe('第一章：直觉与理性');

    const context = engine.extractParagraphContext(
      zipEpubPath,
      'epubcfi(/6/2[chapter1]!/4/2/6/1:0)',
      '系统1的运行是无意识且快速的'
    );
    expect(context.available).toBe(true);
    expect(context.currentParagraph).toContain('系统1的运行是无意识且快速的');
    expect(context.beforeParagraphs.length).toBeGreaterThanOrEqual(1);
    expect(context.afterParagraphs.length).toBeGreaterThanOrEqual(1);
  });

  it('should gracefully handle non-existent or DRM files', () => {
    const context = engine.extractParagraphContext('/non/existent/path.epub', 'cfi', 'text');
    expect(context.available).toBe(false);
    expect(context.reason).toBe('FILE_NOT_DOWNLOADED');
  });

  it('should handle missing container or missing OPF gracefully', () => {
    const emptyDir = path.join(tempDir, 'empty.epub');
    fs.mkdirSync(emptyDir, { recursive: true });
    const context = engine.extractParagraphContext(emptyDir, 'cfi', 'text');
    expect(context.available).toBe(false);
    expect(context.reason).toBe('DRM_PROTECTED');

    const chapter = engine.resolveChapter(emptyDir, 'cfi');
    expect(chapter.chapterTitle).toBe('正文');
    expect(chapter.sortIndex).toBe(0);
  });

  it('should handle text not found gracefully', () => {
    const context = engine.extractParagraphContext(
      epubPath,
      'epubcfi(/6/2[chapter1]!/4/2/6/1:0)',
      '不存在的某段文字完全找不到'
    );
    expect(context.available).toBe(false);
    expect(context.reason).toBe('NOT_FOUND');
  });

  it('should return NOT_FOUND when selectedText is empty or whitespace-only', () => {
    const emptyContext = engine.extractParagraphContext(
      epubPath,
      'epubcfi(/6/2[chapter1]!/4/2/6/1:0)',
      ''
    );
    expect(emptyContext.available).toBe(false);
    expect(emptyContext.reason).toBe('NOT_FOUND');

    const whitespaceContext = engine.extractParagraphContext(
      epubPath,
      'epubcfi(/6/2[chapter1]!/4/2/6/1:0)',
      '   \n\t  '
    );
    expect(whitespaceContext.available).toBe(false);
    expect(whitespaceContext.reason).toBe('NOT_FOUND');
  });

  it('should correctly resolve chapter titles in EPUB 2 NCX with multiple navPoints', () => {
    const ncxEpubPath = createMockEpub2WithNcx(tempDir);

    // Spine index 0 (ch01.html)
    const chap1 = engine.resolveChapter(ncxEpubPath, 'epubcfi(/6/2[chap1]!/4/2)');
    expect(chap1.chapterTitle).toBe('第一章：直觉与理性');

    // Spine index 1 (ch02.html) -> step 4 corresponds to index 1
    const chap2 = engine.resolveChapter(ncxEpubPath, 'epubcfi(/6/4[chap2]!/4/2)');
    expect(chap2.chapterTitle).toBe('第二章：启发与偏见');
  });
});
