import { parentPort } from 'worker_threads';
import * as fs from 'fs/promises';
import * as path from 'path';
import { CycleDetector } from './CycleDetector';
import { SearchMatch, SearchQuery } from '../shared/types';

interface SearchJob {
  searchId: string;
  query: SearchQuery;
  cancelled: boolean;
  startTime: number;
  cycleDetector: CycleDetector;
  totalMatches: number;
}

let activeJob: SearchJob | null = null;

if (parentPort) {
  parentPort.on('message', async (message: { action: string; searchId?: string; query?: SearchQuery }) => {
    if (message.action === 'START' && message.searchId && message.query) {
      if (activeJob) {
        activeJob.cancelled = true;
      }

      const job: SearchJob = {
        searchId: message.searchId,
        query: message.query,
        cancelled: false,
        startTime: Date.now(),
        cycleDetector: new CycleDetector(),
        totalMatches: 0,
      };
      activeJob = job;

      await runSearch(job);
    } else if (message.action === 'CANCEL' && message.searchId) {
      if (activeJob && activeJob.searchId === message.searchId) {
        activeJob.cancelled = true;
      }
    }
  });
}

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

  for (const token of tokens) {
    if (token.startsWith('ext:')) {
      extension = token.substring(4).toLowerCase().replace(/^\./, '');
    } else if (token.startsWith('size:>')) {
      minSize = parseSizeString(token.substring(6));
    } else if (token.startsWith('size:<')) {
      maxSize = parseSizeString(token.substring(6));
    } else {
      keyword = keyword ? `${keyword} ${token}` : token;
    }
  }

  return { keyword: keyword.toLowerCase(), extension, minSize, maxSize };
}

function parseSizeString(str: string): number {
  const match = str.match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/i);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  const unit = (match[2] || 'b').toLowerCase();
  switch (unit) {
    case 'kb':
      return num * 1024;
    case 'mb':
      return num * 1024 * 1024;
    case 'gb':
      return num * 1024 * 1024 * 1024;
    default:
      return num;
  }
}

async function runSearch(job: SearchJob) {
  const parsed = parseAdvancedQuery(job.query.query);
  const targetExtension = job.query.extension ? job.query.extension.toLowerCase() : parsed.extension;
  const minSize = job.query.minSizeBytes ?? parsed.minSize;
  const maxSize = job.query.maxSizeBytes ?? parsed.maxSize;
  const keyword = parsed.keyword;

  let buffer: SearchMatch[] = [];
  let lastFlush = Date.now();

  const flushMatches = () => {
    if (!parentPort || buffer.length === 0) return;
    parentPort.postMessage({
      type: 'MATCHES',
      searchId: job.searchId,
      matches: buffer,
    });
    buffer = [];
    lastFlush = Date.now();
  };

  async function traverse(dirPath: string) {
    if (job.cancelled) return;

    let entries;
    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch {
      return; // Inaccessible directory
    }

    for (const entry of entries) {
      if (job.cancelled) return;
      const fullPath = path.join(dirPath, entry.name);
      const isDir = entry.isDirectory();
      const isFile = entry.isFile();

      let stat;
      try {
        stat = await fs.stat(fullPath);
      } catch {
        continue;
      }

      // Check matching criteria
      let isMatch = true;

      // 1. Keyword match
      if (keyword && !entry.name.toLowerCase().includes(keyword)) {
        isMatch = false;
      }

      // 2. Extension match
      if (isMatch && targetExtension) {
        const ext = entry.name.split('.').pop()?.toLowerCase();
        if (ext !== targetExtension) {
          isMatch = false;
        }
      }

      // 3. Size filters
      if (isMatch && isFile) {
        if (minSize !== undefined && stat.size < minSize) isMatch = false;
        if (maxSize !== undefined && stat.size > maxSize) isMatch = false;
      }

      // 4. Date filter
      if (isMatch && job.query.modifiedAfterMs && stat.mtimeMs < job.query.modifiedAfterMs) {
        isMatch = false;
      }

      if (isMatch) {
        job.totalMatches += 1;
        buffer.push({
          name: entry.name,
          path: fullPath,
          isDirectory: isDir,
          sizeBytes: stat.size,
          modifiedMs: stat.mtimeMs,
        });

        if (buffer.length >= 25 || Date.now() - lastFlush > 100) {
          flushMatches();
        }
      }

      // Recurse directories safely
      if (isDir && !entry.isSymbolicLink()) {
        const isCycle = job.cycleDetector.checkAndMark(stat.dev, stat.ino, fullPath);
        if (!isCycle) {
          await traverse(fullPath);
        }
      }
    }
  }

  try {
    await traverse(job.query.rootPath);
    flushMatches();

    if (parentPort) {
      parentPort.postMessage({
        type: 'COMPLETED',
        searchId: job.searchId,
        totalMatches: job.totalMatches,
        durationMs: Date.now() - job.startTime,
        cancelled: job.cancelled,
      });
    }
  } catch (err) {
    if (parentPort) {
      parentPort.postMessage({
        type: 'COMPLETED',
        searchId: job.searchId,
        totalMatches: job.totalMatches,
        durationMs: Date.now() - job.startTime,
        cancelled: true,
      });
    }
  } finally {
    if (activeJob === job) {
      activeJob = null;
    }
  }
}
