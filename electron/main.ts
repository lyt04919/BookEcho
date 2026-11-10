import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { SnapshotSyncer } from './services/snapshotSyncer';
import { UserVaultDb } from './services/userVaultDb';
import { EpubContextEngine } from './services/epubContextEngine';
import { MarkdownExporter } from './services/markdownExporter';
import { AnnotationItem, HighlightColor } from './types/ipc';

let mainWindow: BrowserWindow | null = null;
let syncer: SnapshotSyncer;
let vault: UserVaultDb;
let epubEngine: EpubContextEngine;

function initializeServices() {
  if (vault) {
    try {
      vault.close();
    } catch {
      // ignore close errors during re-initialization
    }
  }

  const userDataPath = app.getPath('userData');
  const cacheDir = path.join(userDataPath, 'snapshots');
  const vaultDbPath = path.join(userDataPath, 'user_vault.sqlite');

  vault = new UserVaultDb(vaultDbPath);
  epubEngine = new EpubContextEngine();

  const customDir = vault.getSetting('custom_apple_books_dir');
  syncer = new SnapshotSyncer({
    cacheDir,
    customBkDir: customDir ? path.join(customDir, 'BKLibrary') : undefined,
    customAeDir: customDir ? path.join(customDir, 'AEAnnotation') : undefined
  });
}

