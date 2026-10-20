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
    const validation = this.validateFilename(newName);
    if (!validation.valid) {
      return { success: false, error: validation.reason };
    }

    const dir = path.dirname(oldPath);
    const newPath = path.join(dir, newName);

    try {
      await fs.rename(oldPath, newPath);
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

    for (const src of sources) {
      const fileName = path.basename(src);
      const destPath = path.join(destination, fileName);

      try {
        const destStats = await fs.stat(destPath);
        const srcStats = await fs.stat(src);

        collisions.push({
          sourcePath: src,
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

        const src = sources[i];
        const fileName = path.basename(src);
        let destPath = path.join(destination, fileName);

        const resolution = resolutionMap[fileName];
        if (resolution === 'SKIP') {
          continue;
        } else if (resolution === 'AUTO_RENAME') {
          destPath = await this.getUniqueAutoName(destination, fileName);
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
            await fs.rename(src, destPath);
          }
        } else {
          if (mode === 'COPY') {
            await fs.copyFile(src, destPath);
          } else {
            await fs.rename(src, destPath);
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
