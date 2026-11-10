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
  ArrowUpRight,
  Copy,
  Check,
  Compass,
  Sparkles,
  Eye,
  Share2
} from 'lucide-react';

export type GraphMode = 'book-galaxy' | 'tag-hub' | 'direct-mesh';
export type LabelDisplayMode = 'hub-only' | 'hover-only' | 'all';

export interface GraphNode {
  id: string; // "book:xxx" | "tag:xxx" | "anno:uuid"
  type: 'book' | 'tag' | 'highlight';
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
  parentId?: string; // 归属母星 ID（书籍或标签）
}

export interface GraphLink {
  source: string; // id
  target: string; // id
  color?: string;
  isCrossBook?: boolean; // 是否为跨书标签共鸣连线
  weight?: number;
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

  // 拓扑与筛选状态
  const [graphMode, setGraphMode] = useState<GraphMode>(
    initialFocusedNodeId?.startsWith('tag:') ? 'tag-hub' : 'book-galaxy'
  );
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('all');
  const [selectedBookFilter, setSelectedBookFilter] = useState<string>('all');
  const [hideIsolated, setHideIsolated] = useState<boolean>(false);
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [labelDisplayMode, setLabelDisplayMode] = useState<LabelDisplayMode>('hub-only');
  const [showSettingsMenu, setShowSettingsMenu] = useState<boolean>(false);
  const [isCopiedCluster, setIsCopiedCluster] = useState(false);

