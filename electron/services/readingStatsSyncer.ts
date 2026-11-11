import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { AppleBooksReadingStats, DailyReadingStat } from '../types/ipc';

interface ProtoItem {
  f: number;
  w: number;
  v?: number;
  buf?: Buffer;
}

function readVarint(b: Buffer, pos: number): { val: bigint; next: number } | null {
  let res = 0n;
  let shift = 0n;
  while (pos < b.length) {
    const byte = b[pos++];
    res |= BigInt(byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) return { val: res, next: pos };
    shift += 7n;
    if (shift > 63n) return null;
  }
  return null;
}

function parseProtoFields(b: Buffer): ProtoItem[] | null {
  let pos = 0;
  const items: ProtoItem[] = [];
  while (pos < b.length) {
    const tag = readVarint(b, pos);
    if (!tag) return null;
    pos = tag.next;
    const field = Number(tag.val >> 3n);
    const wire = Number(tag.val & 7n);
    if (field === 0 || field > 1000) return null;

    if (wire === 0) {
      const v = readVarint(b, pos);
      if (!v) return null;
      pos = v.next;
      items.push({
        f: field,
        w: 0,
        v: v.val <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(v.val) : Number.MAX_SAFE_INTEGER
      });
    } else if (wire === 1) {
      if (pos + 8 > b.length) return null;
      pos += 8;
      items.push({ f: field, w: 1 });
    } else if (wire === 2) {
      const len = readVarint(b, pos);
      if (!len) return null;
      const n = Number(len.val);
      pos = len.next;
      if (n < 0 || pos + n > b.length) return null;
      items.push({ f: field, w: 2, buf: b.subarray(pos, pos + n) });
      pos += n;
    } else if (wire === 5) {
      if (pos + 4 > b.length) return null;
      pos += 4;
      items.push({ f: field, w: 5 });
    } else {
      return null;
    }
  }
  return items;
}

function extractEntityProps(bodyBuf: Buffer): Record<string, Buffer> {
  const props: Record<string, Buffer> = {};
  for (const bf of parseProtoFields(bodyBuf) || []) {
    if (bf.f === 4 && bf.w === 2 && bf.buf) {
      for (const kv of parseProtoFields(bf.buf) || []) {
        if (!kv.buf) continue;
        const kvParts = parseProtoFields(kv.buf) || [];
        const key = kvParts.find(x => x.f === 1 && x.buf)?.buf?.toString('utf8');
        const val = kvParts.find(x => x.f === 2 && x.buf)?.buf;
        if (key && val) props[key] = val;
      }
    }
  }
  return props;
}

function parseCrdtIntObjectDict(dictBuf: Buffer): { kNum: number; targetUuid: string }[] {
  const parts = parseProtoFields(dictBuf);
  const f3 = parts?.find(x => x.f === 3 && x.buf)?.buf;
  if (!f3) return [];

  const entries: { kNum: number; targetUuid: string }[] = [];
  for (const p of parseProtoFields(f3) || []) {
    if (p.f !== 3 || !p.buf) continue;
    const ep = parseProtoFields(p.buf) || [];
    const keyBuf = ep.find(x => x.f === 1 && x.buf)?.buf;
    const valBuf = ep.find(x => x.f === 2 && x.buf)?.buf;
    if (!keyBuf || !valBuf) continue;

    const kNum = parseProtoFields(keyBuf)?.find(x => x.f === 1 && x.w === 0)?.v;
    const v1 = parseProtoFields(valBuf)?.find(x => x.f === 1 && x.buf)?.buf;
    const v3 = v1 ? parseProtoFields(v1)?.find(x => x.f === 3 && x.buf)?.buf : undefined;
    const refHex = v3 ? parseProtoFields(v3)?.find(x => x.f === 6 && x.buf)?.buf : undefined;
    const targetUuid = refHex
      ? parseProtoFields(refHex)?.find(x => x.f === 1 && x.buf)?.buf?.toString('hex')
      : undefined;

    if (typeof kNum === 'number' && targetUuid) {
      entries.push({ kNum, targetUuid });
    }
  }
  return entries;
}

/**
 * 解码 Apple Books `CRDTModelSync-ReadingHistoryModel` 中的 ZPROTODATA 二进制（crdt\x04\x00\x00\x00 + Protobuf）
 */
