import React, { useRef, useState, useEffect } from 'react';
import { AnnotationItem } from '../../electron/types/ipc';
import { toPng } from 'html-to-image';
import { X, Copy, Check, Download, Edit2, RotateCcw } from 'lucide-react';

export interface QuoteCardModalProps {
  annotation: AnnotationItem;
  bookTitle: string;
  author: string;
  onClose: () => void;
}

export type CardTheme = 'classic' | 'swiss' | 'obsidian' | 'sage';

export const THEME_STYLES: Record<CardTheme, { bg: string; text: string; subText: string; border: string }> = {
  classic: {
    bg: 'bg-[#FAF7F2]',
    text: 'text-[#1E1D1A]',
    subText: 'text-[#6E6A63]',
    border: 'border-[#E6E1D6]'
  },
  swiss: {
    bg: 'bg-white',
    text: 'text-black',
    subText: 'text-neutral-500',
    border: 'border-black'
  },
  obsidian: {
    bg: 'bg-[#141413]',
    text: 'text-[#EAE6DF]',
    subText: 'text-[#9A958C]',
    border: 'border-[#302F2C]'
  },
  sage: {
    bg: 'bg-[#EBF0EC]',
    text: 'text-[#1C2820]',
    subText: 'text-[#4A5D50]',
    border: 'border-[#D1DDD3]'
  }
};

