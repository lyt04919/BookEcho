import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import {
  BookItem,
  AnnotationItem,
  ColorSemanticConfig,
  HighlightContextResult
} from '../../electron/types/ipc';
import { HighlightCard } from './HighlightCard';
import {
  Waypoints,
  Tag,
  BookOpen,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Filter,
  X,
  Layers,
  ArrowUpRight
} from 'lucide-react';

export interface GraphNode {
  id: string; // "tag:xxx" or "anno:uuid"
  type: 'tag' | 'highlight';
  label: string;
  subLabel?: string;
  color: string;
  radius: number;
  annotation?: AnnotationItem;
  book?: BookItem;
  // 物理模拟属性
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number | null; // 拖拽固定位置
  fy?: number | null; // 拖拽固定位置
  degree: number; // 连接度
}

export interface GraphLink {
  source: string; // id
  target: string; // id
  color?: string;
}

export interface KnowledgeGraphViewProps {
  annotations: AnnotationItem[];
  books: BookItem[];
  colorSemantics: ColorSemanticConfig[];
  availableTags: string[];
  onSelectBook: (book: BookItem) => void;
  onManageTags: () => void;
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
  onToggleStar,
  onUpdateCustomNote,
  onAddTag,
  onRemoveTag,
  onOpenQuoteModal,
  onRequestContext,
  initialFocusedNodeId = null,
  isDarkMode = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 筛选过滤状态
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('all');
  const [selectedBookFilter, setSelectedBookFilter] = useState<string>('all');
  const [hideIsolated, setHideIsolated] = useState<boolean>(true); // 默认隐藏无任何连接的孤立点
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  // 交互选中的节点（右侧详情抽屉）
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(initialFocusedNodeId);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);

  // 视角平移与缩放
  const transformRef = useRef<{ x: number; y: number; k: number }>({ x: 0, y: 0, k: 1 });
  const [zoomLevel, setZoomLevel] = useState(1);

  // 颜色映射字典
  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of colorSemantics) {
      map.set(c.colorKey, c.hexColor);
    }
    return map;
  }, [colorSemantics]);

  const bookMap = useMemo(() => new Map(books.map(b => [b.assetId, b])), [books]);

  // 1. 构建图谱数据：节点与连线
  const { nodes, links, nodeMap } = useMemo(() => {
    const nList: GraphNode[] = [];
    const lList: GraphLink[] = [];
    const nMap = new Map<string, GraphNode>();

    // 过滤出符合书籍和搜索条件的高亮
    const filteredAnnos = annotations.filter(a => {
      if (selectedBookFilter !== 'all' && a.assetId !== selectedBookFilter) return false;
      if (searchKeyword.trim()) {
        const kw = searchKeyword.toLowerCase();
        const textMatch = (a.selectedText || '').toLowerCase().includes(kw);
        const noteMatch = (a.note || '').toLowerCase().includes(kw);
        const customMatch = (a.customNote || '').toLowerCase().includes(kw);
        const tagMatch = (a.tags || []).some(t => t.toLowerCase().includes(kw));
        return textMatch || noteMatch || customMatch || tagMatch;
      }
      return true;
    });

    // 统计各标签关联数量
    const tagCountMap = new Map<string, number>();
    for (const a of filteredAnnos) {
      for (const t of a.tags || []) {
        tagCountMap.set(t, (tagCountMap.get(t) || 0) + 1);
      }
    }

    // 筛选标签节点：若选定了标签筛选，只包含该标签
    const validTags = availableTags.filter(t => {
      if (selectedTagFilter !== 'all' && t !== selectedTagFilter) return false;
      return (tagCountMap.get(t) || 0) > 0;
    });

    // 添加标签节点（Tag Hubs）
    for (const t of validTags) {
      const count = tagCountMap.get(t) || 0;
      const tagId = `tag:${t}`;
      const tagNode: GraphNode = {
        id: tagId,
        type: 'tag',
        label: `#${t}`,
        subLabel: `${count} 条高亮连接`,
        color: '#E06C53', // 专属瓦橙色
        radius: Math.min(22, 14 + Math.sqrt(count) * 2.5),
        degree: 0,
        x: (Math.random() - 0.5) * 500,
        y: (Math.random() - 0.5) * 500,
        vx: 0,
        vy: 0
      };
      nList.push(tagNode);
      nMap.set(tagId, tagNode);
    }

    // 添加高亮节点及边
    for (const a of filteredAnnos) {
      const annoId = `anno:${a.uuid}`;
      const hex = colorMap.get(a.colorKey) || '#F5A623';
      const b = bookMap.get(a.assetId);
      const matchingTags = (a.tags || []).filter(t => nMap.has(`tag:${t}`));

      // 若开启“隐藏孤立点”且该高亮没有连向任何当前可见标签，则略过
      if (hideIsolated && matchingTags.length === 0) {
        continue;
      }

      const annoNode: GraphNode = {
        id: annoId,
        type: 'highlight',
        label: a.selectedText.length > 20 ? a.selectedText.slice(0, 20) + '...' : a.selectedText,
        subLabel: `《${b?.title || a.bookTitle || '未知书名'}》`,
        color: hex,
        radius: a.isStarred ? 9 : 7,
        annotation: a,
        book: b,
        degree: 0,
        x: (Math.random() - 0.5) * 600,
        y: (Math.random() - 0.5) * 600,
        vx: 0,
        vy: 0
      };

      nList.push(annoNode);
      nMap.set(annoId, annoNode);

      // 建立与所有共有标签的连线
      for (const t of matchingTags) {
        const tagId = `tag:${t}`;
        lList.push({
          source: annoId,
          target: tagId,
          color: hex
        });
        annoNode.degree++;
        const tNode = nMap.get(tagId);
        if (tNode) tNode.degree++;
      }
    }

    return { nodes: nList, links: lList, nodeMap: nMap };
  }, [
    annotations,
    availableTags,
    books,
    selectedTagFilter,
    selectedBookFilter,
    hideIsolated,
    searchKeyword,
    colorMap,
    bookMap
  ]);

  // 物理模拟节点位置状态（在内存中连续更新）
  const simulationRef = useRef<{
    nodes: GraphNode[];
    links: GraphLink[];
    animId: number | null;
  }>({
    nodes: [],
    links: [],
    animId: null
  });

  // 同步新节点数据至模拟引擎，保留已有节点坐标避免剧烈跳动
  useEffect(() => {
    const existingPosMap = new Map<string, { x: number; y: number }>();
    for (const oldNode of simulationRef.current.nodes) {
      existingPosMap.set(oldNode.id, { x: oldNode.x, y: oldNode.y });
    }

    const nextNodes = nodes.map(n => {
      const pos = existingPosMap.get(n.id);
      if (pos) {
        return { ...n, x: pos.x, y: pos.y };
      }
      return { ...n };
    });

    simulationRef.current.nodes = nextNodes;
    simulationRef.current.links = links;
  }, [nodes, links]);

  // 2. 自研质点-弹簧-库仑力导向物理引擎（极度轻量流畅，60 FPS 无死角）
  useEffect(() => {
    let isRunning = true;

    const stepSimulation = () => {
      if (!isRunning) return;

      const simNodes = simulationRef.current.nodes;
      const simLinks = simulationRef.current.links;
      const idToNode = new Map<string, GraphNode>();
      for (const n of simNodes) idToNode.set(n.id, n);

      const kRepel = 750; // 斥力系数
      const kAttract = 0.045; // 弹簧引力系数
      const idealDist = 65; // 理想弹簧长度
      const kCenter = 0.008; // 中心重力
      const damping = 0.82; // 阻尼衰减

      // A. 节点间排斥力 (Barnes-Hut 近似优化为局部邻域与质心)
      for (let i = 0; i < simNodes.length; i++) {
        const n1 = simNodes[i];
        for (let j = i + 1; j < simNodes.length; j++) {
          const n2 = simNodes[j];
          let dx = n2.x - n1.x;
          let dy = n2.y - n1.y;
          let distSq = dx * dx + dy * dy;
          if (distSq < 1) distSq = 1;
          const dist = Math.sqrt(distSq);

          if (dist < 320) {
            const force = (kRepel / (distSq + 25)) * (n1.type === 'tag' || n2.type === 'tag' ? 1.5 : 1);
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            if (!n1.fx) {
              n1.vx -= fx;
              n1.vy -= fy;
            }
            if (!n2.fx) {
              n2.vx += fx;
              n2.vy += fy;
            }
          }
        }

        // B. 中心牵引力（防止网络漂移出视野外）
        if (!n1.fx) {
          n1.vx -= n1.x * kCenter;
          n1.vy -= n1.y * kCenter;
        }
      }

      // C. 弹簧连接引力（拉紧打了相同标签的节点）
      for (const l of simLinks) {
        const src = idToNode.get(l.source);
        const tgt = idToNode.get(l.target);
        if (!src || !tgt) continue;

        const dx = tgt.x - src.x;
        const dy = tgt.y - src.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const delta = dist - idealDist;
        const force = delta * kAttract;

        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        if (!src.fx) {
          src.vx += fx;
          src.vy += fy;
        }
        if (!tgt.fx) {
          tgt.vx -= fx;
          tgt.vy -= fy;
        }
      }

      // D. 更新位置与速度
      for (const n of simNodes) {
        if (n.fx !== undefined && n.fx !== null) {
          n.x = n.fx;
          n.y = n.fy!;
          n.vx = 0;
          n.vy = 0;
        } else {
          n.x += n.vx;
          n.y += n.vy;
          n.vx *= damping;
          n.vy *= damping;
        }
      }

      // E. Canvas 渲染
      drawCanvas();

      simulationRef.current.animId = requestAnimationFrame(stepSimulation);
    };

    simulationRef.current.animId = requestAnimationFrame(stepSimulation);

    return () => {
      isRunning = false;
      if (simulationRef.current.animId) {
        cancelAnimationFrame(simulationRef.current.animId);
      }
    };
  }, [isDarkMode, focusedNodeId, hoveredNode]);

  // 3. Canvas 绘制逻辑
  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    ctx.save();
    // 居中并应用平移缩放
    ctx.translate(width / 2 + transformRef.current.x, height / 2 + transformRef.current.y);
    ctx.scale(transformRef.current.k, transformRef.current.k);

    const simNodes = simulationRef.current.nodes;
    const simLinks = simulationRef.current.links;
    const idToNode = new Map<string, GraphNode>();
    for (const n of simNodes) idToNode.set(n.id, n);

    // 活跃/选中的相连节点集合
    const activeConnectedIds = new Set<string>();
    const activeTarget = focusedNodeId || hoveredNode?.id || null;
    if (activeTarget) {
      activeConnectedIds.add(activeTarget);
      for (const l of simLinks) {
        if (l.source === activeTarget) activeConnectedIds.add(l.target);
        if (l.target === activeTarget) activeConnectedIds.add(l.source);
      }
    }

    // A. 绘制连线
    for (const l of simLinks) {
      const src = idToNode.get(l.source);
      const tgt = idToNode.get(l.target);
      if (!src || !tgt) continue;

      const isLinkActive =
        activeTarget &&
        ((l.source === activeTarget && activeConnectedIds.has(l.target)) ||
          (l.target === activeTarget && activeConnectedIds.has(l.source)));

      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(tgt.x, tgt.y);

      if (isLinkActive) {
        ctx.strokeStyle = isDarkMode ? 'rgba(232, 111, 136, 0.9)' : 'rgba(224, 108, 83, 0.9)';
        ctx.lineWidth = 2.2 / transformRef.current.k;
      } else if (activeTarget) {
        // 未选中的弱化连线
        ctx.strokeStyle = isDarkMode ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)';
        ctx.lineWidth = 0.8 / transformRef.current.k;
      } else {
        // 默认连线
        ctx.strokeStyle = isDarkMode ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.13)';
        ctx.lineWidth = 1.2 / transformRef.current.k;
      }
      ctx.stroke();
    }

    // B. 绘制节点
    for (const n of simNodes) {
      const isSelected = n.id === focusedNodeId;
      const isHovered = n.id === hoveredNode?.id;
      const isNeighbor = activeConnectedIds.has(n.id);
      const isDimmed = activeTarget && !isNeighbor;

      ctx.save();
      ctx.globalAlpha = isDimmed ? 0.18 : 1.0;

      // 节点外发光光晕
      if (isSelected || isHovered) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius + 6, 0, Math.PI * 2);
        ctx.fillStyle = n.type === 'tag' ? 'rgba(224, 108, 83, 0.25)' : `${n.color}35`;
        ctx.fill();
      }

      // 节点本体
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);

      if (n.type === 'tag') {
        // 标签主节点：醒目的暖橙/渐变填充与白边
        ctx.fillStyle = isDarkMode ? '#E06C53' : '#D05B42';
        ctx.fill();
        ctx.lineWidth = 2 / transformRef.current.k;
        ctx.strokeStyle = isDarkMode ? '#FFFFFF' : '#FDFBF7';
        ctx.stroke();
      } else {
        // 高亮思考节点：色彩语义填充
        ctx.fillStyle = n.color;
        ctx.fill();
        ctx.lineWidth = (isSelected ? 2.5 : 1) / transformRef.current.k;
        ctx.strokeStyle = isDarkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.2)';
        ctx.stroke();
      }

      // 节点文本标签（文字缩小时智能显示）
      const shouldShowLabel =
        n.type === 'tag' || isSelected || isHovered || (transformRef.current.k > 1.3 && !isDimmed);

      if (shouldShowLabel) {
        ctx.font =
          n.type === 'tag'
            ? `bold ${Math.max(11, 13 / transformRef.current.k)}px "Noto Serif SC", serif`
            : `${Math.max(10, 11 / transformRef.current.k)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        const labelText = n.label;
        const textY = n.y + n.radius + 4;

        // 文字阴影描边保证在任何底色上都清晰可读
        ctx.lineWidth = 3 / transformRef.current.k;
        ctx.strokeStyle = isDarkMode ? '#1E1E1E' : '#FDFBF7';
        ctx.strokeText(labelText, n.x, textY);

        ctx.fillStyle =
          n.type === 'tag'
            ? isDarkMode
              ? '#FF9A85'
              : '#A83B25'
            : isDarkMode
              ? '#E5E5E5'
              : '#37352F';
        ctx.fillText(labelText, n.x, textY);
      }

      ctx.restore();
    }

    ctx.restore();
  };

  // 4. 自适应 Canvas 尺寸
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas || !canvas.parentElement) return;
      const rect = canvas.parentElement.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(dpr, dpr);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 5. 坐标转换工具函数
  const getCanvasMousePos = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    // 转换为世界坐标
    const worldX = (clientX - rect.width / 2 - transformRef.current.x) / transformRef.current.k;
    const worldY = (clientY - rect.height / 2 - transformRef.current.y) / transformRef.current.k;
    return { x: worldX, y: worldY, clientX, clientY };
  }, []);

  // 探测鼠标下方的节点
  const findNodeUnderMouse = useCallback((worldX: number, worldY: number): GraphNode | null => {
    const simNodes = simulationRef.current.nodes;
    for (let i = simNodes.length - 1; i >= 0; i--) {
      const n = simNodes[i];
      const dx = n.x - worldX;
      const dy = n.y - worldY;
      if (dx * dx + dy * dy <= (n.radius + 6) * (n.radius + 6)) {
        return n;
      }
    }
    return null;
  }, []);

  // 6. 交互事件处理：平移、缩放、拖拽节点、点击聚焦
  const dragRef = useRef<{
    isDragging: boolean;
    draggedNode: GraphNode | null;
    startX: number;
    startY: number;
    startTransformX: number;
    startTransformY: number;
  }>({
    isDragging: false,
    draggedNode: null,
    startX: 0,
    startY: 0,
    startTransformX: 0,
    startTransformY: 0
  });

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasMousePos(e);
    const node = findNodeUnderMouse(x, y);

    if (node) {
      // 拖拽节点
      dragRef.current = {
        isDragging: true,
        draggedNode: node,
        startX: e.clientX,
        startY: e.clientY,
        startTransformX: transformRef.current.x,
        startTransformY: transformRef.current.y
      };
      node.fx = node.x;
      node.fy = node.y;
    } else {
      // 拖动画布
      dragRef.current = {
        isDragging: true,
        draggedNode: null,
        startX: e.clientX,
        startY: e.clientY,
        startTransformX: transformRef.current.x,
        startTransformY: transformRef.current.y
      };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasMousePos(e);

    if (dragRef.current.isDragging) {
      if (dragRef.current.draggedNode) {
        // 移动节点
        const n = dragRef.current.draggedNode;
        n.fx = x;
        n.fy = y;
        n.x = x;
        n.y = y;
      } else {
        // 拖动画布
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        transformRef.current.x = dragRef.current.startTransformX + dx;
        transformRef.current.y = dragRef.current.startTransformY + dy;
      }
      return;
    }

    // 悬浮检测
    const hovered = findNodeUnderMouse(x, y);
    setHoveredNode(hovered);
  };

  const handleMouseUp = () => {
    if (dragRef.current.draggedNode) {
      // 释放节点拖拽固定
      dragRef.current.draggedNode.fx = null;
      dragRef.current.draggedNode.fy = null;
    }
    dragRef.current.isDragging = false;
    dragRef.current.draggedNode = null;
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasMousePos(e);
    const node = findNodeUnderMouse(x, y);
    if (node) {
      setFocusedNodeId(prev => (prev === node.id ? null : node.id));
    } else {
      setFocusedNodeId(null);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    const newK = Math.min(3.5, Math.max(0.3, transformRef.current.k * zoomFactor));
    transformRef.current.k = newK;
    setZoomLevel(Math.round(newK * 100));
  };

  const handleResetZoom = () => {
    transformRef.current = { x: 0, y: 0, k: 1 };
    setZoomLevel(100);
  };

  // 7. 计算当前聚焦节点关联的所有高亮卡片（供右侧抽屉展示）
  const connectedAnnotations = useMemo(() => {
    if (!focusedNodeId) return [];

    if (focusedNodeId.startsWith('tag:')) {
      const tag = focusedNodeId.replace('tag:', '');
      return annotations.filter(a => (a.tags || []).includes(tag));
    } else if (focusedNodeId.startsWith('anno:')) {
      const uuid = focusedNodeId.replace('anno:', '');
      const targetAnno = annotations.find(a => a.uuid === uuid);
      if (!targetAnno) return [];

      const targetTags = new Set(targetAnno.tags || []);
      // 找出所有共享至少一个标签的同门高亮
      return annotations.filter(
        a => a.uuid === uuid || (a.tags || []).some(t => targetTags.has(t))
      );
    }
    return [];
  }, [focusedNodeId, annotations]);

  const focusedNode = focusedNodeId ? nodeMap.get(focusedNodeId) : null;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-paper-bg dark:bg-night-bg text-paper-text dark:text-night-text select-none">
      {/* 顶部控制栏 */}
      <div className="flex flex-wrap items-center justify-between p-4 border-b border-paper-border/70 dark:border-night-border/70 bg-paper-card/80 dark:bg-night-card/80 backdrop-blur-sm z-10 gap-3">
        {/* 标题 */}
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-paper-terracotta/10 dark:bg-night-terracotta/10 text-paper-terracotta dark:text-night-terracotta">
            <Waypoints className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-serif text-lg font-bold flex items-center gap-2 text-paper-text dark:text-night-text">
              <span>知识网络图谱</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-paper-drawer dark:bg-night-drawer text-paper-muted dark:text-night-muted font-mono font-normal">
                {nodes.length} 节点 · {links.length} 连线
              </span>
            </h1>
            <p className="text-xs text-paper-muted dark:text-night-muted">
              同标签高亮自动在网络中聚簇互联，探索跨越书本边界的思想脉络
            </p>
          </div>
        </div>

        {/* 筛选与操作群 */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* 搜索框 */}
          <div className="relative">
            <input
              type="text"
              value={searchKeyword}
              onChange={e => setSearchKeyword(e.target.value)}
              placeholder="搜索网络节点..."
              className="pl-7 pr-3 py-1.5 rounded-lg border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card text-xs focus:outline-none focus:ring-1 focus:ring-paper-terracotta"
            />
            <Filter className="w-3.5 h-3.5 absolute left-2 top-2 text-paper-muted" />
          </div>

          {/* 标签过滤下拉 */}
          <select
            value={selectedTagFilter}
            onChange={e => setSelectedTagFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card text-xs focus:outline-none"
          >
            <option value="all">全部标签星团 ({availableTags.length})</option>
            {availableTags.map(t => (
              <option key={t} value={t}>
                #{t}
              </option>
            ))}
          </select>

          {/* 书籍过滤下拉 */}
          <select
            value={selectedBookFilter}
            onChange={e => setSelectedBookFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card text-xs focus:outline-none max-w-[150px] truncate"
          >
            <option value="all">全书库范围 ({books.length})</option>
            {books.map(b => (
              <option key={b.assetId} value={b.assetId}>
                {b.title}
              </option>
            ))}
          </select>

          {/* 隐藏孤立点开关 */}
          <button
            onClick={() => setHideIsolated(prev => !prev)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border transition-colors ${
              hideIsolated
                ? 'border-paper-terracotta/50 bg-paper-terracotta/10 text-paper-terracotta dark:text-night-terracotta'
                : 'border-paper-border dark:border-night-border text-paper-muted hover:text-paper-text'
            }`}
            title="隐藏没有任何共有标签连接的高亮"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>仅看连接</span>
          </button>

          {/* 缩放按钮 */}
          <div className="flex items-center rounded-lg border border-paper-border dark:border-night-border overflow-hidden bg-paper-card dark:bg-night-card">
            <button
              onClick={() => {
                transformRef.current.k = Math.max(0.3, transformRef.current.k * 0.85);
                setZoomLevel(Math.round(transformRef.current.k * 100));
              }}
              className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 text-paper-muted"
              title="缩小"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] px-1 font-mono text-paper-muted min-w-[36px] text-center">
              {zoomLevel}%
            </span>
            <button
              onClick={() => {
                transformRef.current.k = Math.min(3.5, transformRef.current.k * 1.15);
                setZoomLevel(Math.round(transformRef.current.k * 100));
              }}
              className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 text-paper-muted"
              title="放大"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleResetZoom}
              className="p-1.5 border-l border-paper-border dark:border-night-border hover:bg-black/5 dark:hover:bg-white/5 text-paper-muted"
              title="适应视角"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 主画布区域 */}
      <div className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onClick={handleClick}
          onWheel={handleWheel}
          className="w-full h-full block"
        />

        {/* 鼠标悬浮气泡提示卡 */}
        {hoveredNode && !focusedNodeId && (
          <div
            className="absolute pointer-events-none p-3 rounded-xl bg-paper-card/95 dark:bg-night-card/95 border border-paper-border dark:border-night-border shadow-lg backdrop-blur-md max-w-xs text-xs space-y-1 transition-opacity z-20"
            style={{
              left: Math.min(
                window.innerWidth - 320,
                (canvasRef.current?.width || 0) / (window.devicePixelRatio * 2) +
                  transformRef.current.x +
                  hoveredNode.x * transformRef.current.k +
                  15
              ),
              top: Math.max(
                70,
                (canvasRef.current?.height || 0) / (window.devicePixelRatio * 2) +
                  transformRef.current.y +
                  hoveredNode.y * transformRef.current.k -
                  30
              )
            }}
          >
            <div className="flex items-center gap-1.5 font-bold">
              {hoveredNode.type === 'tag' ? (
                <>
                  <Tag className="w-3.5 h-3.5 text-paper-terracotta dark:text-night-terracotta" />
                  <span>{hoveredNode.label}</span>
                </>
              ) : (
                <>
                  <BookOpen className="w-3.5 h-3.5 text-paper-terracotta dark:text-night-terracotta" />
                  <span>{hoveredNode.subLabel}</span>
                </>
              )}
            </div>
            <p className="font-serif leading-relaxed line-clamp-3 text-paper-text/90 dark:text-night-text/90">
              {hoveredNode.type === 'tag'
                ? `共汇集 ${hoveredNode.degree} 条跨书高亮思考`
                : `“${hoveredNode.annotation?.selectedText}”`}
            </p>
            {hoveredNode.annotation?.customNote && (
              <p className="text-[11px] text-paper-muted dark:text-night-muted italic">
                思考: {hoveredNode.annotation.customNote}
              </p>
            )}
            <p className="text-[10px] text-paper-muted/80 dark:text-night-muted/80 pt-1">
              💡 点击节点展开完整网络关联
            </p>
          </div>
        )}

        {/* 底部图例说明 */}
        <div className="absolute left-4 bottom-4 p-2.5 rounded-xl bg-paper-card/85 dark:bg-night-card/85 border border-paper-border/60 dark:border-night-border/60 shadow-xs backdrop-blur-sm text-[11px] flex items-center gap-3 text-paper-muted dark:text-night-muted pointer-events-none">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-paper-terracotta border border-white" />
            <span>标签枢纽</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F5A623]" />
            <span>读书高亮节点</span>
          </span>
          <span className="hidden sm:inline text-paper-muted/60">
            • 滚轮缩放 • 拖拽节点 • 点击聚焦
          </span>
        </div>
      </div>

      {/* 右侧抽屉：展示当前选中节点及所有网络相连的高亮卡片 */}
      {focusedNode && (
        <aside className="absolute right-0 top-0 bottom-0 w-full sm:w-[420px] bg-paper-card dark:bg-night-card border-l border-paper-border dark:border-night-border shadow-2xl flex flex-col z-30 animate-in slide-in-from-right duration-200">
          {/* 抽屉顶部头部 */}
          <div className="p-4 border-b border-paper-border dark:border-night-border flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-paper-terracotta/10 text-paper-terracotta dark:text-night-terracotta">
                  {focusedNode.type === 'tag' ? '标签网络中心' : '高亮网络节点'}
                </span>
                <span className="text-xs text-paper-muted dark:text-night-muted">
                  相连思考 ({connectedAnnotations.length})
                </span>
              </div>
              <h2 className="font-serif text-lg font-bold text-paper-text dark:text-night-text">
                {focusedNode.label}
              </h2>
              {focusedNode.subLabel && (
                <p className="text-xs text-paper-muted dark:text-night-muted">
                  {focusedNode.subLabel}
                </p>
              )}
            </div>

            <button
              onClick={() => setFocusedNodeId(null)}
              className="p-1 rounded-lg text-paper-muted hover:text-paper-text dark:hover:text-night-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              aria-label="关闭网络抽屉"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 抽屉相连列表 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {connectedAnnotations.length === 0 ? (
              <div className="py-12 text-center text-xs text-paper-muted">
                暂无同标签关联的高亮
              </div>
            ) : (
              connectedAnnotations.map(anno => {
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
