import React, { useState } from 'react';
import { AnnotationItem, ColorSemanticConfig, HighlightContextResult } from '../../electron/types/ipc';
import { Star, MessageSquare, ChevronDown, ChevronUp, Image, Tag, Plus, Check } from 'lucide-react';

export interface HighlightCardProps {
  annotation: AnnotationItem;
  colorSemantics: ColorSemanticConfig[];
  onToggleStar: (uuid: string) => void;
  onUpdateCustomNote: (uuid: string, note: string) => void;
  onAddTag: (uuid: string, tag: string) => void;
  onRemoveTag: (uuid: string, tag: string) => void;
  onOpenQuoteModal: (annotation: AnnotationItem) => void;
  onRequestContext: (annotation: AnnotationItem) => Promise<HighlightContextResult>;
}

export const HighlightCard: React.FC<HighlightCardProps> = ({
  annotation,
  colorSemantics,
  onToggleStar,
  onUpdateCustomNote,
  onAddTag,
  onRemoveTag,
  onOpenQuoteModal,
  onRequestContext
}) => {
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteText, setNoteText] = useState(annotation.customNote || '');
  const [isTagInputOpen, setIsTagInputOpen] = useState(false);
  const [newTagText, setNewTagText] = useState('');
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [isLoadingContext, setIsLoadingContext] = useState(false);
  const [contextData, setContextData] = useState<HighlightContextResult | null>(null);

  const semantic = colorSemantics.find(s => s.colorKey === annotation.colorKey);
  const colorHex = semantic?.hexColor || '#F5A623';

  const handleToggleContext = async () => {
    if (!isContextOpen) {
      setIsContextOpen(true);
      if (!contextData) {
        setIsLoadingContext(true);
        try {
          const res = await onRequestContext(annotation);
          setContextData(res);
        } catch {
          setContextData({
            available: false,
            reason: 'NOT_FOUND',
            beforeParagraphs: [],
            currentParagraph: '',
            selectedText: annotation.selectedText,
            afterParagraphs: []
          });
        } finally {
          setIsLoadingContext(false);
        }
      }
    } else {
      setIsContextOpen(false);
    }
  };

  const handleStartEditNote = () => {
    setNoteText(annotation.customNote || '');
    setIsEditingNote(true);
  };

  const handleSaveNote = () => {
    onUpdateCustomNote(annotation.uuid, noteText);
    setIsEditingNote(false);
  };

  const handleCancelNote = () => {
    setNoteText(annotation.customNote || '');
    setIsEditingNote(false);
  };

  const handleAddTag = () => {
    const cleaned = newTagText.trim().replace(/^#+/, '');
    if (cleaned) {
      onAddTag(annotation.uuid, cleaned);
      setNewTagText('');
      setIsTagInputOpen(false);
    }
  };

  return (
    <div className="bg-paper-card dark:bg-night-card border border-paper-border dark:border-night-border rounded-xl p-5 relative overflow-hidden transition-shadow hover:shadow-sm">
      {/* 左侧 4px 语义色标 */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ backgroundColor: colorHex }}
        data-testid="semantic-color-bar"
      />

      {/* 顶部工具栏：语义胶囊与星标操作 */}
      <div className="flex items-center justify-between mb-3 pl-2">
        <div className="flex items-center gap-2">
          <span
            className="px-2 py-0.5 rounded text-[11px] font-medium"
            style={{ backgroundColor: `${colorHex}20`, color: colorHex }}
          >
            {semantic?.label || '高亮'}
          </span>
          <span className="text-[11px] text-paper-muted dark:text-night-muted">
            {new Date(annotation.creationDateMs).toLocaleDateString('zh-CN')}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onOpenQuoteModal(annotation)}
            className="p-1 rounded text-paper-muted dark:text-night-muted hover:text-paper-terracotta dark:hover:text-night-terracotta hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            title="生成金句卡片"
            aria-label="生成金句卡片"
          >
            <Image className="w-4 h-4" />
          </button>
          <button
            onClick={() => onToggleStar(annotation.uuid)}
            className={`p-1 rounded transition-colors ${
              annotation.isStarred
                ? 'text-amber-500'
                : 'text-paper-muted dark:text-night-muted hover:text-amber-500 hover:bg-black/5 dark:hover:bg-white/5'
            }`}
            title="标记核心重点"
            aria-label={annotation.isStarred ? '取消核心重点' : '标记核心重点'}
          >
            <Star className="w-4 h-4" fill={annotation.isStarred ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>

      {/* 高亮正文（衬线排版） */}
      <blockquote className="pl-2 font-serif text-[16px] leading-relaxed text-paper-text dark:text-night-text tracking-wide mb-3">
        “{annotation.selectedText}”
      </blockquote>

      {/* Apple Books 原生自带批注 */}
      {annotation.note && (
        <div className="ml-2 mb-3 px-3 py-2 rounded-lg bg-paper-sidebar/60 dark:bg-night-sidebar/60 border border-paper-border/60 dark:border-night-border/60 text-xs text-paper-text/90 dark:text-night-text/90">
          <span className="font-semibold text-paper-muted dark:text-night-muted mr-1.5">原文划线想法：</span>
          {annotation.note}
        </div>
      )}

      {/* 用户二次延伸思考 */}
      <div className="ml-2 mb-3">
        {isEditingNote ? (
          <div className="space-y-2">
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="记录你的二次联想与思考..."
              className="w-full text-xs p-2.5 rounded-lg border border-paper-border dark:border-night-border bg-paper-drawer dark:bg-night-drawer text-paper-text dark:text-night-text focus:outline-none focus:ring-1 focus:ring-paper-terracotta dark:focus:ring-night-terracotta resize-none h-20"
              aria-label="二次联想与思考"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={handleCancelNote}
                className="px-2.5 py-1 text-xs text-paper-muted dark:text-night-muted hover:text-paper-text dark:hover:text-night-text transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveNote}
                className="px-3 py-1 text-xs bg-paper-terracotta dark:bg-night-terracotta text-white rounded font-medium hover:opacity-90 transition-opacity"
              >
                保存思考
              </button>
            </div>
          </div>
        ) : annotation.customNote ? (
          <div
            onClick={handleStartEditNote}
            className="cursor-pointer group flex items-start gap-1.5 text-xs text-paper-muted dark:text-night-muted hover:text-paper-text dark:hover:text-night-text"
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleStartEditNote(); }}
            aria-label="编辑深度想法"
          >
            <MessageSquare className="w-3.5 h-3.5 text-paper-terracotta dark:text-night-terracotta mt-0.5 flex-shrink-0" />
            <span>{annotation.customNote}</span>
          </div>
        ) : (
          <button
            onClick={handleStartEditNote}
            className="flex items-center gap-1 text-[11px] text-paper-muted/70 dark:text-night-muted/70 hover:text-paper-terracotta dark:hover:text-night-terracotta transition-colors"
          >
            <Plus className="w-3 h-3" />
            <span>补充深度想法</span>
          </button>
        )}
      </div>

      {/* 标签栏 */}
      <div className="ml-2 flex flex-wrap items-center gap-1.5 pt-2 border-t border-paper-border/40 dark:border-night-border/40">
        {annotation.tags?.map(t => (
          <span
            key={t}
            className="group flex items-center gap-1 bg-paper-drawer dark:bg-night-drawer px-2 py-0.5 rounded text-[11px] text-paper-muted dark:text-night-muted border border-paper-border/40 dark:border-night-border/40"
          >
            <Tag className="w-2.5 h-2.5" />
            <span>#{t}</span>
            <button
              onClick={() => onRemoveTag(annotation.uuid, t)}
              className="hidden group-hover:inline hover:text-red-500 ml-0.5 transition-colors"
              title={`删除标签 ${t}`}
              aria-label={`删除标签 ${t}`}
            >
              ×
            </button>
          </span>
        ))}

        {isTagInputOpen ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={newTagText}
              onChange={e => setNewTagText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleAddTag();
                if (e.key === 'Escape') {
                  setIsTagInputOpen(false);
                  setNewTagText('');
                }
              }}
              placeholder="标签名"
              className="text-[11px] px-1.5 py-0.5 rounded border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card text-paper-text dark:text-night-text w-20 focus:outline-none focus:ring-1 focus:ring-paper-terracotta dark:focus:ring-night-terracotta"
              autoFocus
              aria-label="新标签名"
            />
            <button
              onClick={handleAddTag}
              className="text-paper-terracotta dark:text-night-terracotta hover:opacity-80"
              title="确认添加"
              aria-label="确认添加标签"
            >
              <Check className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsTagInputOpen(true)}
            className="text-[11px] text-paper-muted/60 dark:text-night-muted/60 hover:text-paper-terracotta dark:hover:text-night-terracotta flex items-center gap-0.5 transition-colors"
          >
            <Plus className="w-2.5 h-2.5" />
            <span>标签</span>
          </button>
        )}

        {/* 原文语境抽屉开关 */}
        <button
          onClick={handleToggleContext}
          className="ml-auto flex items-center gap-1 text-[11px] text-paper-muted dark:text-night-muted hover:text-paper-text dark:hover:text-night-text transition-colors"
        >
          <span>{isContextOpen ? '收起原文' : '展开原文语境'}</span>
          {isContextOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* 原文前后上下文展开区域 */}
      {isContextOpen && (
        <div className="mt-4 pt-3 border-t border-paper-border/60 dark:border-night-border/60 bg-paper-drawer dark:bg-night-drawer -mx-5 -mb-5 p-4 text-xs font-serif leading-relaxed text-paper-text/80 dark:text-night-text/80 space-y-2">
          {isLoadingContext ? (
            <p className="text-paper-muted dark:text-night-muted animate-pulse">正在从 EPUB 文件提取原文前后自然段...</p>
          ) : contextData && contextData.available ? (
            <>
              {contextData.beforeParagraphs?.map((para, i) => (
                <p key={`before-${i}`} className="opacity-60">{para}</p>
              ))}
              <p
                className="font-medium p-1.5 rounded"
                style={{ backgroundColor: `${colorHex}25`, borderLeft: `3px solid ${colorHex}` }}
              >
                {contextData.currentParagraph}
              </p>
              {contextData.afterParagraphs?.map((para, i) => (
                <p key={`after-${i}`} className="opacity-60">{para}</p>
              ))}
            </>
          ) : (
            <p className="text-paper-muted dark:text-night-muted italic">
              {contextData?.reason === 'FILE_NOT_DOWNLOADED'
                ? '此书籍为 iCloud 在线资源，未在本地发现 .epub 文件包'
                : '受 Apple Books DRM 保护或未找到对应章节原文'}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
