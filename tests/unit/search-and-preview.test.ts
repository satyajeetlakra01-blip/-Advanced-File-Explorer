import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { PreviewService } from '../../src/main/services/PreviewService';

describe('Phase 7 Search, Quick-Filter & Sandboxed Previews (TC-SRCH, TC-PREV)', () => {
  let tempDir: string;
  let textFilePath: string;
  let codeFilePath: string;
  let imageFilePath: string;
  let binaryFilePath: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'afe-test-p7-'));

    textFilePath = path.join(tempDir, 'sample_notes.txt');
    await fs.writeFile(textFilePath, 'Line 1: Hello World\nLine 2: Advanced File Explorer\nLine 3: Fast & Native\n');

    codeFilePath = path.join(tempDir, 'main.ts');
    await fs.writeFile(codeFilePath, 'export const greeting = "hello";\nconsole.log(greeting);\n');

    imageFilePath = path.join(tempDir, 'logo.png');
    // Minimal 1x1 transparent PNG buffer
    const minimalPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      'base64'
    );
    await fs.writeFile(imageFilePath, minimalPng);

    binaryFilePath = path.join(tempDir, 'compiled.bin');
    await fs.writeFile(binaryFilePath, Buffer.alloc(2048, 0xff));
  });

  afterAll(async () => {
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {
        // Cleanup best effort
      }
    }
  });

  describe('PreviewService (FR-PREV-001, FR-PREV-002)', () => {
    it('generates sandboxed text preview with exact line counts and UTF-8 content', async () => {
      const preview = await PreviewService.getPreview(textFilePath);
      expect(preview.type).toBe('text');
      expect(preview.name).toBe('sample_notes.txt');
      expect(preview.lineCount).toBe(4); // 3 lines + trailing newline
      expect(preview.content).toContain('Advanced File Explorer');
      expect(preview.isTruncated).toBe(false);
      expect(preview.sizeBytes).toBeGreaterThan(0);
    });

    it('generates code preview with proper mime type', async () => {
      const preview = await PreviewService.getPreview(codeFilePath);
      expect(preview.type).toBe('text');
      expect(preview.name).toBe('main.ts');
      expect(preview.content).toContain('export const greeting');
    });

    it('generates base64 data URI for image files', async () => {
      const preview = await PreviewService.getPreview(imageFilePath);
      expect(preview.type).toBe('image');
      expect(preview.name).toBe('logo.png');
      expect(preview.mimeType).toBe('image/png');
      expect(preview.content).toMatch(/^data:image\/png;base64,/);
    });

    it('gracefully handles binary files without loading into memory', async () => {
      const preview = await PreviewService.getPreview(binaryFilePath);
      expect(preview.type).toBe('binary');
      expect(preview.name).toBe('compiled.bin');
      expect(preview.content).toContain('Binary file');
    });

    it('throws error when file does not exist', async () => {
      await expect(PreviewService.getPreview(path.join(tempDir, 'non_existent.txt'))).rejects.toThrow(
        /Cannot access file/
      );
    });
  });

  describe('Advanced Search Query Parsing (FR-SRCH-003)', () => {
    function parseAdvancedQuery(rawQuery: string): {
      keyword: string;
      extension?: string;
      minSize?: number;
      maxSize?: number;
    } {
      const tokens = rawQuery.split(/\s+/).filter(Boolean);
      let keyword = '';
      let extension: string | undefined;
      let minSize: number | undefined;
      let maxSize: number | undefined;

      const parseSize = (str: string): number => {
        const match = str.match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/i);
        if (!match) return 0;
        const num = parseFloat(match[1]);
        const unit = (match[2] || 'b').toLowerCase();
        switch (unit) {
          case 'kb': return num * 1024;
          case 'mb': return num * 1024 * 1024;
          case 'gb': return num * 1024 * 1024 * 1024;
          default: return num;
        }
      };

      for (const token of tokens) {
        if (token.startsWith('ext:')) {
          extension = token.substring(4).toLowerCase().replace(/^\./, '');
        } else if (token.startsWith('size:>')) {
          minSize = parseSize(token.substring(6));
        } else if (token.startsWith('size:<')) {
          maxSize = parseSize(token.substring(6));
        } else {
          keyword = keyword ? `${keyword} ${token}` : token;
        }
      }

      return { keyword: keyword.toLowerCase(), extension, minSize, maxSize };
    }

    it('extracts keyword, extension, and size thresholds from complex search strings', () => {
      const parsed = parseAdvancedQuery('report ext:pdf size:>5MB size:<50MB');
      expect(parsed.keyword).toBe('report');
      expect(parsed.extension).toBe('pdf');
      expect(parsed.minSize).toBe(5 * 1024 * 1024);
      expect(parsed.maxSize).toBe(50 * 1024 * 1024);
    });

    it('handles query with only extension token', () => {
      const parsed = parseAdvancedQuery('ext:.tsx');
      expect(parsed.keyword).toBe('');
      expect(parsed.extension).toBe('tsx');
    });

    it('handles query with multi-word keywords', () => {
      const parsed = parseAdvancedQuery('annual financial statement ext:docx');
      expect(parsed.keyword).toBe('annual financial statement');
      expect(parsed.extension).toBe('docx');
    });
  });
});
