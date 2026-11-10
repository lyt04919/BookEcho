import { useState, useEffect } from 'react';
import {
  BookItem,
  AnnotationItem,
  ColorSemanticConfig,
  HighlightColor,
  HighlightContextResult
} from '../electron/types/ipc';
import { Sidebar } from './components/Sidebar';
import { BookshelfView } from './components/BookshelfView';
import { BookDetailView } from './components/BookDetailView';
import { DailyReviewView } from './components/DailyReviewView';
import { QuoteCardModal } from './components/QuoteCardModal';
import { ExportModal } from './components/ExportModal';
import { PermissionGuide } from './components/PermissionGuide';
import { HighlightCard } from './components/HighlightCard';
import { Search, MessageSquareQuote, Download, Sparkles } from 'lucide-react';

const DEFAULT_SEMANTICS: ColorSemanticConfig[] = [
  { colorKey: 'yellow', label: '核心论点', hexColor: '#F5A623' },
  { colorKey: 'green', label: '行动与实践', hexColor: '#5CB85C' },
  { colorKey: 'blue', label: '概念与背景', hexColor: '#4A90E2' },
  { colorKey: 'pink', label: '灵感与金句', hexColor: '#E86F88' },
  { colorKey: 'purple', label: '存疑与深思', hexColor: '#9B6B9E' },
  { colorKey: 'underline', label: '重点下划线', hexColor: '#D9534F' }
];

