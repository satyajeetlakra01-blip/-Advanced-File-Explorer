import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { DirectoryListing, FileItem } from '../../shared/types';

export class NavigationService {
  private cache: Map<string, { timestamp: number; data: DirectoryListing }> = new Map();
  private cacheTtlMs = 1500; // 1.5 second cache to make back/forward instantaneous

  normalizePath(targetPath: string): string {
    if (!targetPath) return os.homedir();
    let resolved = targetPath.replace(/%([^%]+)%/g, (_, n) => process.env[n] || '');
    const trimmed = resolved.trim();
    if (/^[a-zA-Z]:\\?$/.test(trimmed)) {
      return trimmed.charAt(0).toUpperCase() + ':\\';
    }
    resolved = path.win32.normalize(trimmed);
    if (/^[a-zA-Z]:\.$/.test(resolved) || /^[a-zA-Z]:$/.test(resolved)) {
      resolved = resolved.charAt(0).toUpperCase() + ':\\';
    }
    return resolved;
  }

  async readDirectory(
    dirPath: string,
    options: { showHidden?: boolean; bypassCache?: boolean } = {}
  ): Promise<DirectoryListing> {
    const cleanPath = this.normalizePath(dirPath);

    if (!options.bypassCache) {
      const cached = this.cache.get(cleanPath);
      if (cached && Date.now() - cached.timestamp < this.cacheTtlMs) {
        return cached.data;
      }
    }

    const parentPath = path.dirname(cleanPath) === cleanPath ? null : path.dirname(cleanPath);

    let entries;
    try {
      entries = await fs.readdir(cleanPath, { withFileTypes: true });
    } catch (err: any) {
      throw new Error(`Failed to read directory '${cleanPath}': ${err.message}`);
    }

    const items: FileItem[] = [];
    let folderCount = 0;
    let fileCount = 0;
    let totalSizeBytes = 0;

    for (const entry of entries) {
      const isHidden = entry.name.startsWith('.');
      if (!options.showHidden && isHidden) continue;

      const fullPath = path.join(cleanPath, entry.name);
      let sizeBytes = 0;
      let modifiedMs = 0;
      let createdMs = 0;

      const isDir = entry.isDirectory();
      const isFile = entry.isFile();
      const isSymlink = entry.isSymbolicLink();

      try {
        const stats = await fs.stat(fullPath);
        sizeBytes = isFile ? stats.size : 0;
        modifiedMs = stats.mtimeMs;
        createdMs = stats.birthtimeMs;
      } catch {
        // Inaccessible file stat
      }

      const ext = isFile ? path.extname(entry.name).replace('.', '').toUpperCase() : '';
      const typeDescription = isDir
        ? 'File folder'
        : ext
        ? `${ext} File`
        : 'File';

      if (isDir) folderCount += 1;
      if (isFile) {
        fileCount += 1;
        totalSizeBytes += sizeBytes;
      }

      items.push({
        name: entry.name,
        path: fullPath,
        isDirectory: isDir,
        isFile,
        isSymbolicLink: isSymlink,
        isHidden,
        isSystem: false,
        sizeBytes,
        modifiedMs,
        createdMs,
        extension: ext,
        typeDescription,
      });
    }

    // Default sorting: Folders first, then alphabetical by name
    items.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });

    const listing: DirectoryListing = {
      currentPath: cleanPath,
      parentPath,
      items,
      totalCount: items.length,
      folderCount,
      fileCount,
      totalSizeBytes,
    };

    this.cache.set(cleanPath, { timestamp: Date.now(), data: listing });
    return listing;
  }

  async createFolder(parentPath: string, folderName: string): Promise<string> {
    const cleanParent = this.normalizePath(parentPath);
    const target = path.join(cleanParent, folderName);
    await fs.mkdir(target);
    this.cache.delete(cleanParent);
    return target;
  }

  getQuickAccess(): { name: string; path: string; icon: string }[] {
    const home = os.homedir();
    return [
      { name: 'Home', path: home, icon: 'home' },
      { name: 'Desktop', path: path.join(home, 'Desktop'), icon: 'desktop' },
      { name: 'Documents', path: path.join(home, 'Documents'), icon: 'document' },
      { name: 'Downloads', path: path.join(home, 'Downloads'), icon: 'download' },
      { name: 'Pictures', path: path.join(home, 'Pictures'), icon: 'image' },
      { name: 'Videos', path: path.join(home, 'Videos'), icon: 'video' },
      { name: 'Music', path: path.join(home, 'Music'), icon: 'music' },
    ];
  }
}
