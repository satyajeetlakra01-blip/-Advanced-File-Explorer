import { parentPort } from 'worker_threads';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Aggregator } from './Aggregator';
import { CycleDetector } from './CycleDetector';
import { FolderStats, InaccessiblePath } from '../shared/types';

interface ScanJob {
  scanId: string;
  rootPath: string;
  cancelled: boolean;
  startTime: number;
  aggregator: Aggregator;
  cycleDetector: CycleDetector;
  inaccessiblePaths: InaccessiblePath[];
  directFiles: number;
  directFolders: number;
  directSizeBytes: number;
}

let activeJob: ScanJob | null = null;

if (parentPort) {
  parentPort.on('message', async (message: { action: string; scanId?: string; path?: string }) => {
    if (message.action === 'START' && message.scanId && message.path) {
      if (activeJob) {
        activeJob.cancelled = true;
      }

      const job: ScanJob = {
        scanId: message.scanId,
        rootPath: message.path,
        cancelled: false,
        startTime: Date.now(),
        aggregator: new Aggregator(),
        cycleDetector: new CycleDetector(),
        inaccessiblePaths: [],
        directFiles: 0,
        directFolders: 0,
        directSizeBytes: 0,
      };
      activeJob = job;

      await runScan(job);
    } else if (message.action === 'CANCEL' && message.scanId) {
      if (activeJob && activeJob.scanId === message.scanId) {
        activeJob.cancelled = true;
      }
    }
  });
}

async function runScan(job: ScanJob) {
  let lastProgressTick = Date.now();

  const emitProgress = () => {
    if (!parentPort) return;
    const now = Date.now();
    parentPort.postMessage({
      type: 'PROGRESS',
      scanId: job.scanId,
      path: job.rootPath,
      totalFiles: job.aggregator.totalFiles,
      totalFolders: job.aggregator.totalFolders,
      totalSizeBytes: job.aggregator.totalBytes,
      physicalSizeBytes: job.aggregator.physicalBytes,
      directFiles: job.directFiles,
      directFolders: job.directFolders,
      directSizeBytes: job.directSizeBytes,
      scanDurationMs: now - job.startTime,
      status: 'SCANNING',
    });
    lastProgressTick = now;
  };

  try {
    // Mark root directory in cycle detector
    try {
      const rootStat = await fs.stat(job.rootPath);
      job.cycleDetector.checkAndMark(rootStat.dev, rootStat.ino, job.rootPath);
    } catch {
      // If root stat fails, still attempt readdir
    }

    // 1. Enumerate root directly first to capture direct items
    let rootEntries;
    try {
      rootEntries = await fs.readdir(job.rootPath, { withFileTypes: true });
    } catch (err: any) {
      job.inaccessiblePaths.push({
        path: job.rootPath,
        errorCode: err.code || 'EACCES',
        message: err.message,
      });
      finalize(job, 'RESTRICTED');
      return;
    }

    const subdirectoriesToVisit: { fullPath: string; directSubfolderName: string }[] = [];

    for (const entry of rootEntries) {
      if (job.cancelled) break;
      const fullPath = path.join(job.rootPath, entry.name);
      const isHidden = entry.name.startsWith('.');

      if (entry.isDirectory()) {
        job.directFolders += 1;
        job.aggregator.addFolder(entry.name, fullPath, true, isHidden);

        // Do not traverse symlinks by default; check cycle detector
        if (!entry.isSymbolicLink()) {
          try {
            const stat = await fs.stat(fullPath);
            const isCycle = job.cycleDetector.checkAndMark(stat.dev, stat.ino, fullPath);
            if (!isCycle) {
              subdirectoriesToVisit.push({ fullPath, directSubfolderName: entry.name });
            }
          } catch {
            // Cannot stat subfolder
          }
        }
      } else if (entry.isFile()) {
        try {
          const stats = await fs.stat(fullPath);
          job.directFiles += 1;
          job.directSizeBytes += stats.size;
          job.aggregator.addFile(entry.name, fullPath, stats.size, isHidden);
        } catch {
          // Skip inaccessible file
        }
      }
    }

    emitProgress();

    // 2. Traverse subdirectories
    for (const sub of subdirectoriesToVisit) {
      if (job.cancelled) break;
      await traverseFolder(job, sub.fullPath, sub.directSubfolderName, () => {
        if (Date.now() - lastProgressTick > 50) {
          emitProgress();
        }
      });
    }

    if (job.cancelled) {
      finalize(job, 'CANCELLED');
    } else if (job.inaccessiblePaths.length > 0) {
      finalize(job, 'RESTRICTED');
    } else {
      finalize(job, 'COMPLETED');
    }
  } catch (err: any) {
    if (job.cancelled) {
      finalize(job, 'CANCELLED');
    } else {
      finalize(job, 'RESTRICTED');
    }
  }
}

async function traverseFolder(
  job: ScanJob,
  dirPath: string,
  directSubfolderName: string,
  onProgressTick: () => void
): Promise<void> {
  if (job.cancelled) return;

  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch (err: any) {
    job.inaccessiblePaths.push({
      path: dirPath,
      errorCode: err.code || 'EACCES',
      message: err.message,
    });
    return;
  }

  if (entries.length === 0) {
    job.aggregator.incrementEmptyFolders();
  }

  for (const entry of entries) {
    if (job.cancelled) return;
    const fullPath = path.join(dirPath, entry.name);
    const isHidden = entry.name.startsWith('.');

    if (entry.isDirectory()) {
      job.aggregator.addFolder(entry.name, fullPath, false, isHidden);

      if (!entry.isSymbolicLink()) {
        try {
          const stat = await fs.stat(fullPath);
          const isCycle = job.cycleDetector.checkAndMark(stat.dev, stat.ino, fullPath);
          if (!isCycle) {
            await traverseFolder(job, fullPath, directSubfolderName, onProgressTick);
          }
        } catch {
          // Skip unreadable directory
        }
      }
    } else if (entry.isFile()) {
      try {
        const stats = await fs.stat(fullPath);
        job.aggregator.addFile(entry.name, fullPath, stats.size, isHidden);
        job.aggregator.addBytesToDirectSubfolder(directSubfolderName, stats.size);
      } catch {
        // Ignored unreadable file
      }
    }

    onProgressTick();
  }
}

function finalize(job: ScanJob, status: FolderStats['status']) {
  if (!parentPort) return;
  const now = Date.now();
  const totalSizeBytes = job.aggregator.totalBytes;

  const result: FolderStats & { scanId: string } = {
    scanId: job.scanId,
    path: job.rootPath,
    directFiles: job.directFiles,
    directFolders: job.directFolders,
    directSizeBytes: job.directSizeBytes,
    totalFiles: job.aggregator.totalFiles,
    totalFolders: job.aggregator.totalFolders,
    totalSizeBytes,
    physicalSizeBytes: job.aggregator.physicalBytes,
    emptyFolders: job.aggregator.emptyFolders,
    hiddenCount: job.aggregator.hiddenCount,
    largestFiles: job.aggregator.getLargestFiles(),
    largestFolders: job.aggregator.getLargestSubfolders(job.rootPath),
    typeBreakdown: job.aggregator.getTypeBreakdown(),
    scanDurationMs: now - job.startTime,
    status,
    inaccessiblePaths: job.inaccessiblePaths,
  };

  parentPort.postMessage({
    type: 'COMPLETED',
    data: result,
  });

  if (activeJob === job) {
    activeJob = null;
  }
}
