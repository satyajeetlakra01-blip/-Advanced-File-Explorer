import { Worker } from 'worker_threads';
import { BrowserWindow } from 'electron';
import * as path from 'path';
import { IPC_CHANNELS } from '../../shared/ipc-contracts';
import { FolderStats } from '../../shared/types';

export class InspectorService {
  private worker: Worker | null = null;
  private currentScanId: string | null = null;
  private statsCache: Map<string, { stats: FolderStats; cachedAt: number }> = new Map();
  private maxCacheEntries = 50;
  private mainWindow: BrowserWindow | null = null;

  constructor(workerPath?: string) {
    if (workerPath) {
      this.initWorker(workerPath);
    }
  }

  setWindow(window: BrowserWindow) {
    this.mainWindow = window;
  }

  private initWorker(workerPath: string) {
    try {
      this.worker = new Worker(workerPath);

      this.worker.on('message', (msg: any) => {
        if (!this.mainWindow || this.mainWindow.isDestroyed()) return;

        if (msg.type === 'PROGRESS') {
          this.mainWindow.webContents.send(IPC_CHANNELS.INSPECTOR_PROGRESS, {
            ...msg,
            scanId: msg.scanId,
          });
        } else if (msg.type === 'COMPLETED') {
          const stats: FolderStats = msg.data;
          this.setCachedStats(stats.path, stats);
          this.mainWindow.webContents.send(IPC_CHANNELS.INSPECTOR_COMPLETED, stats);
          this.currentScanId = null;
        }
      });

      this.worker.on('error', (err) => {
        console.error('[InspectorService] Worker error:', err);
      });

      this.worker.on('exit', (code) => {
        if (code !== 0) {
          console.warn(`[InspectorService] Worker stopped with exit code ${code}`);
        }
      });
    } catch (err) {
      console.error('[InspectorService] Failed to initialize worker:', err);
    }
  }

  startScan(folderPath: string): string {
    const scanId = `scan-${Date.now()}`;
    this.currentScanId = scanId;

    if (this.worker) {
      this.worker.postMessage({
        action: 'START',
        scanId,
        path: folderPath,
      });
    }

    return scanId;
  }

  cancelScan(scanId: string): boolean {
    if (this.worker && this.currentScanId === scanId) {
      this.worker.postMessage({
        action: 'CANCEL',
        scanId,
      });
      this.currentScanId = null;
      return true;
    }
    return false;
  }

  setCachedStats(folderPath: string, stats: FolderStats) {
    const normalized = path.normalize(folderPath).toLowerCase();
    // Maintain LRU order: delete if exists then set at end
    if (this.statsCache.has(normalized)) {
      this.statsCache.delete(normalized);
    } else if (this.statsCache.size >= this.maxCacheEntries) {
      // Evict oldest entry (first item in Map iterator)
      const oldestKey = this.statsCache.keys().next().value;
      if (oldestKey) {
        this.statsCache.delete(oldestKey);
      }
    }

    this.statsCache.set(normalized, {
      stats,
      cachedAt: Date.now(),
    });
  }

  getCachedStats(folderPath: string): FolderStats | null {
    const normalized = path.normalize(folderPath).toLowerCase();
    const entry = this.statsCache.get(normalized);
    if (!entry) return null;

    // Refresh LRU recency
    this.statsCache.delete(normalized);
    this.statsCache.set(normalized, entry);
    return entry.stats;
  }

  invalidate(folderPath: string): void {
    const normalized = path.normalize(folderPath).toLowerCase();
    for (const key of Array.from(this.statsCache.keys())) {
      // Invalidate if key matches, or is parent/child of the modified path
      if (key === normalized || key.startsWith(normalized) || normalized.startsWith(key)) {
        this.statsCache.delete(key);
      }
    }
  }

  invalidateAll(): void {
    this.statsCache.clear();
  }

  getCacheSize(): number {
    return this.statsCache.size;
  }

  destroy() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}
