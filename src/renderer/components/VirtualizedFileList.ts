import { appStore } from '../store/appStore';
import { FileItem, SortField, PaneId } from '../../shared/types';
import { contextMenu } from './ContextMenu';
import { FileIcons } from './FileIcons';

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(ms: number): string {
  if (!ms) return '';
  const d = new Date(ms);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

// Card dimensions for grid view
export interface ZoomCardConfig {
  cardWidth: number;
  cardHeight: number;
  gap: number;
}

export function getZoomCardConfig(zoomLevel: number): ZoomCardConfig {
  // If legacy 1..4 levels are passed, map them cleanly: 1 -> 15, 2 -> 50, 3 -> 75, 4 -> 100
  let norm = zoomLevel;
  if (norm <= 4 && norm > 0) {
    const legacyMap: Record<number, number> = { 1: 15, 2: 50, 3: 75, 4: 100 };
    norm = legacyMap[norm] ?? 50;
  }
  const t = Math.max(0, Math.min(100, norm - 1)) / 99; // 0.0 to 1.0 across 100 steps
  const cardWidth = Math.round(80 + t * (280 - 80));
  const cardHeight = Math.round(cardWidth * 1.08);
  const gap = Math.round(8 + t * (20 - 8));
  return { cardWidth, cardHeight, gap };
}

export class VirtualizedFileList {
  public paneId: PaneId;
  private container: HTMLElement;
  private viewport: HTMLElement | null = null;
  private spacer: HTMLElement | null = null;
  private content: HTMLElement | null = null;
  private marqueeBox: HTMLElement | null = null;

  private rowHeight = 36;
  private buffer = 6;
  private focusedIndex = 0;
  private lastSelectedIndex = -1;
  private resizeObserver: ResizeObserver | null = null;

  // Selective memoization to prevent UI freeze during background scans
  private lastRenderKey = '';

  // Rectangular Marquee Selection State
  private isMarqueeActive = false;
  private marqueeStartX = 0;
  private marqueeStartY = 0;
  private marqueeInitialSelection = new Set<string>();

  constructor(paneId: PaneId = 'left') {
    this.paneId = paneId;
    this.container = document.createElement('main');
    this.container.className = `main-explorer explorer-pane-${paneId}`;
    this.container.tabIndex = 0; // Enables keyboard focus
    this.buildSkeleton();

    appStore.subscribe(() => {
      this.checkAndUpdate();
    });

    this.attachGlobalKeyboard();
    this.attachDragAndDrop();
    this.attachWheelZoom();
    this.attachMarqueeSelection();
  }

  get element(): HTMLElement {
    return this.container;
  }

  private buildSkeleton() {
    this.container.innerHTML = `
      <div class="file-table-container">
        <div class="file-table-header" id="table-header-${this.paneId}">
          <div></div>
          <div class="header-col" data-sort="name">Name <span id="sort-name-${this.paneId}"></span></div>
          <div class="header-col" data-sort="size">Size <span id="sort-size-${this.paneId}"></span></div>
          <div class="header-col" data-sort="modified">Date Modified <span id="sort-modified-${this.paneId}"></span></div>
          <div class="header-col" data-sort="type">Type <span id="sort-type-${this.paneId}"></span></div>
        </div>
        <div class="file-list-viewport" id="file-viewport-${this.paneId}">
          <div class="marquee-selection-box" id="marquee-${this.paneId}"></div>
          <div class="virtual-scroll-spacer" id="scroll-spacer-${this.paneId}" style="width: 100%; height: 0px; pointer-events: none;"></div>
          <div class="virtual-scroll-content" id="scroll-content-${this.paneId}" style="position: absolute; top: 0; left: 0; right: 0;"></div>
        </div>
      </div>
    `;

    this.viewport = this.container.querySelector(`#file-viewport-${this.paneId}`);
    this.spacer = this.container.querySelector(`#scroll-spacer-${this.paneId}`);
    this.content = this.container.querySelector(`#scroll-content-${this.paneId}`);
    this.marqueeBox = this.container.querySelector(`#marquee-${this.paneId}`);

    this.viewport?.addEventListener('scroll', () => {
      this.renderVirtualSlice();
    });

    this.resizeObserver = new ResizeObserver(() => {
      this.renderVirtualSlice();
    });
    if (this.viewport) {
      this.resizeObserver.observe(this.viewport);
    }

    // Header column sorting
    this.container.querySelectorAll('.header-col').forEach((col) => {
      col.addEventListener('click', () => {
        const field = col.getAttribute('data-sort') as SortField;
        if (field) {
          appStore.setSorting(field, this.paneId);
        }
      });
    });

    // Right-click canvas for background context menu
    this.viewport?.addEventListener('contextmenu', (e) => {
      if ((e.target as HTMLElement).closest('.file-row') || (e.target as HTMLElement).closest('.grid-card')) {
        return;
      }
      e.preventDefault();
      appStore.setActivePane(this.paneId);
      const current = appStore.getActiveTab(this.paneId).currentPath;
      contextMenu.showCanvasMenu(e.clientX, e.clientY, current);
    });

    // Focus pane on click
    this.container.addEventListener('mousedown', () => {
      appStore.setActivePane(this.paneId);
    });
  }

  private checkAndUpdate() {
    const tab = appStore.getActiveTab(this.paneId);
    const isDual = appStore.getState().isDualPane;
    const activePane = appStore.getState().activePaneId;
    const zoom = tab.zoomLevel ?? (tab.viewMode === 'details' ? 0 : 2);

    // Stable key: ignores scan progress ticks & status bar messages completely!
    const key = `${tab.currentPath}|${tab.items.length}|${tab.filterQuery}|${tab.viewMode}|${zoom}|${tab.sortField}|${tab.sortDirection}|${tab.selectedPaths.size}|${isDual}|${activePane === this.paneId}`;

    if (key !== this.lastRenderKey) {
      this.lastRenderKey = key;
      this.updateView();
    }
  }

  private getFilteredItems(): FileItem[] {
    const activeTab = appStore.getActiveTab(this.paneId);
    const { items, filterQuery } = activeTab;
    if (!filterQuery) return items;
    return items.filter((item) => item.name.toLowerCase().includes(filterQuery.toLowerCase()));
  }

  private updateView() {
    const activeTab = appStore.getActiveTab(this.paneId);
    const { sortField, sortDirection } = activeTab;
    const zoomLevel = activeTab.zoomLevel ?? (activeTab.viewMode === 'details' ? 0 : 2);
    const isDetails = zoomLevel === 0;

    const header = this.container.querySelector(`#table-header-${this.paneId}`) as HTMLElement;
    if (header) {
      header.style.display = isDetails ? 'grid' : 'none';
      ['name', 'size', 'modified', 'type'].forEach((f) => {
        const el = this.container.querySelector(`#sort-${f}-${this.paneId}`);
        if (el) {
          el.textContent = sortField === f ? (sortDirection === 'asc' ? '▲' : '▼') : '';
        }
      });
    }

    this.renderVirtualSlice();
  }

  private renderVirtualSlice() {
    if (!this.viewport || !this.spacer || !this.content) return;

    const items = this.getFilteredItems();
    const activeTab = appStore.getActiveTab(this.paneId);
    const { selectedPaths } = activeTab;
    const zoomLevel = activeTab.zoomLevel ?? (activeTab.viewMode === 'details' ? 0 : 2);
    const isDetails = zoomLevel === 0;

    if (items.length === 0) {
      this.spacer.style.height = '0px';
      this.content.style.transform = 'translateY(0px)';
      this.content.innerHTML = `
        <div class="empty-folder-state">
          <div class="empty-folder-icon">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" opacity="0.45">
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
            </svg>
          </div>
          <div class="empty-folder-title">This folder is empty</div>
          <div class="empty-folder-sub">Drag files here or press Ctrl+Shift+N to create a folder</div>
        </div>
      `;
      return;
    }

    const scrollTop = this.viewport.scrollTop;
    const viewportHeight = this.viewport.clientHeight || 500;
    const viewportWidth = this.viewport.clientWidth || 800;

    if (isDetails) {
      // Smallest View: Details Rows
      const effectiveRowHeight = this.rowHeight;
      const totalHeight = items.length * effectiveRowHeight;
      this.spacer.style.height = `${totalHeight}px`;

      const startIndex = Math.max(0, Math.floor(scrollTop / effectiveRowHeight) - this.buffer);
      const visibleCount = Math.ceil(viewportHeight / effectiveRowHeight);
      const endIndex = Math.min(items.length, startIndex + visibleCount + this.buffer * 2);
      const offsetY = startIndex * effectiveRowHeight;

      this.content.style.transform = `translateY(${offsetY}px)`;
      this.content.style.display = 'block';
      this.content.style.padding = '0';
      this.content.style.gap = '0';

      let html = '';
      for (let i = startIndex; i < endIndex; i++) {
        const item = items[i];
        const isSelected = selectedPaths.has(item.path);
        const isFocused = i === this.focusedIndex;
        const iconSvg = FileIcons.getListIcon(item, 18);

        html += `
          <div class="file-row ${isSelected ? 'selected' : ''} ${isFocused ? 'focused' : ''}" data-index="${i}" data-path="${item.path}" draggable="true" style="height:${effectiveRowHeight}px;">
            <div class="file-icon">${iconSvg}</div>
            <div class="file-name" title="${item.name}">${item.name}</div>
            <div class="file-size">${item.isDirectory ? '' : formatBytes(item.sizeBytes)}</div>
            <div class="file-date">${formatDate(item.modifiedMs)}</div>
            <div class="file-type">${item.typeDescription}</div>
          </div>
        `;
      }
      this.content.innerHTML = html;
    } else {
      // Scaled Grid View
      const config = getZoomCardConfig(zoomLevel);
      const { cardWidth, cardHeight, gap } = config;

      const availableWidth = Math.max(cardWidth, viewportWidth - 32);
      const cols = Math.max(1, Math.floor((availableWidth + gap) / (cardWidth + gap)));
      const totalRows = Math.ceil(items.length / cols);
      const rowStep = cardHeight + gap;
      const totalHeight = totalRows * rowStep;
      this.spacer.style.height = `${totalHeight}px`;

      const startRow = Math.max(0, Math.floor(scrollTop / rowStep) - 2);
      const visibleRows = Math.ceil(viewportHeight / rowStep) + 3;
      const endRow = Math.min(totalRows, startRow + visibleRows);

      const startIndex = startRow * cols;
      const endIndex = Math.min(items.length, endRow * cols);
      const offsetY = startRow * rowStep;

      this.content.style.transform = `translateY(${offsetY}px)`;
      this.content.style.display = 'grid';
      this.content.style.gridTemplateColumns = `repeat(${cols}, ${cardWidth}px)`;
      this.content.style.gap = `${gap}px`;
      this.content.style.padding = '14px 16px';

      let html = '';
      for (let i = startIndex; i < endIndex; i++) {
        const item = items[i];
        const isSelected = selectedPaths.has(item.path);
        const isFocused = i === this.focusedIndex;
        const previewHtml = FileIcons.getGridPreview(item, cardWidth);

        html += `
          <div 
            class="grid-card ${isSelected ? 'selected' : ''} ${isFocused ? 'focused' : ''} zoom-level-${zoomLevel}" 
            data-index="${i}" 
            data-path="${item.path}" 
            draggable="true" 
            style="width:${cardWidth}px; height:${cardHeight}px;"
          >
            ${previewHtml}
            <div class="grid-card-meta">
              <div class="grid-card-name" title="${item.name}">${item.name}</div>
              <div class="grid-card-size">${item.isDirectory ? 'Folder' : formatBytes(item.sizeBytes)}</div>
            </div>
          </div>
        `;
      }
      this.content.innerHTML = html;
    }

    this.attachItemEvents(items);
  }

  private attachItemEvents(visibleItems: FileItem[]) {
    if (!this.content) return;

    this.content.querySelectorAll('[data-index]').forEach((el) => {
      const index = parseInt(el.getAttribute('data-index') || '0', 10);
      const item = visibleItems[index];
      if (!item) return;

      el.addEventListener('click', (e) => {
        appStore.setActivePane(this.paneId);
        this.container.focus();
        const mouseEvent = e as MouseEvent;
        this.focusedIndex = index;

        if (mouseEvent.shiftKey && this.lastSelectedIndex !== -1) {
          const start = Math.min(this.lastSelectedIndex, index);
          const end = Math.max(this.lastSelectedIndex, index);
          const rangePaths = visibleItems.slice(start, end + 1).map((i) => i.path);
          appStore.setSelection(rangePaths, this.paneId);
        } else if (mouseEvent.ctrlKey) {
          appStore.toggleSelection(item.path, this.paneId);
          this.lastSelectedIndex = index;
        } else {
          appStore.setSelection([item.path], this.paneId);
          this.lastSelectedIndex = index;
        }

        if (item.isDirectory) {
          appStore.setState({ inspectorTarget: item });
          window.dispatchEvent(new CustomEvent('app:inspect-folder', { detail: { folder: item } }));
        }
      });

      el.addEventListener('dblclick', () => {
        appStore.setActivePane(this.paneId);
        if (item.isDirectory) {
          window.dispatchEvent(new CustomEvent('app:navigate', { detail: { path: item.path, paneId: this.paneId } }));
        } else {
          window.dispatchEvent(new CustomEvent('app:open-file', { detail: { path: item.path } }));
        }
      });

      el.addEventListener('contextmenu', (e) => {
        appStore.setActivePane(this.paneId);
        e.preventDefault();
        e.stopPropagation();
        const activeTab = appStore.getActiveTab(this.paneId);
        if (!activeTab.selectedPaths.has(item.path)) {
          appStore.setSelection([item.path], this.paneId);
        }
        const mouseEvent = e as MouseEvent;
        contextMenu.showItemMenu(mouseEvent.clientX, mouseEvent.clientY, item);
      });

      // Drag source: Native OS drag out allows dragging directly into external apps (Chrome, WhatsApp, Windows Explorer, etc.)
      el.addEventListener('dragstart', (e) => {
        const dragEvent = e as DragEvent;
        appStore.setActivePane(this.paneId);
        const activeTab = appStore.getActiveTab(this.paneId);

        let sources: string[];
        if (activeTab.selectedPaths.has(item.path)) {
          sources = Array.from(activeTab.selectedPaths);
        } else {
          sources = [item.path];
          appStore.setSelection([item.path], this.paneId);
        }

        // 1. Store active drag state in appStore for 100% reliable internal drop
        appStore.setActiveDrag({
          sources,
          sourcePane: this.paneId,
        });

        // 2. Populate HTML5 dataTransfer
        if (dragEvent.dataTransfer) {
          const payload = JSON.stringify({
            sources,
            sourcePane: this.paneId,
          });
          dragEvent.dataTransfer.setData('application/afe-pane-transfer', payload);
          dragEvent.dataTransfer.setData('text/plain', sources.join('\n'));
          const uriList = sources.map((p) => `file:///${p.replace(/\\/g, '/')}`).join('\r\n');
          dragEvent.dataTransfer.setData('text/uri-list', uriList);
          dragEvent.dataTransfer.effectAllowed = 'copyMove';
        }

        // 3. Trigger native OS drag session with Electron webContents.startDrag
        dragEvent.preventDefault();
        try {
          window.electronApi.startExternalDrag(sources);
        } catch (err) {
          console.error('[startExternalDrag] error:', err);
        }
      });

      // When dragging ends: if dropped onto an internal target, execute the drop!
      el.addEventListener('dragend', (e) => {
        const dragEvent = e as DragEvent;
        const isOutside =
          dragEvent.clientX <= 0 ||
          dragEvent.clientY <= 0 ||
          dragEvent.clientX >= window.innerWidth ||
          dragEvent.clientY >= window.innerHeight;

        const hovered = isOutside ? null : appStore.getHoveredDropTarget();
        if (hovered && hovered.path) {
          this.executeInternalDrop(hovered.path, hovered.paneId || this.paneId, dragEvent.ctrlKey);
        } else {
          appStore.setActiveDrag(null);
          appStore.setHoveredDropTarget(null);
          document.querySelectorAll('.folder-drop-target').forEach((t) => t.classList.remove('folder-drop-target'));
          document.querySelectorAll('.drag-over-active').forEach((t) => t.classList.remove('drag-over-active'));
        }
      });

      // Drag target: Allow dropping files directly into collapsed folder items!
      if (item.isDirectory) {
        el.addEventListener('dragenter', (e) => {
          (e as DragEvent).preventDefault();
          el.classList.add('folder-drop-target');
        });

        el.addEventListener('dragover', (e) => {
          const dragEvent = e as DragEvent;
          dragEvent.preventDefault();
          dragEvent.stopPropagation();
          if (dragEvent.dataTransfer) {
            const allowed = (dragEvent.dataTransfer.effectAllowed || '').toLowerCase();
            dragEvent.dataTransfer.dropEffect =
              dragEvent.ctrlKey || (allowed !== 'move' && allowed !== 'copymove' && allowed !== 'all' && allowed !== 'uninitialized' && allowed !== '')
                ? 'copy'
                : 'move';
          }
          el.classList.add('folder-drop-target');
          appStore.setHoveredDropTarget({
            type: 'folder',
            path: item.path,
            paneId: this.paneId,
          });
        });

        el.addEventListener('dragleave', (e) => {
          const dragEvent = e as DragEvent;
          const related = dragEvent.relatedTarget as HTMLElement | null;
          if (!el.contains(related)) {
            el.classList.remove('folder-drop-target');
            if (appStore.getHoveredDropTarget()?.path === item.path) {
              const activePath = appStore.getActiveTab(this.paneId).currentPath;
              if (activePath) {
                appStore.setHoveredDropTarget({
                  type: 'pane',
                  path: activePath,
                  paneId: this.paneId,
                });
              } else {
                appStore.setHoveredDropTarget(null);
              }
            }
          }
        });

        el.addEventListener('drop', (e) => {
          const dragEvent = e as DragEvent;
          dragEvent.preventDefault();
          dragEvent.stopPropagation();
          el.classList.remove('folder-drop-target');

          let fallbackSources: string[] = [];
          if (dragEvent.dataTransfer?.files && dragEvent.dataTransfer.files.length > 0) {
            fallbackSources = Array.from(dragEvent.dataTransfer.files)
              .map((f: any) => {
                try {
                  return window.electronApi.getPathForFile?.(f) || f.path || '';
                } catch {
                  return f.path || '';
                }
              })
              .filter(Boolean);
          }

          this.executeInternalDrop(item.path, this.paneId, dragEvent.ctrlKey, fallbackSources);
        });
      }
    });
  }

  // --- Wheel Zoom: Ctrl + Wheel ---
  private attachWheelZoom() {
    if (!this.viewport) return;

    this.viewport.addEventListener(
      'wheel',
      (e) => {
        if (e.ctrlKey) {
          e.preventDefault();
          const delta = e.deltaY < 0 ? 4 : -4;
          appStore.adjustZoom(delta, this.paneId);
        }
      },
      { passive: false }
    );
  }

  // --- Rectangular Marquee Box Selection ---
  private attachMarqueeSelection() {
    if (!this.viewport || !this.marqueeBox) return;

    this.viewport.addEventListener('mousedown', (e: MouseEvent) => {
      // Don't start marquee if user clicked on a file item or header
      const target = e.target as HTMLElement;
      if (
        target.closest('.file-row') ||
        target.closest('.grid-card') ||
        target.closest('.header-col') ||
        e.button !== 0 // Only left click
      ) {
        return;
      }

      appStore.setActivePane(this.paneId);
      const viewportRect = this.viewport!.getBoundingClientRect();

      this.isMarqueeActive = true;
      this.marqueeStartX = e.clientX - viewportRect.left + this.viewport!.scrollLeft;
      this.marqueeStartY = e.clientY - viewportRect.top + this.viewport!.scrollTop;

      const activeTab = appStore.getActiveTab(this.paneId);
      this.marqueeInitialSelection = e.ctrlKey || e.shiftKey ? new Set(activeTab.selectedPaths) : new Set();

      if (!e.ctrlKey && !e.shiftKey) {
        appStore.setSelection([], this.paneId);
      }

      this.marqueeBox!.style.left = `${this.marqueeStartX}px`;
      this.marqueeBox!.style.top = `${this.marqueeStartY}px`;
      this.marqueeBox!.style.width = '0px';
      this.marqueeBox!.style.height = '0px';
      this.marqueeBox!.style.display = 'block';
    });

    window.addEventListener('mousemove', (e: MouseEvent) => {
      if (!this.isMarqueeActive || !this.viewport || !this.marqueeBox || !this.content) return;

      const viewportRect = this.viewport.getBoundingClientRect();
      const currentX = e.clientX - viewportRect.left + this.viewport.scrollLeft;
      const currentY = e.clientY - viewportRect.top + this.viewport.scrollTop;

      const boxLeft = Math.min(this.marqueeStartX, currentX);
      const boxTop = Math.min(this.marqueeStartY, currentY);
      const boxWidth = Math.abs(currentX - this.marqueeStartX);
      const boxHeight = Math.abs(currentY - this.marqueeStartY);

      this.marqueeBox.style.left = `${boxLeft}px`;
      this.marqueeBox.style.top = `${boxTop}px`;
      this.marqueeBox.style.width = `${boxWidth}px`;
      this.marqueeBox.style.height = `${boxHeight}px`;

      if (boxWidth < 4 && boxHeight < 4) return;

      // Real-time AABB Intersection against rendered DOM elements
      const boxRight = boxLeft + boxWidth;
      const boxBottom = boxTop + boxHeight;

      const newSelected = new Set(this.marqueeInitialSelection);
      const itemElements = this.content.querySelectorAll('[data-path]');

      itemElements.forEach((itemEl) => {
        const htmlItem = itemEl as HTMLElement;
        const itemLeft = htmlItem.offsetLeft;
        const itemTop = htmlItem.offsetTop;
        const itemRight = itemLeft + htmlItem.offsetWidth;
        const itemBottom = itemTop + htmlItem.offsetHeight;

        const intersects = !(boxLeft > itemRight || boxRight < itemLeft || boxTop > itemBottom || boxBottom < itemTop);

        const path = htmlItem.getAttribute('data-path');
        if (path) {
          if (intersects) {
            newSelected.add(path);
          } else if (!this.marqueeInitialSelection.has(path)) {
            newSelected.delete(path);
          }
        }
      });

      appStore.setSelection(Array.from(newSelected), this.paneId);
    });

    window.addEventListener('mouseup', () => {
      if (this.isMarqueeActive && this.marqueeBox) {
        this.isMarqueeActive = false;
        this.marqueeBox.style.display = 'none';
      }
    });
  }

  private attachDragAndDrop() {
    this.container.addEventListener('dragenter', (e) => {
      e.preventDefault();
    });

    this.container.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (e.dataTransfer) {
        const allowed = (e.dataTransfer.effectAllowed || '').toLowerCase();
        e.dataTransfer.dropEffect =
          e.ctrlKey || (allowed !== 'move' && allowed !== 'copymove' && allowed !== 'all' && allowed !== 'uninitialized' && allowed !== '')
            ? 'copy'
            : 'move';
      }
      this.container.classList.add('drag-over-active');
      const activePath = appStore.getActiveTab(this.paneId).currentPath;
      if (activePath) {
        const currentTarget = appStore.getHoveredDropTarget();
        if (!currentTarget || currentTarget.type !== 'folder') {
          appStore.setHoveredDropTarget({
            type: 'pane',
            path: activePath,
            paneId: this.paneId,
          });
        }
      }
    });

    this.container.addEventListener('dragleave', (e) => {
      const related = e.relatedTarget as HTMLElement | null;
      if (!this.container.contains(related)) {
        this.container.classList.remove('drag-over-active');
        const currentTarget = appStore.getHoveredDropTarget();
        if (currentTarget && currentTarget.type === 'pane' && currentTarget.paneId === this.paneId) {
          appStore.setHoveredDropTarget(null);
        }
      }
    });

    this.container.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.container.classList.remove('drag-over-active');

      const dest = appStore.getActiveTab(this.paneId).currentPath;
      if (!dest) return;

      let fallbackSources: string[] = [];
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        fallbackSources = Array.from(e.dataTransfer.files)
          .map((f: any) => {
            try {
              return window.electronApi.getPathForFile?.(f) || f.path || '';
            } catch {
              return f.path || '';
            }
          })
          .filter(Boolean);
      }

      this.executeInternalDrop(dest, this.paneId, e.ctrlKey, fallbackSources);
    });
  }

  public executeInternalDrop(
    destinationPath: string,
    destPaneId: PaneId,
    isCopyMode: boolean,
    fallbackSources?: string[]
  ) {
    let sources: string[] = [];
    let sourcePane: PaneId | undefined = undefined;

    // 1. Check in-memory active drag state
    const activeDrag = appStore.getActiveDrag();
    if (activeDrag && activeDrag.sources?.length > 0) {
      sources = [...activeDrag.sources];
      sourcePane = activeDrag.sourcePane;
    }

    // 2. Check fallback sources (e.g. from desktop or external explorer)
    if (sources.length === 0 && fallbackSources && fallbackSources.length > 0) {
      sources = [...fallbackSources];
    }

    // Clean up drag states and visual indicators immediately
    appStore.setActiveDrag(null);
    appStore.setHoveredDropTarget(null);
    document.querySelectorAll('.folder-drop-target').forEach((t) => t.classList.remove('folder-drop-target'));
    document.querySelectorAll('.drag-over-active').forEach((t) => t.classList.remove('drag-over-active'));

    if (sources.length === 0 || !destinationPath) {
      return;
    }

    // 3. Prevent dropping a folder into itself or its own subdirectories
    const destClean = destinationPath.replace(/[\\/]+$/, '').toLowerCase();
    const validSources = sources.filter((src) => {
      const srcClean = src.replace(/[\\/]+$/, '').toLowerCase();
      if (srcClean === destClean) return false;
      if (destClean.startsWith(srcClean + '\\') || destClean.startsWith(srcClean + '/')) return false;
      return true;
    });

    if (validSources.length === 0) {
      return;
    }

    // 4. If dropping into the exact same folder within the same pane, ignore unless copying
    const isSameFolder = validSources.every((s) => {
      const parent = s.replace(/[\\/][^\\/]+$/, '').toLowerCase();
      return parent === destClean;
    });
    const isSamePane = sourcePane === destPaneId;
    if (isSameFolder && isSamePane && !isCopyMode) {
      return;
    }

    const mode = isCopyMode || !sourcePane ? 'COPY' : 'MOVE';

    // 5. Trigger cross-pane transfer
    window.dispatchEvent(
      new CustomEvent('app:cross-pane-transfer', {
        detail: {
          sources: validSources,
          destination: destinationPath,
          mode,
          sourcePane: sourcePane || destPaneId,
          destPane: destPaneId,
        },
      })
    );
  }

  private attachGlobalKeyboard() {
    this.container.addEventListener('keydown', (e) => {
      // Zoom shortcuts: Ctrl + '=', Ctrl + '-', Ctrl + '0'
      if (e.ctrlKey && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        appStore.adjustZoom(5, this.paneId);
        return;
      }
      if (e.ctrlKey && (e.key === '-' || e.key === '_')) {
        e.preventDefault();
        appStore.adjustZoom(-5, this.paneId);
        return;
      }
      if (e.ctrlKey && e.key === '0') {
        e.preventDefault();
        appStore.setZoomLevel(50, this.paneId);
        return;
      }

      const items = this.getFilteredItems();
      if (items.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.focusedIndex = Math.min(items.length - 1, this.focusedIndex + 1);
        const item = items[this.focusedIndex];
        if (item) {
          appStore.setSelection([item.path], this.paneId);
          this.ensureIndexVisible(this.focusedIndex);
          if (item.isDirectory) {
            appStore.setState({ inspectorTarget: item });
            window.dispatchEvent(new CustomEvent('app:inspect-folder', { detail: { folder: item } }));
          }
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.focusedIndex = Math.max(0, this.focusedIndex - 1);
        const item = items[this.focusedIndex];
        if (item) {
          appStore.setSelection([item.path], this.paneId);
          this.ensureIndexVisible(this.focusedIndex);
          if (item.isDirectory) {
            appStore.setState({ inspectorTarget: item });
            window.dispatchEvent(new CustomEvent('app:inspect-folder', { detail: { folder: item } }));
          }
        }
      } else if (e.key === 'Enter') {
        const item = items[this.focusedIndex];
        if (item) {
          if (item.isDirectory) {
            window.dispatchEvent(new CustomEvent('app:navigate', { detail: { path: item.path, paneId: this.paneId } }));
          } else {
            window.dispatchEvent(new CustomEvent('app:open-file', { detail: { path: item.path } }));
          }
        }
      } else if (e.key === 'Backspace') {
        window.dispatchEvent(new CustomEvent('app:navigate-up', { detail: { paneId: this.paneId } }));
      } else if (e.key === ' ' && !e.ctrlKey) {
        e.preventDefault();
        const item = items[this.focusedIndex];
        if (item) {
          appStore.toggleSelection(item.path, this.paneId);
        }
      } else if (e.ctrlKey && e.key === 'a') {
        e.preventDefault();
        appStore.setSelection(items.map((i) => i.path), this.paneId);
      } else if (e.key === 'F2') {
        const activeTab = appStore.getActiveTab(this.paneId);
        let targetItem: FileItem | undefined;
        if (activeTab.selectedPaths.size === 1) {
          const selPath = Array.from(activeTab.selectedPaths)[0];
          targetItem = items.find((i) => i.path.toLowerCase() === selPath.toLowerCase());
        }
        if (!targetItem) {
          targetItem = items[this.focusedIndex];
        }
        if (targetItem) {
          window.dispatchEvent(new CustomEvent('app:trigger-rename', { detail: { item: targetItem } }));
        }
      } else if (e.key === 'Delete') {
        const activeTab = appStore.getActiveTab(this.paneId);
        if (activeTab.selectedPaths.size > 0) {
          window.dispatchEvent(new CustomEvent('app:trigger-delete', { detail: { paths: Array.from(activeTab.selectedPaths) } }));
        }
      }
    });
  }

  private ensureIndexVisible(index: number) {
    if (!this.viewport) return;
    const tab = appStore.getActiveTab(this.paneId);
    const zoomLevel = tab.zoomLevel ?? (tab.viewMode === 'details' ? 0 : 2);
    const isDetails = zoomLevel === 0;

    if (isDetails) {
      const effectiveHeight = this.rowHeight;
      const targetTop = index * effectiveHeight;
      const targetBottom = targetTop + effectiveHeight;

      if (targetTop < this.viewport.scrollTop) {
        this.viewport.scrollTop = targetTop;
      } else if (targetBottom > this.viewport.scrollTop + this.viewport.clientHeight) {
        this.viewport.scrollTop = targetBottom - this.viewport.clientHeight;
      }
    }
  }
}
