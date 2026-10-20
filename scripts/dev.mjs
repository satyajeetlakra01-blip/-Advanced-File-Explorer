import { createServer } from 'vite';
import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '..');

async function startDev() {
  // 1. Build main and preload
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

  // 2. Start Vite server for renderer
  const viteServer = await createServer({
    configFile: resolve(root, 'vite.config.ts'),
    server: { port: 5173 },
  });
  await viteServer.listen();
  console.log('[dev] Vite dev server running at http://localhost:5173');

  // 3. Spawn Electron
  process.env.VITE_DEV_SERVER_URL = 'http://localhost:5173';
  const electronProcess = spawn('npx', ['electron', '.'], {
    cwd: root,
    stdio: 'inherit',
    shell: true,
  });

  electronProcess.on('close', () => {
    viteServer.close();
    process.exit(0);
  });
}

startDev().catch((err) => {
  console.error('[dev] Dev failed:', err);
  process.exit(1);
});
