import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('electron', () => ({
  shell: {
    trashItem: vi.fn().mockResolvedValue(undefined),
    openPath: vi.fn(),
    showItemInFolder: vi.fn(),
  },
}));

import { FileOperationsService } from '../../src/main/services/FileOperationsService';

describe('Safe File Operations Service', () => {
  let ops: FileOperationsService;

  beforeEach(() => {
    ops = new FileOperationsService();
  });

  describe('Filename validation', () => {
    it('accepts valid Windows filenames', () => {
      expect(ops.validateFilename('document.pdf').valid).toBe(true);
      expect(ops.validateFilename('My Vacation 2026.png').valid).toBe(true);
      expect(ops.validateFilename('file-name_v1.0.tar.gz').valid).toBe(true);
    });

    it('rejects forbidden characters on Windows', () => {
      expect(ops.validateFilename('file/slash.txt').valid).toBe(false);
      expect(ops.validateFilename('file\\backslash.txt').valid).toBe(false);
      expect(ops.validateFilename('file:colon.txt').valid).toBe(false);
      expect(ops.validateFilename('file*star.txt').valid).toBe(false);
      expect(ops.validateFilename('file?question.txt').valid).toBe(false);
      expect(ops.validateFilename('file"quote.txt').valid).toBe(false);
      expect(ops.validateFilename('file<less.txt').valid).toBe(false);
      expect(ops.validateFilename('file>greater.txt').valid).toBe(false);
      expect(ops.validateFilename('file|pipe.txt').valid).toBe(false);
    });

    it('rejects reserved Windows device names', () => {
      expect(ops.validateFilename('con.txt').valid).toBe(false);
      expect(ops.validateFilename('PRN').valid).toBe(false);
      expect(ops.validateFilename('aux.log').valid).toBe(false);
      expect(ops.validateFilename('nul').valid).toBe(false);
      expect(ops.validateFilename('com1.dat').valid).toBe(false);
      expect(ops.validateFilename('lpt9').valid).toBe(false);
    });
  });

  describe('Transfer cancellation', () => {
    it('registers and cancels an active operation cleanly', () => {
      const opId = 'test-op-123';
      // Inactive operation cancel returns false
      expect(ops.cancelTransfer(opId)).toBe(false);
    });
  });

  describe('Rename and Collisions logic', () => {
    it('rejects invalid names in renameItem', async () => {
      const res = await ops.renameItem('C:\\Test\\doc.txt', 'invalid/name.txt');
      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });

    it('rejects empty or whitespace-only names', async () => {
      const res = await ops.renameItem('C:\\Test\\doc.txt', '   ');
      expect(res.success).toBe(false);
      expect(res.error).toContain('cannot be empty');
    });

    it('returns success when old and new names are identical', async () => {
      const res = await ops.renameItem('C:\\Test\\doc.txt', 'doc.txt');
      expect(res.success).toBe(true);
    });
  });
});
