# Apple Books 笔记与高亮管理桌面软件（BookEcho）架构与设计规范

- **日期**：2026-11-10
- **平台**：macOS 桌面应用（Electron + React + TypeScript + SQLite）
- **定位**：个人读书精华馆 —— 集「零污染无感提取、按章节结构化精读、EPUB 原文前后上下文展开、色彩语义标签、每日漫游回顾（Daily Review）、高颜值金句卡片生成与无损 Markdown 导出」于一体的桌面端软件。

---

## 1. 核心设计目标与边界

### 1.1 核心目标（Goals）
1. **零手动导入、零污染读取**：自动从 macOS 本地 Apple Books 容器目录复制 SQLite 快照并提取书籍、高亮与批注，**绝不直接写入或锁死 Apple Books 原数据库**。
2. **还原阅读结构与原文语境**：
   - 将散乱的高亮按真实 EPUB 目录章节分组并按书中位置排序；
   - 针对本地无 DRM 的 EPUB 书籍，支持点击任意高亮**实时展开查看该句所在段落及前后各 1~2 个自然段的完整原文**。
3. **打通“输入 → 回顾 → 二次思考 → 输出”闭环**：
   - 支持将 Apple Books 的 5 种高亮颜色 + 下划线映射为自定义语义；
   - 支持在软件内为任意高亮打 `#标签`、撰写二次延伸思考；
   - 提供**每日回顾（Daily Review）**单卡专注复习模式；
   - 提供**无损结构化 Markdown 导出**（兼容标准 Markdown 与 Obsidian Callout 格式）及 **4 套高颜值金句卡片图片生成**。
4. **为轻量级模型（Flash）执行做好规范铺垫**：本设计文档显式规定所有数据库字段、SQL 查询、EPUB CFI 解析算法与视觉 Token，消除实现阶段的歧义。

### 1.2 非目标（Non-Goals / YAGNI 边界）
- 第一版**不开发**移动端（iOS/iPadOS）App（手机端划线通过系统 iCloud 自动同步至 Mac 后由本软件读取）。
- 第一版**不破解** Apple 书店购买书籍的 FairPlay DRM 加密（对 DRM 加密或未下载到本地的书籍，原文上下文展开功能自动优雅降级，仅展示高亮与批注）。
- 第一版**不引入**云端账号体系或强制联网依赖，100% 本地离线可用。

---

## 2. 系统总体架构与模块划分

系统采用 **Electron 主进程（Node.js 数据与文件引擎） + 预加载安全桥（ContextBridge IPC） + 渲染进程（React + TypeScript + Tailwind CSS）** 的三层隔离架构：

```
/Users/liyuteng/Documents/MyAPPs/AppleBook
├── electron/
│   ├── main.ts                  # Electron 窗口生命周期、IPC 注册与系统权限引导
│   ├── preload.ts               # 强类型 window.bookEchoAPI 暴露桥接
│   ├── services/
│   │   ├── snapshotSyncer.ts    # Apple Books SQLite 快照复制与只读提取器
│   │   ├── epubContextEngine.ts # EPUB OPF/TOC 章节树解析与 CFI 原文前后段落提取器
│   │   ├── userVaultDb.ts       # 本地扩展库 user_vault.sqlite 读写管理
│   │   └── markdownExporter.ts  # 单书/批量 Markdown 序列化与文件保存
│   └── types/
│       └── ipc.ts               # 主进程与渲染进程共享的数据结构与接口契约
├── src/
│   ├── App.tsx                  # 三栏/双栏自适应主框架与路由状态
│   ├── styles/
│   │   └── tokens.css           # 纸书级排版色彩、字体栈与微阴影设计变量
│   ├── components/
│   │   ├── Sidebar.tsx          # 左侧导航栏（书架/每日回顾/搜索/颜色语义/标签树）
│   │   ├── BookshelfView.tsx    # 全部书籍网格与阅读统计视图
│   │   ├── BookDetailView.tsx   # 单书沉浸式笔记流（按章节分组 + 顶栏操作）
│   │   ├── HighlightCard.tsx    # 高亮卡片（含颜色语义、二次批注、标签、原文上下文抽屉）
│   │   ├── DailyReviewView.tsx  # 每日漫游回顾单卡专注视图（含快捷键支持）
│   │   ├── QuoteCardModal.tsx   # 高颜值金句卡片生成器（4套模板 + 2x/3x PNG 导出/复制）
│   │   ├── ExportModal.tsx      # Markdown 导出预览与格式配置弹窗
│   │   └── PermissionGuide.tsx  # macOS 磁盘访问权限引导与手动目录授权组件
└── tests/
    ├── fixtures/                # 模拟 BKLibrary.sqlite、AEAnnotation.sqlite 与样例 .epub
    ├── snapshotSyncer.test.ts   # 数据库解析与 CoreData 时间戳转换测试
    ├── epubContextEngine.test.ts# EPUB 章节定位与前后文段落提取测试
    ├── userVaultDb.test.ts      # 双库合并、标签与每日回顾算法测试
    └── markdownExporter.test.ts # 标准/Obsidian Markdown 导出格式测试
```