export default function App() {
  const [currentTab, setCurrentTab] = useState<'books' | 'review' | 'search' | 'starred_notes'>('books');
  const [books, setBooks] = useState<BookItem[]>([]);
  const [selectedBook, setSelectedBook] = useState<BookItem | null>(null);
  const [currentAnnotations, setCurrentAnnotations] = useState<AnnotationItem[]>([]);
  const [reviewQueue, setReviewQueue] = useState<AnnotationItem[]>([]);
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

  // 初始化加载数据
  const loadInitialData = async () => {
    try {
      if (typeof window !== 'undefined' && window.bookEchoAPI) {
        const [fetchedBooks, semantics, fetchedTags, allAnnos] = await Promise.all([
          window.bookEchoAPI.getBooks(),
          window.bookEchoAPI.getColorSemantics(),
          window.bookEchoAPI.getAllTags(),
          window.bookEchoAPI.getBookAnnotations()
        ]);
        setBooks(fetchedBooks || []);
        if (semantics && semantics.length > 0) {
          setColorSemantics(semantics);
        }
        setTags(fetchedTags || []);
        setAllAnnotations(allAnnos || []);
        setHasPermissionError(false);
      }
    } catch (e) {
      console.error('Failed to load initial Apple Books data', e);
      setHasPermissionError(true);
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

  // 切换单书精读
  const handleSelectBook = async (book: BookItem) => {
    setSelectedBook(book);
    setCurrentTab('books');
    if (typeof window !== 'undefined' && window.bookEchoAPI) {
      try {
        const annos = await window.bookEchoAPI.getBookAnnotations(book.assetId);
        setCurrentAnnotations(annos || []);
      } catch (err) {
        console.error('Failed to load book annotations', err);
        setCurrentAnnotations([]);
      }
    } else {
      setCurrentAnnotations([]);
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

  // 加载每日回顾
  const loadReviewQueue = async () => {
    if (typeof window !== 'undefined' && window.bookEchoAPI) {
      try {
        const q = await window.bookEchoAPI.getDailyReviewQueue(8);
        setReviewQueue(q || []);
      } catch (err) {
        console.error('Failed to load daily review queue', err);
        setReviewQueue([]);
      }
    }
  };

  useEffect(() => {
    if (currentTab === 'review') {
      loadReviewQueue();
    }
  }, [currentTab]);

  // 全局搜索触发（防抖 250ms）
  useEffect(() => {
    const timer = setTimeout(async () => {
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
  }, [searchKeyword]);

  // 更新星标
  const handleToggleStar = async (uuid: string) => {
    const item = currentAnnotations.find(a => a.uuid === uuid) || allAnnotations.find(a => a.uuid === uuid);
    if (!item) return;
    const nextStarred = !item.isStarred;
    setCurrentAnnotations(prev =>
      prev.map(a => (a.uuid === uuid ? { ...a, isStarred: nextStarred } : a))
    );
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

  const handleSelectChapter = (chapter: string) => {
    if (typeof document !== 'undefined') {
      const el = document.getElementById(`chapter-${encodeURIComponent(chapter)}`);
      el?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // 全书库中的批注与星标精华
  const starredAndNoteAnnos = allAnnotations.filter(
    a => a.isStarred || Boolean(a.note?.trim() || a.customNote?.trim())
  );

  const exportingBook = exportBookAssetId
    ? books.find(b => b.assetId === exportBookAssetId) || selectedBook
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
          if (tab !== 'books') {
            setSelectedBook(null);
          }
        }}
        colorSemantics={colorSemantics}
        selectedColor={selectedColor}
        onSelectColor={setSelectedColor}
        tags={tags}
        selectedTag={selectedTag}
        onSelectTag={setSelectedTag}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(prev => !prev)}
        onSelectCustomDir={async () => {
          if (typeof window !== 'undefined' && window.bookEchoAPI) {
            await window.bookEchoAPI.selectCustomDataDir();
            loadInitialData();
          }
        }}
        books={books}
        selectedBook={selectedBook}
        onSelectBook={handleSelectBook}
        chapters={currentBookChapters}
        onSelectChapter={handleSelectChapter}
        onRefreshData={handleRefreshData}
        isRefreshing={isRefreshing}
      />

      <main className="flex-1 flex flex-col overflow-hidden relative">
        {hasPermissionError ? (
          <PermissionGuide
            onSelectDir={async () => {
              if (typeof window !== 'undefined' && window.bookEchoAPI) {
                await window.bookEchoAPI.selectCustomDataDir();
                loadInitialData();
              }
            }}
            onRetry={loadInitialData}
          />
        ) : currentTab === 'search' ? (
          <div className="flex-1 flex flex-col p-8 overflow-y-auto bg-paper-bg dark:bg-night-bg text-paper-text dark:text-night-text">
            <div className="relative mb-6 max-w-xl">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-paper-muted dark:text-night-muted" />
              <input
                type="text"
                value={searchKeyword}
                onChange={e => setSearchKeyword(e.target.value)}
                placeholder="搜索高亮句子、想法或批注..."
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card text-paper-text dark:text-night-text placeholder:text-paper-muted dark:placeholder:text-night-muted focus:outline-none focus:ring-1 focus:ring-paper-terracotta dark:focus:ring-night-terracotta"
                autoFocus
              />
            </div>

            <div className="space-y-4 max-w-3xl">
              {searchResults.map(res => (
                <div
                  key={res.uuid}
                  onClick={() => {
                    const matchedBook = books.find(b => b.assetId === res.assetId);
                    if (matchedBook) {
                      handleSelectBook(matchedBook);
                    }
                    setCurrentTab('books');
                  }}
                  className="p-4 rounded-xl border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card shadow-sm cursor-pointer hover:border-paper-terracotta/60 dark:hover:border-night-terracotta/60 hover:shadow-md transition-all"
                >
                  <p className="font-serif text-sm leading-relaxed mb-2 text-paper-text dark:text-night-text">
                    “{res.selectedText}”
                  </p>
                  {res.note && (
                    <p className="text-xs text-paper-muted dark:text-night-muted">
                      划线批注: {res.note}
                    </p>
                  )}
                </div>
              ))}
              {searchKeyword.trim() && searchResults.length === 0 && (
                <p className="text-xs text-paper-muted dark:text-night-muted">未找到匹配的高亮或批注</p>
              )}
            </div>
          </div>
        ) : currentTab === 'review' ? (
          <DailyReviewView
            queue={reviewQueue}
            colorSemantics={colorSemantics}
            onSubmitResult={async (uuid, res) => {
              if (typeof window !== 'undefined' && window.bookEchoAPI) {
                await window.bookEchoAPI.submitReviewResult(uuid, res);
              }
            }}
            onRefreshQueue={loadReviewQueue}
          />
        ) : currentTab === 'starred_notes' ? (
          /* 批注与星标独立专属汇总馆 */
          <div className="flex-1 overflow-y-auto p-8 bg-paper-bg dark:bg-night-bg text-paper-text dark:text-night-text">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between pb-6 border-b border-paper-border dark:border-night-border mb-8 gap-4">
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
                    const firstBook = books[0];
                    if (firstBook) setExportBookAssetId(firstBook.assetId);
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
                          const matchedBook = books.find(b => b.assetId === anno.assetId);
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
            onBack={() => setSelectedBook(null)}
            onOpenInAppleBooks={(id, p) => {
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
          />
        ) : (
          <BookshelfView books={books} onSelectBook={handleSelectBook} />
        )}
      </main>

      {/* 金句卡片弹窗 */}
      {activeQuoteItem && (
        <QuoteCardModal
          annotation={activeQuoteItem}
          bookTitle={
            activeQuoteItem.bookTitle ||
            selectedBook?.title ||
            books.find(b => b.assetId === activeQuoteItem.assetId)?.title ||
            '未知书籍'
          }
          author={
            selectedBook?.author ||
            books.find(b => b.assetId === activeQuoteItem.assetId)?.author ||
            '未知作者'
          }
          onClose={() => setActiveQuoteItem(null)}
        />
      )}

      {/* Markdown 导出弹窗 */}
      {exportBookAssetId && exportingBook && (
        <ExportModal
          bookTitle={exportingBook.title}
          onClose={() => setExportBookAssetId(null)}
          onConfirmExport={async fmt => {
            if (typeof window !== 'undefined' && window.bookEchoAPI) {
              await window.bookEchoAPI.exportMarkdown(exportBookAssetId, fmt);
            }
          }}
        />
      )}
    </div>
  );
}
