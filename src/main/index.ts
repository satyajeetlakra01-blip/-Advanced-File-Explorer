import { app, BrowserWindow, ipcMain, shell, protocol, net } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import { spawn } from 'child_process';
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
    icon: path.resolve(__dirname, '../../assets/icon.ico'),
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

  // External OS drag-out: drag files from app to Explorer/Chrome/Desktop etc.
  // Uses ipcMain.on (synchronous) because webContents.startDrag must be called in the ondragstart handler.
  ipcMain.on(IPC_CHANNELS.SHELL_START_DRAG, (event, filePaths: string[]) => {
    if (!filePaths || filePaths.length === 0) return;
    try {
      const firstFile = filePaths[0];
      const iconPath = path.resolve(__dirname, '../../assets/drag-icon.png');
      if (filePaths.length === 1) {
        event.sender.startDrag({
          file: firstFile,
          icon: iconPath,
        });
      } else {
        // Multi-file: Electron accepts `files` array (Electron 12+), cast to bypass older typedefs
        (event.sender as any).startDrag({
          file: firstFile,
          files: filePaths,
          icon: iconPath,
        });
      }
    } catch (err) {
      console.error('[startExternalDrag] error:', err);
    }
  });

  // Stat a single file (for preview header metadata)
  ipcMain.handle(IPC_CHANNELS.SHELL_STAT_FILE, async (_event, filePath: string) => {
    try {
      const stat = await fs.stat(filePath);
      return { sizeBytes: stat.size, modifiedMs: stat.mtimeMs };
    } catch {
      return null;
    }
  });

  // Code Sandbox: Full text reading for code editor
  ipcMain.handle(IPC_CHANNELS.FILE_READ_TEXT, async (_event, filePath: string) => {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const stat = await fs.stat(filePath);
      return {
        success: true,
        content,
        sizeBytes: stat.size,
        modifiedMs: stat.mtimeMs,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // Code Sandbox: Save edited file
  ipcMain.handle(IPC_CHANNELS.FILE_WRITE_TEXT, async (_event, filePath: string, content: string) => {
    try {
      await fs.writeFile(filePath, content, 'utf-8');
      const stat = await fs.stat(filePath);
      inspectorService.invalidate(filePath);
      return {
        success: true,
        sizeBytes: stat.size,
        modifiedMs: stat.mtimeMs,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // Code Sandbox: Execution & Debugging runner
  ipcMain.handle(IPC_CHANNELS.CODE_RUN_SANDBOX, async (_event, { code, language, filePath }: { code: string; language: string; filePath?: string }) => {
    const startTime = Date.now();
    const workingDir = filePath ? path.dirname(filePath) : process.cwd();

    return new Promise((resolve) => {
      let cmd = '';
      let args: string[] = [];

      const langLower = (language || '').toLowerCase();
      if (['javascript', 'js', 'typescript', 'ts', 'jsx', 'tsx', 'node'].includes(langLower)) {
        if (filePath && !code) {
          cmd = 'node';
          args = [filePath];
        } else {
          cmd = 'node';
          args = ['-e', code];
        }
      } else if (['python', 'py'].includes(langLower)) {
        cmd = 'python';
        if (filePath && !code) {
          args = [filePath];
        } else {
          args = ['-c', code];
        }
      } else if (['powershell', 'ps1'].includes(langLower)) {
        cmd = 'powershell';
        args = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', code];
      } else if (['batch', 'bat', 'cmd'].includes(langLower)) {
        cmd = 'cmd.exe';
        args = ['/c', code];
      } else {
        cmd = 'node';
        args = ['-e', code];
      }

      let stdout = '';
      let stderr = '';
      let proc: any;

      try {
        proc = spawn(cmd, args, {
          cwd: workingDir,
          shell: true,
          env: { ...process.env, FORCE_COLOR: '0' },
        });
      } catch (err: any) {
        return resolve({
          success: false,
          stdout: '',
          stderr: `Failed to spawn process (${cmd}): ${err.message}`,
          durationMs: Date.now() - startTime,
          exitCode: 1,
          error: err.message,
        });
      }

      const timer = setTimeout(() => {
        try {
          proc.kill();
        } catch {}
        resolve({
          success: false,
          stdout,
          stderr: stderr ? `${stderr}\n[Execution timed out after 10s]` : '[Execution timed out after 10s]',
          durationMs: Date.now() - startTime,
          exitCode: 124,
        });
      }, 10000);

      proc.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
        if (stdout.length > 50000) {
          stdout = stdout.slice(0, 50000) + '\n[Output truncated...]';
        }
      });

      proc.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
        if (stderr.length > 50000) {
          stderr = stderr.slice(0, 50000) + '\n[Errors truncated...]';
        }
      });

      proc.on('error', (err: any) => {
        clearTimeout(timer);
        resolve({
          success: false,
          stdout,
          stderr: stderr ? `${stderr}\n${err.message}` : err.message,
          durationMs: Date.now() - startTime,
          exitCode: 1,
          error: err.message,
        });
      });

      proc.on('close', (code: number) => {
        clearTimeout(timer);
        resolve({
          success: code === 0,
          stdout,
          stderr,
          durationMs: Date.now() - startTime,
          exitCode: code ?? 0,
        });
      });
    });
  });
}

// Ensure single instance lock so repeated launches focus existing window
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

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

        if (!targetPath || !fsSync.existsSync(targetPath)) {
          return new Response('File not found', { status: 404 });
        }

        const stat = fsSync.statSync(targetPath);
        if (stat.isDirectory()) {
          return new Response('Cannot stream directory', { status: 400 });
        }

        const fileSize = stat.size;
        const ext = path.extname(targetPath).toLowerCase().replace(/^\./, '');
        const MIME_MAP: Record<string, string> = {
          mp4: 'video/mp4',
          webm: 'video/webm',
          mov: 'video/quicktime',
          avi: 'video/x-msvideo',
          mkv: 'video/x-matroska',
          m4v: 'video/mp4',
          flv: 'video/x-flv',
          wmv: 'video/x-ms-wmv',
          mp3: 'audio/mpeg',
          wav: 'audio/wav',
          ogg: 'audio/ogg',
          flac: 'audio/flac',
          aac: 'audio/aac',
          m4a: 'audio/mp4',
          opus: 'audio/opus',
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          png: 'image/png',
          gif: 'image/gif',
          webp: 'image/webp',
          svg: 'image/svg+xml',
          ico: 'image/x-icon',
          avif: 'image/avif',
          pdf: 'application/pdf',
        };
        const mimeType = MIME_MAP[ext] || 'application/octet-stream';
        const rangeHeader = request.headers.get('range');

        // Handle HTTP Range header for smooth video seeking & partial streaming
        if (rangeHeader) {
          const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
          if (match) {
            let start = match[1] ? parseInt(match[1], 10) : 0;
            let end = match[2] ? parseInt(match[2], 10) : fileSize - 1;

            if (isNaN(start)) start = 0;
            if (isNaN(end) || end >= fileSize) end = fileSize - 1;

            if (start > end || start >= fileSize) {
              return new Response(null, {
                status: 416,
                headers: {
                  'Content-Range': `bytes */${fileSize}`,
                },
              });
            }

            const chunkSize = end - start + 1;
            const fileStream = fsSync.createReadStream(targetPath, { start, end });
            const readableStream = new ReadableStream({
              start(controller) {
                fileStream.on('data', (chunk) => controller.enqueue(chunk));
                fileStream.on('end', () => controller.close());
                fileStream.on('error', (err) => controller.error(err));
              },
              cancel() {
                fileStream.destroy();
              },
            });

            return new Response(readableStream, {
              status: 206,
              headers: {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunkSize.toString(),
                'Content-Type': mimeType,
              },
            });
          }
        }

        // Standard full file response
        const fileStream = fsSync.createReadStream(targetPath);
        const readableStream = new ReadableStream({
          start(controller) {
            fileStream.on('data', (chunk) => controller.enqueue(chunk));
            fileStream.on('end', () => controller.close());
            fileStream.on('error', (err) => controller.error(err));
          },
          cancel() {
            fileStream.destroy();
          },
        });

        return new Response(readableStream, {
          status: 200,
          headers: {
            'Accept-Ranges': 'bytes',
            'Content-Length': fileSize.toString(),
            'Content-Type': mimeType,
          },
        });
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
}

