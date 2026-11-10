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
    expect(coreDataToUnixMs(null)).toBeNull();
    expect(coreDataToUnixMs(undefined)).toBeNull();
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

    // Without assetId should extract all annotations
    const allAnnos = syncer.extractAnnotations();
    expect(allAnnos.length).toBe(2);
  });

  it('should return empty arrays gracefully when source directories do not exist', () => {
    const syncer = new SnapshotSyncer({
      customBkDir: path.join(tempDir, 'non-existent-bk'),
      customAeDir: path.join(tempDir, 'non-existent-ae'),
      cacheDir: cacheDir
    });

    expect(syncer.extractBooks()).toEqual([]);
    expect(syncer.extractAnnotations()).toEqual([]);
  });

  it('should copy WAL and SHM files when they exist alongside the database', () => {
    const walFile = `${mockPaths.bkDbPath}-wal`;
    const shmFile = `${mockPaths.bkDbPath}-shm`;
    fs.writeFileSync(walFile, 'wal-content');
    fs.writeFileSync(shmFile, 'shm-content');

    const syncer = new SnapshotSyncer({
      customBkDir: mockPaths.bkDir,
      customAeDir: mockPaths.aeDir,
      cacheDir: cacheDir
    });

    syncer.extractBooks();

    expect(fs.existsSync(path.join(cacheDir, 'snapshot_BKLibrary.sqlite'))).toBe(true);
    expect(fs.existsSync(path.join(cacheDir, 'snapshot_BKLibrary.sqlite-wal'))).toBe(true);
    expect(fs.existsSync(path.join(cacheDir, 'snapshot_BKLibrary.sqlite-shm'))).toBe(true);
    expect(fs.readFileSync(path.join(cacheDir, 'snapshot_BKLibrary.sqlite-wal'), 'utf-8')).toBe('wal-content');
  });
});
