# Apple Books 笔记与高亮管理桌面软件（BookEcho）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个基于 Electron + React + TypeScript + SQLite 的 macOS 桌面端应用（BookEcho），实现对 Apple Books 本地高亮与笔记的只读安全提取、按真实 EPUB 章节与先后位置结构化还原、未加密 EPUB 原文前后上下文展开、色彩语义标签管理、每日漫游回顾（Daily Review）、4 套高颜值金句分享卡片生成与无损 Markdown 导出。

**Architecture:** 采用 Electron 主进程（Node.js 本地文件与 SQLite 引擎）+ 安全 Preload IPC 桥接 + React (TypeScript + Tailwind CSS) 沉浸式纸书美学界面的三层隔离架构。使用快照机制隔离 Apple Books 原生只读库，配合轻量 `user_vault.sqlite` 存储用户二次思考与回顾状态，通过纯 TypeScript 解析 EPUB 规范与 CFI 坐标提取段落语境。

**Tech Stack:** Electron 33+, React 18+, TypeScript 5+, Tailwind CSS 3+, better-sqlite3, adm-zip, fast-xml-parser, html-to-image (或 canvas/SVG 渲染引擎), Vitest.

**Spec:** [`docs/superpowers/specs/2026-11-10-apple-books-notes-design.md`](file:///Users/liyuteng/Documents/MyAPPs/AppleBook/docs/superpowers/specs/2026-11-10-apple-books-notes-design.md)

## Global Constraints

- **安全边界**：绝对不得以可写模式打开任何 Apple Books 原生 `.sqlite` 数据库；必须先复制 `.sqlite`、`-wal`、`-shm` 快照后再只读查询。
- **时间戳转换**：Apple CoreData 纪元偏移为 `978307200` 秒（`unixMs = Math.round((coreDataSec + 978307200) * 1000)`）。
- **色彩语义映射**：`isUnderline=1` 为 `underline`；`style` 1~5 依次映射为 `green`、`blue`、`yellow`、`pink`、`purple`。
- **美学规范**：严格遵循规范文档定义的羊皮纸浅色（`#FAF7F2`）与静谧深色（`#141413`）设计 Token，正文高亮强制采用衬线体（`Songti SC, STSong, Georgia, serif`）。
- **工程约束**：全任务采用严格 TDD，代码无省略占位符（禁止 TODO / TBD），每个任务均带独立单元测试或构建验证与 Git 提交。

---

### Task 1: 工程脚手架与构建工具链初始化 (Electron + Vite + React + Tailwind + Vitest)

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `tailwind.config.js`
- Create: `postcss.config.js`
- Create: `electron-builder.json5`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Test: `tests/setup.test.ts`

**Interfaces:**
- Consumes: None
- Produces: `npm run build`, `npm test`, `npm run dev:electron` 可执行的工程骨架与测试框架。

- [ ] **Step 1: 编写基础环境与依赖配置文件**

创建 `package.json`:
```json
{
  "name": "book-echo",
  "version": "1.0.0",
  "description": "Apple Books Notes & Highlights Studio for macOS",
  "main": "dist-electron/main.js",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "adm-zip": "^0.5.16",
    "better-sqlite3": "^11.8.1",
    "clsx": "^2.1.1",
    "fast-xml-parser": "^4.5.3",
    "html-to-image": "^1.11.11",
    "lucide-react": "^0.475.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "tailwind-merge": "^3.0.1"
  },
  "devDependencies": {
    "@types/adm-zip": "^0.5.7",
    "@types/better-sqlite3": "^7.6.12",
    "@types/node": "^22.13.1",
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "electron": "^33.2.1",
    "postcss": "^8.5.1",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.7.3",
    "vite": "^6.1.0",
    "vite-plugin-electron": "^0.29.0",
    "vite-plugin-electron-renderer": "^0.14.6",
    "vitest": "^3.0.5"
  }
}
```

创建 `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@electron/*": ["electron/*"]
    }
  },
  "include": ["src", "electron", "tests"]
}
```

创建 `vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['better-sqlite3']
            }
          }
        }
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          options.reload();
        },
        vite: {
          build: {
            outDir: 'dist-electron'
          }
        }
      }
    ]),
    renderer()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@electron': path.resolve(__dirname, './electron')
    }
  }
});
```

创建 `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node'
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@electron': path.resolve(__dirname, './electron')
    }
  }
});
```

创建 `tailwind.config.js`:
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        paper: {
          bg: '#FAF7F2',
          sidebar: '#F3EFE6',
          card: '#FFFFFF',
          drawer: '#F6F2E9',
          border: '#E6E1D6',
          text: '#1E1D1A',
          muted: '#6E6A63',
          terracotta: '#B85D3B'
        },
        night: {
          bg: '#141413',
          sidebar: '#1C1C1A',
          card: '#222220',
          drawer: '#191917',
          border: '#302F2C',
          text: '#EAE6DF',
          muted: '#9A958C',
          terracotta: '#D97757'
        }
      },
      fontFamily: {
        serif: ['Songti SC', 'STSong', 'New York', 'Georgia', 'serif'],
        sans: ['-apple-system', 'BlinkMacSystemFont', 'PingFang SC', 'Inter', 'sans-serif']
      }
    }
  },
  plugins: []
};
```

创建 `postcss.config.js`:
```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
};
```

创建 `index.html`:
```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>BookEcho - Apple Books Notes</title>
  </head>
  <body class="bg-paper-bg text-paper-text antialiased select-none">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

创建 `src/main.tsx`:
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/tokens.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

创建 `src/App.tsx`:
```tsx
import React from 'react';

export default function App() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-paper-bg text-paper-text">
      <main className="flex-1 flex items-center justify-center p-8">
        <h1 className="text-2xl font-serif">BookEcho 初始化就绪</h1>
      </main>
    </div>
  );
}
```

创建 `src/styles/tokens.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --color-paper-bg: #FAF7F2;
  --color-paper-sidebar: #F3EFE6;
  --color-paper-card: #FFFFFF;
  --color-paper-drawer: #F6F2E9;
  --color-paper-border: #E6E1D6;
  --color-paper-text: #1E1D1A;
  --color-paper-muted: #6E6A63;
  --color-terracotta: #B85D3B;
}

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Inter", sans-serif;
  -webkit-font-smoothing: antialiased;
}
```

- [ ] **Step 2: 编写脚手架配置验证测试**

创建 `tests/setup.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';

describe('Project Toolchain Setup', () => {
  it('should verify vitest runner and environment', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 3: 安装依赖并运行测试验证**

运行:
```bash
npm install
npm test
```
预期: PASS

- [ ] **Step 4: 提交脚手架初始化代码**

```bash
git add .
git commit -m "chore: scaffold project with electron, react, tailwind, and vitest"
```

---

### Task 2: 核心数据模型契约与 Mock 测试基准数据

**Files:**
- Create: `electron/types/ipc.ts`
- Create: `tests/fixtures/mockDbGenerator.ts`
- Test: `tests/fixtures.test.ts`

**Interfaces:**
- Consumes: None
- Produces: `electron/types/ipc.ts` 导出的全局类型（`BookItem`, `AnnotationItem`, `HighlightContextResult`, `ColorSemanticConfig`, `ReviewStats`），以及生成模拟 Apple Books 数据库与测试 EPUB 目录的工具函数。

- [ ] **Step 1: 定义全套强类型契约**

创建 `electron/types/ipc.ts`:
```typescript
export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'purple' | 'underline';

export interface BookItem {
  assetId: string;
  title: string;
  author: string | null;
  genre: string | null;
  epubPath: string | null;
  readingProgress: number;
  lastOpenDateMs: number | null;
  coverUrl: string | null;
  highlightsCount: number;
}

export interface AnnotationItem {
  uuid: string;
  assetId: string;
  selectedText: string;
  note: string | null;
  representativeText: string | null;
  colorKey: HighlightColor;
  locationCfi: string | null;
  chapterTitle: string;
  creationDateMs: number;
  modificationDateMs: number;
  sortIndex: number;
  // 来自用户扩展库的数据
  customNote?: string;
  isStarred?: boolean;
  reviewStatus?: 'active' | 'mastered' | 'archived';
  reviewCount?: number;
  lastReviewedAtMs?: number | null;
  tags?: string[];
}

export interface HighlightContextResult {
  available: boolean;
  reason?: 'DRM_PROTECTED' | 'FILE_NOT_DOWNLOADED' | 'NOT_FOUND';
  chapterTitle?: string;
  beforeParagraphs: string[];
  currentParagraph: string;
  selectedText: string;
  afterParagraphs: string[];
}

export interface ColorSemanticConfig {
  colorKey: HighlightColor;
  label: string;
  hexColor: string;
}

export interface DailyReviewStats {
  totalActive: number;
  reviewedToday: number;
  streakDays: number;
}

export interface BookEchoAPI {
  // 书架与高亮读取
  getBooks: () => Promise<BookItem[]>;
  getBookAnnotations: (assetId: string) => Promise<AnnotationItem[]>;
  searchAnnotations: (keyword: string) => Promise<AnnotationItem[]>;
  getHighlightContext: (assetId: string, locationCfi: string, selectedText: string) => Promise<HighlightContextResult>;

  // 用户扩展操作
  updateAnnotationMeta: (uuid: string, updates: { customNote?: string; isStarred?: boolean }) => Promise<void>;
  addTag: (uuid: string, tag: string) => Promise<void>;
  removeTag: (uuid: string, tag: string) => Promise<void>;
  getAllTags: () => Promise<string[]>;

  // 每日回顾
  getDailyReviewQueue: (limit?: number) => Promise<AnnotationItem[]>;
  submitReviewResult: (uuid: string, result: 'remembered' | 'mastered' | 'reset') => Promise<void>;

  // 色彩配置与系统
  getColorSemantics: () => Promise<ColorSemanticConfig[]>;
  updateColorSemantic: (colorKey: HighlightColor, label: string) => Promise<void>;
  openInAppleBooks: (assetId: string, epubPath?: string | null) => Promise<boolean>;
  selectCustomDataDir: () => Promise<string | null>;
  exportMarkdown: (assetId: string, format: 'standard' | 'obsidian') => Promise<{ success: boolean; filePath?: string }>;
}

declare global {
  interface Window {
    bookEchoAPI: BookEchoAPI;
  }
}
```

- [ ] **Step 2: 编写测试基准数据生成器**

创建 `tests/fixtures/mockDbGenerator.ts`:
```typescript
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export function createMockAppleBooksDatabases(tempDir: string) {
  const bkDir = path.join(tempDir, 'BKLibrary');
  const aeDir = path.join(tempDir, 'AEAnnotation');
  fs.mkdirSync(bkDir, { recursive: true });
  fs.mkdirSync(aeDir, { recursive: true });

  const bkDbPath = path.join(bkDir, 'BKLibrary.sqlite');
  const aeDbPath = path.join(aeDir, 'AEAnnotation.sqlite');

  // 初始化 BKLibrary 模拟库
  const bkDb = new Database(bkDbPath);
  bkDb.exec(`
    CREATE TABLE ZBKLIBRARYASSET (
      ZASSETID TEXT PRIMARY KEY,
      ZTITLE TEXT,
      ZAUTHOR TEXT,
      ZGENRE TEXT,
      ZPATH TEXT,
      ZREADINGPROGRESS REAL,
      ZLASTOPENDATE REAL,
      ZCOVERURL TEXT
    );
  `);
  bkDb.prepare(`
    INSERT INTO ZBKLIBRARYASSET (ZASSETID, ZTITLE, ZAUTHOR, ZGENRE, ZPATH, ZREADINGPROGRESS, ZLASTOPENDATE, ZCOVERURL)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'asset-book-1',
    '思考，快与慢',
    '丹尼尔·卡尼曼',
    '心理学 / 行为经济学',
    path.join(tempDir, 'test-book.epub'),
    0.45,
    700000000.0, // CoreData timestamp
    'https://example.com/cover.jpg'
  );
  bkDb.close();

  // 初始化 AEAnnotation 模拟库
  const aeDb = new Database(aeDbPath);
  aeDb.exec(`
    CREATE TABLE ZAEANNOTATION (
      ZANNOTATIONUUID TEXT PRIMARY KEY,
      ZANNOTATIONASSETID TEXT,
      ZANNOTATIONSELECTEDTEXT TEXT,
      ZANNOTATIONNOTE TEXT,
      ZANNOTATIONREPRESENTATIVETEXT TEXT,
      ZANNOTATIONSTYLE INTEGER,
      ZANNOTATIONISUNDERLINE INTEGER,
      ZANNOTATIONLOCATION TEXT,
      ZANNOTATIONCREATIONDATE REAL,
      ZANNOTATIONMODIFICATIONDATE REAL,
      ZFUTUREPROOFING5 TEXT,
      ZANNOTATIONDELETED INTEGER
    );
  `);
  const insertAnnotation = aeDb.prepare(`
    INSERT INTO ZAEANNOTATION (
      ZANNOTATIONUUID, ZANNOTATIONASSETID, ZANNOTATIONSELECTEDTEXT, ZANNOTATIONNOTE,
      ZANNOTATIONREPRESENTATIVETEXT, ZANNOTATIONSTYLE, ZANNOTATIONISUNDERLINE,
      ZANNOTATIONLOCATION, ZANNOTATIONCREATIONDATE, ZANNOTATIONMODIFICATIONDATE,
      ZFUTUREPROOFING5, ZANNOTATIONDELETED
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // 正常高亮 1（黄色）
  insertAnnotation.run(
    'anno-1',
    'asset-book-1',
    '系统1的运行是无意识且快速的，不怎么费脑力，没有感觉，完全处于自主控制状态。',
    '这就是直觉思维的本质',
    null,
    3,
    0,
    'epubcfi(/6/4[chapter1]!/4/2/10/1:0)',
    700000100.0,
    700000200.0,
    '第一部分：两套系统',
    0
  );

  // 正常高亮 2（下划线）
  insertAnnotation.run(
    'anno-2',
    'asset-book-1',
    '系统2将注意力分配到需要费脑力的大脑活动上来，例如复杂的运算。',
    null,
    null,
    1,
    1,
    'epubcfi(/6/4[chapter1]!/4/2/20/1:0)',
    700000300.0,
    700000400.0,
    '第一部分：两套系统',
    0
  );

  // 已删除的高亮（不应被查出）
  insertAnnotation.run(
    'anno-deleted',
    'asset-book-1',
    '这条划线已被用户删除',
    null,
    null,
    3,
    0,
    'epubcfi(/6/4!/4/2/30/1:0)',
    700000500.0,
    700000500.0,
    '第一部分：两套系统',
    1
  );

  aeDb.close();

  return { bkDir, aeDir, bkDbPath, aeDbPath };
}
```

- [ ] **Step 3: 编写 Mock 验证测试**

创建 `tests/fixtures.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import Database from 'better-sqlite3';
import { createMockAppleBooksDatabases } from './fixtures/mockDbGenerator';

describe('Mock Fixtures Verification', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bookecho-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should generate valid mock databases with expected row counts', () => {
    const { bkDbPath, aeDbPath } = createMockAppleBooksDatabases(tempDir);
    expect(fs.existsSync(bkDbPath)).toBe(true);
    expect(fs.existsSync(aeDbPath)).toBe(true);

    const bkDb = new Database(bkDbPath, { readonly: true });
    const books = bkDb.prepare('SELECT count(*) as c FROM ZBKLIBRARYASSET').get() as { c: number };
    expect(books.c).toBe(1);
    bkDb.close();

    const aeDb = new Database(aeDbPath, { readonly: true });
    const annos = aeDb.prepare('SELECT count(*) as c FROM ZAEANNOTATION WHERE ZANNOTATIONDELETED = 0').get() as { c: number };
    expect(annos.c).toBe(2);
    aeDb.close();
  });
});
```

- [ ] **Step 4: 运行测试并验证通过**

运行:
```bash
npm test tests/fixtures.test.ts
```
预期: PASS

- [ ] **Step 5: 提交数据结构与 Mock 测试**

```bash
git add electron/types/ipc.ts tests/fixtures/ tests/fixtures.test.ts
git commit -m "feat(types): define IPC contracts and test database fixtures"
```

---

### Task 3: 安全 SQLite 快照同步器 (Snapshot Syncer)

**Files:**
- Create: `electron/services/snapshotSyncer.ts`
- Test: `tests/snapshotSyncer.test.ts`

**Interfaces:**
- Consumes: `electron/types/ipc.ts` (`BookItem`, `AnnotationItem`), `tests/fixtures/mockDbGenerator.ts`
- Produces: `SnapshotSyncer` 类，提供 `syncAndGetBooks(): BookItem[]` 和 `getRawAnnotations(assetId?: string): AnnotationItem[]`。

- [ ] **Step 1: 编写快照同步器的失败测试**

创建 `tests/snapshotSyncer.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createMockAppleBooksDatabases } from './fixtures/mockDbGenerator';
import { SnapshotSyncer, coreDataToUnixMs, mapStyleToColorKey } from '../electron/services/snapshotSyncer';

