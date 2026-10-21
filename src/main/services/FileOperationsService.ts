import * as fs from 'fs/promises';
import * as path from 'path';
import { shell } from 'electron';
import {
  FileOperationMode,
  FileCollision,
  CollisionResolution,
  FileOperationProgress,
} from '../../shared/types';

export class FileOperationsService {
  private invalidWindowsChars = /[<>:"/\\|?*\x00-\x1F]/;
  private activeOperations: Map<string, { cancelled: boolean; currentDestFile?: string }> = new Map();

  validateFilename(name: string): { valid: boolean; reason?: string } {
    if (!name || name.trim().length === 0) {
      return { valid: false, reason: 'Filename cannot be empty' };
    }
    if (this.invalidWindowsChars.test(name)) {
      return { valid: false, reason: 'Filename contains forbidden characters (< > : " / \\ | ? *)' };
    }
    const reservedNames = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;
    if (reservedNames.test(name)) {
      return { valid: false, reason: `'${name}' is a reserved Windows device name` };
    }
    return { valid: true };
  }

  async renameItem(
    oldPath: string,
    newName: string
  ): Promise<{ success: boolean; newPath?: string; error?: string }> {
    const trimmed = (newName || '').trim();
    const validation = this.validateFilename(trimmed);
    if (!validation.valid) {
      return { success: false, error: validation.reason };
    }

    const cleanOldPath = path.resolve(oldPath);
    const dir = path.dirname(cleanOldPath);
    const newPath = path.join(dir, trimmed);

    if (cleanOldPath === newPath) {
      return { success: true, newPath };
    }

    try {
      // Case-only rename on Windows (e.g. file.txt -> FILE.txt)
      if (cleanOldPath.toLowerCase() === newPath.toLowerCase()) {
        const tempPath = path.join(dir, `__afe_tmp_${Date.now()}_${trimmed}`);
        await fs.rename(cleanOldPath, tempPath);
        await fs.rename(tempPath, newPath);
        return { success: true, newPath };
      }

      // Check if target name already exists in directory
      try {
        await fs.access(newPath);
        return { success: false, error: `An item named "${trimmed}" already exists in this directory.` };
      } catch {
        // Destination does not exist, good to rename
      }

      await fs.rename(cleanOldPath, newPath);
      return { success: true, newPath };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async deleteToRecycleBin(paths: string[]): Promise<{ success: boolean; error?: string }> {
    try {
      for (const p of paths) {
        await shell.trashItem(p);
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async deletePermanently(paths: string[]): Promise<{ success: boolean; error?: string }> {
    try {
      for (const p of paths) {
        const stats = await fs.stat(p);
        if (stats.isDirectory()) {
          await fs.rm(p, { recursive: true, force: true });
        } else {
          await fs.unlink(p);
        }
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async checkCollisions(sources: string[], destination: string): Promise<FileCollision[]> {
    const collisions: FileCollision[] = [];
    const cleanDest = path.resolve(destination);

    for (const src of sources) {
      const cleanSrc = path.resolve(src);
      const fileName = path.basename(cleanSrc);
      const destPath = path.join(cleanDest, fileName);

      // Same file in same folder is not an overwrite collision unless copying
      if (cleanSrc.toLowerCase() === destPath.toLowerCase()) {
        continue;
      }

      try {
        const destStats = await fs.stat(destPath);
        const srcStats = await fs.stat(cleanSrc);

        collisions.push({
          sourcePath: cleanSrc,
          destinationPath: destPath,
          fileName,
          sourceSizeBytes: srcStats.size,
          sourceModifiedMs: srcStats.mtimeMs,
          destSizeBytes: destStats.size,
          destModifiedMs: destStats.mtimeMs,
        });
      } catch {
        // Destination does not exist -> no collision
      }
    }

    return collisions;
  }

  cancelTransfer(opId: string): boolean {
    const op = this.activeOperations.get(opId);
    if (op) {
      op.cancelled = true;
      // If a file was in progress, clean it up
      if (op.currentDestFile) {
        fs.unlink(op.currentDestFile).catch(() => {});
      }
      return true;
    }
    return false;
  }

  private async getUniqueAutoName(destination: string, fileName: string): Promise<string> {
    const ext = path.extname(fileName);
    const base = path.basename(fileName, ext);
    let counter = 1;
    let candidate = path.join(destination, `${base}_copy${ext}`);

    while (true) {
      try {
        await fs.access(candidate);
        candidate = path.join(destination, `${base}_copy_${counter}${ext}`);
        counter++;
      } catch {
        return candidate;
      }
    }
  }

  async executeTransfer(
    sources: string[],
    destination: string,
    mode: FileOperationMode,
    resolutionMap: Record<string, CollisionResolution> = {},
    opId = `op-${Date.now()}`,
    onProgress?: (progress: FileOperationProgress) => void
  ): Promise<{ success: boolean; transferred: number; cancelled?: boolean; error?: string }> {
    const opRecord = { cancelled: false, currentDestFile: undefined as string | undefined };
    this.activeOperations.set(opId, opRecord);

    let transferred = 0;
    let totalBytes = 0;
    let transferredBytes = 0;
    const cleanDest = path.resolve(destination);

    // Calculate total bytes
    for (const src of sources) {
      try {
        const s = await fs.stat(src);
        totalBytes += s.size;
      } catch {
        // Ignored
      }
    }

    try {
      for (let i = 0; i < sources.length; i++) {
        if (opRecord.cancelled) {
          this.activeOperations.delete(opId);
          return { success: false, transferred, cancelled: true };
        }

        const src = path.resolve(sources[i]);
        const fileName = path.basename(src);
        let destPath = path.join(cleanDest, fileName);

        // Same file in same folder
        if (src.toLowerCase() === destPath.toLowerCase()) {
          if (mode === 'MOVE') {
            // Moving onto itself is a no-op
            transferred++;
            continue;
          }
          // COPY to same folder creates auto duplicate
          if (!resolutionMap[fileName]) {
            destPath = await this.getUniqueAutoName(cleanDest, fileName);
          }
        }

        const resolution = resolutionMap[fileName];
        if (resolution === 'SKIP') {
          continue;
        } else if (resolution === 'AUTO_RENAME') {
          destPath = await this.getUniqueAutoName(cleanDest, fileName);
        } else if (resolution === 'OVERWRITE') {
          try {
            const s = await fs.stat(destPath);
            if (s.isDirectory()) {
              await fs.rm(destPath, { recursive: true, force: true });
            } else {
              await fs.unlink(destPath);
            }
          } catch {
            // Target did not exist
          }
        }

        opRecord.currentDestFile = destPath;

        if (onProgress) {
          onProgress({
            opId,
            mode,
            currentFile: fileName,
            currentIndex: i + 1,
            totalFiles: sources.length,
            transferredBytes,
            totalBytes,
            percentComplete: totalBytes > 0 ? Math.round((transferredBytes / totalBytes) * 100) : Math.round(((i + 1) / sources.length) * 100),
          });
        }

        const stats = await fs.stat(src);
        if (stats.isDirectory()) {
          if (mode === 'COPY') {
            await fs.cp(src, destPath, { recursive: true });
          } else {
            try {
              await fs.rename(src, destPath);
            } catch (err: any) {
              if (err.code === 'EXDEV') {
                await fs.cp(src, destPath, { recursive: true });
                await fs.rm(src, { recursive: true, force: true });
              } else {
                throw err;
              }
            }
          }
        } else {
          if (mode === 'COPY') {
            await fs.copyFile(src, destPath);
          } else {
            try {
              await fs.rename(src, destPath);
            } catch (err: any) {
              if (err.code === 'EXDEV') {
                await fs.copyFile(src, destPath);
                await fs.unlink(src);
              } else {
                throw err;
              }
            }
          }
        }

        transferredBytes += stats.size;
        transferred++;
        opRecord.currentDestFile = undefined;
      }

      this.activeOperations.delete(opId);
      return { success: true, transferred };
    } catch (err: any) {
      this.activeOperations.delete(opId);
      return { success: false, transferred, error: err.message };
    }
  }
}
