import {
  DriveInfo,
  FileItem,
  FolderStats,
  SortDirection,
  SortField,
  ViewMode,
  ClipboardData,
  FileOperationMode,
  TabState,
  PaneId,
  PaneState,
} from '../../shared/types';

function createInitialTab(path = '', title = 'Home'): TabState {
  const parts = path.split(/\\|\//).filter(Boolean);
  const derivedTitle = parts.length > 0 ? parts[parts.length - 1] : title;
  return {
    id: `tab-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    title: derivedTitle || 'Home',
    currentPath: path,
    history: path ? [path] : [],
    historyIndex: path ? 0 : -1,
    items: [],
    selectedPaths: new Set(),
    filterQuery: '',
    sortField: 'name',
    sortDirection: 'asc',
    viewMode: 'details',
    zoomLevel: 0,
  };
}

export interface AppState {
  // Dual-Pane & Tab architecture
  isDualPane: boolean;
  activePaneId: PaneId;
  panes: {
    left: PaneState;
    right: PaneState;
  };

  // Mirrored convenience state for the active tab in active pane
  currentPath: string;
  history: string[];
  historyIndex: number;
  items: FileItem[];
  selectedPaths: Set<string>;
  clipboard: ClipboardData | null;
  drives: DriveInfo[];
  quickAccess: { name: string; path: string; icon: string }[];
  inspectorTarget: FileItem | null;
  inspectorStats: FolderStats | null;
  inspectorScanId: string | null;
  isInspectorScanning: boolean;
  viewMode: ViewMode;
  zoomLevel: number;
  sortField: SortField;
  sortDirection: SortDirection;
  showHidden: boolean;
  filterQuery: string;
  statusMessage: string;
}

type Listener = (state: AppState) => void;

class AppStore {
  private initialLeftTab = createInitialTab('', 'Home');
  private initialRightTab = createInitialTab('', 'Home');

  private state: AppState = {
    isDualPane: false,
    activePaneId: 'left',
    panes: {
      left: {
        id: 'left',
        tabs: [this.initialLeftTab],
        activeTabId: this.initialLeftTab.id,
      },
      right: {
        id: 'right',
        tabs: [this.initialRightTab],
        activeTabId: this.initialRightTab.id,
      },
    },
    currentPath: '',
    history: [],
    historyIndex: -1,
    items: [],
    selectedPaths: new Set(),
    clipboard: null,
    drives: [],
    quickAccess: [],
    inspectorTarget: null,
    inspectorStats: null,
    inspectorScanId: null,
    isInspectorScanning: false,
    viewMode: 'details',
    zoomLevel: 0,
    sortField: 'name',
    sortDirection: 'asc',
    showHidden: false,
    filterQuery: '',
    statusMessage: 'Ready',
  };

  private listeners: Set<Listener> = new Set();

  getState(): AppState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    this.syncActiveTabMirrors();
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  private syncActiveTabMirrors() {
    const activeTab = this.getActiveTab(this.state.activePaneId);
    if (activeTab) {
      this.state.currentPath = activeTab.currentPath;
      this.state.history = activeTab.history;
      this.state.historyIndex = activeTab.historyIndex;
      this.state.items = activeTab.items;
      this.state.selectedPaths = activeTab.selectedPaths;
      this.state.filterQuery = activeTab.filterQuery;
      this.state.sortField = activeTab.sortField;
      this.state.sortDirection = activeTab.sortDirection;
      this.state.viewMode = activeTab.viewMode;
      this.state.zoomLevel = activeTab.zoomLevel ?? (activeTab.viewMode === 'details' ? 0 : 2);
    }
  }

  setViewMode(viewMode: ViewMode, paneId?: PaneId) {
    const tab = this.getActiveTab(paneId);
    tab.viewMode = viewMode;
    if (viewMode === 'details') {
      tab.zoomLevel = 0;
    } else if (tab.zoomLevel === 0) {
      tab.zoomLevel = 2; // Default medium Apple squircle card
    }
    this.notify();
  }

  setZoomLevel(level: number, paneId?: PaneId) {
    // 0 = details list view, 1..100 = fine-grained smooth card scaling
    const clamped = Math.max(0, Math.min(100, Math.round(level)));
    const tab = this.getActiveTab(paneId);
    tab.zoomLevel = clamped;
    tab.viewMode = clamped === 0 ? 'details' : 'grid';
    this.notify();
  }

  adjustZoom(delta: number, paneId?: PaneId) {
    const tab = this.getActiveTab(paneId);
    const current = tab.zoomLevel ?? (tab.viewMode === 'details' ? 0 : 50);
    this.setZoomLevel(current + delta, paneId);
  }

  setState(partial: Partial<AppState>) {
    // If viewMode or zoomLevel is provided in partial, also propagate to active tab
    if (partial.viewMode !== undefined) {
      const tab = this.getActiveTab();
      tab.viewMode = partial.viewMode;
      if (partial.viewMode === 'details') tab.zoomLevel = 0;
      else if (tab.zoomLevel === 0) tab.zoomLevel = 2;
    }
    if (partial.zoomLevel !== undefined) {
      const tab = this.getActiveTab();
      tab.zoomLevel = partial.zoomLevel;
      tab.viewMode = partial.zoomLevel === 0 ? 'details' : 'grid';
    }
    this.state = { ...this.state, ...partial };
    this.notify();
  }

  // --- Pane Management ---
  setActivePane(paneId: PaneId) {
    if (this.state.activePaneId !== paneId) {
      this.state.activePaneId = paneId;
      this.notify();
    }
  }

  toggleDualPane() {
    this.state.isDualPane = !this.state.isDualPane;
    if (this.state.isDualPane) {
      const rightTab = this.getActiveTab('right');
      if (!rightTab.currentPath && this.state.currentPath) {
        // Initialize right pane with active path if empty
        this.navigate(this.state.currentPath, true, 'right');
      }
    }
    this.notify();
  }

  setDualPane(enabled: boolean) {
    if (this.state.isDualPane !== enabled) {
      this.state.isDualPane = enabled;
      this.notify();
    }
  }

  getPane(paneId: PaneId): PaneState {
    return this.state.panes[paneId];
  }

  getInactivePane(): PaneState {
    return this.state.panes[this.state.activePaneId === 'left' ? 'right' : 'left'];
  }

  getInactivePath(): string {
    const inactiveTab = this.getActiveTab(this.state.activePaneId === 'left' ? 'right' : 'left');
    return inactiveTab.currentPath;
  }

  // --- Tab Management ---
  getActiveTab(paneId?: PaneId): TabState {
    const pId = paneId || this.state.activePaneId;
    const pane = this.state.panes[pId];
    return pane.tabs.find((t) => t.id === pane.activeTabId) || pane.tabs[0];
  }

  createTab(paneId?: PaneId, initialPath?: string, title?: string): TabState {
    const pId = paneId || this.state.activePaneId;
    const path = initialPath !== undefined ? initialPath : this.getActiveTab(pId).currentPath;
    const newTab = createInitialTab(path, title);

    const pane = this.state.panes[pId];
    pane.tabs.push(newTab);
    pane.activeTabId = newTab.id;

    this.notify();
    return newTab;
  }

  closeTab(tabId: string, paneId?: PaneId): void {
    const pId = paneId || this.state.activePaneId;
    const pane = this.state.panes[pId];

    if (pane.tabs.length <= 1) {
      // Do not close the only tab; reset it instead
      pane.tabs[0] = createInitialTab('', 'Home');
      pane.activeTabId = pane.tabs[0].id;
      this.notify();
      return;
    }

    const index = pane.tabs.findIndex((t) => t.id === tabId);
    if (index === -1) return;

    pane.tabs.splice(index, 1);
    if (pane.activeTabId === tabId) {
      // Switch to adjacent tab
      const nextIndex = Math.min(index, pane.tabs.length - 1);
      pane.activeTabId = pane.tabs[nextIndex].id;
    }

    this.notify();
  }

  switchTab(tabId: string, paneId?: PaneId): void {
    const pId = paneId || this.state.activePaneId;
    const pane = this.state.panes[pId];
    const exists = pane.tabs.some((t) => t.id === tabId);
    if (exists) {
      pane.activeTabId = tabId;
      this.state.activePaneId = pId;
      this.notify();
    }
  }

  nextTab(paneId?: PaneId): void {
    const pId = paneId || this.state.activePaneId;
    const pane = this.state.panes[pId];
    if (pane.tabs.length <= 1) return;

    const currentIndex = pane.tabs.findIndex((t) => t.id === pane.activeTabId);
    const nextIndex = (currentIndex + 1) % pane.tabs.length;
    pane.activeTabId = pane.tabs[nextIndex].id;
    this.notify();
  }

  prevTab(paneId?: PaneId): void {
    const pId = paneId || this.state.activePaneId;
    const pane = this.state.panes[pId];
    if (pane.tabs.length <= 1) return;

    const currentIndex = pane.tabs.findIndex((t) => t.id === pane.activeTabId);
    const prevIndex = (currentIndex - 1 + pane.tabs.length) % pane.tabs.length;
    pane.activeTabId = pane.tabs[prevIndex].id;
    this.notify();
  }

  // --- Navigation & History ---
  navigate(newPath: string, pushHistory = true, paneId?: PaneId) {
    const targetPaneId = paneId || this.state.activePaneId;
    const activeTab = this.getActiveTab(targetPaneId);

    if (pushHistory && newPath !== activeTab.currentPath) {
      const newHistory = activeTab.history.slice(0, activeTab.historyIndex + 1);
      newHistory.push(newPath);
      activeTab.history = newHistory;
      activeTab.historyIndex = newHistory.length - 1;
    }

    activeTab.currentPath = newPath;
    const parts = newPath.split(/\\|\//).filter(Boolean);
    activeTab.title = parts.length > 0 ? parts[parts.length - 1] : newPath || 'Home';
    activeTab.selectedPaths.clear();
    activeTab.filterQuery = '';

    this.notify();
  }

  canGoBack(paneId?: PaneId): boolean {
    const tab = this.getActiveTab(paneId);
    return tab.historyIndex > 0;
  }

  canGoForward(paneId?: PaneId): boolean {
    const tab = this.getActiveTab(paneId);
    return tab.historyIndex < tab.history.length - 1;
  }

  goBack(paneId?: PaneId): string | null {
    const tab = this.getActiveTab(paneId);
    if (this.canGoBack(paneId)) {
      tab.historyIndex -= 1;
      const target = tab.history[tab.historyIndex];
      tab.currentPath = target;
      tab.selectedPaths.clear();
      const parts = target.split(/\\|\//).filter(Boolean);
      tab.title = parts.length > 0 ? parts[parts.length - 1] : target || 'Home';
      this.notify();
      return target;
    }
    return null;
  }

  goForward(paneId?: PaneId): string | null {
    const tab = this.getActiveTab(paneId);
    if (this.canGoForward(paneId)) {
      tab.historyIndex += 1;
      const target = tab.history[tab.historyIndex];
      tab.currentPath = target;
      tab.selectedPaths.clear();
      const parts = target.split(/\\|\//).filter(Boolean);
      tab.title = parts.length > 0 ? parts[parts.length - 1] : target || 'Home';
      this.notify();
      return target;
    }
    return null;
  }

  setItems(items: FileItem[], paneId?: PaneId) {
    const tab = this.getActiveTab(paneId);
    tab.items = items;
    this.sortItems(paneId);
    this.notify();
  }

  setSelection(paths: string[], paneId?: PaneId) {
    const tab = this.getActiveTab(paneId);
    tab.selectedPaths = new Set(paths);
    this.notify();
  }

  toggleSelection(path: string, paneId?: PaneId) {
    const tab = this.getActiveTab(paneId);
    if (tab.selectedPaths.has(path)) {
      tab.selectedPaths.delete(path);
    } else {
      tab.selectedPaths.add(path);
    }
    this.notify();
  }

  setSorting(field: SortField, paneId?: PaneId) {
    const tab = this.getActiveTab(paneId);
    if (tab.sortField === field) {
      tab.sortDirection = tab.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      tab.sortField = field;
      tab.sortDirection = 'asc';
    }
    this.sortItems(paneId);
    this.notify();
  }

  sortItems(paneId?: PaneId) {
    const tab = this.getActiveTab(paneId);
    const { sortField, sortDirection } = tab;
    const factor = sortDirection === 'asc' ? 1 : -1;

    tab.items.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;

      switch (sortField) {
        case 'name':
          return factor * a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        case 'size':
          return factor * (a.sizeBytes - b.sizeBytes);
        case 'modified':
          return factor * (a.modifiedMs - b.modifiedMs);
        case 'type':
          return factor * a.typeDescription.localeCompare(b.typeDescription);
        default:
          return 0;
      }
    });
  }

  setClipboard(paths: string[], mode: FileOperationMode) {
    this.state.clipboard = { paths, mode };
    this.notify();
  }

  clearClipboard() {
    this.state.clipboard = null;
    this.notify();
  }
}

export const appStore = new AppStore();
