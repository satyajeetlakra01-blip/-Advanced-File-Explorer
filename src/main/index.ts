import { app, BrowserWindow, ipcMain, shell, protocol, net } from 'electron';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { IPC_CHANNELS } from '../shared/ipc-contracts';
import { DriveService } from './services/DriveService';
import { NavigationService } from './services/NavigationService';
import { FileOperationsService } from './services/FileOperationsService';
import { InspectorService } from './services/InspectorService';
import { SearchService } from './services/SearchService';
import { PreviewService } from './services/PreviewService';

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'afe-media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true,
    },
  },
]);

let mainWindow: BrowserWindow | null = null;

const driveService = new DriveService();
const navService = new NavigationService();
const fileOpsService = new FileOperationsService();

// Worker path resolution
const workerPath = path.resolve(__dirname, '../workers/scanner.worker.cjs');
const inspectorService = new InspectorService(workerPath);

const searchWorkerPath = path.resolve(__dirname, '../workers/search.worker.cjs');
const searchService = new SearchService(searchWorkerPath);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0f131a',
    title: 'Advanced File Explorer',
    webPreferences: {
      preload: path.resolve(__dirname, '../preload/index.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webviewTag: true,
      plugins: true,
    },
  });

  inspectorService.setWindow(mainWindow);
  searchService.setWindow(mainWindow);

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(path.resolve(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function registerIpcHandlers() {
  // Navigation & Drives
  ipcMain.handle(IPC_CHANNELS.NAV_GET_DRIVES, async () => {
    return driveService.getDrives();
  });

  ipcMain.handle(IPC_CHANNELS.NAV_READ_DIR, async (_event, targetPath: string, options) => {
    return navService.readDirectory(targetPath, options);
  });

  ipcMain.handle(IPC_CHANNELS.NAV_GET_QUICK_ACCESS, async () => {
    return navService.getQuickAccess();
  });

  ipcMain.handle(IPC_CHANNELS.NAV_CREATE_FOLDER, async (_event, parentPath: string, folderName: string) => {
    try {
      const createdPath = await navService.createFolder(parentPath, folderName);
      inspectorService.invalidate(parentPath);
      return { success: true, path: createdPath };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // Folder Inspector
  ipcMain.handle(IPC_CHANNELS.INSPECTOR_START_SCAN, async (_event, folderPath: string) => {
    return inspectorService.startScan(folderPath);
  });

  ipcMain.handle(IPC_CHANNELS.INSPECTOR_CANCEL_SCAN, async (_event, scanId: string) => {
    return inspectorService.cancelScan(scanId);
  });

  ipcMain.handle(IPC_CHANNELS.INSPECTOR_GET_CACHE, async (_event, folderPath: string) => {
    return inspectorService.getCachedStats(folderPath);
  });

  // Safe File Operations
  ipcMain.handle(IPC_CHANNELS.OPS_RENAME, async (_event, oldPath: string, newName: string) => {
    const res = await fileOpsService.renameItem(oldPath, newName);
    if (res.success) {
      inspectorService.invalidate(oldPath);
    }
    return res;
  });

  ipcMain.handle(IPC_CHANNELS.OPS_DELETE_RECYCLE_BIN, async (_event, paths: string[]) => {
    const res = await fileOpsService.deleteToRecycleBin(paths);
    if (res.success) {
      for (const p of paths) inspectorService.invalidate(p);
    }
    return res;
  });

  ipcMain.handle(IPC_CHANNELS.OPS_DELETE_PERMANENT, async (_event, paths: string[]) => {
    const res = await fileOpsService.deletePermanently(paths);
    if (res.success) {
      for (const p of paths) inspectorService.invalidate(p);
    }
    return res;
  });

  ipcMain.handle(
    IPC_CHANNELS.OPS_CHECK_COLLISIONS,
    async (_event, sources: string[], destination: string) => {
      return fileOpsService.checkCollisions(sources, destination);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.OPS_EXECUTE_TRANSFER,
    async (_event, sources: string[], destination: string, mode: any, resolutionMap?: any, opId?: string) => {
      const res = await fileOpsService.executeTransfer(
        sources,
        destination,
        mode,
        resolutionMap,
        opId,
        (progress) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(IPC_CHANNELS.OPS_PROGRESS, progress);
          }
        }
      );
      if (res.success) {
        inspectorService.invalidate(destination);
        for (const src of sources) inspectorService.invalidate(src);
      }
      return res;
    }
  );

  ipcMain.handle(IPC_CHANNELS.OPS_CANCEL_TRANSFER, async (_event, opId: string) => {
    return fileOpsService.cancelTransfer(opId);
  });

  // Background Search
  ipcMain.handle(IPC_CHANNELS.SEARCH_START, async (_event, query: any) => {
    return searchService.startSearch(query);
  });

  ipcMain.handle(IPC_CHANNELS.SEARCH_CANCEL, async (_event, searchId: string) => {
    return searchService.cancelSearch(searchId);
  });

  // Sandboxed File Preview
  ipcMain.handle(IPC_CHANNELS.PREVIEW_GET_CONTENT, async (_event, filePath: string) => {
    return PreviewService.getPreview(filePath);
  });

  // Shell & Launching
  ipcMain.handle(IPC_CHANNELS.SHELL_OPEN_PATH, async (_event, targetPath: string) => {
    return shell.openPath(targetPath);
  });

  ipcMain.handle(IPC_CHANNELS.SHELL_SHOW_IN_FOLDER, async (_event, targetPath: string) => {
    shell.showItemInFolder(targetPath);
  });
}

app.whenReady().then(() => {
  protocol.handle('afe-media', (request) => {
    try {
      const url = new URL(request.url);
      let targetPath = url.searchParams.get('path');
      if (!targetPath) {
        const withoutScheme = request.url.replace(/^afe-media:\/\//i, '');
        let decoded = decodeURIComponent(withoutScheme);
        if (/^[a-zA-Z]\//.test(decoded)) {
          decoded = decoded.charAt(0) + ':/' + decoded.slice(2);
        } else if (/^\/[a-zA-Z]:/.test(decoded)) {
          decoded = decoded.slice(1);
        }
        targetPath = decoded;
      }
      return net.fetch(pathToFileURL(targetPath).toString());
    } catch (err) {
      console.error('Failed to stream media asset:', err);
      return new Response('Not found', { status: 404 });
    }
  });

  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  inspectorService.destroy();
  searchService.destroy();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