export function decodeCrdtReadingHistory(raw: Buffer): DailyReadingStat[] {
  if (!raw || raw.length < 12) return [];
  // 检查 'crdt' 魔数头，跳过 8 字节头部
  const magic = raw.subarray(0, 4).toString('ascii');
  const payload = magic === 'crdt' ? raw.subarray(8) : raw;
  const top = parseProtoFields(payload);
  if (!top || top.length === 0) return [];

  const objects = new Map<string, Buffer>();
  let rootBuf: Buffer | null = null;

  for (const item of top) {
    if (item.f === 1 && item.w === 2 && item.buf && !rootBuf) {
      rootBuf = item.buf;
    } else if (item.f === 2 && item.w === 2 && item.buf) {
      const fields = parseProtoFields(item.buf) || [];
      const uuid = fields.find(x => x.f === 1 && x.buf)?.buf?.toString('hex');
      const body = fields.find(x => x.f === 3 && x.buf)?.buf;
      if (uuid && body) objects.set(uuid, body);
    }
  }

  if (!rootBuf) return [];
  const rootProps = extractEntityProps(rootBuf);
  if (!rootProps.months) return [];

  const months = parseCrdtIntObjectDict(rootProps.months);
  const results: DailyReadingStat[] = [];

  for (const m of months) {
    const year = Math.floor(m.kNum / 100);
    const monthNum = m.kNum % 100;
    if (year < 2000 || monthNum < 1 || monthNum > 12) continue;

    const mBody = objects.get(m.targetUuid);
    if (!mBody) continue;
    const mProps = extractEntityProps(mBody);
    if (!mProps.days) continue;

    const yyyy = String(year);
    const mm = String(monthNum).padStart(2, '0');
    const days = parseCrdtIntObjectDict(mProps.days);

    for (const d of days) {
      if (d.kNum < 1 || d.kNum > 31) continue;
      const dBody = objects.get(d.targetUuid);
      if (!dBody) continue;
      const dProps = extractEntityProps(dBody);

      let readingTimeSec = 0;
      if (dProps.readingTime) {
        const f7 = parseProtoFields(dProps.readingTime)?.find(x => x.f === 7 && x.buf)?.buf;
        const entries = f7 ? parseProtoFields(f7)?.find(x => x.f === 2 && x.buf)?.buf : undefined;
        for (const e of entries ? parseProtoFields(entries) || [] : []) {
          if (e.f === 1 && e.buf) {
            const valBuf = parseProtoFields(e.buf)?.find(x => x.f === 2 && x.buf)?.buf;
            if (valBuf && valBuf.length >= 2 && valBuf[0] === 0) {
              const v = readVarint(valBuf, 1);
              if (v) readingTimeSec += Number(v.val);
            }
          }
        }
      }

      let readingGoalSec = 0;
      if (dProps.readingGoal) {
        const f1 = parseProtoFields(dProps.readingGoal)?.find(x => x.f === 1 && x.buf)?.buf;
        const f3 = f1 ? parseProtoFields(f1)?.find(x => x.f === 3 && x.buf)?.buf : undefined;
        const v = f3 ? parseProtoFields(f3)?.find(x => x.f === 1 && x.w === 0)?.v : undefined;
        if (typeof v === 'number') readingGoalSec = v;
      }

      if (readingTimeSec > 0 || readingGoalSec > 0) {
        const dd = String(d.kNum).padStart(2, '0');
        results.push({
          date: `${yyyy}-${mm}-${dd}`,
          readingTimeSec,
          readingGoalSec,
          goalMet: readingGoalSec > 0 && readingTimeSec >= readingGoalSec
        });
      }
    }
  }

  return results.sort((a, b) => a.date.localeCompare(b.date));
}

function formatYYYYMMDD(raw: string): string | null {
  if (/^\d{8}$/.test(raw)) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return null;
}

function getLocalTodayKey(now: Date = new Date()): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export interface ParsedBooksMessagesGoals {
  todayReadingSec: number;
  dailyGoalSec: number;
  currentStreakDays: number;
  allTimeRecordStreakDays: number;
  currentYearBooksFinished: number;
  yearlyBooksFinishedGoal: number;
  snapshotDateKey: string | null;
  recentHistory: DailyReadingStat[];
}

/**
 * 解析 Apple Books `BooksMessages.sqlite` 中的 `readingGoals` JSON 负载
 */