---

## 3. 底层数据流与核心算法规范

### 3.1 Apple Books 数据源路径与快照机制（`snapshotSyncer.ts`）

1. **默认系统路径**：
   - 书库目录：`~/Library/Containers/com.apple.iBooksX/Data/Documents/BKLibrary/`（匹配 `BKLibrary*.sqlite`）
   - 标注目录：`~/Library/Containers/com.apple.iBooksX/Data/Documents/AEAnnotation/`（匹配 `AEAnnotation*.sqlite`）
   - EPUB 资源扫描目录：
     - `ZBKLIBRARYASSET.ZPATH` 指向的绝对路径；
     - `~/Library/Mobile Documents/iCloud~com~apple~iBooks/Documents/`；
     - `~/Library/Containers/com.apple.iBooksX/Data/Documents/BKLibrary/`。
2. **安全快照流程**：
   - 每次同步时，在应用 `app.getPath('userData')/snapshots/` 下创建带时间戳或固定名称的副本目录；
   - 将匹配的 `.sqlite` 以及同名的 `.sqlite-wal`、`.sqlite-shm`（若存在）完整复制到快照目录；
   - 使用 `better-sqlite3` 以 `{ readonly: true }` 模式打开快照数据库。
3. **CoreData 时间戳转换公式**：
   - Apple CoreData 基准时间为 `2001-01-01 00:00:00 UTC`，与 Unix Epoch 相差 `978307200` 秒：
   - `unixTimestampMs = Math.round((coreDataSeconds + 978307200) * 1000)`。
