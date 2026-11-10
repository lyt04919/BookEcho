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
