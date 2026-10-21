import * as esbuild from 'esbuild';
import * as fs from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '..');

async function buildMain() {
  console.log('[build-main] Compiling Electron main, preload, and worker threads...');
  
  // 1. Build Main Process
  await esbuild.build({
    entryPoints: [resolve(root, 'src/main/index.ts')],
    outfile: resolve(root, 'dist/main/index.cjs'),
    bundle: true,
    platform: 'node',
    target: 'node24',
    format: 'cjs',
    sourcemap: true,
    external: ['electron'],
  });

  // 2. Build Preload Script
  await esbuild.build({
    entryPoints: [resolve(root, 'src/preload/index.ts')],
    outfile: resolve(root, 'dist/preload/index.cjs'),
    bundle: true,
    platform: 'node',
    target: 'node24',
    format: 'cjs',
    sourcemap: true,
    external: ['electron'],
  });

  // 3. Build Background Scanner Worker
  await esbuild.build({
    entryPoints: [resolve(root, 'src/workers/scanner.worker.ts')],
    outfile: resolve(root, 'dist/workers/scanner.worker.cjs'),
    bundle: true,
    platform: 'node',
    target: 'node24',
    format: 'cjs',
    sourcemap: true,
    external: ['electron'],
  });

  // 4. Build Background Search Worker
  await esbuild.build({
    entryPoints: [resolve(root, 'src/workers/search.worker.ts')],
    outfile: resolve(root, 'dist/workers/search.worker.cjs'),
    bundle: true,
    platform: 'node',
    target: 'node24',
    format: 'cjs',
    sourcemap: true,
    external: ['electron'],
  });

  // 5. Copy static assets to dist/assets
  const assetsSrc = resolve(root, 'assets');
  const assetsDest = resolve(root, 'dist/assets');
  if (fs.existsSync(assetsSrc)) {
    fs.cpSync(assetsSrc, assetsDest, { recursive: true, force: true });
  }

  console.log('[build-main] Compilation completed successfully.');
}

buildMain().catch((err) => {
  console.error('[build-main] Build failed:', err);
  process.exit(1);
});
