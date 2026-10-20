import { FileItem } from '../../shared/types';
import { appStore } from '../store/appStore';

export interface ContextMenuItem {
  label: string;
  icon?: string;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
  checked?: boolean;
  action: () => void;
}

export class ContextMenu {
  private menuElement: HTMLElement | null = null;

  constructor() {
    window.addEventListener('click', () => this.hide());
    window.addEventListener('contextmenu', (e) => {
      if (this.menuElement && !this.menuElement.contains(e.target as Node)) {
        this.hide();
      }
    });
  }

  show(x: number, y: number, items: ContextMenuItem[]) {
    this.hide();

    const menu = document.createElement('div');
    menu.className = 'context-menu-flyout';
    menu.style.position = 'fixed';
    menu.style.zIndex = '9999';

    const estimatedHeight = items.reduce((h, it) => h + (it.divider ? 9 : 30), 8);
    const adjustedX = Math.min(x, window.innerWidth - 232);
    const adjustedY = Math.min(y, window.innerHeight - estimatedHeight - 8);
    menu.style.left = `${Math.max(8, adjustedX)}px`;
    menu.style.top = `${Math.max(8, adjustedY)}px`;

    items.forEach((item) => {
      if (item.divider) {
        const div = document.createElement('div');
        div.className = 'context-menu-divider';
        menu.appendChild(div);
        return;
      }

      const row = document.createElement('div');
      row.className = `context-menu-item ${item.danger ? 'danger' : ''} ${item.disabled ? 'disabled' : ''}`;
      if (item.disabled) {
        row.style.opacity = '0.4';
        row.style.pointerEvents = 'none';
      }

      row.innerHTML = `
        <span class="context-item-icon">${item.icon || ''}</span>
        <span class="context-item-label">${item.label}</span>
        ${item.checked ? '<span class="context-item-check">✓</span>' : ''}
        ${item.shortcut ? `<span class="context-item-shortcut">${item.shortcut}</span>` : ''}
      `;

      row.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hide();
        if (!item.disabled) {
          item.action();
        }
      });

      menu.appendChild(row);
    });

    document.body.appendChild(menu);
    this.menuElement = menu;

    // Animate in
    menu.style.opacity = '0';
    menu.style.transform = 'scale(0.95) translateY(-4px)';
    menu.style.transition = 'opacity 0.12s ease, transform 0.12s ease';
    requestAnimationFrame(() => {
      menu.style.opacity = '1';
      menu.style.transform = 'scale(1) translateY(0)';
    });
  }

  hide() {
    if (this.menuElement) {
      this.menuElement.remove();
      this.menuElement = null;
    }
  }

  showItemMenu(x: number, y: number, item: FileItem) {
    const { selectedPaths } = appStore.getState();
    const targetPaths = selectedPaths.has(item.path) ? Array.from(selectedPaths) : [item.path];

    const iconFolder = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>`;
    const iconFile = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
    const iconEye = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
    const iconTab = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>`;
    const iconArrowRight = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`;
    const iconArrowUpRight = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>`;
    const iconTerminal = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>`;
    const iconCut = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>`;
    const iconCopy = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`;
    const iconLink = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>`;
    const iconChart = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`;
    const iconEdit = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
    const iconTrash = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>`;
    const iconBurn = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z"/></svg>`;

    const items: ContextMenuItem[] = [
      {
        label: item.isDirectory ? 'Open Folder' : 'Open File',
        icon: item.isDirectory ? iconFolder : iconFile,
        shortcut: 'Enter',
        action: () => {
          if (item.isDirectory) {
            window.dispatchEvent(new CustomEvent('app:navigate', { detail: { path: item.path } }));
          } else {
            window.dispatchEvent(new CustomEvent('app:open-file', { detail: { path: item.path } }));
          }
        },
      },
      ...(!item.isDirectory
        ? [
            {
              label: 'Preview File',
              icon: iconEye,
              shortcut: 'Space',
              action: () => {
                window.dispatchEvent(new CustomEvent('app:preview-file', { detail: { path: item.path } }));
              },
            },
          ]
        : []),
      ...(item.isDirectory
        ? [
            {
              label: 'Open in New Tab',
              icon: iconTab,
              shortcut: 'Ctrl+T',
              action: () => {
                appStore.createTab(appStore.getState().activePaneId, item.path, item.name);
                window.dispatchEvent(
                  new CustomEvent('app:navigate', {
                    detail: { path: item.path, paneId: appStore.getState().activePaneId },
                  })
                );
              },
            },
          ]
        : []),
      ...(appStore.getState().isDualPane
        ? [
            {
              label: 'Copy to Other Pane',
              icon: iconArrowRight,
              action: () => {
                const dest = appStore.getInactivePath();
                if (dest) {
                  window.dispatchEvent(
                    new CustomEvent('app:cross-pane-transfer', {
                      detail: {
                        sources: targetPaths,
                        destination: dest,
                        mode: 'COPY',
                        sourcePane: appStore.getState().activePaneId,
                        destPane: appStore.getState().activePaneId === 'left' ? 'right' : 'left',
                      },
                    })
                  );
                }
              },
            },
            {
              label: 'Move to Other Pane',
              icon: iconArrowUpRight,
              action: () => {
                const dest = appStore.getInactivePath();
                if (dest) {
                  window.dispatchEvent(
                    new CustomEvent('app:cross-pane-transfer', {
                      detail: {
                        sources: targetPaths,
                        destination: dest,
                        mode: 'MOVE',
                        sourcePane: appStore.getState().activePaneId,
                        destPane: appStore.getState().activePaneId === 'left' ? 'right' : 'left',
                      },
                    })
                  );
                }
              },
            },
          ]
        : []),
      {
        label: 'Open in Terminal',
        icon: iconTerminal,
        action: () => {
          const targetDir = item.isDirectory ? item.path : item.path.substring(0, item.path.lastIndexOf('\\'));
          window.electronApi.openPath(targetDir);
        },
      },
      { divider: true, label: '', action: () => {} },
      {
        label: 'Cut',
        icon: iconCut,
        shortcut: 'Ctrl+X',
        action: () => {
          appStore.setClipboard(targetPaths, 'MOVE');
          window.dispatchEvent(new CustomEvent('app:clipboard-changed'));
        },
      },
      {
        label: 'Copy',
        icon: iconCopy,
        shortcut: 'Ctrl+C',
        action: () => {
          appStore.setClipboard(targetPaths, 'COPY');
          window.dispatchEvent(new CustomEvent('app:clipboard-changed'));
        },
      },
      {
        label: 'Copy Full Path',
        icon: iconLink,
        shortcut: 'Ctrl+Shift+C',
        action: () => {
          navigator.clipboard.writeText(item.path);
          appStore.setState({ statusMessage: 'Path copied to clipboard' });
        },
      },
      { divider: true, label: '', action: () => {} },
      {
        label: 'Inspect Storage Footprint',
        icon: iconChart,
        shortcut: 'Alt+Enter',
        action: () => {
          if (item.isDirectory) {
            appStore.setState({ inspectorTarget: item });
            window.dispatchEvent(new CustomEvent('app:start-deep-scan', { detail: { path: item.path } }));
          }
        },
      },
      {
        label: 'Rename',
        icon: iconEdit,
        shortcut: 'F2',
        action: () => {
          window.dispatchEvent(new CustomEvent('app:trigger-rename', { detail: { item } }));
        },
      },
      { divider: true, label: '', action: () => {} },
      {
        label: 'Delete to Recycle Bin',
        icon: iconTrash,
        shortcut: 'Delete',
        danger: true,
        action: () => {
          window.dispatchEvent(new CustomEvent('app:trigger-delete', { detail: { paths: targetPaths, permanent: false } }));
        },
      },
      {
        label: 'Permanently Delete',
        icon: iconBurn,
        shortcut: 'Shift+Delete',
        danger: true,
        action: () => {
          window.dispatchEvent(new CustomEvent('app:trigger-delete', { detail: { paths: targetPaths, permanent: true } }));
        },
      },
    ];

    this.show(x, y, items);
  }

  showCanvasMenu(x: number, y: number, currentPath: string) {
    const clipboard = appStore.getState().clipboard;
    const tab = appStore.getActiveTab();
    const { sortField, sortDirection } = tab;

    const sortLabel = (field: string, dir: 'asc' | 'desc') => {
      const isActive = sortField === field && sortDirection === dir;
      const arrow = dir === 'asc' ? '↑' : '↓';
      return { checked: isActive, arrow };
    };

    const makeSortItem = (label: string, field: 'name' | 'size' | 'modified' | 'type', dir: 'asc' | 'desc', iconSvg: string): ContextMenuItem => {
      const { checked, arrow } = sortLabel(field, dir);
      return {
        label: `${label} ${arrow}`,
        icon: iconSvg,
        checked,
        action: () => {
          tab.sortField = field;
          tab.sortDirection = dir;
          appStore.sortItems();
          appStore.notify();
        },
      };
    };

    const iconFolder = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>`;
    const iconPaste = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>`;
    const iconRefresh = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>`;
    const iconText = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>`;
    const iconScale = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`;
    const iconClock = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
    const iconLayers = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`;
    const iconList = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`;
    const iconGrid = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`;
    const iconSelect = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`;

    const items: ContextMenuItem[] = [
      {
        label: 'New Folder',
        icon: iconFolder,
        shortcut: 'Ctrl+Shift+N',
        action: () => {
          window.dispatchEvent(new CustomEvent('app:trigger-new-folder', { detail: { parentPath: currentPath } }));
        },
      },
      {
        label: clipboard ? `Paste (${clipboard.paths.length} item${clipboard.paths.length > 1 ? 's' : ''})` : 'Paste',
        icon: iconPaste,
        shortcut: 'Ctrl+V',
        disabled: !clipboard || clipboard.paths.length === 0,
        action: () => {
          window.dispatchEvent(new CustomEvent('app:trigger-paste'));
        },
      },
      {
        label: 'Refresh',
        icon: iconRefresh,
        shortcut: 'F5',
        action: () => {
          window.dispatchEvent(new CustomEvent('app:refresh'));
        },
      },
      { divider: true, label: '', action: () => {} },
      // ── Sort section ──
      makeSortItem('Name', 'name', 'asc', iconText),
      makeSortItem('Name', 'name', 'desc', iconText),
      makeSortItem('Size', 'size', 'asc', iconScale),
      makeSortItem('Size', 'size', 'desc', iconScale),
      makeSortItem('Date', 'modified', 'asc', iconClock),
      makeSortItem('Date', 'modified', 'desc', iconClock),
      makeSortItem('Type', 'type', 'asc', iconLayers),
      makeSortItem('Type', 'type', 'desc', iconLayers),
      { divider: true, label: '', action: () => {} },
      // ── View section ──
      {
        label: 'Details View',
        icon: iconList,
        checked: tab.zoomLevel === 0,
        action: () => appStore.setViewMode('details'),
      },
      {
        label: 'Grid View',
        icon: iconGrid,
        checked: (tab.zoomLevel ?? 0) > 0,
        action: () => appStore.setViewMode('grid'),
      },
      { divider: true, label: '', action: () => {} },
      {
        label: 'Select All',
        icon: iconSelect,
        shortcut: 'Ctrl+A',
        action: () => {
          const all = appStore.getActiveTab().items.map((i) => i.path);
          appStore.setSelection(all);
        },
      },
    ];

    this.show(x, y, items);
  }
}

export const contextMenu = new ContextMenu();
