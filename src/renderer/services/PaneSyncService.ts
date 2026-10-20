import { appStore } from '../store/appStore';
import { FileOperationMode } from '../../shared/types';
import { Modals } from '../components/Modals';

export class PaneSyncService {
  static getDestinationForActivePane(): string | null {
    const { isDualPane } = appStore.getState();
    if (isDualPane) {
      // In dual-pane mode, default destination is the inactive pane's active path
      const inactivePath = appStore.getInactivePath();
      if (inactivePath) return inactivePath;
    }
    // In single-pane mode, default to active path
    return appStore.getState().currentPath || null;
  }

  static async transferSelectionToOtherPane(mode: FileOperationMode): Promise<void> {
    const { isDualPane, activePaneId } = appStore.getState();
    if (!isDualPane) {
      Modals.showToast('Enable Dual-Pane (Ctrl+Shift+E) to copy/move directly between panes.');
      return;
    }

    const activeTab = appStore.getActiveTab(activePaneId);
    const sources = Array.from(activeTab.selectedPaths);
    if (sources.length === 0) {
      Modals.showToast('No items selected to transfer.');
      return;
    }

    const destination = appStore.getInactivePath();
    if (!destination) {
      Modals.showToast('Opposite pane has no active directory opened.');
      return;
    }

    // Dispatch cross-pane transfer event
    window.dispatchEvent(
      new CustomEvent('app:cross-pane-transfer', {
        detail: {
          sources,
          destination,
          mode,
          sourcePane: activePaneId,
          destPane: activePaneId === 'left' ? 'right' : 'left',
        },
      })
    );
  }
}