describe('SnapshotSyncer & SQLite Extraction', () => {
  let tempDir: string;
  let cacheDir: string;
  let mockPaths: { bkDir: string; aeDir: string; bkDbPath: string; aeDbPath: string };

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bookecho-syncer-'));
    cacheDir = path.join(tempDir, 'cache');
    mockPaths = createMockAppleBooksDatabases(tempDir);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should accurately convert CoreData timestamps to Unix milliseconds', () => {
    // 700000000 CoreData seconds + 978307200 = 1678307200 unix seconds -> 1678307200000 ms
    const ms = coreDataToUnixMs(700000000.0);
    expect(ms).toBe(1678307200000);
  });

  it('should accurately map style and underline flags to color keys', () => {
    expect(mapStyleToColorKey(1, 1)).toBe('underline');
    expect(mapStyleToColorKey(1, 0)).toBe('green');
    expect(mapStyleToColorKey(2, 0)).toBe('blue');
    expect(mapStyleToColorKey(3, 0)).toBe('yellow');
    expect(mapStyleToColorKey(4, 0)).toBe('pink');
    expect(mapStyleToColorKey(5, 0)).toBe('purple');
    expect(mapStyleToColorKey(99, 0)).toBe('yellow'); // fallback
  });

  it('should safely copy snapshot and extract non-deleted books and annotations', () => {
    const syncer = new SnapshotSyncer({
      customBkDir: mockPaths.bkDir,
      customAeDir: mockPaths.aeDir,
      cacheDir: cacheDir
    });

    const books = syncer.extractBooks();
    expect(books.length).toBe(1);
    expect(books[0].title).toBe('思考，快与慢');
    expect(books[0].author).toBe('丹尼尔·卡尼曼');
    expect(books[0].highlightsCount).toBe(2);

    const annos = syncer.extractAnnotations('asset-book-1');
    expect(annos.length).toBe(2);
    expect(annos[0].selectedText).toContain('系统1的运行');
    expect(annos[0].colorKey).toBe('yellow');
    expect(annos[1].selectedText).toContain('系统2将注意力分配');
    expect(annos[1].colorKey).toBe('underline');
  });
});
```

- [ ] **Step 2: 运行测试并确认失败**

运行:
```bash
npm test tests/snapshotSyncer.test.ts
```
预期: FAIL (Cannot find module `../electron/services/snapshotSyncer`)

- [ ] **Step 3: 编写快照同步器实现**

创建 `electron/services/snapshotSyncer.ts`:
```typescript
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { BookItem, AnnotationItem, HighlightColor } from '../types/ipc';

export const COREDATA_OFFSET_SECONDS = 978307200;

export function coreDataToUnixMs(coreDataSeconds: number | null | undefined): number | null {
  if (coreDataSeconds === null || coreDataSeconds === undefined) return null;
  return Math.round((coreDataSeconds + COREDATA_OFFSET_SECONDS) * 1000);
}

export function mapStyleToColorKey(style: number, isUnderline: number): HighlightColor {
  if (isUnderline === 1) return 'underline';
  switch (style) {
    case 1: return 'green';
    case 2: return 'blue';
    case 3: return 'yellow';
    case 4: return 'pink';
    case 5: return 'purple';
    default: return 'yellow';
  }
}

export interface SyncerOptions {
  customBkDir?: string;
  customAeDir?: string;
  cacheDir: string;
}

export class SnapshotSyncer {
  private cacheDir: string;
  private bkDir: string;
  private aeDir: string;

  constructor(options: SyncerOptions) {
    this.cacheDir = options.cacheDir;
    fs.mkdirSync(this.cacheDir, { recursive: true });

    const homeDir = os.homedir();
    const defaultBooksContainer = path.join(
      homeDir,
      'Library/Containers/com.apple.iBooksX/Data/Documents'
    );

    this.bkDir = options.customBkDir || path.join(defaultBooksContainer, 'BKLibrary');
    this.aeDir = options.customAeDir || path.join(defaultBooksContainer, 'AEAnnotation');
  }

  private findDatabaseFile(dir: string, prefix: string): string | null {
    if (!fs.existsSync(dir)) return null;
    const files = fs.readdirSync(dir);
    const dbFile = files.find(f => f.startsWith(prefix) && f.endsWith('.sqlite'));
    return dbFile ? path.join(dir, dbFile) : null;
  }

  private createSnapshot(sourceDbPath: string, targetName: string): string {
    const targetDbPath = path.join(this.cacheDir, targetName);
    fs.copyFileSync(sourceDbPath, targetDbPath);

    // 同步复制 WAL 和 SHM（如果存在），保证只读查询数据完整且不锁死主库
    const walSource = `${sourceDbPath}-wal`;
    const walTarget = `${targetDbPath}-wal`;
    if (fs.existsSync(walSource)) {
      fs.copyFileSync(walSource, walTarget);
    }

    const shmSource = `${sourceDbPath}-shm`;
    const shmTarget = `${targetDbPath}-shm`;
    if (fs.existsSync(shmSource)) {
      fs.copyFileSync(shmSource, shmTarget);
    }

    return targetDbPath;
  }

  public extractBooks(): BookItem[] {
    const sourceBk = this.findDatabaseFile(this.bkDir, 'BKLibrary');
    if (!sourceBk) return [];

    const snapshotBk = this.createSnapshot(sourceBk, 'snapshot_BKLibrary.sqlite');
    const db = new Database(snapshotBk, { readonly: true });

    const sourceAe = this.findDatabaseFile(this.aeDir, 'AEAnnotation');
    let highlightCounts: Record<string, number> = {};
    if (sourceAe) {
      const snapshotAe = this.createSnapshot(sourceAe, 'snapshot_AEAnnotation_count.sqlite');
      const aeDb = new Database(snapshotAe, { readonly: true });
      const counts = aeDb.prepare(`
        SELECT ZANNOTATIONASSETID as assetId, count(*) as cnt
        FROM ZAEANNOTATION
        WHERE ZANNOTATIONDELETED = 0
          AND ((ZANNOTATIONSELECTEDTEXT IS NOT NULL AND TRIM(ZANNOTATIONSELECTEDTEXT) != '')
               OR (ZANNOTATIONNOTE IS NOT NULL AND TRIM(ZANNOTATIONNOTE) != ''))
        GROUP BY ZANNOTATIONASSETID
      `).all() as { assetId: string; cnt: number }[];
      counts.forEach(row => {
        highlightCounts[row.assetId] = row.cnt;
      });
      aeDb.close();
    }

    const rows = db.prepare(`
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
      WHERE ZTITLE IS NOT NULL AND ZASSETID IS NOT NULL
      ORDER BY ZLASTOPENDATE DESC
    `).all() as any[];

    db.close();

    return rows.map(r => ({
      assetId: r.assetId,
      title: r.title,
      author: r.author || null,
      genre: r.genre || null,
      epubPath: r.epubPath || null,
      readingProgress: typeof r.readingProgress === 'number' ? r.readingProgress : 0,
      lastOpenDateMs: coreDataToUnixMs(r.lastOpenDate),
      coverUrl: r.coverUrl || null,
      highlightsCount: highlightCounts[r.assetId] || 0
    }));
  }

  public extractAnnotations(assetId?: string): AnnotationItem[] {
    const sourceAe = this.findDatabaseFile(this.aeDir, 'AEAnnotation');
    if (!sourceAe) return [];

    const snapshotAe = this.createSnapshot(sourceAe, 'snapshot_AEAnnotation.sqlite');
    const db = new Database(snapshotAe, { readonly: true });

    let sql = `
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
        AND ((ZANNOTATIONSELECTEDTEXT IS NOT NULL AND TRIM(ZANNOTATIONSELECTEDTEXT) != '')
             OR (ZANNOTATIONNOTE IS NOT NULL AND TRIM(ZANNOTATIONNOTE) != ''))
    `;

    const params: any[] = [];
    if (assetId) {
      sql += ` AND ZANNOTATIONASSETID = ?`;
      params.push(assetId);
    }
    sql += ` ORDER BY ZANNOTATIONLOCATION ASC, ZANNOTATIONCREATIONDATE ASC`;

    const rows = db.prepare(sql).all(...params) as any[];
    db.close();

    return rows.map(r => ({
      uuid: r.uuid,
      assetId: r.assetId,
      selectedText: r.selectedText || '',
      note: r.note || null,
      representativeText: r.representativeText || null,
      colorKey: mapStyleToColorKey(r.style || 0, r.isUnderline || 0),
      locationCfi: r.locationCfi || null,
      chapterTitle: r.chapterTitleHint || '默认章节',
      creationDateMs: coreDataToUnixMs(r.creationDate) || Date.now(),
      modificationDateMs: coreDataToUnixMs(r.modificationDate) || Date.now(),
      sortIndex: 0
    }));
  }
}
```

- [ ] **Step 4: 运行测试并验证通过**

运行:
```bash
npm test tests/snapshotSyncer.test.ts
```
预期: PASS

- [ ] **Step 5: 提交快照同步器代码**

```bash
git add electron/services/snapshotSyncer.ts tests/snapshotSyncer.test.ts
git commit -m "feat(syncer): implement safe SQLite snapshot reader for Apple Books"
```

---

### Task 4: 本地扩展数据库与用户标注管理 (User Vault Database)

**Files:**
- Create: `electron/services/userVaultDb.ts`
- Test: `tests/userVaultDb.test.ts`

**Interfaces:**
- Consumes: `electron/types/ipc.ts` (`AnnotationItem`, `ColorSemanticConfig`)
- Produces: `UserVaultDb` 类，管理 `user_vault.sqlite`，提供二次批注、星标、标签CRUD、色彩语义自定义以及每日回顾加权评分调度。

- [ ] **Step 1: 编写扩展数据库的失败测试**

创建 `tests/userVaultDb.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { UserVaultDb } from '../electron/services/userVaultDb';

