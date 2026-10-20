import { appStore } from '../store/appStore';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export class StatusBar {
  private container: HTMLElement;

  constructor() {
    this.container = document.createElement('footer');
    this.container.className = 'status-bar';
    this.render();

    appStore.subscribe(() => {
      this.render();
    });
  }

  get element(): HTMLElement {
    return this.container;
  }

  private render() {
    const { items, selectedPaths, isInspectorScanning, inspectorStats, statusMessage } = appStore.getState();

    const selectedCount = selectedPaths.size;
    let selectedBytes = 0;
    if (selectedCount > 0) {
      for (const item of items) {
        if (selectedPaths.has(item.path)) {
          selectedBytes += item.sizeBytes;
        }
      }
    }

    const itemsSummary = `${items.length} item${items.length === 1 ? '' : 's'}`;
    const selectionSummary =
      selectedCount > 0
        ? ` | ${selectedCount} selected (${formatBytes(selectedBytes)})`
        : '';

    let scanSummary = '';
    if (isInspectorScanning) {
      scanSummary = `
        <span style="color:var(--accent-primary); display:inline-flex; align-items:center; gap:6px;">
          <svg class="task-drawer-spinner" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M21 12a9 9 0 11-6.219-8.56"/>
          </svg>
          Scanning folder tree...
        </span>
      `;
    } else if (inspectorStats && inspectorStats.status === 'COMPLETED') {
      scanSummary = `
        <span style="color:var(--accent-emerald); display:inline-flex; align-items:center; gap:5px;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Folder scan complete (${(inspectorStats.scanDurationMs / 1000).toFixed(1)}s)
        </span>
      `;
    }

    this.container.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px;">
        <span>${itemsSummary}${selectionSummary}</span>
        <span style="color:var(--text-muted); font-size:11px;">• ${statusMessage}</span>
      </div>
      <div>
        ${scanSummary}
      </div>
    `;
  }
}
