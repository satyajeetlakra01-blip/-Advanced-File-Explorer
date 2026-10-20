import { FileCollision, CollisionResolution } from '../../shared/types';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
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

export class ConflictModal {
  static async resolveCollisions(
    collisions: FileCollision[]
  ): Promise<{ resolutionMap: Record<string, CollisionResolution>; cancelled: boolean }> {
    if (collisions.length === 0) {
      return { resolutionMap: {}, cancelled: false };
    }

    const resolutionMap: Record<string, CollisionResolution> = {};
    let applyToAllChoice: CollisionResolution | null = null;

    for (let i = 0; i < collisions.length; i++) {
      const collision = collisions[i];

      if (applyToAllChoice) {
        resolutionMap[collision.fileName] = applyToAllChoice;
        continue;
      }

      const userChoice = await this.promptSingleCollision(collision, i + 1, collisions.length);
      if (userChoice.cancelled) {
        return { resolutionMap, cancelled: true };
      }

      resolutionMap[collision.fileName] = userChoice.resolution;
      if (userChoice.applyToAll) {
        applyToAllChoice = userChoice.resolution;
      }
    }

    return { resolutionMap, cancelled: false };
  }

  private static promptSingleCollision(
    collision: FileCollision,
    current: number,
    total: number
  ): Promise<{ resolution: CollisionResolution; applyToAll: boolean; cancelled: boolean }> {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';

      const modal = document.createElement('div');
      modal.className = 'modal-dialog';
      modal.style.width = '480px';

      const remainingText = total > 1 ? ` (${current} of ${total})` : '';

      modal.innerHTML = `
        <div class="modal-header">
          <div class="modal-title">File Collision Detected${remainingText}</div>
        </div>
        <div class="modal-body">
          <p style="color:var(--text-secondary); margin-bottom:12px;">
            An item named <strong style="color:var(--text-primary);">'${collision.fileName}'</strong> already exists in the destination.
          </p>

          <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:10px; display:flex; flex-direction:column; gap:6px; font-size:12px;">
            <div style="display:flex; justify-content:space-between;">
              <span style="color:var(--text-muted);">Source item:</span>
              <span style="font-family:var(--font-mono);">${formatBytes(collision.sourceSizeBytes)} • ${formatDate(collision.sourceModifiedMs)}</span>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <span style="color:var(--text-muted);">Destination item:</span>
              <span style="font-family:var(--font-mono);">${formatBytes(collision.destSizeBytes)} • ${formatDate(collision.destModifiedMs)}</span>
            </div>
          </div>

          <div style="margin-top:14px; display:flex; flex-direction:column; gap:8px; font-size:12.5px;">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="radio" name="collision-action" value="AUTO_RENAME" checked>
              <span>Keep both (Save as unique copy e.g. '${collision.fileName.replace(/(\.[^.]+)$/, '_copy$1')}')</span>
            </label>
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="radio" name="collision-action" value="OVERWRITE">
              <span>Replace existing item in destination</span>
            </label>
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="radio" name="collision-action" value="SKIP">
              <span>Skip this file</span>
            </label>
          </div>

          ${
            total > 1
              ? `
            <div style="margin-top:12px; padding-top:10px; border-top:1px solid var(--border-subtle);">
              <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:12px; color:var(--text-secondary);">
                <input type="checkbox" id="chk-apply-all">
                <span>Apply this action to all remaining ${total - current + 1} collisions</span>
              </label>
            </div>
          `
              : ''
          }
        </div>
        <div class="modal-footer">
          <button id="modal-cancel" class="btn-secondary">Cancel Transfer</button>
          <button id="modal-submit" class="btn-primary">Apply Action</button>
        </div>
      `;

      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      const close = (cancelled: boolean) => {
        overlay.remove();
        if (cancelled) {
          resolve({ resolution: 'SKIP', applyToAll: false, cancelled: true });
        }
      };

      modal.querySelector('#modal-cancel')?.addEventListener('click', () => close(true));

      modal.querySelector('#modal-submit')?.addEventListener('click', () => {
        const selectedRadio = modal.querySelector('input[name="collision-action"]:checked') as HTMLInputElement;
        const applyAllChk = modal.querySelector('#chk-apply-all') as HTMLInputElement | null;

        const resolution = (selectedRadio?.value as CollisionResolution) || 'AUTO_RENAME';
        const applyToAll = Boolean(applyAllChk?.checked);

        overlay.remove();
        resolve({ resolution, applyToAll, cancelled: false });
      });
    });
  }
}