describe('UserVaultDb & Secondary Annotations', () => {
  let tempDir: string;
  let vaultDbPath: string;
  let vault: UserVaultDb;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bookecho-vault-'));
    vaultDbPath = path.join(tempDir, 'user_vault.sqlite');
    vault = new UserVaultDb(vaultDbPath);
  });

  afterEach(() => {
    vault.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should initialize tables and default color semantics', () => {
    const semantics = vault.getColorSemantics();
    expect(semantics.length).toBe(6);
    const yellow = semantics.find(s => s.colorKey === 'yellow');
    expect(yellow?.label).toBe('核心论点');
    expect(yellow?.hexColor).toBe('#F5A623');
  });

  it('should manage custom notes, starred status, and tags', () => {
    vault.updateAnnotationMeta('anno-1', { customNote: '我的深度思考', isStarred: true });
    vault.addTag('anno-1', '心理学');
    vault.addTag('anno-1', '思维模型');

    const meta = vault.getAnnotationMeta('anno-1');
    expect(meta?.customNote).toBe('我的深度思考');
    expect(meta?.isStarred).toBe(true);

    const tags = vault.getTagsForAnnotation('anno-1');
    expect(tags).toContain('心理学');
    expect(tags).toContain('思维模型');

    const allTags = vault.getAllTags();
    expect(allTags).toEqual(['心理学', '思维模型']);

    vault.removeTag('anno-1', '心理学');
    expect(vault.getTagsForAnnotation('anno-1')).toEqual(['思维模型']);
  });

  it('should calculate daily review queue with spaced repetition scoring', () => {
    // 注入两条笔记状态
    vault.updateAnnotationMeta('anno-1', { isStarred: true });
    vault.recordReviewResult('anno-1', 'remembered');

    const queue = vault.getReviewCandidates(['anno-1', 'anno-2']);
    expect(queue.length).toBe(2);
    // anno-1 被标星，权重更高
    expect(queue[0].uuid).toBe('anno-1');
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

运行:
```bash
npm test tests/userVaultDb.test.ts
```
预期: FAIL (Cannot find module `../electron/services/userVaultDb`)

- [ ] **Step 3: 编写 UserVaultDb 完整实现**

创建 `electron/services/userVaultDb.ts`:
```typescript
import Database from 'better-sqlite3';
import { ColorSemanticConfig, HighlightColor } from '../types/ipc';

export interface AnnotationMetaRecord {
  annotationUuid: string;
  customNote: string;
  isStarred: boolean;
  reviewStatus: 'active' | 'mastered' | 'archived';
  reviewCount: number;
  lastReviewedAtMs: number | null;
  resolvedChapter: string | null;
  sortIndex: number;
}

export class UserVaultDb {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initTables();
    this.seedDefaultColorSemantics();
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS annotation_meta (
        annotation_uuid TEXT PRIMARY KEY,
        custom_note TEXT DEFAULT '',
        is_starred INTEGER DEFAULT 0,
        review_status TEXT DEFAULT 'active',
        review_count INTEGER DEFAULT 0,
        last_reviewed_at INTEGER DEFAULT NULL,
        resolved_chapter TEXT DEFAULT NULL,
        sort_index REAL DEFAULT 0,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS annotation_tags (
        annotation_uuid TEXT NOT NULL,
        tag_name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (annotation_uuid, tag_name)
      );

      CREATE TABLE IF NOT EXISTS color_semantics (
        color_key TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        hex_color TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        setting_key TEXT PRIMARY KEY,
        setting_value TEXT NOT NULL
      );
    `);
  }

  private seedDefaultColorSemantics(): void {
    const defaults: ColorSemanticConfig[] = [
      { colorKey: 'yellow', label: '核心论点', hexColor: '#F5A623' },
      { colorKey: 'green', label: '行动与实践', hexColor: '#5CB85C' },
      { colorKey: 'blue', label: '概念与背景', hexColor: '#4A90E2' },
      { colorKey: 'pink', label: '灵感与金句', hexColor: '#E86F88' },
      { colorKey: 'purple', label: '存疑与深思', hexColor: '#9B6B9E' },
      { colorKey: 'underline', label: '重点下划线', hexColor: '#D9534F' }
    ];

    const insert = this.db.prepare(`
      INSERT OR IGNORE INTO color_semantics (color_key, label, hex_color)
      VALUES (?, ?, ?)
    `);

    for (const item of defaults) {
      insert.run(item.colorKey, item.label, item.hexColor);
    }
  }

  public getColorSemantics(): ColorSemanticConfig[] {
    const rows = this.db.prepare(`
      SELECT color_key as colorKey, label, hex_color as hexColor
      FROM color_semantics
    `).all() as any[];
    return rows;
  }

  public updateColorSemantic(colorKey: HighlightColor, label: string): void {
    this.db.prepare(`
      UPDATE color_semantics SET label = ? WHERE color_key = ?
    `).run(label, colorKey);
  }

  public getAnnotationMeta(uuid: string): AnnotationMetaRecord | null {
    const row = this.db.prepare(`
      SELECT
        annotation_uuid as annotationUuid,
        custom_note as customNote,
        is_starred as isStarred,
        review_status as reviewStatus,
        review_count as reviewCount,
        last_reviewed_at as lastReviewedAtMs,
        resolved_chapter as resolvedChapter,
        sort_index as sortIndex
      FROM annotation_meta
      WHERE annotation_uuid = ?
    `).get(uuid) as any;

    if (!row) return null;
    return {
      annotationUuid: row.annotationUuid,
      customNote: row.customNote || '',
      isStarred: row.isStarred === 1,
      reviewStatus: row.reviewStatus || 'active',
      reviewCount: row.reviewCount || 0,
      lastReviewedAtMs: row.lastReviewedAtMs || null,
      resolvedChapter: row.resolvedChapter || null,
      sortIndex: row.sortIndex || 0
    };
  }

  public updateAnnotationMeta(
    uuid: string,
    updates: {
      customNote?: string;
      isStarred?: boolean;
      reviewStatus?: 'active' | 'mastered' | 'archived';
      resolvedChapter?: string;
      sortIndex?: number;
    }
  ): void {
    const now = Date.now();
    const existing = this.getAnnotationMeta(uuid);

    if (existing) {
      const newNote = updates.customNote !== undefined ? updates.customNote : existing.customNote;
      const newStarred = updates.isStarred !== undefined ? (updates.isStarred ? 1 : 0) : (existing.isStarred ? 1 : 0);
      const newStatus = updates.reviewStatus !== undefined ? updates.reviewStatus : existing.reviewStatus;
      const newChapter = updates.resolvedChapter !== undefined ? updates.resolvedChapter : existing.resolvedChapter;
      const newSort = updates.sortIndex !== undefined ? updates.sortIndex : existing.sortIndex;

      this.db.prepare(`
        UPDATE annotation_meta
        SET custom_note = ?, is_starred = ?, review_status = ?, resolved_chapter = ?, sort_index = ?, updated_at = ?
        WHERE annotation_uuid = ?
      `).run(newNote, newStarred, newStatus, newChapter, newSort, now, uuid);
    } else {
      this.db.prepare(`
        INSERT INTO annotation_meta (
          annotation_uuid, custom_note, is_starred, review_status, review_count,
          last_reviewed_at, resolved_chapter, sort_index, updated_at
        ) VALUES (?, ?, ?, ?, 0, NULL, ?, ?, ?)
      `).run(
        uuid,
        updates.customNote || '',
        updates.isStarred ? 1 : 0,
        updates.reviewStatus || 'active',
        updates.resolvedChapter || null,
        updates.sortIndex || 0,
        now
      );
    }
  }

  public addTag(uuid: string, tag: string): void {
    const trimmed = tag.trim().replace(/^#/, '');
    if (!trimmed) return;
    this.db.prepare(`
      INSERT OR IGNORE INTO annotation_tags (annotation_uuid, tag_name, created_at)
      VALUES (?, ?, ?)
    `).run(uuid, trimmed, Date.now());
  }

  public removeTag(uuid: string, tag: string): void {
    const trimmed = tag.trim().replace(/^#/, '');
    this.db.prepare(`
      DELETE FROM annotation_tags WHERE annotation_uuid = ? AND tag_name = ?
    `).run(uuid, trimmed);
  }

  public getTagsForAnnotation(uuid: string): string[] {
    const rows = this.db.prepare(`
      SELECT tag_name as tag FROM annotation_tags WHERE annotation_uuid = ? ORDER BY created_at ASC
    `).all(uuid) as { tag: string }[];
    return rows.map(r => r.tag);
  }

  public getAllTags(): string[] {
    const rows = this.db.prepare(`
      SELECT DISTINCT tag_name as tag FROM annotation_tags ORDER BY tag_name ASC
    `).all() as { tag: string }[];
    return rows.map(r => r.tag);
  }

  public recordReviewResult(uuid: string, result: 'remembered' | 'mastered' | 'reset'): void {
    const existing = this.getAnnotationMeta(uuid);
    const count = (existing?.reviewCount || 0) + 1;
    const status = result === 'mastered' ? 'mastered' : 'active';
    const now = Date.now();

    this.db.prepare(`
      INSERT INTO annotation_meta (annotation_uuid, review_count, last_reviewed_at, review_status, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(annotation_uuid) DO UPDATE SET
        review_count = ?,
        last_reviewed_at = ?,
        review_status = ?,
        updated_at = ?
    `).run(uuid, count, now, status, now, count, now, status, now);
  }

  public getReviewCandidates(allUuids: string[]): { uuid: string; score: number }[] {
    if (allUuids.length === 0) return [];
    const placeholders = allUuids.map(() => '?').join(',');
    const rows = this.db.prepare(`
      SELECT annotation_uuid, is_starred, review_count, last_reviewed_at, review_status
      FROM annotation_meta
      WHERE annotation_uuid IN (${placeholders})
    `).all(...allUuids) as any[];

    const metaMap = new Map<string, any>();
    rows.forEach(r => metaMap.set(r.annotation_uuid, r));

    const now = Date.now();
    const scored = allUuids.map(uuid => {
      const meta = metaMap.get(uuid);
      if (meta && meta.review_status === 'mastered') {
        return { uuid, score: -9999 };
      }

      const daysSince = meta?.last_reviewed_at
        ? (now - meta.last_reviewed_at) / (1000 * 60 * 60 * 24)
        : 30; // 默认视为 30 天未复习
      const starBonus = meta?.is_starred ? 20 : 0;
      const reviewPenalty = (meta?.review_count || 0) * 5;

      const score = daysSince * 1.5 + starBonus - reviewPenalty;
      return { uuid, score };
    });

    return scored.sort((a, b) => b.score - a.score);
  }

  public getSetting(key: string): string | null {
    const row = this.db.prepare('SELECT setting_value FROM app_settings WHERE setting_key = ?').get(key) as any;
    return row ? row.setting_value : null;
  }

  public setSetting(key: string, value: string): void {
    this.db.prepare(`
      INSERT INTO app_settings (setting_key, setting_value)
      VALUES (?, ?)
      ON CONFLICT(setting_key) DO UPDATE SET setting_value = ?
    `).run(key, value, value);
  }

  public close(): void {
    this.db.close();
  }
}
```

- [ ] **Step 4: 运行测试并验证通过**

运行:
```bash
npm test tests/userVaultDb.test.ts
```
预期: PASS

- [ ] **Step 5: 提交 UserVault 数据库服务**

```bash
git add electron/services/userVaultDb.ts tests/userVaultDb.test.ts
git commit -m "feat(vault): implement local extension database with secondary notes and review scoring"
```

---

### Task 5: EPUB 章节解析与原文前后上下文展开引擎 (EPUB Context Engine)

**Files:**
- Create: `electron/services/epubContextEngine.ts`
- Create: `tests/fixtures/mockEpubGenerator.ts`
- Test: `tests/epubContextEngine.test.ts`

**Interfaces:**
- Consumes: `electron/types/ipc.ts` (`HighlightContextResult`)
- Produces: `EpubContextEngine` 类，提供 `resolveChapter(epubPath, locationCfi): { chapterTitle: string; sortIndex: number }` 与 `extractParagraphContext(epubPath, locationCfi, selectedText): HighlightContextResult`。

- [ ] **Step 1: 编写 EPUB 模拟器与失败测试**

创建 `tests/fixtures/mockEpubGenerator.ts`:
```typescript
import fs from 'fs';
import path from 'path';

export function createMockEpubDirectory(targetDir: string): string {
  const epubDir = path.join(targetDir, 'mock_book.epub');
  const metaInf = path.join(epubDir, 'META-INF');
  const oebps = path.join(epubDir, 'OEBPS');

  fs.mkdirSync(metaInf, { recursive: true });
  fs.mkdirSync(oebps, { recursive: true });

  // 1. container.xml
  fs.writeFileSync(
    path.join(metaInf, 'container.xml'),
    `<?xml version="1.0"?>
    <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
      <rootfiles>
        <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
      </rootfiles>
    </container>`
  );

  // 2. content.opf
  fs.writeFileSync(
    path.join(oebps, 'content.opf'),
    `<?xml version="1.0" encoding="utf-8"?>
    <package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id">
      <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
        <dc:title>模拟测试书籍</dc:title>
      </metadata>
      <manifest>
        <item id="toc" href="toc.xhtml" media-type="application/xhtml+xml" properties="nav"/>
        <item id="chapter1" href="ch01.xhtml" media-type="application/xhtml+xml"/>
      </manifest>
      <spine>
        <itemref idref="chapter1"/>
      </spine>
    </package>`
  );

  // 3. toc.xhtml
  fs.writeFileSync(
    path.join(oebps, 'toc.xhtml'),
    `<?xml version="1.0" encoding="utf-8"?>
    <html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
      <body>
        <nav epub:type="toc">
          <ol>
            <li><a href="ch01.xhtml">第一章：直觉与理性</a></li>
          </ol>
        </nav>
      </body>
    </html>`
  );

  // 4. ch01.xhtml (带有多个自然段)
  fs.writeFileSync(
    path.join(oebps, 'ch01.xhtml'),
    `<?xml version="1.0" encoding="utf-8"?>
    <html xmlns="http://www.w3.org/1999/xhtml">
      <head><title>第一章</title></head>
      <body>
        <h1>第一章：直觉与理性</h1>
        <p>这是前置导读段落，阐述人类大脑的双系统决策架构背景。</p>
        <p>心理学研究表明，直觉在日常判断中占据主导，但也会产生偏见。</p>
        <p>系统1的运行是无意识且快速的，不怎么费脑力，没有感觉，完全处于自主控制状态。</p>
        <p>相比之下，系统2则需要调动注意力进行深度的数理逻辑运算与权衡。</p>
        <p>结论是，优秀的决策者必须学会察觉系统1的偏见并适时激活系统2。</p>
      </body>
    </html>`
  );

  return epubDir;
}
```

创建 `tests/epubContextEngine.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createMockEpubDirectory } from './fixtures/mockEpubGenerator';
import { EpubContextEngine } from '../electron/services/epubContextEngine';

