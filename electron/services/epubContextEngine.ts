import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { XMLParser } from 'fast-xml-parser';
import { HighlightContextResult } from '../types/ipc';

interface SpineItem {
  id: string;
  href: string;
}

export class EpubContextEngine {
  private parser: XMLParser;

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_'
    });
  }

  private readEpubFileContent(epubPath: string, relativePath: string): string | null {
    if (!fs.existsSync(epubPath)) return null;

    const normalizedRelPath = relativePath.replace(/\\/g, '/').replace(/^\//, '');

    if (fs.statSync(epubPath).isDirectory()) {
      const fullPath = path.join(epubPath, normalizedRelPath);
      if (fs.existsSync(fullPath)) {
        return fs.readFileSync(fullPath, 'utf-8');
      }
      // Try decodeURIComponent fallback
      const decodedFullPath = path.join(epubPath, decodeURIComponent(normalizedRelPath));
      if (fs.existsSync(decodedFullPath)) {
        return fs.readFileSync(decodedFullPath, 'utf-8');
      }
      return null;
    }

    try {
      const zip = new AdmZip(epubPath);
      let entry = zip.getEntry(normalizedRelPath);
      if (!entry) {
        const entries = zip.getEntries();
        entry = entries.find((e) => {
          const name = e.entryName.replace(/\\/g, '/').replace(/^\//, '');
          return (
            name === normalizedRelPath ||
            decodeURIComponent(name) === normalizedRelPath ||
            name.toLowerCase() === normalizedRelPath.toLowerCase()
          );
        }) || null;
      }
      if (entry) {
        return zip.readAsText(entry);
      }
    } catch {
      return null;
    }

    return null;
  }

  private getOpfPath(epubPath: string): string | null {
    const containerXml = this.readEpubFileContent(epubPath, 'META-INF/container.xml');
    if (!containerXml) return null;

    try {
      const parsed = this.parser.parse(containerXml);
      const rootfile = parsed?.container?.rootfiles?.rootfile;
      if (Array.isArray(rootfile)) {
        return rootfile[0]?.['@_full-path'] || null;
      }
      return rootfile?.['@_full-path'] || null;
    } catch {
      return null;
    }
  }

  private parseSpineAndManifest(
    epubPath: string,
    opfPath: string
  ): { opfDir: string; spine: SpineItem[]; tocHref: string | null } {
    const opfContent = this.readEpubFileContent(epubPath, opfPath);
    const opfDir = path.posix.dirname(opfPath.replace(/\\/g, '/'));
    if (!opfContent) return { opfDir, spine: [], tocHref: null };

    try {
      const parsed = this.parser.parse(opfContent);
      const manifestItems = parsed?.package?.manifest?.item;
      const manifestList = Array.isArray(manifestItems)
        ? manifestItems
        : manifestItems
        ? [manifestItems]
        : [];

      const manifestMap = new Map<string, string>();
      let tocHref: string | null = null;

      for (const item of manifestList) {
        const id = item['@_id'];
        const href = item['@_href'];
        if (id && href) {
          manifestMap.set(id, href);
        }
        if (
          item['@_properties'] === 'nav' ||
          id === 'toc' ||
          id === 'ncx' ||
          item['@_media-type'] === 'application/x-dtbncx+xml'
        ) {
          tocHref = href;
        }
      }

      // If spine specifies toc attribute (EPUB 2)
      const spineTocId = parsed?.package?.spine?.['@_toc'];
      if (spineTocId && manifestMap.has(spineTocId)) {
        tocHref = manifestMap.get(spineTocId)!;
      }

      const spineItems = parsed?.package?.spine?.itemref;
      const spineList = Array.isArray(spineItems)
        ? spineItems
        : spineItems
        ? [spineItems]
        : [];

      const spine: SpineItem[] = [];
      for (const ref of spineList) {
        const idref = ref['@_idref'];
        const href = manifestMap.get(idref);
        if (idref && href) {
          spine.push({ id: idref, href });
        }
      }

      return { opfDir, spine, tocHref };
    } catch {
      return { opfDir, spine: [], tocHref: null };
    }
  }

  private extractHtmlParagraphs(htmlContent: string): string[] {
    // 提取 <p>, <li>, <blockquote>, <h1>~<h6> 块级文字
    const blockRegex = /<(?:p|li|blockquote|h[1-6])[^>]*>([\s\S]*?)<\/(?:p|li|blockquote|h[1-6])>/gi;
    const paragraphs: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = blockRegex.exec(htmlContent)) !== null) {
      const rawText = match[1]
        .replace(/<[^>]+>/g, '') // 去除内联标签
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();

      if (rawText.length > 0) {
        paragraphs.push(rawText);
      }
    }

    return paragraphs;
  }

  public resolveChapter(
    epubPath: string,
    locationCfi: string | null
  ): { chapterTitle: string; sortIndex: number } {
    if (!epubPath || !locationCfi) {
      return { chapterTitle: '未命名章节', sortIndex: 0 };
    }

    const opfPath = this.getOpfPath(epubPath);
    if (!opfPath) {
      return { chapterTitle: '正文', sortIndex: 0 };
    }

    const { opfDir, spine, tocHref } = this.parseSpineAndManifest(epubPath, opfPath);

    // 解析 CFI 步进索引: epubcfi(/6/14[chapter_id]!/4/2/10/1:24)
    let spineIndex = 0;
    let sortIndex = 0;
    const cfiMatch = locationCfi.match(/epubcfi\(\/6\/(\d+)(?:\[([^\]]+)\])?/);
    if (cfiMatch) {
      const stepVal = parseInt(cfiMatch[1], 10);
      spineIndex = Math.max(0, Math.floor(stepVal / 2) - 1);
    }

    // 计算内部细粒度排序索引
    const innerParts = locationCfi.split('!/')[1];
    if (innerParts) {
      const nums = innerParts.match(/\d+/g);
      if (nums) {
        sortIndex =
          spineIndex * 100000 +
          nums.reduce((acc, n, idx) => acc + parseInt(n, 10) * Math.pow(0.1, idx + 1), 0);
      }
    } else {
      sortIndex = spineIndex * 100000;
    }

    let targetSpine: SpineItem | undefined = spine[spineIndex];
    if (!targetSpine && cfiMatch && cfiMatch[2]) {
      targetSpine = spine.find((s) => s.id === cfiMatch[2]);
    }
    if (!targetSpine) {
      targetSpine = spine[0];
    }
    if (!targetSpine) {
      return { chapterTitle: '正文', sortIndex };
    }

    const cleanTargetHref = targetSpine.href.split('#')[0].split('?')[0];
    const targetBaseName = path.posix.basename(cleanTargetHref);

    // 尝试解析 TOC 文件匹配章节标题
    if (tocHref) {
      const cleanTocHref = tocHref.split('#')[0].split('?')[0];
      const tocFullPath = path.posix.join(opfDir === '.' ? '' : opfDir, cleanTocHref);
      const tocContent = this.readEpubFileContent(epubPath, tocFullPath);
      if (tocContent) {
        // 1. EPUB 3 HTML nav: href="...ch01.xhtml..."
        const linkRegex = new RegExp(
          `href=["'][^"']*(?:${cleanTargetHref}|${targetBaseName})[^"']*["'][^>]*>([\\s\\S]*?)<\\/a>`,
          'i'
        );
        const titleMatch = linkRegex.exec(tocContent);
        if (titleMatch) {
          const cleanedTitle = titleMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
          if (cleanedTitle) {
            return { chapterTitle: cleanedTitle, sortIndex };
          }
        }

        // 2. EPUB 2 NCX: <navPoint>...<text>Title</text>...<content src="..."/>
        const ncxRegex = new RegExp(
          `<navPoint[^>]*>[\\s\\S]*?<text>([^<]+)<\\/text>[\\s\\S]*?src=["'][^"']*(?:${cleanTargetHref}|${targetBaseName})[^"']*["']`,
          'i'
        );
        const ncxMatch = ncxRegex.exec(tocContent);
        if (ncxMatch && ncxMatch[1].trim()) {
          return { chapterTitle: ncxMatch[1].trim(), sortIndex };
        }
      }
    }

    // 兜底：尝试从目标章节的 HTML 中读取 <title> 或 <h1>
    const chapterFullPath = path.posix.join(opfDir === '.' ? '' : opfDir, cleanTargetHref);
    const chapterHtml = this.readEpubFileContent(epubPath, chapterFullPath);
    if (chapterHtml) {
      const h1Match = /<h[1-2][^>]*>([\s\S]*?)<\/h[1-2]>/i.exec(chapterHtml);
      if (h1Match) {
        const text = h1Match[1].replace(/<[^>]+>/g, '').trim();
        if (text) {
          return { chapterTitle: text, sortIndex };
        }
      }
      const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(chapterHtml);
      if (titleMatch && titleMatch[1].trim()) {
        return { chapterTitle: titleMatch[1].trim(), sortIndex };
      }
    }

    return { chapterTitle: `第 ${spineIndex + 1} 节`, sortIndex };
  }

  public extractParagraphContext(
    epubPath: string,
    locationCfi: string | null,
    selectedText: string
  ): HighlightContextResult {
    if (!epubPath || !fs.existsSync(epubPath)) {
      return {
        available: false,
        reason: 'FILE_NOT_DOWNLOADED',
        beforeParagraphs: [],
        currentParagraph: '',
        selectedText,
        afterParagraphs: []
      };
    }

    const opfPath = this.getOpfPath(epubPath);
    if (!opfPath) {
      return {
        available: false,
        reason: 'DRM_PROTECTED',
        beforeParagraphs: [],
        currentParagraph: '',
        selectedText,
        afterParagraphs: []
      };
    }

    const { opfDir, spine } = this.parseSpineAndManifest(epubPath, opfPath);
    if (spine.length === 0) {
      return {
        available: false,
        reason: 'NOT_FOUND',
        beforeParagraphs: [],
        currentParagraph: '',
        selectedText,
        afterParagraphs: []
      };
    }

    // 定位目标章节文件
    let targetHrefs: string[] = [];
    if (locationCfi) {
      const cfiMatch = locationCfi.match(/epubcfi\(\/6\/(\d+)/);
      if (cfiMatch) {
        const stepVal = parseInt(cfiMatch[1], 10);
        const idx = Math.max(0, Math.floor(stepVal / 2) - 1);
        if (spine[idx]) {
          targetHrefs.push(spine[idx].href);
        }
      }
    }

    // 兜底：若 CFI 未命中或作为后续尝试，添加所有 spine 章节做全文搜索
    for (const item of spine) {
      if (!targetHrefs.includes(item.href)) {
        targetHrefs.push(item.href);
      }
    }

    const cleanSelected = selectedText.replace(/\s+/g, '').slice(0, 30);

    for (const href of targetHrefs) {
      const cleanHref = href.split('#')[0].split('?')[0];
      const fullHref = path.posix.join(opfDir === '.' ? '' : opfDir, cleanHref);
      const html = this.readEpubFileContent(epubPath, fullHref);
      if (!html) continue;

      const paragraphs = this.extractHtmlParagraphs(html);
      let targetIdx = -1;

      for (let i = 0; i < paragraphs.length; i++) {
        const cleanPara = paragraphs[i].replace(/\s+/g, '');
        if (cleanPara.includes(cleanSelected)) {
          targetIdx = i;
          break;
        }
      }

      if (targetIdx !== -1) {
        const before = paragraphs.slice(Math.max(0, targetIdx - 2), targetIdx);
        const current = paragraphs[targetIdx];
        const after = paragraphs.slice(targetIdx + 1, targetIdx + 3);

        const { chapterTitle } = this.resolveChapter(epubPath, locationCfi);

        return {
          available: true,
          chapterTitle,
          beforeParagraphs: before,
          currentParagraph: current,
          selectedText,
          afterParagraphs: after
        };
      }
    }

    return {
      available: false,
      reason: 'NOT_FOUND',
      beforeParagraphs: [],
      currentParagraph: '',
      selectedText,
      afterParagraphs: []
    };
  }
}
