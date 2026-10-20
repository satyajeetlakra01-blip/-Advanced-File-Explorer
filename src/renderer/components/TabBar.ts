import { appStore } from '../store/appStore';
import { PaneId } from '../../shared/types';

export class TabBar {
  private container: HTMLElement;
  private paneId: PaneId;

  constructor(paneId: PaneId = 'left') {
    this.paneId = paneId;
    this.container = document.createElement('nav');
    this.container.className = 'tab-bar-container';
    this.render();

    appStore.subscribe(() => {
      this.render();
    });
  }

  get element(): HTMLElement {
    return this.container;
  }

  private render() {
    const pane = appStore.getPane(this.paneId);
    const activeTabId = pane.activeTabId;

    let tabsHtml = '';
    for (const tab of pane.tabs) {
      const isActive = tab.id === activeTabId;
      const isHome = !tab.currentPath || tab.title === 'Home' || tab.currentPath.toLowerCase() === 'home';
      const displayTitle = isHome ? 'Home' : (tab.title || (tab.currentPath ? tab.currentPath.split(/\\|\//).pop() : 'Home') || 'Home');
      const tooltip = tab.currentPath || 'Home';

      const homeIconSvg = `
        <svg class="tab-home-icon" width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M12 3L2 12h3v8a1 1 0 001 1h5v-6h2v6h5a1 1 0 001-1v-8h3L12 3z" fill="#f97316"/>
        </svg>
      `;

      const folderIconSvg = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
        </svg>
      `;

      tabsHtml += `
        <div class="tab-item ${isActive ? 'active' : ''}" data-tab-id="${tab.id}" title="${tooltip}">
          <span class="tab-icon">
            ${isHome ? homeIconSvg : folderIconSvg}
          </span>
          <span class="tab-title">${displayTitle}</span>
          <button class="tab-close-btn" data-close-id="${tab.id}" title="Close tab (Ctrl+W)">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      `;
    }

    this.container.innerHTML = `
      <div class="tab-list">${tabsHtml}</div>
      <button class="btn-new-tab" id="btn-new-tab-${this.paneId}" title="New tab (Ctrl+T)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
    `;

    this.attachEvents();
  }

  private attachEvents() {
    // Tab switching and middle-click closing
    const tabItems = this.container.querySelectorAll<HTMLElement>('.tab-item');
    tabItems.forEach((item) => {
      const tabId = item.getAttribute('data-tab-id');
      if (!tabId) return;

      item.addEventListener('click', (e) => {
        // Ignore if clicked on the close button
        if ((e.target as HTMLElement).closest('.tab-close-btn')) return;
        appStore.switchTab(tabId, this.paneId);
        const currentPath = appStore.getActiveTab(this.paneId).currentPath;
        if (currentPath) {
          window.dispatchEvent(new CustomEvent('app:navigate', { detail: { path: currentPath, paneId: this.paneId, pushHistory: false } }));
        }
      });

      item.addEventListener('auxclick', (e) => {
        if (e.button === 1) {
          // Middle click closes tab
          e.preventDefault();
          appStore.closeTab(tabId, this.paneId);
        }
      });
    });

    // Close buttons
    const closeBtns = this.container.querySelectorAll<HTMLButtonElement>('.tab-close-btn');
    closeBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tabId = btn.getAttribute('data-close-id');
        if (tabId) {
          appStore.closeTab(tabId, this.paneId);
        }
      });
    });

    // New Tab button
    this.container.querySelector(`#btn-new-tab-${this.paneId}`)?.addEventListener('click', () => {
      const activeTab = appStore.getActiveTab(this.paneId);
      const newTab = appStore.createTab(this.paneId, activeTab.currentPath);
      if (newTab.currentPath) {
        window.dispatchEvent(new CustomEvent('app:navigate', { detail: { path: newTab.currentPath, paneId: this.paneId, pushHistory: false } }));
      }
    });
  }
}