export const QuoteCardModal: React.FC<QuoteCardModalProps> = ({
  annotation,
  bookTitle,
  author,
  onClose
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<CardTheme>('classic');
  const [showNote, setShowNote] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [customQuote, setCustomQuote] = useState(annotation.selectedText);
  const [customCardNote, setCustomCardNote] = useState(annotation.customNote || annotation.note || '');
  const [customBookTitle, setCustomBookTitle] = useState(bookTitle);
  const [customAuthor, setCustomAuthor] = useState(author || '未知作者');
  const [customWatermark, setCustomWatermark] = useState('BookEcho');

  const handleResetEdits = () => {
    setCustomQuote(annotation.selectedText);
    setCustomCardNote(annotation.customNote || annotation.note || '');
    setCustomBookTitle(bookTitle);
    setCustomAuthor(author || '未知作者');
    setCustomWatermark('BookEcho');
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [onClose]);

  const handleCopyImage = async () => {
    if (!cardRef.current) return;
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2.5 });
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      if (typeof navigator !== 'undefined' && navigator.clipboard && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      }
    } catch (e) {
      console.error('Failed to copy card image', e);
    }
  };

  const handleDownloadImage = async () => {
    if (!cardRef.current) return;
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2.5 });
      const link = document.createElement('a');
      link.download = `${bookTitle}_金句卡片.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error('Failed to download card image', e);
    }
  };

  const currentTheme = THEME_STYLES[theme];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 app-no-drag"
      data-testid="quote-card-modal"
      onClick={onClose}
    >
      <div
        className="bg-paper-card dark:bg-night-card border border-paper-border dark:border-night-border rounded-2xl w-full max-w-2xl p-6 shadow-xl space-y-6 text-paper-text dark:text-night-text"
        onClick={e => e.stopPropagation()}
      >
        {/* 顶部标题与关闭 */}
        <div className="flex items-center justify-between pb-3 border-b border-paper-border dark:border-night-border">
          <h3 className="font-serif text-lg font-bold text-paper-text dark:text-night-text">金句卡片设计工坊</h3>
          <button
            onClick={onClose}
            className="p-1 rounded text-paper-muted dark:text-night-muted hover:text-paper-text dark:hover:text-night-text transition-colors"
            aria-label="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 模版与选项栏 */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-paper-muted dark:text-night-muted">主题模板:</span>
            {(['classic', 'swiss', 'obsidian', 'sage'] as CardTheme[]).map(t => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`px-2.5 py-1 rounded capitalize transition-colors ${
                  theme === t
                    ? 'bg-paper-terracotta dark:bg-night-terracotta text-white font-medium'
                    : 'bg-paper-drawer dark:bg-night-drawer text-paper-text dark:text-night-text hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                {t === 'classic' ? '经典纸书' : t === 'swiss' ? '瑞士极简' : t === 'obsidian' ? '暗夜流光' : '森林晨雾'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 cursor-pointer text-paper-text dark:text-night-text">
              <input
                type="checkbox"
                checked={showNote}
                onChange={e => setShowNote(e.target.checked)}
                className="rounded text-paper-terracotta dark:text-night-terracotta focus:ring-0"
              />
              <span>展示批注/思考</span>
            </label>

            <button
              type="button"
              onClick={() => setIsEditingContent(prev => !prev)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded transition-colors ${
                isEditingContent
                  ? 'bg-paper-terracotta/15 text-paper-terracotta dark:text-night-terracotta font-medium'
                  : 'bg-paper-drawer dark:bg-night-drawer text-paper-muted hover:text-paper-text dark:hover:text-night-text'
              }`}
              title="制作金句图前可临时精修文字排版或自定义角标署名"
            >
              <Edit2 className="w-3 h-3" />
              <span>{isEditingContent ? '收起文案微调' : '微调文案'}</span>
            </button>
          </div>
        </div>

        {/* 卡片文案临时微调面板（仅作用于当前导出的高清金句图） */}
        {isEditingContent && (
          <div className="p-3.5 rounded-xl border border-paper-border dark:border-night-border bg-paper-sidebar/40 dark:bg-night-sidebar/40 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-medium text-paper-muted dark:text-night-muted">
                自由微调金句卡片展示文案（不影响原始笔记）：
              </span>
              <button
                type="button"
                onClick={handleResetEdits}
                className="flex items-center gap-1 text-[11px] text-paper-muted hover:text-paper-terracotta transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>还原</span>
              </button>
            </div>
            <textarea
              value={customQuote}
              onChange={e => setCustomQuote(e.target.value)}
              rows={2}
              placeholder="输入或裁剪要渲染的金句正文..."
              className="w-full p-2 rounded-lg border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card text-paper-text dark:text-night-text focus:outline-none focus:ring-1 focus:ring-paper-terracotta resize-none"
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                value={customCardNote}
                onChange={e => setCustomCardNote(e.target.value)}
                placeholder="批注/感悟短评..."
                className="px-2.5 py-1.5 rounded-lg border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card text-paper-text dark:text-night-text focus:outline-none focus:ring-1 focus:ring-paper-terracotta"
              />
              <input
                type="text"
                value={customBookTitle}
                onChange={e => setCustomBookTitle(e.target.value)}
                placeholder="书籍标题..."
                className="px-2.5 py-1.5 rounded-lg border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card text-paper-text dark:text-night-text focus:outline-none focus:ring-1 focus:ring-paper-terracotta"
              />
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={customAuthor}
                  onChange={e => setCustomAuthor(e.target.value)}
                  placeholder="作者"
                  className="w-1/2 px-2 py-1.5 rounded-lg border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card text-paper-text dark:text-night-text focus:outline-none focus:ring-1 focus:ring-paper-terracotta"
                />
                <input
                  type="text"
                  value={customWatermark}
                  onChange={e => setCustomWatermark(e.target.value)}
                  placeholder="角标"
                  className="w-1/2 px-2 py-1.5 rounded-lg border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card text-paper-text dark:text-night-text focus:outline-none focus:ring-1 focus:ring-paper-terracotta"
                />
              </div>
            </div>
          </div>
        )}

        {/* 卡片预览生成容器 */}
        <div className="flex justify-center p-4 bg-paper-drawer/60 dark:bg-night-drawer/60 rounded-xl overflow-hidden">
          <div
            ref={cardRef}
            data-testid="quote-card-preview"
            className={`w-[440px] p-8 rounded-xl border ${currentTheme.border} ${currentTheme.bg} shadow-md flex flex-col justify-between`}
          >
            <div>
              <div className="text-2xl font-serif leading-none mb-4 opacity-30 select-none">“</div>
              <blockquote className={`font-serif text-[17px] leading-relaxed tracking-wide ${currentTheme.text} mb-6 whitespace-pre-line`}>
                {customQuote}
              </blockquote>

              {showNote && customCardNote.trim() && (
                <div
                  data-testid="quote-card-note"
                  className={`p-3 rounded-lg bg-black/5 text-xs ${currentTheme.subText} mb-6 leading-normal`}
                >
                  {customCardNote}
                </div>
              )}
            </div>

            <div className={`pt-4 border-t ${currentTheme.border} flex items-center justify-between text-xs`}>
              <div>
                <p className={`font-serif font-bold ${currentTheme.text}`}>{customBookTitle}</p>
                <p className={currentTheme.subText}>{customAuthor || '未知作者'}</p>
              </div>
              <span className={`text-[10px] uppercase tracking-widest ${currentTheme.subText}`}>{customWatermark || 'BookEcho'}</span>
            </div>
          </div>
        </div>

        {/* 底部导出操作 */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={handleCopyImage}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-paper-border dark:border-night-border bg-white dark:bg-night-card text-xs font-medium text-paper-text dark:text-night-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            {isCopied ? <Check className="w-4 h-4 text-green-600 dark:text-green-400" /> : <Copy className="w-4 h-4" />}
            <span>{isCopied ? '已复制到剪贴板' : '复制高清卡片'}</span>
          </button>
          <button
            onClick={handleDownloadImage}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-paper-terracotta dark:bg-night-terracotta text-white text-xs font-medium hover:opacity-95 shadow-sm transition-opacity"
          >
            <Download className="w-4 h-4" />
            <span>保存 PNG 图片</span>
          </button>
        </div>
      </div>
    </div>
  );
};
