import { useState, useEffect } from 'react';
import {
  BookItem,
  AnnotationItem,
  ColorSemanticConfig,
  HighlightColor,
  HighlightContextResult,
  ChapterItem,
  ChapterContentResult
} from '../electron/types/ipc';
import { Sidebar, NavTab } from './components/Sidebar';
import { BookshelfView } from './components/BookshelfView';
import { BookDetailView } from './components/BookDetailView';
import { QuoteCardModal } from './components/QuoteCardModal';
import { ExportModal } from './components/ExportModal';
import { PermissionGuide } from './components/PermissionGuide';
import { HighlightCard } from './components/HighlightCard';
import { InsightsView } from './components/InsightsView';
import { GlobalSearchView } from './components/GlobalSearchView';
import { KnowledgeGraphView } from './components/KnowledgeGraphView';
import { ColorSemanticsModal } from './components/ColorSemanticsModal';
import { SettingsModal, SettingsTabId } from './components/SettingsModal';
import { DEMO_BOOKS, DEMO_TAGS, DEMO_ANNOTATIONS } from './data/mockTestData';
import { MessageSquareQuote, Download, Sparkles, X } from 'lucide-react';

const DEFAULT_SEMANTICS: ColorSemanticConfig[] = [
  { colorKey: 'yellow', label: '核心论点', hexColor: '#F5A623' },
  { colorKey: 'green', label: '行动与实践', hexColor: '#5CB85C' },
  { colorKey: 'blue', label: '概念与背景', hexColor: '#4A90E2' },
  { colorKey: 'pink', label: '灵感与金句', hexColor: '#E86F88' },
  { colorKey: 'purple', label: '存疑与深思', hexColor: '#9B6B9E' },
  { colorKey: 'underline', label: '重点下划线', hexColor: '#D9534F' }
];

