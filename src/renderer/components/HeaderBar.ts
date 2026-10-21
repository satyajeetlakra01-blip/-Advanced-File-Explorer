import { appStore } from '../store/appStore';
import { contextMenu } from './ContextMenu';

export class HeaderBar {
  private container: HTMLElement;
  private isEditingPath = false;
  private isSlidingZoom = false;

  constructor() {
    this.container = document.createElement('header');
    this.container.className = 'app-header';
    this.render();

    appStore.subscribe(() => {
      if (this.isSlidingZoom) {
        return;
      }
      if (!this.isEditingPath) {
        this.render();
      } else {
        const zoomInput = this.container.querySelector('#zoom-range') as HTMLInputElement | null;
        if (zoomInput) {
          zoomInput.value = String(appStore.getState().zoomLevel ?? 0);
        }
      }
    });
  }

  get element(): HTMLElement {
    return this.container;
  }

  private render() {
    const state = appStore.getState();
    const canBack = appStore.canGoBack();
    const canForward = appStore.canGoForward();

    const selectedCount = state.selectedPaths.size;
    const hasSelection = selectedCount > 0;
    const isSingleSelection = selectedCount === 1;
    const canPaste = Boolean(state.clipboard && state.clipboard.paths.length > 0);

    this.container.innerHTML = `
      <div class="header-top-row">
        <div class="nav-controls">
          <button id="btn-back" class="btn-icon" title="Back (Alt+Left)" ${canBack ? '' : 'disabled'}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <button id="btn-forward" class="btn-icon" title="Forward (Alt+Right)" ${canForward ? '' : 'disabled'}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
          <button id="btn-up" class="btn-icon" title="Up to Parent (Alt+Up)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
          </button>
          <button id="btn-refresh" class="btn-icon" title="Refresh (F5)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
          </button>
        </div>

        <div class="breadcrumb-container" id="breadcrumb-box">
          <div class="breadcrumbs" id="breadcrumb-list"></div>
        </div>

        <div class="search-box">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input type="text" class="search-input" id="search-input" placeholder="Search ${state.currentPath ? (state.currentPath.split(/\\|\//).pop() || 'folder') : 'files'} (Ctrl+F)" value="${state.filterQuery}">
        </div>

        <div class="nav-controls header-quick-controls">
          <div class="zoom-control-pill" title="Zoom View (Ctrl+Wheel)">
            <button id="btn-zoom-out" class="zoom-btn" title="Zoom Out (Ctrl+Minus)">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
            <input type="range" id="zoom-range" min="0" max="100" step="1" value="${state.zoomLevel ?? 0}" class="zoom-range-input" />
            <button id="btn-zoom-in" class="zoom-btn" title="Zoom In (Ctrl+Plus)">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          </div>

          <button id="btn-toggle-dual-pane" class="btn-icon ${state.isDualPane ? 'active' : ''}" title="Toggle Dual-Pane (Ctrl+Shift+E)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="12" y1="3" x2="12" y2="21"/></svg>
          </button>
          <button id="btn-toggle-inspector" class="btn-icon" title="Toggle Storage Inspector (Ctrl+I)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
          </button>
        </div>
      </div>

      <div class="command-toolbar">
        <div class="toolbar-group">
          <!-- + New button with dropdown arrow -->
          <button id="tb-btn-new" class="toolbar-btn toolbar-btn-pill" title="Create new item">
            <span class="tb-icon-circle">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </span>
            <span class="tb-btn-text">New</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
          </button>
        </div>

        <div class="toolbar-separator"></div>

        <!-- Cut, Copy, Paste, Rename, Share, Delete -->
        <div class="toolbar-group">
          <button id="tb-btn-cut" class="toolbar-btn tb-icon-only ${hasSelection ? '' : 'disabled'}" title="Cut (Ctrl+X)" ${hasSelection ? '' : 'disabled'}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>
          </button>
          <button id="tb-btn-copy" class="toolbar-btn tb-icon-only ${hasSelection ? '' : 'disabled'}" title="Copy (Ctrl+C)" ${hasSelection ? '' : 'disabled'}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
          </button>
          <button id="tb-btn-paste" class="toolbar-btn tb-icon-only ${canPaste ? '' : 'disabled'}" title="Paste (Ctrl+V)" ${canPaste ? '' : 'disabled'}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
          </button>
          <button id="tb-btn-rename" class="toolbar-btn tb-icon-only ${isSingleSelection ? '' : 'disabled'}" title="Rename (F2)" ${isSingleSelection ? '' : 'disabled'}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="18" rx="3"/><path d="M9 16h6M12 8v8M9 8h6"/></svg>
          </button>
          <button id="tb-btn-share" class="toolbar-btn tb-icon-only ${hasSelection ? '' : 'disabled'}" title="Share / Copy Path (Ctrl+Shift+C)" ${hasSelection ? '' : 'disabled'}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
          </button>
          <button id="tb-btn-delete" class="toolbar-btn tb-icon-only ${hasSelection ? '' : 'disabled'}" title="Delete (Delete)" ${hasSelection ? '' : 'disabled'}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
          </button>
        </div>

        <div class="toolbar-separator"></div>

        <!-- Sort dropdown -->
        <div class="toolbar-group">
          <button id="tb-btn-sort" class="toolbar-btn toolbar-btn-pill" title="Sort options">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 20V4M3 8l4-4 4 4M17 4v16M21 16l-4 4-4-4"/></svg>
            <span class="tb-btn-text">Sort</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
          </button>
        </div>

        <!-- View dropdown -->
        <div class="toolbar-group">
          <button id="tb-btn-view" class="toolbar-btn toolbar-btn-pill" title="View options">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            <span class="tb-btn-text">View</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
          </button>
        </div>

        <!-- Filter dropdown -->
        <div class="toolbar-group">
          <button id="tb-btn-filter" class="toolbar-btn toolbar-btn-pill ${state.filterQuery ? 'active' : ''}" title="Filter items">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            <span class="tb-btn-text">Filter</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
          </button>
        </div>

        <div class="toolbar-separator"></div>

        <!-- More options (...) -->
        <div class="toolbar-group">
          <button id="tb-btn-more" class="toolbar-btn tb-icon-only" title="See more options">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
          </button>
        </div>
      </div>
    `;

    this.attachEvents();
    this.renderBreadcrumbs(state.currentPath);
  }