export function parseBooksMessagesGoals(jsonText: string, now: Date = new Date()): ParsedBooksMessagesGoals | null {
  if (!jsonText) return null;
  try {
    const data = JSON.parse(jsonText);
    if (!data || typeof data !== 'object') return null;

    const dailyGoalSec = typeof data.readingGoal === 'number' ? data.readingGoal : 0;
    const rawTodaySec = typeof data.timeReadToday === 'number' ? data.timeReadToday : 0;
    const currentStreakDays = typeof data.currentStreakLength === 'number' ? data.currentStreakLength : 0;
    const allTimeRecordStreakDays = typeof data.allTimeRecordStreak === 'number' ? data.allTimeRecordStreak : 0;
    const currentYearBooksFinished =
      typeof data.currentYearBooksFinished === 'number' ? data.currentYearBooksFinished : 0;
    const yearlyBooksFinishedGoal =
      typeof data.yearlyBooksFinishedGoal === 'number' ? data.yearlyBooksFinishedGoal : 0;

    let snapshotDateKey: string | null = null;
    if (typeof data.date === 'string') {
      const parsed = new Date(data.date);
      if (!isNaN(parsed.getTime())) {
        snapshotDateKey = getLocalTodayKey(parsed);
      }
    }

    const recentHistory: DailyReadingStat[] = [];
    if (Array.isArray(data.readingHistory)) {
      for (const item of data.readingHistory) {
        if (!item || typeof item.date !== 'string') continue;
        const dateKey = formatYYYYMMDD(item.date);
        if (!dateKey) continue;
        const sec = typeof item.timeRead === 'number' ? item.timeRead : 0;
        const goal = typeof item.readingGoal === 'number' ? item.readingGoal : dailyGoalSec;
        const goalMet = Boolean(item.isStreakDay) || (goal > 0 && sec >= goal);
        recentHistory.push({
          date: dateKey,
          readingTimeSec: sec,
          readingGoalSec: goal,
          goalMet
        });
      }
    }

    const todayKey = getLocalTodayKey(now);
    const todayFromHist = recentHistory.find(h => h.date === todayKey);
    const todayReadingSec = todayFromHist
      ? todayFromHist.readingTimeSec
      : snapshotDateKey === todayKey
      ? rawTodaySec
      : 0;

    return {
      todayReadingSec,
      dailyGoalSec,
      currentStreakDays,
      allTimeRecordStreakDays,
      currentYearBooksFinished,
      yearlyBooksFinishedGoal,
      snapshotDateKey,
      recentHistory
    };
  } catch {
    return null;
  }
}

export interface ReadingStatsSyncerOptions {
  cacheDir: string;
  groupContainerDir?: string;
}

export class ReadingStatsSyncer {
  private cacheDir: string;
  private groupContainerDir: string;
  private snapshotSignatures: Map<string, string> = new Map();

  constructor(options: ReadingStatsSyncerOptions) {
    this.cacheDir = options.cacheDir;
    fs.mkdirSync(this.cacheDir, { recursive: true });
    this.groupContainerDir =
      options.groupContainerDir ||
      path.join(os.homedir(), 'Library/Group Containers/group.com.apple.iBooks');
  }

