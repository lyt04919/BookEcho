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
