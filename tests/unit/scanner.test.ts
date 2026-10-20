import { describe, it, expect, beforeEach } from 'vitest';
import { Aggregator } from '../../src/workers/Aggregator';
import { CycleDetector } from '../../src/workers/CycleDetector';

describe('Phase 5 Signature Storage Scanner & Cycle Detector', () => {
  describe('CycleDetector', () => {
    let detector: CycleDetector;

    beforeEach(() => {
      detector = new CycleDetector();
    });

    it('identifies distinct directories without false positives', () => {
      expect(detector.checkAndMark(1, 101, 'C:\\dirA')).toBe(false);
      expect(detector.checkAndMark(1, 102, 'C:\\dirB')).toBe(false);
      expect(detector.checkAndMark(1, 103, 'C:\\dirC')).toBe(false);
    });

    it('detects and halts cycles when encountering the same inode and device', () => {
      expect(detector.checkAndMark(1, 101, 'C:\\dirA')).toBe(false);
      // Re-encountering dev 1 and ino 101 (e.g. junction pointing back)
      expect(detector.checkAndMark(1, 101, 'C:\\dirA\\junction_to_A')).toBe(true);
    });

    it('detects cycles based on canonical real path', () => {
      expect(detector.checkAndMark(0, 0, 'C:\\Projects\\repo')).toBe(false);
      expect(detector.checkAndMark(0, 0, 'c:\\projects\\repo')).toBe(true); // Case-insensitive match on Windows
    });

    it('clears visited registry on reset', () => {
      detector.checkAndMark(1, 555, 'C:\\temp');
      detector.reset();
      expect(detector.checkAndMark(1, 555, 'C:\\temp')).toBe(false);
    });
  });

  describe('Aggregator NTFS Cluster Allocation & Metrics', () => {
    let aggregator: Aggregator;

    beforeEach(() => {
      aggregator = new Aggregator();
    });

    it('accurately calculates physical cluster allocation size (4KB boundaries)', () => {
      // 0 bytes -> 0 bytes allocated
      aggregator.addFile('empty.txt', 'C:\\empty.txt', 0);
      expect(aggregator.totalBytes).toBe(0);
      expect(aggregator.physicalBytes).toBe(0);

      // 100 bytes -> 4096 bytes allocated
      aggregator.addFile('small.txt', 'C:\\small.txt', 100);
      expect(aggregator.totalBytes).toBe(100);
      expect(aggregator.physicalBytes).toBe(4096);

      // 4096 bytes -> 4096 bytes allocated (exact cluster boundary)
      aggregator.addFile('exact.bin', 'C:\\exact.bin', 4096);
      expect(aggregator.totalBytes).toBe(4196);
      expect(aggregator.physicalBytes).toBe(4096 + 4096); // 8192

      // 4097 bytes -> 8192 bytes allocated (spills into second cluster)
      aggregator.addFile('spill.dat', 'C:\\spill.dat', 4097);
      expect(aggregator.totalBytes).toBe(4196 + 4097);
      expect(aggregator.physicalBytes).toBe(8192 + 8192); // 16384
    });

    it('tracks direct subfolder storage accumulation correctly', () => {
      aggregator.addFolder('node_modules', 'C:\\app\\node_modules', true);
      aggregator.addFolder('src', 'C:\\app\\src', true);

      aggregator.addBytesToDirectSubfolder('node_modules', 1000000);
      aggregator.addBytesToDirectSubfolder('node_modules', 500000);
      aggregator.addBytesToDirectSubfolder('src', 250000);

      const topSubfolders = aggregator.getLargestSubfolders('C:\\app');
      expect(topSubfolders.length).toBe(2);
      expect(topSubfolders[0].name).toBe('node_modules');
      expect(topSubfolders[0].sizeBytes).toBe(1500000);
      expect(topSubfolders[1].name).toBe('src');
      expect(topSubfolders[1].sizeBytes).toBe(250000);
    });

    it('tracks hidden items separately', () => {
      aggregator.addFile('.env', 'C:\\.env', 50, true);
      aggregator.addFolder('.git', 'C:\\.git', true, true);
      aggregator.addFile('visible.txt', 'C:\\visible.txt', 100, false);

      expect(aggregator.hiddenCount).toBe(2);
      expect(aggregator.totalFiles).toBe(2);
      expect(aggregator.totalFolders).toBe(1);
    });
  });
});
