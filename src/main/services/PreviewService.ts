import * as fs from 'fs/promises';
import * as path from 'path';
import { PreviewContent, PreviewType } from '../../shared/types';

const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'json', 'ts', 'js', 'jsx', 'tsx', 'html', 'css', 'scss',
  'py', 'c', 'cpp', 'h', 'hpp', 'cs', 'rs', 'go', 'java', 'sh', 'ps1',
  'yml', 'yaml', 'xml', 'sql', 'php', 'rb', 'ini', 'cfg', 'log', 'env',
  'bat', 'cmd', 'csv', 'tsv', 'mjs', 'cjs', 'toml'
]);

const IMAGE_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'ico'
]);

const AUDIO_EXTENSIONS = new Set([
  'mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'
]);

const VIDEO_EXTENSIONS = new Set([
  'mp4', 'mkv', 'avi', 'mov', 'webm'
]);

const MAX_PREVIEW_TEXT_BYTES = 512 * 1024; // 512 KB safeguard

export class PreviewService {
  static async getPreview(filePath: string): Promise<PreviewContent> {
    const fileName = path.basename(filePath);
    const ext = fileName.split('.').pop()?.toLowerCase() || '';

    let stat;
    try {
      stat = await fs.stat(filePath);
    } catch (err: any) {
      throw new Error(`Cannot access file: ${err.message}`);
    }

    if (stat.isDirectory()) {
      return {
        path: filePath,
        name: fileName,
        type: 'binary',
        sizeBytes: 0,
        mimeType: 'inode/directory',
        content: 'Directory selected. Use Folder Inspector for directory storage analytics.',
      };
    }

    // 1. Text & Code files
    if (TEXT_EXTENSIONS.has(ext)) {
      const handle = await fs.open(filePath, 'r');
      const bytesToRead = Math.min(stat.size, MAX_PREVIEW_TEXT_BYTES);
      const buffer = Buffer.alloc(bytesToRead);
      await handle.read(buffer, 0, bytesToRead, 0);
      await handle.close();

      const text = buffer.toString('utf-8');
      const lines = text.split('\n').length;
      const isTruncated = stat.size > MAX_PREVIEW_TEXT_BYTES;

      return {
        path: filePath,
        name: fileName,
        type: 'text',
        content: text,
        sizeBytes: stat.size,
        mimeType: `text/${ext === 'json' ? 'json' : ext === 'md' ? 'markdown' : 'plain'}`,
        lineCount: lines,
        isTruncated,
      };
    }

    // 2. Image files
    if (IMAGE_EXTENSIONS.has(ext)) {
      // For images smaller than 15 MB, convert to base64 data URI for instant rendering
      let dataUri = '';
      if (stat.size <= 15 * 1024 * 1024) {
        const buffer = await fs.readFile(filePath);
        const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
        dataUri = `data:${mime};base64,${buffer.toString('base64')}`;
      }

      return {
        path: filePath,
        name: fileName,
        type: 'image',
        content: dataUri,
        sizeBytes: stat.size,
        mimeType: `image/${ext}`,
      };
    }

    // 3. Audio files
    if (AUDIO_EXTENSIONS.has(ext)) {
      return {
        path: filePath,
        name: fileName,
        type: 'audio',
        sizeBytes: stat.size,
        mimeType: `audio/${ext}`,
      };
    }

    // 4. Video files
    if (VIDEO_EXTENSIONS.has(ext)) {
      return {
        path: filePath,
        name: fileName,
        type: 'video',
        sizeBytes: stat.size,
        mimeType: `video/${ext}`,
      };
    }

    // 5. PDF documents
    if (ext === 'pdf') {
      return {
        path: filePath,
        name: fileName,
        type: 'pdf',
        sizeBytes: stat.size,
        mimeType: 'application/pdf',
      };
    }

    // 6. Generic Binary
    return {
      path: filePath,
      name: fileName,
      type: 'binary',
      sizeBytes: stat.size,
      mimeType: 'application/octet-stream',
      content: `Binary file (${(stat.size / 1024).toFixed(1)} KB). Preview not available for this file type.`,
    };
  }
}
