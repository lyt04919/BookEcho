# BookEcho — 个人读书精华馆

> 专为 macOS **Apple Books** 打造的本地优先（Local-first）高亮沉淀、跨书知识网络与阅读洞察桌面工作室。

BookEcho 通过安全只读快照机制读取本机 Apple Books 容器数据库与本地 EPUB 资源，将分散在各本书籍中的划线高亮、想法批注、阅读时长与年度目标汇聚于一处，帮助你把碎片划线转化为可检索、可关联、可导出的长期知识资产。

---

## 核心功能

- **书架与藏书管理**
  - 自动提取 Apple Books 书库封面、阅读进度与笔记统计
  - 支持书架范围筛选（全部藏书 / 有笔记的书 / 重点书单）、排序（最近阅读 / 笔记数量 / 书名）以及书籍隐藏管理
- **单书精读与 EPUB 原文语境回溯**
  - 按章节流式呈现划线卡片，支持颜色语义筛选、星标与关键词检索
  - 基于 EPUB CFI 精确定位并还原高亮句子前后段落的**原文语境**，无需跳转即可看清上下文
  - 无划线章节提供极简空状态引导并支持一键唤起 Apple Books 阅读
- **知识网络与跨书主题聚合**
  - 支持自定义 `#标签`、重命名/删除与跨书串联
  - 提供「按标签分组」「全部平铺」「按书籍分组」三种视图与节点关联抽屉
- **阅读足迹与 Apple Books 时长同步**
  - **真日历热力图**：52 周 × 7 天年度矩阵，支持按年份切换及「按划线笔记 / 按阅读时长」双维度切换
  - **Apple Books 阅读时长同步**：解析本地 `BooksMessages.sqlite` 与 CRDT `ReadingHistoryModel` 二进制档案，呈现今日阅读进度、累计时长、目标连续达标天数与年度完书目标
  - **阅读节律与思考深度**：自动统计批注深度思考率、24 小时阅读生物钟与周内阅读节律，点击任意日期可回溯当日阅读时长、在读书籍及完整笔记
- **多形态输出与分享**
  - 支持 **Markdown 一键导出**（Obsidian Callout 增强格式 / 标准 Markdown 引用格式）
  - 内置**金句卡片设计工坊**（经典/瑞士/黑曜石/鼠尾草多套模板），支持导出高清 PNG 图片
- **偏好设置与外观主题（`⌘,`）**
  - 支持浅色羊皮纸（Paper）与深色夜读（Night）双主题持久化切换
  - 支持 6 种划线颜色的思考语义标签与 Hex 配色自定义（内置多种精读流预设）
  - 支持更换或重置 Apple Books 数据源目录，内置完整的体验测试数据（Demo Mode）

---

## 技术栈与架构

- **桌面端容器**：Electron 33（严格 `contextIsolation: true`、`nodeIntegration: false` 安全隔离）
- **前端界面**：React 18 + TypeScript 5 + Tailwind CSS 3 + Lucide Icons
- **数据层与解析引擎**：
  - `SnapshotSyncer`：通过快照复制（含 WAL/SHM）安全只读提取 `BKLibrary` 与 `AEAnnotation`
  - `ReadingStatsSyncer`：解码 Apple `BooksMessages.sqlite` 与 `CRDTModelSync-ReadingHistoryModel`（Protobuf CRDT）
  - `EpubContextEngine`：基于 `adm-zip` 与 `fast-xml-parser` 解析 EPUB 目录、封面与上下文语境
  - `UserVaultDb`：本地 `better-sqlite3` 存储用户的自定义思考批注、星标、标签、配色语义与偏好设置
  - `MarkdownExporter`：格式化单书与精选合集导出

---

## 本地优先与隐私安全

- **100% 本地运行**：所有数据库解析、EPUB 原文提取及个人笔记存储均在本地 Mac 磁盘完成，零云端上传、零遥测追踪。
- **只读不写原生库**：始终通过快照副本读取 Apple Books 系统容器文件，绝不锁定或修改原生 Apple Books 数据。

---

## 开发与构建

### 环境要求

- macOS（读取 Apple Books 本地数据库）
- Node.js 18+

### 常用命令

```bash
# 安装依赖
npm install

# 启动本地开发模式（Vite + Electron）
npm run dev

# 运行全量单元测试与集成测试
npm test

# TypeScript 类型检查与生产构建
npm run build

# 打包为 macOS 安装包（dmg / zip，输出至 release/）
npm run package
```

---

## 快捷键

- `⌘ ,`：打开 / 关闭偏好设置
- `⌘ K`：唤起全局探索与检索
- `Esc`：关闭弹窗或返回上一级视图
