import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ColorSemanticConfig, HighlightColor } from '../electron/types/ipc';

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
    }
  }, []);

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

  return (
    <div className={`flex h-screen w-screen overflow-hidden ${isDarkMode ? 'dark bg-night-bg text-night-text' : 'bg-paper-bg text-paper-text'}`}>
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
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
      <main className="flex-1 flex flex-col items-center justify-center p-8 select-none">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-2xl font-serif font-semibold text-paper-text">BookEcho 书架视图</h1>
          <p className="text-sm text-paper-muted">
            当前视图: <span className="font-medium text-paper-terracotta">{currentTab}</span>
            {selectedColor && <> | 颜色过滤: <span className="font-medium">{selectedColor}</span></>}
            {selectedTag && <> | 标签: <span className="font-medium">#{selectedTag}</span></>}
          </p>
        </div>
      </main>
    </div>
  );
}