4. **核心 SQL 提取规范**：
   - **书籍表查询（`BKLibrary`）**：
     ```sql
     SELECT
       ZASSETID AS assetId,
       ZTITLE AS title,
       ZAUTHOR AS author,
       ZGENRE AS genre,
       ZPATH AS epubPath,
       ZREADINGPROGRESS AS readingProgress,
       ZLASTOPENDATE AS lastOpenDate,
       ZCOVERURL AS coverUrl
     FROM ZBKLIBRARYASSET
     WHERE ZTITLE IS NOT NULL AND ZASSETID IS NOT NULL;
     ```
   - **高亮与批注表查询（`AEAnnotation`）**：
     ```sql
     SELECT
       ZANNOTATIONUUID AS uuid,
       ZANNOTATIONASSETID AS assetId,
       ZANNOTATIONSELECTEDTEXT AS selectedText,
       ZANNOTATIONNOTE AS note,
       ZANNOTATIONREPRESENTATIVETEXT AS representativeText,
       ZANNOTATIONSTYLE AS style,
       ZANNOTATIONISUNDERLINE AS isUnderline,
       ZANNOTATIONLOCATION AS locationCfi,
       ZANNOTATIONCREATIONDATE AS creationDate,
       ZANNOTATIONMODIFICATIONDATE AS modificationDate,
       ZFUTUREPROOFING5 AS chapterTitleHint
     FROM ZAEANNOTATION
     WHERE ZANNOTATIONDELETED = 0
       AND (
         (ZANNOTATIONSELECTEDTEXT IS NOT NULL AND TRIM(ZANNOTATIONSELECTEDTEXT) != '')
         OR (ZANNOTATIONNOTE IS NOT NULL AND TRIM(ZANNOTATIONNOTE) != '')
       )
     ORDER BY ZANNOTATIONASSETID ASC, ZANNOTATIONLOCATION ASC, ZANNOTATIONCREATIONDATE ASC;
     ```
   - **颜色样式编码映射（`ZANNOTATIONSTYLE` & `ZANNOTATIONISUNDERLINE`）**：
     - 若 `isUnderline == 1` → `'underline'`（默认语义：重点下划线，色值 `#D9534F`）
     - `style == 1` → `'green'`（默认语义：行动与实践，色值 `#5CB85C`）
     - `style == 2` → `'blue'`（默认语义：概念与背景，色值 `#4A90E2`）
     - `style == 3` → `'yellow'`（默认语义：核心论点，色值 `#F5A623`）
     - `style == 4` → `'pink'`（默认语义：灵感与金句，色值 `#E86F88`）
     - `style == 5` → `'purple'`（默认语义：存疑与深思，色值 `#9B6B9E`）
     - 其他值回退为 `'yellow'`。

---

### 3.2 本地扩展数据库规范（`userVaultDb.ts`）

存储在 `app.getPath('userData')/user_vault.sqlite`，包含以下 4 张表：

```sql
-- 1. 针对单条高亮的扩展信息（二次想法、星标、每日回顾状态、解析后的章节与位置排序权重）
CREATE TABLE IF NOT EXISTS annotation_meta (
  annotation_uuid TEXT PRIMARY KEY,
  custom_note TEXT DEFAULT '',
  is_starred INTEGER DEFAULT 0,
  review_status TEXT DEFAULT 'active', -- 'active' | 'mastered' | 'archived'
  review_count INTEGER DEFAULT 0,
  last_reviewed_at INTEGER DEFAULT NULL,
  resolved_chapter TEXT DEFAULT NULL,
  sort_index REAL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

-- 2. 标签字典与关联表
CREATE TABLE IF NOT EXISTS annotation_tags (
  annotation_uuid TEXT NOT NULL,
  tag_name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (annotation_uuid, tag_name)
);

-- 3. 色彩语义自定义配置表
CREATE TABLE IF NOT EXISTS color_semantics (
  color_key TEXT PRIMARY KEY, -- 'yellow' | 'green' | 'blue' | 'pink' | 'purple' | 'underline'
  label TEXT NOT NULL,
  hex_color TEXT NOT NULL
);

-- 4. 应用配置表（记录自定义 Apple Books 数据目录路径、最后同步时间、偏好主题）
CREATE TABLE IF NOT EXISTS app_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL
);
```

---

### 3.3 EPUB 章节树与“原文前后文展开”算法（`epubContextEngine.ts`）

macOS 上的 Apple Books 存放的 `.epub` 有两种物理形态：
- **形态 1（解压目录包）**：路径名为 `xxx.epub`，但实际上是一个文件夹，内部直接包含 `META-INF/container.xml` 和 `.opf` 文件；
- **形态 2（标准 ZIP 归档文件）**：路径名为 `xxx.epub` 的单文件 ZIP 包。
解析器必须同时兼容这两种形态（先检测 `fs.statSync(epubPath).isDirectory()`，若是目录直接按文件读取；若是文件则使用轻量 ZIP 读取器读取条目）。

#### 算法步骤：
1. **定位 OPF 与 Spine（阅读顺序）**：
   - 读取 `META-INF/container.xml` 获取 `rootfile` 的 `full-path`（即 `.opf` 文件路径）。
   - 解析 `.opf` 中的 `<manifest>`（建立 `id -> href` 映射）与 `<spine>`（建立 `spineIndex -> idref -> href` 顺序列表）。
