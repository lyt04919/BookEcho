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
      <p className="text-sm text-paper-muted dark:text-night-muted max-w-lg mb-5 leading-relaxed">
        macOS 对 Apple Books 容器（<code className="px-1 py-0.5 rounded bg-black/5 dark:bg-white/10 text-xs">~/Library/Containers/com.apple.iBooksX</code>）进行了系统沙盒隔离；由于系统安全机制，<strong>“完全磁盘访问权限”列表不会自动弹出或自动添加新软件</strong>，需要按以下三步手动授权：
      </p>

      <ol className="w-full max-w-lg text-left rounded-xl border border-paper-border dark:border-night-border bg-white/80 dark:bg-night-card/70 px-5 py-4 mb-6 space-y-2.5 text-xs sm:text-sm text-paper-text/90 dark:text-night-text/90 leading-relaxed shadow-sm">
        <li className="flex gap-2.5">
          <span className="shrink-0 w-5 h-5 rounded-full bg-paper-terracotta/15 text-paper-terracotta font-semibold text-xs flex items-center justify-center mt-0.5">1</span>
          <span>确认已将 <code className="px-1 py-0.5 rounded bg-black/5 dark:bg-white/10 text-xs">BookEcho.app</code> 放入 <strong>应用程序（/Applications）</strong> 文件夹。</span>
        </li>
        <li className="flex gap-2.5">
          <span className="shrink-0 w-5 h-5 rounded-full bg-paper-terracotta/15 text-paper-terracotta font-semibold text-xs flex items-center justify-center mt-0.5">2</span>
          <span>点击下方「打开系统隐私设置」，在列表<strong>左下角点击 <kbd className="px-1.5 py-0.5 rounded border border-paper-border dark:border-night-border bg-paper-bg dark:bg-night-bg font-mono text-xs">+</kbd> 按钮</strong>，手动选中 <code className="px-1 py-0.5 rounded bg-black/5 dark:bg-white/10 text-xs">应用程序 → BookEcho.app</code> 并开启开关。</span>
        </li>
        <li className="flex gap-2.5">
          <span className="shrink-0 w-5 h-5 rounded-full bg-paper-terracotta/15 text-paper-terracotta font-semibold text-xs flex items-center justify-center mt-0.5">3</span>
          <span>开启后<strong>完全退出并重新打开 BookEcho</strong> 即可自动同步；若暂不授予全局权限，也可点击「手动选择 iBooks 目录或备份」。</span>
        </li>
      </ol>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleOpenPrivacy}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-paper-terracotta text-white text-sm font-medium shadow-sm hover:opacity-95 transition-opacity"
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

        <button
          onClick={onSelectDir}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-paper-border dark:border-night-border bg-white dark:bg-night-card text-sm font-medium text-paper-text dark:text-night-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        >
          <FolderOpen className="w-4 h-4" />
          <span>手动选择 iBooks 目录或备份</span>
        </button>
      </div>
    </div>
  );
};
