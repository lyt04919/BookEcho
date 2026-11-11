import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { XMLParser } from 'fast-xml-parser';
import { HighlightContextResult, ChapterContentResult } from '../types/ipc';

interface SpineItem {
  id: string;
  href: string;
}

export class EpubContextEngine {
  private parser: XMLParser;
  private zipCache: Map<string, { zip: AdmZip; mtimeMs: number }> = new Map();
  private coverCache: Map<string, { coverUrl: string | null; mtimeMs: number }> = new Map();
  private tocCache: Map<string, { toc: string[]; mtimeMs: number }> = new Map();

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_'
    });
  }

  private getZip(epubPath: string): AdmZip | null {
    try {
      const stat = fs.statSync(epubPath);
      const cached = this.zipCache.get(epubPath);
      if (cached && cached.mtimeMs === stat.mtimeMs) {
        return cached.zip;
      }
      const zip = new AdmZip(epubPath);
      if (this.zipCache.size >= 15) {
        const oldestKey = this.zipCache.keys().next().value;
        if (oldestKey) this.zipCache.delete(oldestKey);
      }
      this.zipCache.set(epubPath, { zip, mtimeMs: stat.mtimeMs });
      return zip;
    } catch {
      return null;
    }
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
      const zip = this.getZip(epubPath);
      if (!zip) return null;
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
    const escapedHref = cleanTargetHref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedBase = targetBaseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // 尝试解析 TOC 文件匹配章节标题
    if (tocHref) {
      const cleanTocHref = tocHref.split('#')[0].split('?')[0];
      const tocFullPath = path.posix.join(opfDir === '.' ? '' : opfDir, cleanTocHref);
      const tocContent = this.readEpubFileContent(epubPath, tocFullPath);
      if (tocContent) {
        // 1. EPUB 3 HTML nav: href="...ch01.xhtml..."
        const linkRegex = new RegExp(
          `href=["'][^"']*(?:${escapedHref}|${escapedBase})[^"']*["'][^>]*>([\\s\\S]*?)<\\/a>`,
          'i'
        );
        const titleMatch = linkRegex.exec(tocContent);
        if (titleMatch) {
          const cleanedTitle = titleMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
          if (cleanedTitle) {
            return { chapterTitle: cleanedTitle, sortIndex };
          }
        }

        // 2. EPUB 2 NCX: 先使用 XML 解析器准确匹配 navPoint
        try {
          const parsed = this.parser.parse(tocContent);
          const findNavPointTitle = (node: any): string | null => {
            if (!node) return null;
            if (Array.isArray(node)) {
              for (const item of node) {
                const found = findNavPointTitle(item);
                if (found) return found;
              }
              return null;
            }
            if (typeof node === 'object') {
              const src = node?.content?.['@_src'] || '';
              const cleanSrc = String(src).split('#')[0].split('?')[0];
              if (
                cleanSrc &&
                (cleanSrc === cleanTargetHref ||
                  path.posix.basename(cleanSrc) === targetBaseName)
              ) {
                const text = node?.navLabel?.text;
                if (text) return String(text).trim();
              }
              if (node.navPoint) {
                const found = findNavPointTitle(node.navPoint);
                if (found) return found;
              }
            }
            return null;
          };

          const navMap = parsed?.ncx?.navMap;
          if (navMap) {
            const title = findNavPointTitle(navMap.navPoint);
            if (title) {
              return { chapterTitle: title, sortIndex };
            }
          }
        } catch {
          // 解析失败则走下方受限正则回退
        }

        // NCX 正则回退：严格约束在单个 <navPoint> 内，防止跨标签误配
        const ncxRegex = new RegExp(
          `<navPoint[^>]*>(?:(?!<\\/navPoint>)[\\s\\S])*?<text>([^<]+)<\\/text>(?:(?!<\\/navPoint>)[\\s\\S])*?src=["'][^"']*(?:${escapedHref}|${escapedBase})["']`,
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

    const cleanSelected = (selectedText || '').replace(/\s+/g, '').slice(0, 30);
    if (!cleanSelected) {
      return {
        available: false,
        reason: 'NOT_FOUND',
        beforeParagraphs: [],
        currentParagraph: '',
        selectedText,
        afterParagraphs: []
      };
    }

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

  public extractCover(epubPath: string): string | null {
    if (!epubPath || !fs.existsSync(epubPath)) return null;

    let mtimeMs = 0;
    try {
      mtimeMs = fs.statSync(epubPath).mtimeMs;
      const cached = this.coverCache.get(epubPath);
      if (cached && cached.mtimeMs === mtimeMs) {
        return cached.coverUrl;
      }
    } catch {
      return null;
    }

    const opfPath = this.getOpfPath(epubPath);
    if (!opfPath) {
      this.coverCache.set(epubPath, { coverUrl: null, mtimeMs });
      return null;
    }

    const opfContent = this.readEpubFileContent(epubPath, opfPath);
    if (!opfContent) {
      this.coverCache.set(epubPath, { coverUrl: null, mtimeMs });
      return null;
    }

    const opfDir = path.dirname(opfPath);

    try {
      const parsed = this.parser.parse(opfContent);
      const manifestItems = parsed?.package?.manifest?.item;
      const items: any[] = Array.isArray(manifestItems) ? manifestItems : (manifestItems ? [manifestItems] : []);
      const metadata = parsed?.package?.metadata;

      let coverHref: string | null = null;

      // 1. check properties='cover-image'
      const propCover = items.find((i: any) => i['@_properties'] === 'cover-image');
      if (propCover) coverHref = propCover['@_href'];

      // 2. check meta name='cover'
      if (!coverHref && metadata?.meta) {
        const metas: any[] = Array.isArray(metadata.meta) ? metadata.meta : [metadata.meta];
        const coverMeta = metas.find((m: any) => m['@_name'] === 'cover');
        if (coverMeta && coverMeta['@_content']) {
          const item = items.find((i: any) => i['@_id'] === coverMeta['@_content']);
          if (item) coverHref = item['@_href'];
        }
      }

      // 3. check id='cover' or id='cover-image'
      if (!coverHref) {
        const idCover = items.find((i: any) => /^(cover|cover-image)$/i.test(i['@_id'] || ''));
        if (idCover) coverHref = idCover['@_href'];
      }

      // 4. check href filename matching cover
      if (!coverHref) {
        const hrefCover = items.find((i: any) => /cover.*\.(jpe?g|png|webp)$/i.test(i['@_href'] || ''));
        if (hrefCover) coverHref = hrefCover['@_href'];
      }

      if (!coverHref) {
        this.coverCache.set(epubPath, { coverUrl: null, mtimeMs });
        return null;
      }

      const normalizedRelPath = path.posix.join(opfDir, coverHref).replace(/^\//, '');
      let imgBuf: Buffer | null = null;

      if (fs.statSync(epubPath).isDirectory()) {
        const fullPath = path.join(epubPath, normalizedRelPath);
        if (fs.existsSync(fullPath)) {
          imgBuf = fs.readFileSync(fullPath);
        }
      } else {
        const zip = this.getZip(epubPath);
        const entry = zip?.getEntry(normalizedRelPath);
        if (entry && zip) {
          imgBuf = zip.readFile(entry);
        }
      }

      if (!imgBuf) {
        this.coverCache.set(epubPath, { coverUrl: null, mtimeMs });
        return null;
      }

      const ext = path.extname(coverHref).toLowerCase().replace('.', '');
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      const dataUri = `data:${mime};base64,${imgBuf.toString('base64')}`;
      this.coverCache.set(epubPath, { coverUrl: dataUri, mtimeMs });
      return dataUri;
    } catch {
      this.coverCache.set(epubPath, { coverUrl: null, mtimeMs });
      return null;
    }
  }

  public extractTableOfContents(epubPath: string): string[] {
    if (!epubPath || !fs.existsSync(epubPath)) return [];

    let mtimeMs = 0;
    try {
      mtimeMs = fs.statSync(epubPath).mtimeMs;
      const cached = this.tocCache.get(epubPath);
      if (cached && cached.mtimeMs === mtimeMs) {
        return cached.toc;
      }
    } catch {
      return [];
    }

    const opfPath = this.getOpfPath(epubPath);
    if (!opfPath) {
      this.tocCache.set(epubPath, { toc: [], mtimeMs });
      return [];
    }

    const { opfDir, spine, tocHref } = this.parseSpineAndManifest(epubPath, opfPath);
    const titles: string[] = [];

    // 1. 如果有 TOC 文件（EPUB 3 nav 或 EPUB 2 NCX）
    if (tocHref) {
      const cleanTocHref = tocHref.split('#')[0].split('?')[0];
      const tocFullPath = path.posix.join(opfDir === '.' ? '' : opfDir, cleanTocHref);
      const tocContent = this.readEpubFileContent(epubPath, tocFullPath);

      if (tocContent) {
        // 先检测是否是 EPUB 2 NCX
        if (tocContent.includes('<navMap>') || cleanTocHref.endsWith('.ncx')) {
          try {
            const parsed = this.parser.parse(tocContent);
            const extractNavPoints = (node: any) => {
              if (!node) return;
              if (Array.isArray(node)) {
                node.forEach(item => extractNavPoints(item));
                return;
              }
              if (typeof node === 'object') {
                const text = node?.navLabel?.text;
                if (text && typeof text === 'string') {
                  const cleaned = text.trim();
                  if (cleaned && !titles.includes(cleaned)) {
                    titles.push(cleaned);
                  }
                } else if (text && typeof text === 'object' && text['#text']) {
                  const cleaned = String(text['#text']).trim();
                  if (cleaned && !titles.includes(cleaned)) {
                    titles.push(cleaned);
                  }
                }
                if (node.navPoint) {
                  extractNavPoints(node.navPoint);
                }
              }
            };

            const navMap = parsed?.ncx?.navMap;
            if (navMap) {
              extractNavPoints(navMap.navPoint);
            }
          } catch {
            const regex = /<navPoint[^>]*>[\s\S]*?<navLabel>[\s\S]*?<text>([^<]+)<\/text>/gi;
            let match;
            while ((match = regex.exec(tocContent)) !== null) {
              const t = match[1].trim();
              if (t && !titles.includes(t)) {
                titles.push(t);
              }
            }
          }
        } else {
          // EPUB 3 HTML nav: 提取所有 <a ...>章节标题</a>
          const regex = /<a[^>]*>([\s\S]*?)<\/a>/gi;
          let match;
          while ((match = regex.exec(tocContent)) !== null) {
            const raw = match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
            if (raw && !titles.includes(raw)) {
              titles.push(raw);
            }
          }
        }
      }
    }

    // 2. 如果从 TOC 中获取的章节太少（例如小于 2 个），尝试从 spine 各 HTML 文件的 <h1>/<h2>/<title> 中补充
    if (titles.length < 2 && spine.length > 0) {
      for (const item of spine) {
        const cleanHref = item.href.split('#')[0].split('?')[0];
        const chapterFullPath = path.posix.join(opfDir === '.' ? '' : opfDir, cleanHref);
        const html = this.readEpubFileContent(epubPath, chapterFullPath);
        if (html) {
          const hMatch = /<h[1-2][^>]*>([\s\S]*?)<\/h[1-2]>/i.exec(html);
          if (hMatch) {
            const t = hMatch[1].replace(/<[^>]+>/g, '').trim();
            if (t && !titles.includes(t)) {
              titles.push(t);
              continue;
            }
          }
          const tMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
          if (tMatch) {
            const t = tMatch[1].trim();
            if (t && !titles.includes(t)) {
              titles.push(t);
            }
          }
        }
      }
    }

    this.tocCache.set(epubPath, { toc: titles, mtimeMs });
    return titles;
  }

  public extractChapterContent(epubPath: string, chapterTitle: string): ChapterContentResult {
    const targetTitle = (chapterTitle || '').trim();
    if (!epubPath || !fs.existsSync(epubPath) || !targetTitle) {
      return { available: false, chapterTitle: targetTitle, paragraphs: [] };
    }

    const opfPath = this.getOpfPath(epubPath);
    if (!opfPath) {
      return { available: false, chapterTitle: targetTitle, paragraphs: [] };
    }

    const { opfDir, spine, tocHref } = this.parseSpineAndManifest(epubPath, opfPath);
    const tocDir = tocHref
      ? path.posix.dirname(path.posix.join(opfDir === '.' ? '' : opfDir, tocHref.split('#')[0].split('?')[0]))
      : opfDir;

    let matchedHref: string | null = null;

    // 1. 尝试从 TOC 中根据章节名定位对应的 HTML href
    if (tocHref) {
      const cleanTocHref = tocHref.split('#')[0].split('?')[0];
      const tocFullPath = path.posix.join(opfDir === '.' ? '' : opfDir, cleanTocHref);
      const tocContent = this.readEpubFileContent(epubPath, tocFullPath);

      if (tocContent) {
        if (tocContent.includes('<navMap>') || cleanTocHref.endsWith('.ncx')) {
          try {
            const parsed = this.parser.parse(tocContent);
            const findHrefInNav = (node: any): string | null => {
              if (!node) return null;
              if (Array.isArray(node)) {
                for (const item of node) {
                  const found = findHrefInNav(item);
                  if (found) return found;
                }
                return null;
              }
              if (typeof node === 'object') {
                const rawText = node?.navLabel?.text;
                const label =
                  typeof rawText === 'string'
                    ? rawText.trim()
                    : rawText && typeof rawText === 'object' && rawText['#text']
                    ? String(rawText['#text']).trim()
                    : '';
                if (label && (label === targetTitle || label.includes(targetTitle) || targetTitle.includes(label))) {
                  const src = node?.content?.['@_src'];
                  if (src) return String(src).split('#')[0].split('?')[0];
                }
                if (node.navPoint) {
                  const found = findHrefInNav(node.navPoint);
                  if (found) return found;
                }
              }
              return null;
            };
            const navMap = parsed?.ncx?.navMap;
            if (navMap) {
              matchedHref = findHrefInNav(navMap.navPoint);
            }
          } catch {
            // ignore xml parse errors
          }
        } else {
          // EPUB 3 HTML nav
          const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
          let match;
          while ((match = linkRegex.exec(tocContent)) !== null) {
            const href = match[1].split('#')[0].split('?')[0];
            const label = match[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
            if (label && (label === targetTitle || label.includes(targetTitle) || targetTitle.includes(label))) {
              matchedHref = href;
              break;
            }
          }
        }
      }
    }

    const readParagraphsFromHref = (href: string, baseDir: string): string[] => {
      const cleanHref = href.split('#')[0].split('?')[0];
      const candidates = [
        path.posix.join(baseDir === '.' ? '' : baseDir, cleanHref),
        path.posix.join(opfDir === '.' ? '' : opfDir, cleanHref),
        cleanHref
      ];
      for (const candidate of candidates) {
        const html = this.readEpubFileContent(epubPath, candidate);
        if (html) {
          const paras = this.extractHtmlParagraphs(html);
          if (paras.length > 0) return paras;
        }
      }
      return [];
    };

    if (matchedHref) {
      const paras = readParagraphsFromHref(matchedHref, tocDir);
      if (paras.length > 0) {
        return { available: true, chapterTitle: targetTitle, paragraphs: paras };
      }
    }

    // 2. 兜底：遍历 spine 中各章节 HTML，匹配标题或索引
    const sectionIdxMatch = targetTitle.match(/^第\s*(\d+)\s*节$/);
    if (sectionIdxMatch) {
      const idx = parseInt(sectionIdxMatch[1], 10) - 1;
      if (spine[idx]) {
        const paras = readParagraphsFromHref(spine[idx].href, opfDir);
        if (paras.length > 0) {
          return { available: true, chapterTitle: targetTitle, paragraphs: paras };
        }
      }
    }

    for (const item of spine) {
      const cleanHref = item.href.split('#')[0].split('?')[0];
      const fullHref = path.posix.join(opfDir === '.' ? '' : opfDir, cleanHref);
      const html = this.readEpubFileContent(epubPath, fullHref);
      if (!html) continue;

      const hMatch = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i.exec(html);
      const hTitle = hMatch ? hMatch[1].replace(/<[^>]+>/g, '').trim() : '';
      const tMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
      const docTitle = tMatch ? tMatch[1].trim() : '';

      if (
        (hTitle && (hTitle === targetTitle || hTitle.includes(targetTitle) || targetTitle.includes(hTitle))) ||
        (docTitle && (docTitle === targetTitle || docTitle.includes(targetTitle)))
      ) {
        const paras = this.extractHtmlParagraphs(html);
        if (paras.length > 0) {
          return { available: true, chapterTitle: targetTitle, paragraphs: paras };
        }
      }
    }

    // 3. 终极兜底：如果目录位置与 spine 对应
    const tocList = this.extractTableOfContents(epubPath);
    const tocIdx = tocList.indexOf(targetTitle);
    if (tocIdx >= 0 && spine[tocIdx]) {
      const paras = readParagraphsFromHref(spine[tocIdx].href, opfDir);
      if (paras.length > 0) {
        return { available: true, chapterTitle: targetTitle, paragraphs: paras };
      }
    }

    return { available: false, chapterTitle: targetTitle, paragraphs: [] };
  }
}
