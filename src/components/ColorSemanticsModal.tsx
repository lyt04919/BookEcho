import React, { useState, useEffect, useMemo } from 'react';
import { AnnotationItem, ColorSemanticConfig, HighlightColor } from '../../electron/types/ipc';
import { X, Palette, RotateCcw, Check, Sparkles } from 'lucide-react';

export interface ColorSemanticsModalProps {
  colorSemantics: ColorSemanticConfig[];
  annotations?: AnnotationItem[];
  onSave: (updated: ColorSemanticConfig[]) => Promise<void> | void;
  onClose: () => void;
}

export const DEFAULT_COLOR_SEMANTICS: ColorSemanticConfig[] = [
  { colorKey: 'yellow', label: '核心论点', hexColor: '#F5A623' },
  { colorKey: 'green', label: '行动与实践', hexColor: '#5CB85C' },
  { colorKey: 'blue', label: '概念与背景', hexColor: '#4A90E2' },
  { colorKey: 'pink', label: '灵感与金句', hexColor: '#E86F88' },
  { colorKey: 'purple', label: '存疑与深思', hexColor: '#9B6B9E' },
  { colorKey: 'underline', label: '重点下划线', hexColor: '#D9534F' }
];

const COLOR_NATIVE_META: Record<HighlightColor, { nativeName: string; desc: string }> = {
  yellow: { nativeName: '黄色高亮', desc: 'Apple Books 默认主高亮色' },
  green: { nativeName: '绿色高亮', desc: '常用于实践与方法论' },
  blue: { nativeName: '蓝色高亮', desc: '常用于概念与背景资料' },
  pink: { nativeName: '粉色高亮', desc: '常用于金句与情感共鸣' },
  purple: { nativeName: '紫色高亮', desc: '常用于质疑与延伸思考' },
  underline: { nativeName: '红色下划线', desc: '重点标注或关键转折' }
};

export const SEMANTIC_PRESETS: {
  id: string;
  name: string;
  description: string;
  labels: Record<HighlightColor, string>;
}[] = [
  {
    id: 'default',
    name: '经典精读流',
    description: '兼顾论点提炼、实践落地与深度反思',
    labels: {
      yellow: '核心论点',
      green: '行动与实践',
      blue: '概念与背景',
      pink: '灵感与金句',
      purple: '存疑与深思',
      underline: '重点下划线'
    }
  },
  {
    id: 'zettelkasten',
    name: '卡片盒写作流',
    description: '面向输出与知识卡片拆解（Zettelkasten）',
    labels: {
      yellow: '永久观点',
      green: '方法拆解',
      blue: '事实数据',
      pink: '精彩金句',
      purple: '反驳与质疑',
      underline: '待核实考证'
    }
  },
  {
    id: 'language',
    name: '外语精学流',
    description: '适合英文原版与外语精读词汇句法归类',
    labels: {
      yellow: '核心生词',
      green: '地道搭配',
      blue: '语法句型',
      pink: '精彩修辞',
      purple: '文化背景',
      underline: '易错难点'
    }
  }
];

