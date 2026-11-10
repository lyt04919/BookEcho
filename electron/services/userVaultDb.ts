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
    `).all() as ColorSemanticConfig[];
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
    `).get(uuid) as {
      annotationUuid: string;
      customNote: string | null;
      isStarred: number;
      reviewStatus: 'active' | 'mastered' | 'archived' | null;
      reviewCount: number | null;
      lastReviewedAtMs: number | null;
      resolvedChapter: string | null;
      sortIndex: number | null;
    } | undefined;

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
      SELECT tag_name as tag FROM annotation_tags WHERE annotation_uuid = ? ORDER BY created_at ASC, rowid ASC
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

    const CHUNK_SIZE = 500;
    const metaMap = new Map<string, {
      annotation_uuid: string;
      is_starred: number;
      review_count: number;
      last_reviewed_at: number | null;
      review_status: string;
    }>();

    for (let i = 0; i < allUuids.length; i += CHUNK_SIZE) {
      const chunk = allUuids.slice(i, i + CHUNK_SIZE);
      const placeholders = chunk.map(() => '?').join(',');
      const rows = this.db.prepare(`
        SELECT annotation_uuid, is_starred, review_count, last_reviewed_at, review_status
        FROM annotation_meta
        WHERE annotation_uuid IN (${placeholders})
      `).all(...chunk) as {
        annotation_uuid: string;
        is_starred: number;
        review_count: number;
        last_reviewed_at: number | null;
        review_status: string;
      }[];
      rows.forEach(r => metaMap.set(r.annotation_uuid, r));
    }

    const now = Date.now();
    const scored = allUuids.map(uuid => {
      const meta = metaMap.get(uuid);
      if (meta && (meta.review_status === 'mastered' || meta.review_status === 'archived')) {
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
    const row = this.db.prepare('SELECT setting_value FROM app_settings WHERE setting_key = ?').get(key) as { setting_value: string } | undefined;
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
