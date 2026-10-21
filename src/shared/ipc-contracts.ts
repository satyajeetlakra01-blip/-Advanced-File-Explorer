import {
  DriveInfo,
  DirectoryListing,
  FolderStats,
  FileOperationMode,
  FileOperationProgress,
  FileCollision,
  CollisionResolution,
} from './types';

export const IPC_CHANNELS = {
  NAV_GET_DRIVES: 'nav:get-drives',
  NAV_READ_DIR: 'nav:read-dir',
  NAV_GET_QUICK_ACCESS: 'nav:get-quick-access',
  NAV_CREATE_FOLDER: 'nav:create-folder',
  INSPECTOR_START_SCAN: 'inspector:start-scan',
  INSPECTOR_CANCEL_SCAN: 'inspector:cancel-scan',
  INSPECTOR_GET_CACHE: 'inspector:get-cache',
  INSPECTOR_PROGRESS: 'inspector:progress',
  INSPECTOR_COMPLETED: 'inspector:completed',
  OPS_RENAME: 'ops:rename',
  OPS_DELETE_RECYCLE_BIN: 'ops:delete-recycle-bin',
  OPS_DELETE_PERMANENT: 'ops:delete-permanent',
  OPS_CHECK_COLLISIONS: 'ops:check-collisions',
  OPS_EXECUTE_TRANSFER: 'ops:execute-transfer',
  OPS_CANCEL_TRANSFER: 'ops:cancel-transfer',
  OPS_PROGRESS: 'ops:progress',
  SEARCH_START: 'search:start',
  SEARCH_CANCEL: 'search:cancel',
  SEARCH_PROGRESS: 'search:progress',
  SEARCH_COMPLETED: 'search:completed',
  PREVIEW_GET_CONTENT: 'preview:get-content',
  SHELL_OPEN_PATH: 'shell:open-path',
  SHELL_SHOW_IN_FOLDER: 'shell:show-in-folder',
  SHELL_START_DRAG: 'shell:start-drag',
  SHELL_STAT_FILE: 'shell:stat-file',
  APP_GET_THEME: 'app:get-theme',
  FILE_READ_TEXT: 'file:read-text',
  FILE_WRITE_TEXT: 'file:write-text',
  CODE_RUN_SANDBOX: 'sandbox:run-code',
} as const;

export interface CodeExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
  durationMs: number;
  exitCode: number;
  result?: any;
  error?: string;
}

export interface IpcApi {
  getDrives(): Promise<DriveInfo[]>;
  readDir(path: string, options?: { showHidden?: boolean; bypassCache?: boolean }): Promise<DirectoryListing>;
  getQuickAccess(): Promise<{ name: string; path: string; icon: string }[]>;
  createFolder(parentPath: string, folderName: string): Promise<{ success: boolean; path?: string; error?: string }>;
  startFolderScan(folderPath: string): Promise<string>;
  cancelFolderScan(scanId: string): Promise<boolean>;
  getFolderStats(folderPath: string): Promise<FolderStats | null>;
  onInspectorProgress(callback: (stats: Partial<FolderStats> & { scanId: string }) => void): () => void;
  onInspectorCompleted(callback: (stats: FolderStats & { scanId: string }) => void): () => void;
  startSearch(query: any): Promise<string>;
  cancelSearch(searchId: string): Promise<boolean>;
  onSearchProgress(callback: (matches: any[]) => void): () => void;
  onSearchCompleted(callback: (result: { totalMatches: number; durationMs: number }) => void): () => void;
  getPreview(filePath: string): Promise<any>;
  renameItem(oldPath: string, newName: string): Promise<{ success: boolean; newPath?: string; error?: string }>;
  deleteToRecycleBin(paths: string[]): Promise<{ success: boolean; error?: string }>;
  deletePermanently(paths: string[]): Promise<{ success: boolean; error?: string }>;
  checkCollisions(sources: string[], destination: string): Promise<FileCollision[]>;
  executeTransfer(
    sources: string[],
    destination: string,
    mode: FileOperationMode,
    resolutionMap?: Record<string, CollisionResolution>,
    opId?: string
  ): Promise<{ success: boolean; transferred: number; cancelled?: boolean; error?: string }>;
  cancelTransfer(opId: string): Promise<boolean>;
  onOperationProgress(callback: (progress: FileOperationProgress) => void): () => void;
  openPath(path: string): Promise<string>;
  showInFolder(path: string): Promise<void>;
  startExternalDrag(paths: string[]): void;
  getPathForFile?(file: File): string;
  statFile(filePath: string): Promise<{ sizeBytes: number; modifiedMs: number } | null>;
  readTextFile(filePath: string): Promise<{ success: boolean; content?: string; sizeBytes?: number; modifiedMs?: number; error?: string }>;
  writeTextFile(filePath: string, content: string): Promise<{ success: boolean; sizeBytes?: number; modifiedMs?: number; error?: string }>;
  runCodeSandbox(params: { code: string; language: string; filePath?: string }): Promise<CodeExecutionResult>;
}

declare global {
  interface Window {
    electronApi: IpcApi;
  }
}