  // 交互选中的节点（右侧详情抽屉）与悬停节点
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(initialFocusedNodeId);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);

  // 视角平移与缩放
  const transformRef = useRef<{ x: number; y: number; k: number }>({ x: 0, y: 0, k: 0.95 });
  const [zoomLevel, setZoomLevel] = useState(95);

  // 颜色映射字典
  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of colorSemantics) {
      map.set(c.colorKey, c.hexColor);
    }
    return map;
  }, [colorSemantics]);

  const bookMap = useMemo(() => new Map(books.map(b => [b.assetId, b])), [books]);

  // 1. 构建图谱数据：根据模式生成节点与连线
  const { nodes, links, nodeMap } = useMemo(() => {
    const nList: GraphNode[] = [];
    const lList: GraphLink[] = [];
    const nMap = new Map<string, GraphNode>();

    // 过滤出符合书籍和搜索条件的高亮
    const filteredAnnos = annotations.filter(a => {
      if (selectedBookFilter !== 'all' && a.assetId !== selectedBookFilter) return false;
      if (selectedTagFilter !== 'all' && !(a.tags || []).includes(selectedTagFilter)) return false;
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

    // 统计各书籍的高亮数
    const bookAnnoCountMap = new Map<string, number>();
    for (const a of filteredAnnos) {
      bookAnnoCountMap.set(a.assetId, (bookAnnoCountMap.get(a.assetId) || 0) + 1);
    }

    // ==========================================
    // 模式 A：🌟 书籍星系拓扑（Book Galaxies - 默认）
    // ==========================================
    if (graphMode === 'book-galaxy') {
      // 1. 创建书籍恒星节点
      const activeBookIds = Array.from(bookAnnoCountMap.keys());
      const bookCount = activeBookIds.length;

      activeBookIds.forEach((assetId, idx) => {
        const b = bookMap.get(assetId);
        const count = bookAnnoCountMap.get(assetId) || 0;
        const bookId = `book:${assetId}`;

        // 环形预排布各大书籍星系，避免重叠
        const angle = (idx / (bookCount || 1)) * Math.PI * 2;
        const orbitR = bookCount > 1 ? Math.min(500, 160 + bookCount * 45) : 0;

        const bookNode: GraphNode = {
          id: bookId,
          type: 'book',
          label: b?.title || '未知书籍',
          subLabel: `${count} 条高亮`,
          color: isDarkMode ? '#E06C53' : '#D05B42',
          radius: Math.min(30, 18 + Math.sqrt(count) * 2.2),
          book: b,
          degree: 0,
          x: Math.cos(angle) * orbitR,
          y: Math.sin(angle) * orbitR,
          vx: 0,
          vy: 0
        };

        nList.push(bookNode);
        nMap.set(bookId, bookNode);
      });

      // 2. 创建高亮行星节点并连接至其母星
      const annoNodeList: GraphNode[] = [];
      filteredAnnos.forEach((a, i) => {
        const parentBookNode = nMap.get(`book:${a.assetId}`);
        const hex = colorMap.get(a.colorKey) || '#F5A623';
        const b = bookMap.get(a.assetId);
        const annoId = `anno:${a.uuid}`;

        // 在母星周围散落卫星
        const parentX = parentBookNode?.x || 0;
        const parentY = parentBookNode?.y || 0;
        const subAngle = (i * 137.5 * Math.PI) / 180; // 黄金角散布
        const rDist = 45 + Math.random() * 60;

        const annoNode: GraphNode = {
          id: annoId,
          type: 'highlight',
          label: a.selectedText.length > 14 ? a.selectedText.slice(0, 14) + '...' : a.selectedText,
          subLabel: `《${b?.title || a.bookTitle || '未知书名'}》`,
          color: hex,
          radius: a.isStarred ? 7 : 5.5,
          annotation: a,
          book: b,
          degree: 0,
          parentId: `book:${a.assetId}`,
          x: parentX + Math.cos(subAngle) * rDist,
          y: parentY + Math.sin(subAngle) * rDist,
          vx: 0,
          vy: 0
        };

        annoNodeList.push(annoNode);
        nList.push(annoNode);
        nMap.set(annoId, annoNode);

        // 连接高亮与其母书
        if (parentBookNode) {
          lList.push({
            source: annoId,
            target: parentBookNode.id,
            color: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
            isCrossBook: false
          });
          annoNode.degree++;
          parentBookNode.degree++;
        }
      });

      // 3. 跨书相同标签的划线，拉出明亮的星际虫洞连线！
      for (let i = 0; i < annoNodeList.length; i++) {
        for (let j = i + 1; j < annoNodeList.length; j++) {
          const n1 = annoNodeList[i];
          const n2 = annoNodeList[j];
          const tags1 = n1.annotation?.tags || [];
          const tags2 = new Set(n2.annotation?.tags || []);
          const shared = tags1.filter(t => tags2.has(t));

          if (shared.length > 0) {
            const isCross = n1.annotation?.assetId !== n2.annotation?.assetId;
            lList.push({
              source: n1.id,
              target: n2.id,
              color: isCross ? '#E06C53' : n1.color,
              isCrossBook: isCross,
              weight: shared.length
            });
            n1.degree += shared.length;
            n2.degree += shared.length;
          }
        }
      }

      // 孤立点过滤（书籍星系模式下如果开启 hideIsolated，只保留有跨书连接的）
      const finalNodes = hideIsolated ? nList.filter(n => n.degree > 1) : nList;
      return { nodes: finalNodes, links: lList, nodeMap: nMap };
    }

    // ==========================================
    // 模式 B：🏷️ 标签星团拓扑（Tag Hubs）
    // ==========================================
    if (graphMode === 'tag-hub') {
      const validTags = availableTags.filter(t => {
        if (selectedTagFilter !== 'all' && t !== selectedTagFilter) return false;
        return (tagCountMap.get(t) || 0) > 0;
      });

      // 标签节点
      validTags.forEach((t, idx) => {
        const count = tagCountMap.get(t) || 0;
        const tagId = `tag:${t}`;
        const angle = (idx / (validTags.length || 1)) * Math.PI * 2;
        const orbitR = validTags.length > 1 ? 220 : 0;

        const tagNode: GraphNode = {
          id: tagId,
          type: 'tag',
          label: `#${t}`,
          subLabel: `${count} 条高亮连接`,
          color: '#E06C53',
          radius: Math.min(24, 15 + Math.sqrt(count) * 2.5),
          degree: 0,
          x: Math.cos(angle) * orbitR,
          y: Math.sin(angle) * orbitR,
          vx: 0,
          vy: 0
        };
        nList.push(tagNode);
        nMap.set(tagId, tagNode);
      });

      // 高亮节点
      filteredAnnos.forEach(a => {
        const matchingTags = (a.tags || []).filter(t => nMap.has(`tag:${t}`));
        if (hideIsolated && matchingTags.length === 0) return;

        const annoId = `anno:${a.uuid}`;
        const hex = colorMap.get(a.colorKey) || '#F5A623';
        const b = bookMap.get(a.assetId);

        const annoNode: GraphNode = {
          id: annoId,
          type: 'highlight',
          label: a.selectedText.length > 14 ? a.selectedText.slice(0, 14) + '...' : a.selectedText,
          subLabel: `《${b?.title || a.bookTitle || '未知书名'}》`,
          color: hex,
          radius: a.isStarred ? 7 : 5.5,
          annotation: a,
          book: b,
          degree: 0,
          x: (Math.random() - 0.5) * 450,
          y: (Math.random() - 0.5) * 450,
          vx: 0,
          vy: 0
        };

        nList.push(annoNode);
        nMap.set(annoId, annoNode);

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
      });

      return { nodes: nList, links: lList, nodeMap: nMap };
    }

    // ==========================================
    // 模式 C：🕸️ 思想网格拓扑（Direct Mesh / Obsidian）
    // ==========================================
    const annoNodes: GraphNode[] = [];
    filteredAnnos.forEach(a => {
      const annoId = `anno:${a.uuid}`;
      const hex = colorMap.get(a.colorKey) || '#F5A623';
      const b = bookMap.get(a.assetId);

      const annoNode: GraphNode = {
        id: annoId,
        type: 'highlight',
        label: a.selectedText.length > 14 ? a.selectedText.slice(0, 14) + '...' : a.selectedText,
        subLabel: `《${b?.title || a.bookTitle || '未知书名'}》`,
        color: hex,
        radius: a.isStarred ? 7 : 5.5,
        annotation: a,
        book: b,
        degree: 0,
        x: (Math.random() - 0.5) * 550,
        y: (Math.random() - 0.5) * 550,
        vx: 0,
        vy: 0
      };
      annoNodes.push(annoNode);
      nMap.set(annoId, annoNode);
    });

    for (let i = 0; i < annoNodes.length; i++) {
      for (let j = i + 1; j < annoNodes.length; j++) {
        const n1 = annoNodes[i];
        const n2 = annoNodes[j];
        const tags1 = n1.annotation?.tags || [];
        const tags2 = new Set(n2.annotation?.tags || []);
        const shared = tags1.filter(t => tags2.has(t));

        if (shared.length > 0) {
          lList.push({
            source: n1.id,
            target: n2.id,
            color: n1.color,
            weight: shared.length
          });
          n1.degree += shared.length;
          n2.degree += shared.length;
        }
      }
    }

    const finalMeshNodes = hideIsolated ? annoNodes.filter(n => n.degree > 0) : annoNodes;
    return { nodes: finalMeshNodes, links: lList, nodeMap: nMap };
  }, [
    annotations,
    availableTags,
    books,
    selectedTagFilter,
    selectedBookFilter,
    hideIsolated,
    searchKeyword,
    graphMode,
    colorMap,
    bookMap,
    isDarkMode
  ]);

  // 物理模拟引擎引用与退火状态（Alpha Annealing）
  const simulationRef = useRef<{
    nodes: GraphNode[];
    links: GraphLink[];
    animId: number | null;
    alpha: number; // 模拟温度（衰减至 0.005 停止运算节约 CPU）
  }>({
    nodes: [],
    links: [],
    animId: null,
    alpha: 1.0
  });

  // 同步新数据并平滑继承已有位置
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
    simulationRef.current.alpha = 1.0; // 重新激活物理退火
  }, [nodes, links]);

  // 2. 原生力导向物理引擎（含防穿透刚体碰撞 + 层次向心引力）
  useEffect(() => {
    let isRunning = true;

    const stepSimulation = () => {
      if (!isRunning) return;

      const sim = simulationRef.current;
      const simNodes = sim.nodes;
      const simLinks = sim.links;
      const idToNode = new Map<string, GraphNode>();
      for (const n of simNodes) idToNode.set(n.id, n);

      // 当模拟退火温度过低且没有拖拽时，挂起物理迭代，仅绘制静态帧
      if (sim.alpha > 0.005) {
        const alpha = sim.alpha;
        const kRepel = 900 * alpha; // 柔和斥力
        const kAttract = 0.045; // 弹簧弹性
        const kCenter = 0.0006 * alpha; // 超弱中心防止飘逸
        const damping = 0.84;

        // A. 刚体硬防重叠碰撞与节点库仑排斥
        for (let i = 0; i < simNodes.length; i++) {
          const n1 = simNodes[i];
          for (let j = i + 1; j < simNodes.length; j++) {
            const n2 = simNodes[j];
            let dx = n2.x - n1.x;
            let dy = n2.y - n1.y;
            let distSq = dx * dx + dy * dy;
            if (distSq < 1) {
              dx = (Math.random() - 0.5) * 2;
              dy = (Math.random() - 0.5) * 2;
              distSq = 2;
            }
            const dist = Math.sqrt(distSq);

            // 1. 刚体硬防重叠碰撞机制（Hard Body Collision Prevention）
            const padding = (n1.type === 'book' || n2.type === 'book') ? 28 : (n1.type === 'tag' || n2.type === 'tag') ? 20 : 12;
            const minDist = n1.radius + n2.radius + padding;

            if (dist < minDist) {
              const overlap = (minDist - dist);
              const nx = (dx / dist) * overlap * 0.45;
              const ny = (dy / dist) * overlap * 0.45;
              if (!n1.fx) {
                n1.x -= nx;
                n1.y -= ny;
                n1.vx -= nx * 0.2;
                n1.vy -= ny * 0.2;
              }
              if (!n2.fx) {
                n2.x += nx;
                n2.y += ny;
                n2.vx += nx * 0.2;
                n2.vy += ny * 0.2;
              }
            }

            // 2. 长程排斥力（书与书之间保持远距离大星系）
            const isBothBook = n1.type === 'book' && n2.type === 'book';
            const maxDist = isBothBook ? 1000 : 350;

            if (dist < maxDist) {
              const multiplier = isBothBook ? 12 : (n1.type === 'tag' || n2.type === 'tag') ? 3.5 : 1;
              const force = ((kRepel * multiplier) / (distSq + 30));
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

          // 中心柔和回拉力
          if (!n1.fx) {
            n1.vx -= n1.x * kCenter;
            n1.vy -= n1.y * kCenter;
          }
        }

        // B. 弹簧连接引力（拉拢相连节点）
        for (const l of simLinks) {
          const src = idToNode.get(l.source);
          const tgt = idToNode.get(l.target);
          if (!src || !tgt) continue;

          const dx = tgt.x - src.x;
          const dy = tgt.y - src.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;

          // 根据连线类型设定理想间距
          const idealDist = l.isCrossBook
            ? 180
            : src.type === 'book' || tgt.type === 'book'
            ? 60 + Math.sqrt(src.degree || 10) * 8
            : 55;

          const delta = dist - idealDist;
          const force = delta * kAttract * (l.isCrossBook ? 0.35 : 1);

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

        // C. 更新物理坐标并阻尼退火
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

        // 逐渐平滑降温
        sim.alpha *= 0.975;
      }

      // D. 帧渲染
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
  }, [isDarkMode, focusedNodeId, hoveredNode, labelDisplayMode]);

  // 3. Canvas 核心绘制渲染（媲美 Obsidian 与 Cosmos 顶级质感）
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
    const currentK = transformRef.current.k;
    const offsetX = width / 2 + transformRef.current.x;
    const offsetY = height / 2 + transformRef.current.y;
    ctx.translate(offsetX, offsetY);
    ctx.scale(currentK, currentK);

    // ==========================================
    // 1. 宇宙星际 / 宣纸雅致微点阵背景（Dot Matrix Grid）
    // ==========================================
    const gridSize = 45;
    const startX = Math.floor((-offsetX / currentK) / gridSize) * gridSize - gridSize;
    const endX = Math.ceil(((width - offsetX) / currentK) / gridSize) * gridSize + gridSize;
    const startY = Math.floor((-offsetY / currentK) / gridSize) * gridSize - gridSize;
    const endY = Math.ceil(((height - offsetY) / currentK) / gridSize) * gridSize + gridSize;

    ctx.fillStyle = isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)';
    for (let gx = startX; gx <= endX; gx += gridSize) {
      for (let gy = startY; gy <= endY; gy += gridSize) {
        ctx.beginPath();
        ctx.arc(gx, gy, 1.2 / currentK, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const simNodes = simulationRef.current.nodes;
    const simLinks = simulationRef.current.links;
    const idToNode = new Map<string, GraphNode>();
    for (const n of simNodes) idToNode.set(n.id, n);

    // 活跃/选中的相连节点集合（聚光灯效应）
    const activeConnectedIds = new Set<string>();
    const activeTarget = focusedNodeId || hoveredNode?.id || null;
    if (activeTarget) {
      activeConnectedIds.add(activeTarget);
      for (const l of simLinks) {
        if (l.source === activeTarget) activeConnectedIds.add(l.target);
        if (l.target === activeTarget) activeConnectedIds.add(l.source);
      }
    }

    // ==========================================
    // 2. 绘制星际引力连线
    // ==========================================
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
        // 激活的共鸣高亮光束
        ctx.strokeStyle = isDarkMode ? 'rgba(240, 120, 95, 0.95)' : 'rgba(208, 91, 66, 0.95)';
        ctx.lineWidth = (l.isCrossBook ? 2.8 : 2.0) / currentK;
      } else if (activeTarget) {
        // 未选中的弱化连线
        ctx.strokeStyle = isDarkMode ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)';
        ctx.lineWidth = 0.6 / currentK;
      } else if (l.isCrossBook) {
        // 跨书标签桥梁连线（耀眼的星际共振）
        ctx.strokeStyle = isDarkMode ? 'rgba(224, 108, 83, 0.65)' : 'rgba(208, 91, 66, 0.55)';
        ctx.lineWidth = 1.6 / currentK;
      } else {
        // 常规微弱轨道线
        ctx.strokeStyle = isDarkMode ? 'rgba(255, 255, 255, 0.09)' : 'rgba(0, 0, 0, 0.08)';
        ctx.lineWidth = 0.9 / currentK;
      }
      ctx.stroke();
    }

    // ==========================================
    // 3. 绘制节点（恒星书籍、标签枢纽、星芒高亮）
    // ==========================================
    // 文字防碰撞 AABB 矩形集合
    const drawnLabelBoxes: { x1: number; y1: number; x2: number; y2: number }[] = [];

    for (const n of simNodes) {
      const isSelected = n.id === focusedNodeId;
      const isHovered = n.id === hoveredNode?.id;
      const isNeighbor = activeConnectedIds.has(n.id);
      const isDimmed = activeTarget && !isNeighbor;

      ctx.save();
      ctx.globalAlpha = isDimmed ? 0.08 : 1.0;

      // A. 外发光光晕（Halo Effect）
      if (isSelected || isHovered) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius + 8, 0, Math.PI * 2);
        ctx.fillStyle =
          n.type === 'book'
            ? 'rgba(224, 108, 83, 0.35)'
            : n.type === 'tag'
            ? 'rgba(245, 166, 35, 0.35)'
            : `${n.color}55`;
        ctx.fill();
      }

      // B. 节点天体绘制
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);

      if (n.type === 'book') {
        // 书籍恒星：典雅的双色渐变或深色星体
        ctx.fillStyle = isDarkMode ? '#E06C53' : '#C74E35';
        ctx.fill();
        ctx.lineWidth = 2.5 / currentK;
        ctx.strokeStyle = isDarkMode ? '#FFFFFF' : '#FDFBF7';
        ctx.stroke();

        // 内部微发光圆核
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fill();
      } else if (n.type === 'tag') {
        // 标签枢纽：醒目的琥珀暖金色
        ctx.fillStyle = isDarkMode ? '#F5A623' : '#E69500';
        ctx.fill();
        ctx.lineWidth = 2 / currentK;
        ctx.strokeStyle = isDarkMode ? '#FFFFFF' : '#FDFBF7';
        ctx.stroke();
      } else {
        // 高亮星芒粒子：色彩语义发光点
        ctx.fillStyle = n.color;
        ctx.fill();
        if (isSelected || isHovered) {
          ctx.lineWidth = 2 / currentK;
          ctx.strokeStyle = isDarkMode ? '#FFFFFF' : '#333333';
          ctx.stroke();
        }
      }

      // C. 文本标签渲染（智能防碰撞 + 策略化显示）
      // 核心原则：高亮粒子默认不画文字！杜绝任何文字重叠地狱！
      let shouldDrawText = false;
      let labelText = '';

      if (n.type === 'book') {
        // 书籍恒星：始终显示书名缩写（最多 10 字）
        shouldDrawText = labelDisplayMode !== 'hover-only' || isHovered || isSelected;
        labelText = `《${n.label.length > 8 ? n.label.slice(0, 8) + '...' : n.label}》`;
      } else if (n.type === 'tag') {
        // 标签枢纽：始终显示标签名
        shouldDrawText = labelDisplayMode !== 'hover-only' || isHovered || isSelected;
        labelText = n.label;
      } else if (isSelected || isHovered) {
        // 划线节点：仅当鼠标悬停或点击选中时显示文本！
        shouldDrawText = true;
        labelText = n.label;
      } else if (labelDisplayMode === 'all' && currentK > 1.4 && !isDimmed) {
        // 仅在明确选择“全部显示”且深度放大时才显示极短摘要
        shouldDrawText = true;
        labelText = n.label.slice(0, 8) + '...';
      }

      if (shouldDrawText && labelText) {
        ctx.font =
          n.type === 'book'
            ? `bold ${Math.max(12, 13 / currentK)}px "Noto Serif SC", serif`
            : n.type === 'tag'
            ? `600 ${Math.max(11, 12 / currentK)}px sans-serif`
            : `${Math.max(10, 11 / currentK)}px sans-serif`;

        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        const textY = n.y + n.radius + (4 / currentK);
        const textMetrics = ctx.measureText(labelText);
        const textWidth = textMetrics.width;
        const textHeight = 14 / currentK;

        // AABB 防碰撞剔除检测：如果与已有文字重合，则略过非核心节点的文字
        const box = {
          x1: n.x - textWidth / 2 - 4,
          y1: textY - 2,
          x2: n.x + textWidth / 2 + 4,
          y2: textY + textHeight + 2
        };

        let hasCollision = false;
        if (!isSelected && !isHovered && n.type === 'highlight') {
          for (const b of drawnLabelBoxes) {
            if (!(box.x2 < b.x1 || box.x1 > b.x2 || box.y2 < b.y1 || box.y1 > b.y2)) {
              hasCollision = true;
              break;
            }
          }
        }

        if (!hasCollision) {
          drawnLabelBoxes.push(box);

          // 文字背景半透明微气泡底色
          ctx.fillStyle = isDarkMode ? 'rgba(26, 26, 26, 0.85)' : 'rgba(253, 251, 247, 0.9)';
          ctx.beginPath();
          ctx.roundRect(box.x1, box.y1, box.x2 - box.x1, box.y2 - box.y1, 4 / currentK);
          ctx.fill();

          // 文字本体
          ctx.fillStyle =
            n.type === 'book'
              ? isDarkMode ? '#FFB2A1' : '#A83B25'
              : n.type === 'tag'
              ? isDarkMode ? '#F5A623' : '#C77700'
              : isDarkMode ? '#E5E5E5' : '#37352F';
          ctx.fillText(labelText, n.x, textY);
        }
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
      const touchRadius = n.radius + (n.type === 'highlight' ? 8 : 4);
      if (dx * dx + dy * dy <= touchRadius * touchRadius) {
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
      simulationRef.current.alpha = 0.4; // 拖拽激活轻量退火
    } else {
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
        const n = dragRef.current.draggedNode;
        n.fx = x;
        n.fy = y;
        n.x = x;
        n.y = y;
        simulationRef.current.alpha = 0.3;
      } else {
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        transformRef.current.x = dragRef.current.startTransformX + dx;
        transformRef.current.y = dragRef.current.startTransformY + dy;
      }
      return;
    }

    const hovered = findNodeUnderMouse(x, y);
    setHoveredNode(hovered);
  };

  const handleMouseUp = () => {
    if (dragRef.current.draggedNode) {
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
    const newK = Math.min(3.5, Math.max(0.25, transformRef.current.k * zoomFactor));
    transformRef.current.k = newK;
    setZoomLevel(Math.round(newK * 100));
  };

  // 一键自适应铺满全屏视野（Fit to Screen）
  const handleFitToScreen = () => {
    const canvas = canvasRef.current;
    const simNodes = simulationRef.current.nodes;
    if (!canvas || simNodes.length === 0) {
      transformRef.current = { x: 0, y: 0, k: 0.95 };
      setZoomLevel(95);
      return;
    }

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of simNodes) {
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.y > maxY) maxY = n.y;
    }

    const spanX = Math.max(200, maxX - minX + 160);
    const spanY = Math.max(200, maxY - minY + 160);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const canvasW = canvas.parentElement?.clientWidth || 800;
    const canvasH = canvas.parentElement?.clientHeight || 600;

    const fitK = Math.min(1.8, Math.max(0.3, Math.min(canvasW / spanX, canvasH / spanY)));
    transformRef.current = {
      x: -centerX * fitK,
      y: -centerY * fitK,
      k: fitK
    };
    setZoomLevel(Math.round(fitK * 100));
  };

  const handleResetZoom = () => {
    transformRef.current = { x: 0, y: 0, k: 0.95 };
    setZoomLevel(95);
  };

  // 复制当前网络簇的所有相连高亮为 Markdown
  const handleCopyClusterMarkdown = async () => {
    if (!focusedNode || connectedAnnotations.length === 0) return;
    const lines = [
      `# 知识网络汇聚 · ${focusedNode.label}`,
      `> 关联思考节点数量：${connectedAnnotations.length} 条\n`
    ];

    for (const a of connectedAnnotations) {
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
      setIsCopiedCluster(true);
      setTimeout(() => setIsCopiedCluster(false), 2000);
    } catch (err) {
      console.error('Failed to copy cluster Markdown', err);
    }
  };

  // 7. 计算当前聚焦节点关联的所有高亮卡片（供右侧抽屉展示）
  const connectedAnnotations = useMemo(() => {
    if (!focusedNodeId) return [];

    if (focusedNodeId.startsWith('book:')) {
      const assetId = focusedNodeId.replace('book:', '');
      return annotations.filter(a => a.assetId === assetId);
    } else if (focusedNodeId.startsWith('tag:')) {
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

  const focusedNode = useMemo(() => {
    if (!focusedNodeId) return null;
    const existing = nodeMap.get(focusedNodeId);
    if (existing) return existing;

    if (focusedNodeId.startsWith('tag:')) {
      const tag = focusedNodeId.replace('tag:', '');
      const count = annotations.filter(a => (a.tags || []).includes(tag)).length;
      return {
        id: focusedNodeId,
        type: 'tag' as const,
        label: `#${tag}`,
        subLabel: `${count} 条高亮连接`,
        color: '#E06C53',
        radius: 18,
        degree: count,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0
      };
    } else if (focusedNodeId.startsWith('book:')) {
      const assetId = focusedNodeId.replace('book:', '');
      const b = bookMap.get(assetId);
      const count = annotations.filter(a => a.assetId === assetId).length;
      return {
        id: focusedNodeId,
        type: 'book' as const,
        label: b?.title || '未知书籍',
        subLabel: `${count} 条高亮`,
        color: '#E06C53',
        radius: 24,
        book: b,
        degree: count,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0
      };
    }
    return null;
  }, [focusedNodeId, nodeMap, annotations, bookMap]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-paper-bg dark:bg-night-bg text-paper-text dark:text-night-text select-none">
      {/* 顶部悬浮控制岛（Floating Frosted Glass HUD） */}
      <div className="flex flex-wrap items-center justify-between p-3.5 border-b border-paper-border/70 dark:border-night-border/70 bg-paper-card/85 dark:bg-night-card/85 backdrop-blur-md z-10 gap-3">
        {/* 左侧：标题、节点计数与拓扑模式切换胶囊 */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-paper-terracotta/10 dark:bg-night-terracotta/10 text-paper-terracotta dark:text-night-terracotta flex-shrink-0">
            <Waypoints className="w-5 h-5" />
          </div>

          <div>
            <h1 className="font-serif text-base font-bold flex items-center gap-2 text-paper-text dark:text-night-text">
              <span>知识网络图谱</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-paper-drawer dark:bg-night-drawer text-paper-muted dark:text-night-muted font-mono font-normal">
                {nodes.length} 节点 · {links.length} 连线
              </span>
            </h1>
            <p className="text-[11px] text-paper-muted dark:text-night-muted hidden md:block">
              同标签高亮自动在网络中聚簇互联，探索跨越书本边界的思想脉络
            </p>
          </div>

          {/* 拓扑模式切换器 */}
          <div className="flex items-center rounded-lg border border-paper-border dark:border-night-border overflow-hidden bg-paper-sidebar dark:bg-night-sidebar p-0.5 ml-2">
            <button
              onClick={() => {
                setGraphMode('book-galaxy');
                simulationRef.current.alpha = 1.0;
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-all ${
                graphMode === 'book-galaxy'
                  ? 'bg-paper-terracotta dark:bg-night-terracotta text-white shadow-xs'
                  : 'text-paper-muted hover:text-paper-text'
              }`}
              title="书籍星系拓扑：以各书为恒星引力核，划线星环围绕，跨书标签架起星际桥梁（强烈推荐）"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>书籍星系</span>
            </button>

            <button
              onClick={() => {
                setGraphMode('tag-hub');
                simulationRef.current.alpha = 1.0;
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-all ${
                graphMode === 'tag-hub'
                  ? 'bg-paper-terracotta dark:bg-night-terracotta text-white shadow-xs'
                  : 'text-paper-muted hover:text-paper-text'
              }`}
              title="标签星团模式：以打标标签为向心枢纽"
            >
              <Tag className="w-3.5 h-3.5" />
              <span>标签星团</span>
            </button>

            <button
              onClick={() => {
                setGraphMode('direct-mesh');
                simulationRef.current.alpha = 1.0;
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-all ${
                graphMode === 'direct-mesh'
                  ? 'bg-paper-terracotta dark:bg-night-terracotta text-white shadow-xs'
                  : 'text-paper-muted hover:text-paper-text'
              }`}
              title="高亮直连模式：同标签笔记之间两两直接拉线（Obsidian 经典模式）"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>高亮直连</span>
            </button>
          </div>
        </div>

        {/* 右侧：搜索过滤、显示设置与缩放控制器 */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* 搜索框 */}
          <div className="relative">
            <input
              type="text"
              value={searchKeyword}
              onChange={e => setSearchKeyword(e.target.value)}
              placeholder="搜索网络节点..."
              className="pl-7 pr-3 py-1 rounded-lg border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card text-xs focus:outline-none focus:ring-1 focus:ring-paper-terracotta w-28 sm:w-36 transition-all"
            />
            <Filter className="w-3.5 h-3.5 absolute left-2 top-2 text-paper-muted" />
          </div>

          {/* 标签过滤下拉（仅用于快速聚焦某个标签） */}
          <select
            value={selectedTagFilter}
            onChange={e => setSelectedTagFilter(e.target.value)}
            className="px-2 py-1 rounded-lg border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card text-xs focus:outline-none max-w-[130px] truncate"
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
            className="px-2 py-1 rounded-lg border border-paper-border dark:border-night-border bg-paper-card dark:bg-night-card text-xs focus:outline-none max-w-[130px] truncate"
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
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border transition-colors ${
              hideIsolated
                ? 'border-paper-terracotta/50 bg-paper-terracotta/10 text-paper-terracotta dark:text-night-terracotta'
                : 'border-paper-border dark:border-night-border text-paper-muted hover:text-paper-text'
            }`}
            title="隐藏没有任何连接的孤立笔记"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>仅看连接</span>
          </button>

          {/* 显示设置下拉菜单（文字显示策略） */}
          <div className="relative">
            <button
              onClick={() => setShowSettingsMenu(prev => !prev)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg border border-paper-border dark:border-night-border text-paper-muted hover:text-paper-text bg-paper-card dark:bg-night-card"
              title="图谱呈现设置"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>文字显示</span>
            </button>

            {showSettingsMenu && (
              <div className="absolute right-0 top-full mt-1 w-44 rounded-xl bg-paper-card dark:bg-night-card border border-paper-border dark:border-night-border shadow-xl p-1.5 z-40 text-xs space-y-1">
                <div className="px-2 py-1 font-semibold text-[11px] text-paper-muted">标签文字策略</div>
                <button
                  onClick={() => {
                    setLabelDisplayMode('hub-only');
                    setShowSettingsMenu(false);
                  }}
                  className={`w-full text-left px-2 py-1 rounded flex items-center justify-between ${
                    labelDisplayMode === 'hub-only'
                      ? 'bg-paper-terracotta/10 text-paper-terracotta font-medium'
                      : 'hover:bg-black/5 dark:hover:bg-white/5 text-paper-text'
                  }`}
                >
                  <span>仅核心与悬浮 (推荐)</span>
                  {labelDisplayMode === 'hub-only' && <Check className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => {
                    setLabelDisplayMode('hover-only');
                    setShowSettingsMenu(false);
                  }}
                  className={`w-full text-left px-2 py-1 rounded flex items-center justify-between ${
                    labelDisplayMode === 'hover-only'
                      ? 'bg-paper-terracotta/10 text-paper-terracotta font-medium'
                      : 'hover:bg-black/5 dark:hover:bg-white/5 text-paper-text'
                  }`}
                >
                  <span>仅鼠标悬浮显示</span>
                  {labelDisplayMode === 'hover-only' && <Check className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => {
                    setLabelDisplayMode('all');
                    setShowSettingsMenu(false);
                  }}
                  className={`w-full text-left px-2 py-1 rounded flex items-center justify-between ${
                    labelDisplayMode === 'all'
                      ? 'bg-paper-terracotta/10 text-paper-terracotta font-medium'
                      : 'hover:bg-black/5 dark:hover:bg-white/5 text-paper-text'
                  }`}
                >
                  <span>防重叠微标 (紧凑)</span>
                  {labelDisplayMode === 'all' && <Check className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}
          </div>

          {/* 缩放按钮群 */}
          <div className="flex items-center rounded-lg border border-paper-border dark:border-night-border overflow-hidden bg-paper-card dark:bg-night-card">
            <button
              onClick={() => {
                transformRef.current.k = Math.max(0.25, transformRef.current.k * 0.85);
                setZoomLevel(Math.round(transformRef.current.k * 100));
              }}
              className="p-1 hover:bg-black/5 dark:hover:bg-white/5 text-paper-muted"
              title="缩小"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleResetZoom}
              className="text-[11px] px-1 font-mono text-paper-muted min-w-[34px] text-center hover:text-paper-terracotta dark:hover:text-night-terracotta transition-colors"
              title="重置为 100% 原始大小"
            >
              {zoomLevel}%
            </button>
            <button
              onClick={() => {
                transformRef.current.k = Math.min(3.5, transformRef.current.k * 1.15);
                setZoomLevel(Math.round(transformRef.current.k * 100));
              }}
              className="p-1 hover:bg-black/5 dark:hover:bg-white/5 text-paper-muted"
              title="放大"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleFitToScreen}
              className="p-1 border-l border-paper-border dark:border-night-border hover:bg-black/5 dark:hover:bg-white/5 text-paper-muted"
              title="一键适应全屏居中"
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
          onDoubleClick={handleFitToScreen}
          onWheel={handleWheel}
          className="w-full h-full block"
        />

        {/* 当处于纯标签模式且当前书库 0 标签时的智能引导横幅 */}
        {graphMode === 'tag-hub' && availableTags.length === 0 && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 p-4 rounded-2xl bg-paper-card/95 dark:bg-night-card/95 border border-paper-border dark:border-night-border shadow-xl backdrop-blur-md max-w-md text-center space-y-2 z-20 animate-in fade-in">
            <div className="w-10 h-10 rounded-full bg-paper-terracotta/10 text-paper-terracotta flex items-center justify-center mx-auto">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="font-serif font-bold text-sm text-paper-text dark:text-night-text">
              当前书库划线尚未打上标签
            </h3>
            <p className="text-xs text-paper-muted leading-relaxed">
              标签星团拓扑依赖标签组织思想。推荐切换到【书籍星系】全景查看各书划线聚类，或点击左下角体验预置思维网络。
            </p>
            <div className="pt-1 flex items-center justify-center gap-2">
              <button
                onClick={() => setGraphMode('book-galaxy')}
                className="px-3 py-1.5 rounded-lg bg-paper-terracotta text-white text-xs font-medium hover:bg-paper-terracotta/90"
              >
                切换至「书籍星系」视图
              </button>
            </div>
          </div>
        )}

        {/* 鼠标悬浮气泡卡片（Interactive Tooltip HUD） */}
        {hoveredNode && !focusedNodeId && (
          <div
            className="absolute pointer-events-none p-3.5 rounded-2xl bg-paper-card/95 dark:bg-night-card/95 border border-paper-border dark:border-night-border shadow-2xl backdrop-blur-md max-w-sm text-xs space-y-2 z-30 transition-all"
            style={{
              left: Math.min(
                (canvasRef.current?.parentElement?.clientWidth || 800) - 340,
                Math.max(
                  20,
                  (canvasRef.current?.width || 0) / (window.devicePixelRatio * 2) +
                    transformRef.current.x +
                    hoveredNode.x * transformRef.current.k +
                    18
                )
              ),
              top: Math.min(
                (canvasRef.current?.parentElement?.clientHeight || 600) - 180,
                Math.max(
                  60,
                  (canvasRef.current?.height || 0) / (window.devicePixelRatio * 2) +
                    transformRef.current.y +
                    hoveredNode.y * transformRef.current.k -
                    35
                )
              )
            }}
          >
            <div className="flex items-center gap-2 font-bold">
              {hoveredNode.type === 'book' ? (
                <>
                  <BookOpen className="w-4 h-4 text-paper-terracotta dark:text-night-terracotta" />
                  <span className="font-serif text-sm">《{hoveredNode.book?.title || hoveredNode.label}》</span>
                </>
              ) : hoveredNode.type === 'tag' ? (
                <>
                  <Tag className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-semibold">{hoveredNode.label}</span>
                </>
              ) : (
                <>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: hoveredNode.color }} />
                  <span className="font-serif text-paper-muted dark:text-night-muted truncate max-w-[200px]">
                    {hoveredNode.subLabel}
                  </span>
                </>
              )}
            </div>

            {hoveredNode.type === 'book' ? (
              <div className="space-y-1">
                <p className="text-paper-muted text-[11px]">
                  著者：{hoveredNode.book?.author || '未知'} · 共计 {hoveredNode.degree} 条读书划线
                </p>
                <p className="text-[10px] text-paper-terracotta dark:text-night-terracotta pt-0.5">
                  👉 点击此恒星，右侧展开全书划线精读抽屉
                </p>
              </div>
            ) : hoveredNode.type === 'tag' ? (
              <div className="space-y-1">
                <p className="text-paper-muted text-[11px]">
                  共聚拢 {hoveredNode.degree} 条打上此标签的跨书思考
                </p>
                <p className="text-[10px] text-amber-600 dark:text-amber-400 pt-0.5">
                  👉 点击此枢纽，右侧汇聚所有相关摘录
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <p className="font-serif leading-relaxed line-clamp-3 text-paper-text/90 dark:text-night-text/90">
                  “{hoveredNode.annotation?.selectedText}”
                </p>
                {hoveredNode.annotation?.customNote && (
                  <p className="text-[11px] text-paper-muted dark:text-night-muted italic bg-black/5 dark:bg-white/5 p-1.5 rounded-lg">
                    💡 深度想法: {hoveredNode.annotation.customNote}
                  </p>
                )}
                {hoveredNode.annotation?.tags && hoveredNode.annotation.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {hoveredNode.annotation.tags.map(t => (
                      <span
                        key={t}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-paper-terracotta/10 text-paper-terracotta"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-paper-muted/80 pt-0.5">
                  💡 点击节点固定并展开相连思考网络
                </p>
              </div>
            )}
          </div>
        )}

        {/* 底部悬浮图例与手势指南 */}
        <div className="absolute left-4 bottom-4 p-2.5 rounded-xl bg-paper-card/85 dark:bg-night-card/85 border border-paper-border/60 dark:border-night-border/60 shadow-xs backdrop-blur-md text-[11px] flex items-center gap-3 text-paper-muted dark:text-night-muted pointer-events-none">
          <span className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-paper-terracotta border border-white dark:border-night-border shadow-2xs" />
            <span className="font-medium text-paper-text dark:text-night-text">书籍/标签枢纽</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F5A623]" />
            <span>读书高亮节点</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-paper-terracotta" />
            <span>跨书标签桥梁</span>
          </span>
          <span className="opacity-40">·</span>
          <span className="hidden sm:inline">滚轮缩放 · 双击重置居中 · 拖拽甩动</span>
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
                  {focusedNode.type === 'book'
                    ? '书籍星系核心'
                    : focusedNode.type === 'tag'
                    ? '标签网络中心'
                    : '高亮网络节点'}
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

            <div className="flex items-center gap-1">
              {focusedNode.type === 'book' && focusedNode.book && (
                <button
                  onClick={() => onSelectBook(focusedNode.book!)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-paper-terracotta text-white hover:bg-paper-terracotta/90 transition-colors shadow-2xs"
                  title="进入此书沉浸精读"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>精读本书</span>
                </button>
              )}

              {connectedAnnotations.length > 0 && (
                <button
                  onClick={handleCopyClusterMarkdown}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    isCopiedCluster
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400'
                      : 'border-paper-border dark:border-night-border hover:border-paper-terracotta text-paper-muted hover:text-paper-text'
                  }`}
                  title="一键复制本簇所有高亮为 Markdown 引用"
                >
                  {isCopiedCluster ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{isCopiedCluster ? '已复制' : '复制本簇'}</span>
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
