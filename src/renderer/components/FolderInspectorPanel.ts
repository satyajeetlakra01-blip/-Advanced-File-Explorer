import { appStore } from '../store/appStore';
import { FolderStats } from '../../shared/types';

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

const CATEGORY_COLORS: Record<string, string> = {
  Code: 'var(--cat-code)',
  Media: 'var(--cat-media)',
  Documents: 'var(--cat-documents)',
  Archives: 'var(--cat-archives)',
  Executables: 'var(--cat-executables)',
  Other: 'var(--cat-other)',
};

export class FolderInspectorPanel {
  private container: HTMLElement;
  private isVisible = true;

  constructor() {
    this.container = document.createElement('aside');
    this.container.className = 'folder-inspector-panel';
    this.render();

    appStore.subscribe(() => {
      this.render();
    });

    window.addEventListener('app:toggle-inspector', () => {
      this.isVisible = !this.isVisible;
      this.container.style.display = this.isVisible ? 'flex' : 'none';
    });
  }

  get element(): HTMLElement {
    return this.container;
  }

  private render() {
    const { inspectorTarget, inspectorStats, isInspectorScanning, currentPath } = appStore.getState();

    // If no specific folder selected, default to the current active directory
    const targetName = inspectorTarget ? inspectorTarget.name : currentPath.split(/\\|\//).pop() || currentPath;
    const targetPath = inspectorTarget ? inspectorTarget.path : currentPath;

    if (!targetPath) {
      this.container.innerHTML = `
        <div style="padding: 24px; text-align: center; color: var(--text-muted);">
          Select a folder to inspect recursive storage metrics.
        </div>
      `;
      return;
    }

    const stats = inspectorStats;
    const status = stats ? stats.status : 'IDLE';

    let badgeClass = 'badge-completed';
    let badgeText = 'COMPLETED';

    if (isInspectorScanning || status === 'SCANNING') {
      badgeClass = 'badge-scanning';
      badgeText = 'SCANNING...';
    } else if (status === 'CANCELLED') {
      badgeClass = 'badge-cancelled';
      badgeText = 'PARTIAL (CANCELLED)';
    } else if (status === 'RESTRICTED') {
      badgeClass = 'badge-restricted';
      badgeText = 'RESTRICTED ACCESS';
    } else if (status === 'IDLE') {
      badgeClass = 'badge-scanning';
      badgeText = 'READY TO SCAN';
    }

    // Direct contents
    const directFiles = stats ? stats.directFiles : 0;
    const directFolders = stats ? stats.directFolders : 0;
    const directSize = stats ? stats.directSizeBytes : 0;

    // Recursive metrics
    const totalFiles = stats ? stats.totalFiles : 0;
    const totalFolders = stats ? stats.totalFolders : 0;
    const totalBytes = stats ? stats.totalSizeBytes : 0;
    const emptyFolders = stats ? stats.emptyFolders : 0;
    const hiddenCount = stats ? stats.hiddenCount : 0;
    const scanDuration = stats ? (stats.scanDurationMs / 1000).toFixed(1) : '0.0';

    // Type Breakdown Bar
    let typeBarHtml = '';
    let typeLegendHtml = '';
    if (stats && stats.typeBreakdown && stats.typeBreakdown.length > 0) {
      for (const item of stats.typeBreakdown) {
        const color = CATEGORY_COLORS[item.category] || 'var(--cat-other)';
        typeBarHtml += `<div class="type-segment" style="width: ${item.percentage}%; background: ${color};" title="${item.category}: ${item.percentage}%"></div>`;
        typeLegendHtml += `
          <div class="type-legend-row">
            <div class="type-legend-left">
              <span class="legend-dot" style="background: ${color};"></span>
              <span>${item.category} (${item.percentage}%)</span>
            </div>
            <div class="type-legend-right">${formatBytes(item.sizeBytes)}</div>
          </div>
        `;
      }
    } else {
      typeBarHtml = `<div class="type-segment" style="width: 100%; background: rgba(255,255,255,0.06);"></div>`;
      typeLegendHtml = `<div style="font-size: 11px; color: var(--text-muted);">No distribution data available yet.</div>`;
    }

    // Largest files
    let largestFilesHtml = '';
    if (stats && stats.largestFiles && stats.largestFiles.length > 0) {
      for (const item of stats.largestFiles) {
        largestFilesHtml += `
          <div class="top-item-row">
            <div class="top-item-name" title="${item.path}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block; vertical-align:-1px; margin-right:4px; opacity:0.7;"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>${item.name}
            </div>
            <div class="top-item-size">${formatBytes(item.sizeBytes)}</div>
          </div>
        `;
      }
    } else {
      largestFilesHtml = `<div style="font-size: 11px; color: var(--text-muted);">No files recorded yet.</div>`;
    }

    // Largest subfolders
    let largestFoldersHtml = '';
    if (stats && stats.largestFolders && stats.largestFolders.length > 0) {
      for (const item of stats.largestFolders) {
        largestFoldersHtml += `
          <div class="top-item-row">
            <div class="top-item-name" title="${item.path}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style="display:inline-block; vertical-align:-1px; margin-right:4px; color:var(--accent-primary);"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>${item.name}
            </div>
            <div class="top-item-size">${formatBytes(item.sizeBytes)}</div>
          </div>
        `;
      }
    } else {
      largestFoldersHtml = `<div style="font-size: 11px; color: var(--text-muted);">No subfolders found.</div>`;
    }

    // Inaccessible warnings
    let warningsHtml = '';
    if (stats && stats.inaccessiblePaths && stats.inaccessiblePaths.length > 0) {
      warningsHtml = `
        <div style="background: rgba(244, 63, 94, 0.1); border: 1px solid rgba(244, 63, 94, 0.3); border-radius: var(--radius-md); padding: 10px; font-size: 11.5px;">
          <div style="color: var(--accent-rose); font-weight: 600; margin-bottom: 4px; display:flex; align-items:center; gap:6px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Access Restrictions (${stats.inaccessiblePaths.length})
          </div>
          <div style="color: var(--text-secondary); max-height: 80px; overflow-y: auto;">
            ${stats.inaccessiblePaths.map((p) => `<div>• ${p.path} [${p.errorCode}]</div>`).join('')}
          </div>
        </div>
      `;
    }

    this.container.innerHTML = `
      <div class="inspector-header">
        <div class="inspector-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
        </div>
        <div class="inspector-title-area">
          <div class="inspector-folder-name" title="${targetName}">${targetName}</div>
          <div class="inspector-folder-path" title="${targetPath}">${targetPath}</div>
        </div>
      </div>

      <div class="inspector-card">
        <div class="card-title">
          <span>Direct Contents</span>
          <span style="font-size: 10px; color: var(--text-muted);">Root level</span>
        </div>
        <div class="metrics-grid">
          <div class="metric-item">
            <span class="metric-label">Files</span>
            <span class="metric-value">${directFiles.toLocaleString()}</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Folders</span>
            <span class="metric-value">${directFolders.toLocaleString()}</span>
          </div>
          <div class="metric-item" style="grid-column: span 2;">
            <span class="metric-label">Size</span>
            <span class="metric-value">${formatBytes(directSize)}</span>
          </div>
        </div>
      </div>

      <div class="inspector-card">
        <div class="card-title">
          <span>Storage Breakdown</span>
          <span class="badge ${badgeClass}">${badgeText}</span>
        </div>
        <div class="metrics-grid">
          <div class="metric-item">
            <span class="metric-label">Total Files</span>
            <span class="metric-value">${totalFiles.toLocaleString()}</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Total Folders</span>
            <span class="metric-value">${totalFolders.toLocaleString()}</span>
          </div>
          <div class="metric-item" style="grid-column: span 2;">
            <span class="metric-label">Total Size</span>
            <span class="metric-value" style="font-size: 16px; color: var(--accent-primary);">${formatBytes(totalBytes)}</span>
            <span style="font-size: 10.5px; color: var(--text-muted); font-family: var(--font-mono);">${totalBytes.toLocaleString()} bytes</span>
          </div>
          <div class="metric-item" style="grid-column: span 2;">
            <span class="metric-label">Size on Disk</span>
            <span class="metric-value" style="font-size: 13.5px; color: var(--accent-cyan);">${formatBytes(stats?.physicalSizeBytes || totalBytes)}</span>
            <span style="font-size: 10px; color: var(--text-muted);">Cluster allocation</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Empty Subfolders</span>
            <span class="metric-value">${emptyFolders}</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Scan Duration</span>
            <span class="metric-value">${scanDuration}s</span>
          </div>
        </div>

        <div style="margin-top: 10px; display: flex; gap: 8px;">
          ${
            isInspectorScanning
              ? `<button id="btn-cancel-scan" class="btn-danger-outline" style="flex: 1; padding: 9px 12px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 6px;">Cancel Scan</button>`
              : `<button id="btn-start-scan" class="btn-primary" style="flex: 1; padding: 9px 12px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 6px;">Analyze Storage</button>`
          }
        </div>
      </div>

      ${warningsHtml}

      <div class="inspector-card">
        <div class="card-title">Storage by File Type</div>
        <div class="type-bar">${typeBarHtml}</div>
        <div class="type-legend">${typeLegendHtml}</div>
      </div>

      <div class="inspector-card">
        <div class="card-title">Largest Files</div>
        <div class="top-items-list">${largestFilesHtml}</div>
      </div>

      <div class="inspector-card">
        <div class="card-title">Largest Direct Subfolders</div>
        <div class="top-items-list">${largestFoldersHtml}</div>
      </div>
    `;

    this.attachEvents(targetPath);
  }

  private attachEvents(targetPath: string) {
    this.container.querySelector('#btn-start-scan')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('app:start-deep-scan', { detail: { path: targetPath } }));
    });

    this.container.querySelector('#btn-cancel-scan')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('app:cancel-deep-scan'));
    });
  }
}
