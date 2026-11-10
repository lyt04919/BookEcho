import React, { useState, useEffect } from 'react';
import { X, FileText, CheckCircle2 } from 'lucide-react';

export interface ExportModalProps {
  bookTitle: string;
  onClose: () => void;
  onConfirmExport: (format: 'standard' | 'obsidian') => Promise<void>;
}

export const ExportModal: React.FC<ExportModalProps> = ({ bookTitle, onClose, onConfirmExport }) => {
  const [format, setFormat] = useState<'standard' | 'obsidian'>('obsidian');
  const [isExporting, setIsExporting] = useState(false);

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

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await onConfirmExport(format);
    } finally {
      setIsExporting(false);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      data-testid="export-modal"
      onClick={onClose}
    >
      <div
        className="bg-paper-card dark:bg-night-card border border-paper-border dark:border-night-border rounded-2xl w-full max-w-md p-6 shadow-xl space-y-6 text-paper-text dark:text-night-text"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-paper-border dark:border-night-border">
          <h3 className="font-serif text-lg font-bold text-paper-text dark:text-night-text">导出 Markdown 笔记</h3>
          <button
            onClick={onClose}
            className="p-1 rounded text-paper-muted dark:text-night-muted hover:text-paper-text dark:hover:text-night-text transition-colors"
            aria-label="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <p className="text-xs text-paper-muted dark:text-night-muted">
            正在导出《{bookTitle}》的全部高亮、批注与延伸思考：
          </p>

          <label
            onClick={() => setFormat('obsidian')}
            data-testid="format-obsidian-option"
            className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
              format === 'obsidian'
                ? 'border-paper-terracotta dark:border-night-terracotta bg-paper-drawer dark:bg-night-drawer'
                : 'border-paper-border dark:border-night-border bg-white dark:bg-night-card hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <CheckCircle2
              className={`w-4 h-4 mt-0.5 ${
                format === 'obsidian'
                  ? 'text-paper-terracotta dark:text-night-terracotta'
                  : 'text-paper-muted dark:text-night-muted'
              }`}
            />
            <div>
              <p className="text-xs font-semibold text-paper-text dark:text-night-text">
                Obsidian 知识库增强格式（推荐）
              </p>
              <p className="text-[11px] text-paper-muted dark:text-night-muted mt-0.5">
                包含 YAML Frontmatter 标头、[!quote] Callout 色彩语义高亮块，无缝融入个人双链网状知识库。
              </p>
            </div>
          </label>

          <label
            onClick={() => setFormat('standard')}
            data-testid="format-standard-option"
            className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
              format === 'standard'
                ? 'border-paper-terracotta dark:border-night-terracotta bg-paper-drawer dark:bg-night-drawer'
                : 'border-paper-border dark:border-night-border bg-white dark:bg-night-card hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <CheckCircle2
              className={`w-4 h-4 mt-0.5 ${
                format === 'standard'
                  ? 'text-paper-terracotta dark:text-night-terracotta'
                  : 'text-paper-muted dark:text-night-muted'
              }`}
            />
            <div>
              <p className="text-xs font-semibold text-paper-text dark:text-night-text">
                标准通用精排 Markdown
              </p>
              <p className="text-[11px] text-paper-muted dark:text-night-muted mt-0.5">
                通用语法，兼容 Notion、Typora、GitHub 与常见博客平台，无任何扩展语法依赖。
              </p>
            </div>
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-paper-muted dark:text-night-muted hover:text-paper-text dark:hover:text-night-text transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-paper-terracotta dark:bg-night-terracotta text-white text-xs font-medium hover:opacity-95 shadow-sm disabled:opacity-50 transition-opacity"
          >
            <FileText className="w-4 h-4" />
            <span>{isExporting ? '导出中...' : '选择位置并保存'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
