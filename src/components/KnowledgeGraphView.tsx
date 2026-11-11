import React, { useState, useMemo, useEffect } from 'react';
import {
  BookItem,
  AnnotationItem,
  ColorSemanticConfig,
  HighlightContextResult
} from '../../electron/types/ipc';
import { HighlightCard } from './HighlightCard';
import { CustomSelect } from './CustomSelect';
import {
  Waypoints,
  Tag,
  BookOpen,
  Filter,
  X,
  ArrowUpRight,
  Copy,
  Check,
  Sparkles,
  LayoutGrid,
  Columns,
  Library,
  Share2,
  Plus,
  Edit2,
  Trash2
} from 'lucide-react';

export type ResonanceViewMode = 'topic-clusters' | 'global-stream' | 'book-clusters';

export interface KnowledgeGraphViewProps {
  annotations: AnnotationItem[];
  books: BookItem[];
  colorSemantics: ColorSemanticConfig[];
  availableTags: string[];
  onSelectBook: (book: BookItem) => void;
  onManageTags?: () => void;
  onCreateTag?: (tag: string) => void;
  onRenameTag?: (oldTag: string, newTag: string) => void;
  onDeleteTag?: (tag: string) => void;
  onToggleStar: (uuid: string) => void;
  onUpdateCustomNote: (uuid: string, note: string) => void;
  onAddTag: (uuid: string, tag: string) => void;
  onRemoveTag: (uuid: string, tag: string) => void;
  onOpenQuoteModal: (annotation: AnnotationItem) => void;
  onRequestContext: (annotation: AnnotationItem) => Promise<HighlightContextResult>;
  initialFocusedNodeId?: string | null;
  isDarkMode?: boolean;
}