  private renderBreadcrumbs(currentPath: string) {
    const list = this.container.querySelector('#breadcrumb-list');
    if (!list) return;

    list.innerHTML = '';

    // Always start with the Windows 11 style Home icon segment
    const homeSegment = document.createElement('span');
    homeSegment.className = 'breadcrumb-segment breadcrumb-home-segment';
    homeSegment.title = 'Home';
    homeSegment.innerHTML = `
      <svg class="breadcrumb-home-icon" width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M12 3L2 12h3v8a1 1 0 001 1h5v-6h2v6h5a1 1 0 001-1v-8h3L12 3z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span class="breadcrumb-home-label">Home</span>
    `;

    const drives = appStore.getState().drives;
    const homeTarget = drives.length > 0 ? drives[0].mountPoint : 'C:\\';
    homeSegment.addEventListener('click', (e) => {
      e.stopPropagation();
      window.dispatchEvent(new CustomEvent('app:navigate', { detail: { path: homeTarget } }));
    });
    list.appendChild(homeSegment);

    if (!currentPath) return;

    const parts = currentPath.split(/\\|\//).filter(Boolean);
    let accum = '';

    // If on a regular path, render separator and path segments
    if (parts.length > 0) {
      const firstSep = document.createElement('span');
      firstSep.className = 'breadcrumb-separator';
      firstSep.textContent = '›';
      list.appendChild(firstSep);
    }

    parts.forEach((part, index) => {
      if (index === 0 && /^[a-zA-Z]:$/.test(part)) {
        accum = part + '\\';
      } else {
        accum = accum ? `${accum}\\${part}` : part;
      }

      const segment = document.createElement('span');
      segment.className = 'breadcrumb-segment';
      segment.textContent = part;
      const targetPath = accum;
      segment.addEventListener('click', (e) => {
        e.stopPropagation();
        window.dispatchEvent(new CustomEvent('app:navigate', { detail: { path: targetPath } }));
      });

      // Breadcrumb drop target for multi-file dragging
      segment.addEventListener('dragenter', (e) => {
        e.preventDefault();
        segment.classList.add('breadcrumb-drop-target');
      });

      segment.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer) {
          const allowed = (e.dataTransfer.effectAllowed || '').toLowerCase();
          e.dataTransfer.dropEffect =
            e.ctrlKey || (allowed !== 'move' && allowed !== 'copymove' && allowed !== 'all' && allowed !== 'uninitialized' && allowed !== '')
              ? 'copy'
              : 'move';
        }
        segment.classList.add('breadcrumb-drop-target');
      });

      segment.addEventListener('dragleave', () => {
        segment.classList.remove('breadcrumb-drop-target');
      });

      segment.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        segment.classList.remove('breadcrumb-drop-target');

        let sources: string[] = [];
        let sourcePane = appStore.getState().activePaneId;

        const activeDrag = appStore.getActiveDrag();
        if (activeDrag && activeDrag.sources?.length > 0) {
          sources = [...activeDrag.sources];
          sourcePane = activeDrag.sourcePane;
        }

        if (sources.length === 0) {
          const raw = e.dataTransfer?.getData('application/afe-pane-transfer');
          if (raw) {
            try {
              const p = JSON.parse(raw);
              sources = p.sources || [];
              sourcePane = p.sourcePane || sourcePane;
            } catch {}
          }
        }

        if (sources.length === 0 && e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
          sources = Array.from(e.dataTransfer.files)
            .map((f: any) => {
              try {
                return window.electronApi.getPathForFile?.(f) || f.path || '';
              } catch {
                return f.path || '';
              }
            })
            .filter(Boolean);
        }

        appStore.setActiveDrag(null);

        const validSources = sources.filter((src) => {
          const s = src.replace(/[\\/]+$/, '').toLowerCase();
          const d = targetPath.replace(/[\\/]+$/, '').toLowerCase();
          return s !== d && !d.startsWith(s + '\\') && !d.startsWith(s + '/');
        });

        if (validSources.length > 0) {
          window.dispatchEvent(
            new CustomEvent('app:cross-pane-transfer', {
              detail: {
                sources: validSources,
                destination: targetPath,
                mode: e.ctrlKey ? 'COPY' : 'MOVE',
                sourcePane,
                destPane: sourcePane,
              },
            })
          );
        }
      });

      list.appendChild(segment);

      if (index < parts.length - 1) {
        const sep = document.createElement('span');
        sep.className = 'breadcrumb-separator';
        sep.textContent = '›';
        list.appendChild(sep);
      }
    });

    // Clicking blank space activates text input mode
    const box = this.container.querySelector('#breadcrumb-box');
    box?.addEventListener('click', () => {
      this.activateDirectInput(currentPath);
    });
  }

  private activateDirectInput(currentPath: string) {
    if (this.isEditingPath) return;
    this.isEditingPath = true;

    const box = this.container.querySelector('#breadcrumb-box');
    if (!box) return;

    box.innerHTML = '';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'path-input-direct';
    input.value = currentPath;
    box.appendChild(input);

    input.focus();
    input.select();

    const commit = () => {
      this.isEditingPath = false;
      const val = input.value.trim();
      if (val) {
        window.dispatchEvent(new CustomEvent('app:navigate', { detail: { path: val } }));
      }
      this.render();
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        commit();
      } else if (e.key === 'Escape') {
        this.isEditingPath = false;
        this.render();
      }
    });

    input.addEventListener('blur', () => {
      commit();
    });
  }

  private attachEvents() {
    this.container.querySelector('#btn-back')?.addEventListener('click', () => {
      const prev = appStore.goBack();
      if (prev) window.dispatchEvent(new CustomEvent('app:navigate', { detail: { path: prev, pushHistory: false } }));
    });

    this.container.querySelector('#btn-forward')?.addEventListener('click', () => {
      const next = appStore.goForward();
      if (next) window.dispatchEvent(new CustomEvent('app:navigate', { detail: { path: next, pushHistory: false } }));
    });

    this.container.querySelector('#btn-up')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('app:navigate-up'));
    });

    this.container.querySelector('#btn-refresh')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('app:refresh'));
    });

    const searchInput = this.container.querySelector('#search-input') as HTMLInputElement;
    searchInput?.addEventListener('input', () => {
      const tab = appStore.getActiveTab();
      tab.filterQuery = searchInput.value.trim().toLowerCase();
      appStore.notify();
    });
    searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        searchInput.value = '';
        const tab = appStore.getActiveTab();
        tab.filterQuery = '';
        appStore.notify();
      } else if (e.key === 'Enter') {
        const query = searchInput.value.trim();
        if (query) {
          window.dispatchEvent(new CustomEvent('app:start-search', { detail: { query } }));
        }
      }
    });

    this.container.querySelector('#btn-view-details')?.addEventListener('click', () => {
      appStore.setViewMode('details');
    });

    this.container.querySelector('#btn-view-grid')?.addEventListener('click', () => {
      appStore.setViewMode('grid');
    });

    const zoomRange = this.container.querySelector('#zoom-range') as HTMLInputElement;
    zoomRange?.addEventListener('pointerdown', () => {
      this.isSlidingZoom = true;
    });
    window.addEventListener('pointerup', () => {
      if (this.isSlidingZoom) {
        this.isSlidingZoom = false;
      }
    });
    zoomRange?.addEventListener('input', () => {
      appStore.setZoomLevel(parseInt(zoomRange.value, 10));
    });

    this.container.querySelector('#btn-zoom-out')?.addEventListener('click', () => {
      appStore.adjustZoom(-1);
    });

    this.container.querySelector('#btn-zoom-in')?.addEventListener('click', () => {
      appStore.adjustZoom(1);
    });

    this.container.querySelector('#btn-toggle-dual-pane')?.addEventListener('click', () => {
      appStore.toggleDualPane();
    });

    this.container.querySelector('#btn-toggle-inspector')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('app:toggle-inspector'));
    });

    // ── Command Toolbar Event Handlers ──
    const currentPath = appStore.getState().currentPath;
    const selectedPaths = Array.from(appStore.getState().selectedPaths);

    const iconFolderSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>`;
    const iconDocSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
    const iconTabSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>`;

    // New item dropdown
    const btnNew = this.container.querySelector('#tb-btn-new');
    btnNew?.addEventListener('click', (e) => {
      e.stopPropagation();
      const rect = (btnNew as HTMLElement).getBoundingClientRect();
      contextMenu.show(rect.left, rect.bottom + 4, [
        {
          label: 'Folder',
          icon: iconFolderSvg,
          shortcut: 'Ctrl+Shift+N',
          action: () => {
            window.dispatchEvent(new CustomEvent('app:trigger-new-folder', { detail: { parentPath: currentPath } }));
          },
        },
        {
          label: 'Text Document',
          icon: iconDocSvg,
          action: async () => {
            if (!currentPath) return;
            try {
              let name = 'New Text Document.txt';
              let counter = 1;
              const existingNames = new Set(appStore.getActiveTab().items.map((i) => i.name.toLowerCase()));
              while (existingNames.has(name.toLowerCase())) {
                name = `New Text Document (${counter++}).txt`;
              }
              const fullPath = currentPath.endsWith('\\') || currentPath.endsWith('/') ? `${currentPath}${name}` : `${currentPath}\\${name}`;
              await (window as any).electronApi.executeTransfer([], currentPath, 'COPY'); // fallback or create
              window.dispatchEvent(new CustomEvent('app:refresh'));
            } catch {
              window.dispatchEvent(new CustomEvent('app:trigger-new-folder', { detail: { parentPath: currentPath } }));
            }
          },
        },
        {
          label: 'New Window Tab',
          icon: iconTabSvg,
          shortcut: 'Ctrl+T',
          action: () => {
            const newTab = appStore.createTab(appStore.getState().activePaneId, currentPath);
            if (newTab.currentPath) {
              window.dispatchEvent(new CustomEvent('app:navigate', { detail: { path: newTab.currentPath, paneId: appStore.getState().activePaneId, pushHistory: false } }));
            }
          },
        },
      ]);
    });

    // Cut
    this.container.querySelector('#tb-btn-cut')?.addEventListener('click', () => {
      if (selectedPaths.length > 0) {
        appStore.setClipboard(selectedPaths, 'MOVE');
        window.dispatchEvent(new CustomEvent('app:clipboard-changed'));
      }
    });

    // Copy
    this.container.querySelector('#tb-btn-copy')?.addEventListener('click', () => {
      if (selectedPaths.length > 0) {
        appStore.setClipboard(selectedPaths, 'COPY');
        window.dispatchEvent(new CustomEvent('app:clipboard-changed'));
      }
    });

    // Paste
    this.container.querySelector('#tb-btn-paste')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('app:trigger-paste'));
    });

    // Rename
    this.container.querySelector('#tb-btn-rename')?.addEventListener('click', () => {
      const activeTab = appStore.getActiveTab();
      const currentSelected = Array.from(activeTab.selectedPaths);
      if (currentSelected.length === 1) {
        const item = activeTab.items.find((i) => i.path.toLowerCase() === currentSelected[0].toLowerCase());
        if (item) {
          window.dispatchEvent(new CustomEvent('app:trigger-rename', { detail: { item } }));
        } else {
          window.dispatchEvent(new CustomEvent('app:trigger-rename', { detail: { path: currentSelected[0] } }));
        }
      } else {
        window.dispatchEvent(new CustomEvent('app:trigger-rename'));
      }
    });

    // Share / Copy Path
    this.container.querySelector('#tb-btn-share')?.addEventListener('click', () => {
      if (selectedPaths.length > 0) {
        const textToCopy = selectedPaths.join('\n');
        navigator.clipboard.writeText(textToCopy);
        appStore.setState({ statusMessage: `Copied ${selectedPaths.length} path${selectedPaths.length > 1 ? 's' : ''} to clipboard` });
      }
    });

    // Delete
    this.container.querySelector('#tb-btn-delete')?.addEventListener('click', () => {
      if (selectedPaths.length > 0) {
        window.dispatchEvent(new CustomEvent('app:trigger-delete', { detail: { paths: selectedPaths, permanent: false } }));
      }
    });

    // Sort Dropdown
    const btnSort = this.container.querySelector('#tb-btn-sort');
    btnSort?.addEventListener('click', (e) => {
      e.stopPropagation();
      const rect = (btnSort as HTMLElement).getBoundingClientRect();
      const tab = appStore.getActiveTab();
      const { sortField, sortDirection } = tab;

      const iconText = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>`;
      const iconClock = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
      const iconLayers = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`;
      const iconScale = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`;

      const makeSortItem = (label: string, field: 'name' | 'size' | 'modified' | 'type', dir: 'asc' | 'desc', icon: string) => {
        const checked = sortField === field && sortDirection === dir;
        return {
          label: `${label} ${dir === 'asc' ? '↑ (Ascending)' : '↓ (Descending)'}`,
          icon,
          checked,
          action: () => {
            tab.sortField = field;
            tab.sortDirection = dir;
            appStore.sortItems();
            appStore.notify();
          },
        };
      };

      contextMenu.show(rect.left, rect.bottom + 4, [
        makeSortItem('Name', 'name', 'asc', iconText),
        makeSortItem('Name', 'name', 'desc', iconText),
        makeSortItem('Date modified', 'modified', 'desc', iconClock),
        makeSortItem('Date modified', 'modified', 'asc', iconClock),
        makeSortItem('Type', 'type', 'asc', iconLayers),
        makeSortItem('Size', 'size', 'desc', iconScale),
        makeSortItem('Size', 'size', 'asc', iconScale),
      ]);
    });

    // View Dropdown
    const btnView = this.container.querySelector('#tb-btn-view');
    btnView?.addEventListener('click', (e) => {
      e.stopPropagation();
      const rect = (btnView as HTMLElement).getBoundingClientRect();
      const tab = appStore.getActiveTab();

      const iconList = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`;
      const iconGrid = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`;
      const iconEye = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;

      contextMenu.show(rect.left, rect.bottom + 4, [
        {
          label: 'Details list',
          icon: iconList,
          checked: tab.zoomLevel === 0,
          action: () => appStore.setViewMode('details'),
        },
        {
          label: 'Extra large icons (100%)',
          icon: iconGrid,
          checked: tab.zoomLevel === 100,
          action: () => {
            appStore.setViewMode('grid');
            appStore.setZoomLevel(100);
          },
        },
        {
          label: 'Large icons (75%)',
          icon: iconGrid,
          checked: tab.zoomLevel >= 70 && tab.zoomLevel <= 85,
          action: () => {
            appStore.setViewMode('grid');
            appStore.setZoomLevel(75);
          },
        },
        {
          label: 'Medium icons (50%)',
          icon: iconGrid,
          checked: tab.zoomLevel >= 40 && tab.zoomLevel <= 65,
          action: () => {
            appStore.setViewMode('grid');
            appStore.setZoomLevel(50);
          },
        },
        {
          label: 'Small icons (15%)',
          icon: iconGrid,
          checked: tab.zoomLevel > 0 && tab.zoomLevel < 40,
          action: () => {
            appStore.setViewMode('grid');
            appStore.setZoomLevel(15);
          },
        },
        { divider: true, label: '', action: () => {} },
        {
          label: 'Show hidden files',
          icon: iconEye,
          checked: appStore.getState().showHidden,
          action: () => {
            const next = !appStore.getState().showHidden;
            appStore.setState({ showHidden: next });
            const p = appStore.getState().currentPath;
            if (p) window.dispatchEvent(new CustomEvent('app:navigate', { detail: { path: p, pushHistory: false } }));
          },
        },
      ]);
    });

    // Filter Dropdown
    const btnFilter = this.container.querySelector('#tb-btn-filter');
    btnFilter?.addEventListener('click', (e) => {
      e.stopPropagation();
      const rect = (btnFilter as HTMLElement).getBoundingClientRect();
      const tab = appStore.getActiveTab();

      const applyFilter = (q: string) => {
        tab.filterQuery = q;
        appStore.notify();
      };

      const iconFolder = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>`;
      const iconCode = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`;
      const iconImage = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
      const iconDoc = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
      const iconClear = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

      contextMenu.show(rect.left, rect.bottom + 4, [
        {
          label: 'All Items',
          checked: !tab.filterQuery,
          action: () => applyFilter(''),
        },
        {
          label: 'Folders only',
          icon: iconFolder,
          action: () => {
            const input = document.getElementById('search-input') as HTMLInputElement;
            if (input) input.focus();
          },
        },
        {
          label: 'Code / Dev files',
          icon: iconCode,
          action: () => applyFilter('code'),
        },
        {
          label: 'Images & Photos',
          icon: iconImage,
          action: () => applyFilter('png'),
        },
        {
          label: 'Documents & PDFs',
          icon: iconDoc,
          action: () => applyFilter('pdf'),
        },
        { divider: true, label: '', action: () => {} },
        {
          label: 'Clear filter',
          icon: iconClear,
          disabled: !tab.filterQuery,
          action: () => applyFilter(''),
        },
      ]);
    });

    // More options (...)
    const btnMore = this.container.querySelector('#tb-btn-more');
    btnMore?.addEventListener('click', (e) => {
      e.stopPropagation();
      const rect = (btnMore as HTMLElement).getBoundingClientRect();
      const iconSelect = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`;
      const iconInvert = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>`;
      const iconClose = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
      const iconInspector = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="15" y1="3" x2="15" y2="21"/></svg>`;
      const iconSplit = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/></svg>`;
      const iconTerminal = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>`;

      contextMenu.show(rect.left - 100, rect.bottom + 4, [
        {
          label: 'Select all',
          icon: iconSelect,
          shortcut: 'Ctrl+A',
          action: () => {
            const all = appStore.getActiveTab().items.map((i) => i.path);
            appStore.setSelection(all);
          },
        },
        {
          label: 'Invert selection',
          icon: iconInvert,
          action: () => {
            const all = appStore.getActiveTab().items.map((i) => i.path);
            const currentSel = appStore.getActiveTab().selectedPaths;
            const inverted = all.filter((p) => !currentSel.has(p));
            appStore.setSelection(inverted);
          },
        },
        {
          label: 'Clear selection',
          icon: iconClose,
          action: () => appStore.clearSelection(),
        },
        { divider: true, label: '', action: () => {} },
        {
          label: 'Open Folder Inspector',
          icon: iconInspector,
          shortcut: 'Ctrl+I',
          action: () => window.dispatchEvent(new CustomEvent('app:toggle-inspector')),
        },
        {
          label: 'Toggle Dual-Pane Split',
          icon: iconSplit,
          shortcut: 'Ctrl+Shift+E',
          action: () => appStore.toggleDualPane(),
        },
        {
          label: 'Open in Windows Terminal',
          icon: iconTerminal,
          action: () => {
            if (currentPath) window.electronApi.openPath(currentPath);
          },
        },
      ]);
    });
  }
}