  private getSourceSignature(sourceDbPath: string): string {
    try {
      const stat = fs.statSync(sourceDbPath);
      let sig = `${stat.mtimeMs}:${stat.size}`;
      for (const suffix of ['-wal', '-shm']) {
        const aux = `${sourceDbPath}${suffix}`;
        if (fs.existsSync(aux)) {
          const auxStat = fs.statSync(aux);
          sig += `|${suffix}:${auxStat.mtimeMs}:${auxStat.size}`;
        }
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

    if (sourceSig && cachedSig === sourceSig && fs.existsSync(targetDbPath)) {
      return targetDbPath;
    }

    fs.copyFileSync(sourceDbPath, targetDbPath);
    for (const suffix of ['-wal', '-shm']) {
      const srcAux = `${sourceDbPath}${suffix}`;
      const dstAux = `${targetDbPath}${suffix}`;
      if (fs.existsSync(srcAux)) {
        fs.copyFileSync(srcAux, dstAux);
      } else if (fs.existsSync(dstAux)) {
        fs.unlinkSync(dstAux);
      }
    }

    if (sourceSig) {
      this.snapshotSignatures.set(targetName, sourceSig);
    }
    return targetDbPath;
  }

  private findCrdtReadingHistoryDb(): string | null {
    const dir = path.join(
      this.groupContainerDir,
      'Documents/BCCloudData-BookDataStoreService/CRDTModelSync-ReadingHistoryModel'
    );
    if (!fs.existsSync(dir)) return null;
    const files = fs
      .readdirSync(dir)
      .filter(f => !f.endsWith('-wal') && !f.endsWith('-shm') && !f.startsWith('.'));
    if (files.length === 0) return null;
    // 优先选择 CRDTModelSync-ReadingHistoryModel 主库文件
    const exact = files.find(f => f === 'CRDTModelSync-ReadingHistoryModel') || files[0];
    return path.join(dir, exact);
  }

  public extractReadingStats(now: Date = new Date()): AppleBooksReadingStats {
    const empty: AppleBooksReadingStats = {
      available: false,
      todayReadingSec: 0,
      dailyGoalSec: 0,
      currentStreakDays: 0,
      allTimeRecordStreakDays: 0,
      currentYearBooksFinished: 0,
      yearlyBooksFinishedGoal: 0,
      totalReadingSec: 0,
      dailyHistory: []
    };

    const historyByDate = new Map<string, DailyReadingStat>();

    // 1. 解析全量历史 CRDT 数据库
    try {
      const crdtPath = this.findCrdtReadingHistoryDb();
      if (crdtPath) {
        const snap = this.createSnapshot(crdtPath, 'snapshot_CRDTReadingHistory.sqlite');
        const db = new Database(snap, { readonly: true });
        try {
          const row = db
            .prepare('SELECT ZPROTODATA FROM ZCRDTMODELSYNCENTITY LIMIT 1')
            .get() as { ZPROTODATA?: Buffer } | undefined;
          if (row?.ZPROTODATA) {
            const crdtDays = decodeCrdtReadingHistory(row.ZPROTODATA);
            for (const d of crdtDays) {
              historyByDate.set(d.date, d);
            }
          }
        } finally {
          db.close();
        }
      }
    } catch {
      // 忽略 CRDT 解析异常，降级使用 BooksMessages
    }

    // 2. 解析实时明文 BooksMessages.sqlite (readingGoals)
    let goals: ParsedBooksMessagesGoals | null = null;
    try {
      const msgPath = path.join(this.groupContainerDir, 'EngagementCollector/BooksMessages.sqlite');
      if (fs.existsSync(msgPath)) {
        const snap = this.createSnapshot(msgPath, 'snapshot_BooksMessages.sqlite');
        const db = new Database(snap, { readonly: true });
        try {
          const row = db
            .prepare("SELECT ZDATA FROM ZCDPROPERTY WHERE ZKEY = 'readingGoals' LIMIT 1")
            .get() as { ZDATA?: Buffer } | undefined;
          if (row?.ZDATA) {
            goals = parseBooksMessagesGoals(row.ZDATA.toString('utf8'), now);
          }
        } finally {
          db.close();
        }
      }
    } catch {
      // 忽略读取异常
    }

    if (goals) {
      for (const d of goals.recentHistory) {
        const prev = historyByDate.get(d.date);
        // BooksMessages 具有最新近几天的精准秒数（CRDT 可能尚未刷新当日缓存）
        if (!prev || d.readingTimeSec >= prev.readingTimeSec) {
          historyByDate.set(d.date, d);
        }
      }
    }

    const dailyHistory = Array.from(historyByDate.values())
      .filter(d => d.readingTimeSec > 0)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (!goals && dailyHistory.length === 0) {
      return empty;
    }

    const totalReadingSec = dailyHistory.reduce((sum, d) => sum + d.readingTimeSec, 0);
    const todayKey = getLocalTodayKey(now);
    const todayEntry = historyByDate.get(todayKey);
    const todayReadingSec = todayEntry?.readingTimeSec ?? goals?.todayReadingSec ?? 0;
    const latestGoalSec =
      goals?.dailyGoalSec ||
      dailyHistory[dailyHistory.length - 1]?.readingGoalSec ||
      0;

    return {
      available: true,
      todayReadingSec,
      dailyGoalSec: latestGoalSec,
      currentStreakDays: goals?.currentStreakDays ?? 0,
      allTimeRecordStreakDays: goals?.allTimeRecordStreakDays ?? 0,
      currentYearBooksFinished: goals?.currentYearBooksFinished ?? 0,
      yearlyBooksFinishedGoal: goals?.yearlyBooksFinishedGoal ?? 0,
      totalReadingSec,
      dailyHistory
    };
  }
}