2. **解析章节目录（TOC）**：
   - 优先解析 EPUB3 的 `nav.xhtml`（`<nav epub:type="toc">`）或 EPUB2 的 `toc.ncx`（`<navMap>`），建立 `chapterHref -> chapterTitle` 映射表。
3. **解析 `ZANNOTATIONLOCATION`（EPUB CFI）还原章节与排序权重**：
   - 典型 CFI 格式：`epubcfi(/6/14[chapter_id]!/4/2/10/1:24)`。
   - 提取 `!` 前面的 Spine 步进值（如 `/6/14` 中的 `14`）：在 EPUB CFI 规范中，`<spine>` 是 `<package>` 的第 3 个子元素（`/6`），其下的第 `N` 个 `<itemref>` 对应偶数值 `2 * N`（因此 `14` 对应第 `7` 个 spine 项，0-based 索引为 `14 / 2 - 1 = 6`）。
   - 通过该索引直接找到对应的 XHTML 文件与章节标题，并利用 `!` 后面的路径数字序列计算出一个精确的浮点数 `sort_index`，确保同一章节内的高亮严格按照原文先后顺序排列。
   - 若 `ZFUTUREPROOFING5` 已包含有效章节名，优先作为兜底补充。
4. **按需提取原文前后上下文（`getHighlightContext(assetId, locationCfi, selectedText)`）**：
   - **步骤 1（定位章节 XHTML）**：通过 CFI 的 Spine 索引定位目标 XHTML 文件（若 CFI 缺失，则遍历章节文件搜索包含归一化 `selectedText` 的 XHTML）。
   - **步骤 2（提取段落序列）**：将目标 XHTML 解析为块级段落列表（提取 `<p>`、`<li>`、`<blockquote>`、`<h1>`~`<h6>` 的纯文本，去除多余空白但保留自然段边界）。
   - **步骤 3（定位目标段与前后段）**：
     - 首先尝试通过 CFI `!` 后的 DOM 路径找到所在块级节点；
     - 同时用归一化文本匹配（去除标点与空白差异）在段落列表中定位包含 `selectedText` 的段落索引 `targetIdx`（兼容跨 `<span>`/`<em>` 标签的高亮）；
     - 截取 `paragraphs.slice(Math.max(0, targetIdx - 2), targetIdx)` 作为 `beforeParagraphs`（前 1~2 段），`paragraphs[targetIdx]` 作为 `currentParagraph`，`paragraphs.slice(targetIdx + 1, targetIdx + 3)` 作为 `afterParagraphs`（后 1~2 段）。
   - **步骤 4（返回结构）**：
     ```ts
     interface HighlightContextResult {
       available: boolean;
       reason?: 'DRM_PROTECTED' | 'FILE_NOT_DOWNLOADED' | 'NOT_FOUND';
       chapterTitle?: string;
       beforeParagraphs: string[];
       currentParagraph: string;
       selectedText: string;
       afterParagraphs: string[];
     }
     ```

---

## 4. 视觉设计规范与四大核心功能界面

### 4.1 视觉设计 Token（杜绝廉价 AI 模板感，采用温暖纸书美学）
- **色彩系统**：
  - **浅色模式（羊皮纸阅读主题）**：背景主色 `#FAF7F2`、侧边栏背景 `#F3EFE6`、卡片表面 `#FFFFFF`、原文展开区底色 `#F6F2E9`、主文字 `#1E1D1A`、次要文字 `#6E6A63`、边框色 `#E6E1D6`、品牌强调色 `#B85D3B`（赤陶棕）。
  - **深色模式（静谧夜读主题）**：背景主色 `#141413`、侧边栏背景 `#1C1C1A`、卡片表面 `#222220`、原文展开区底色 `#191917`、主文字 `#EAE6DF`、次要文字 `#9A958C`、边框色 `#302F2C`、品牌强调色 `#D97757`。