export const ColorSemanticsModal: React.FC<ColorSemanticsModalProps> = ({
  colorSemantics,
  annotations = [],
  onSave,
  onClose
}) => {
  const [draft, setDraft] = useState<ColorSemanticConfig[]>(() =>
    DEFAULT_COLOR_SEMANTICS.map(def => {
      const existing = colorSemantics.find(c => c.colorKey === def.colorKey);
      return existing ? { ...existing } : { ...def };
    })
  );
  const [isSaving, setIsSaving] = useState(false);

  // 统计每种颜色当前在书库中的数量
  const colorCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of annotations) {
      counts[a.colorKey] = (counts[a.colorKey] || 0) + 1;
    }
    return counts;
  }, [annotations]);

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

  const handleLabelChange = (colorKey: HighlightColor, label: string) => {
    setDraft(prev => prev.map(item => (item.colorKey === colorKey ? { ...item, label } : item)));
  };

  const handleColorChange = (colorKey: HighlightColor, hexColor: string) => {
    setDraft(prev => prev.map(item => (item.colorKey === colorKey ? { ...item, hexColor } : item)));
  };

  const handleApplyPreset = (presetId: string) => {
    const preset = SEMANTIC_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    setDraft(prev =>
      prev.map(item => ({
        ...item,
        label: preset.labels[item.colorKey] || item.label
      }))
    );
  };

  const handleResetDefault = () => {
    setDraft(DEFAULT_COLOR_SEMANTICS.map(d => ({ ...d })));
  };

  const hasEmptyLabel = draft.some(d => !d.label.trim());

  const handleSave = async () => {
    if (hasEmptyLabel || isSaving) return;
    setIsSaving(true);
    try {
      const normalized = draft.map(item => ({
        ...item,
        label: item.label.trim()
      }));
      await onSave(normalized);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="color-semantics-modal-title"
      data-testid="color-semantics-modal"
    >
      <div
        className="bg-paper-card dark:bg-night-card border border-paper-border dark:border-night-border rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden text-paper-text dark:text-night-text animate-in zoom-in-95 duration-150 max-h-[88vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* 顶部标题区 */}
        <div className="px-6 py-4 border-b border-paper-border dark:border-night-border flex items-center justify-between bg-paper-sidebar/40 dark:bg-night-sidebar/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-paper-terracotta/15 dark:bg-night-terracotta/15 text-paper-terracotta dark:text-night-terracotta flex items-center justify-center">
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <h3 id="color-semantics-modal-title" className="font-serif text-base font-bold">
                高亮颜色语义自定义
              </h3>
              <p className="text-xs text-paper-muted dark:text-night-muted">
                自由定义每种颜色在笔记体系中代表的含义与视觉色彩，全书库即时生效
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-paper-muted dark:text-night-muted hover:text-paper-text dark:hover:text-night-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            aria-label="关闭颜色配置"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 主体编辑区 */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* 预设阅读流派模板快捷区 */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-paper-muted dark:text-night-muted">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>一键套用阅读方法论模板（可再单独微调）：</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {SEMANTIC_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleApplyPreset(preset.id)}
                  className="text-left p-2.5 rounded-xl border border-paper-border dark:border-night-border bg-paper-drawer/50 dark:bg-night-drawer/50 hover:border-paper-terracotta dark:hover:border-night-terracotta hover:bg-paper-terracotta/5 transition-all group"
                >
                  <div className="text-xs font-semibold text-paper-text dark:text-night-text group-hover:text-paper-terracotta dark:group-hover:text-night-terracotta">
                    {preset.name}
                  </div>
                  <div className="text-[11px] text-paper-muted dark:text-night-muted mt-0.5 line-clamp-1">
                    {preset.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 6 种颜色逐行可编辑列表 */}
          <div className="space-y-2.5">
            {draft.map(item => {
              const meta = COLOR_NATIVE_META[item.colorKey];
              const count = colorCounts[item.colorKey] || 0;
              return (
                <div
                  key={item.colorKey}
                  className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 p-3 rounded-xl border border-paper-border/80 dark:border-night-border/80 bg-paper-sidebar/25 dark:bg-night-sidebar/25 hover:border-paper-border transition-colors"
                >
                  {/* 左侧：原生颜色信息与拾色器 */}
                  <div className="flex items-center gap-3 min-w-[180px]">
                    <label
                      className="relative w-7 h-7 rounded-full cursor-pointer shadow-xs flex-shrink-0 ring-2 ring-white dark:ring-night-card transition-transform hover:scale-105"
                      style={{ backgroundColor: item.hexColor }}
                      title="点击自定义此语义对应的显示颜色"
                    >
                      <input
                        type="color"
                        value={item.hexColor}
                        onChange={e => handleColorChange(item.colorKey, e.target.value)}
                        className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                        aria-label={`修改 ${meta.nativeName} 的显示色值`}
                      />
                    </label>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-paper-text dark:text-night-text">
                          {meta.nativeName}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-paper-drawer dark:bg-night-drawer text-paper-muted dark:text-night-muted font-mono">
                          {count} 条
                        </span>
                      </div>
                      <p className="text-[11px] text-paper-muted dark:text-night-muted">
                        {meta.desc}
                      </p>
                    </div>
                  </div>

                  {/* 右侧：预览胶囊与可编辑语义输入 */}
                  <div className="flex items-center gap-2.5 flex-1 justify-end w-full sm:w-auto">
                    <span
                      className="px-2 py-0.5 rounded text-[11px] font-medium flex-shrink-0 max-w-[100px] truncate"
                      style={{
                        backgroundColor: `${item.hexColor}20`,
                        color: item.hexColor
                      }}
                    >
                      {item.label.trim() || '未命名'}
                    </span>

                    <input
                      type="text"
                      value={item.label}
                      maxLength={16}
                      onChange={e => handleLabelChange(item.colorKey, e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleSave();
                      }}
                      placeholder="输入含义名称..."
                      aria-label={`${meta.nativeName} 代表含义`}
                      className="w-full sm:w-44 px-3 py-1.5 text-xs rounded-lg border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card text-paper-text dark:text-night-text focus:outline-none focus:ring-1 focus:ring-paper-terracotta dark:focus:ring-night-terracotta"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 底部操作条 */}
        <div className="px-6 py-3.5 border-t border-paper-border dark:border-night-border flex items-center justify-between bg-paper-sidebar/20 dark:bg-night-sidebar/20">
          <button
            type="button"
            onClick={handleResetDefault}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-paper-muted dark:text-night-muted hover:text-paper-text dark:hover:text-night-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>恢复系统默认</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-xs text-paper-muted dark:text-night-muted hover:text-paper-text dark:hover:text-night-text transition-colors"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={hasEmptyLabel || isSaving}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-paper-terracotta dark:bg-night-terracotta text-white text-xs font-medium hover:opacity-90 disabled:opacity-40 transition-opacity shadow-2xs"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSaving ? '保存中...' : '保存并应用'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
