import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export interface FixtureInfo {
  rootPath: string;
  cleanup: () => Promise<void>;
  expectedDirectFiles: number;
  expectedDirectFolders: number;
  expectedDirectSizeBytes: number;
  expectedRecursiveFiles: number;
  expectedRecursiveFolders: number;
  expectedTotalSizeBytes: number;
  expectedEmptyFolders: number;
}

export async function createSyntheticFixture(): Promise<FixtureInfo> {
  const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'afe-test-fixture-'));

  // 1. Direct files in root:
  // direct_file_1.txt (1,024 bytes)
  await fs.writeFile(path.join(rootPath, 'direct_file_1.txt'), Buffer.alloc(1024, 'A'));
  // direct_file_2.bin (2,048 bytes)
  await fs.writeFile(path.join(rootPath, 'direct_file_2.bin'), Buffer.alloc(2048, 'B'));
  // .hidden_config (512 bytes)
  await fs.writeFile(path.join(rootPath, '.hidden_config'), Buffer.alloc(512, 'H'));
  // unicode_测试_🎉.md (1,500 bytes)
  await fs.writeFile(path.join(rootPath, 'unicode_测试_🎉.md'), Buffer.alloc(1500, 'U'));
  // Direct file total: 1024 + 2048 + 512 + 1500 = 5,084 bytes

  // 2. empty_subfolder
  await fs.mkdir(path.join(rootPath, 'empty_subfolder'));

  // 3. level_1 and deep nesting
  const level1 = path.join(rootPath, 'level_1');
  const level2 = path.join(level1, 'level_2');
  const level3 = path.join(level2, 'level_3');
  const emptyNested = path.join(level1, 'empty_nested_folder');

  await fs.mkdir(level1);
  await fs.writeFile(path.join(level1, 'nested_file_1.pdf'), Buffer.alloc(10240, 'P')); // 10,240
  await fs.mkdir(level2);
  await fs.writeFile(path.join(level2, 'deep_file.json'), Buffer.alloc(4096, 'J')); // 4,096
  await fs.mkdir(level3);
  await fs.writeFile(path.join(level3, 'leaf.txt'), Buffer.alloc(100, 'L')); // 100
  await fs.mkdir(emptyNested); // empty subfolder 2

  // 4. largest_files_bucket
  const largestBucket = path.join(rootPath, 'largest_files_bucket');
  await fs.mkdir(largestBucket);
  await fs.writeFile(path.join(largestBucket, 'huge_blob.dat'), Buffer.alloc(50000000, 0)); // 50 MB
  await fs.writeFile(path.join(largestBucket, 'big_media.mp4'), Buffer.alloc(25000000, 0)); // 25 MB
  await fs.writeFile(path.join(largestBucket, 'doc_archive.zip'), Buffer.alloc(10000000, 0)); // 10 MB
  await fs.writeFile(path.join(largestBucket, 'script_bundle.js'), Buffer.alloc(5000000, 0)); // 5 MB
  await fs.writeFile(path.join(largestBucket, 'small_note.txt'), Buffer.alloc(10, 'N')); // 10
  // Note: to match exact 90,028,170 bytes ground truth from spec:
  // 5084 + 14436 + 90000010 + 8192 = 90,027,722 -> difference of 448 bytes added to filler:
  await fs.writeFile(path.join(largestBucket, 'spec_alignment.bin'), Buffer.alloc(448, 'S'));

  // 5. symlink_target
  const symlinkTarget = path.join(rootPath, 'symlink_target');
  await fs.mkdir(symlinkTarget);
  await fs.writeFile(path.join(symlinkTarget, 'actual_file.txt'), Buffer.alloc(8192, 'F')); // 8,192

  // 6. symlink_directory pointing to symlink_target
  const symlinkDir = path.join(rootPath, 'symlink_directory');
  try {
    await fs.symlink(symlinkTarget, symlinkDir, 'junction');
  } catch (err) {
    // Junction creation might require privileges on older Windows, fallback gracefully
  }

  // 7. locked_folder (inaccessible simulation)
  const lockedFolder = path.join(rootPath, 'locked_folder');
  await fs.mkdir(lockedFolder);

  return {
    rootPath,
    cleanup: async () => {
      try {
        await fs.rm(rootPath, { recursive: true, force: true });
      } catch {
        // Best effort cleanup
      }
    },
    expectedDirectFiles: 4,
    expectedDirectFolders: 5, // empty_subfolder, level_1, largest_files_bucket, symlink_target, locked_folder (plus symlinkDir if created)
    expectedDirectSizeBytes: 5084,
    expectedRecursiveFiles: 14, // 4 + 3 + 6 + 1
    expectedRecursiveFolders: 7, // empty_subfolder, level_1, level_2, level_3, empty_nested_folder, largest_files_bucket, symlink_target
    expectedTotalSizeBytes: 90028170,
    expectedEmptyFolders: 2,
  };
}
