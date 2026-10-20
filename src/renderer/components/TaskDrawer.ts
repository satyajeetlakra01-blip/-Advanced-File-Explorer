import { FileOperationProgress } from '../../shared/types';

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export class TaskDrawer {
  private element: HTMLElement;
  private currentOpId: string | null = null;
  private isVisible = false;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'task-drawer-container';
    this.element.style.display = 'none';
    document.body.appendChild(this.element);

    this.attachEvents();
  }

  private attachEvents() {
    window.electronApi.onOperationProgress((progress: FileOperationProgress) => {
      this.updateProgress(progress);
    });
  }

  show(opId: string, mode: string, totalFiles: number) {
    this.currentOpId = opId;
    this.isVisible = true;
    this.element.style.display = 'block';

    this.element.innerHTML = `
      <div class="task-drawer-card">
        <div class="task-drawer-header">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="task-drawer-spinner">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M21 12a9 9 0 11-6.219-8.56"/>
              </svg>
            </span>
            <span style="font-weight:600; font-size:13px; color:var(--text-primary);">${mode === 'COPY' ? 'Copying' : 'Moving'} ${totalFiles} item${totalFiles === 1 ? '' : 's'}</span>
          </div>
          <button id="task-cancel-btn" class="btn-icon" style="width:24px; height:24px;" title="Cancel Operation">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="task-drawer-body">
          <div id="task-current-file" style="font-size:11.5px; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-bottom:6px;">Preparing transfer...</div>
          <div class="task-progress-bar">
            <div id="task-progress-fill" class="task-progress-fill" style="width: 0%;"></div>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-muted); margin-top:4px;">
            <span id="task-percent">0%</span>
            <span id="task-transferred">0 / ${totalFiles}</span>
          </div>
        </div>
      </div>
    `;

    this.element.querySelector('#task-cancel-btn')?.addEventListener('click', () => {
      if (this.currentOpId) {
        window.electronApi.cancelTransfer(this.currentOpId);
        this.hide();
      }
    });
  }

  updateProgress(progress: FileOperationProgress) {
    if (!this.isVisible) {
      this.show(progress.opId, progress.mode, progress.totalFiles);
    }

    const currentFileEl = this.element.querySelector('#task-current-file');
    const fillEl = this.element.querySelector('#task-progress-fill') as HTMLElement;
    const percentEl = this.element.querySelector('#task-percent');
    const transferredEl = this.element.querySelector('#task-transferred');

    if (currentFileEl) currentFileEl.textContent = progress.currentFile;
    if (fillEl) fillEl.style.width = `${progress.percentComplete}%`;
    if (percentEl) percentEl.textContent = `${progress.percentComplete}%`;
    if (transferredEl) {
      transferredEl.textContent = `${progress.currentIndex} / ${progress.totalFiles} (${formatBytes(progress.transferredBytes)})`;
    }
  }

  hide() {
    this.isVisible = false;
    this.element.style.display = 'none';
    this.currentOpId = null;
  }
}

export const taskDrawer = new TaskDrawer();
