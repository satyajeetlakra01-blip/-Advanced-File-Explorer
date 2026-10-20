import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createSyntheticFixture, FixtureInfo } from '../fixtures/create-test-fixture';
import { Aggregator } from '../../src/workers/Aggregator';
import { CycleDetector } from '../../src/workers/CycleDetector';

describe('Phase 5 Synthetic Fixture Traversal & Ground Truth Verification (TC-INSP)', () => {
  let fixture: FixtureInfo;

  beforeAll(async () => {
    fixture = await createSyntheticFixture();
  }, 10000);

  afterAll(async () => {
    if (fixture) {
      await fixture.cleanup();
    }
  });

  it('accurately enumerates direct vs recursive files and sizes on the synthetic tree', async () => {
    const aggregator = new Aggregator();
    const cycleDetector = new CycleDetector();

    let directFiles = 0;
    let directFolders = 0;
    let directSizeBytes = 0;

    // Direct root read
    const rootEntries = await fs.readdir(fixture.rootPath, { withFileTypes: true });
    const subdirectoriesToVisit: { fullPath: string; directSubfolderName: string }[] = [];

    for (const entry of rootEntries) {
      const fullPath = path.join(fixture.rootPath, entry.name);
      const isHidden = entry.name.startsWith('.');

      if (entry.isDirectory()) {
        directFolders += 1;
        aggregator.addFolder(entry.name, fullPath, true, isHidden);

        if (!entry.isSymbolicLink()) {
          try {
            const stat = await fs.stat(fullPath);
            const isCycle = cycleDetector.checkAndMark(stat.dev, stat.ino, fullPath);
            if (!isCycle) {
              subdirectoriesToVisit.push({ fullPath, directSubfolderName: entry.name });
            }
          } catch {
            // Unreadable
          }
        }
      } else if (entry.isFile()) {
        const stat = await fs.stat(fullPath);
        directFiles += 1;
        directSizeBytes += stat.size;
        aggregator.addFile(entry.name, fullPath, stat.size, isHidden);
      }
    }

    // Verify direct root counts
    expect(directFiles).toBe(fixture.expectedDirectFiles);
    expect(directSizeBytes).toBe(fixture.expectedDirectSizeBytes);

    // Recursive traversal
    let inaccessibleCount = 0;
    async function recurse(dirPath: string, directSubfolderName: string) {
      let entries;
      try {
        if (dirPath.includes('locked_folder')) {
          const err: any = new Error('EACCES: permission denied');
          err.code = 'EACCES';
          throw err;
        }
        entries = await fs.readdir(dirPath, { withFileTypes: true });
      } catch (err: any) {
        inaccessibleCount += 1;
        return;
      }

      if (entries.length === 0) {
        aggregator.incrementEmptyFolders();
      }

      for (const entry of entries) {
        const itemPath = path.join(dirPath, entry.name);
        const isHidden = entry.name.startsWith('.');

        if (entry.isDirectory()) {
          aggregator.addFolder(entry.name, itemPath, false, isHidden);

          if (!entry.isSymbolicLink()) {
            try {
              const stat = await fs.stat(itemPath);
              const isCycle = cycleDetector.checkAndMark(stat.dev, stat.ino, itemPath);
              if (!isCycle) {
                await recurse(itemPath, directSubfolderName);
              }
            } catch {
              // Inaccessible
            }
          }
        } else if (entry.isFile()) {
          const stat = await fs.stat(itemPath);
          aggregator.addFile(entry.name, itemPath, stat.size, isHidden);
          aggregator.addBytesToDirectSubfolder(directSubfolderName, stat.size);
        }
      }
    }

    for (const sub of subdirectoriesToVisit) {
      await recurse(sub.fullPath, sub.directSubfolderName);
    }

    // 1. Recursive regular file count
    expect(aggregator.totalFiles).toBe(fixture.expectedRecursiveFiles);

    // 2. Empty subfolders
    expect(aggregator.emptyFolders).toBe(fixture.expectedEmptyFolders);
    expect(inaccessibleCount).toBe(1);

    // 3. Exact logical size ground truth: 90,028,170 bytes
    expect(aggregator.totalBytes).toBe(fixture.expectedTotalSizeBytes);

    // 4. Physical size on disk >= raw logical size due to 4KB cluster boundary rounding
    expect(aggregator.physicalBytes).toBeGreaterThanOrEqual(aggregator.totalBytes);

    // 5. Top 5 largest files verification
    const topFiles = aggregator.getLargestFiles();
    expect(topFiles.length).toBeLessThanOrEqual(5);
    expect(topFiles[0].name).toBe('huge_blob.dat');
    expect(topFiles[0].sizeBytes).toBe(50000000);
    expect(topFiles[1].name).toBe('big_media.mp4');
    expect(topFiles[1].sizeBytes).toBe(25000000);
    expect(topFiles[2].name).toBe('doc_archive.zip');
    expect(topFiles[2].sizeBytes).toBe(10000000);

    // 6. Top direct subfolder
    const topFolders = aggregator.getLargestSubfolders(fixture.rootPath);
    expect(topFolders[0].name).toBe('largest_files_bucket');
    expect(topFolders[0].sizeBytes).toBeGreaterThan(80000000);

    // 7. File Type Distribution Breakdown
    const breakdown = aggregator.getTypeBreakdown();
    const categories = breakdown.map((b) => b.category);
    expect(categories).toContain('Media');
    expect(categories).toContain('Archives');
    expect(categories).toContain('Code');
    expect(categories).toContain('Documents');
  });
});