describe('EpubContextEngine & Paragraph Context Extractor', () => {
  let tempDir: string;
  let epubPath: string;
  let engine: EpubContextEngine;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bookecho-epub-'));
    epubPath = createMockEpubDirectory(tempDir);
    engine = new EpubContextEngine();
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should resolve chapter title and sortIndex from EPUB CFI', () => {
    const result = engine.resolveChapter(epubPath, 'epubcfi(/6/2[chapter1]!/4/2/6/1:0)');
    expect(result.chapterTitle).toBe('第一章：直觉与理性');
    expect(result.sortIndex).toBeGreaterThan(0);
  });

  it('should extract before, current, and after paragraphs around the highlight', () => {
    const selectedText = '系统1的运行是无意识且快速的';
    const context = engine.extractParagraphContext(
      epubPath,
      'epubcfi(/6/2[chapter1]!/4/2/6/1:0)',
      selectedText
    );

    expect(context.available).toBe(true);
    expect(context.currentParagraph).toContain('系统1的运行是无意识且快速的');
    expect(context.beforeParagraphs.length).toBeGreaterThanOrEqual(1);
    expect(context.beforeParagraphs[context.beforeParagraphs.length - 1]).toContain('心理学研究表明');
    expect(context.afterParagraphs[0]).toContain('相比之下，系统2则需要调动注意力');
  });

  it('should gracefully handle non-existent or DRM files', () => {
    const context = engine.extractParagraphContext('/non/existent/path.epub', 'cfi', 'text');
    expect(context.available).toBe(false);
    expect(context.reason).toBe('FILE_NOT_DOWNLOADED');
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

运行:
```bash
npm test tests/epubContextEngine.test.ts
```
预期: FAIL (Cannot find module `../electron/services/epubContextEngine`)

- [ ] **Step 3: 编写 EpubContextEngine 完整实现**

创建 `electron/services/epubContextEngine.ts`:
```typescript
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { XMLParser } from 'fast-xml-parser';
import { HighlightContextResult } from '../types/ipc';

interface SpineItem {
  id: string;
  href: string;
}

export class EpubContextEngine {
  private parser: XMLParser;

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_'
    });
  }

  private readEpubFileContent(epubPath: string, relativePath: string): string | null {
    if (!fs.existsSync(epubPath)) return null;

    const normalizedRelPath = relativePath.replace(/\\/g, '/').replace(/^\//, '');

    if (fs.statSync(epubPath).isDirectory()) {
      const fullPath = path.join(epubPath, normalizedRelPath);
      if (fs.existsSync(fullPath)) {
        return fs.readFileSync(fullPath, 'utf-8');
      }
      return null;
    }

    try {
      const zip = new AdmZip(epubPath);
      const entry = zip.getEntry(normalizedRelPath);
      if (entry) {
        return zip.readAsText(entry);
      }
    } catch {
      return null;
    }

    return null;
  }

  private getOpfPath(epubPath: string): string | null {
    const containerXml = this.readEpubFileContent(epubPath, 'META-INF/container.xml');
    if (!containerXml) return null;

    try {
      const parsed = this.parser.parse(containerXml);
      const rootfile = parsed?.container?.rootfiles?.rootfile;
      if (Array.isArray(rootfile)) {
        return rootfile[0]?.['@_full-path'] || null;
      }
      return rootfile?.['@_full-path'] || null;
    } catch {
      return null;
    }
  }

  private parseSpineAndManifest(epubPath: string, opfPath: string): { opfDir: string; spine: SpineItem[]; tocHref: string | null } {
    const opfContent = this.readEpubFileContent(epubPath, opfPath);
    const opfDir = path.dirname(opfPath);
    if (!opfContent) return { opfDir, spine: [], tocHref: null };

    try {
      const parsed = this.parser.parse(opfContent);
      const manifestItems = parsed?.package?.manifest?.item;
      const manifestList = Array.isArray(manifestItems) ? manifestItems : (manifestItems ? [manifestItems] : []);

      const manifestMap = new Map<string, string>();
      let tocHref: string | null = null;

      for (const item of manifestList) {
        const id = item['@_id'];
        const href = item['@_href'];
        if (id && href) {
          manifestMap.set(id, href);
        }
        if (item['@_properties'] === 'nav' || id === 'toc' || id === 'ncx') {
          tocHref = href;
        }
      }

      const spineItems = parsed?.package?.spine?.itemref;
      const spineList = Array.isArray(spineItems) ? spineItems : (spineItems ? [spineItems] : []);

      const spine: SpineItem[] = [];
      for (const ref of spineList) {
        const idref = ref['@_idref'];
        const href = manifestMap.get(idref);
        if (idref && href) {
          spine.push({ id: idref, href });
        }
      }

      return { opfDir, spine, tocHref };
    } catch {
      return { opfDir, spine: [], tocHref: null };
    }
  }

  private extractHtmlParagraphs(htmlContent: string): string[] {
    // 提取 <p>, <li>, <blockquote>, <h1>~<h6> 块级文字
    const blockRegex = /<(?:p|li|blockquote|h[1-6])[^>]*>([\s\S]*?)<\/(?:p|li|blockquote|h[1-6])>/gi;
    const paragraphs: string[] = [];
    let match;

    while ((match = blockRegex.exec(htmlContent)) !== null) {
      const rawText = match[1]
        .replace(/<[^>]+>/g, '') // 去除内联标签
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();

      if (rawText.length > 0) {
        paragraphs.push(rawText);
      }
    }

    return paragraphs;
  }

  public resolveChapter(epubPath: string, locationCfi: string | null): { chapterTitle: string; sortIndex: number } {
    if (!epubPath || !locationCfi) {
      return { chapterTitle: '未命名章节', sortIndex: 0 };
    }

    const opfPath = this.getOpfPath(epubPath);
    if (!opfPath) {
      return { chapterTitle: '正文', sortIndex: 0 };
    }

    const { opfDir, spine, tocHref } = this.parseSpineAndManifest(epubPath, opfPath);

    // 解析 CFI 步进索引: epubcfi(/6/14[chapter_id]!/4/2/10/1:24)
    let spineIndex = 0;
    let sortIndex = 0;
    const cfiMatch = locationCfi.match(/epubcfi\(\/6\/(\d+)/);
    if (cfiMatch) {
      const stepVal = parseInt(cfiMatch[1], 10);
      spineIndex = Math.max(0, Math.floor(stepVal / 2) - 1);
    }

    // 计算内部细粒度排序索引
    const innerParts = locationCfi.split('!/')[1];
    if (innerParts) {
      const nums = innerParts.match(/\d+/g);
      if (nums) {
        sortIndex = spineIndex * 100000 + nums.reduce((acc, n, idx) => acc + parseInt(n, 10) * Math.pow(0.1, idx + 1), 0);
      }
    } else {
      sortIndex = spineIndex * 100000;
    }

    const targetSpine = spine[spineIndex] || spine[0];
    if (!targetSpine) {
      return { chapterTitle: '正文', sortIndex };
    }

    // 尝试解析 TOC 文件匹配章节标题
    if (tocHref) {
      const tocFullPath = path.posix.join(opfDir, tocHref);
      const tocContent = this.readEpubFileContent(epubPath, tocFullPath);
      if (tocContent) {
        const linkRegex = new RegExp(`href=["'](?:[^"']*?\/)?${targetSpine.href}["'][^>]*>([^<]+)<`, 'i');
        const titleMatch = linkRegex.exec(tocContent);
        if (titleMatch && titleMatch[1].trim()) {
          return { chapterTitle: titleMatch[1].trim(), sortIndex };
        }
      }
    }

    return { chapterTitle: `第 ${spineIndex + 1} 节`, sortIndex };
  }

  public extractParagraphContext(
    epubPath: string,
    locationCfi: string | null,
    selectedText: string
  ): HighlightContextResult {
    if (!epubPath || !fs.existsSync(epubPath)) {
      return {
        available: false,
        reason: 'FILE_NOT_DOWNLOADED',
        beforeParagraphs: [],
        currentParagraph: '',
        selectedText,
        afterParagraphs: []
      };
    }

    const opfPath = this.getOpfPath(epubPath);
    if (!opfPath) {
      return {
        available: false,
        reason: 'DRM_PROTECTED',
        beforeParagraphs: [],
        currentParagraph: '',
        selectedText,
        afterParagraphs: []
      };
    }

    const { opfDir, spine } = this.parseSpineAndManifest(epubPath, opfPath);
    if (spine.length === 0) {
      return {
        available: false,
        reason: 'NOT_FOUND',
        beforeParagraphs: [],
        currentParagraph: '',
        selectedText,
        afterParagraphs: []
      };
    }

    // 定位目标章节文件
    let targetHrefs: string[] = [];
    if (locationCfi) {
      const cfiMatch = locationCfi.match(/epubcfi\(\/6\/(\d+)/);
      if (cfiMatch) {
        const stepVal = parseInt(cfiMatch[1], 10);
        const idx = Math.max(0, Math.floor(stepVal / 2) - 1);
        if (spine[idx]) {
          targetHrefs.push(spine[idx].href);
        }
      }
    }
    // 兜底：若 CFI 未命中，添加所有 spine 章节做全文搜索
    for (const item of spine) {
      if (!targetHrefs.includes(item.href)) {
        targetHrefs.push(item.href);
      }
    }

    const cleanSelected = selectedText.replace(/\s+/g, '').slice(0, 30);

    for (const href of targetHrefs) {
      const fullHref = path.posix.join(opfDir, href);
      const html = this.readEpubFileContent(epubPath, fullHref);
      if (!html) continue;

      const paragraphs = this.extractHtmlParagraphs(html);
      let targetIdx = -1;

      for (let i = 0; i < paragraphs.length; i++) {
        const cleanPara = paragraphs[i].replace(/\s+/g, '');
        if (cleanPara.includes(cleanSelected)) {
          targetIdx = i;
          break;
        }
      }

      if (targetIdx !== -1) {
        const before = paragraphs.slice(Math.max(0, targetIdx - 2), targetIdx);
        const current = paragraphs[targetIdx];
        const after = paragraphs.slice(targetIdx + 1, targetIdx + 3);

        const { chapterTitle } = this.resolveChapter(epubPath, locationCfi);

        return {
          available: true,
          chapterTitle,
          beforeParagraphs: before,
          currentParagraph: current,
          selectedText,
          afterParagraphs: after
        };
      }
    }

    return {
      available: false,
      reason: 'NOT_FOUND',
      beforeParagraphs: [],
      currentParagraph: '',
      selectedText,
      afterParagraphs: []
    };
  }
}
```

- [ ] **Step 4: 运行测试并验证通过**

运行:
```bash
npm test tests/epubContextEngine.test.ts
```
预期: PASS

- [ ] **Step 5: 提交 EPUB 章节与上下文引擎代码**

```bash
git add electron/services/epubContextEngine.ts tests/fixtures/mockEpubGenerator.ts tests/epubContextEngine.test.ts
git commit -m "feat(epub): implement chapter resolution and before/after paragraph context extractor"
```

---

### Task 6: 无损 Markdown 导出服务 (Markdown Exporter)

**Files:**
- Create: `electron/services/markdownExporter.ts`
- Test: `tests/markdownExporter.test.ts`

**Interfaces:**
- Consumes: `electron/types/ipc.ts` (`BookItem`, `AnnotationItem`)
- Produces: `MarkdownExporter` 类，提供 `formatStandardMarkdown(book, annotations): string` 与 `formatObsidianMarkdown(book, annotations): string`。

- [ ] **Step 1: 编写 Markdown 导出器的失败测试**

创建 `tests/markdownExporter.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { MarkdownExporter } from '../electron/services/markdownExporter';
import { BookItem, AnnotationItem } from '../electron/types/ipc';

describe('MarkdownExporter', () => {
  const mockBook: BookItem = {
    assetId: 'book-1',
    title: '纳瓦尔宝典',
    author: '埃里克·乔根森',
    genre: '个人成长',
    epubPath: '/path/to/book.epub',
    readingProgress: 1.0,
    lastOpenDateMs: 1678307200000,
    coverUrl: null,
    highlightsCount: 1
  };

  const mockAnnotations: AnnotationItem[] = [
    {
      uuid: 'anno-1',
      assetId: 'book-1',
      selectedText: '赚大钱的人从来不是靠运气。',
      note: '创造独特性与杠杆',
      representativeText: null,
      colorKey: 'yellow',
      locationCfi: 'cfi',
      chapterTitle: '第一章：财富',
      creationDateMs: 1678307200000,
      modificationDateMs: 1678307200000,
      sortIndex: 1,
      customNote: '必须找到自己的特定知识',
      isStarred: true,
      tags: ['财富', '杠杆']
    }
  ];

  it('should format clean standard markdown with quotes and metadata', () => {
    const md = MarkdownExporter.formatStandardMarkdown(mockBook, mockAnnotations);
    expect(md).toContain('# 纳瓦尔宝典');
    expect(md).toContain('**作者**：埃里克·乔根森');
    expect(md).toContain('## 第一章：财富');
    expect(md).toContain('> 赚大钱的人从来不是靠运气。');
    expect(md).toContain('**批注**：创造独特性与杠杆');
    expect(md).toContain('**延伸思考**：必须找到自己的特定知识');
    expect(md).toContain('`#财富` `#杠杆`');
  });

  it('should format Obsidian-enhanced markdown with YAML frontmatter and Callout blocks', () => {
    const md = MarkdownExporter.formatObsidianMarkdown(mockBook, mockAnnotations);
    expect(md).toContain('---');
    expect(md).toContain('title: "纳瓦尔宝典"');
    expect(md).toContain('author: "埃里克·乔根森"');
    expect(md).toContain('> [!quote] 🟡 核心论点');
    expect(md).toContain('> 赚大钱的人从来不是靠运气。');
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

运行:
```bash
npm test tests/markdownExporter.test.ts
```
预期: FAIL (Cannot find module `../electron/services/markdownExporter`)

- [ ] **Step 3: 编写 MarkdownExporter 实现**

创建 `electron/services/markdownExporter.ts`:
```typescript
import { BookItem, AnnotationItem, HighlightColor } from '../types/ipc';

const COLOR_EMOJIS: Record<HighlightColor, string> = {
  yellow: '🟡 核心论点',
  green: '🟢 行动与实践',
  blue: '🔵 概念与背景',
  pink: '🌸 灵感与金句',
  purple: '🟣 存疑与深思',
  underline: '🔴 重点下划线'
};

export class MarkdownExporter {
  public static groupAnnotationsByChapter(annotations: AnnotationItem[]): Map<string, AnnotationItem[]> {
    const map = new Map<string, AnnotationItem[]>();
    for (const anno of annotations) {
      const chapter = anno.chapterTitle || '默认章节';
      if (!map.has(chapter)) {
        map.set(chapter, []);
      }
      map.get(chapter)!.push(anno);
    }
    return map;
  }

  public static formatStandardMarkdown(book: BookItem, annotations: AnnotationItem[]): string {
    const lines: string[] = [];

    lines.push(`# ${book.title}`);
    lines.push('');
    lines.push(`- **作者**：${book.author || '未知'}`);
    lines.push(`- **分类**：${book.genre || '未分类'}`);
    lines.push(`- **笔记总数**：${annotations.length} 条`);
    lines.push(`- **导出时间**：${new Date().toLocaleDateString('zh-CN')}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    const grouped = this.groupAnnotationsByChapter(annotations);

    for (const [chapter, items] of grouped.entries()) {
      lines.push(`## ${chapter}`);
      lines.push('');

      for (const item of items) {
        const star = item.isStarred ? '⭐ ' : '';
        const tagLine = item.tags && item.tags.length > 0 ? item.tags.map(t => `\`#${t}\``).join(' ') : '';

        lines.push(`> ${star}${item.selectedText}`);
        lines.push('>');

        if (item.note) {
          lines.push(`> **批注**：${item.note}`);
        }
        if (item.customNote) {
          lines.push(`> **延伸思考**：${item.customNote}`);
        }
        if (tagLine) {
          lines.push(`> **标签**：${tagLine}`);
        }

        lines.push('');
      }
    }

    return lines.join('\n');
  }

  public static formatObsidianMarkdown(book: BookItem, annotations: AnnotationItem[]): string {
    const lines: string[] = [];

    // YAML Frontmatter
    lines.push('---');
    lines.push(`title: "${book.title.replace(/"/g, '\\"')}"`);
    lines.push(`author: "${(book.author || '未知').replace(/"/g, '\\"')}"`);
    lines.push(`highlights_count: ${annotations.length}`);
    lines.push(`exported_at: "${new Date().toISOString()}"`);
    lines.push('tags:');
    lines.push('  - books/highlights');
    lines.push('---');
    lines.push('');
    lines.push(`# ${book.title}`);
    lines.push('');

    const grouped = this.groupAnnotationsByChapter(annotations);

    for (const [chapter, items] of grouped.entries()) {
      lines.push(`## ${chapter}`);
      lines.push('');

      for (const item of items) {
        const calloutHeader = COLOR_EMOJIS[item.colorKey] || '🟡 高亮';
        lines.push(`> [!quote] ${calloutHeader}`);
        lines.push(`> ${item.selectedText}`);

        if (item.note) {
          lines.push(`> `);
          lines.push(`> **想法**：${item.note}`);
        }
        if (item.customNote) {
          lines.push(`> `);
          lines.push(`> **扩展**：${item.customNote}`);
        }
        if (item.tags && item.tags.length > 0) {
          lines.push(`> `);
          lines.push(`> ${item.tags.map(t => `#${t}`).join(' ')}`);
        }

        lines.push('');
      }
    }

    return lines.join('\n');
  }
}
```

- [ ] **Step 4: 运行测试并验证通过**

运行:
```bash
npm test tests/markdownExporter.test.ts
```
预期: PASS

- [ ] **Step 5: 提交 Markdown 导出服务代码**

```bash
git add electron/services/markdownExporter.ts tests/markdownExporter.test.ts
git commit -m "feat(export): implement standard and obsidian markdown export formatters"
```

---

### Task 7: Electron 主进程、Preload 安全桥与 IPC 服务集成

**Files:**
- Create: `electron/preload.ts`
- Create: `electron/main.ts`
- Test: `tests/ipcContract.test.ts`

**Interfaces:**
- Consumes: `SnapshotSyncer`, `UserVaultDb`, `EpubContextEngine`, `MarkdownExporter`
- Produces: `window.bookEchoAPI` 暴露给前端安全调用，具备完整的 macOS 权限捕获与文件保存对话框。

- [ ] **Step 1: 编写 Preload 脚本并暴露类型化 API**

创建 `electron/preload.ts`:
```typescript
import { contextBridge, ipcRenderer } from 'electron';
import { BookEchoAPI } from './types/ipc';

const api: BookEchoAPI = {
  getBooks: () => ipcRenderer.invoke('books:getAll'),
  getBookAnnotations: (assetId: string) => ipcRenderer.invoke('annotations:getByBook', assetId),
  searchAnnotations: (keyword: string) => ipcRenderer.invoke('annotations:search', keyword),
  getHighlightContext: (assetId: string, locationCfi: string, selectedText: string) =>
    ipcRenderer.invoke('context:get', assetId, locationCfi, selectedText),

  updateAnnotationMeta: (uuid: string, updates: any) =>
    ipcRenderer.invoke('meta:update', uuid, updates),
  addTag: (uuid: string, tag: string) => ipcRenderer.invoke('tag:add', uuid, tag),
  removeTag: (uuid: string, tag: string) => ipcRenderer.invoke('tag:remove', uuid, tag),
  getAllTags: () => ipcRenderer.invoke('tag:getAll'),

  getDailyReviewQueue: (limit?: number) => ipcRenderer.invoke('review:getQueue', limit),
  submitReviewResult: (uuid: string, result: any) => ipcRenderer.invoke('review:submit', uuid, result),

  getColorSemantics: () => ipcRenderer.invoke('semantics:get'),
  updateColorSemantic: (colorKey: any, label: string) => ipcRenderer.invoke('semantics:update', colorKey, label),
  openInAppleBooks: (assetId: string, epubPath?: string | null) =>
    ipcRenderer.invoke('system:openAppleBooks', assetId, epubPath),
  selectCustomDataDir: () => ipcRenderer.invoke('system:selectCustomDir'),
  exportMarkdown: (assetId: string, format: 'standard' | 'obsidian') =>
    ipcRenderer.invoke('export:markdown', assetId, format)
};

contextBridge.exposeInMainWorld('bookEchoAPI', api);
```

- [ ] **Step 2: 编写 Electron 主进程并注册全套 IPC 处理器**

创建 `electron/main.ts`:
```typescript
import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { SnapshotSyncer } from './services/snapshotSyncer';
import { UserVaultDb } from './services/userVaultDb';
import { EpubContextEngine } from './services/epubContextEngine';
import { MarkdownExporter } from './services/markdownExporter';
import { AnnotationItem } from './types/ipc';

let mainWindow: BrowserWindow | null = null;
let syncer: SnapshotSyncer;
let vault: UserVaultDb;
let epubEngine: EpubContextEngine;

function initializeServices() {
  const userDataPath = app.getPath('userData');
  const cacheDir = path.join(userDataPath, 'snapshots');
  const vaultDbPath = path.join(userDataPath, 'user_vault.sqlite');

  vault = new UserVaultDb(vaultDbPath);
  epubEngine = new EpubContextEngine();

  const customDir = vault.getSetting('custom_apple_books_dir');
  syncer = new SnapshotSyncer({
    cacheDir,
    customBkDir: customDir ? path.join(customDir, 'BKLibrary') : undefined,
    customAeDir: customDir ? path.join(customDir, 'AEAnnotation') : undefined
  });
}

function registerIpcHandlers() {
  ipcMain.handle('books:getAll', async () => {
    return syncer.extractBooks();
  });

  ipcMain.handle('annotations:getByBook', async (_, assetId: string) => {
    const rawList = syncer.extractAnnotations(assetId);
    const books = syncer.extractBooks();
    const book = books.find(b => b.assetId === assetId);

    return rawList.map(item => {
      const meta = vault.getAnnotationMeta(item.uuid);
      const tags = vault.getTagsForAnnotation(item.uuid);

      // 若未解析过章节，尝试通过 EPUB 解析
      let chapterTitle = meta?.resolvedChapter || item.chapterTitle;
      let sortIndex = meta?.sortIndex || item.sortIndex;

      if ((!meta?.resolvedChapter || meta.resolvedChapter === '默认章节') && book?.epubPath) {
        const resolved = epubEngine.resolveChapter(book.epubPath, item.locationCfi);
        chapterTitle = resolved.chapterTitle;
        sortIndex = resolved.sortIndex;
        vault.updateAnnotationMeta(item.uuid, { resolvedChapter: chapterTitle, sortIndex });
      }

      return {
        ...item,
        chapterTitle,
        sortIndex,
        customNote: meta?.customNote || '',
        isStarred: meta?.isStarred || false,
        reviewStatus: meta?.reviewStatus || 'active',
        reviewCount: meta?.reviewCount || 0,
        lastReviewedAtMs: meta?.lastReviewedAtMs || null,
        tags
      };
    }).sort((a, b) => a.sortIndex - b.sortIndex || a.creationDateMs - b.creationDateMs);
  });

  ipcMain.handle('annotations:search', async (_, keyword: string) => {
    const all = syncer.extractAnnotations();
    const lower = keyword.toLowerCase().trim();
    if (!lower) return [];

    return all.filter(a =>
      a.selectedText.toLowerCase().includes(lower) ||
      (a.note && a.note.toLowerCase().includes(lower))
    ).map(item => {
      const meta = vault.getAnnotationMeta(item.uuid);
      const tags = vault.getTagsForAnnotation(item.uuid);
      return {
        ...item,
        customNote: meta?.customNote || '',
        isStarred: meta?.isStarred || false,
        tags
      };
    });
  });

  ipcMain.handle('context:get', async (_, assetId: string, locationCfi: string, selectedText: string) => {
    const books = syncer.extractBooks();
    const book = books.find(b => b.assetId === assetId);
    if (!book || !book.epubPath) {
      return {
        available: false,
        reason: 'FILE_NOT_DOWNLOADED',
        beforeParagraphs: [],
        currentParagraph: '',
        selectedText,
        afterParagraphs: []
      };
    }
    return epubEngine.extractParagraphContext(book.epubPath, locationCfi, selectedText);
  });

  ipcMain.handle('meta:update', async (_, uuid: string, updates: any) => {
    vault.updateAnnotationMeta(uuid, updates);
  });

  ipcMain.handle('tag:add', async (_, uuid: string, tag: string) => {
    vault.addTag(uuid, tag);
  });

  ipcMain.handle('tag:remove', async (_, uuid: string, tag: string) => {
    vault.removeTag(uuid, tag);
  });

  ipcMain.handle('tag:getAll', async () => {
    return vault.getAllTags();
  });

  ipcMain.handle('review:getQueue', async (_, limit = 6) => {
    const all = syncer.extractAnnotations();
    const uuids = all.map(a => a.uuid);
    const scored = vault.getReviewCandidates(uuids);
    const topUuids = scored.filter(s => s.score > -9000).slice(0, limit).map(s => s.uuid);

    const books = syncer.extractBooks();
    const bookMap = new Map(books.map(b => [b.assetId, b]));

    return all.filter(a => topUuids.includes(a.uuid)).map(item => {
      const meta = vault.getAnnotationMeta(item.uuid);
      const tags = vault.getTagsForAnnotation(item.uuid);
      const book = bookMap.get(item.assetId);
      return {
        ...item,
        customNote: meta?.customNote || '',
        isStarred: meta?.isStarred || false,
        tags,
        bookTitle: book?.title || '未知书籍'
      };
    });
  });

  ipcMain.handle('review:submit', async (_, uuid: string, result: 'remembered' | 'mastered' | 'reset') => {
    vault.recordReviewResult(uuid, result);
  });

  ipcMain.handle('semantics:get', async () => {
    return vault.getColorSemantics();
  });

  ipcMain.handle('semantics:update', async (_, colorKey: any, label: string) => {
    vault.updateColorSemantic(colorKey, label);
  });

  ipcMain.handle('system:openAppleBooks', async (_, _assetId: string, epubPath?: string | null) => {
    if (epubPath && fs.existsSync(epubPath)) {
      await shell.openPath(epubPath);
      return true;
    }
    await shell.openExternal('ibooks://');
    return true;
  });

  ipcMain.handle('system:selectCustomDir', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: '选择 Apple Books 数据备份或同步目录'
    });
    if (!result.canceled && result.filePaths[0]) {
      const selected = result.filePaths[0];
      vault.setSetting('custom_apple_books_dir', selected);
      initializeServices();
      return selected;
    }
    return null;
  });

  ipcMain.handle('export:markdown', async (_, assetId: string, format: 'standard' | 'obsidian') => {
    if (!mainWindow) return { success: false };
    const books = syncer.extractBooks();
    const book = books.find(b => b.assetId === assetId);
    if (!book) return { success: false };

    const annotations = syncer.extractAnnotations(assetId).map(item => {
      const meta = vault.getAnnotationMeta(item.uuid);
      const tags = vault.getTagsForAnnotation(item.uuid);
      return {
        ...item,
        customNote: meta?.customNote || '',
        isStarred: meta?.isStarred || false,
        tags
      };
    });

    const content = format === 'obsidian'
      ? MarkdownExporter.formatObsidianMarkdown(book, annotations)
      : MarkdownExporter.formatStandardMarkdown(book, annotations);

    const result = await dialog.showSaveDialog(mainWindow, {
      title: '导出读书笔记 Markdown',
      defaultPath: `${book.title}_笔记.md`,
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    });

    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, content, 'utf-8');
      return { success: true, filePath: result.filePath };
    }
    return { success: false };
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  initializeServices();
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

