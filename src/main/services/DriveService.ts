import * as fs from 'fs/promises';
import { DriveInfo } from '../../shared/types';

export class DriveService {
  async getDrives(): Promise<DriveInfo[]> {
    const letters = 'CDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const drives: DriveInfo[] = [];

    for (const letter of letters) {
      const rootPath = `${letter}:\\`;
      try {
        const stats = await fs.statfs(rootPath);
        const totalBytes = stats.bsize * stats.blocks;
        const freeBytes = stats.bsize * stats.bavail;
        const usedBytes = totalBytes - freeBytes;
        const percentUsed = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0;

        drives.push({
          letter: `${letter}:`,
          mountPoint: rootPath,
          label: letter === 'C' ? 'OS Drive' : `Local Disk (${letter}:)`,
          totalBytes,
          freeBytes,
          usedBytes,
          percentUsed,
          isRemovable: false,
        });
      } catch {
        // Drive letter not mounted/accessible
      }
    }

    return drives;
  }
}
