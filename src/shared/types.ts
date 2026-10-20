export type ScanStatus =
  | 'IDLE'
  | 'SCANNING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'RESTRICTED'
  | 'STALE';

export type TypeCategory =
  | 'Documents'
  | 'Media'
  | 'Archives'
  | 'Code'
  | 'Executables'
  | 'Other';

export interface TypeBreakdownItem {
  category: TypeCategory;
  sizeBytes: number;
  fileCount: number;
  percentage: number;
}

export interface LargestItem {
  name: string;
  path: string;
  sizeBytes: number;
  isDirectory: boolean;
}

export interface InaccessiblePath {
  path: string;
  errorCode: string;
  message: string;
}

export interface DriveInfo {
  letter: string;
  mountPoint: string;
  label: string;
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  percentUsed: number;
  isRemovable: boolean;
}

export interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  isFile: boolean;
  isSymbolicLink: boolean;
  isHidden: boolean;
  isSystem: boolean;
  sizeBytes: number;
  modifiedMs: number;
  createdMs: number;
  extension: string;
  typeDescription: string;
}

export interface DirectoryListing {
  currentPath: string;
  parentPath: string | null;
  items: FileItem[];
  totalCount: number;
  folderCount: number;
  fileCount: number;
  totalSizeBytes: number;
}

export interface FolderStats {
  path: string;
  directFiles: number;
  directFolders: number;
  directSizeBytes: number;
  totalFiles: number;
  totalFolders: number;
  totalSizeBytes: number;
  physicalSizeBytes: number;
  emptyFolders: number;
  hiddenCount: number;
  largestFiles: LargestItem[];
  largestFolders: LargestItem[];
  typeBreakdown: TypeBreakdownItem[];
  scanDurationMs: number;
  status: ScanStatus;
  inaccessiblePaths: InaccessiblePath[];
}

export type SortField = 'name' | 'size' | 'modified' | 'type';
export type SortDirection = 'asc' | 'desc';
export type ViewMode = 'details' | 'grid' | 'compact';

export type FileOperationMode = 'COPY' | 'MOVE';
export type CollisionResolution = 'OVERWRITE' | 'SKIP' | 'AUTO_RENAME';

export interface FileCollision {
  sourcePath: string;
  destinationPath: string;
  fileName: string;
  sourceSizeBytes: number;
  sourceModifiedMs: number;
  destSizeBytes: number;
  destModifiedMs: number;
}

export interface ClipboardData {
  paths: string[];
  mode: FileOperationMode;
}

export interface FileOperationProgress {
  opId: string;
  mode: FileOperationMode;
  currentFile: string;
  currentIndex: number;
  totalFiles: number;
  transferredBytes: number;
  totalBytes: number;
  percentComplete: number;
}

export interface HistoryEntry {
  path: string;
  timestamp: number;
}

export type PaneId = 'left' | 'right';

export interface TabState {
  id: string;
  title: string;
  currentPath: string;
  history: string[];
  historyIndex: number;
  items: FileItem[];
  selectedPaths: Set<string>;
  filterQuery: string;
  sortField: SortField;
  sortDirection: SortDirection;
  viewMode: ViewMode;
  zoomLevel: number;
}

export interface PaneState {
  id: PaneId;
  tabs: TabState[];
  activeTabId: string;
}

export interface SearchQuery {
  rootPath: string;
  query: string;
  extension?: string;
  minSizeBytes?: number;
  maxSizeBytes?: number;
  modifiedAfterMs?: number;
}

export interface SearchMatch {
  name: string;
  path: string;
  isDirectory: boolean;
  sizeBytes: number;
  modifiedMs: number;
}

export type PreviewType = 'text' | 'image' | 'audio' | 'video' | 'pdf' | 'binary';

export interface PreviewContent {
  path: string;
  name: string;
  type: PreviewType;
  content?: string;
  sizeBytes: number;
  mimeType: string;
  lineCount?: number;
  isTruncated?: boolean;
}