function registerIpcHandlers() {
  ipcMain.handle('books:getAll', async () => {
    return syncer.extractBooks();
  });

  ipcMain.handle('annotations:getByBook', async (_, assetId: string) => {
    const rawList = syncer.extractAnnotations(assetId);
    const books = syncer.extractBooks();
    const book = books.find(b => b.assetId === assetId);

    const result: AnnotationItem[] = rawList.map(item => {
      const meta = vault.getAnnotationMeta(item.uuid);
      const tags = vault.getTagsForAnnotation(item.uuid);

      // 若未解析过章节，尝试通过 EPUB 解析
      let chapterTitle = meta?.resolvedChapter || item.chapterTitle;
      let sortIndex = meta?.sortIndex || item.sortIndex;

      if ((!meta?.resolvedChapter || meta.resolvedChapter === '默认章节') && book?.epubPath) {
        const resolved = epubEngine.resolveChapter(book.epubPath, item.locationCfi);
        chapterTitle = resolved.chapterTitle;
        sortIndex = resolved.sortIndex;
        vault.updateAnnotationMeta(item.uuid, { resolvedChapter: chapterTitle, sortIndex });
      }

      return {
        ...item,
        chapterTitle,
        sortIndex,
        customNote: meta?.customNote || '',
        isStarred: meta?.isStarred || false,
        reviewStatus: meta?.reviewStatus || 'active',
        reviewCount: meta?.reviewCount || 0,
        lastReviewedAtMs: meta?.lastReviewedAtMs || null,
        tags
      };
    }).sort((a, b) => a.sortIndex - b.sortIndex || a.creationDateMs - b.creationDateMs);

    return result;
  });

  ipcMain.handle('annotations:search', async (_, keyword: string) => {
    const all = syncer.extractAnnotations();
    const lower = keyword.toLowerCase().trim();
    if (!lower) return [];

    const result: AnnotationItem[] = [];
    for (const item of all) {
      const meta = vault.getAnnotationMeta(item.uuid);
      const tags = vault.getTagsForAnnotation(item.uuid);
      const customNote = meta?.customNote || '';
      const isStarred = meta?.isStarred || false;

      const matchesSelected = item.selectedText.toLowerCase().includes(lower);
      const matchesNote = Boolean(item.note && item.note.toLowerCase().includes(lower));
      const matchesCustomNote = customNote.toLowerCase().includes(lower);
      const matchesTags = tags.some(t => t.toLowerCase().includes(lower));

      if (matchesSelected || matchesNote || matchesCustomNote || matchesTags) {
        result.push({
          ...item,
          customNote,
          isStarred,
          tags
        });
      }
    }

    return result;
  });

  ipcMain.handle('context:get', async (_, assetId: string, locationCfi: string, selectedText: string) => {
    const books = syncer.extractBooks();
    const book = books.find(b => b.assetId === assetId);
    if (!book || !book.epubPath) {
      return {
        available: false,
        reason: 'FILE_NOT_DOWNLOADED',
        beforeParagraphs: [],
        currentParagraph: '',
        selectedText,
        afterParagraphs: []
      };
    }
    return epubEngine.extractParagraphContext(book.epubPath, locationCfi, selectedText);
  });

  ipcMain.handle('meta:update', async (_, uuid: string, updates: { customNote?: string; isStarred?: boolean }) => {
    vault.updateAnnotationMeta(uuid, updates);
  });

  ipcMain.handle('tag:add', async (_, uuid: string, tag: string) => {
    vault.addTag(uuid, tag);
  });

  ipcMain.handle('tag:remove', async (_, uuid: string, tag: string) => {
    vault.removeTag(uuid, tag);
  });

  ipcMain.handle('tag:getAll', async () => {
    return vault.getAllTags();
  });

  ipcMain.handle('review:getQueue', async (_, limit = 6) => {
    const all = syncer.extractAnnotations();
    const uuids = all.map(a => a.uuid);
    const scored = vault.getReviewCandidates(uuids);
    const topUuids = scored.filter(s => s.score > -9000).slice(0, limit).map(s => s.uuid);

    const books = syncer.extractBooks();
    const bookMap = new Map(books.map(b => [b.assetId, b]));
    const allMap = new Map(all.map(a => [a.uuid, a]));

    const result: (AnnotationItem & { bookTitle?: string })[] = topUuids
      .map(uuid => allMap.get(uuid))
      .filter((item): item is AnnotationItem => Boolean(item))
      .map(item => {
        const meta = vault.getAnnotationMeta(item.uuid);
        const tags = vault.getTagsForAnnotation(item.uuid);
        const book = bookMap.get(item.assetId);
        return {
          ...item,
          customNote: meta?.customNote || '',
          isStarred: meta?.isStarred || false,
          tags,
          bookTitle: book?.title || '未知书籍'
        };
      });

    return result;
  });

  ipcMain.handle('review:submit', async (_, uuid: string, result: 'remembered' | 'mastered' | 'reset') => {
    vault.recordReviewResult(uuid, result);
  });

  ipcMain.handle('semantics:get', async () => {
    return vault.getColorSemantics();
  });

  ipcMain.handle('semantics:update', async (_, colorKey: HighlightColor, label: string) => {
    vault.updateColorSemantic(colorKey, label);
  });

  ipcMain.handle('system:openAppleBooks', async (_, _assetId: string, epubPath?: string | null) => {
    if (epubPath && typeof epubPath === 'string' && fs.existsSync(epubPath)) {
      const lower = epubPath.toLowerCase();
      const isValidExtension = lower.endsWith('.epub') || lower.endsWith('.ibooks');
      const isInBooksFolder =
        epubPath.includes('/Containers/com.apple.BKAgentService/') ||
        epubPath.includes('/Containers/com.apple.iBooksX/') ||
        epubPath.includes('/Library/Books/') ||
        epubPath.includes('/Books/');

      if (isValidExtension || isInBooksFolder) {
        await shell.openPath(epubPath);
        return true;
      }
    }
    await shell.openExternal('ibooks://');
    return true;
  });

  ipcMain.handle('system:openSystemPrivacy', async () => {
    await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles');
    return true;
  });

  ipcMain.handle('system:selectCustomDir', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: '选择 Apple Books 数据备份或同步目录'
    });
    if (!result.canceled && result.filePaths[0]) {
      const selected = result.filePaths[0];
      vault.setSetting('custom_apple_books_dir', selected);
      initializeServices();
      return selected;
    }
    return null;
  });

  ipcMain.handle('export:markdown', async (_, assetId: string, format: 'standard' | 'obsidian') => {
    if (!mainWindow) return { success: false };
    const books = syncer.extractBooks();
    const book = books.find(b => b.assetId === assetId);
    if (!book) return { success: false };

    const annotations: AnnotationItem[] = syncer.extractAnnotations(assetId).map(item => {
      const meta = vault.getAnnotationMeta(item.uuid);
      const tags = vault.getTagsForAnnotation(item.uuid);
      const chapterTitle = meta?.resolvedChapter || item.chapterTitle;
      const sortIndex = meta?.sortIndex ?? item.sortIndex;
      return {
        ...item,
        chapterTitle,
        sortIndex,
        customNote: meta?.customNote || '',
        isStarred: meta?.isStarred || false,
        tags
      };
    }).sort((a, b) => a.sortIndex - b.sortIndex || a.creationDateMs - b.creationDateMs);

    const content = format === 'obsidian'
      ? MarkdownExporter.formatObsidianMarkdown(book, annotations)
      : MarkdownExporter.formatStandardMarkdown(book, annotations);

    const safeTitle = book.title.replace(/[/\\?%*:|"<>]/g, '_');
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '导出读书笔记 Markdown',
      defaultPath: `${safeTitle}_笔记.md`,
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    });

    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, content, 'utf-8');
      return { success: true, filePath: result.filePath };
    }
    return { success: false };
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  initializeServices();
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
