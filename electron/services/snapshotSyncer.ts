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
  private snapshotSignatures: Map<string, string> = new Map();

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

  private getSourceSignature(sourceDbPath: string): string {
    try {
      const stat = fs.statSync(sourceDbPath);
      let sig = `${stat.mtimeMs}:${stat.size}`;
      const wal = `${sourceDbPath}-wal`;
      if (fs.existsSync(wal)) {
        const wStat = fs.statSync(wal);
        sig += `|wal:${wStat.mtimeMs}:${wStat.size}`;
      } else {
        sig += '|wal:none';
      }
      const shm = `${sourceDbPath}-shm`;
      if (fs.existsSync(shm)) {
        const sStat = fs.statSync(shm);
        sig += `|shm:${sStat.mtimeMs}:${sStat.size}`;
      } else {
        sig += '|shm:none';
      }
      return sig;
    } catch {
      return '';
    }
  }

  private createSnapshot(sourceDbPath: string, targetName: string): string {
    const targetDbPath = path.join(this.cacheDir, targetName);
    const sourceSig = this.getSourceSignature(sourceDbPath);
    const cachedSig = this.snapshotSignatures.get(targetName);

    // 若源库与其 WAL/SHM 无任何变化且目标快照存在，直接复用快照，避免重复巨量 IO
    if (sourceSig && cachedSig === sourceSig && fs.existsSync(targetDbPath)) {
      return targetDbPath;
    }

    fs.copyFileSync(sourceDbPath, targetDbPath);

    // 同步复制 WAL 和 SHM（如果存在），保证只读查询数据完整且不锁死主库
    // 若源文件不存在但目标缓存存在（说明已被 checkpoint 清理），必须清理旧文件以避免 SQLITE_CORRUPT
    const walSource = `${sourceDbPath}-wal`;
    const walTarget = `${targetDbPath}-wal`;
    if (fs.existsSync(walSource)) {
      fs.copyFileSync(walSource, walTarget);
    } else if (fs.existsSync(walTarget)) {
      fs.unlinkSync(walTarget);
    }

    const shmSource = `${sourceDbPath}-shm`;
    const shmTarget = `${targetDbPath}-shm`;
    if (fs.existsSync(shmSource)) {
      fs.copyFileSync(shmSource, shmTarget);
    } else if (fs.existsSync(shmTarget)) {
      fs.unlinkSync(shmTarget);
    }

    if (sourceSig) {
      this.snapshotSignatures.set(targetName, sourceSig);
    }

    return targetDbPath;
  }

  public extractBooks(): BookItem[] {
    const sourceBk = this.findDatabaseFile(this.bkDir, 'BKLibrary');
    if (!sourceBk) return [];

    const sourceAe = this.findDatabaseFile(this.aeDir, 'AEAnnotation');
    let highlightCounts: Record<string, number> = {};
    if (sourceAe) {
      const snapshotAe = this.createSnapshot(sourceAe, 'snapshot_AEAnnotation_count.sqlite');
      const aeDb = new Database(snapshotAe, { readonly: true });
      try {
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
      } finally {
        aeDb.close();
      }
    }

    const snapshotBk = this.createSnapshot(sourceBk, 'snapshot_BKLibrary.sqlite');
    const db = new Database(snapshotBk, { readonly: true });
    let rows: any[] = [];
    try {
      rows = db.prepare(`
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
    } finally {
      db.close();
    }

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

  public syncAndGetBooks(): BookItem[] {
    return this.extractBooks();
  }

  public extractAnnotations(assetId?: string): AnnotationItem[] {
    const sourceAe = this.findDatabaseFile(this.aeDir, 'AEAnnotation');
    if (!sourceAe) return [];

    const snapshotAe = this.createSnapshot(sourceAe, 'snapshot_AEAnnotation.sqlite');
    const db = new Database(snapshotAe, { readonly: true });
    let rows: any[] = [];

    try {
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

      rows = db.prepare(sql).all(...params) as any[];
    } finally {
      db.close();
    }

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

  public getRawAnnotations(assetId?: string): AnnotationItem[] {
    return this.extractAnnotations(assetId);
  }
}
