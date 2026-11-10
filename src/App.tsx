import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { BookshelfView } from './components/BookshelfView';
import { BookDetailView } from './components/BookDetailView';
import { DailyReviewView } from './components/DailyReviewView';
import { QuoteCardModal } from './components/QuoteCardModal';
import { ExportModal } from './components/ExportModal';
import {
  BookItem,
  AnnotationItem,
  ColorSemanticConfig,
  HighlightColor,
  HighlightContextResult
} from '../electron/types/ipc';

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
  const [colorSemantics, setColorSemantics] = useState<ColorSemanticConfig[]>(DEFAULT_SEMANTICS);
  const [selectedColor, setSelectedColor] = useState<HighlightColor | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [books, setBooks] = useState<BookItem[]>([]);
  const [selectedBook, setSelectedBook] = useState<BookItem | null>(null);
  const [bookAnnotations, setBookAnnotations] = useState<AnnotationItem[]>([]);
  const [reviewQueue, setReviewQueue] = useState<AnnotationItem[]>([]);
  const [quoteModalAnnotation, setQuoteModalAnnotation] = useState<AnnotationItem | null>(null);
  const [exportModalBook, setExportModalBook] = useState<BookItem | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.bookEchoAPI) {
      window.bookEchoAPI.getColorSemantics().then(res => {
        if (res && res.length > 0) setColorSemantics(res);
      }).catch(err => {
        console.warn('Failed to fetch color semantics', err);
      });

      window.bookEchoAPI.getAllTags().then(res => {
        if (res) setTags(res);
      }).catch(err => {
        console.warn('Failed to fetch tags', err);
      });

      window.bookEchoAPI.getBooks().then(res => {
        if (res) setBooks(res);
      }).catch(err => {
        console.warn('Failed to fetch books', err);
      });
    }
  }, []);

  useEffect(() => {
    if (selectedBook && typeof window !== 'undefined' && window.bookEchoAPI) {
      window.bookEchoAPI.getBookAnnotations(selectedBook.assetId).then(annos => {
        setBookAnnotations(annos || []);
      }).catch(err => {
        console.warn('Failed to fetch annotations for book', err);
      });
    } else {
      setBookAnnotations([]);
    }
  }, [selectedBook]);

  const fetchReviewQueue = async () => {
    if (typeof window !== 'undefined' && window.bookEchoAPI) {
      try {
        const queue = await window.bookEchoAPI.getDailyReviewQueue();
        setReviewQueue(queue || []);
      } catch (err) {
        console.warn('Failed to fetch daily review queue', err);
      }
    }
  };

  useEffect(() => {
    if (currentTab === 'review') {
      fetchReviewQueue();
    }
  }, [currentTab]);

  const handleSubmitReviewResult = async (uuid: string, result: 'remembered' | 'mastered' | 'reset') => {
    if (typeof window !== 'undefined' && window.bookEchoAPI) {
      try {
        await window.bookEchoAPI.submitReviewResult(uuid, result);
      } catch (err) {
        console.error('Failed to submit review result', err);
      }
    }
  };

  const handleSelectTab = (tab: 'books' | 'review' | 'search') => {
    setCurrentTab(tab);
    if (tab === 'books') {
      setSelectedColor(null);
      setSelectedTag(null);
      setSelectedBook(null);
    }
  };

  const handleSelectCustomDir = async () => {
    if (typeof window !== 'undefined' && window.bookEchoAPI) {
      try {
        await window.bookEchoAPI.selectCustomDataDir();
      } catch (err) {
        console.error('Failed to select custom dir', err);
      }
    }
  };

  const handleToggleDarkMode = () => {
    setIsDarkMode(prev => {
      const next = !prev;
      if (typeof document !== 'undefined') {
        if (next) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
      return next;
    });
  };

  const handleOpenInAppleBooks = async (assetId: string, epubPath?: string | null) => {
    if (typeof window !== 'undefined' && window.bookEchoAPI) {
      try {
        await window.bookEchoAPI.openInAppleBooks(assetId, epubPath);
      } catch (err) {
        console.error('Failed to open in Apple Books', err);
      }
    }
  };

  const handleExportMarkdown = (assetId: string) => {
    const book = books.find(b => b.assetId === assetId) || selectedBook;
    if (book) {
      setExportModalBook(book);
    }
  };

  const handleConfirmExport = async (format: 'standard' | 'obsidian') => {
    if (!exportModalBook) return;
    if (typeof window !== 'undefined' && window.bookEchoAPI) {
      try {
        await window.bookEchoAPI.exportMarkdown(exportModalBook.assetId, format);
      } catch (err) {
        console.error('Failed to export markdown', err);
      }
    }
  };

  const handleToggleStar = async (uuid: string) => {
    const target = bookAnnotations.find(a => a.uuid === uuid);
    if (!target) return;
    const newStarred = !target.isStarred;
    setBookAnnotations(prev => prev.map(a => a.uuid === uuid ? { ...a, isStarred: newStarred } : a));
    if (typeof window !== 'undefined' && window.bookEchoAPI) {
      try {
        await window.bookEchoAPI.updateAnnotationMeta(uuid, { isStarred: newStarred });
      } catch (err) {
        console.error('Failed to toggle star', err);
      }
    }
  };

  const handleUpdateCustomNote = async (uuid: string, note: string) => {
    setBookAnnotations(prev => prev.map(a => a.uuid === uuid ? { ...a, customNote: note } : a));
    if (typeof window !== 'undefined' && window.bookEchoAPI) {
      try {
        await window.bookEchoAPI.updateAnnotationMeta(uuid, { customNote: note });
      } catch (err) {
        console.error('Failed to update custom note', err);
      }
    }
  };

  const handleAddTag = async (uuid: string, tag: string) => {
    setBookAnnotations(prev => prev.map(a => {
      if (a.uuid === uuid) {
        const existingTags = a.tags || [];
        if (!existingTags.includes(tag)) {
          return { ...a, tags: [...existingTags, tag] };
        }
      }
      return a;
    }));
    setTags(prev => prev.includes(tag) ? prev : [...prev, tag]);
    if (typeof window !== 'undefined' && window.bookEchoAPI) {
      try {
        await window.bookEchoAPI.addTag(uuid, tag);
      } catch (err) {
        console.error('Failed to add tag', err);
      }
    }
  };

  const handleRemoveTag = async (uuid: string, tag: string) => {
    setBookAnnotations(prev => prev.map(a => {
      if (a.uuid === uuid) {
        return { ...a, tags: (a.tags || []).filter(t => t !== tag) };
      }
      return a;
    }));
    if (typeof window !== 'undefined' && window.bookEchoAPI) {
      try {
        await window.bookEchoAPI.removeTag(uuid, tag);
      } catch (err) {
        console.error('Failed to remove tag', err);
      }
    }
  };

  const handleRequestContext = async (annotation: AnnotationItem): Promise<HighlightContextResult> => {
    if (typeof window !== 'undefined' && window.bookEchoAPI) {
      return await window.bookEchoAPI.getHighlightContext(
        annotation.assetId,
        annotation.locationCfi || '',
        annotation.selectedText
      );
    }
    return {
      available: false,
      reason: 'NOT_FOUND',
      beforeParagraphs: [],
      currentParagraph: '',
      selectedText: annotation.selectedText,
      afterParagraphs: []
    };
  };

  const displayedAnnotations = bookAnnotations.filter(a => {
    if (selectedColor && a.colorKey !== selectedColor) return false;
    if (selectedTag && (!a.tags || !a.tags.includes(selectedTag))) return false;
    return true;
  });

  return (
    <div className={`flex h-screen w-screen overflow-hidden ${isDarkMode ? 'dark bg-night-bg text-night-text' : 'bg-paper-bg text-paper-text'}`}>
      <Sidebar
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        colorSemantics={colorSemantics}
        selectedColor={selectedColor}
        onSelectColor={setSelectedColor}
        tags={tags}
        selectedTag={selectedTag}
        onSelectTag={setSelectedTag}
        isDarkMode={isDarkMode}
        onToggleDarkMode={handleToggleDarkMode}
        onSelectCustomDir={handleSelectCustomDir}
      />
      {currentTab === 'books' && (
        selectedBook ? (
          <BookDetailView
            book={selectedBook}
            annotations={displayedAnnotations}
            colorSemantics={colorSemantics}
            onBack={() => setSelectedBook(null)}
            onOpenInAppleBooks={handleOpenInAppleBooks}
            onExportMarkdown={handleExportMarkdown}
            onToggleStar={handleToggleStar}
            onUpdateCustomNote={handleUpdateCustomNote}
            onAddTag={handleAddTag}
            onRemoveTag={handleRemoveTag}
            onOpenQuoteModal={setQuoteModalAnnotation}
            onRequestContext={handleRequestContext}
          />
        ) : (
          <BookshelfView
            books={books}
            onSelectBook={setSelectedBook}
          />
        )
      )}
      {currentTab === 'review' && (
        <DailyReviewView
          queue={reviewQueue}
          colorSemantics={colorSemantics}
          onSubmitResult={handleSubmitReviewResult}
          onRefreshQueue={fetchReviewQueue}
        />
      )}
      {currentTab === 'search' && (
        <main className="flex-1 flex flex-col items-center justify-center p-8 select-none bg-paper-bg dark:bg-night-bg text-paper-text dark:text-night-text">
          <div className="max-w-md text-center space-y-3">
            <h1 className="text-2xl font-serif font-semibold text-paper-text dark:text-night-text">全局搜索</h1>
            <p className="text-sm text-paper-muted dark:text-night-muted">
              搜索高亮与笔记
            </p>
          </div>
        </main>
      )}
      {quoteModalAnnotation && (
        <QuoteCardModal
          annotation={quoteModalAnnotation}
          bookTitle={
            quoteModalAnnotation.bookTitle ||
            books.find(b => b.assetId === quoteModalAnnotation.assetId)?.title ||
            selectedBook?.title ||
            '未知书籍'
          }
          author={
            books.find(b => b.assetId === quoteModalAnnotation.assetId)?.author ||
            selectedBook?.author ||
            '未知作者'
          }
          onClose={() => setQuoteModalAnnotation(null)}
        />
      )}
      {exportModalBook && (
        <ExportModal
          bookTitle={exportModalBook.title}
          onClose={() => setExportModalBook(null)}
          onConfirmExport={handleConfirmExport}
        />
      )}
    </div>
  );
}
