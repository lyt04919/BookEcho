import { contextBridge, ipcRenderer } from 'electron';
import { BookEchoAPI, HighlightColor } from './types/ipc';

const api: BookEchoAPI = {
  getBooks: () => ipcRenderer.invoke('books:getAll'),
  getBookAnnotations: (assetId?: string) => ipcRenderer.invoke('annotations:getByBook', assetId),
  getBookChapters: (assetId: string) => ipcRenderer.invoke('books:getChapters', assetId),
  getChapterContent: (assetId: string, chapterTitle: string) =>
    ipcRenderer.invoke('books:getChapterContent', assetId, chapterTitle),
  searchAnnotations: (keyword: string) => ipcRenderer.invoke('annotations:search', keyword),
  getHighlightContext: (assetId: string, locationCfi: string, selectedText: string) =>
    ipcRenderer.invoke('context:get', assetId, locationCfi, selectedText),

  updateAnnotationMeta: (uuid: string, updates: { customNote?: string; isStarred?: boolean }) =>
    ipcRenderer.invoke('meta:update', uuid, updates),
  addTag: (uuid: string, tag: string) => ipcRenderer.invoke('tag:add', uuid, tag),
  removeTag: (uuid: string, tag: string) => ipcRenderer.invoke('tag:remove', uuid, tag),
  getAllTags: () => ipcRenderer.invoke('tag:getAll'),
  createGlobalTag: (tag: string) => ipcRenderer.invoke('tag:createGlobal', tag),
  renameGlobalTag: (oldTag: string, newTag: string) => ipcRenderer.invoke('tag:renameGlobal', oldTag, newTag),
  deleteGlobalTag: (tag: string) => ipcRenderer.invoke('tag:deleteGlobal', tag),

  getDailyReviewQueue: (limit?: number) => ipcRenderer.invoke('review:getQueue', limit),
  submitReviewResult: (uuid: string, result: 'remembered' | 'mastered' | 'reset') =>
    ipcRenderer.invoke('review:submit', uuid, result),

  getColorSemantics: () => ipcRenderer.invoke('semantics:get'),
  updateColorSemantic: (colorKey: HighlightColor, label: string) =>
    ipcRenderer.invoke('semantics:update', colorKey, label),
  openInAppleBooks: (assetId: string, epubPath?: string | null) =>
    ipcRenderer.invoke('system:openAppleBooks', assetId, epubPath),
  openSystemPrivacySettings: () => ipcRenderer.invoke('system:openSystemPrivacy'),
  selectCustomDataDir: () => ipcRenderer.invoke('system:selectCustomDir'),
  exportMarkdown: (assetId: string, format: 'standard' | 'obsidian') =>
    ipcRenderer.invoke('export:markdown', assetId, format)
};

contextBridge.exposeInMainWorld('bookEchoAPI', api);
