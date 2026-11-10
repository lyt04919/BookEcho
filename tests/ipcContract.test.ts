import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { BookEchoAPI } from '../electron/types/ipc';

describe('IPC API Contract Check', () => {
  const EXPECTED_API_KEYS: (keyof BookEchoAPI)[] = [
    'getBooks',
    'getBookAnnotations',
    'getBookChapters',
    'searchAnnotations',
    'getHighlightContext',
    'updateAnnotationMeta',
    'addTag',
    'removeTag',
    'getAllTags',
    'getDailyReviewQueue',
    'submitReviewResult',
    'getColorSemantics',
    'updateColorSemantic',
    'openInAppleBooks',
    'openSystemPrivacySettings',
    'selectCustomDataDir',
    'exportMarkdown'
  ];

  const EXPECTED_CHANNELS = [
    'books:getAll',
    'annotations:getByBook',
    'books:getChapters',
    'annotations:search',
    'context:get',
    'meta:update',
    'tag:add',
    'tag:remove',
    'tag:getAll',
    'review:getQueue',
    'review:submit',
    'semantics:get',
    'semantics:update',
    'system:openAppleBooks',
    'system:openSystemPrivacy',
    'system:selectCustomDir',
    'export:markdown'
  ];

  it('should define all required API methods on window.bookEchoAPI interface', () => {
    // 静态校验契约完备性
    expect(EXPECTED_API_KEYS.length).toBe(17);
  });

  it('should have matching ipcRenderer invoke channels in preload.ts', () => {
    const preloadPath = path.resolve(__dirname, '../electron/preload.ts');
    const content = fs.readFileSync(preloadPath, 'utf-8');

    const invokeMatches = Array.from(content.matchAll(/ipcRenderer\.invoke\(['"]([^'"]+)['"]/g)).map(m => m[1]);
    expect(invokeMatches.sort()).toEqual([...EXPECTED_CHANNELS].sort());
  });

  it('should have matching ipcMain handle channels in main.ts', () => {
    const mainPath = path.resolve(__dirname, '../electron/main.ts');
    const content = fs.readFileSync(mainPath, 'utf-8');

    const handleMatches = Array.from(content.matchAll(/ipcMain\.handle\(['"]([^'"]+)['"]/g)).map(m => m[1]);
    expect(handleMatches.sort()).toEqual([...EXPECTED_CHANNELS].sort());
  });

  it('should ensure preload invoke channels and main handle channels are 1:1 identical', () => {
    const preloadPath = path.resolve(__dirname, '../electron/preload.ts');
    const mainPath = path.resolve(__dirname, '../electron/main.ts');
    const preloadContent = fs.readFileSync(preloadPath, 'utf-8');
    const mainContent = fs.readFileSync(mainPath, 'utf-8');

    const preloadChannels = Array.from(preloadContent.matchAll(/ipcRenderer\.invoke\(['"]([^'"]+)['"]/g)).map(m => m[1]);
    const mainChannels = Array.from(mainContent.matchAll(/ipcMain\.handle\(['"]([^'"]+)['"]/g)).map(m => m[1]);

    expect(preloadChannels.length).toBe(17);
    expect(mainChannels.length).toBe(17);
    expect(preloadChannels.sort()).toEqual(mainChannels.sort());
  });
});