- [ ] **Step 3: 编写 IPC 接口连通性测试**

创建 `tests/ipcContract.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { BookEchoAPI } from '../electron/types/ipc';

describe('IPC API Contract Check', () => {
  it('should define all required API methods on window.bookEchoAPI interface', () => {
    // 静态校验契约完备性
    const keys: (keyof BookEchoAPI)[] = [
      'getBooks', 'getBookAnnotations', 'searchAnnotations', 'getHighlightContext',
      'updateAnnotationMeta', 'addTag', 'removeTag', 'getAllTags',
      'getDailyReviewQueue', 'submitReviewResult', 'getColorSemantics',
      'updateColorSemantic', 'openInAppleBooks', 'selectCustomDataDir', 'exportMarkdown'
    ];
    expect(keys.length).toBe(15);
  });
});
```

- [ ] **Step 4: 运行测试并验证通过**

运行:
```bash
npm test tests/ipcContract.test.ts
```
预期: PASS

- [ ] **Step 5: 提交 Electron 主进程与 Preload IPC 代码**

```bash
git add electron/preload.ts electron/main.ts tests/ipcContract.test.ts
git commit -m "feat(electron): wire main process IPC handlers and type-safe preload bridge"
```

---

### Task 8: 侧边导航栏与色彩语义筛选器 (Sidebar & Color Filters)

**Files:**
- Create: `src/components/Sidebar.tsx`
- Modify: `src/App.tsx`
- Test: `tests/components/Sidebar.test.tsx`

**Interfaces:**
- Consumes: `ColorSemanticConfig`, `HighlightColor`
- Produces: `Sidebar` 组件，提供“全部书架”、“每日回顾”、“全局搜索”、“色彩语义过滤胶囊”、“标签树”与“手动选目录/权限引导”入口。

- [ ] **Step 1: 编写 Sidebar 组件**

创建 `src/components/Sidebar.tsx`:
```tsx
import React from 'react';
import { BookOpen, Sparkles, Search, Tag, Settings, FolderOpen, Sun, Moon } from 'lucide-react';
import { ColorSemanticConfig, HighlightColor } from '../../electron/types/ipc';

interface SidebarProps {
  currentTab: 'books' | 'review' | 'search';
  onSelectTab: (tab: 'books' | 'review' | 'search') => void;
  colorSemantics: ColorSemanticConfig[];
  selectedColor: HighlightColor | null;
  onSelectColor: (color: HighlightColor | null) => void;
  tags: string[];
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onSelectCustomDir: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  colorSemantics,
  selectedColor,
  onSelectColor,
  tags,
  selectedTag,
  onSelectTag,
  isDarkMode,
  onToggleDarkMode,
  onSelectCustomDir
}) => {
  return (
    <aside className="w-60 flex-shrink-0 flex flex-col justify-between border-r border-paper-border bg-paper-sidebar p-4 select-none">
      <div className="space-y-6">
        {/* macOS Traffic Lights 占位区 */}
        <div className="h-6"></div>

        {/* 软件标题 */}
        <div className="px-2">
          <h1 className="font-serif text-xl font-bold tracking-wide text-paper-text">BookEcho</h1>
          <p className="text-xs text-paper-muted mt-0.5">个人读书精华馆</p>
        </div>

        {/* 主导航区 */}
        <nav className="space-y-1">
          <button
            onClick={() => onSelectTab('books')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
              currentTab === 'books' && !selectedColor && !selectedTag
                ? 'bg-white shadow-sm font-medium text-paper-text'
                : 'text-paper-muted hover:bg-black/5 hover:text-paper-text'
            }`}
          >
            <BookOpen className="w-4 h-4 text-paper-terracotta" />
            <span>全部书架</span>
          </button>

          <button
            onClick={() => onSelectTab('review')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
              currentTab === 'review'
                ? 'bg-white shadow-sm font-medium text-paper-text'
                : 'text-paper-muted hover:bg-black/5 hover:text-paper-text'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>每日回顾</span>
          </button>

          <button
            onClick={() => onSelectTab('search')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
              currentTab === 'search'
                ? 'bg-white shadow-sm font-medium text-paper-text'
                : 'text-paper-muted hover:bg-black/5 hover:text-paper-text'
            }`}
          >
            <Search className="w-4 h-4 text-blue-500" />
            <span>全局搜索</span>
          </button>
        </nav>

        {/* 色彩语义快速过滤 */}
        <div>
          <div className="px-3 text-xs font-semibold text-paper-muted uppercase tracking-wider mb-2">
            色彩语义
          </div>
          <div className="space-y-0.5">
            {colorSemantics.map(s => {
              const isSelected = selectedColor === s.colorKey;
              return (
                <button
                  key={s.colorKey}
                  onClick={() => onSelectColor(isSelected ? null : s.colorKey)}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md text-xs transition-colors ${
                    isSelected ? 'bg-white font-medium text-paper-text shadow-sm' : 'text-paper-muted hover:bg-black/5'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: s.hexColor }}
                    />
                    <span>{s.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 我的标签树 */}
        {tags.length > 0 && (
          <div>
            <div className="px-3 text-xs font-semibold text-paper-muted uppercase tracking-wider mb-2">
              标签
            </div>
            <div className="flex flex-wrap gap-1.5 px-2">
              {tags.map(t => {
                const isSelected = selectedTag === t;
                return (
                  <button
                    key={t}
                    onClick={() => onSelectTag(isSelected ? null : t)}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                      isSelected
                        ? 'bg-paper-terracotta text-white font-medium'
                        : 'bg-white/70 text-paper-muted hover:bg-white hover:text-paper-text'
                    }`}
                  >
                    <Tag className="w-3 h-3" />
                    <span>#{t}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 底部系统操作 */}
      <div className="pt-4 border-t border-paper-border space-y-2">
        <button
          onClick={onSelectCustomDir}
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-paper-muted hover:bg-black/5"
          title="切换数据源路径"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span>切换数据目录</span>
        </button>

        <button
          onClick={onToggleDarkMode}
          className="w-full flex items-center justify-between px-3 py-1.5 rounded-md text-xs text-paper-muted hover:bg-black/5"
        >
          <span className="flex items-center gap-2">
            {isDarkMode ? <Sun className="w-3.5 h-3.5 text-amber-500" /> : <Moon className="w-3.5 h-3.5" />}
            <span>{isDarkMode ? '浅色模式' : '深色夜读'}</span>
          </span>
        </button>
      </div>
    </aside>
  );
};
```

- [ ] **Step 2: 编写并运行构建测试**

运行:
```bash
npm run build
```
预期: PASS

- [ ] **Step 3: 提交 Sidebar 组件**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat(ui): implement responsive sidebar with semantic color filters and tag tree"
```

---

### Task 9: 书架网格视图与阅读统计 (Bookshelf View)

**Files:**
- Create: `src/components/BookshelfView.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `BookItem` 列表
- Produces: `BookshelfView` 组件，呈现书封、书名、作者、划线统计与最近阅读时间，点击书籍进入单书精读。

- [ ] **Step 1: 编写 BookshelfView 组件**

创建 `src/components/BookshelfView.tsx`:
```tsx
import React, { useState } from 'react';
import { BookItem } from '../../electron/types/ipc';
import { Book, Highlighter, Clock, ArrowUpDown } from 'lucide-react';

