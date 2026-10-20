import { describe, it, expect, beforeEach } from 'vitest';
import { appStore } from '../../src/renderer/store/appStore';
import { PaneSyncService } from '../../src/renderer/services/PaneSyncService';

describe('Phase 6 Multi-Tab & Dual-Pane Navigation (TC-PANE)', () => {
  beforeEach(() => {
    // Reset appStore state to default single-pane
    appStore.setDualPane(false);
    appStore.setActivePane('left');
    // Close extra tabs if any
    const leftPane = appStore.getPane('left');
    while (leftPane.tabs.length > 1) {
      appStore.closeTab(leftPane.tabs[leftPane.tabs.length - 1].id, 'left');
    }
    const rightPane = appStore.getPane('right');
    while (rightPane.tabs.length > 1) {
      appStore.closeTab(rightPane.tabs[rightPane.tabs.length - 1].id, 'right');
    }
  });

  describe('Multi-Tab Operations (FR-PANE-001)', () => {
    it('creates multiple tabs with isolated histories and paths', () => {
      // 1. Initial tab
      appStore.navigate('C:\\Projects', true, 'left');
      const tab1 = appStore.getActiveTab('left');
      expect(tab1.currentPath).toBe('C:\\Projects');

      // 2. Open second tab
      const tab2 = appStore.createTab('left', 'D:\\Downloads', 'Downloads');
      expect(appStore.getPane('left').tabs.length).toBe(2);
      expect(appStore.getActiveTab('left').id).toBe(tab2.id);
      expect(appStore.getActiveTab('left').currentPath).toBe('D:\\Downloads');

      // 3. Tab 1 history remains intact
      expect(tab1.currentPath).toBe('C:\\Projects');
      expect(tab1.history).toContain('C:\\Projects');
    });

    it('cycles through tabs with wrap-around using nextTab and prevTab', () => {
      const tab1 = appStore.getActiveTab('left');
      const tab2 = appStore.createTab('left', 'C:\\DirB', 'DirB');
      const tab3 = appStore.createTab('left', 'C:\\DirC', 'DirC');

      expect(appStore.getActiveTab('left').id).toBe(tab3.id);

      // nextTab wraps around from tab 3 to tab 1
      appStore.nextTab('left');
      expect(appStore.getActiveTab('left').id).toBe(tab1.id);

      // nextTab advances to tab 2
      appStore.nextTab('left');
      expect(appStore.getActiveTab('left').id).toBe(tab2.id);

      // prevTab steps back to tab 1
      appStore.prevTab('left');
      expect(appStore.getActiveTab('left').id).toBe(tab1.id);

      // prevTab wraps backwards to tab 3
      appStore.prevTab('left');
      expect(appStore.getActiveTab('left').id).toBe(tab3.id);
    });

    it('safely closes tabs and preserves adjacent tab focus', () => {
      const tab1 = appStore.getActiveTab('left');
      const tab2 = appStore.createTab('left', 'C:\\Tab2', 'Tab2');
      const tab3 = appStore.createTab('left', 'C:\\Tab3', 'Tab3');

      expect(appStore.getPane('left').tabs.length).toBe(3);
      expect(appStore.getActiveTab('left').id).toBe(tab3.id);

      // Close active tab 3 -> switches to adjacent tab 2
      appStore.closeTab(tab3.id, 'left');
      expect(appStore.getPane('left').tabs.length).toBe(2);
      expect(appStore.getActiveTab('left').id).toBe(tab2.id);

      // Close tab 2 -> switches to tab 1
      appStore.closeTab(tab2.id, 'left');
      expect(appStore.getPane('left').tabs.length).toBe(1);
      expect(appStore.getActiveTab('left').id).toBe(tab1.id);

      // Closing the last remaining tab resets rather than removing
      appStore.closeTab(tab1.id, 'left');
      expect(appStore.getPane('left').tabs.length).toBe(1);
      expect(appStore.getActiveTab('left')).toBeDefined();
    });
  });

  describe('Dual-Pane Layout & Synchronization (FR-PANE-002, FR-PANE-003)', () => {
    it('toggles dual-pane mode and initializes right pane path', () => {
      appStore.navigate('C:\\LeftRepo', true, 'left');
      expect(appStore.getState().isDualPane).toBe(false);

      // Toggle dual-pane on
      appStore.toggleDualPane();
      expect(appStore.getState().isDualPane).toBe(true);

      // Right pane initialized with active path
      const rightTab = appStore.getActiveTab('right');
      expect(rightTab.currentPath).toBe('C:\\LeftRepo');

      // Toggle dual-pane off
      appStore.toggleDualPane();
      expect(appStore.getState().isDualPane).toBe(false);
    });

    it('switches active pane and updates top-level mirrors', () => {
      appStore.setDualPane(true);
      appStore.navigate('C:\\LeftPath', true, 'left');
      appStore.navigate('D:\\RightPath', true, 'right');

      // Focus left
      appStore.setActivePane('left');
      expect(appStore.getState().activePaneId).toBe('left');
      expect(appStore.getState().currentPath).toBe('C:\\LeftPath');

      // Focus right
      appStore.setActivePane('right');
      expect(appStore.getState().activePaneId).toBe('right');
      expect(appStore.getState().currentPath).toBe('D:\\RightPath');
    });

    it('determines cross-pane default target destination accurately', () => {
      // In single-pane mode, default destination is the active directory itself
      appStore.setDualPane(false);
      appStore.navigate('C:\\SinglePath', true, 'left');
      expect(PaneSyncService.getDestinationForActivePane()).toBe('C:\\SinglePath');

      // In dual-pane mode, default destination is the inactive pane path
      appStore.setDualPane(true);
      appStore.navigate('C:\\SourceFolder', true, 'left');
      appStore.navigate('D:\\TargetFolder', true, 'right');

      appStore.setActivePane('left');
      expect(PaneSyncService.getDestinationForActivePane()).toBe('D:\\TargetFolder');

      // Switch to right pane: inactive destination becomes left pane
      appStore.setActivePane('right');
      expect(PaneSyncService.getDestinationForActivePane()).toBe('C:\\SourceFolder');
    });
  });
});