const parseStringArraySetting = (raw: string | null): string[] | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((id): id is string => typeof id === 'string');
    }
  } catch {
    // 忽略格式异常配置
  }
  return null;
};

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('books');
  const [books, setBooks] = useState<BookItem[]>([]);
  const [selectedBook, setSelectedBook] = useState<BookItem | null>(null);
  const [currentAnnotations, setCurrentAnnotations] = useState<AnnotationItem[]>([]);
  const [colorSemantics, setColorSemantics] = useState<ColorSemanticConfig[]>(DEFAULT_SEMANTICS);
  const [tags, setTags] = useState<string[]>([]);
  const [selectedColor, setSelectedColor] = useState<HighlightColor | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<AnnotationItem[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeQuoteItem, setActiveQuoteItem] = useState<AnnotationItem | null>(null);
  const [exportBookAssetId, setExportBookAssetId] = useState<string | null>(null);
  const [hasPermissionError, setHasPermissionError] = useState(false);
  const [allAnnotations, setAllAnnotations] = useState<AnnotationItem[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [bookChapters, setBookChapters] = useState<ChapterItem[]>([]);
  const [activeChapter, setActiveChapter] = useState<string | null>(null);
  const [onlyChaptersWithNotes, setOnlyChaptersWithNotes] = useState(false);
  const [readingChapterContent, setReadingChapterContent] = useState<ChapterContentResult | null>(null);
  const [isLoadingChapterContent, setIsLoadingChapterContent] = useState(false);
  const [selectedGraphNodeId, setSelectedGraphNodeId] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoTags, setDemoTags] = useState<string[]>(DEMO_TAGS);
  const [demoAnnotations, setDemoAnnotations] = useState<AnnotationItem[]>(DEMO_ANNOTATIONS);
  const [isColorSettingsOpen, setIsColorSettingsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsTabId>('general');
  const [customDataDir, setCustomDataDir] = useState<string | null>(null);
  const [exportFormatPref, setExportFormatPref] = useState<'standard' | 'obsidian'>('obsidian');
  const [pinnedBookIds, setPinnedBookIds] = useState<string[]>([]);
  const [demoPinnedBookIds, setDemoPinnedBookIds] = useState<string[]>([
    'demo-book-naval',
    'demo-book-munger'
  ]);
  const [hiddenBookIds, setHiddenBookIds] = useState<string[]>([]);
  const [demoHiddenBookIds, setDemoHiddenBookIds] = useState<string[]>([]);

  // 活跃数据（支持在真实库与示例测试数据间平滑切换）
  const activeBooks = isDemoMode ? DEMO_BOOKS : books;
  const activeTags = isDemoMode ? demoTags : tags;
  const activeAnnotations = isDemoMode ? demoAnnotations : allAnnotations;
  const activePinnedBookIds = isDemoMode ? demoPinnedBookIds : pinnedBookIds;
  const activeHiddenBookIds = isDemoMode ? demoHiddenBookIds : hiddenBookIds;

  // 跳转到知识网络图谱并聚焦指定高亮节点
  const handleOpenInGraph = (annotation: AnnotationItem) => {
    setSelectedBook(null);
    setSelectedTag(null);
    setSelectedGraphNodeId(`anno:${annotation.uuid}`);
    setCurrentTab('graph');
  };

  // 初始化加载数据
  const loadInitialData = async () => {
    try {
      if (typeof window !== 'undefined' && window.bookEchoAPI) {
        const [fetchedBooks, semantics, fetchedTags, allAnnos, pinnedRaw, hiddenRaw, customDirRaw, exportFmtRaw] = await Promise.all([
          window.bookEchoAPI.getBooks(),
          window.bookEchoAPI.getColorSemantics(),
          window.bookEchoAPI.getAllTags(),
          window.bookEchoAPI.getBookAnnotations(),
          window.bookEchoAPI.getSetting ? window.bookEchoAPI.getSetting('pinned_book_ids') : Promise.resolve(null),
          window.bookEchoAPI.getSetting ? window.bookEchoAPI.getSetting('hidden_book_ids') : Promise.resolve(null),
          window.bookEchoAPI.getSetting ? window.bookEchoAPI.getSetting('custom_apple_books_dir') : Promise.resolve(null),
          window.bookEchoAPI.getSetting ? window.bookEchoAPI.getSetting('export_format') : Promise.resolve(null)
        ]);
        setBooks(fetchedBooks || []);
        if (semantics && semantics.length > 0) {
          setColorSemantics(semantics);
        }
        const parsedPinned = parseStringArraySetting(pinnedRaw);
        if (parsedPinned) setPinnedBookIds(parsedPinned);
        const parsedHidden = parseStringArraySetting(hiddenRaw);
        if (parsedHidden) setHiddenBookIds(parsedHidden);
        if (customDirRaw) setCustomDataDir(customDirRaw);
        if (exportFmtRaw === 'standard' || exportFmtRaw === 'obsidian') {
          setExportFormatPref(exportFmtRaw);
        }
        setTags(fetchedTags || []);
        setAllAnnotations(allAnnos || []);
        setHasPermissionError(false);
      }
    } catch (e: any) {
      console.error('Failed to load initial Apple Books data', e);
      const errMsg = String(e?.message || e || '');
      const isPerm =
        errMsg.includes('EACCES') ||
        errMsg.includes('EPERM') ||
        errMsg.includes('permission') ||
        errMsg.includes('operation not permitted');
      setHasPermissionError(isPerm);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // 暗色模式样式同步
  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (isDarkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [isDarkMode]);

  // 全局快捷键：Cmd/Ctrl + K 唤起全局搜索，Esc 返回
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSelectedTag(null);
        setCurrentTab('search');
      } else if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        setSettingsInitialTab('general');
        setIsSettingsOpen(prev => !prev);
      } else if (e.key === 'Escape') {
        const target = e.target as { tagName?: string } | null;
        if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
        if (activeQuoteItem || exportBookAssetId || isSettingsOpen || isColorSettingsOpen) return;
        if (readingChapterContent) {
          setReadingChapterContent(null);
        } else if (selectedTag) {
          setSelectedTag(null);
        } else if (selectedBook) {
          setSelectedBook(null);
          setBookChapters([]);
          setActiveChapter(null);
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleGlobalKeyDown);
      return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }
  }, [activeQuoteItem, exportBookAssetId, isSettingsOpen, isColorSettingsOpen, readingChapterContent, selectedTag, selectedBook]);

  // 切换单书精读
  const handleSelectBook = async (book: BookItem) => {
    setSelectedBook(book);
    setSelectedTag(null);
    setCurrentTab('books');
    setActiveChapter(null);
    setReadingChapterContent(null);

    if (isDemoMode) {
      const annos = demoAnnotations.filter(a => a.assetId === book.assetId);
      setCurrentAnnotations(annos);
      const chs = Array.from(new Set(annos.map(a => a.chapterTitle || '默认章节')));
      setBookChapters(
        chs.map(title => ({
          title,
          notesCount: annos.filter(a => (a.chapterTitle || '默认章节') === title).length
        }))
      );
      return;
    }

    if (typeof window !== 'undefined' && window.bookEchoAPI) {
      try {
        const [annos, chs] = await Promise.all([
          window.bookEchoAPI.getBookAnnotations(book.assetId),
          window.bookEchoAPI.getBookChapters(book.assetId)
        ]);
        setCurrentAnnotations(annos || []);
        setBookChapters(chs || []);
      } catch (err) {
        console.error('Failed to load book annotations or chapters', err);
        setCurrentAnnotations([]);
        setBookChapters([]);
      }
    } else {
      setCurrentAnnotations([]);
      setBookChapters([]);
    }
  };

  // 加载单章完整 EPUB 原文
  const handleReadChapter = async (chapterTitle: string) => {
    if (!selectedBook) return;
    setActiveChapter(chapterTitle);
    setIsLoadingChapterContent(true);
    try {
      if (typeof window !== 'undefined' && window.bookEchoAPI) {
        const res = await window.bookEchoAPI.getChapterContent(selectedBook.assetId, chapterTitle);
        setReadingChapterContent(res);
      } else {
        setReadingChapterContent({ available: false, chapterTitle, paragraphs: [] });
      }
    } catch {
      setReadingChapterContent({ available: false, chapterTitle, paragraphs: [] });
    } finally {
      setIsLoadingChapterContent(false);
    }
  };

  // 刷新同步
  const handleRefreshData = async () => {
    setIsRefreshing(true);
    try {
      await loadInitialData();
      if (selectedBook && typeof window !== 'undefined' && window.bookEchoAPI) {
        const annos = await window.bookEchoAPI.getBookAnnotations(selectedBook.assetId);
        setCurrentAnnotations(annos || []);
      }
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // 全局搜索触发（防抖 250ms，演示模式在前端内存中基于 activeAnnotations 搜索，避免污染）
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (isDemoMode) {
        setSearchResults([]);
        return;
      }
      if (searchKeyword.trim() && typeof window !== 'undefined' && window.bookEchoAPI) {
        try {
          const results = await window.bookEchoAPI.searchAnnotations(searchKeyword.trim());
          setSearchResults(results || []);
        } catch (err) {
          console.error('Failed to search annotations', err);
          setSearchResults([]);
        }
      } else {
        setSearchResults([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchKeyword, isDemoMode]);

  // 更新星标
  const handleToggleStar = async (uuid: string) => {
    const item =
      currentAnnotations.find(a => a.uuid === uuid) ||
      activeAnnotations.find(a => a.uuid === uuid);
    if (!item) return;
    const nextStarred = !item.isStarred;
    setCurrentAnnotations(prev =>
      prev.map(a => (a.uuid === uuid ? { ...a, isStarred: nextStarred } : a))
    );
    if (isDemoMode) {
      setDemoAnnotations(prev =>
        prev.map(a => (a.uuid === uuid ? { ...a, isStarred: nextStarred } : a))
      );
      return;
    }
    setAllAnnotations(prev =>
      prev.map(a => (a.uuid === uuid ? { ...a, isStarred: nextStarred } : a))
    );
    if (typeof window !== 'undefined' && window.bookEchoAPI) {
      try {
        await window.bookEchoAPI.updateAnnotationMeta(uuid, { isStarred: nextStarred });
      } catch (err) {
        console.error('Failed to toggle star', err);
      }
    }
  };

  // 更新延伸思考
  const handleUpdateCustomNote = async (uuid: string, note: string) => {
    setCurrentAnnotations(prev =>
      prev.map(a => (a.uuid === uuid ? { ...a, customNote: note } : a))
    );
    if (isDemoMode) {
      setDemoAnnotations(prev =>
        prev.map(a => (a.uuid === uuid ? { ...a, customNote: note } : a))
      );
      return;
    }
    setAllAnnotations(prev =>
      prev.map(a => (a.uuid === uuid ? { ...a, customNote: note } : a))
    );
    if (typeof window !== 'undefined' && window.bookEchoAPI) {
      try {
        await window.bookEchoAPI.updateAnnotationMeta(uuid, { customNote: note });
      } catch (err) {
        console.error('Failed to update custom note', err);
      }
    }
  };

  // 更新或修正单条划线的所属章节名称
  const handleUpdateChapter = async (uuid: string, chapterTitle: string) => {
    const clean = chapterTitle.trim();
    if (!clean) return;
    setCurrentAnnotations(prev =>
      prev.map(a => (a.uuid === uuid ? { ...a, chapterTitle: clean } : a))
    );
    setSearchResults(prev =>
      prev.map(a => (a.uuid === uuid ? { ...a, chapterTitle: clean } : a))
    );
    if (isDemoMode) {
      setDemoAnnotations(prev =>
        prev.map(a => (a.uuid === uuid ? { ...a, chapterTitle: clean } : a))
      );
      return;
    }
    setAllAnnotations(prev =>
      prev.map(a => (a.uuid === uuid ? { ...a, chapterTitle: clean } : a))
    );
    if (typeof window !== 'undefined' && window.bookEchoAPI) {
      try {
        await window.bookEchoAPI.updateAnnotationMeta(uuid, { resolvedChapter: clean });
        if (selectedBook) {
          const chs = await window.bookEchoAPI.getBookChapters(selectedBook.assetId);
          setBookChapters(chs || []);
        }
      } catch (err) {
        console.error('Failed to update chapter', err);
      }
    }
  };

  // 保存自定义高亮颜色语义与色彩
  const handleSaveColorSemantics = async (updated: ColorSemanticConfig[]) => {
    setColorSemantics(updated);
    if (!isDemoMode && typeof window !== 'undefined' && window.bookEchoAPI) {
      try {
        await Promise.all(
          updated.map(item =>
            window.bookEchoAPI.updateColorSemantic(item.colorKey, item.label, item.hexColor)
          )
        );
      } catch (err) {
        console.error('Failed to save color semantics', err);
      }
    }
  };

  const handleOpenSettings = (tab: SettingsTabId = 'general') => {
    setSettingsInitialTab(tab);
    setIsSettingsOpen(true);
  };

  const handleOpenColorSettings = () => {
    handleOpenSettings('highlights');
  };

  const handleSelectCustomDir = async () => {
    if (typeof window !== 'undefined' && window.bookEchoAPI) {
      const selected = await window.bookEchoAPI.selectCustomDataDir();
      if (selected) {
        setCustomDataDir(selected);
        loadInitialData();
      }
    }
  };

  const handleResetCustomDir = async () => {
    if (typeof window !== 'undefined' && window.bookEchoAPI) {
      await window.bookEchoAPI.setSetting('custom_apple_books_dir', '');
      setCustomDataDir(null);
      loadInitialData();
    }
  };

  const handleUpdateExportFormat = async (fmt: 'standard' | 'obsidian') => {
    setExportFormatPref(fmt);
    if (typeof window !== 'undefined' && window.bookEchoAPI) {
      await window.bookEchoAPI.setSetting('export_format', fmt);
    }
  };

  // 通用书籍清单配置持久化辅助方法
  const persistBookListSetting = async (
    settingKey: 'pinned_book_ids' | 'hidden_book_ids',
    nextIds: string[],
    setDemoState: (ids: string[]) => void,
    setRealState: (ids: string[]) => void
  ) => {
    if (isDemoMode) {
      setDemoState(nextIds);
      return;
    }
    setRealState(nextIds);
    if (typeof window !== 'undefined' && window.bookEchoAPI?.setSetting) {
      try {
        await window.bookEchoAPI.setSetting(settingKey, JSON.stringify(nextIds));
      } catch (err) {
        console.error(`Failed to persist ${settingKey}`, err);
      }
    }
  };

  const handleTogglePinBook = (assetId: string) => {
    const nextIds = activePinnedBookIds.includes(assetId)
      ? activePinnedBookIds.filter(id => id !== assetId)
      : [...activePinnedBookIds, assetId];
    void persistBookListSetting('pinned_book_ids', nextIds, setDemoPinnedBookIds, setPinnedBookIds);
  };

  const handleBatchPinBooks = (assetIds: string[]) => {
    if (assetIds.length === 0) return;
    const nextIds = Array.from(new Set([...activePinnedBookIds, ...assetIds]));
    void persistBookListSetting('pinned_book_ids', nextIds, setDemoPinnedBookIds, setPinnedBookIds);
  };

  const handleUpdateHiddenBooks = (nextHiddenIds: string[]) => {
    void persistBookListSetting('hidden_book_ids', nextHiddenIds, setDemoHiddenBookIds, setHiddenBookIds);
  };

  // 标签增删
  const handleAddTag = async (uuid: string, tag: string) => {
    setCurrentAnnotations(prev =>
      prev.map(a => {
        if (a.uuid === uuid) {
          const prevTags = a.tags || [];
          return prevTags.includes(tag) ? a : { ...a, tags: [...prevTags, tag] };
        }
        return a;
      })
    );
    if (isDemoMode) {
      setDemoAnnotations(prev =>
        prev.map(a => {
          if (a.uuid === uuid) {
            const prevTags = a.tags || [];
            return prevTags.includes(tag) ? a : { ...a, tags: [...prevTags, tag] };
          }
          return a;
        })
      );
      setDemoTags(prev => (prev.includes(tag) ? prev : [...prev, tag]));
      return;
    }
    setAllAnnotations(prev =>
      prev.map(a => {
        if (a.uuid === uuid) {
          const prevTags = a.tags || [];
          return prevTags.includes(tag) ? a : { ...a, tags: [...prevTags, tag] };
        }
        return a;
      })
    );
    setTags(prev => (prev.includes(tag) ? prev : [...prev, tag]));
    if (typeof window !== 'undefined' && window.bookEchoAPI) {
      try {
        await window.bookEchoAPI.addTag(uuid, tag);
        const updatedTags = await window.bookEchoAPI.getAllTags();
        if (updatedTags) setTags(updatedTags);
      } catch (err) {
        console.error('Failed to add tag', err);
      }
    }
  };

  const handleRemoveTag = async (uuid: string, tag: string) => {
    setCurrentAnnotations(prev =>
      prev.map(a => (a.uuid === uuid ? { ...a, tags: (a.tags || []).filter(t => t !== tag) } : a))
    );
    if (isDemoMode) {
      setDemoAnnotations(prev =>
        prev.map(a => (a.uuid === uuid ? { ...a, tags: (a.tags || []).filter(t => t !== tag) } : a))
      );
      return;
    }
    setAllAnnotations(prev =>
      prev.map(a => (a.uuid === uuid ? { ...a, tags: (a.tags || []).filter(t => t !== tag) } : a))
    );
    if (typeof window !== 'undefined' && window.bookEchoAPI) {
      try {
        await window.bookEchoAPI.removeTag(uuid, tag);
        const updatedTags = await window.bookEchoAPI.getAllTags();
        if (updatedTags) setTags(updatedTags);
      } catch (err) {
        console.error('Failed to remove tag', err);
      }
    }
  };

  // 全局标签库：新建、重命名、删除
  const handleCreateGlobalTag = async (tag: string) => {
    const cleaned = tag.trim().replace(/^#+/, '');
    if (!cleaned) return;
    if (isDemoMode) {
      setDemoTags(prev => (prev.includes(cleaned) ? prev : [...prev, cleaned]));
      return;
    }
    setTags(prev => (prev.includes(cleaned) ? prev : [...prev, cleaned]));
    if (typeof window !== 'undefined' && window.bookEchoAPI) {
      try {
        await window.bookEchoAPI.createGlobalTag(cleaned);
        const updated = await window.bookEchoAPI.getAllTags();
        if (updated) setTags(updated);
      } catch (err) {
        console.error('Failed to create global tag', err);
      }
    }
  };

  const handleRenameGlobalTag = async (oldTag: string, newTag: string) => {
    const cleanOld = oldTag.trim().replace(/^#+/, '');
    const cleanNew = newTag.trim().replace(/^#+/, '');
    if (!cleanOld || !cleanNew || cleanOld === cleanNew) return;

    setCurrentAnnotations(prev =>
      prev.map(a => ({
        ...a,
        tags: Array.from(new Set((a.tags || []).map(t => (t === cleanOld ? cleanNew : t))))
      }))
    );
    if (selectedTag === cleanOld) {
      setSelectedTag(cleanNew);
    }

    if (isDemoMode) {
      setDemoTags(prev => Array.from(new Set(prev.map(t => (t === cleanOld ? cleanNew : t)))));
      setDemoAnnotations(prev =>
        prev.map(a => ({
          ...a,
          tags: Array.from(new Set((a.tags || []).map(t => (t === cleanOld ? cleanNew : t))))
        }))
      );
      return;
    }

    setTags(prev => Array.from(new Set(prev.map(t => (t === cleanOld ? cleanNew : t)))));
    setAllAnnotations(prev =>
      prev.map(a => ({
        ...a,
        tags: Array.from(new Set((a.tags || []).map(t => (t === cleanOld ? cleanNew : t))))
      }))
    );

    if (typeof window !== 'undefined' && window.bookEchoAPI) {
      try {
        await window.bookEchoAPI.renameGlobalTag(cleanOld, cleanNew);
        const updated = await window.bookEchoAPI.getAllTags();
        if (updated) setTags(updated);
      } catch (err) {
        console.error('Failed to rename global tag', err);
      }
    }
  };

  const handleDeleteGlobalTag = async (tag: string) => {
    const clean = tag.trim().replace(/^#+/, '');
    if (!clean) return;

    setCurrentAnnotations(prev =>
      prev.map(a => ({ ...a, tags: (a.tags || []).filter(t => t !== clean) }))
    );
    if (selectedTag === clean) {
      setSelectedTag(null);
    }

    if (isDemoMode) {
      setDemoTags(prev => prev.filter(t => t !== clean));
      setDemoAnnotations(prev =>
        prev.map(a => ({ ...a, tags: (a.tags || []).filter(t => t !== clean) }))
      );
      return;
    }

    setTags(prev => prev.filter(t => t !== clean));
    setAllAnnotations(prev =>
      prev.map(a => ({ ...a, tags: (a.tags || []).filter(t => t !== clean) }))
    );

    if (typeof window !== 'undefined' && window.bookEchoAPI) {
      try {
        await window.bookEchoAPI.deleteGlobalTag(clean);
        const updated = await window.bookEchoAPI.getAllTags();
        if (updated) setTags(updated);
      } catch (err) {
        console.error('Failed to delete global tag', err);
      }
    }
  };

  // 选中图书或搜索结果请求上下文
  const handleRequestContext = async (anno: AnnotationItem): Promise<HighlightContextResult> => {
    const assetId = selectedBook?.assetId || anno.assetId;
    if (typeof window !== 'undefined' && window.bookEchoAPI) {
      try {
        return await window.bookEchoAPI.getHighlightContext(
          assetId,
          anno.locationCfi || '',
          anno.selectedText
        );
      } catch (err) {
        console.error('Failed to request context', err);
      }
    }
    return {
      available: false,
      reason: 'NOT_FOUND',
      beforeParagraphs: [],
      currentParagraph: '',
      selectedText: anno.selectedText,
      afterParagraphs: []
    };
  };

  // 当前选中书籍包含的章节列表（用于侧边栏章节目录）
  const currentBookChapters = Array.from(
    new Set(
      currentAnnotations
        .map(a => a.chapterTitle?.trim() || '默认章节')
        .filter(Boolean)
    )
  );
  const activeBookChapterNames = (bookChapters.length > 0 ? bookChapters : currentBookChapters).map(c =>
    typeof c === 'string' ? c : c.title
  );

  const handleSelectChapter = (chapter: string) => {
    setActiveChapter(chapter);
    setReadingChapterContent(null);
    if (typeof document !== 'undefined') {
      const el = document.getElementById(`chapter-${encodeURIComponent(chapter)}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    }
    // 方案 A：若该章节暂无划线，不再自动加载整章 EPUB 纯文本取而代之，交由 BookDetailView 展示优雅空状态与唤起 Apple Books 引导
  };

  // 全书库中的批注与星标精华
  const starredAndNoteAnnos = Array.isArray(activeAnnotations)
    ? activeAnnotations.filter(
        a => a.isStarred || Boolean(a.note?.trim() || a.customNote?.trim())
      )
    : [];

  const isExportingStarred = exportBookAssetId === '__STARRED_NOTES__';
  const exportingBook: BookItem | null = isExportingStarred
    ? ({
        assetId: '__STARRED_NOTES__',
        title: '全书库精选批注与星标',
        author: '个人精华集',
        genre: '精选合集',
        readingProgress: 1,
        lastOpenDateMs: Date.now(),
        epubPath: null,
        coverUrl: null,
        highlightsCount: starredAndNoteAnnos.length
      } as BookItem)
    : exportBookAssetId
    ? activeBooks.find(b => b.assetId === exportBookAssetId) || selectedBook
    : null;

  return (
    <div
      className={`flex h-screen w-screen overflow-hidden ${
        isDarkMode ? 'dark bg-night-bg text-night-text' : 'bg-paper-bg text-paper-text'
      }`}
    >
      <Sidebar
        currentTab={currentTab}
        onSelectTab={tab => {
          setCurrentTab(tab);
          setSelectedBook(null);
          setSelectedTag(null);
          setBookChapters([]);
          setActiveChapter(null);
          setReadingChapterContent(null);
        }}
        colorSemantics={colorSemantics}
        selectedColor={selectedColor}
        onSelectColor={setSelectedColor}
        tags={activeTags}
        selectedTag={selectedTag}
        onSelectTag={setSelectedTag}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(prev => !prev)}
        onSelectCustomDir={handleSelectCustomDir}
        books={activeBooks}
        pinnedBookIds={activePinnedBookIds}
        onTogglePinBook={handleTogglePinBook}
        onBatchPinBooks={handleBatchPinBooks}
        selectedBook={selectedBook}
        onSelectBook={handleSelectBook}
        chapters={bookChapters.length > 0 ? bookChapters : currentBookChapters}
        onSelectChapter={handleSelectChapter}
        activeChapter={activeChapter}
        onlyChaptersWithNotes={onlyChaptersWithNotes}
        onToggleChaptersFilter={() => setOnlyChaptersWithNotes(prev => !prev)}
        onRefreshData={handleRefreshData}
        isRefreshing={isRefreshing}
        isDemoMode={isDemoMode}
        onToggleDemoMode={() => {
          setIsDemoMode(prev => !prev);
          setSelectedBook(null);
          setSelectedTag(null);
          setBookChapters([]);
          setActiveChapter(null);
          setReadingChapterContent(null);
        }}
        onOpenColorSettings={handleOpenColorSettings}
        onOpenSettings={() => handleOpenSettings('general')}
      />

      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* 演示测试数据专属顶部提示横幅 */}
        {isDemoMode && (
          <div className="flex items-center justify-between px-4 pt-6 pb-2 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 z-30 app-drag">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
              <span>
                <strong>正在体验精品测试数据</strong>：已预置 6 本经典书籍与 20+ 条跨书互联标签，可在「知识网络」探索交织星图。
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsDemoMode(false);
                setSelectedBook(null);
                setSelectedTag(null);
              }}
              className="relative z-30 app-no-drag flex items-center gap-1 font-medium hover:underline text-amber-800 dark:text-amber-200 ml-4 flex-shrink-0 cursor-pointer"
            >
              <span>切回原生书库</span>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {hasPermissionError && !isDemoMode ? (
          <PermissionGuide
            onSelectDir={async () => {
              if (typeof window !== 'undefined' && window.bookEchoAPI) {
                await window.bookEchoAPI.selectCustomDataDir();
                loadInitialData();
              }
            }}
            onRetry={loadInitialData}
          />
        ) : currentTab === 'graph' || currentTab === 'tags' || Boolean(selectedTag) ? (
          <KnowledgeGraphView
            annotations={activeAnnotations}
            books={activeBooks}
            colorSemantics={colorSemantics}
            availableTags={activeTags}
            onSelectBook={handleSelectBook}
            onManageTags={() => {
              setSelectedBook(null);
              setCurrentTab('graph');
            }}
            onOpenColorSettings={handleOpenColorSettings}
            onUpdateChapter={handleUpdateChapter}
            onCreateTag={handleCreateGlobalTag}
            onRenameTag={handleRenameGlobalTag}
            onDeleteTag={handleDeleteGlobalTag}
            onToggleStar={handleToggleStar}
            onUpdateCustomNote={handleUpdateCustomNote}
            onAddTag={handleAddTag}
            onRemoveTag={handleRemoveTag}
            onOpenQuoteModal={anno => setActiveQuoteItem(anno)}
            onRequestContext={handleRequestContext}
            initialFocusedNodeId={selectedGraphNodeId || (selectedTag ? `tag:${selectedTag}` : null)}
            isDarkMode={isDarkMode}
          />
        ) : currentTab === 'insights' ? (
          <InsightsView
            books={activeBooks}
            annotations={activeAnnotations}
            colorSemantics={colorSemantics}
            hiddenBookIds={activeHiddenBookIds}
            onSelectBook={handleSelectBook}
            onOpenColorSettings={handleOpenColorSettings}
            onOpenTagInGraph={tag => {
              setSelectedBook(null);
              setSelectedTag(null);
              setSelectedGraphNodeId(`tag:${tag}`);
              setCurrentTab('graph');
            }}
          />
        ) : currentTab === 'search' ? (
          <GlobalSearchView
            books={activeBooks}
            annotations={activeAnnotations}
            searchResults={searchResults}
            colorSemantics={colorSemantics}
            availableTags={activeTags}
            searchKeyword={searchKeyword}
            onSearchKeywordChange={setSearchKeyword}
            onSelectBook={handleSelectBook}
            onManageTags={() => {
              setSelectedBook(null);
              setCurrentTab('graph');
            }}
            onOpenColorSettings={handleOpenColorSettings}
            onUpdateChapter={handleUpdateChapter}
            onToggleStar={handleToggleStar}
            onUpdateCustomNote={handleUpdateCustomNote}
            onAddTag={handleAddTag}
            onRemoveTag={handleRemoveTag}
            onOpenQuoteModal={anno => setActiveQuoteItem(anno)}
            onRequestContext={handleRequestContext}
            onOpenInGraph={handleOpenInGraph}
          />
        ) : currentTab === 'starred_notes' ? (
          /* 批注与星标独立专属汇总馆 */
          <div className="flex-1 overflow-y-auto p-8 bg-paper-bg dark:bg-night-bg text-paper-text dark:text-night-text">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between pb-6 border-b border-paper-border dark:border-night-border mb-8 gap-4 app-drag">
              <div>
                <h2 className="text-3xl font-serif font-bold text-paper-text dark:text-night-text flex items-center gap-2">
                  <MessageSquareQuote className="w-7 h-7 text-paper-terracotta dark:text-night-terracotta" />
                  <span>批注与星标精选</span>
                </h2>
                <p className="text-sm text-paper-muted dark:text-night-muted mt-1.5">
                  共收录全书库 {starredAndNoteAnnos.length} 条深度思考想法与星标金句
                </p>
              </div>

              {starredAndNoteAnnos.length > 0 && (
                <button
                  onClick={() => {
                    setExportBookAssetId('__STARRED_NOTES__');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-paper-terracotta dark:bg-night-terracotta text-white text-xs font-medium shadow-sm hover:opacity-95 transition-opacity"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>导出笔记</span>
                </button>
              )}
            </div>

            {starredAndNoteAnnos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <Sparkles className="w-12 h-12 text-paper-muted/40 dark:text-night-muted/40 mb-3" />
                <p className="text-base font-serif font-medium text-paper-text dark:text-night-text">
                  暂无批注与星标
                </p>
                <p className="text-xs text-paper-muted dark:text-night-muted mt-1">
                  在书籍高亮上标记 ⭐ 星标或补充二次想法，将自动汇集在此
                </p>
              </div>
            ) : (
              <div className="space-y-4 max-w-4xl">
                {starredAndNoteAnnos.map(anno => (
                  <div key={anno.uuid} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-paper-muted dark:text-night-muted px-1">
                      <span
                        onClick={() => {
                          const matchedBook = activeBooks.find(b => b.assetId === anno.assetId);
                          if (matchedBook) handleSelectBook(matchedBook);
                        }}
                        className="cursor-pointer hover:text-paper-terracotta dark:hover:text-night-terracotta font-serif font-medium"
                      >
                        《{anno.bookTitle || '未知书籍'}》 · {anno.chapterTitle || '默认章节'}
                      </span>
                    </div>
                    <HighlightCard
                      annotation={anno}
                      colorSemantics={colorSemantics}
                      availableTags={activeTags}
                      allAnnotations={activeAnnotations}
                      onOpenInGraph={handleOpenInGraph}
                      onManageTags={() => {
                        setSelectedBook(null);
                        setCurrentTab('graph');
                      }}
                      onOpenColorSettings={handleOpenColorSettings}
                      onUpdateChapter={handleUpdateChapter}
                      onToggleStar={handleToggleStar}
                      onUpdateCustomNote={handleUpdateCustomNote}
                      onAddTag={handleAddTag}
                      onRemoveTag={handleRemoveTag}
                      onOpenQuoteModal={anno => setActiveQuoteItem(anno)}
                      onRequestContext={handleRequestContext}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : selectedBook ? (
          <BookDetailView
            book={selectedBook}
            annotations={currentAnnotations}
            colorSemantics={colorSemantics}
            availableTags={activeTags}
            allAnnotations={activeAnnotations}
            chapterSuggestions={activeBookChapterNames}
            onOpenInGraph={handleOpenInGraph}
            onManageTags={() => {
              setSelectedBook(null);
              setCurrentTab('graph');
            }}
            onOpenColorSettings={handleOpenColorSettings}
            onUpdateChapter={handleUpdateChapter}
            onBack={() => {
              setSelectedBook(null);
              setBookChapters([]);
              setActiveChapter(null);
              setReadingChapterContent(null);
            }}
            onOpenInAppleBooks={(id, p) => {
              if (isDemoMode) {
                alert('演示模式提示：当前为测试体验书籍，本地 Apple Books 原生应用中未收录此书文件。');
                return;
              }
              if (typeof window !== 'undefined' && window.bookEchoAPI) {
                window.bookEchoAPI.openInAppleBooks(id, p);
              }
            }}
            onExportMarkdown={id => setExportBookAssetId(id)}
            onToggleStar={handleToggleStar}
            onUpdateCustomNote={handleUpdateCustomNote}
            onAddTag={handleAddTag}
            onRemoveTag={handleRemoveTag}
            onOpenQuoteModal={anno => setActiveQuoteItem(anno)}
            onRequestContext={handleRequestContext}
            activeChapter={activeChapter}
            onActiveChapterChange={setActiveChapter}
            readingChapterContent={readingChapterContent}
            isLoadingChapterContent={isLoadingChapterContent}
            onReadChapter={handleReadChapter}
            onCloseChapterReader={() => setReadingChapterContent(null)}
            isPinned={activePinnedBookIds.includes(selectedBook.assetId)}
            onTogglePinBook={handleTogglePinBook}
          />
        ) : (
          <BookshelfView
            books={activeBooks}
            onSelectBook={handleSelectBook}
            pinnedBookIds={activePinnedBookIds}
            onTogglePinBook={handleTogglePinBook}
            hiddenBookIds={activeHiddenBookIds}
            onUpdateHiddenBooks={handleUpdateHiddenBooks}
          />
        )}
      </main>

      {/* 金句卡片弹窗 */}
      {activeQuoteItem && (
        <QuoteCardModal
          annotation={activeQuoteItem}
          bookTitle={
            activeQuoteItem.bookTitle ||
            selectedBook?.title ||
            activeBooks.find(b => b.assetId === activeQuoteItem.assetId)?.title ||
            '未知书籍'
          }
          author={
            selectedBook?.author ||
            activeBooks.find(b => b.assetId === activeQuoteItem.assetId)?.author ||
            '未知作者'
          }
          onClose={() => setActiveQuoteItem(null)}
        />
      )}

      {/* Markdown 导出弹窗 */}
      {exportBookAssetId && exportingBook && (
        <ExportModal
          bookTitle={exportingBook.title}
          defaultFormat={exportFormatPref}
          onClose={() => setExportBookAssetId(null)}
          onConfirmExport={async fmt => {
            if (isDemoMode || !window.bookEchoAPI) {
              const annosToExport = isExportingStarred
                ? starredAndNoteAnnos
                : activeAnnotations.filter(a => a.assetId === exportBookAssetId);

              const lines = [
                `# ${exportingBook.title}`,
                `> 导出时间：${new Date().toLocaleDateString('zh-CN')} · 共 ${annosToExport.length} 条笔记\n`
              ];
              for (const a of annosToExport) {
                const b = activeBooks.find(book => book.assetId === a.assetId);
                lines.push(`## 《${b?.title || a.bookTitle || '未知书籍'}》· ${a.chapterTitle || '默认章节'}`);
                lines.push(`> “${a.selectedText}”`);
                if (a.note) lines.push(`> 想法：${a.note}`);
                if (a.customNote) lines.push(`> 延伸思考：${a.customNote}`);
                if (a.tags && a.tags.length > 0) lines.push(`> 标签：${a.tags.map(t => `#${t}`).join(' ')}`);
                lines.push('');
              }
              const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${exportingBook.title.replace(/[/\\?%*:|"<>]/g, '_')}_${fmt}.md`;
              a.click();
              URL.revokeObjectURL(url);
              setExportBookAssetId(null);
              return;
            }

            if (typeof window !== 'undefined' && window.bookEchoAPI) {
              await window.bookEchoAPI.exportMarkdown(exportBookAssetId, fmt);
              setExportBookAssetId(null);
            }
          }}
        />
      )}

      {/* 偏好设置面板（支持 Cmd + , 快捷键与各模块 Tab） */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        initialTab={settingsInitialTab}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(prev => !prev)}
        colorSemantics={colorSemantics}
        onSaveColorSemantics={handleSaveColorSemantics}
        annotations={activeAnnotations}
        booksCount={activeBooks.length}
        tagsCount={activeTags.length}
        customDataDir={customDataDir}
        onSelectCustomDir={handleSelectCustomDir}
        onResetCustomDir={handleResetCustomDir}
        isDemoMode={isDemoMode}
        onToggleDemoMode={() => {
          setIsDemoMode(prev => !prev);
          setSelectedBook(null);
          setSelectedTag(null);
          setBookChapters([]);
          setActiveChapter(null);
          setReadingChapterContent(null);
        }}
        exportFormat={exportFormatPref}
        onUpdateExportFormat={handleUpdateExportFormat}
      />

      {/* 高亮颜色语义与配色自定义弹窗（向后兼容） */}
      {isColorSettingsOpen && (
        <ColorSemanticsModal
          colorSemantics={colorSemantics}
          annotations={activeAnnotations}
          onSave={handleSaveColorSemantics}
          onClose={() => setIsColorSettingsOpen(false)}
        />
      )}

      {/* 全局窗口顶部无边框拖拽条（避开左上角红绿灯；弹窗打开时自动退避避免拦截关闭按钮点击） */}
      {!isSettingsOpen && !isColorSettingsOpen && !activeQuoteItem && !exportBookAssetId && (
        <div
          className="fixed top-0 left-20 right-0 h-6 z-20 app-drag"
          aria-hidden="true"
          data-testid="window-drag-region"
        />
      )}
    </div>
  );
}
