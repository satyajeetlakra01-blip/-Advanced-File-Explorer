import { describe, it, expect, beforeEach } from 'vitest';
import { InspectorService } from '../../src/main/services/InspectorService';
import { FolderStats } from '../../src/shared/types';

describe('InspectorService LRU Cache & Invalidation (FR-INSP-014)', () => {
  let service: InspectorService;

  const mockStats = (path: string, totalFiles = 10): FolderStats => ({
    scanId: `scan-${path}`,
    path,
    directFiles: 2,
    directFolders: 1,
    directSizeBytes: 1024,
    totalFiles,
    totalFolders: 3,
    totalSizeBytes: 20480,
    physicalSizeBytes: 24576,
    emptyFolders: 0,
    hiddenCount: 0,
    largestFiles: [],
    largestFolders: [],
    typeBreakdown: [],
    scanDurationMs: 45,
    status: 'COMPLETED',
    inaccessiblePaths: [],
  });

  beforeEach(() => {
    // Instantiate without worker for pure cache testing
    service = new InspectorService();
  });

  it('stores and retrieves cached stats by canonical path', () => {
    const statsA = mockStats('C:\\Users\\Test\\Projects');
    service.setCachedStats('C:\\Users\\Test\\Projects', statsA);

    const retrieved = service.getCachedStats('C:\\Users\\Test\\Projects');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.path).toBe('C:\\Users\\Test\\Projects');
    expect(retrieved?.totalFiles).toBe(10);
  });

  it('handles case-insensitivity on Windows paths', () => {
    const stats = mockStats('C:\\Workspace\\Code');
    service.setCachedStats('C:\\Workspace\\Code', stats);

    const lower = service.getCachedStats('c:\\workspace\\code');
    expect(lower).not.toBeNull();
    expect(lower?.totalFiles).toBe(10);
  });

  it('returns null for cache miss', () => {
    expect(service.getCachedStats('C:\\Unknown\\Folder')).toBeNull();
  });

  it('invalidates matching folder and subfolders when invalidated', () => {
    service.setCachedStats('C:\\Work\\Project1', mockStats('C:\\Work\\Project1'));
    service.setCachedStats('C:\\Work\\Project1\\src', mockStats('C:\\Work\\Project1\\src'));
    service.setCachedStats('C:\\Work\\Project2', mockStats('C:\\Work\\Project2'));

    expect(service.getCacheSize()).toBe(3);

    // Invalidate Project1 (which also invalidates child src and marks parent dirty)
    service.invalidate('C:\\Work\\Project1');

    expect(service.getCachedStats('C:\\Work\\Project1')).toBeNull();
    expect(service.getCachedStats('C:\\Work\\Project1\\src')).toBeNull();
    expect(service.getCachedStats('C:\\Work\\Project2')).not.toBeNull();
  });

  it('evicts least recently accessed entries when cache capacity is exceeded', () => {
    // Fill beyond capacity limit (50)
    for (let i = 0; i < 55; i++) {
      service.setCachedStats(`C:\\Folder\\${i}`, mockStats(`C:\\Folder\\${i}`, i));
    }

    expect(service.getCacheSize()).toBe(50);
    // Folders 0..4 should have been evicted
    expect(service.getCachedStats('C:\\Folder\\0')).toBeNull();
    expect(service.getCachedStats('C:\\Folder\\4')).toBeNull();
    // Recent folder should exist
    expect(service.getCachedStats('C:\\Folder\\54')).not.toBeNull();
  });
});
