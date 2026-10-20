import { SearchMatch } from '../../shared/types';
import { Modals } from './Modals';

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export class SearchResultsModal {
  private overlay: HTMLElement | null = null;
  private matches: SearchMatch[] = [];
  private activeSearchId: string | null = null;
  private isSearching = false;
  private cleanupProgress: (() => void) | null = null;
  private cleanupCompleted: (() => void) | null = null;

  async open(rootPath: string, query: string) {
    this.close();
    this.matches = [];
    this.isSearching = true;

    try {
      const searchId = await window.electronApi.startSearch({ rootPath, query });
      this.activeSearchId = searchId;
      this.render(rootPath, query);

      this.cleanupProgress = window.electronApi.onSearchProgress((newMatches: SearchMatch[]) => {
        this.matches.push(...newMatches);
        this.updateList();
      });

      this.cleanupCompleted = window.electronApi.onSearchCompleted((result) => {
        this.isSearching = false;
        const statusEl = this.overlay?.querySelector('#search-status-text');
        if (statusEl) {
          statusEl.textContent = `Search completed in ${(result.durationMs / 1000).toFixed(1)}s • Found ${
            result.totalMatches
          } items`;
        }
        const cancelBtn = this.overlay?.querySelector('#btn-cancel-search') as HTMLElement;
        if (cancelBtn) cancelBtn.style.display = 'none';
      });
    } catch (err: any) {
      Modals.showToast(`Failed to start search: ${err.message}`);
    }
  }

  close() {
    if (this.activeSearchId && this.isSearching) {
      window.electronApi.cancelSearch(this.activeSearchId);
    }
    if (this.cleanupProgress) {
      this.cleanupProgress();
      this.cleanupProgress = null;
    }
    if (this.cleanupCompleted) {
      this.cleanupCompleted();
      this.cleanupCompleted = null;
    }
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    this.isSearching = false;
    this.activeSearchId = null;
  }

  private render(rootPath: string, query: string) {
    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-backdrop';

    this.overlay.innerHTML = `
      <div class="preview-dialog" style="width: 80vw; max-width: 950px; height: 80vh; max-height: 700px; display: flex; flex-direction: column;">
        <div class="preview-header">
          <div class="preview-title-area">
            <span class="preview-filename">Search: "${query}"</span>
            <span class="preview-meta" id="search-status-text">Searching inside ${rootPath}...</span>
          </div>
          <div class="preview-actions">
            <button id="btn-cancel-search" class="btn-danger-outline" style="height: 28px; font-size: 11px;">Cancel Search</button>
            <button id="btn-close-search" class="btn-icon" title="Close (Esc)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        <div class="search-results-list" id="search-results-body" style="flex: 1; overflow-y: auto; padding: 8px 12px; background: var(--bg-canvas);">
          <div style="padding: 40px; text-align: center; color: var(--text-muted);">Scanning files and folders...</div>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlay);

    this.overlay.querySelector('#btn-close-search')?.addEventListener('click', () => this.close());
    this.overlay.querySelector('#btn-cancel-search')?.addEventListener('click', () => {
      if (this.activeSearchId) {
        window.electronApi.cancelSearch(this.activeSearchId);
        this.isSearching = false;
        const statusEl = this.overlay?.querySelector('#search-status-text');
        if (statusEl) statusEl.textContent = 'Search cancelled by user';
      }
    });

    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });
  }

  private updateList() {
    const body = this.overlay?.querySelector('#search-results-body');
    if (!body) return;

    const statusEl = this.overlay?.querySelector('#search-status-text');
    if (statusEl && this.isSearching) {
      statusEl.textContent = `Found ${this.matches.length} matching items...`;
    }

    let rowsHtml = '';
    for (const match of this.matches) {
      const icon = match.isDirectory
        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="color:var(--accent-primary);"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>`
        : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text-secondary);"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
      rowsHtml += `
        <div class="search-match-row" data-path="${match.path}" style="display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: var(--radius-sm); cursor: pointer; border-bottom: 1px solid var(--border-subtle); transition: background 0.15s ease;">
          <span style="display: inline-flex; align-items: center; flex-shrink: 0;">${icon}</span>
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 500; font-size: 12.5px; color: var(--text-primary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${match.name}</div>
            <div style="font-size: 11px; color: var(--text-muted); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${match.path}</div>
          </div>
          <div style="font-size: 11.5px; color: var(--text-secondary);">${match.isDirectory ? 'Folder' : formatBytes(match.sizeBytes)}</div>
        </div>
      `;
    }

    body.innerHTML = rowsHtml;

    body.querySelectorAll('.search-match-row').forEach((row) => {
      row.addEventListener('click', () => {
        const itemPath = row.getAttribute('data-path');
        if (itemPath) {
          const parentDir = itemPath.substring(0, itemPath.lastIndexOf('\\')) || itemPath;
          window.dispatchEvent(new CustomEvent('app:navigate', { detail: { path: parentDir } }));
          this.close();
        }
      });
    });
  }
}

export const searchResultsModal = new SearchResultsModal();
