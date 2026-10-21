import { contextBridge, ipcRenderer, webUtils } from 'electron';
import { IPC_CHANNELS, IpcApi } from '../shared/ipc-contracts';
import {
  DriveInfo,
  DirectoryListing,
  FolderStats,
  FileOperationMode,
  FileOperationProgress,
  CollisionResolution,
} from '../shared/types';

const api: IpcApi = {
  getDrives: () => ipcRenderer.invoke(IPC_CHANNELS.NAV_GET_DRIVES),
  readDir: (path: string, options) => ipcRenderer.invoke(IPC_CHANNELS.NAV_READ_DIR, path, options),
  getQuickAccess: () => ipcRenderer.invoke(IPC_CHANNELS.NAV_GET_QUICK_ACCESS),
  createFolder: (parentPath: string, folderName: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.NAV_CREATE_FOLDER, parentPath, folderName),
  startFolderScan: (folderPath: string) => ipcRenderer.invoke(IPC_CHANNELS.INSPECTOR_START_SCAN, folderPath),
  cancelFolderScan: (scanId: string) => ipcRenderer.invoke(IPC_CHANNELS.INSPECTOR_CANCEL_SCAN, scanId),
  getFolderStats: (folderPath: string) => ipcRenderer.invoke(IPC_CHANNELS.INSPECTOR_GET_CACHE, folderPath),
  
  onInspectorProgress: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, data: Partial<FolderStats> & { scanId: string }) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.INSPECTOR_PROGRESS, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.INSPECTOR_PROGRESS, handler);
    };
  },

  onInspectorCompleted: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, data: FolderStats & { scanId: string }) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.INSPECTOR_COMPLETED, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.INSPECTOR_COMPLETED, handler);
    };
  },

  renameItem: (oldPath: string, newName: string) => ipcRenderer.invoke(IPC_CHANNELS.OPS_RENAME, oldPath, newName),
  deleteToRecycleBin: (paths: string[]) => ipcRenderer.invoke(IPC_CHANNELS.OPS_DELETE_RECYCLE_BIN, paths),
  deletePermanently: (paths: string[]) => ipcRenderer.invoke(IPC_CHANNELS.OPS_DELETE_PERMANENT, paths),
  checkCollisions: (sources: string[], destination: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.OPS_CHECK_COLLISIONS, sources, destination),
  executeTransfer: (
    sources: string[],
    destination: string,
    mode: FileOperationMode,
    resolutionMap?: Record<string, CollisionResolution>,
    opId?: string
  ) => ipcRenderer.invoke(IPC_CHANNELS.OPS_EXECUTE_TRANSFER, sources, destination, mode, resolutionMap, opId),
  cancelTransfer: (opId: string) => ipcRenderer.invoke(IPC_CHANNELS.OPS_CANCEL_TRANSFER, opId),

  onOperationProgress: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, data: FileOperationProgress) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.OPS_PROGRESS, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.OPS_PROGRESS, handler);
    };
  },

  startSearch: (query) => ipcRenderer.invoke(IPC_CHANNELS.SEARCH_START, query),
  cancelSearch: (searchId) => ipcRenderer.invoke(IPC_CHANNELS.SEARCH_CANCEL, searchId),
  onSearchProgress: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, matches: any[]) => callback(matches);
    ipcRenderer.on(IPC_CHANNELS.SEARCH_PROGRESS, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.SEARCH_PROGRESS, handler);
    };
  },
  onSearchCompleted: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, result: { totalMatches: number; durationMs: number }) =>
      callback(result);
    ipcRenderer.on(IPC_CHANNELS.SEARCH_COMPLETED, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.SEARCH_COMPLETED, handler);
    };
  },
  getPreview: (filePath) => ipcRenderer.invoke(IPC_CHANNELS.PREVIEW_GET_CONTENT, filePath),

  openPath: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.SHELL_OPEN_PATH, path),
  showInFolder: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.SHELL_SHOW_IN_FOLDER, path),

  readTextFile: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.FILE_READ_TEXT, filePath),
  writeTextFile: (filePath: string, content: string) => ipcRenderer.invoke(IPC_CHANNELS.FILE_WRITE_TEXT, filePath, content),
  runCodeSandbox: (params: { code: string; language: string; filePath?: string }) => ipcRenderer.invoke(IPC_CHANNELS.CODE_RUN_SANDBOX, params),
  startExternalDrag: (paths: string[]) => ipcRenderer.send(IPC_CHANNELS.SHELL_START_DRAG, paths),
  getPathForFile: (file: File) => {
    try {
      if (webUtils && typeof webUtils.getPathForFile === 'function') {
        return webUtils.getPathForFile(file);
      }
    } catch {}
    return (file as any)?.path || '';
  },
  statFile: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.SHELL_STAT_FILE, filePath),
};

contextBridge.exposeInMainWorld('electronApi', api);
