import { appStore } from '../store/appStore';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export class NavigationSidebar {
  private container: HTMLElement;

  constructor() {
    this.container = document.createElement('aside');
    this.container.className = 'sidebar';
    this.render();

    appStore.subscribe(() => {
      this.render();
    });
  }

  get element(): HTMLElement {
    return this.container;
  }

  private render() {
    const { drives, quickAccess, currentPath } = appStore.getState();

    let drivesHtml = '';
    for (const drive of drives) {
      const isActive = currentPath.toLowerCase().startsWith(drive.letter.toLowerCase());
      drivesHtml += `
        <div class="sidebar-item ${isActive ? 'active' : ''}" data-path="${drive.mountPoint}">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;">
            <rect x="2" y="4" width="20" height="16" rx="2"/><circle cx="6" cy="12" r="1.5"/><circle cx="10" cy="12" r="1.5"/><line x1="18" y1="12" x2="18.01" y2="12"/>
          </svg>
          <div style="flex: 1; overflow: hidden;">
            <div style="display:flex; justify-content:space-between; font-weight:500;">
              <span>${drive.label}</span>
              <span style="font-size:11px; color:var(--text-muted); font-family:var(--font-mono);">${formatBytes(drive.freeBytes)} free</span>
            </div>
            <div class="drive-bar">
              <div class="drive-bar-fill" style="width: ${drive.percentUsed}%;"></div>
            </div>
          </div>
        </div>
      `;
    }

    let quickAccessHtml = '';
    for (const item of quickAccess) {
      const isActive = currentPath.toLowerCase() === item.path.toLowerCase();
      quickAccessHtml += `
        <div class="sidebar-item ${isActive ? 'active' : ''}" data-path="${item.path}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <span>${item.name}</span>
        </div>
      `;
    }

    this.container.innerHTML = `
      <div>
        <div class="sidebar-section-title">Drives</div>
        <div class="sidebar-items">${drivesHtml}</div>
      </div>
      <div>
        <div class="sidebar-section-title">Quick Access</div>
        <div class="sidebar-items">${quickAccessHtml}</div>
      </div>
    `;

    this.attachEvents();
  }

  private attachEvents() {
    this.container.querySelectorAll('.sidebar-item').forEach((item) => {
      item.addEventListener('click', () => {
        const targetPath = item.getAttribute('data-path');
        if (targetPath) {
          window.dispatchEvent(new CustomEvent('app:navigate', { detail: { path: targetPath } }));
        }
      });
    });
  }
}
