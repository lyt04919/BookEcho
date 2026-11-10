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
import { Search } from 'lucide-react';

const DEFAULT_SEMANTICS: ColorSemanticConfig[] = [
  { colorKey: 'yellow', label: '核心论点', hexColor: '#F5A623' },
  { colorKey: 'green', label: '行动与实践', hexColor: '#5CB85C' },
  { colorKey: 'blue', label: '概念与背景', hexColor: '#4A90E2' },
  { colorKey: 'pink', label: '灵感与金句', hexColor: '#E86F88' },
  { colorKey: 'purple', label: '存疑与深思', hexColor: '#9B6B9E' },
  { colorKey: 'underline', label: '重点下划线', hexColor: '#D9534F' }
];

export default function App() {
  const [currentTab, setCurrentTab] = useState<'books' | 'review' | 'search'>('books');
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

  // 初始化加载数据
  const loadInitialData = async () => {
    try {
      if (typeof window !== 'undefined' && window.bookEchoAPI) {
        const [fetchedBooks, semantics, fetchedTags] = await Promise.all([
          window.bookEchoAPI.getBooks(),
          window.bookEchoAPI.getColorSemantics(),
          window.bookEchoAPI.getAllTags()
        ]);
        setBooks(fetchedBooks || []);
        if (semantics && semantics.length > 0) {
          setColorSemantics(semantics);
        }
        setTags(fetchedTags || []);
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
    const item = currentAnnotations.find(a => a.uuid === uuid);
    if (!item) return;
    const nextStarred = !item.isStarred;
    setCurrentAnnotations(prev =>
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

  // 过滤后的高亮列表（按色彩与标签）
  const filteredAnnotations = currentAnnotations.filter(a => {
    if (selectedColor && a.colorKey !== selectedColor) return false;
    if (selectedTag && !(a.tags || []).includes(selectedTag)) return false;
    return true;
  });

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
          setSelectedBook(null);
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
                  className="p-4 rounded-xl border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card shadow-sm"
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
        ) : selectedBook ? (
          <BookDetailView
            book={selectedBook}
            annotations={filteredAnnotations}
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
