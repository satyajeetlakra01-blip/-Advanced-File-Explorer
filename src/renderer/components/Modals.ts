import { FileItem } from '../../shared/types';
import { appStore } from '../store/appStore';

export class Modals {
  static showToast(message: string, duration = 3000) {
    let toast = document.getElementById('app-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'app-toast';
      toast.className = 'app-toast';
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.add('visible');

    setTimeout(() => {
      toast?.classList.remove('visible');
    }, duration);
  }

  static promptRename(item: FileItem, onCommit: (newName: string) => Promise<void>) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'modal-dialog';

    modal.innerHTML = `
      <div class="modal-header">
        <div class="modal-title">Rename ${item.isDirectory ? 'Folder' : 'File'}</div>
      </div>
      <div class="modal-body">
        <label class="modal-label" for="rename-input">Enter new name:</label>
        <input type="text" id="rename-input" class="modal-input" value="${item.name}">
        <div id="rename-error" class="modal-error" style="display:none;"></div>
      </div>
      <div class="modal-footer">
        <button id="modal-cancel" class="btn-secondary">Cancel</button>
        <button id="modal-submit" class="btn-primary">Rename</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const input = modal.querySelector('#rename-input') as HTMLInputElement;
    const errorDiv = modal.querySelector('#rename-error') as HTMLElement;
    const submitBtn = modal.querySelector('#modal-submit') as HTMLButtonElement;
    const cancelBtn = modal.querySelector('#modal-cancel') as HTMLButtonElement;

    input.focus();
    // Select name part excluding extension
    const dotIndex = item.name.lastIndexOf('.');
    if (!item.isDirectory && dotIndex > 0) {
      input.setSelectionRange(0, dotIndex);
    } else {
      input.select();
    }

    const close = () => overlay.remove();

    cancelBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

    const submit = async () => {
      const val = input.value.trim();
      if (!val) {
        errorDiv.textContent = 'Name cannot be empty';
        errorDiv.style.display = 'block';
        return;
      }
      if (val === item.name) {
        close();
        return;
      }

      try {
        await onCommit(val);
        close();
      } catch (err: any) {
        errorDiv.textContent = err.message || 'Rename failed';
        errorDiv.style.display = 'block';
      }
    };

    submitBtn.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
      if (e.key === 'Escape') close();
    });
  }

  static promptNewFolder(parentPath: string, onCommit: (folderName: string) => Promise<void>) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'modal-dialog';

    modal.innerHTML = `
      <div class="modal-header">
        <div class="modal-title">New Folder</div>
      </div>
      <div class="modal-body">
        <label class="modal-label" for="folder-input">Folder name:</label>
        <input type="text" id="folder-input" class="modal-input" value="New Folder">
        <div id="folder-error" class="modal-error" style="display:none;"></div>
      </div>
      <div class="modal-footer">
        <button id="modal-cancel" class="btn-secondary">Cancel</button>
        <button id="modal-submit" class="btn-primary">Create</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const input = modal.querySelector('#folder-input') as HTMLInputElement;
    const errorDiv = modal.querySelector('#folder-error') as HTMLElement;
    const submitBtn = modal.querySelector('#modal-submit') as HTMLButtonElement;
    const cancelBtn = modal.querySelector('#modal-cancel') as HTMLButtonElement;

    input.focus();
    input.select();

    const close = () => overlay.remove();
    cancelBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

    const submit = async () => {
      const val = input.value.trim();
      if (!val) {
        errorDiv.textContent = 'Folder name cannot be empty';
        errorDiv.style.display = 'block';
        return;
      }

      try {
        await onCommit(val);
        close();
      } catch (err: any) {
        errorDiv.textContent = err.message || 'Creation failed';
        errorDiv.style.display = 'block';
      }
    };

    submitBtn.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
      if (e.key === 'Escape') close();
    });
  }

  static confirmDelete(paths: string[], permanent: boolean, onConfirm: () => Promise<void>) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'modal-dialog';

    const count = paths.length;
    const name = paths[0].split(/\\|\//).pop();
    const title = permanent
      ? count === 1
        ? `Permanently Delete '${name}'?`
        : `Permanently Delete ${count} items?`
      : count === 1
      ? `Move '${name}' to Recycle Bin?`
      : `Move ${count} items to Recycle Bin?`;

    const description = permanent
      ? `<div style="background:rgba(244,63,94,0.1); border:1px solid rgba(244,63,94,0.3); border-radius:var(--radius-md); padding:10px; color:var(--accent-rose); font-size:12px; font-weight:500; display:flex; align-items:flex-start; gap:8px;">
           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0; margin-top:1px;"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
           <span><strong>Caution:</strong> These items will not be moved to the Recycle Bin. This action cannot be undone.</span>
         </div>`
      : `<p style="color:var(--text-secondary); margin-bottom:8px;">
           These items will be sent to the Windows Recycle Bin and can be restored if needed.
         </p>`;

    const actionText = permanent ? 'Permanently Delete' : 'Move to Recycle Bin';

    modal.innerHTML = `
      <div class="modal-header">
        <div class="modal-title" style="${permanent ? 'color:var(--accent-rose);' : ''}">${title}</div>
      </div>
      <div class="modal-body">
        ${description}
      </div>
      <div class="modal-footer">
        <button id="modal-cancel" class="btn-secondary">Cancel</button>
        <button id="modal-confirm" class="btn-danger-outline" style="background:var(--accent-rose); color:#fff; border:none;">${actionText}</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    modal.querySelector('#modal-cancel')?.addEventListener('click', close);
    modal.querySelector('#modal-confirm')?.addEventListener('click', async () => {
      await onConfirm();
      close();
    });
  }
}
