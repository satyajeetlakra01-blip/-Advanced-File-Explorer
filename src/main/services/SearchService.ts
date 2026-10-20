import { Worker } from 'worker_threads';
import { BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-contracts';
import { SearchQuery } from '../../shared/types';

export class SearchService {
  private worker: Worker | null = null;
  private currentSearchId: string | null = null;
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

        if (msg.type === 'MATCHES') {
          this.mainWindow.webContents.send(IPC_CHANNELS.SEARCH_PROGRESS, msg.matches);
        } else if (msg.type === 'COMPLETED') {
          this.mainWindow.webContents.send(IPC_CHANNELS.SEARCH_COMPLETED, {
            totalMatches: msg.totalMatches,
            durationMs: msg.durationMs,
            cancelled: msg.cancelled,
          });
          this.currentSearchId = null;
        }
      });

      this.worker.on('error', (err) => {
        console.error('[SearchService] Worker error:', err);
      });

      this.worker.on('exit', (code) => {
        if (code !== 0) {
          console.warn(`[SearchService] Worker exited with code ${code}`);
        }
      });
    } catch (err) {
      console.error('[SearchService] Failed to initialize worker:', err);
    }
  }

  startSearch(query: SearchQuery): string {
    const searchId = `search-${Date.now()}`;
    this.currentSearchId = searchId;

    if (this.worker) {
      this.worker.postMessage({
        action: 'START',
        searchId,
        query,
      });
    }

    return searchId;
  }

  cancelSearch(searchId: string): boolean {
    if (this.worker && this.currentSearchId === searchId) {
      this.worker.postMessage({
        action: 'CANCEL',
        searchId,
      });
      this.currentSearchId = null;
      return true;
    }
    return false;
  }

  destroy() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}
