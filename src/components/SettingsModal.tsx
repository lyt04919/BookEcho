import React, { useState, useEffect } from 'react';
import {
  X,
  Palette,
  FolderOpen,
  RotateCcw,
  Sparkles,
  Sliders,
  FileText,
  Info,
  ExternalLink,
  Check,
  HardDrive,
  Sun,
  Moon
} from 'lucide-react';
import { ColorSemanticConfig, HighlightColor } from '../../electron/types/ipc';
import { DEFAULT_COLOR_SEMANTICS, SEMANTIC_PRESETS } from './ColorSemanticsModal';

export type SettingsTabId = 'general' | 'highlights' | 'storage' | 'export' | 'about';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: SettingsTabId;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  colorSemantics: ColorSemanticConfig[];
  onSaveColorSemantics: (updated: ColorSemanticConfig[]) => Promise<void> | void;
  customDataDir?: string | null;
  onSelectCustomDir: () => Promise<void> | void;
  onResetCustomDir?: () => Promise<void> | void;
  isDemoMode: boolean;
  onToggleDemoMode?: () => void;
  exportFormat?: 'standard' | 'obsidian';
  onUpdateExportFormat?: (format: 'standard' | 'obsidian') => void;
}

const COLOR_NATIVE_META: Record<HighlightColor, { nativeName: string; desc: string }> = {
  yellow: { nativeName: '黄色高亮', desc: 'Apple Books 默认主高亮色' },
  green: { nativeName: '绿色高亮', desc: '常用于实践与方法论' },
  blue: { nativeName: '蓝色高亮', desc: '常用于概念与背景资料' },
  pink: { nativeName: '粉色高亮', desc: '常用于金句与情感共鸣' },
  purple: { nativeName: '紫色高亮', desc: '常用于质疑与延伸思考' },
  underline: { nativeName: '红色下划线', desc: '重点标注或关键转折' }
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'general',
  isDarkMode,
  onToggleDarkMode,
  colorSemantics,
  onSaveColorSemantics,
  customDataDir = null,
  onSelectCustomDir,
  onResetCustomDir,
  isDemoMode,
  onToggleDemoMode,
  exportFormat = 'obsidian',
  onUpdateExportFormat
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTabId>(initialTab);
  const [colorDraft, setColorDraft] = useState<ColorSemanticConfig[]>(() =>
    DEFAULT_COLOR_SEMANTICS.map(def => {
      const existing = colorSemantics.find(c => c.colorKey === def.colorKey);
      return existing ? { ...existing } : { ...def };
    })
  );
  const [isColorSaved, setIsColorSaved] = useState(false);
  const [copiedGithub, setCopiedGithub] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setColorDraft(
        DEFAULT_COLOR_SEMANTICS.map(def => {
          const existing = colorSemantics.find(c => c.colorKey === def.colorKey);
          return existing ? { ...existing } : { ...def };
        })
      );
    }
  }, [isOpen, initialTab, colorSemantics]);

  // 支持按下 Escape 键关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleUpdateLabel = (colorKey: HighlightColor, label: string) => {
    setColorDraft(prev => prev.map(c => (c.colorKey === colorKey ? { ...c, label } : c)));
  };

  const handleUpdateHex = (colorKey: HighlightColor, hexColor: string) => {
    setColorDraft(prev => prev.map(c => (c.colorKey === colorKey ? { ...c, hexColor } : c)));
  };

  const handleApplyPreset = (presetId: string) => {
    const preset = SEMANTIC_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    setColorDraft(prev =>
      prev.map(c => ({
        ...c,
        label: preset.labels[c.colorKey] || c.label
      }))
    );
  };

  const handleResetColors = () => {
    setColorDraft(DEFAULT_COLOR_SEMANTICS.map(c => ({ ...c })));
  };

  const handleSaveColors = async () => {
    await onSaveColorSemantics(colorDraft);
    setIsColorSaved(true);
    setTimeout(() => setIsColorSaved(false), 1800);
  };

  const handleCopyGithub = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText('https://github.com/lyt04919/BookEcho');
      setCopiedGithub(true);
      setTimeout(() => setCopiedGithub(false), 2000);
    }
  };

  return (
    <div
      data-testid="settings-modal"
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-paper-card dark:bg-night-card border border-paper-border dark:border-night-border w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-[580px] max-h-[90vh]">
        {/* 左侧垂直 Tab 栏 */}
        <aside className="w-full md:w-52 bg-paper-drawer dark:bg-night-drawer border-b md:border-b-0 md:border-r border-paper-border dark:border-night-border p-4 flex flex-col justify-between flex-shrink-0">
          <div className="space-y-1">
            <div className="px-3 py-2 text-xs font-semibold text-paper-muted dark:text-night-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-paper-terracotta dark:text-night-terracotta" />
              <span>偏好设置</span>
            </div>

            <button
              onClick={() => setActiveTab('general')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'general'
                  ? 'bg-white dark:bg-night-card text-paper-terracotta dark:text-night-terracotta shadow-2xs'
                  : 'text-paper-muted dark:text-night-muted hover:text-paper-text dark:hover:text-night-text hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>外观与偏好</span>
            </button>

            <button
              onClick={() => setActiveTab('highlights')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'highlights'
                  ? 'bg-white dark:bg-night-card text-paper-terracotta dark:text-night-terracotta shadow-2xs'
                  : 'text-paper-muted dark:text-night-muted hover:text-paper-text dark:hover:text-night-text hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <Palette className="w-4 h-4" />
              <span>高亮色彩语义</span>
            </button>

            <button
              onClick={() => setActiveTab('storage')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'storage'
                  ? 'bg-white dark:bg-night-card text-paper-terracotta dark:text-night-terracotta shadow-2xs'
                  : 'text-paper-muted dark:text-night-muted hover:text-paper-text dark:hover:text-night-text hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <HardDrive className="w-4 h-4" />
              <span>数据源与同步</span>
            </button>

            <button
              onClick={() => setActiveTab('export')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'export'
                  ? 'bg-white dark:bg-night-card text-paper-terracotta dark:text-night-terracotta shadow-2xs'
                  : 'text-paper-muted dark:text-night-muted hover:text-paper-text dark:hover:text-night-text hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Markdown 导出</span>
            </button>

            <button
              onClick={() => setActiveTab('about')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'about'
                  ? 'bg-white dark:bg-night-card text-paper-terracotta dark:text-night-terracotta shadow-2xs'
                  : 'text-paper-muted dark:text-night-muted hover:text-paper-text dark:hover:text-night-text hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <Info className="w-4 h-4" />
              <span>关于 BookEcho</span>
            </button>
          </div>

          <div className="pt-2 text-[11px] text-paper-muted/70 dark:text-night-muted/70 px-3 hidden md:block">
            按 <kbd className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 font-mono text-[10px]">Esc</kbd> 退出
          </div>
        </aside>

        {/* 右侧设置详情面板 */}
        <section className="flex-1 flex flex-col min-w-0 bg-paper-card dark:bg-night-card overflow-hidden">
          {/* 顶栏 */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-paper-border dark:border-night-border flex-shrink-0">
            <h2 className="font-serif text-base font-bold text-paper-text dark:text-night-text">
              {activeTab === 'general' && '外观与偏好'}
              {activeTab === 'highlights' && '高亮色彩语义配置'}
              {activeTab === 'storage' && '数据源与本地存储'}
              {activeTab === 'export' && 'Markdown 导出配置'}
              {activeTab === 'about' && '关于 BookEcho'}
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-paper-muted dark:text-night-muted hover:bg-black/5 dark:hover:bg-white/5 hover:text-paper-text dark:hover:text-night-text transition-colors"
              aria-label="关闭设置面板"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 内容区 */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Tab 1: 外观与偏好 */}
            {activeTab === 'general' && (
              <div className="space-y-6">
                <div>
                  <label className="text-xs font-semibold text-paper-text dark:text-night-text block mb-2">
                    界面主题外观
                  </label>
                  <div className="grid grid-cols-2 gap-3 max-w-md">
                    <button
                      onClick={() => {
                        if (isDarkMode) onToggleDarkMode();
                      }}
                      className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left ${
                        !isDarkMode
                          ? 'border-paper-terracotta bg-paper-terracotta/5 text-paper-text shadow-xs'
                          : 'border-paper-border dark:border-night-border hover:bg-black/5 dark:hover:bg-white/5 text-paper-muted'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-600">
                        <Sun className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold">浅色羊皮纸</div>
                        <div className="text-[11px] text-paper-muted">温润柔和纸张质感</div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        if (!isDarkMode) onToggleDarkMode();
                      }}
                      className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left ${
                        isDarkMode
                          ? 'border-night-terracotta bg-night-terracotta/10 text-night-text shadow-xs'
                          : 'border-paper-border dark:border-night-border hover:bg-black/5 dark:hover:bg-white/5 text-paper-muted'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center text-amber-400">
                        <Moon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold">深色夜读</div>
                        <div className="text-[11px] text-paper-muted dark:text-night-muted">沉浸静心夜读模式</div>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-paper-border dark:border-night-border">
                  <label className="text-xs font-semibold text-paper-text dark:text-night-text block mb-2">
                    快捷键指引
                  </label>
                  <div className="space-y-2 max-w-md text-xs text-paper-muted dark:text-night-muted">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-paper-drawer dark:bg-night-drawer">
                      <span>打开偏好设置</span>
                      <kbd className="px-2 py-0.5 rounded bg-white dark:bg-night-card border border-paper-border dark:border-night-border font-mono text-[11px]">
                        ⌘ ,
                      </kbd>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-paper-drawer dark:bg-night-drawer">
                      <span>关闭当前弹窗</span>
                      <kbd className="px-2 py-0.5 rounded bg-white dark:bg-night-card border border-paper-border dark:border-night-border font-mono text-[11px]">
                        Esc
                      </kbd>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: 高亮色彩语义 */}
            {activeTab === 'highlights' && (
              <div className="space-y-5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="text-xs text-paper-muted dark:text-night-muted">
                    为 Apple Books 中的划线色彩赋予思考维度标签与色彩映射：
                  </p>
                  <div className="flex items-center gap-1.5">
                    {SEMANTIC_PRESETS.map(preset => (
                      <button
                        key={preset.id}
                        onClick={() => handleApplyPreset(preset.id)}
                        className="px-2.5 py-1 text-[11px] rounded-md bg-paper-drawer dark:bg-night-drawer hover:bg-paper-terracotta/10 hover:text-paper-terracotta text-paper-muted dark:text-night-muted transition-colors"
                        title={preset.description}
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2.5">
                  {colorDraft.map(item => {
                    const meta = COLOR_NATIVE_META[item.colorKey];
                    return (
                      <div
                        key={item.colorKey}
                        className="flex items-center gap-3 p-2.5 rounded-xl border border-paper-border dark:border-night-border bg-paper-drawer/40 dark:bg-night-drawer/40"
                      >
                        <div
                          className="w-4 h-4 rounded-full flex-shrink-0 shadow-xs border border-black/10"
                          style={{ backgroundColor: item.hexColor }}
                        />
                        <div className="w-24 flex-shrink-0">
                          <span className="text-xs font-semibold text-paper-text dark:text-night-text block">
                            {meta?.nativeName || item.colorKey}
                          </span>
                          <span className="text-[10px] text-paper-muted dark:text-night-muted">
                            {item.colorKey}
                          </span>
                        </div>
                        <input
                          type="text"
                          value={item.label}
                          onChange={e => handleUpdateLabel(item.colorKey, e.target.value)}
                          placeholder="输入含义标签..."
                          className="flex-1 px-2.5 py-1 rounded-md text-xs border border-paper-border dark:border-night-border bg-white dark:bg-night-card text-paper-text dark:text-night-text focus:outline-none focus:ring-1 focus:ring-paper-terracotta"
                        />
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <input
                            type="color"
                            value={item.hexColor}
                            onChange={e => handleUpdateHex(item.colorKey, e.target.value)}
                            className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                            title="自定义取色"
                          />
                          <span className="text-[11px] font-mono text-paper-muted w-14">
                            {item.hexColor}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={handleResetColors}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-paper-muted hover:text-paper-text dark:hover:text-night-text transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>恢复默认预设</span>
                  </button>
                  <button
                    onClick={handleSaveColors}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-paper-terracotta dark:bg-night-terracotta text-white text-xs font-medium shadow-sm hover:opacity-95 transition-all"
                  >
                    {isColorSaved ? <Check className="w-3.5 h-3.5" /> : null}
                    <span>{isColorSaved ? '保存成功' : '应用色彩设置'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Tab 3: 数据源与同步 */}
            {activeTab === 'storage' && (
              <div className="space-y-6">
                <div>
                  <label className="text-xs font-semibold text-paper-text dark:text-night-text block mb-1.5">
                    Apple Books 数据源目录
                  </label>
                  <p className="text-xs text-paper-muted dark:text-night-muted mb-3 leading-relaxed">
                    BookEcho 默认以只读安全方式从 macOS 系统原生的 Apple Books Containers 提取划线与书籍元数据。
                  </p>
                  <div className="p-3 rounded-xl border border-paper-border dark:border-night-border bg-paper-drawer dark:bg-night-drawer space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono text-paper-muted dark:text-night-muted truncate max-w-sm">
                        {customDataDir || '系统默认：~/Library/Containers/com.apple.iBooksX/...'}
                      </span>
                      {customDataDir ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">
                          自定义备份
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                          系统原生默认
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={onSelectCustomDir}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-night-card border border-paper-border dark:border-night-border text-xs text-paper-text dark:text-night-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        <span>更换数据源目录</span>
                      </button>
                      {customDataDir && onResetCustomDir && (
                        <button
                          onClick={onResetCustomDir}
                          className="px-3 py-1.5 rounded-lg text-xs text-paper-muted hover:text-paper-terracotta transition-colors"
                        >
                          恢复系统默认路径
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {onToggleDemoMode && (
                  <div className="pt-4 border-t border-paper-border dark:border-night-border">
                    <label className="text-xs font-semibold text-paper-text dark:text-night-text block mb-1.5">
                      体验测试数据 (Demo Mode)
                    </label>
                    <p className="text-xs text-paper-muted dark:text-night-muted mb-3 leading-relaxed">
                      一键载入《原则》《纳瓦尔宝典》《反脆弱》等精选书籍与跨书知识网络样本，便于快速体验全部功能。
                    </p>
                    <div className="flex items-center justify-between p-3 rounded-xl border border-paper-border dark:border-night-border bg-paper-drawer dark:bg-night-drawer">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        <span className="text-xs font-medium text-paper-text dark:text-night-text">
                          当前状态：{isDemoMode ? '体验模式运行中' : '使用原生真实数据'}
                        </span>
                      </div>
                      <button
                        onClick={onToggleDemoMode}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          isDemoMode
                            ? 'bg-amber-500 text-white'
                            : 'bg-paper-terracotta dark:bg-night-terracotta text-white'
                        }`}
                      >
                        {isDemoMode ? '切回原生真实数据' : '载入体验数据'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 4: 导出配置 */}
            {activeTab === 'export' && (
              <div className="space-y-6">
                <div>
                  <label className="text-xs font-semibold text-paper-text dark:text-night-text block mb-1.5">
                    Markdown 导出格式偏好
                  </label>
                  <p className="text-xs text-paper-muted dark:text-night-muted mb-3">
                    导出整书或精选星标为 Markdown 时所采用的卡片与引用语法：
                  </p>
                  <div className="space-y-3 max-w-md">
                    <label
                      className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                        exportFormat === 'obsidian'
                          ? 'border-paper-terracotta bg-paper-terracotta/5'
                          : 'border-paper-border dark:border-night-border'
                      }`}
                    >
                      <input
                        type="radio"
                        name="exportFormat"
                        checked={exportFormat === 'obsidian'}
                        onChange={() => onUpdateExportFormat && onUpdateExportFormat('obsidian')}
                        className="mt-0.5"
                      />
                      <div>
                        <div className="text-xs font-semibold text-paper-text dark:text-night-text">
                          Obsidian 增强格式（推荐）
                        </div>
                        <div className="text-[11px] text-paper-muted dark:text-night-muted mt-0.5">
                          采用 `&gt; [!quote]` Callout 块引用卡片，天然兼容 Obsidian、Logseq、Notion
                        </div>
                      </div>
                    </label>

                    <label
                      className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                        exportFormat === 'standard'
                          ? 'border-paper-terracotta bg-paper-terracotta/5'
                          : 'border-paper-border dark:border-night-border'
                      }`}
                    >
                      <input
                        type="radio"
                        name="exportFormat"
                        checked={exportFormat === 'standard'}
                        onChange={() => onUpdateExportFormat && onUpdateExportFormat('standard')}
                        className="mt-0.5"
                      />
                      <div>
                        <div className="text-xs font-semibold text-paper-text dark:text-night-text">
                          标准 Markdown 引用格式
                        </div>
                        <div className="text-[11px] text-paper-muted dark:text-night-muted mt-0.5">
                          采用通用的 `&gt; ` 标准引用语法，可在任何基础 Markdown 编辑器中无差别渲染
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 5: 关于 */}
            {activeTab === 'about' && (
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-paper-terracotta/10 dark:bg-night-terracotta/20 border border-paper-terracotta/30 flex items-center justify-center font-serif text-xl font-bold text-paper-terracotta dark:text-night-terracotta">
                    BE
                  </div>
                  <div>
                    <h3 className="font-serif text-lg font-bold text-paper-text dark:text-night-text">
                      BookEcho
                    </h3>
                    <p className="text-xs text-paper-muted dark:text-night-muted">
                      个人读书精华馆 · 深度阅读沉淀工具
                    </p>
                    <span className="text-[11px] font-mono text-paper-muted/80">v1.0.0</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-paper-border dark:border-night-border bg-paper-drawer dark:bg-night-drawer space-y-2 text-xs text-paper-muted dark:text-night-muted leading-relaxed">
                  <p className="font-medium text-paper-text dark:text-night-text">
                    🔒 本地优先与隐私安全（Local-first）
                  </p>
                  <p>
                    BookEcho 坚守 100% 离线与本地优先原则。所有 Apple Books 的数据库解析、EPUB 原文语境回溯、自定义笔记标签和 SQLite 数据库均严格保存在你的本地 Mac 磁盘上，不依赖任何云端账户，零远程上传。
                  </p>
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    onClick={handleCopyGithub}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-paper-border dark:border-night-border bg-white dark:bg-night-card text-xs text-paper-text dark:text-night-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>{copiedGithub ? '已复制仓库链接' : 'GitHub 仓库'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
