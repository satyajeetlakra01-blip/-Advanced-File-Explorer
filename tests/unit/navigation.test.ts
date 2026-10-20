import { describe, it, expect, vi } from 'vitest';

vi.mock('electron', () => ({
  shell: {
    trashItem: vi.fn(),
    openPath: vi.fn(),
    showItemInFolder: vi.fn(),
  },
}));

import { NavigationService } from '../../src/main/services/NavigationService';
import { FileOperationsService } from '../../src/main/services/FileOperationsService';

describe('Navigation & Path Services', () => {
  const nav = new NavigationService();
  const ops = new FileOperationsService();

  it('normalizes Windows drive paths properly', () => {
    expect(nav.normalizePath('C:')).toBe('C:\\');
    expect(nav.normalizePath('D:')).toBe('D:\\');
    expect(nav.normalizePath('C:/test/folder')).toBe('C:\\test\\folder');
  });

  it('validates Windows filenames preventing illegal characters', () => {
    expect(ops.validateFilename('valid_file.txt').valid).toBe(true);
    expect(ops.validateFilename('invalid:file?.txt').valid).toBe(false);
    expect(ops.validateFilename('bad/slash.txt').valid).toBe(false);
    expect(ops.validateFilename('pipe|char.txt').valid).toBe(false);
    expect(ops.validateFilename('').valid).toBe(false);
  });

  it('rejects reserved Windows device names', () => {
    expect(ops.validateFilename('CON.txt').valid).toBe(false);
    expect(ops.validateFilename('prn').valid).toBe(false);
    expect(ops.validateFilename('aux.json').valid).toBe(false);
    expect(ops.validateFilename('NUL').valid).toBe(false);
  });
});