export const KnowledgeGraphView: React.FC<KnowledgeGraphViewProps> = ({
  annotations,
  books,
  colorSemantics,
  availableTags,
  onSelectBook,
  onManageTags,
  onCreateTag,
  onRenameTag,
  onDeleteTag,
  onToggleStar,
  onUpdateCustomNote,
  onAddTag,
  onRemoveTag,
  onOpenQuoteModal,
  onRequestContext,
  initialFocusedNodeId = null,
  isDarkMode: _isDarkMode = false
}) => {
  // 视图与交互状态
  const [viewMode, setViewMode] = useState<ResonanceViewMode>('topic-clusters');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('all');
  const [selectedBookFilter, setSelectedBookFilter] = useState<string>('all');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [onlyConnected, setOnlyConnected] = useState<boolean>(false);
  const [hoveredTag, setHoveredTag] = useState<string | null>(null);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(initialFocusedNodeId);
  const [isCopiedGlobal, setIsCopiedGlobal] = useState(false);
  const [copiedTopicTag, setCopiedTopicTag] = useState<string | null>(null);

  useEffect(() => {
    setFocusedNodeId(initialFocusedNodeId);
  }, [initialFocusedNodeId]);

  // 标签管理内部状态
  const [newTagName, setNewTagName] = useState('');
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

  const handleCreateTag = () => {
    const cleaned = newTagName.trim().replace(/^#+/, '');
    if (!cleaned) return;
    onCreateTag?.(cleaned);
    setNewTagName('');
  };

  const handleStartRename = (tag: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingTag(tag);
    setEditingValue(tag);
  };

  const handleConfirmRename = (oldTag: string) => {
    const cleaned = editingValue.trim().replace(/^#+/, '');
    if (cleaned && cleaned !== oldTag) {
      onRenameTag?.(oldTag, cleaned);
      if (selectedTagFilter === oldTag) {
        setSelectedTagFilter(cleaned);
      }
    }
    setEditingTag(null);
    setEditingValue('');
  };

  const handleDeleteTag = (tag: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (typeof window !== 'undefined' && window.confirm) {
      if (!window.confirm(`确定要删除标签 #${tag} 吗？\n删除后各书籍中的相关划线不会被删除。`)) {
        return;
      }
    }
    onDeleteTag?.(tag);
    if (selectedTagFilter === tag) {
      setSelectedTagFilter('all');
    }
  };

  // 基础映射
  const bookMap = useMemo(() => new Map(books.map(b => [b.assetId, b])), [books]);

  // 1. 过滤符合条件的高亮
  const filteredAnnotations = useMemo(() => {
    return annotations.filter(a => {
      if (selectedBookFilter !== 'all' && a.assetId !== selectedBookFilter) return false;
      if (selectedTagFilter !== 'all' && !(a.tags || []).includes(selectedTagFilter)) return false;

      if (searchKeyword.trim()) {
        const kw = searchKeyword.toLowerCase();
        const textMatch = (a.selectedText || '').toLowerCase().includes(kw);
        const noteMatch = (a.note || '').toLowerCase().includes(kw);
        const customMatch = (a.customNote || '').toLowerCase().includes(kw);
        const tagMatch = (a.tags || []).some(t => t.toLowerCase().includes(kw));
        const bookMatch = (a.bookTitle || '').toLowerCase().includes(kw);
        if (!textMatch && !noteMatch && !customMatch && !tagMatch && !bookMatch) return false;
      }

      if (onlyConnected) {
        // 只保留具有跨书同标签连接的高亮
        const myTags = a.tags || [];
        if (myTags.length === 0) return false;
        const tagSet = new Set(myTags);
        const hasCrossBookConnection = annotations.some(
          other =>
            other.uuid !== a.uuid &&
            other.assetId !== a.assetId &&
            (other.tags || []).some(t => tagSet.has(t))
        );
        if (!hasCrossBookConnection) return false;
      }

      return true;
    });
  }, [annotations, selectedBookFilter, selectedTagFilter, searchKeyword, onlyConnected]);

  // 2. 统计各标签的统计数据（跨几本书、几条思考）
  const tagStats = useMemo(() => {
    const map = new Map<string, { count: number; bookIds: Set<string> }>();
    for (const a of annotations) {
      for (const t of a.tags || []) {
        if (!map.has(t)) {
          map.set(t, { count: 0, bookIds: new Set() });
        }
        const stat = map.get(t)!;
        stat.count++;
        stat.bookIds.add(a.assetId);
      }
    }
    return map;
  }, [annotations]);

  // 有效标签列表（包含所有已有及新建的标签，按连接思考数量倒序）
  const activeTags = useMemo(() => {
    return availableTags
      .slice()
      .sort((a, b) => (tagStats.get(b)?.count || 0) - (tagStats.get(a)?.count || 0));
  }, [availableTags, tagStats]);

  // 跨书产生连接的高亮总数
  const crossBookHighlightsCount = useMemo(() => {
    return annotations.filter(a => {
      const myTags = a.tags || [];
      if (myTags.length === 0) return false;
      const tagSet = new Set(myTags);
      return annotations.some(
        other =>
          other.uuid !== a.uuid &&
          other.assetId !== a.assetId &&
          (other.tags || []).some(t => tagSet.has(t))
      );
    }).length;
  }, [annotations]);

  // 3. 计算抽屉聚焦节点信息（兼容 initialFocusedNodeId）
  const focusedNodeInfo = useMemo(() => {
    if (!focusedNodeId) return null;

    if (focusedNodeId.startsWith('tag:')) {
      const tag = focusedNodeId.replace('tag:', '');
      const annos = annotations.filter(a => (a.tags || []).includes(tag));
      return {
        type: 'tag' as const,
        label: `#${tag}`,
        subLabel: `汇聚 ${annos.length} 条同主题思考`,
        annotations: annos
      };
    } else if (focusedNodeId.startsWith('book:')) {
      const assetId = focusedNodeId.replace('book:', '');
      const b = bookMap.get(assetId);
      const annos = annotations.filter(a => a.assetId === assetId);
      return {
        type: 'book' as const,
        label: `《${b?.title || '未知书籍'}》`,
        subLabel: `全书精选 ${annos.length} 条划线`,
        annotations: annos,
        book: b
      };
    } else if (focusedNodeId.startsWith('anno:')) {
      const uuid = focusedNodeId.replace('anno:', '');
      const targetAnno = annotations.find(a => a.uuid === uuid);
      if (!targetAnno) return null;
      const targetTags = new Set(targetAnno.tags || []);
      const annos = annotations.filter(
        a => a.uuid === uuid || (a.tags || []).some(t => targetTags.has(t))
      );
      return {
        type: 'highlight' as const,
        label: targetAnno.selectedText.length > 20 ? targetAnno.selectedText.slice(0, 20) + '...' : targetAnno.selectedText,
        subLabel: `与 ${annos.length - 1} 条跨书划线具有共同标签`,
        annotations: annos
      };
    }
    return null;
  }, [focusedNodeId, annotations, bookMap]);

  // 导出 Markdown
  const handleCopyClusterMarkdown = async (targetTag?: string) => {
    const exportAnnos = targetTag
      ? annotations.filter(a => (a.tags || []).includes(targetTag))
      : filteredAnnotations;

    const title = targetTag ? `知识主题汇聚 · #${targetTag}` : 'BookEcho 知识共鸣网络';
    const lines = [
      `# ${title}`,
      `> 关联思考数量：${exportAnnos.length} 条 · 导出时间：${new Date().toLocaleDateString()}\n`
    ];

    for (const a of exportAnnos) {
      const b = bookMap.get(a.assetId);
      lines.push(`> [!quote] 《${b?.title || a.bookTitle || '未知书籍'}》· ${a.chapterTitle || '默认章节'}`);
      lines.push(`> “${a.selectedText}”`);
      if (a.note) lines.push(`> 原文划线想法：${a.note}`);
      if (a.customNote) lines.push(`> 延伸深度思考：${a.customNote}`);
      if (a.tags && a.tags.length > 0) lines.push(`> 标签：${a.tags.map(t => `#${t}`).join(' ')}`);
      lines.push('');
    }

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(lines.join('\n'));
      }
      if (targetTag) {
        setCopiedTopicTag(targetTag);
        setTimeout(() => setCopiedTopicTag(null), 2000);
      } else {
        setIsCopiedGlobal(true);
        setTimeout(() => setIsCopiedGlobal(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy Markdown', err);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-paper-bg dark:bg-night-bg text-paper-text dark:text-night-text select-none">
      {/* 1. 顶部 Header 与控制栏 */}
      <header className="flex-shrink-0 p-4 border-b border-paper-border/80 dark:border-night-border/80 bg-paper-card/90 dark:bg-night-card/90 backdrop-blur-md z-10 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* 标题与统计 */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-paper-terracotta/10 dark:bg-night-terracotta/10 text-paper-terracotta dark:text-night-terracotta flex-shrink-0">
              <Waypoints className="w-5 h-5" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-serif text-lg font-bold text-paper-text dark:text-night-text">
                  知识网络图谱
                </h1>
                <span className="text-xs px-2 py-0.5 rounded-full bg-paper-drawer dark:bg-night-drawer text-paper-muted dark:text-night-muted font-mono">
                  {activeTags.length} 标签枢纽 · {crossBookHighlightsCount} 读书高亮节点互联
                </span>
              </div>
              <p className="text-xs text-paper-muted dark:text-night-muted mt-0.5">
                同标签高亮自动在网络中聚簇互联，探索跨越书本边界的思想脉络
              </p>
            </div>
          </div>

          {/* 视图排布切换器 */}
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-paper-border dark:border-night-border overflow-hidden bg-paper-sidebar dark:bg-night-sidebar p-0.5 text-xs font-medium">
              <button
                onClick={() => setViewMode('topic-clusters')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-all ${
                  viewMode === 'topic-clusters'
                    ? 'bg-paper-terracotta dark:bg-night-terracotta text-white shadow-2xs'
                    : 'text-paper-muted hover:text-paper-text'
                }`}
                title="按标签主题独立成簇展示"
              >
                <Columns className="w-3.5 h-3.5" />
                <span>主题成簇</span>
              </button>

              <button
                onClick={() => setViewMode('global-stream')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-all ${
                  viewMode === 'global-stream'
                    ? 'bg-paper-terracotta dark:bg-night-terracotta text-white shadow-2xs'
                    : 'text-paper-muted hover:text-paper-text'
                }`}
                title="全量高亮瀑布流，悬停标签全局共鸣发光"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>共鸣瀑布流</span>
              </button>

              <button
                onClick={() => setViewMode('book-clusters')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-all ${
                  viewMode === 'book-clusters'
                    ? 'bg-paper-terracotta dark:bg-night-terracotta text-white shadow-2xs'
                    : 'text-paper-muted hover:text-paper-text'
                }`}
                title="按书籍聚类展示划线"
              >
                <Library className="w-3.5 h-3.5" />
                <span>书籍分组</span>
              </button>
            </div>

            {/* 导出按钮 */}
            <button
              onClick={() => handleCopyClusterMarkdown()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-paper-border dark:border-night-border hover:border-paper-terracotta text-xs font-medium text-paper-muted hover:text-paper-text bg-paper-card dark:bg-night-card transition-colors shadow-2xs"
              title="一键复制当前筛选的所有高亮为 Markdown"
            >
              {isCopiedGlobal ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{isCopiedGlobal ? '已复制全网' : '导出 Markdown'}</span>
            </button>
          </div>
        </div>

        {/* 筛选与搜索工具条 */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {/* 搜索框 */}
            <div className="relative">
              <input
                type="text"
                value={searchKeyword}
                onChange={e => setSearchKeyword(e.target.value)}
                placeholder="搜索网络节点..."
                className="pl-7 pr-3 py-1.5 rounded-lg border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card text-xs focus:outline-none focus:ring-1 focus:ring-paper-terracotta w-36 sm:w-44 transition-all"
              />
              <Filter className="w-3.5 h-3.5 absolute left-2 top-2.5 text-paper-muted" />
            </div>

            {/* 标签过滤下拉 */}
            <CustomSelect
              value={selectedTagFilter}
              onChange={setSelectedTagFilter}
              icon={<Tag className="w-3.5 h-3.5" />}
              searchPlaceholder="搜索标签..."
              dropdownWidthClass="w-56"
              options={[
                { value: 'all', label: `全部标签星团 (${activeTags.length})` },
                ...activeTags.map(t => ({
                  value: t,
                  label: `#${t}`,
                  count: tagStats.get(t)?.count || 0
                }))
              ]}
            />

            {/* 书籍过滤下拉 */}
            <CustomSelect
              value={selectedBookFilter}
              onChange={setSelectedBookFilter}
              icon={<BookOpen className="w-3.5 h-3.5" />}
              searchPlaceholder="搜索书名..."
              dropdownWidthClass="w-72"
              options={[
                { value: 'all', label: `全书库范围 (${books.length})` },
                ...books.map(b => ({
                  value: b.assetId,
                  label: b.title,
                  subLabel: b.author || undefined,
                  count: b.highlightsCount || undefined
                }))
              ]}
            />

            {/* 仅看跨书连接开关 */}
            <button
              onClick={() => setOnlyConnected(prev => !prev)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all ${
                onlyConnected
                  ? 'border-paper-terracotta/60 bg-paper-terracotta/10 text-paper-terracotta dark:text-night-terracotta font-medium'
                  : 'border-paper-border dark:border-night-border text-paper-muted hover:text-paper-text'
              }`}
              title="仅展示在多本书中打上相同标签产生共鸣的划线"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>仅看连接</span>
            </button>
          </div>

          {/* 活跃提示 */}
          {hoveredTag && (
            <div className="flex items-center gap-1.5 text-paper-terracotta dark:text-night-terracotta animate-pulse font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              <span>正在高亮 #{hoveredTag} 相关的全网思考</span>
            </div>
          )}
        </div>
      </header>

      {/* 2. 标签引力胶囊与全局管理条 */}
      <div className="flex-shrink-0 px-4 py-2.5 bg-paper-sidebar/50 dark:bg-night-sidebar/50 border-b border-paper-border/60 dark:border-night-border/60 flex flex-wrap items-center justify-between gap-3">
        {/* 左侧：标签胶囊流 */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-medium text-paper-muted dark:text-night-muted flex items-center gap-1 flex-shrink-0 mr-0.5">
            <Tag className="w-3.5 h-3.5 text-paper-terracotta dark:text-night-terracotta" />
            <span>思想引力场 ({activeTags.length})：</span>
          </span>

          {activeTags.length === 0 ? (
            <span className="text-xs text-paper-muted italic">
              暂无标签，在右侧输入框创建你的第一个主题标签 →
            </span>
          ) : (
            activeTags.map(t => {
              const stat = tagStats.get(t);
              const isHovered = hoveredTag === t;
              const isSelected = selectedTagFilter === t;
              const isEditing = editingTag === t;

              if (isEditing) {
                return (
                  <div
                    key={t}
                    className="flex-shrink-0 flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-paper-terracotta bg-paper-card dark:bg-night-card shadow-xs text-xs"
                    onClick={e => e.stopPropagation()}
                  >
                    <span className="text-paper-terracotta font-mono text-xs">#</span>
                    <input
                      type="text"
                      value={editingValue}
                      onChange={e => setEditingValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleConfirmRename(t);
                        if (e.key === 'Escape') setEditingTag(null);
                      }}
                      className="w-20 px-1 py-0.5 text-xs bg-transparent text-paper-text dark:text-night-text focus:outline-none"
                      autoFocus
                    />
                    <button
                      onClick={() => handleConfirmRename(t)}
                      className="p-0.5 hover:text-emerald-600 text-paper-muted"
                      title="保存重命名"
                    >
                      <Check className="w-3 h-3 text-emerald-500" />
                    </button>
                    <button
                      onClick={() => setEditingTag(null)}
                      className="p-0.5 hover:text-rose-500 text-paper-muted"
                      title="取消"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              }

              return (
                <div
                  key={t}
                  onMouseEnter={() => setHoveredTag(t)}
                  onMouseLeave={() => setHoveredTag(null)}
                  className={`group flex-shrink-0 flex items-center gap-1.5 pl-2.5 pr-2 py-1 rounded-full text-xs transition-all cursor-pointer select-none ${
                    isSelected
                      ? 'bg-paper-terracotta text-white font-medium shadow-xs scale-105'
                      : isHovered
                      ? 'bg-paper-terracotta/20 text-paper-terracotta dark:text-night-terracotta ring-1 ring-paper-terracotta font-medium'
                      : 'bg-white/80 dark:bg-night-card/80 border border-paper-border dark:border-night-border text-paper-text/80 dark:text-night-text/80 hover:border-paper-terracotta/50'
                  }`}
                  onClick={() => setSelectedTagFilter(prev => (prev === t ? 'all' : t))}
                >
                  <span>#{t}</span>
                  <span className="text-[10px] opacity-75 font-mono">
                    {stat ? `${stat.bookIds.size}书·${stat.count}条` : '0条'}
                  </span>

                  {/* 悬停微型管理按钮（重命名、删除） */}
                  {(onRenameTag || onDeleteTag) && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-0.5">
                      {onRenameTag && (
                        <button
                          onClick={e => handleStartRename(t, e)}
                          className={`p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 ${
                            isSelected ? 'text-white' : 'text-paper-muted hover:text-paper-text'
                          }`}
                          title="重命名标签"
                        >
                          <Edit2 className="w-2.5 h-2.5" />
                        </button>
                      )}
                      {onDeleteTag && (
                        <button
                          onClick={e => handleDeleteTag(t, e)}
                          className={`p-0.5 rounded hover:bg-rose-500/20 ${
                            isSelected ? 'text-white hover:text-rose-200' : 'text-paper-muted hover:text-rose-500'
                          }`}
                          title="删除标签"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* 右侧：新建标签一体化输入组件 */}
        {onCreateTag && (
          <div className="flex items-center rounded-xl border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card shadow-2xs p-1 focus-within:ring-1 focus-within:ring-paper-terracotta dark:focus-within:ring-night-terracotta focus-within:border-paper-terracotta transition-all flex-shrink-0 ml-auto">
            <div className="flex items-center pl-2 pr-1">
              <span className="text-paper-muted dark:text-night-muted text-xs font-mono select-none">#</span>
              <input
                type="text"
                value={newTagName}
                onChange={e => setNewTagName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreateTag();
                }}
                placeholder="新建标签..."
                className="pl-1 pr-2 py-1 text-xs bg-transparent text-paper-text dark:text-night-text placeholder:text-paper-muted/70 focus:outline-none w-24 sm:w-32 transition-all"
              />
            </div>
            <button
              onClick={handleCreateTag}
              disabled={!newTagName.trim()}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-paper-terracotta dark:bg-night-terracotta text-white text-xs font-medium shadow-2xs hover:opacity-95 active:scale-95 disabled:opacity-40 disabled:hover:opacity-40 transition-all flex-shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>新建</span>
            </button>
          </div>
        )}
      </div>

      {/* 3. 思想共鸣卡片流主体展区 */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-8">
        {filteredAnnotations.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-paper-terracotta/10 text-paper-terracotta mx-auto flex items-center justify-center">
              <Waypoints className="w-6 h-6" />
            </div>
            <h3 className="font-serif font-bold text-base text-paper-text dark:text-night-text">
              未找到符合条件的网络连接
            </h3>
            <p className="text-xs text-paper-muted max-w-sm mx-auto">
              尝试清除筛选条件，或为划线添加标签以在不同书籍之间建立思想桥梁
            </p>
            <button
              onClick={() => {
                setSelectedTagFilter('all');
                setSelectedBookFilter('all');
                setSearchKeyword('');
                setOnlyConnected(false);
              }}
              className="px-3 py-1.5 rounded-lg bg-paper-terracotta text-white text-xs font-medium hover:bg-paper-terracotta/90 transition-colors"
            >
              重置所有筛选
            </button>
          </div>
        ) : viewMode === 'topic-clusters' ? (
          /* A. 按主题成簇（Topic Clusters） */
          <div className="space-y-8">
            {activeTags
              .filter(t => selectedTagFilter === 'all' || selectedTagFilter === t)
              .map(tag => {
                const topicAnnos = filteredAnnotations.filter(a => (a.tags || []).includes(tag));
                if (topicAnnos.length === 0) return null;

                const stat = tagStats.get(tag);
                const isHovered = hoveredTag === tag;

                return (
                  <section
                    key={tag}
                    id={`topic-${tag}`}
                    className={`rounded-2xl border p-4 sm:p-5 transition-all ${
                      isHovered
                        ? 'border-paper-terracotta ring-2 ring-paper-terracotta/30 bg-paper-terracotta/5 shadow-md'
                        : 'border-paper-border/80 dark:border-night-border/80 bg-paper-card/40 dark:bg-night-card/40'
                    }`}
                  >
                    {/* 主题展区头部 */}
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-paper-border/60 dark:border-night-border/60">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <Tag className="w-4 h-4 text-paper-terracotta dark:text-night-terracotta" />
                          <h2 className="font-serif text-base font-bold text-paper-text dark:text-night-text">
                            #{tag}
                          </h2>
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-paper-terracotta/10 text-paper-terracotta dark:text-night-terracotta font-medium">
                            覆盖 {stat?.bookIds.size || 0} 本书 · 共 {topicAnnos.length} 条观点
                          </span>
                        </div>
                        <p className="text-xs text-paper-muted dark:text-night-muted">
                          在不同作者的视角下探索关于「{tag}」的思想共振
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {onRenameTag && (
                          <button
                            onClick={() => handleStartRename(tag)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border border-paper-border dark:border-night-border hover:border-paper-terracotta text-paper-muted hover:text-paper-text bg-paper-card dark:bg-night-card transition-colors shadow-2xs"
                            title="重命名此标签"
                          >
                            <Edit2 className="w-3 h-3 text-paper-muted" />
                            <span className="hidden sm:inline">重命名</span>
                          </button>
                        )}

                        {onDeleteTag && (
                          <button
                            onClick={() => handleDeleteTag(tag)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border border-paper-border dark:border-night-border hover:border-rose-400 text-paper-muted hover:text-rose-500 bg-paper-card dark:bg-night-card transition-colors shadow-2xs"
                            title="删除此标签"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span className="hidden sm:inline">删除</span>
                          </button>
                        )}

                        <button
                          onClick={() => handleCopyClusterMarkdown(tag)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border border-paper-border dark:border-night-border hover:border-paper-terracotta text-paper-muted hover:text-paper-text bg-paper-card dark:bg-night-card transition-colors shadow-2xs"
                          title="复制本主题所有跨书笔记为 Markdown"
                        >
                          {copiedTopicTag === tag ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span>{copiedTopicTag === tag ? '已复制' : '复制本主题'}</span>
                        </button>
                      </div>
                    </div>

                    {/* 卡片网格 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {topicAnnos.map(anno => {
                        const b = bookMap.get(anno.assetId);
                        const isAnnoResonating = hoveredTag && (anno.tags || []).includes(hoveredTag);
                        const isAnnoDimmed = hoveredTag && !isAnnoResonating;

                        return (
                          <div
                            key={anno.uuid}
                            className={`transition-all duration-200 ${
                              isAnnoDimmed ? 'opacity-35 grayscale-[20%]' : 'opacity-100'
                            }`}
                          >
                            <div className="mb-1.5 flex items-center justify-between text-xs px-1">
                              <button
                                onClick={() => b && onSelectBook(b)}
                                className="flex items-center gap-1 text-paper-muted hover:text-paper-terracotta dark:hover:text-night-terracotta font-serif font-medium truncate"
                              >
                                <BookOpen className="w-3 h-3 text-paper-terracotta" />
                                <span>《{b?.title || anno.bookTitle || '未知书籍'}》</span>
                                <ArrowUpRight className="w-3 h-3 opacity-60" />
                              </button>
                            </div>

                            <HighlightCard
                              annotation={anno}
                              colorSemantics={colorSemantics}
                              availableTags={availableTags}
                              allAnnotations={annotations}
                              onOpenInGraph={anno => setFocusedNodeId(`anno:${anno.uuid}`)}
                              onManageTags={onManageTags}
                              onToggleStar={onToggleStar}
                              onUpdateCustomNote={onUpdateCustomNote}
                              onAddTag={onAddTag}
                              onRemoveTag={onRemoveTag}
                              onOpenQuoteModal={onOpenQuoteModal}
                              onRequestContext={onRequestContext}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}

            {/* 未打标签的高亮在主题成簇模式下补充在底部 */}
            {activeTags.length === 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredAnnotations.map(anno => {
                  const b = bookMap.get(anno.assetId);
                  return (
                    <div key={anno.uuid}>
                      <div className="mb-1.5 flex items-center justify-between text-xs px-1">
                        <button
                          onClick={() => b && onSelectBook(b)}
                          className="flex items-center gap-1 text-paper-muted hover:text-paper-terracotta dark:hover:text-night-terracotta font-serif font-medium truncate"
                        >
                          <BookOpen className="w-3 h-3 text-paper-terracotta" />
                          <span>《{b?.title || anno.bookTitle || '未知书籍'}》</span>
                          <ArrowUpRight className="w-3 h-3 opacity-60" />
                        </button>
                      </div>

                      <HighlightCard
                        annotation={anno}
                        colorSemantics={colorSemantics}
                        availableTags={availableTags}
                        allAnnotations={annotations}
                        onOpenInGraph={anno => setFocusedNodeId(`anno:${anno.uuid}`)}
                        onManageTags={onManageTags}
                        onToggleStar={onToggleStar}
                        onUpdateCustomNote={onUpdateCustomNote}
                        onAddTag={onAddTag}
                        onRemoveTag={onRemoveTag}
                        onOpenQuoteModal={onOpenQuoteModal}
                        onRequestContext={onRequestContext}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : viewMode === 'book-clusters' ? (
          /* B. 按书籍聚类展示（Book Clusters） */
          <div className="space-y-8">
            {books.map(book => {
              const bookAnnos = filteredAnnotations.filter(a => a.assetId === book.assetId);
              if (bookAnnos.length === 0) return null;

              return (
                <section
                  key={book.assetId}
                  className="rounded-2xl border border-paper-border/80 dark:border-night-border/80 bg-paper-card/40 dark:bg-night-card/40 p-4 sm:p-5"
                >
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-paper-border/60 dark:border-night-border/60">
                    <div className="flex items-center gap-2.5">
                      <BookOpen className="w-5 h-5 text-paper-terracotta dark:text-night-terracotta" />
                      <div>
                        <h2 className="font-serif text-base font-bold text-paper-text dark:text-night-text">
                          《{book.title}》
                        </h2>
                        <p className="text-xs text-paper-muted dark:text-night-muted">
                          著者：{book.author || '未知'} · 精选 {bookAnnos.length} 条划线
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => onSelectBook(book)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-paper-terracotta text-white hover:bg-paper-terracotta/90 transition-colors shadow-2xs"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>精读本书</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {bookAnnos.map(anno => (
                      <HighlightCard
                        key={anno.uuid}
                        annotation={anno}
                        colorSemantics={colorSemantics}
                        availableTags={availableTags}
                        allAnnotations={annotations}
                        onOpenInGraph={anno => setFocusedNodeId(`anno:${anno.uuid}`)}
                        onManageTags={onManageTags}
                        onToggleStar={onToggleStar}
                        onUpdateCustomNote={onUpdateCustomNote}
                        onAddTag={onAddTag}
                        onRemoveTag={onRemoveTag}
                        onOpenQuoteModal={onOpenQuoteModal}
                        onRequestContext={onRequestContext}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          /* C. 全量高亮共鸣瀑布流（Global Stream） */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredAnnotations.map(anno => {
              const b = bookMap.get(anno.assetId);
              const isResonating = hoveredTag && (anno.tags || []).includes(hoveredTag);
              const isDimmed = hoveredTag && !isResonating;

              return (
                <div
                  key={anno.uuid}
                  className={`transition-all duration-200 ${
                    isResonating
                      ? 'ring-2 ring-paper-terracotta rounded-xl shadow-lg scale-[1.01]'
                      : isDimmed
                      ? 'opacity-35 grayscale-[20%]'
                      : 'opacity-100'
                  }`}
                >
                  <div className="mb-1.5 flex items-center justify-between text-xs px-1">
                    <button
                      onClick={() => b && onSelectBook(b)}
                      className="flex items-center gap-1 text-paper-muted hover:text-paper-terracotta dark:hover:text-night-terracotta font-serif font-medium truncate"
                    >
                      <BookOpen className="w-3 h-3 text-paper-terracotta" />
                      <span>《{b?.title || anno.bookTitle || '未知书籍'}》</span>
                      <ArrowUpRight className="w-3 h-3 opacity-60" />
                    </button>
                  </div>

                  <HighlightCard
                    annotation={anno}
                    colorSemantics={colorSemantics}
                    availableTags={availableTags}
                    allAnnotations={annotations}
                    onOpenInGraph={anno => setFocusedNodeId(`anno:${anno.uuid}`)}
                    onManageTags={onManageTags}
                    onToggleStar={onToggleStar}
                    onUpdateCustomNote={onUpdateCustomNote}
                    onAddTag={onAddTag}
                    onRemoveTag={onRemoveTag}
                    onOpenQuoteModal={onOpenQuoteModal}
                    onRequestContext={onRequestContext}
                  />
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* 4. 右侧抽屉：展示当前选中聚焦节点及其所有相连高亮卡片 */}
      {focusedNodeInfo && (
        <aside className="absolute right-0 top-0 bottom-0 w-full sm:w-[420px] bg-paper-card dark:bg-night-card border-l border-paper-border dark:border-night-border shadow-2xl flex flex-col z-30 animate-in slide-in-from-right duration-200">
          <div className="p-4 border-b border-paper-border dark:border-night-border flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-paper-terracotta/10 text-paper-terracotta dark:text-night-terracotta">
                  {focusedNodeInfo.type === 'tag'
                    ? '标签网络中心'
                    : focusedNodeInfo.type === 'book'
                    ? '书籍星系核心'
                    : '高亮网络节点'}
                </span>
                <span className="text-xs text-paper-muted dark:text-night-muted">
                  相连思考 ({focusedNodeInfo.annotations.length})
                </span>
              </div>
              <h2 className="font-serif text-lg font-bold text-paper-text dark:text-night-text">
                {focusedNodeInfo.label}
              </h2>
              {focusedNodeInfo.subLabel && (
                <p className="text-xs text-paper-muted dark:text-night-muted">
                  {focusedNodeInfo.subLabel}
                </p>
              )}
            </div>

            <div className="flex items-center gap-1">
              {focusedNodeInfo.type === 'book' && focusedNodeInfo.book && (
                <button
                  onClick={() => onSelectBook(focusedNodeInfo.book!)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-paper-terracotta text-white hover:bg-paper-terracotta/90 transition-colors shadow-2xs"
                  title="进入此书精读"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>精读</span>
                </button>
              )}

              {focusedNodeInfo.annotations.length > 0 && (
                <button
                  onClick={() => handleCopyClusterMarkdown(focusedNodeInfo.type === 'tag' ? focusedNodeInfo.label.replace('#', '') : undefined)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border border-paper-border dark:border-night-border hover:border-paper-terracotta text-paper-muted hover:text-paper-text transition-colors"
                  title="一键复制本簇所有高亮为 Markdown"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>复制本簇</span>
                </button>
              )}

              <button
                onClick={() => setFocusedNodeId(null)}
                className="p-1 rounded-lg text-paper-muted hover:text-paper-text dark:hover:text-night-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                aria-label="关闭网络抽屉"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {focusedNodeInfo.annotations.length === 0 ? (
              <div className="py-12 text-center text-xs text-paper-muted">
                暂无同标签关联的高亮
              </div>
            ) : (
              focusedNodeInfo.annotations.map(anno => {
                const b = bookMap.get(anno.assetId);
                return (
                  <div key={anno.uuid} className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-paper-muted dark:text-night-muted px-1">
                      <button
                        onClick={() => b && onSelectBook(b)}
                        className="flex items-center gap-1 hover:text-paper-terracotta dark:hover:text-night-terracotta font-serif font-medium truncate"
                      >
                        <BookOpen className="w-3 h-3 text-paper-terracotta" />
                        <span>《{b?.title || anno.bookTitle || '未知书籍'}》</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    </div>

                    <HighlightCard
                      annotation={anno}
                      colorSemantics={colorSemantics}
                      availableTags={availableTags}
                      allAnnotations={annotations}
                      onOpenInGraph={anno => setFocusedNodeId(`anno:${anno.uuid}`)}
                      onManageTags={onManageTags}
                      onToggleStar={onToggleStar}
                      onUpdateCustomNote={onUpdateCustomNote}
                      onAddTag={onAddTag}
                      onRemoveTag={onRemoveTag}
                      onOpenQuoteModal={onOpenQuoteModal}
                      onRequestContext={onRequestContext}
                    />
                  </div>
                );
              })
            )}
          </div>
        </aside>
      )}
    </div>
  );
};
