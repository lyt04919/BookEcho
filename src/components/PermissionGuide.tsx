import type { FC } from 'react';
import { ShieldAlert, FolderOpen, RefreshCw, ExternalLink } from 'lucide-react';

export interface PermissionGuideProps {
  onSelectDir: () => void;
  onRetry: () => void;
  onOpenPrivacy?: () => void;
}

export const PermissionGuide: FC<PermissionGuideProps> = ({ onSelectDir, onRetry, onOpenPrivacy }) => {
  const handleOpenPrivacy = () => {
    if (onOpenPrivacy) {
      onOpenPrivacy();
    } else if (typeof window !== 'undefined' && window.bookEchoAPI?.openSystemPrivacySettings) {
      window.bookEchoAPI.openSystemPrivacySettings();
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-paper-bg dark:bg-night-bg text-center">
      <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 mb-4">
        <ShieldAlert className="w-8 h-8" />
      </div>
      <h2 className="font-serif text-2xl font-bold text-paper-text dark:text-night-text mb-2">需要 Apple Books 数据读取权限</h2>
      <p className="text-sm text-paper-muted dark:text-night-muted max-w-md mb-6 leading-relaxed">
        macOS 对 Apple Books 容器（<code>~/Library/Containers/com.apple.iBooksX</code>）进行了系统沙盒隔离。你可以通过以下任意一种方式继续：
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={onSelectDir}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-paper-terracotta text-white text-sm font-medium shadow-sm hover:opacity-95 transition-opacity"
        >
          <FolderOpen className="w-4 h-4" />
          <span>手动选择 iBooks 目录或备份</span>
        </button>

        <button
          onClick={handleOpenPrivacy}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-paper-border dark:border-night-border bg-white dark:bg-night-card text-sm font-medium text-paper-text dark:text-night-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          <span>打开系统隐私设置</span>
        </button>

        <button
          onClick={onRetry}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-paper-border dark:border-night-border bg-white dark:bg-night-card text-sm font-medium text-paper-text dark:text-night-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>重新检测系统权限</span>
        </button>
      </div>
    </div>
  );
};