interface BookshelfViewProps {
  books: BookItem[];
  onSelectBook: (book: BookItem) => void;
}

export const BookshelfView: React.FC<BookshelfViewProps> = ({ books, onSelectBook }) => {
  const [sortBy, setSortBy] = useState<'recent' | 'highlights' | 'title'>('recent');

  const sortedBooks = [...books].sort((a, b) => {
    if (sortBy === 'highlights') return b.highlightsCount - a.highlightsCount;
    if (sortBy === 'title') return a.title.localeCompare(b.title);
    return (b.lastOpenDateMs || 0) - (a.lastOpenDateMs || 0);
  });

  const totalHighlights = books.reduce((acc, b) => acc + b.highlightsCount, 0);

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-paper-bg">
      {/* 顶部统计横幅 */}
      <div className="flex items-end justify-between pb-6 border-b border-paper-border mb-8">
        <div>
          <h2 className="text-3xl font-serif font-bold text-paper-text">我的书库</h2>
          <p className="text-sm text-paper-muted mt-1">
            共收录 {books.length} 本书 · 累计 {totalHighlights} 条高亮与思考
          </p>
        </div>

        {/* 排序切换 */}
        <div className="flex items-center gap-2 text-xs text-paper-muted">
          <ArrowUpDown className="w-3.5 h-3.5" />
          <span>排序方式:</span>
          <button
            onClick={() => setSortBy('recent')}
            className={`px-2 py-1 rounded transition-colors ${sortBy === 'recent' ? 'bg-white text-paper-text font-medium shadow-sm' : 'hover:text-paper-text'}`}
          >
            最近阅读
          </button>
          <button
            onClick={() => setSortBy('highlights')}
            className={`px-2 py-1 rounded transition-colors ${sortBy === 'highlights' ? 'bg-white text-paper-text font-medium shadow-sm' : 'hover:text-paper-text'}`}
          >
            笔记数量
          </button>
          <button
            onClick={() => setSortBy('title')}
            className={`px-2 py-1 rounded transition-colors ${sortBy === 'title' ? 'bg-white text-paper-text font-medium shadow-sm' : 'hover:text-paper-text'}`}
          >
            书名
          </button>
        </div>
      </div>

      {/* 书籍网格 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {sortedBooks.map(book => (
          <div
            key={book.assetId}
            onClick={() => onSelectBook(book)}
            className="group cursor-pointer flex flex-col bg-paper-card border border-paper-border rounded-xl p-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
          >
            {/* 封面拟真区域 */}
            <div className="aspect-[3/4] w-full rounded-lg bg-paper-drawer border border-paper-border/60 flex items-center justify-center overflow-hidden mb-3 relative group-hover:border-paper-terracotta/40">
              {book.coverUrl ? (
                <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
              ) : (
                <div className="p-4 text-center">
                  <Book className="w-8 h-8 mx-auto text-paper-muted/60 mb-2" />
                  <span className="font-serif text-xs font-semibold text-paper-text line-clamp-3">
                    {book.title}
                  </span>
                </div>
              )}

              {/* 划线数量标签 */}
              <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm text-white px-2 py-0.5 rounded text-[11px]">
                <Highlighter className="w-3 h-3 text-amber-400" />
                <span>{book.highlightsCount}</span>
              </div>
            </div>

            {/* 书籍信息 */}
            <h3 className="font-serif text-sm font-bold text-paper-text line-clamp-1 group-hover:text-paper-terracotta transition-colors">
              {book.title}
            </h3>
            <p className="text-xs text-paper-muted line-clamp-1 mt-0.5">
              {book.author || '未知作者'}
            </p>

            {book.lastOpenDateMs && (
              <div className="flex items-center gap-1 text-[11px] text-paper-muted/80 mt-2 pt-2 border-t border-paper-border/40">
                <Clock className="w-3 h-3" />
                <span>{new Date(book.lastOpenDateMs).toLocaleDateString('zh-CN')}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: 运行构建测试验证**

运行:
```bash
npm run build
```
预期: PASS

- [ ] **Step 3: 提交 BookshelfView 组件**

```bash
git add src/components/BookshelfView.tsx
git commit -m "feat(ui): implement bookshelf grid view with reading progress and sorting"
```

---

### Task 10: 单书沉浸式笔记流与高亮卡片 (BookDetailView & HighlightCard)

**Files:**
- Create: `src/components/HighlightCard.tsx`
- Create: `src/components/BookDetailView.tsx`

**Interfaces:**
- Consumes: `BookItem`, `AnnotationItem`, `ColorSemanticConfig`, `HighlightContextResult`
- Produces: 沉浸式单书笔记流、章节分组、色彩语义标尺、二次思考输入、标签增删、原文前后自然段展开抽屉以及金句卡片唤起。

- [ ] **Step 1: 编写 HighlightCard 组件**

创建 `src/components/HighlightCard.tsx`:
```tsx
import React, { useState } from 'react';
import { AnnotationItem, ColorSemanticConfig, HighlightContextResult } from '../../electron/types/ipc';
import { Star, MessageSquare, ChevronDown, ChevronUp, Image, Tag, Plus, Check } from 'lucide-react';

interface HighlightCardProps {
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
    if (!isContextOpen && !contextData) {
      setIsLoadingContext(true);
      const res = await onRequestContext(annotation);
      setContextData(res);
      setIsLoadingContext(false);
    }
    setIsContextOpen(!isContextOpen);
  };

  const handleSaveNote = () => {
    onUpdateCustomNote(annotation.uuid, noteText);
    setIsEditingNote(false);
  };

  const handleAddTag = () => {
    if (newTagText.trim()) {
      onAddTag(annotation.uuid, newTagText.trim());
      setNewTagText('');
      setIsTagInputOpen(false);
    }
  };

  return (
    <div className="bg-paper-card border border-paper-border rounded-xl p-5 relative overflow-hidden transition-shadow hover:shadow-sm">
      {/* 左侧 4px 语义色标 */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ backgroundColor: colorHex }}
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
          <span className="text-[11px] text-paper-muted">
            {new Date(annotation.creationDateMs).toLocaleDateString('zh-CN')}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onOpenQuoteModal(annotation)}
            className="p-1 rounded text-paper-muted hover:text-paper-terracotta hover:bg-black/5"
            title="生成金句卡片"
          >
            <Image className="w-4 h-4" />
          </button>
          <button
            onClick={() => onToggleStar(annotation.uuid)}
            className={`p-1 rounded transition-colors ${
              annotation.isStarred ? 'text-amber-500' : 'text-paper-muted hover:text-amber-500 hover:bg-black/5'
            }`}
            title="标记核心重点"
          >
            <Star className="w-4 h-4" fill={annotation.isStarred ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>

      {/* 高亮正文（衬线排版） */}
      <blockquote className="pl-2 font-serif text-[16px] leading-relaxed text-paper-text tracking-wide mb-3">
        “{annotation.selectedText}”
      </blockquote>

      {/* Apple Books 原生自带批注 */}
      {annotation.note && (
        <div className="ml-2 mb-3 px-3 py-2 rounded-lg bg-paper-sidebar/60 border border-paper-border/60 text-xs text-paper-text/90">
          <span className="font-semibold text-paper-muted mr-1.5">原文划线想法：</span>
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
              className="w-full text-xs p-2.5 rounded-lg border border-paper-border bg-paper-drawer text-paper-text focus:outline-none focus:ring-1 focus:ring-paper-terracotta resize-none h-18"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsEditingNote(false)}
                className="px-2.5 py-1 text-xs text-paper-muted hover:text-paper-text"
              >
                取消
              </button>
              <button
                onClick={handleSaveNote}
                className="px-3 py-1 text-xs bg-paper-terracotta text-white rounded font-medium"
              >
                保存思考
              </button>
            </div>
          </div>
        ) : annotation.customNote ? (
          <div
            onClick={() => setIsEditingNote(true)}
            className="cursor-pointer group flex items-start gap-1.5 text-xs text-paper-muted hover:text-paper-text"
          >
            <MessageSquare className="w-3.5 h-3.5 text-paper-terracotta mt-0.5 flex-shrink-0" />
            <span>{annotation.customNote}</span>
          </div>
        ) : (
          <button
            onClick={() => setIsEditingNote(true)}
            className="flex items-center gap-1 text-[11px] text-paper-muted/70 hover:text-paper-terracotta"
          >
            <Plus className="w-3 h-3" />
            <span>补充深度想法</span>
          </button>
        )}
      </div>

      {/* 标签栏 */}
      <div className="ml-2 flex flex-wrap items-center gap-1.5 pt-2 border-t border-paper-border/40">
        {annotation.tags?.map(t => (
          <span
            key={t}
            className="group flex items-center gap-1 bg-paper-drawer px-2 py-0.5 rounded text-[11px] text-paper-muted"
          >
            <Tag className="w-2.5 h-2.5" />
            <span>#{t}</span>
            <button
              onClick={() => onRemoveTag(annotation.uuid, t)}
              className="hidden group-hover:inline hover:text-red-500 ml-0.5"
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
              onKeyDown={e => e.key === 'Enter' && handleAddTag()}
              placeholder="标签名"
              className="text-[11px] px-1.5 py-0.5 rounded border border-paper-border bg-white w-20 focus:outline-none"
              autoFocus
            />
            <button onClick={handleAddTag} className="text-paper-terracotta">
              <Check className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsTagInputOpen(true)}
            className="text-[11px] text-paper-muted/60 hover:text-paper-terracotta flex items-center gap-0.5"
          >
            <Plus className="w-2.5 h-2.5" />
            <span>标签</span>
          </button>
        )}

        {/* 原文语境抽屉开关 */}
        <button
          onClick={handleToggleContext}
          className="ml-auto flex items-center gap-1 text-[11px] text-paper-muted hover:text-paper-text"
        >
          <span>{isContextOpen ? '收起原文' : '展开原文语境'}</span>
          {isContextOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* 原文前后上下文展开区域 */}
      {isContextOpen && (
        <div className="mt-4 pt-3 border-t border-paper-border/60 bg-paper-drawer -mx-5 -mb-5 p-4 text-xs font-serif leading-relaxed text-paper-text/80 space-y-2">
          {isLoadingContext ? (
            <p className="text-paper-muted animate-pulse">正在从 EPUB 文件提取原文前后自然段...</p>
          ) : contextData && contextData.available ? (
            <>
              {contextData.beforeParagraphs.map((para, i) => (
                <p key={`before-${i}`} className="opacity-60">{para}</p>
              ))}
              <p
                className="font-medium p-1.5 rounded"
                style={{ backgroundColor: `${colorHex}25`, borderLeft: `3px solid ${colorHex}` }}
              >
                {contextData.currentParagraph}
              </p>
              {contextData.afterParagraphs.map((para, i) => (
                <p key={`after-${i}`} className="opacity-60">{para}</p>
              ))}
            </>
          ) : (
            <p className="text-paper-muted italic">
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
```

- [ ] **Step 2: 编写 BookDetailView 组件**

创建 `src/components/BookDetailView.tsx`:
```tsx
import React from 'react';
import { BookItem, AnnotationItem, ColorSemanticConfig, HighlightContextResult } from '../../electron/types/ipc';
import { HighlightCard } from './HighlightCard';
import { ArrowLeft, ExternalLink, Download } from 'lucide-react';

interface BookDetailViewProps {
  book: BookItem;
  annotations: AnnotationItem[];
  colorSemantics: ColorSemanticConfig[];
  onBack: () => void;
  onOpenInAppleBooks: (assetId: string, epubPath?: string | null) => void;
  onExportMarkdown: (assetId: string) => void;
  onToggleStar: (uuid: string) => void;
  onUpdateCustomNote: (uuid: string, note: string) => void;
  onAddTag: (uuid: string, tag: string) => void;
  onRemoveTag: (uuid: string, tag: string) => void;
  onOpenQuoteModal: (annotation: AnnotationItem) => void;
  onRequestContext: (annotation: AnnotationItem) => Promise<HighlightContextResult>;
}

export const BookDetailView: React.FC<BookDetailViewProps> = ({
  book,
  annotations,
  colorSemantics,
  onBack,
  onOpenInAppleBooks,
  onExportMarkdown,
  onToggleStar,
  onUpdateCustomNote,
  onAddTag,
  onRemoveTag,
  onOpenQuoteModal,
  onRequestContext
}) => {
  // 按章节分组
  const chapterGroups = annotations.reduce((acc, anno) => {
    const chapter = anno.chapterTitle || '默认章节';
    if (!acc[chapter]) acc[chapter] = [];
    acc[chapter].push(anno);
    return acc;
  }, {} as Record<string, AnnotationItem[]>);

  return (
    <div className="flex-1 overflow-y-auto bg-paper-bg p-8">
      {/* 顶栏导航 */}
      <div className="flex items-center justify-between pb-6 mb-8 border-b border-paper-border">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-paper-muted hover:text-paper-text transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>返回全部书架</span>
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onOpenInAppleBooks(book.assetId, book.epubPath)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-paper-border bg-paper-card text-xs text-paper-muted hover:text-paper-text shadow-sm"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>在 Apple Books 中阅读</span>
          </button>

          <button
            onClick={() => onExportMarkdown(book.assetId)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-paper-terracotta text-white text-xs font-medium shadow-sm hover:opacity-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>导出 Markdown</span>
          </button>
        </div>
      </div>

      {/* 书籍信息横幅 */}
      <div className="flex gap-6 mb-10 pb-8 border-b border-paper-border/60">
        <div className="w-24 h-32 rounded-lg bg-paper-card border border-paper-border flex-shrink-0 overflow-hidden shadow-sm">
          {book.coverUrl ? (
            <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center font-serif text-center p-2 text-xs font-bold text-paper-muted">
              {book.title}
            </div>
          )}
        </div>

        <div>
          <h1 className="font-serif text-2xl font-bold text-paper-text mb-1">{book.title}</h1>
          <p className="text-sm text-paper-muted mb-3">{book.author || '未知作者'} · {book.genre || '未分类'}</p>
          <p className="text-xs text-paper-muted/80">
            共精选 {annotations.length} 条划线笔记 · 阅读进度 {Math.round(book.readingProgress * 100)}%
          </p>
        </div>
      </div>

      {/* 章节流式展示 */}
      <div className="space-y-10 max-w-4xl">
        {Object.entries(chapterGroups).map(([chapter, items]) => (
          <section key={chapter} className="space-y-4">
            <h2 className="font-serif text-lg font-bold text-paper-text flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-paper-terracotta" />
              <span>{chapter}</span>
              <span className="text-xs font-normal text-paper-muted">({items.length}条)</span>
            </h2>

            <div className="space-y-4">
              {items.map(anno => (
                <HighlightCard
                  key={anno.uuid}
                  annotation={anno}
                  colorSemantics={colorSemantics}
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
        ))}
      </div>
    </div>
  );
};
```

- [ ] **Step 3: 运行构建测试验证**

运行:
```bash
npm run build
```
预期: PASS

- [ ] **Step 4: 提交单书精读与高亮卡片组件**

```bash
git add src/components/HighlightCard.tsx src/components/BookDetailView.tsx
git commit -m "feat(ui): implement book detail stream with chapter groups and highlight cards"
```

---

### Task 11: 每日漫游回顾专注视图 (Daily Review View)

**Files:**
- Create: `src/components/DailyReviewView.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `AnnotationItem` 列表、`submitReviewResult`
- Produces: 居中单卡专注回顾视图、快捷打标（💡启发 / ✅内化 / ⏭️下一条）以及键盘快捷键支持。

- [ ] **Step 1: 编写 DailyReviewView 组件**

创建 `src/components/DailyReviewView.tsx`:
```tsx
import React, { useState, useEffect } from 'react';
import { AnnotationItem, ColorSemanticConfig } from '../../electron/types/ipc';
import { Sparkles, Check, RotateCcw, ChevronRight, BookOpen, Star } from 'lucide-react';

interface DailyReviewViewProps {
  queue: AnnotationItem[];
  colorSemantics: ColorSemanticConfig[];
  onSubmitResult: (uuid: string, result: 'remembered' | 'mastered' | 'reset') => void;
  onRefreshQueue: () => void;
}

export const DailyReviewView: React.FC<DailyReviewViewProps> = ({
  queue,
  colorSemantics,
  onSubmitResult,
  onRefreshQueue
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const currentItem = queue[currentIndex];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!currentItem) return;
      if (e.key === 'ArrowRight' || e.key === ' ') {
        handleAction('remembered');
      } else if (e.key === 'Enter') {
        handleAction('mastered');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, currentItem]);

  const handleAction = (result: 'remembered' | 'mastered' | 'reset') => {
    if (!currentItem) return;
    onSubmitResult(currentItem.uuid, result);
    if (currentIndex < queue.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setCurrentIndex(queue.length);
    }
  };

  if (!currentItem || currentIndex >= queue.length) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-paper-bg text-center">
        <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 mb-4">
          <Sparkles className="w-8 h-8" />
        </div>
        <h2 className="font-serif text-2xl font-bold text-paper-text mb-2">今日回顾已达成！</h2>
        <p className="text-sm text-paper-muted max-w-sm mb-6">
          温故而知新。你已经完成今天全部读书高亮漫游，这些思考已深深印入知识体系中。
        </p>
        <button
          onClick={() => {
            setCurrentIndex(0);
            onRefreshQueue();
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-paper-terracotta text-white text-sm font-medium shadow-sm hover:opacity-95"
        >
          <RotateCcw className="w-4 h-4" />
          <span>换一批再次漫游</span>
        </button>
      </div>
    );
  }

  const semantic = colorSemantics.find(s => s.colorKey === currentItem.colorKey);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-paper-bg">
      {/* 进度计数器 */}
      <div className="w-full max-w-xl flex items-center justify-between text-xs text-paper-muted mb-4">
        <span className="flex items-center gap-1 font-medium">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>每日漫游 · 专注模式</span>
        </span>
        <span>{currentIndex + 1} / {queue.length}</span>
      </div>

      {/* 沉浸式单卡 */}
      <div className="w-full max-w-xl bg-paper-card border border-paper-border rounded-2xl p-8 shadow-sm relative overflow-hidden">
        <div
          className="absolute top-0 left-0 right-0 h-1.5"
          style={{ backgroundColor: semantic?.hexColor || '#F5A623' }}
        />

        <div className="flex items-center justify-between text-xs text-paper-muted mb-4">
          <div className="flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-paper-terracotta" />
            <span className="font-medium text-paper-text">{(currentItem as any).bookTitle || '未知书籍'}</span>
            <span>·</span>
            <span>{currentItem.chapterTitle}</span>
          </div>
          {currentItem.isStarred && (
            <Star className="w-4 h-4 text-amber-500" fill="currentColor" />
          )}
        </div>

        <blockquote className="font-serif text-lg leading-relaxed text-paper-text tracking-wide mb-6">
          “{currentItem.selectedText}”
        </blockquote>

        {currentItem.note && (
          <div className="mb-4 p-3 rounded-lg bg-paper-drawer text-xs text-paper-text/90">
            <span className="font-semibold text-paper-muted mr-1">划线想法：</span>
            {currentItem.note}
          </div>
        )}

        {currentItem.customNote && (
          <div className="mb-4 text-xs text-paper-muted">
            <span className="font-semibold text-paper-terracotta mr-1">延伸思考：</span>
            {currentItem.customNote}
          </div>
        )}

        {/* 快捷操作栏 */}
        <div className="flex items-center justify-between pt-6 border-t border-paper-border/60">
          <span className="text-[11px] text-paper-muted">
            按 <kbd className="px-1.5 py-0.5 rounded bg-black/5">空格</kbd> 下一条，<kbd className="px-1.5 py-0.5 rounded bg-black/5">Enter</kbd> 标为内化
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleAction('mastered')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-paper-border text-xs text-paper-muted hover:text-green-600 hover:border-green-600/40"
              title="已彻底掌握，减少漫游频率"
            >
              <Check className="w-3.5 h-3.5" />
              <span>已内化</span>
            </button>

            <button
              onClick={() => handleAction('remembered')}
              className="flex items-center gap-1 px-4 py-1.5 rounded-lg bg-paper-terracotta text-white text-xs font-medium hover:opacity-95 shadow-sm"
            >
              <span>有启发</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: 运行构建测试验证**

运行:
```bash
npm run build
```
预期: PASS

- [ ] **Step 3: 提交每日回顾组件**

```bash
git add src/components/DailyReviewView.tsx
git commit -m "feat(ui): implement daily review focus view with spaced repetition shortcuts"
```

---

### Task 12: 高颜值金句卡片工作台与导出预览 (QuoteCardModal & ExportModal)

**Files:**
- Create: `src/components/QuoteCardModal.tsx`
- Create: `src/components/ExportModal.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `AnnotationItem`, `BookItem`, `html-to-image`
- Produces: 4 套精美设计模版渲染（经典纸书、瑞士极简、暗夜流光、森林晨雾）、复制高清图至剪贴板、Markdown 格式选择与导出触发。

- [ ] **Step 1: 编写 QuoteCardModal 组件**

创建 `src/components/QuoteCardModal.tsx`:
```tsx
import React, { useRef, useState } from 'react';
import { AnnotationItem } from '../../electron/types/ipc';
import { toPng } from 'html-to-image';
import { X, Copy, Check, Download } from 'lucide-react';

interface QuoteCardModalProps {
  annotation: AnnotationItem;
  bookTitle: string;
  author: string;
  onClose: () => void;
}

type CardTheme = 'classic' | 'swiss' | 'obsidian' | 'sage';

export const QuoteCardModal: React.FC<QuoteCardModalProps> = ({
  annotation,
  bookTitle,
  author,
  onClose
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<CardTheme>('classic');
  const [showNote, setShowNote] = useState(true);
  const [isCopied, setIsCopied] = useState(false);

  const themeStyles: Record<CardTheme, { bg: string; text: string; subText: string; border: string }> = {
    classic: {
      bg: 'bg-[#FAF7F2]',
      text: 'text-[#1E1D1A]',
      subText: 'text-[#6E6A63]',
      border: 'border-[#E6E1D6]'
    },
    swiss: {
      bg: 'bg-white',
      text: 'text-black',
      subText: 'text-neutral-500',
      border: 'border-black'
    },
    obsidian: {
      bg: 'bg-[#141413]',
      text: 'text-[#EAE6DF]',
      subText: 'text-[#9A958C]',
      border: 'border-[#302F2C]'
    },
    sage: {
      bg: 'bg-[#EBF0EC]',
      text: 'text-[#1C2820]',
      subText: 'text-[#4A5D50]',
      border: 'border-[#D1DDD3]'
    }
  };

  const handleCopyImage = async () => {
    if (!cardRef.current) return;
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2.5 });
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy card image', e);
    }
  };

  const handleDownloadImage = async () => {
    if (!cardRef.current) return;
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2.5 });
      const link = document.createElement('a');
      link.download = `${bookTitle}_金句卡片.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error('Failed to download card image', e);
    }
  };

  const currentTheme = themeStyles[theme];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-paper-card border border-paper-border rounded-2xl w-full max-w-2xl p-6 shadow-xl space-y-6">
        {/* 顶部标题与关闭 */}
        <div className="flex items-center justify-between pb-3 border-b border-paper-border">
          <h3 className="font-serif text-lg font-bold text-paper-text">金句卡片设计工坊</h3>
          <button onClick={onClose} className="p-1 rounded text-paper-muted hover:text-paper-text">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 模版与选项栏 */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span>主题模板:</span>
            {(['classic', 'swiss', 'obsidian', 'sage'] as CardTheme[]).map(t => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`px-2.5 py-1 rounded capitalize transition-colors ${
                  theme === t ? 'bg-paper-terracotta text-white font-medium' : 'bg-paper-drawer text-paper-text hover:bg-black/5'
                }`}
              >
                {t === 'classic' ? '经典纸书' : t === 'swiss' ? '瑞士极简' : t === 'obsidian' ? '暗夜流光' : '森林晨雾'}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showNote}
              onChange={e => setShowNote(e.target.checked)}
              className="rounded text-paper-terracotta focus:ring-0"
            />
            <span>展示批注/思考</span>
          </label>
        </div>

        {/* 卡片预览生成容器 */}
        <div className="flex justify-center p-4 bg-paper-drawer/60 rounded-xl overflow-hidden">
          <div
            ref={cardRef}
            className={`w-[440px] p-8 rounded-xl border ${currentTheme.border} ${currentTheme.bg} shadow-md flex flex-col justify-between`}
          >
            <div>
              <div className="text-2xl font-serif leading-none mb-4 opacity-30 select-none">“</div>
              <blockquote className={`font-serif text-[17px] leading-relaxed tracking-wide ${currentTheme.text} mb-6`}>
                {annotation.selectedText}
              </blockquote>

              {showNote && (annotation.customNote || annotation.note) && (
                <div className={`p-3 rounded-lg bg-black/5 text-xs ${currentTheme.subText} mb-6 leading-normal`}>
                  {annotation.customNote || annotation.note}
                </div>
              )}
            </div>

            <div className={`pt-4 border-t ${currentTheme.border} flex items-center justify-between text-xs`}>
              <div>
                <p className={`font-serif font-bold ${currentTheme.text}`}>{bookTitle}</p>
                <p className={currentTheme.subText}>{author}</p>
              </div>
              <span className={`text-[10px] uppercase tracking-widest ${currentTheme.subText}`}>BookEcho</span>
            </div>
          </div>
        </div>

        {/* 底部导出操作 */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={handleCopyImage}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-paper-border bg-white text-xs font-medium text-paper-text hover:bg-black/5"
          >
            {isCopied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            <span>{isCopied ? '已复制到剪贴板' : '复制高清卡片'}</span>
          </button>
          <button
            onClick={handleDownloadImage}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-paper-terracotta text-white text-xs font-medium hover:opacity-95 shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span>保存 PNG 图片</span>
          </button>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: 编写 ExportModal 组件**

创建 `src/components/ExportModal.tsx`:
```tsx
import React, { useState } from 'react';
import { X, FileText, CheckCircle2 } from 'lucide-react';

interface ExportModalProps {
  bookTitle: string;
  onClose: () => void;
  onConfirmExport: (format: 'standard' | 'obsidian') => Promise<void>;
}

export const ExportModal: React.FC<ExportModalProps> = ({ bookTitle, onClose, onConfirmExport }) => {
  const [format, setFormat] = useState<'standard' | 'obsidian'>('obsidian');
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    await onConfirmExport(format);
    setIsExporting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-paper-card border border-paper-border rounded-2xl w-full max-w-md p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-paper-border">
          <h3 className="font-serif text-lg font-bold text-paper-text">导出 Markdown 笔记</h3>
          <button onClick={onClose} className="p-1 rounded text-paper-muted hover:text-paper-text">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <p className="text-xs text-paper-muted">正在导出《{bookTitle}》的全部高亮、批注与延伸思考：</p>

          <label
            onClick={() => setFormat('obsidian')}
            className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
              format === 'obsidian' ? 'border-paper-terracotta bg-paper-drawer' : 'border-paper-border bg-white hover:bg-black/5'
            }`}
          >
            <CheckCircle2 className={`w-4 h-4 mt-0.5 ${format === 'obsidian' ? 'text-paper-terracotta' : 'text-paper-muted'}`} />
            <div>
              <p className="text-xs font-semibold text-paper-text">Obsidian 知识库增强格式（推荐）</p>
              <p className="text-[11px] text-paper-muted mt-0.5">
                包含 YAML Frontmatter 标头、[!quote] Callout 色彩语义高亮块，无缝融入个人双链网状知识库。
              </p>
            </div>
          </label>

          <label
            onClick={() => setFormat('standard')}
            className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
              format === 'standard' ? 'border-paper-terracotta bg-paper-drawer' : 'border-paper-border bg-white hover:bg-black/5'
            }`}
          >
            <CheckCircle2 className={`w-4 h-4 mt-0.5 ${format === 'standard' ? 'text-paper-terracotta' : 'text-paper-muted'}`} />
            <div>
              <p className="text-xs font-semibold text-paper-text">标准通用精排 Markdown</p>
              <p className="text-[11px] text-paper-muted mt-0.5">
                通用语法，兼容 Notion、Typora、GitHub 与常见博客平台，无任何扩展语法依赖。
              </p>
            </div>
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-paper-muted hover:text-paper-text">
            取消
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-paper-terracotta text-white text-xs font-medium hover:opacity-95 shadow-sm disabled:opacity-50"
          >
            <FileText className="w-4 h-4" />
            <span>{isExporting ? '导出中...' : '选择位置并保存'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 3: 运行构建测试验证**

运行:
```bash
npm run build
```
预期: PASS

- [ ] **Step 4: 提交金句卡片与 Markdown 导出弹窗组件**

```bash
git add src/components/QuoteCardModal.tsx src/components/ExportModal.tsx
git commit -m "feat(ui): implement quote card studio and markdown export modals"
```

---

### Task 13: 权限异常引导组件与主应用全局状态装配 (App Orchestration)

**Files:**
- Create: `src/components/PermissionGuide.tsx`
- Modify: `src/App.tsx`
- Test: `tests/appRender.test.ts`

**Interfaces:**
- Consumes: 全套 API 与已构建组件
- Produces: 完整可运行的前端状态引擎，支持真机 Apple Books 数据同步、搜索过滤、暗黑模式切换与 macOS 权限引导。

- [ ] **Step 1: 编写 PermissionGuide 权限引导组件**

创建 `src/components/PermissionGuide.tsx`:
```tsx
import React from 'react';
import { ShieldAlert, FolderOpen, RefreshCw } from 'lucide-react';

interface PermissionGuideProps {
  onSelectDir: () => void;
  onRetry: () => void;
}

export const PermissionGuide: React.FC<PermissionGuideProps> = ({ onSelectDir, onRetry }) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-paper-bg text-center">
      <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 mb-4">
        <ShieldAlert className="w-8 h-8" />
      </div>
      <h2 className="font-serif text-2xl font-bold text-paper-text mb-2">需要 Apple Books 数据读取权限</h2>
      <p className="text-sm text-paper-muted max-w-md mb-6 leading-relaxed">
        macOS 对 Apple Books 容器（<code>~/Library/Containers/com.apple.iBooksX</code>）进行了系统沙盒隔离。你可以通过以下任意一种方式继续：
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={onSelectDir}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-paper-terracotta text-white text-sm font-medium shadow-sm hover:opacity-95"
        >
          <FolderOpen className="w-4 h-4" />
          <span>手动选择 iBooks 目录或备份</span>
        </button>

        <button
          onClick={onRetry}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-paper-border bg-white text-sm font-medium text-paper-text hover:bg-black/5"
        >
          <RefreshCw className="w-4 h-4" />
          <span>重新检测系统权限</span>
        </button>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: 完整装配 `src/App.tsx`**

修改 `src/App.tsx`:
```tsx
import React, { useState, useEffect } from 'react';
import { BookItem, AnnotationItem, ColorSemanticConfig, HighlightColor } from '../electron/types/ipc';
import { Sidebar } from './components/Sidebar';
import { BookshelfView } from './components/BookshelfView';
import { BookDetailView } from './components/BookDetailView';
import { DailyReviewView } from './components/DailyReviewView';
import { QuoteCardModal } from './components/QuoteCardModal';
import { ExportModal } from './components/ExportModal';
import { PermissionGuide } from './components/PermissionGuide';
import { Search } from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'books' | 'review' | 'search'>('books');
  const [books, setBooks] = useState<BookItem[]>([]);
  const [selectedBook, setSelectedBook] = useState<BookItem | null>(null);
  const [currentAnnotations, setCurrentAnnotations] = useState<AnnotationItem[]>([]);
  const [reviewQueue, setReviewQueue] = useState<AnnotationItem[]>([]);
  const [colorSemantics, setColorSemantics] = useState<ColorSemanticConfig[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [selectedColor, setSelectedColor] = useState<HighlightColor | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<AnnotationItem[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeQuoteItem, setActiveQuoteItem] = useState<AnnotationItem | null>(null);
  const [exportBookAssetId, setExportBookAssetId] = useState<string | null>(null);
  const [hasPermissionError, setHasPermissionError] = useState(false);

  // 初始化加载数据
  const loadInitialData = async () => {
    try {
      if (!window.bookEchoAPI) return;
      const [fetchedBooks, semantics, fetchedTags] = await Promise.all([
        window.bookEchoAPI.getBooks(),
        window.bookEchoAPI.getColorSemantics(),
        window.bookEchoAPI.getAllTags()
      ]);
      setBooks(fetchedBooks);
      setColorSemantics(semantics);
      setTags(fetchedTags);
      setHasPermissionError(false);
    } catch (e) {
      console.error('Failed to load initial Apple Books data', e);
      setHasPermissionError(true);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // 切换单书精读
  const handleSelectBook = async (book: BookItem) => {
    setSelectedBook(book);
    if (window.bookEchoAPI) {
      const annos = await window.bookEchoAPI.getBookAnnotations(book.assetId);
      setCurrentAnnotations(annos);
    }
  };

  // 加载每日回顾
  const loadReviewQueue = async () => {
    if (window.bookEchoAPI) {
      const q = await window.bookEchoAPI.getDailyReviewQueue(8);
      setReviewQueue(q);
    }
  };

  useEffect(() => {
    if (currentTab === 'review') {
      loadReviewQueue();
    }
  }, [currentTab]);

  // 全局搜索触发
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchKeyword.trim() && window.bookEchoAPI) {
        const results = await window.bookEchoAPI.searchAnnotations(searchKeyword.trim());
        setSearchResults(results);
      } else {
        setSearchResults([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchKeyword]);

  // 更新星标
  const handleToggleStar = async (uuid: string) => {
    const item = currentAnnotations.find(a => a.uuid === uuid);
    if (!item || !window.bookEchoAPI) return;
    const nextStarred = !item.isStarred;
    await window.bookEchoAPI.updateAnnotationMeta(uuid, { isStarred: nextStarred });
    setCurrentAnnotations(prev =>
      prev.map(a => (a.uuid === uuid ? { ...a, isStarred: nextStarred } : a))
    );
  };

  // 更新延伸思考
  const handleUpdateCustomNote = async (uuid: string, note: string) => {
    if (!window.bookEchoAPI) return;
    await window.bookEchoAPI.updateAnnotationMeta(uuid, { customNote: note });
    setCurrentAnnotations(prev =>
      prev.map(a => (a.uuid === uuid ? { ...a, customNote: note } : a))
    );
  };

  // 标签增删
  const handleAddTag = async (uuid: string, tag: string) => {
    if (!window.bookEchoAPI) return;
    await window.bookEchoAPI.addTag(uuid, tag);
    setCurrentAnnotations(prev =>
      prev.map(a => (a.uuid === uuid ? { ...a, tags: [...(a.tags || []), tag] } : a))
    );
    const updatedTags = await window.bookEchoAPI.getAllTags();
    setTags(updatedTags);
  };

  const handleRemoveTag = async (uuid: string, tag: string) => {
    if (!window.bookEchoAPI) return;
    await window.bookEchoAPI.removeTag(uuid, tag);
    setCurrentAnnotations(prev =>
      prev.map(a => (a.uuid === uuid ? { ...a, tags: (a.tags || []).filter(t => t !== tag) } : a))
    );
    const updatedTags = await window.bookEchoAPI.getAllTags();
    setTags(updatedTags);
  };

  // 过滤后的高亮列表（按色彩与标签）
  const filteredAnnotations = currentAnnotations.filter(a => {
    if (selectedColor && a.colorKey !== selectedColor) return false;
    if (selectedTag && !(a.tags || []).includes(selectedTag)) return false;
    return true;
  });

  return (
    <div className={`flex h-screen w-screen overflow-hidden ${isDarkMode ? 'dark bg-night-bg text-night-text' : 'bg-paper-bg text-paper-text'}`}>
      <Sidebar
        currentTab={currentTab}
        onSelectTab={tab => {
          setCurrentTab(tab);
          setSelectedBook(null);
        }}
        colorSemantics={colorSemantics}
        selectedColor={selectedColor}
        onSelectColor={setSelectedColor}
        tags={tags}
        selectedTag={selectedTag}
        onSelectTag={setSelectedTag}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        onSelectCustomDir={async () => {
          if (window.bookEchoAPI) {
            await window.bookEchoAPI.selectCustomDataDir();
            loadInitialData();
          }
        }}
      />

      <main className="flex-1 flex flex-col overflow-hidden relative">
        {hasPermissionError ? (
          <PermissionGuide
            onSelectDir={async () => {
              if (window.bookEchoAPI) {
                await window.bookEchoAPI.selectCustomDataDir();
                loadInitialData();
              }
            }}
            onRetry={loadInitialData}
          />
        ) : currentTab === 'search' ? (
          <div className="flex-1 flex flex-col p-8 overflow-y-auto">
            <div className="relative mb-6 max-w-xl">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-paper-muted" />
              <input
                type="text"
                value={searchKeyword}
                onChange={e => setSearchKeyword(e.target.value)}
                placeholder="搜索高亮句子、想法或批注..."
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-paper-border bg-paper-card focus:outline-none focus:ring-1 focus:ring-paper-terracotta"
                autoFocus
              />
            </div>

            <div className="space-y-4 max-w-3xl">
              {searchResults.map(res => (
                <div key={res.uuid} className="p-4 rounded-xl border border-paper-border bg-paper-card">
                  <p className="font-serif text-sm leading-relaxed mb-2">“{res.selectedText}”</p>
                  {res.note && <p className="text-xs text-paper-muted">划线批注: {res.note}</p>}
                </div>
              ))}
              {searchKeyword.trim() && searchResults.length === 0 && (
                <p className="text-xs text-paper-muted">未找到匹配的高亮或批注</p>
              )}
            </div>
          </div>
        ) : currentTab === 'review' ? (
          <DailyReviewView
            queue={reviewQueue}
            colorSemantics={colorSemantics}
            onSubmitResult={async (uuid, res) => {
              if (window.bookEchoAPI) {
                await window.bookEchoAPI.submitReviewResult(uuid, res);
              }
            }}
            onRefreshQueue={loadReviewQueue}
          />
        ) : selectedBook ? (
          <BookDetailView
            book={selectedBook}
            annotations={filteredAnnotations}
            colorSemantics={colorSemantics}
            onBack={() => setSelectedBook(null)}
            onOpenInAppleBooks={(id, p) => window.bookEchoAPI?.openInAppleBooks(id, p)}
            onExportMarkdown={id => setExportBookAssetId(id)}
            onToggleStar={handleToggleStar}
            onUpdateCustomNote={handleUpdateCustomNote}
            onAddTag={handleAddTag}
            onRemoveTag={handleRemoveTag}
            onOpenQuoteModal={anno => setActiveQuoteItem(anno)}
            onRequestContext={(anno) =>
              window.bookEchoAPI.getHighlightContext(selectedBook.assetId, anno.locationCfi || '', anno.selectedText)
            }
          />
        ) : (
          <BookshelfView books={books} onSelectBook={handleSelectBook} />
        )}
      </main>

      {/* 金句卡片弹窗 */}
      {activeQuoteItem && selectedBook && (
        <QuoteCardModal
          annotation={activeQuoteItem}
          bookTitle={selectedBook.title}
          author={selectedBook.author || '未知作者'}
          onClose={() => setActiveQuoteItem(null)}
        />
      )}

      {/* Markdown 导出弹窗 */}
      {exportBookAssetId && selectedBook && (
        <ExportModal
          bookTitle={selectedBook.title}
          onClose={() => setExportBookAssetId(null)}
          onConfirmExport={async (fmt) => {
            if (window.bookEchoAPI) {
              await window.bookEchoAPI.exportMarkdown(exportBookAssetId, fmt);
            }
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: 编写端到端编译与打包测试**

创建 `tests/appRender.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('App Build Artifact Integrity', () => {
  it('should verify all core components and pages exist', () => {
    const requiredFiles = [
      'src/App.tsx',
      'src/components/Sidebar.tsx',
      'src/components/BookshelfView.tsx',
      'src/components/BookDetailView.tsx',
      'src/components/HighlightCard.tsx',
      'src/components/DailyReviewView.tsx',
      'src/components/QuoteCardModal.tsx',
      'src/components/ExportModal.tsx',
      'src/components/PermissionGuide.tsx'
    ];

    for (const f of requiredFiles) {
      expect(fs.existsSync(path.resolve(__dirname, '..', f))).toBe(true);
    }
  });
});
```

- [ ] **Step 4: 运行全部单元测试与前端构建**

运行:
```bash
npm test
npm run build
```
预期: 全部测试 PASS，构建产物成功输出至 `dist/` 与 `dist-electron/`。

- [ ] **Step 5: 提交主应用集成代码**

```bash
git add src/components/PermissionGuide.tsx src/App.tsx tests/appRender.test.ts
git commit -m "feat(app): assemble main application view routing and state management"
```

---

### Task 14: 最终端到端自动化测试验证与验收检查

**Files:**
- Test: `tests/e2eIntegration.test.ts`

**Interfaces:**
- Consumes: `SnapshotSyncer`, `UserVaultDb`, `EpubContextEngine`, `MarkdownExporter`
- Produces: 完整闭环的集成测试用例，覆盖从“模拟 Apple Books 数据库与 EPUB 文件”到“只读提取”、“CFI 展开前后文”、“打星与标签”、“每日回顾评分”及“Obsidian Markdown 导出”全链路。

- [ ] **Step 1: 编写全链路端到端集成测试**

创建 `tests/e2eIntegration.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createMockAppleBooksDatabases } from './fixtures/mockDbGenerator';
import { createMockEpubDirectory } from './fixtures/mockEpubGenerator';
import { SnapshotSyncer } from '../electron/services/snapshotSyncer';
import { UserVaultDb } from '../electron/services/userVaultDb';
import { EpubContextEngine } from '../electron/services/epubContextEngine';
import { MarkdownExporter } from '../electron/services/markdownExporter';

describe('Full End-to-End System Pipeline', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bookecho-e2e-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should run through extraction, context expansion, tagging, review, and markdown export seamlessly', () => {
    // 1. 初始化模拟 Apple Books 数据库与 EPUB 文件
    const mockDb = createMockAppleBooksDatabases(tempDir);
    const mockEpub = createMockEpubDirectory(tempDir);

    const cacheDir = path.join(tempDir, 'cache');
    const vaultPath = path.join(tempDir, 'user_vault.sqlite');

    const syncer = new SnapshotSyncer({
      customBkDir: mockDb.bkDir,
      customAeDir: mockDb.aeDir,
      cacheDir
    });
    const vault = new UserVaultDb(vaultPath);
    const epubEngine = new EpubContextEngine();

    // 2. 提取书籍
    const books = syncer.extractBooks();
    expect(books.length).toBe(1);
    const book = books[0];
    expect(book.title).toBe('思考，快与慢');

    // 3. 提取高亮并关联 EPUB
    const annos = syncer.extractAnnotations(book.assetId);
    expect(annos.length).toBe(2);

    // 4. 解析第一条高亮的 EPUB 章节与前后文
    const firstAnno = annos[0];
    const resolved = epubEngine.resolveChapter(mockEpub, firstAnno.locationCfi);
    expect(resolved.chapterTitle).toBe('第一章：直觉与理性');

    const context = epubEngine.extractParagraphContext(
      mockEpub,
      firstAnno.locationCfi,
      firstAnno.selectedText
    );
    expect(context.available).toBe(true);
    expect(context.currentParagraph).toContain('系统1的运行是无意识且快速的');
    expect(context.beforeParagraphs.length).toBeGreaterThan(0);
    expect(context.afterParagraphs.length).toBeGreaterThan(0);

    // 5. 用户二次操作：补充思考、标星、打标签
    vault.updateAnnotationMeta(firstAnno.uuid, {
      customNote: '直觉系统虽然快，但在金融决策中容易引发过度自信偏差',
      isStarred: true,
      resolvedChapter: resolved.chapterTitle
    });
    vault.addTag(firstAnno.uuid, '行为经济学');
    vault.addTag(firstAnno.uuid, '思维陷阱');

    const meta = vault.getAnnotationMeta(firstAnno.uuid);
    expect(meta?.isStarred).toBe(true);
    expect(meta?.customNote).toContain('金融决策');

    const tags = vault.getTagsForAnnotation(firstAnno.uuid);
    expect(tags).toEqual(['行为经济学', '思维陷阱']);

    // 6. 每日回顾评分验证
    const reviewQueue = vault.getReviewCandidates([firstAnno.uuid, annos[1].uuid]);
    expect(reviewQueue[0].uuid).toBe(firstAnno.uuid); // 标星者优先

    // 7. 无损导出 Obsidian Markdown 验证
    const exportItem = {
      ...firstAnno,
      chapterTitle: resolved.chapterTitle,
      customNote: meta?.customNote,
      isStarred: meta?.isStarred,
      tags
    };

    const md = MarkdownExporter.formatObsidianMarkdown(book, [exportItem]);
    expect(md).toContain('> [!quote] 🟡 核心论点');
    expect(md).toContain('系统1的运行是无意识且快速的');
    expect(md).toContain('**扩展**：直觉系统虽然快');
    expect(md).toContain('#行为经济学 #思维陷阱');

    vault.close();
  });
});
```

- [ ] **Step 2: 执行全量测试套件**

运行:
```bash
npm test
```
预期: 全部测试用例（包括 `fixtures`, `snapshotSyncer`, `userVaultDb`, `epubContextEngine`, `markdownExporter`, `ipcContract`, `appRender`, `e2eIntegration`）均为 PASS。

- [ ] **Step 3: 提交全链路集成测试**

```bash
git add tests/e2eIntegration.test.ts
git commit -m "test(e2e): add end-to-end integration test validating full extraction and export pipeline"
```