- **字体栈**：
  - **阅读正文与高亮句子（衬线体）**：`'Songti SC', 'STSong', 'New York', 'Georgia', serif`（字号 `16.5px`，行高 `1.75`）。
  - **界面导航、标签与元数据（无衬线体）**：`-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Inter', sans-serif`。
  - **统计数字与时间戳（等宽修饰）**：`font-variant-numeric: tabular-nums`。

### 4.2 四大核心视图交互规范
1. **书架与单书精读视图（`BookshelfView` & `BookDetailView`）**：
   - 支持按“最近阅读”、“高亮数量”、“书名”排序；
   - 单书详情页顶部显示书籍元数据、5 色高亮分布比例条、`↗ 在 Apple Books 中打开`（调用 `shell.openPath(epubPath)` 或 `ibooks://`）、`📤 导出 Markdown`；
   - 主体按章节折叠/展开，每张 `HighlightCard` 包含：左侧 4px 语义色条、色彩语义胶囊、衬线体高亮原文、Apple Books 原生批注、本地 `#标签` 编辑与二次思考输入框，以及底部的 `📖 展开原文语境` 抽屉开关。
2. **每日回顾视图（`DailyReviewView`）**：
   - 每次生成 6 条待回顾卡片，计分公式：
     $$\text{Score} = (\text{距上次复习天数}) \times 1.5 + (\text{是否有批注} ? 15 : 0) + (\text{是否星标} ? 20 : 0) - (\text{已复习次数} \times 5)$$
   - 提供居中大卡片专注阅读、直接展开原文语境、快捷打标按钮（`💡 很有启发 / 星标`、`✅ 已内化`、`⏭️ 下一条`），支持键盘左右方向键与空格键操作。
3. **高颜值金句卡片工作台（`QuoteCardModal`）**：
   - 内置 4 套精细排版的 CSS 模板：`经典纸书（Classic Paper）`、`瑞士极简（Swiss Grid）`、`暗夜流光（Obsidian Gold）`、`森林晨雾（Sage Editorial）`；
   - 支持切换宽高比（自适应长图 / 3:4 小红书比例）、开关批注与章节信息；
   - 点击「复制图片」或「保存高清 PNG」时，以 2.5 倍像素密度渲染为 PNG Buffer，通过 Electron 原生 `clipboard.writeImage` 写入系统剪贴板或弹出保存对话框。
4. **无损 Markdown 导出器（`ExportModal` & `markdownExporter.ts`）**：
   - 支持切换两种预设模板：
     - **标准精排 Markdown**：清晰的一级书名、二级章节标题、`>` 引用块高亮、粗体批注与标签；
     - **Obsidian 增强格式**：包含 YAML Frontmatter（`title`, `author`, `highlights_count`, `exported_at`）以及 `> [!quote] 🟡 核心论点` Callout 语法，方便直接放入 Obsidian 知识库。

---

## 5. 异常处理与验证方案

1. **macOS 磁盘权限异常（`PermissionGuide.tsx`）**：
   - 当读取 `~/Library/Containers/com.apple.iBooksX` 抛出 `EPERM` 或 `EACCES` 时，界面自动展示优雅的权限配置向导：
     - 按钮 1：**一键打开系统「完全磁盘访问权限」设置**（调用 `shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles')`）；
     - 按钮 2：**手动选择数据文件夹**（调用 `dialog.showOpenDialog` 允许用户直接选中 `iBooksX/Data/Documents` 或任意自定义数据备份目录）；
     - 按钮 3：**加载内置演示书库**（一键加载预设的多本书籍与包含完整 EPUB 上下文的样例数据，方便随时体验和测试全部功能）。
2. **自动化测试标准（Vitest）**：
   - 单元测试必须 100% 覆盖：`snapshotSyncer`（CoreData 时间转换、已删除标注过滤）、`epubContextEngine`（CFI 章节解析、跨标签段落上下文提取、DRM/缺失文件优雅降级）、`userVaultDb`（二次批注与标签持久化、每日回顾打分排序）、`markdownExporter`（标准与 Obsidian 格式生成）。
