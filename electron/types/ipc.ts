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
  bookTitle?: string;
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

export type ReviewStats = DailyReviewStats;

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
