import { appStore } from './store/appStore';
import { HeaderBar } from './components/HeaderBar';
import { NavigationSidebar } from './components/NavigationSidebar';
import { DualPaneContainer } from './components/DualPaneContainer';
import { FolderInspectorPanel } from './components/FolderInspectorPanel';
import { StatusBar } from './components/StatusBar';
import { Modals } from './components/Modals';
import { ConflictModal } from './components/ConflictModal';
import { taskDrawer } from './components/TaskDrawer';
import { previewPanel } from './components/PreviewPanel';
import { searchResultsModal } from './components/SearchResultsModal';
import { macGlassPreview } from './components/MacGlassPreview';
import { codeSandbox } from './components/CodeSandboxModal';
import { PaneId } from '../shared/types';

async function bootstrap() {
  const root = document.getElementById('app-root');
  if (!root) return;


  const header = new HeaderBar();
  const sidebar = new NavigationSidebar();
  const dualPane = new DualPaneContainer();
  const inspector = new FolderInspectorPanel();
  const statusBar = new StatusBar();

  const body = document.createElement('div');
  body.className = 'app-body';
  body.appendChild(sidebar.element);
  body.appendChild(dualPane.element);
  body.appendChild(inspector.element);

  root.appendChild(header.element);
  root.appendChild(body);
  root.appendChild(statusBar.element);


  try {
    const drives = await window.electronApi.getDrives();
    const quickAccess = await window.electronApi.getQuickAccess();
    appStore.setState({ drives, quickAccess });
  } catch (err) {
    console.error('Failed to load initial drives/quick access:', err);
  }


  async function navigateTo(targetPath: string, pushHistory = true, paneId?: PaneId) {
    const targetPaneId = paneId || appStore.getState().activePaneId;
    try {
      appStore.setState({ statusMessage: 'Loading directory...' });
      const { showHidden } = appStore.getState();
      const listing = await window.electronApi.readDir(targetPath, { showHidden });

      appStore.navigate(listing.currentPath, pushHistory, targetPaneId);
      appStore.setItems(listing.items, targetPaneId);
      appStore.setState({
        statusMessage: `Loaded ${listing.totalCount} items`,
        inspectorTarget: null,
      });

      // Update Inspector with direct metrics or cached stats WITHOUT auto-running heavy recursive scans
      if (targetPaneId === appStore.getState().activePaneId) {
        if (activeScanId) {
          window.electronApi.cancelFolderScan(activeScanId).catch(() => {});
          activeScanId = null;
        }
        setupInspectorForFolder(listing.currentPath, listing.fileCount, listing.folderCount, listing.totalSizeBytes);
      }
    } catch (err: any) {
      appStore.setState({ statusMessage: `Error: ${err.message}` });
      Modals.showToast(`Cannot open path: ${err.message}`);
      console.error('Navigation error:', err);
    }
  }


  let activeScanId: string | null = null;

  async function setupInspectorForFolder(folderPath: string, directFiles = 0, directFolders = 0, directSize = 0) {
    try {
      const cached = await window.electronApi.getFolderStats(folderPath);
      if (cached) {
        appStore.setState({
          inspectorStats: cached,
          isInspectorScanning: false,
        });
        return;
      }

      // Ready-to-scan state with direct metadata already known
      appStore.setState({
        isInspectorScanning: false,
        inspectorStats: {
          path: folderPath,
          directFiles,
          directFolders,
          directSizeBytes: directSize,
          totalFiles: directFiles,
          totalFolders: directFolders,
          totalSizeBytes: directSize,
          physicalSizeBytes: directSize,
          emptyFolders: 0,
          hiddenCount: 0,
          largestFiles: [],
          largestFolders: [],
          typeBreakdown: [],
          scanDurationMs: 0,
          status: 'IDLE',
          inaccessiblePaths: [],
        },
      });
    } catch (err) {
      console.error('Failed to setup inspector:', err);
    }
  }

  async function triggerInspectorScan(folderPath: string) {
    try {
      if (activeScanId) {
        await window.electronApi.cancelFolderScan(activeScanId);
        activeScanId = null;
      }

      appStore.setState({
        isInspectorScanning: true,
        statusMessage: 'Scanning recursive storage metrics in background...',
      });

      const scanId = await window.electronApi.startFolderScan(folderPath);
      activeScanId = scanId;
      appStore.setState({ inspectorScanId: scanId });
    } catch (err) {
      console.error('Failed to trigger inspector scan:', err);
      appStore.setState({ isInspectorScanning: false });
    }
  }

  // Inspector streaming updates
  window.electronApi.onInspectorProgress((data) => {
    const current = appStore.getState().inspectorStats;
    appStore.setState({
      isInspectorScanning: true,
      inspectorStats: {
        ...(current || {}),
        ...data,
      } as any,
    });
  });

  window.electronApi.onInspectorCompleted((stats) => {
    appStore.setState({
      inspectorStats: stats,
      isInspectorScanning: false,
      statusMessage: `Deep scan finished in ${(stats.scanDurationMs / 1000).toFixed(1)}s`,
    });
  });

  // Application Event Bus
  window.addEventListener('app:navigate', (e: any) => {
    if (e.detail?.path) {
      navigateTo(e.detail.path, e.detail.pushHistory !== false, e.detail.paneId);
    }
  });

  window.addEventListener('app:navigate-up', (e: any) => {
    const targetPaneId = e.detail?.paneId || appStore.getState().activePaneId;
    const current = appStore.getActiveTab(targetPaneId).currentPath;
    const parts = current.split(/\\|\//).filter(Boolean);
    if (parts.length > 1) {
      parts.pop();
      let parent = parts.join('\\');
      if (/^[a-zA-Z]:$/.test(parent)) parent += '\\';
      navigateTo(parent, true, targetPaneId);
    }
  });

  window.addEventListener('app:refresh', (e: any) => {
    const targetPaneId = e.detail?.paneId || appStore.getState().activePaneId;
    const current = appStore.getActiveTab(targetPaneId).currentPath;
    if (current) navigateTo(current, false, targetPaneId);
  });

  window.addEventListener('app:inspect-folder', (e: any) => {
    if (e.detail?.folder?.path) {
      setupInspectorForFolder(e.detail.folder.path);
    }
  });

  window.addEventListener('app:start-deep-scan', (e: any) => {
    if (e.detail?.path) {
      triggerInspectorScan(e.detail.path);
    }
  });

  window.addEventListener('app:cancel-deep-scan', async () => {
    if (activeScanId) {
      await window.electronApi.cancelFolderScan(activeScanId);
      appStore.setState({ isInspectorScanning: false });
      Modals.showToast('Folder scan cancelled');
    }
  });

  window.addEventListener('app:open-file', async (e: any) => {
    if (e.detail?.path) {
      const ext = e.detail.path.toLowerCase().split('.').pop() || '';
      const isMedia = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'mp4', 'webm', 'mov', 'mkv', 'pdf', 'mp3', 'wav', 'flac'].includes(ext);
      const isCodeOrText = [
        'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'json', 'html', 'css', 'scss', 'less',
        'py', 'rs', 'go', 'c', 'cpp', 'h', 'hpp', 'java', 'cs', 'php', 'rb',
        'sh', 'bash', 'ps1', 'bat', 'cmd', 'md', 'txt', 'yml', 'yaml', 'toml',
        'xml', 'sql', 'env', 'ini', 'cfg', 'log', 'csv', 'tsv'
      ].includes(ext);

      if (isCodeOrText) {
        codeSandbox.open(e.detail.path);
      } else if (isMedia) {
        macGlassPreview.open(e.detail.path);
      } else {
        await window.electronApi.openPath(e.detail.path);
      }
    }
  });

  // Search & Preview
  window.addEventListener('app:start-search', (e: any) => {
    const rootPath = appStore.getState().currentPath;
    if (rootPath && e.detail?.query) {
      searchResultsModal.open(rootPath, e.detail.query);
    }
  });

  window.addEventListener('app:preview-file', (e: any) => {
    if (e.detail?.path) {
      const ext = e.detail.path.toLowerCase().split('.').pop() || '';
      const isCode = [
        'ts', 'tsx', 'js', 'jsx', 'json', 'html', 'css', 'scss',
        'py', 'rs', 'go', 'c', 'cpp', 'h', 'java', 'sh', 'ps1', 'bat', 'md', 'txt'
      ].includes(ext);
      if (isCode) {
        codeSandbox.open(e.detail.path);
      } else {
        macGlassPreview.open(e.detail.path);
      }
    }
  });

  // Global dragover & dragenter: prevent Chromium from showing the forbidden/error cursor (🚫)
  window.addEventListener('dragenter', (e: DragEvent) => {
    e.preventDefault();
  });

  window.addEventListener('dragover', (e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer) {
      const allowed = (e.dataTransfer.effectAllowed || '').toLowerCase();
      if (e.ctrlKey) {
        e.dataTransfer.dropEffect = 'copy';
      } else if (
        allowed === 'move' ||
        allowed === 'copymove' ||
        allowed === 'all' ||
        allowed === 'uninitialized' ||
        allowed === ''
      ) {
        e.dataTransfer.dropEffect = 'move';
      } else {
        e.dataTransfer.dropEffect = 'copy';
      }
    }
  });

  // Global dragleave: clear hover drop targets if drag exits the application window (e.g. into Chrome/WhatsApp/Desktop)
  window.addEventListener('dragleave', (e: DragEvent) => {
    if (
      e.clientX <= 0 ||
      e.clientY <= 0 ||
      e.clientX >= window.innerWidth ||
      e.clientY >= window.innerHeight ||
      !e.relatedTarget
    ) {
      appStore.setHoveredDropTarget(null);
      document.querySelectorAll('.folder-drop-target').forEach((t) => t.classList.remove('folder-drop-target'));
      document.querySelectorAll('.drag-over-active').forEach((t) => t.classList.remove('drag-over-active'));
    }
  });

  // Cross-Pane File Transfers (Drag & Drop or Shortcut)
  window.addEventListener('app:cross-pane-transfer', async (e: any) => {
    const { sources, destination, mode, sourcePane, destPane } = e.detail;
    if (!sources || sources.length === 0 || !destination) return;

    // 1. Check collisions
    const collisions = await window.electronApi.checkCollisions(sources, destination);

    let resolutionMap: Record<string, any> = {};
    if (collisions.length > 0) {
      const resolutionResult = await ConflictModal.resolveCollisions(collisions);
      if (resolutionResult.cancelled) {
        Modals.showToast('Transfer cancelled');
        return;
      }
      resolutionMap = resolutionResult.resolutionMap;
    }

    // 2. Execute transfer with background drawer
    const opId = `op-pane-${Date.now()}`;
    taskDrawer.show(opId, mode, sources.length);

    try {
      const res = await window.electronApi.executeTransfer(
        sources,
        destination,
        mode,
        resolutionMap,
        opId
      );

      taskDrawer.hide();
      if (res.cancelled) {
        Modals.showToast('Transfer cancelled by user');
      } else if (res.success) {
        Modals.showToast(
          `${mode === 'COPY' ? 'Copied' : 'Moved'} ${res.transferred} items`
        );
        // Refresh panes after transfer
        if (sourcePane) {
          const srcPath = appStore.getActiveTab(sourcePane).currentPath;
          if (srcPath) navigateTo(srcPath, false, sourcePane);
        }
        if (destPane && destPane !== sourcePane) {
          const destCurrent = appStore.getActiveTab(destPane).currentPath;
          if (destCurrent && destCurrent.toLowerCase() === destination.toLowerCase()) {
            navigateTo(destination, false, destPane);
          } else if (destCurrent) {
            navigateTo(destCurrent, false, destPane);
          }
        } else if (!sourcePane) {
          const activeCurrent = appStore.getState().currentPath;
          if (activeCurrent) navigateTo(activeCurrent, false);
        }
      } else {
        Modals.showToast(`Transfer error: ${res.error}`);
      }
    } catch (err: any) {
      taskDrawer.hide();
      Modals.showToast(`Transfer failed: ${err.message}`);
    }
  });

  // Operations: Rename, New Folder, Delete, Paste
  window.addEventListener('app:trigger-rename', (e: any) => {
    let item = e.detail?.item;
    const activePane = appStore.getState().activePaneId;
    const activeTab = appStore.getActiveTab(activePane);

    if (!item) {
      if (e.detail?.path) {
        const p = e.detail.path;
        item = activeTab.items.find((i) => i.path.toLowerCase() === p.toLowerCase()) || {
          path: p,
          name: p.split(/[\\/]/).filter(Boolean).pop() || p,
          isDirectory: false,
          isFile: true,
          sizeBytes: 0,
          modifiedMs: Date.now(),
        };
      } else {
        const selected = Array.from(activeTab.selectedPaths);
        if (selected.length === 1) {
          const p = selected[0];
          item = activeTab.items.find((i) => i.path.toLowerCase() === p.toLowerCase()) || {
            path: p,
            name: p.split(/[\\/]/).filter(Boolean).pop() || p,
            isDirectory: false,
            isFile: true,
            sizeBytes: 0,
            modifiedMs: Date.now(),
          };
        }
      }
    }

    if (!item) {
      Modals.showToast('Please select a single file or folder to rename');
      return;
    }

    Modals.promptRename(item, async (newName) => {
      const res = await window.electronApi.renameItem(item.path, newName);
      if (res.success) {
        Modals.showToast(`Renamed to '${newName}'`);
        const current = activeTab.currentPath || appStore.getState().currentPath;
        if (current) {
          await navigateTo(current, false, activePane);
          if (res.newPath) {
            appStore.setSelection([res.newPath], activePane);
          }
        }
      } else {
        throw new Error(res.error || 'Rename failed');
      }
    });
  });

  window.addEventListener('app:trigger-new-folder', (e: any) => {
    const parentPath = e.detail?.parentPath || appStore.getState().currentPath;
    if (!parentPath) return;

    Modals.promptNewFolder(parentPath, async (folderName) => {
      const res = await window.electronApi.createFolder(parentPath, folderName);
      if (res.success) {
        Modals.showToast(`Folder '${folderName}' created`);
        navigateTo(parentPath, false);
      } else {
        throw new Error(res.error || 'Folder creation failed');
      }
    });
  });

  window.addEventListener('app:trigger-delete', (e: any) => {
    const paths = e.detail?.paths as string[];
    const permanent = Boolean(e.detail?.permanent);
    if (!paths || paths.length === 0) return;

    Modals.confirmDelete(paths, permanent, async () => {
      if (permanent) {
        const res = await window.electronApi.deletePermanently(paths);
        if (res.success) {
          Modals.showToast(`Permanently deleted ${paths.length} items`);
          const current = appStore.getState().currentPath;
          if (current) navigateTo(current, false);
        } else {
          Modals.showToast(`Delete failed: ${res.error}`);
        }
      } else {
        const res = await window.electronApi.deleteToRecycleBin(paths);
        if (res.success) {
          Modals.showToast(
            paths.length === 1 ? 'Moved 1 item to Recycle Bin' : `Moved ${paths.length} items to Recycle Bin`
          );
          const current = appStore.getState().currentPath;
          if (current) navigateTo(current, false);
        } else {
          Modals.showToast(`Delete failed: ${res.error}`);
        }
      }
    });
  });

  async function handlePaste() {
    const clipboard = appStore.getState().clipboard;
    const currentPath = appStore.getState().currentPath;
    if (!clipboard || clipboard.paths.length === 0 || !currentPath) return;

    // 1. Check collisions
    const collisions = await window.electronApi.checkCollisions(clipboard.paths, currentPath);

    let resolutionMap: Record<string, any> = {};
    if (collisions.length > 0) {
      const resolutionResult = await ConflictModal.resolveCollisions(collisions);
      if (resolutionResult.cancelled) {
        Modals.showToast('Transfer cancelled');
        return;
      }
      resolutionMap = resolutionResult.resolutionMap;
    }

    // 2. Execute transfer with background drawer
    const opId = `op-${Date.now()}`;
    taskDrawer.show(opId, clipboard.mode, clipboard.paths.length);

    try {
      const res = await window.electronApi.executeTransfer(
        clipboard.paths,
        currentPath,
        clipboard.mode,
        resolutionMap,
        opId
      );

      taskDrawer.hide();
      if (res.cancelled) {
        Modals.showToast('Transfer cancelled by user');
      } else if (res.success) {
        Modals.showToast(
          `${clipboard.mode === 'COPY' ? 'Copied' : 'Moved'} ${res.transferred} items successfully`
        );
        if (clipboard.mode === 'MOVE') {
          appStore.clearClipboard();
        }
        navigateTo(currentPath, false);
      } else {
        Modals.showToast(`Transfer error: ${res.error}`);
      }
    } catch (err: any) {
      taskDrawer.hide();
      Modals.showToast(`Transfer failed: ${err.message}`);
    }
  }

  window.addEventListener('app:trigger-paste', handlePaste);

  // Keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    // Tab & Dual-Pane shortcuts
    if (e.ctrlKey && e.shiftKey && (e.key === 'E' || e.key === 'e')) {
      e.preventDefault();
      appStore.toggleDualPane();
      return;
    }

    if (e.ctrlKey && (e.key === 't' || e.key === 'T')) {
      e.preventDefault();
      const current = appStore.getState().currentPath;
      const newTab = appStore.createTab(appStore.getState().activePaneId, current);
      if (newTab.currentPath) {
        navigateTo(newTab.currentPath, false);
      }
      return;
    }

    if (e.ctrlKey && (e.key === 'w' || e.key === 'W')) {
      e.preventDefault();
      const activeTab = appStore.getActiveTab();
      appStore.closeTab(activeTab.id);
      const nextPath = appStore.getActiveTab().currentPath;
      if (nextPath) {
        navigateTo(nextPath, false);
      }
      return;
    }

    if (e.ctrlKey && e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        appStore.prevTab();
      } else {
        appStore.nextTab();
      }
      const nextPath = appStore.getActiveTab().currentPath;
      if (nextPath) {
        navigateTo(nextPath, false);
      }
      return;
    }

    if (e.key === 'F6') {
      e.preventDefault();
      const nextPane = appStore.getState().activePaneId === 'left' ? 'right' : 'left';
      appStore.setActivePane(nextPane);
      return;
    }

    // Navigation & Editing shortcuts
    if (e.altKey && e.key === 'ArrowLeft') {
      const prev = appStore.goBack();
      if (prev) navigateTo(prev, false);
    } else if (e.altKey && e.key === 'ArrowRight') {
      const next = appStore.goForward();
      if (next) navigateTo(next, false);
    } else if (e.altKey && e.key === 'ArrowUp') {
      window.dispatchEvent(new CustomEvent('app:navigate-up'));
    } else if (e.key === 'F2') {
      const activeEl = document.activeElement;
      if (activeEl?.tagName !== 'INPUT' && activeEl?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('app:trigger-rename'));
      }
    } else if (e.ctrlKey && (e.key === 'e' || e.key === 'E') && !e.shiftKey) {
      const activeEl = document.activeElement;
      if (activeEl?.tagName !== 'INPUT' && activeEl?.tagName !== 'TEXTAREA') {
        const activeTab = appStore.getActiveTab();
        const selected = Array.from(activeTab.selectedPaths);
        if (selected.length === 1) {
          e.preventDefault();
          codeSandbox.open(selected[0]);
        }
      }
    } else if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('app:refresh'));
    } else if (e.ctrlKey && e.shiftKey && e.key === 'N') {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('app:trigger-new-folder'));
    } else if (e.ctrlKey && e.key === 'c') {
      const { selectedPaths } = appStore.getState();
      if (selectedPaths.size > 0) {
        appStore.setClipboard(Array.from(selectedPaths), 'COPY');
        Modals.showToast(`Copied ${selectedPaths.size} items to clipboard`);
      }
    } else if (e.ctrlKey && e.key === 'x') {
      const { selectedPaths } = appStore.getState();
      if (selectedPaths.size > 0) {
        appStore.setClipboard(Array.from(selectedPaths), 'MOVE');
        Modals.showToast(`Cut ${selectedPaths.size} items to clipboard`);
      }
    } else if (e.ctrlKey && e.key === 'v') {
      e.preventDefault();
      handlePaste();
    } else if (e.shiftKey && e.key === 'Delete') {
      e.preventDefault();
      const { selectedPaths } = appStore.getState();
      if (selectedPaths.size > 0) {
        window.dispatchEvent(
          new CustomEvent('app:trigger-delete', { detail: { paths: Array.from(selectedPaths), permanent: true } })
        );
      }
    } else if (e.key === 'Delete') {
      e.preventDefault();
      const { selectedPaths } = appStore.getState();
      if (selectedPaths.size > 0) {
        window.dispatchEvent(
          new CustomEvent('app:trigger-delete', { detail: { paths: Array.from(selectedPaths), permanent: false } })
        );
      }
    } else if (e.ctrlKey && e.key === 'h') {
      e.preventDefault();
      const current = appStore.getState().showHidden;
      appStore.setState({ showHidden: !current });
      const path = appStore.getState().currentPath;
      if (path) navigateTo(path, false);
    } else if (e.ctrlKey && e.key === 'f') {
      e.preventDefault();
      const input = document.getElementById('search-input') as HTMLInputElement;
      input?.focus();
    } else if (e.ctrlKey && e.key === 'i') {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('app:toggle-inspector'));
    } else if (e.key === ' ' && !e.ctrlKey) {
      const activeEl = document.activeElement;
      if (activeEl?.tagName !== 'INPUT' && activeEl?.tagName !== 'TEXTAREA') {
        const { selectedPaths } = appStore.getState();
        if (selectedPaths.size === 1) {
          e.preventDefault();
          const targetPath = Array.from(selectedPaths)[0];
          macGlassPreview.open(targetPath);
        }
      }
    } else if (e.ctrlKey && (e.key === 'p' || e.key === 'P')) {
      const { selectedPaths } = appStore.getState();
      if (selectedPaths.size === 1) {
        e.preventDefault();
        const targetPath = Array.from(selectedPaths)[0];
        macGlassPreview.open(targetPath);
      }
    }
  });

  // Initial navigation
  const drives = appStore.getState().drives;
  const initialPath = drives.length > 0 ? drives[0].mountPoint : 'C:\\';
  await navigateTo(initialPath);
}

document.addEventListener('DOMContentLoaded', bootstrap);
