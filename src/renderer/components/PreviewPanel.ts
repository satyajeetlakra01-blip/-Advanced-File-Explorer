import { PreviewContent } from '../../shared/types';
import { Modals } from './Modals';

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export class PreviewPanel {
  private overlay: HTMLElement | null = null;

  async open(filePath: string) {
    this.close();

    try {
      const preview: PreviewContent = await window.electronApi.getPreview(filePath);
      this.render(preview);
    } catch (err: any) {
      Modals.showToast(`Preview failed: ${err.message}`);
    }
  }

  close() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  isOpen(): boolean {
    return this.overlay !== null;
  }

  private render(preview: PreviewContent) {
    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-backdrop';
    this.overlay.id = 'preview-overlay';

    let contentHtml = '';

    if (preview.type === 'text') {
      const lines = (preview.content || '').split('\n');
      const linesHtml = lines
        .map(
          (line, idx) =>
            `<div class="preview-line"><span class="line-num">${idx + 1}</span><span class="line-text">${this.escapeHtml(
              line
            )}</span></div>`
        )
        .join('');

      contentHtml = `
        <div class="preview-text-container">
          <div class="preview-code-scroll">${linesHtml}</div>
        </div>
      `;
    } else if (preview.type === 'image') {
      contentHtml = `
        <div class="preview-image-container">
          <img src="${preview.content}" alt="${preview.name}" class="preview-image-element" />
        </div>
      `;
    } else if (preview.type === 'audio') {
      contentHtml = `
        <div class="preview-audio-container" style="padding: 40px; text-align: center;">
          <div style="margin-bottom: 16px; color: var(--accent-primary);">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
            </svg>
          </div>
          <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">${preview.name}</div>
          <div style="color: var(--text-secondary); margin-bottom: 24px;">${formatBytes(preview.sizeBytes)}</div>
          <audio controls autoplay style="width: 100%; max-width: 400px;">
            <source src="file://${preview.path}">
            Your browser does not support audio playback.
          </audio>
        </div>
      `;
    } else {
      contentHtml = `
        <div class="preview-fallback-container" style="padding: 60px 20px; text-align: center;">
          <div style="margin-bottom: 16px; color: var(--text-muted);">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" opacity="0.6">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">${preview.name}</div>
          <div style="color: var(--text-muted); margin-bottom: 16px;">${preview.mimeType} • ${formatBytes(preview.sizeBytes)}</div>
          <div style="color: var(--text-secondary); font-size: 13px; max-width: 400px; margin: 0 auto;">
            ${preview.content || 'Preview is not available for this binary format.'}
          </div>
        </div>
      `;
    }

    this.overlay.innerHTML = `
      <div class="preview-dialog" style="width: 75vw; max-width: 900px; height: 80vh; max-height: 700px; display: flex; flex-direction: column;">
        <div class="preview-header">
          <div class="preview-title-area">
            <span class="preview-filename" title="${preview.name}">${preview.name}</span>
            <span class="preview-meta">${formatBytes(preview.sizeBytes)} • ${preview.mimeType} ${
      preview.lineCount ? `• ${preview.lineCount} lines` : ''
    }</span>
          </div>
          <div class="preview-actions">
            ${
              preview.type === 'text'
                ? `<button id="btn-copy-preview" class="btn-secondary" style="height: 28px; font-size: 11px;">Copy Text</button>`
                : ''
            }
            <button id="btn-close-preview" class="btn-icon" title="Close Preview (Esc)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        <div class="preview-body" style="flex: 1; overflow: auto; position: relative; background: var(--bg-canvas);">
          ${contentHtml}
        </div>
      </div>
    `;

    document.body.appendChild(this.overlay);

    // Event listeners
    this.overlay.querySelector('#btn-close-preview')?.addEventListener('click', () => this.close());
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });

    this.overlay.querySelector('#btn-copy-preview')?.addEventListener('click', () => {
      if (preview.content) {
        navigator.clipboard.writeText(preview.content);
        Modals.showToast('Copied content to clipboard');
      }
    });

    const keyListener = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === ' ') {
        e.preventDefault();
        window.removeEventListener('keydown', keyListener);
        this.close();
      }
    };
    window.addEventListener('keydown', keyListener);
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

export const previewPanel = new PreviewPanel();
