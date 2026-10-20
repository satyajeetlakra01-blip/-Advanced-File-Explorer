import { appStore } from '../store/appStore';
import { TabBar } from './TabBar';
import { VirtualizedFileList } from './VirtualizedFileList';
import { PaneId } from '../../shared/types';

export class DualPaneContainer {
  private container: HTMLElement;
  private leftPaneElement: HTMLElement;
  private rightPaneElement: HTMLElement;
  private dividerElement: HTMLElement;

  public leftTabBar: TabBar;
  public rightTabBar: TabBar;
  public leftFileList: VirtualizedFileList;
  public rightFileList: VirtualizedFileList;

  private isDraggingDivider = false;
  private splitRatio = 0.5; // Default 50/50 split

  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'dual-pane-container';

    // 1. Left Pane
    this.leftPaneElement = document.createElement('div');
    this.leftPaneElement.className = 'explorer-pane pane-left pane-active';
    this.leftTabBar = new TabBar('left');
    this.leftFileList = new VirtualizedFileList('left');
    this.leftPaneElement.appendChild(this.leftTabBar.element);
    this.leftPaneElement.appendChild(this.leftFileList.element);

    // 2. Resizable Divider
    this.dividerElement = document.createElement('div');
    this.dividerElement.className = 'pane-divider';
    this.dividerElement.style.display = 'none';

    // 3. Right Pane
    this.rightPaneElement = document.createElement('div');
    this.rightPaneElement.className = 'explorer-pane pane-right';
    this.rightPaneElement.style.display = 'none';
    this.rightTabBar = new TabBar('right');
    this.rightFileList = new VirtualizedFileList('right');
    this.rightPaneElement.appendChild(this.rightTabBar.element);
    this.rightPaneElement.appendChild(this.rightFileList.element);

    this.container.appendChild(this.leftPaneElement);
    this.container.appendChild(this.dividerElement);
    this.container.appendChild(this.rightPaneElement);

    this.updateLayout();
    this.attachEvents();

    appStore.subscribe(() => {
      this.updateLayout();
    });
  }

  get element(): HTMLElement {
    return this.container;
  }

  private updateLayout() {
    const { isDualPane, activePaneId } = appStore.getState();

    if (isDualPane) {
      this.dividerElement.style.display = 'block';
      this.rightPaneElement.style.display = 'flex';

      const leftPercent = (this.splitRatio * 100).toFixed(1);
      const rightPercent = ((1 - this.splitRatio) * 100).toFixed(1);

      this.leftPaneElement.style.flex = `0 0 calc(${leftPercent}% - 3px)`;
      this.rightPaneElement.style.flex = `0 0 calc(${rightPercent}% - 3px)`;

      if (activePaneId === 'left') {
        this.leftPaneElement.classList.add('pane-active');
        this.rightPaneElement.classList.remove('pane-active');
      } else {
        this.rightPaneElement.classList.add('pane-active');
        this.leftPaneElement.classList.remove('pane-active');
      }
    } else {
      this.dividerElement.style.display = 'none';
      this.rightPaneElement.style.display = 'none';
      this.leftPaneElement.style.flex = '1 1 100%';
      this.leftPaneElement.classList.add('pane-active');
    }
  }

  private attachEvents() {
    // Focus pane on click
    this.leftPaneElement.addEventListener('mousedown', () => {
      appStore.setActivePane('left');
    });

    this.rightPaneElement.addEventListener('mousedown', () => {
      appStore.setActivePane('right');
    });

    // Divider Dragging to resize panes
    this.dividerElement.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.isDraggingDivider = true;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDraggingDivider) return;
      const rect = this.container.getBoundingClientRect();
      const offset = e.clientX - rect.left;
      const totalWidth = rect.width;
      const ratio = Math.max(0.2, Math.min(0.8, offset / totalWidth));
      this.splitRatio = ratio;
      this.updateLayout();
    });

    window.addEventListener('mouseup', () => {
      if (this.isDraggingDivider) {
        this.isDraggingDivider = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    });
  }
}
