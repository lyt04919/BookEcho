import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import Database from 'better-sqlite3';
import {
  ReadingStatsSyncer,
  parseBooksMessagesGoals,
  decodeCrdtReadingHistory
} from '../electron/services/readingStatsSyncer';

function encodeVarint(val: number): Buffer {
  const bytes: number[] = [];
  let v = val >>> 0;
  while (v >= 0x80) {
    bytes.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  bytes.push(v);
  return Buffer.from(bytes);
}

function pbField(field: number, wire: number, payload: Buffer | number): Buffer {
  const tag = encodeVarint((field << 3) | wire);
  if (wire === 0) {
    return Buffer.concat([tag, encodeVarint(payload as number)]);
  }
  const buf = payload as Buffer;
  return Buffer.concat([tag, encodeVarint(buf.length), buf]);
}

function buildTestCrdtBuffer(yearMonth: number, day: number, timeSec: number, goalSec: number): Buffer {
  const monthUuid = Buffer.from('00000000000000000000000000000001', 'hex');
  const dayUuid = Buffer.from('00000000000000000000000000000002', 'hex');
  const actorUuid = Buffer.from('00000000000000000000000000000003', 'hex');

  const makeDictEntry = (kNum: number, targetUuid: Buffer) => {
    const keyMsg = pbField(1, 0, kNum);
    const refMsg = pbField(6, 2, pbField(1, 2, targetUuid));
    const valMsg = pbField(1, 2, pbField(3, 2, refMsg));
    return pbField(3, 2, Buffer.concat([pbField(1, 2, keyMsg), pbField(2, 2, valMsg)]));
  };

  // Root object (f:1) -> months dict
  const rootKv = pbField(
    1,
    2,
    Buffer.concat([
      pbField(1, 2, Buffer.from('months', 'utf8')),
      pbField(2, 2, pbField(3, 2, makeDictEntry(yearMonth, monthUuid)))
    ])
  );
  const rootField = pbField(1, 2, pbField(4, 2, rootKv));

  // Month object (f:2) -> days dict
  const monthKv = pbField(
    1,
    2,
    Buffer.concat([
      pbField(1, 2, Buffer.from('days', 'utf8')),
      pbField(2, 2, pbField(3, 2, makeDictEntry(day, dayUuid)))
    ])
  );
  const monthField = pbField(2, 2, Buffer.concat([pbField(1, 2, monthUuid), pbField(3, 2, pbField(4, 2, monthKv))]));

  // Day object (f:2) -> readingTime + readingGoal
  const counterVal = Buffer.concat([Buffer.from([0x00]), encodeVarint(timeSec)]);
  const counterEntry = pbField(1, 2, Buffer.concat([pbField(1, 2, actorUuid), pbField(2, 2, counterVal)]));
  const rtVal = pbField(7, 2, pbField(2, 2, counterEntry));
  const rtKv = pbField(1, 2, Buffer.concat([pbField(1, 2, Buffer.from('readingTime', 'utf8')), pbField(2, 2, rtVal)]));

  const rgVal = pbField(1, 2, pbField(3, 2, pbField(1, 0, goalSec)));
  const rgKv = pbField(1, 2, Buffer.concat([pbField(1, 2, Buffer.from('readingGoal', 'utf8')), pbField(2, 2, rgVal)]));

  const dayBody = Buffer.concat([pbField(4, 2, rtKv), pbField(4, 2, rgKv)]);
  const dayField = pbField(2, 2, Buffer.concat([pbField(1, 2, dayUuid), pbField(3, 2, dayBody)]));

  const header = Buffer.from('6372647404000000', 'hex');
  return Buffer.concat([header, rootField, monthField, dayField]);
}

describe('ReadingStatsSyncer', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it('should parse BooksMessages readingGoals JSON accurately', () => {
    const sampleJson = JSON.stringify({
      timeReadToday: 159,
      currentStreakLength: 2,
      allTimeRecordStreak: 5,
      readingGoal: 1200,
      date: '2026-11-11T07:34:05Z',
      currentYearBooksFinished: 3,
      yearlyBooksFinishedGoal: 12,
      readingHistory: [
        { date: '20261110', timeRead: 934, readingGoal: 1200, isStreakDay: false },
        { date: '20261111', timeRead: 159, readingGoal: 1200, isStreakDay: false }
      ]
    });

    const parsed = parseBooksMessagesGoals(sampleJson, new Date(2026, 10, 11, 20, 0, 0));
    expect(parsed).not.toBeNull();
    expect(parsed!.todayReadingSec).toBe(159);
    expect(parsed!.dailyGoalSec).toBe(1200);
    expect(parsed!.currentStreakDays).toBe(2);
    expect(parsed!.allTimeRecordStreakDays).toBe(5);
    expect(parsed!.currentYearBooksFinished).toBe(3);
    expect(parsed!.yearlyBooksFinishedGoal).toBe(12);
    expect(parsed!.recentHistory).toHaveLength(2);
    expect(parsed!.recentHistory[0].date).toBe('2026-11-10');
  });

  it('should return 0 todayReadingSec when BooksMessages snapshot date is stale', () => {
    const sampleJson = JSON.stringify({
      timeReadToday: 900,
      readingGoal: 1200,
      date: '2026-11-10T10:00:00Z',
      readingHistory: [{ date: '20261110', timeRead: 900, readingGoal: 1200, isStreakDay: false }]
    });
    const parsed = parseBooksMessagesGoals(sampleJson, new Date(2026, 10, 11, 20, 0, 0));
    expect(parsed).not.toBeNull();
    expect(parsed!.todayReadingSec).toBe(0);
  });

  it('should decode Apple CRDT ReadingHistoryModel binary protobuf accurately', () => {
    const crdtBuf = buildTestCrdtBuffer(202611, 5, 2627, 1200);
    const decoded = decodeCrdtReadingHistory(crdtBuf);
    expect(decoded).toEqual([
      {
        date: '2026-11-05',
        readingTimeSec: 2627,
        readingGoalSec: 1200,
        goalMet: true
      }
    ]);
  });

  it('should merge CRDT history and BooksMessages readingGoals from SQLite snapshots', () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bookecho-rstats-'));
    tempDirs.push(tmpRoot);

    const groupDir = path.join(tmpRoot, 'group');
    const cacheDir = path.join(tmpRoot, 'cache');
    const msgDir = path.join(groupDir, 'EngagementCollector');
    const crdtDir = path.join(groupDir, 'Documents/BCCloudData-BookDataStoreService/CRDTModelSync-ReadingHistoryModel');
    fs.mkdirSync(msgDir, { recursive: true });
    fs.mkdirSync(crdtDir, { recursive: true });

    // Create CRDT SQLite
    const crdtDb = new Database(path.join(crdtDir, 'CRDTModelSync-ReadingHistoryModel'));
    crdtDb.exec('CREATE TABLE ZCRDTMODELSYNCENTITY (ZPROTODATA BLOB)');
    crdtDb
      .prepare('INSERT INTO ZCRDTMODELSYNCENTITY (ZPROTODATA) VALUES (?)')
      .run(buildTestCrdtBuffer(202610, 15, 1800, 1200));
    crdtDb.close();

    // Create BooksMessages SQLite
    const msgDb = new Database(path.join(msgDir, 'BooksMessages.sqlite'));
    msgDb.exec('CREATE TABLE ZCDPROPERTY (ZKEY TEXT, ZDATA BLOB)');
    msgDb.prepare('INSERT INTO ZCDPROPERTY (ZKEY, ZDATA) VALUES (?, ?)').run(
      'readingGoals',
      Buffer.from(
        JSON.stringify({
          timeReadToday: 600,
          currentStreakLength: 1,
          allTimeRecordStreak: 4,
          readingGoal: 1200,
          date: '2026-11-11T08:00:00Z',
          currentYearBooksFinished: 2,
          yearlyBooksFinishedGoal: 10,
          readingHistory: [{ date: '20261111', timeRead: 600, readingGoal: 1200, isStreakDay: false }]
        }),
        'utf8'
      )
    );
    msgDb.close();

    const syncer = new ReadingStatsSyncer({ cacheDir, groupContainerDir: groupDir });
    const stats = syncer.extractReadingStats(new Date(2026, 10, 11, 20, 0, 0));

    expect(stats.available).toBe(true);
    expect(stats.todayReadingSec).toBe(600);
    expect(stats.dailyGoalSec).toBe(1200);
    expect(stats.totalReadingSec).toBe(2400);
    expect(stats.dailyHistory.map(d => d.date)).toEqual(['2026-10-15', '2026-11-11']);
  });

  it('should return unavailable safely when group container does not exist', () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bookecho-rstats-empty-'));
    tempDirs.push(tmpRoot);
    const syncer = new ReadingStatsSyncer({
      cacheDir: path.join(tmpRoot, 'cache'),
      groupContainerDir: path.join(tmpRoot, 'missing')
    });
    const stats = syncer.extractReadingStats();
    expect(stats.available).toBe(false);
    expect(stats.dailyHistory).toEqual([]);
  });
});
