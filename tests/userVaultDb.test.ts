import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { UserVaultDb } from '../electron/services/userVaultDb';

describe('UserVaultDb & Secondary Annotations', () => {
  let tempDir: string;
  let vaultDbPath: string;
  let vault: UserVaultDb;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bookecho-vault-'));
    vaultDbPath = path.join(tempDir, 'user_vault.sqlite');
    vault = new UserVaultDb(vaultDbPath);
  });

  afterEach(() => {
    vault.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should initialize tables and default color semantics', () => {
    const semantics = vault.getColorSemantics();
    expect(semantics.length).toBe(6);
    const yellow = semantics.find(s => s.colorKey === 'yellow');
    expect(yellow?.label).toBe('核心论点');
    expect(yellow?.hexColor).toBe('#F5A623');
  });

  it('should update color semantic label', () => {
    vault.updateColorSemantic('yellow', '核心命题');
    const semantics = vault.getColorSemantics();
    const yellow = semantics.find(s => s.colorKey === 'yellow');
    expect(yellow?.label).toBe('核心命题');
  });

  it('should manage custom notes, starred status, and tags', () => {
    vault.updateAnnotationMeta('anno-1', { customNote: '我的深度思考', isStarred: true });
    vault.addTag('anno-1', '心理学');
    vault.addTag('anno-1', '思维模型');

    const meta = vault.getAnnotationMeta('anno-1');
    expect(meta?.customNote).toBe('我的深度思考');
    expect(meta?.isStarred).toBe(true);

    const tags = vault.getTagsForAnnotation('anno-1');
    expect(tags).toContain('心理学');
    expect(tags).toContain('思维模型');

    const allTags = vault.getAllTags();
    expect(allTags).toEqual(['心理学', '思维模型']);

    vault.removeTag('anno-1', '心理学');
    expect(vault.getTagsForAnnotation('anno-1')).toEqual(['思维模型']);

    // Test batch extraction functions to prevent N+1 queries
    const allMetas = vault.getAllAnnotationMetas();
    expect(allMetas.get('anno-1')?.customNote).toBe('我的深度思考');
    expect(allMetas.get('anno-1')?.isStarred).toBe(true);

    const groupedTags = vault.getAllTagsGrouped();
    expect(groupedTags.get('anno-1')).toEqual(['思维模型']);
  });

  it('should strip leading hash when adding tags and ignore empty tags', () => {
    vault.addTag('anno-tag', '#读书笔记');
    vault.addTag('anno-tag', '   ');
    expect(vault.getTagsForAnnotation('anno-tag')).toEqual(['读书笔记']);
  });

  it('should calculate daily review queue with spaced repetition scoring', () => {
    // 注入两条笔记状态
    vault.updateAnnotationMeta('anno-1', { isStarred: true });
    vault.recordReviewResult('anno-1', 'remembered');
    vault.recordReviewResult('anno-2', 'remembered');

    const queue = vault.getReviewCandidates(['anno-1', 'anno-2']);
    expect(queue.length).toBe(2);
    // anno-1 被标星，权重更高
    expect(queue[0].uuid).toBe('anno-1');
  });

  it('should prioritize starred annotations when neither has been reviewed', () => {
    vault.updateAnnotationMeta('anno-starred', { isStarred: true });
    vault.updateAnnotationMeta('anno-unstarred', { isStarred: false });

    const queue = vault.getReviewCandidates(['anno-starred', 'anno-unstarred']);
    expect(queue.length).toBe(2);
    expect(queue[0].uuid).toBe('anno-starred');
  });

  it('should lower score for mastered and archived annotations in review candidates', () => {
    vault.recordReviewResult('anno-mastered', 'mastered');
    vault.updateAnnotationMeta('anno-archived', { reviewStatus: 'archived' });
    vault.updateAnnotationMeta('anno-normal', {});

    const candidates = vault.getReviewCandidates(['anno-mastered', 'anno-archived', 'anno-normal']);
    expect(candidates[0].uuid).toBe('anno-normal');
    const mastered = candidates.find(c => c.uuid === 'anno-mastered');
    expect(mastered?.score).toBe(-9999);
    const archived = candidates.find(c => c.uuid === 'anno-archived');
    expect(archived?.score).toBe(-9999);
  });

  it('should handle large batches of UUIDs exceeding 500 items correctly', () => {
    const largeUuids = Array.from({ length: 1050 }, (_, i) => `large-uuid-${i}`);
    vault.updateAnnotationMeta('large-uuid-499', { isStarred: true });
    vault.updateAnnotationMeta('large-uuid-501', { isStarred: true });

    const candidates = vault.getReviewCandidates(largeUuids);
    expect(candidates.length).toBe(1050);
    expect(candidates[0].score).toBeGreaterThan(candidates[candidates.length - 1].score);
  });

  it('should manage app settings', () => {
    expect(vault.getSetting('theme')).toBeNull();
    vault.setSetting('theme', 'dark');
    expect(vault.getSetting('theme')).toBe('dark');
    vault.setSetting('theme', 'light');
    expect(vault.getSetting('theme')).toBe('light');
  });
});
