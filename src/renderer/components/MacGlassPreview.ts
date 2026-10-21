/**
 * MacGlassPreview – macOS-style immersive media viewer & gallery
 * Features:
 *  - Dynamic blur-glass backdrop & liquid glass styling
 *  - Smooth Zoom In / Zoom Out (Ctrl + Wheel, Mouse Wheel, or +/- buttons)
 *  - Drag & Pan when zoomed in
 *  - Gallery Left/Right arrows with liquid glass circle design
 *  - Arrow Left / Arrow Right keyboard navigation through photos/videos in active folder
 *  - Fullscreen toggle (F), External Open, Close (Esc)
 */

import { appStore } from '../store/appStore';
import { FileItem } from '../../shared/types';

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

interface PreviewFile {
  path: string;
  name: string;
  sizeBytes?: number;
  modifiedMs?: number;
}

type PreviewType = 'image' | 'video' | 'pdf' | 'audio' | 'text' | 'unknown';

function detectType(name: string): PreviewType {
  const ext = name.toLowerCase().split('.').pop() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'ico', 'svg', 'avif', 'heic'].includes(ext)) return 'image';
  if (['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'm4v', 'wmv'].includes(ext)) return 'video';
  if (ext === 'pdf') return 'pdf';
  if (['mp3', 'flac', 'wav', 'ogg', 'aac', 'm4a', 'opus'].includes(ext)) return 'audio';
  if (['txt', 'md', 'json', 'xml', 'csv', 'log', 'ini', 'yaml', 'yml', 'toml', 'env'].includes(ext)) return 'text';
  return 'unknown';
}

export class MacGlassPreview {
  private overlay: HTMLElement | null = null;
  private isFullscreen = false;
  private currentFile: PreviewFile | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  // Zoom & Pan state
  private zoom = 1.0;
  private panX = 0;
  private panY = 0;
  private isPanning = false;
  private panStartX = 0;
  private panStartY = 0;

  // Navigation slide direction
  private navDirection: 'next' | 'prev' = 'next';

  constructor() {
    // Listen for file preview requests
    window.addEventListener('app:preview-file', (e: Event) => {
      const detail = (e as CustomEvent).detail as { path: string };
      this.open(detail.path);
    });

    window.addEventListener('app:open-file', (e: Event) => {
      const detail = (e as CustomEvent).detail as { path: string };
      const type = detectType(detail.path);
      // Intercept media/pdf - show in overlay instead of native open
      if (['image', 'video', 'pdf', 'audio'].includes(type)) {
        this.open(detail.path);
      }
    });
  }

  public async open(path: string) {
    const name = path.split(/[\\/]/).pop() || path;
    const type = detectType(name);

    this.currentFile = { path, name };
    this.resetZoom();

    // Try to get file stats if api is available
    try {
      const stats = await (window.electronApi as any).statFile?.(path);
      if (stats) {
        this.currentFile.sizeBytes = stats.sizeBytes;
        this.currentFile.modifiedMs = stats.modifiedMs;
      }
    } catch {
      // silently ignore
    }

    this.render(type);
  }

  /** Get sibling media files in the current folder for navigation */
  private getSiblingMediaItems(): FileItem[] {
    const tab = appStore.getActiveTab();
    return (tab.items || []).filter((item) => {
      if (item.isDirectory) return false;
      const t = detectType(item.name);
      return t === 'image' || t === 'video';
    });
  }

  private navigateSibling(direction: 'prev' | 'next') {
    if (!this.currentFile) return;
    const items = this.getSiblingMediaItems();
    if (items.length <= 1) return;

    const currentIndex = items.findIndex((i) => i.path === this.currentFile!.path);
    let nextIndex = 0;

    if (direction === 'prev') {
      nextIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
    } else {
      nextIndex = currentIndex >= items.length - 1 ? 0 : currentIndex + 1;
    }

    const nextItem = items[nextIndex];
    if (nextItem) {
      this.navDirection = direction;
      // Keep selection in sync with folder view
      appStore.setSelection([nextItem.path]);
      this.openWithSlide(nextItem.path);
    }
  }

  /**
   * Navigate to a new image/video with a smooth slide animation.
   * Current content slides out, new content slides in from the correct edge.
   */
  private async openWithSlide(path: string) {
    const name = path.split(/[\\/]/).pop() || path;
    const type = detectType(name);

    // If we already have an overlay and same type (image), animate slide
    if (this.overlay && type === 'image') {
      const body = this.overlay.querySelector('#mgp-body') as HTMLElement;
      const imageContainer = body?.querySelector('.mgp-image-container') as HTMLElement;

      if (imageContainer) {
        // Determine slide direction classes
        const exitClass = this.navDirection === 'next' ? 'slide-exit-left' : 'slide-exit-right';
        const enterClass = this.navDirection === 'next' ? 'slide-enter-right' : 'slide-enter-left';

        // Pre-load the new image
        const mediaUrl = `afe-media://load?path=${encodeURIComponent(path)}`;
        const preloadImg = new Image();

        const doSlide = () => {
          // Create new container to slide in
          const newContainer = document.createElement('div');
          newContainer.className = `mgp-image-container ${enterClass}`;
          newContainer.innerHTML = `
            <div class="mgp-image-wrapper" id="mgp-img-wrapper">
              <img class="mgp-image loaded" src="${mediaUrl}" alt="Preview" draggable="false" />
            </div>`;

          // Slide old out
          imageContainer.classList.add(exitClass);

          // Insert new
          body.insertBefore(newContainer, imageContainer);

          // Trigger reflow then animate in
          requestAnimationFrame(() => {
            newContainer.classList.remove(enterClass);
            newContainer.classList.add('slide-enter-active');
          });

          // After animation, clean up
          setTimeout(() => {
            imageContainer.remove();
            newContainer.classList.remove('slide-enter-active');
            this.resetZoom();
            this.attachImageZoomPan(this.overlay!);
          }, 320);
        };

        this.currentFile = { path, name };
        // Update filename in header
        const filenameEl = this.overlay.querySelector('.mgp-filename');
        if (filenameEl) filenameEl.textContent = name;

        preloadImg.onload = doSlide;
        preloadImg.onerror = doSlide;
        preloadImg.src = mediaUrl;
        return;
      }
    }

    // Fallback: full re-render
    this.open(path);
  }

  private resetZoom() {
    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.updateTransform();
  }

  private setZoom(newZoom: number, centerClientX?: number, centerClientY?: number) {
    const clamped = Math.min(6.0, Math.max(0.2, newZoom));
    if (clamped === this.zoom) return;

    if (centerClientX !== undefined && centerClientY !== undefined && this.overlay) {
      const container = this.overlay.querySelector('.mgp-image-container') as HTMLElement;
      if (container) {
        const rect = container.getBoundingClientRect();
        const offsetX = centerClientX - (rect.left + rect.width / 2);
        const offsetY = centerClientY - (rect.top + rect.height / 2);
        const ratio = clamped / this.zoom;
        this.panX -= (offsetX - this.panX) * (ratio - 1);
        this.panY -= (offsetY - this.panY) * (ratio - 1);
      }
    }

    this.zoom = clamped;
    if (this.zoom <= 1.0) {
      this.panX = 0;
      this.panY = 0;
    }
    this.updateTransform();
  }

  private updateTransform() {
    if (!this.overlay) return;
    const wrapper = this.overlay.querySelector('#mgp-img-wrapper') as HTMLElement;
    if (wrapper) {
      wrapper.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
    }
    const zoomLabel = this.overlay.querySelector('#mgp-zoom-label');
    if (zoomLabel) {
      zoomLabel.textContent = `${Math.round(this.zoom * 100)}%`;
    }
    const container = this.overlay.querySelector('.mgp-image-container') as HTMLElement;
    if (container) {
      container.style.cursor = this.zoom > 1.0 ? (this.isPanning ? 'grabbing' : 'grab') : 'default';
    }
  }

  private render(type: PreviewType) {
    this.close();
    if (!this.currentFile) return;

    const { path, name, sizeBytes } = this.currentFile;
    const mediaUrl = `afe-media://load?path=${encodeURIComponent(path)}`;

    // Sibling media count check
    const siblingMedia = this.getSiblingMediaItems();
    const hasMultiple = siblingMedia.length > 1;

    // === Backdrop overlay ===
    const overlay = document.createElement('div');
    overlay.id = 'mac-glass-preview-overlay';
    overlay.innerHTML = `
      <div class="mgp-backdrop"></div>
      <div class="mgp-window ${this.isFullscreen ? 'fullscreen' : ''}">
        <!-- Windows 11 Style Title & Caption Bar -->
        <div class="mgp-header mgp-win-toolbar">
          <div class="mgp-win-title-area">
            <span class="mgp-type-icon">${this.getTypeIcon(type)}</span>
            <span class="mgp-filename" title="${name}">${name}</span>
            ${sizeBytes ? `<span class="mgp-meta-pill">${formatBytes(sizeBytes)}</span>` : ''}
          </div>

          <div class="mgp-win-caption-controls">
            <button class="mgp-win-btn" id="mgp-btn-open" title="Open with default application">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/>
              </svg>
            </button>
            <button class="mgp-win-caption-btn" id="mgp-btn-min" title="Minimize / Open Externally">
              <svg width="10" height="10" viewBox="0 0 10 10"><line x1="0" y1="5" x2="10" y2="5" stroke="currentColor" stroke-width="1.2"/></svg>
            </button>
            <button class="mgp-win-caption-btn" id="mgp-btn-fs" title="Maximize / Restore (F)">
              <svg class="win-btn-maximize" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.2">
                <rect x="0.6" y="0.6" width="8.8" height="8.8" rx="0.5"/>
              </svg>
            </button>
            <button class="mgp-win-caption-btn mgp-win-close-btn" id="mgp-btn-close" title="Close (Esc)">
              <svg width="10" height="10" viewBox="0 0 10 10"><line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" stroke-width="1.2"/><line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" stroke-width="1.2"/></svg>
            </button>
          </div>
        </div>

        <div class="mgp-body" id="mgp-body">
          ${this.renderContent(type, mediaUrl, path)}

          ${
            hasMultiple && (type === 'image' || type === 'video')
              ? `
              <button class="mgp-nav-btn mgp-nav-prev" id="mgp-btn-prev" title="Previous (Left Arrow)">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
              </button>
              <button class="mgp-nav-btn mgp-nav-next" id="mgp-btn-next" title="Next (Right Arrow)">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </button>
            `
              : ''
          }

          ${
            type === 'image'
              ? `
              <div class="mgp-zoom-pill">
                <button class="mgp-zoom-btn" id="mgp-zoom-out" title="Zoom Out (-)">−</button>
                <span class="mgp-zoom-label" id="mgp-zoom-label" title="Click to reset zoom">100%</span>
                <button class="mgp-zoom-btn" id="mgp-zoom-in" title="Zoom In (+)">+</button>
              </div>
            `
              : ''
          }
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    this.overlay = overlay;

    // Wire close events
    const closeBtn = overlay.querySelector('#mgp-btn-close') as HTMLElement;
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.close();
      });
      closeBtn.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
      });
    }

    const backdrop = overlay.querySelector('.mgp-backdrop') as HTMLElement;
    if (backdrop) {
      backdrop.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.close();
      });
    }

    // Fullscreen toggle
    overlay.querySelector('#mgp-btn-fs')?.addEventListener('click', () => this.toggleFullscreen());

    // Open externally
    overlay.querySelector('#mgp-btn-open')?.addEventListener('click', () => {
      if (this.currentFile) window.electronApi.openPath(this.currentFile.path);
    });

    // Gallery Liquid Glass circle buttons
    overlay.querySelector('#mgp-btn-prev')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.navigateSibling('prev');
    });
    overlay.querySelector('#mgp-btn-next')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.navigateSibling('next');
    });

    // Zoom pill buttons
    overlay.querySelector('#mgp-zoom-in')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setZoom(this.zoom * 1.25);
    });
    overlay.querySelector('#mgp-zoom-out')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setZoom(this.zoom / 1.25);
    });
    overlay.querySelector('#mgp-zoom-label')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.resetZoom();
    });

    // Post-render video/image loading & interactive Zoom/Pan
    if (type === 'image') {
      const img = overlay.querySelector('.mgp-image') as HTMLImageElement;
      if (img) {
        img.addEventListener('load', () => img.classList.add('loaded'));
        img.addEventListener('error', () => {
          img.parentElement!.innerHTML = `<div class="mgp-error">Cannot load image</div>`;
        });
      }
      this.attachImageZoomPan(overlay);
    }

    if (type === 'video') {
      this.attachVideoControls(overlay);
    }

    // Load text content
    if (type === 'text') {
      this.loadTextContent(path, overlay);
    }

    // Keyboard shortcuts
    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.close();
      } else if (e.key === 'f' || e.key === 'F') {
        this.toggleFullscreen();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.navigateSibling('prev');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        this.navigateSibling('next');
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        this.setZoom(this.zoom * 1.2);
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        this.setZoom(this.zoom / 1.2);
      } else if (e.key === '0' && e.ctrlKey) {
        e.preventDefault();
        this.resetZoom();
      }
    };
    window.addEventListener('keydown', this.keyHandler);

    // Animate in
    requestAnimationFrame(() => {
      overlay.classList.add('visible');
    });
  }

  private attachImageZoomPan(overlay: HTMLElement) {
    const container = overlay.querySelector('.mgp-image-container') as HTMLElement;
    if (!container) return;

    // Mouse wheel zoom in & out
    container.addEventListener(
      'wheel',
      (e: WheelEvent) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
        this.setZoom(this.zoom * factor, e.clientX, e.clientY);
      },
      { passive: false }
    );

    // Pan image when dragged (especially when zoomed)
    container.addEventListener('mousedown', (e: MouseEvent) => {
      // Don't trigger if clicked navigation buttons or zoom pill
      if ((e.target as HTMLElement).closest('.mgp-nav-btn') || (e.target as HTMLElement).closest('.mgp-zoom-pill')) {
        return;
      }
      if (this.zoom > 1.0) {
        this.isPanning = true;
        this.panStartX = e.clientX - this.panX;
        this.panStartY = e.clientY - this.panY;
        this.updateTransform();
      }
    });

    window.addEventListener('mousemove', (e: MouseEvent) => {
      if (!this.isPanning) return;
      this.panX = e.clientX - this.panStartX;
      this.panY = e.clientY - this.panStartY;
      this.updateTransform();
    });

    window.addEventListener('mouseup', () => {
      if (this.isPanning) {
        this.isPanning = false;
        this.updateTransform();
      }
    });
  }

  private attachVideoControls(overlay: HTMLElement) {
    const video = overlay.querySelector('#mgp-video-el') as HTMLVideoElement;
    const centerBtn = overlay.querySelector('#mgp-center-play-btn') as HTMLElement;
    const miniPlay = overlay.querySelector('#mgp-video-mini-play') as HTMLElement;
    const miniMute = overlay.querySelector('#mgp-video-mini-mute') as HTMLElement;
    const progress = overlay.querySelector('#mgp-video-progress') as HTMLElement;
    const timeline = overlay.querySelector('#mgp-video-timeline') as HTMLElement;
    const timeCur = overlay.querySelector('#mgp-video-time-cur') as HTMLElement;
    const timeDur = overlay.querySelector('#mgp-video-time-dur') as HTMLElement;
    const playerWrap = overlay.querySelector('#mgp-video-player-wrap') as HTMLElement;

    if (!video) return;

    const formatTime = (secs: number) => {
      if (isNaN(secs) || secs < 0) return '0:00';
      const m = Math.floor(secs / 60);
      const s = Math.floor(secs % 60);
      return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const updatePlayState = (isPlaying: boolean) => {
      const iconPlay = centerBtn?.querySelector('.mgp-glass-icon-play') as HTMLElement;
      const iconPause = centerBtn?.querySelector('.mgp-glass-icon-pause') as HTMLElement;
      const miniPlayIcon = miniPlay?.querySelector('.mini-play') as HTMLElement;
      const miniPauseIcon = miniPlay?.querySelector('.mini-pause') as HTMLElement;

      if (isPlaying) {
        if (iconPlay) iconPlay.style.display = 'none';
        if (iconPause) iconPause.style.display = 'block';
        if (miniPlayIcon) miniPlayIcon.style.display = 'none';
        if (miniPauseIcon) miniPauseIcon.style.display = 'block';
        centerBtn?.classList.add('playing');
        playerWrap?.classList.add('is-playing');
      } else {
        if (iconPlay) iconPlay.style.display = 'block';
        if (iconPause) iconPause.style.display = 'none';
        if (miniPlayIcon) miniPlayIcon.style.display = 'block';
        if (miniPauseIcon) miniPauseIcon.style.display = 'none';
        centerBtn?.classList.remove('playing');
        playerWrap?.classList.remove('is-playing');
      }
    };

    const togglePlay = () => {
      if (video.paused || video.ended) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    };

    video.addEventListener('canplay', () => {
      video.classList.add('loaded');
      if (timeDur) timeDur.textContent = formatTime(video.duration);
    });

    video.addEventListener('loadedmetadata', () => {
      if (timeDur) timeDur.textContent = formatTime(video.duration);
    });

    video.addEventListener('play', () => updatePlayState(true));
    video.addEventListener('pause', () => updatePlayState(false));

    video.addEventListener('timeupdate', () => {
      if (video.duration) {
        const pct = (video.currentTime / video.duration) * 100;
        if (progress) progress.style.width = `${pct}%`;
        if (timeCur) timeCur.textContent = formatTime(video.currentTime);
      }
    });

    centerBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePlay();
    });

    video.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePlay();
    });

    miniPlay?.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePlay();
    });

    miniMute?.addEventListener('click', (e) => {
      e.stopPropagation();
      video.muted = !video.muted;
      const onIcon = miniMute.querySelector('.vol-on') as HTMLElement;
      const offIcon = miniMute.querySelector('.vol-off') as HTMLElement;
      if (onIcon && offIcon) {
        onIcon.style.display = video.muted ? 'none' : 'block';
        offIcon.style.display = video.muted ? 'block' : 'none';
      }
    });

    // Interactive timeline scrubbing & sliding
    let isScrubbing = false;

    const scrub = (clientX: number) => {
      if (!timeline || !video.duration) return;
      const rect = timeline.getBoundingClientRect();
      const clickX = clientX - rect.left;
      const pct = Math.max(0, Math.min(1, clickX / rect.width));
      video.currentTime = pct * video.duration;
      if (progress) progress.style.width = `${pct * 100}%`;
      if (timeCur) timeCur.textContent = formatTime(video.currentTime);
    };

    timeline?.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      isScrubbing = true;
      scrub(e.clientX);

      const onMouseMove = (moveEvent: MouseEvent) => {
        if (!isScrubbing) return;
        moveEvent.stopPropagation();
        scrub(moveEvent.clientX);
      };

      const onMouseUp = (upEvent: MouseEvent) => {
        if (!isScrubbing) return;
        isScrubbing = false;
        scrub(upEvent.clientX);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });

    // Auto-hide controls: show on any mouse movement inside playerWrap.
    // Hide only after 1 second of NO movement (not on mouseleave).
    // When video is paused, always keep controls visible.
    let hideTimer: any = null;

    const showControls = () => {
      playerWrap?.classList.add('user-active');
    };

    const scheduleHide = () => {
      if (hideTimer) clearTimeout(hideTimer);
      if (!video.paused && !video.ended) {
        hideTimer = setTimeout(() => {
          playerWrap?.classList.remove('user-active');
        }, 1000);
      }
    };

    const showControlsTemporarily = () => {
      showControls();
      scheduleHide();
    };

    // Show controls whenever the cursor moves anywhere in the player box
    playerWrap?.addEventListener('mousemove', showControlsTemporarily);
    // Show controls on enter
    playerWrap?.addEventListener('mouseenter', showControlsTemporarily);
    // DO NOT hide on mouseleave — let the 1-second timer handle it
    // (Removed the mouseleave instant-hide listener per user request)

    // Space bar toggles play/pause on video
    const handleVideoKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        togglePlay();
        showControlsTemporarily();
      }
    };
    window.addEventListener('keydown', handleVideoKey);
  }

  private renderContent(type: PreviewType, mediaUrl: string, path: string): string {
    switch (type) {
      case 'image':
        return `
          <div class="mgp-image-container">
            <div class="mgp-image-wrapper" id="mgp-img-wrapper">
              <img class="mgp-image" src="${mediaUrl}" alt="Preview" draggable="false" />
            </div>
          </div>`;

      case 'video':
        return `
          <div class="mgp-video-container" id="mgp-video-player-wrap">
            <video class="mgp-video" id="mgp-video-el" src="${mediaUrl}" playsinline loop></video>
            
            <button class="mgp-apple-glass-play-btn" id="mgp-center-play-btn" aria-label="Play or Pause Video">
              <div class="mgp-glass-disc-glow"></div>
              <div class="mgp-glass-disc-surface">
                <svg class="mgp-glass-icon-play" width="34" height="34" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="6,4 20,12 6,20" />
                </svg>
                <svg class="mgp-glass-icon-pause" width="34" height="34" viewBox="0 0 24 24" fill="currentColor" style="display: none;">
                  <rect x="5" y="4" width="4.5" height="16" rx="1.5" />
                  <rect x="14.5" y="4" width="4.5" height="16" rx="1.5" />
                </svg>
              </div>
            </button>

            <div class="mgp-video-glass-bar">
              <button class="mgp-video-mini-btn" id="mgp-video-mini-play" title="Play/Pause">
                <svg class="mini-play" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,4 20,12 6,20"/></svg>
                <svg class="mini-pause" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="display:none;"><rect x="5" y="4" width="4" height="16" rx="1"/><rect x="15" y="4" width="4" height="16" rx="1"/></svg>
              </button>
              <span class="mgp-video-time" id="mgp-video-time-cur">0:00</span>
              <div class="mgp-video-timeline" id="mgp-video-timeline">
                <div class="mgp-video-progress" id="mgp-video-progress">
                  <div class="mgp-video-thumb"></div>
                </div>
              </div>
              <span class="mgp-video-time" id="mgp-video-time-dur">0:00</span>
              <button class="mgp-video-mini-btn" id="mgp-video-mini-mute" title="Mute/Unmute">
                <svg class="vol-on" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>
                <svg class="vol-off" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none;"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
              </button>
            </div>
          </div>`;

      case 'pdf': {
        const fileUrl = path.startsWith('file://') ? path : `file:///${path.replace(/\\/g, '/')}`;
        return `
          <div class="mgp-pdf-container">
            <iframe class="mgp-webview" src="${fileUrl}" title="PDF Preview"></iframe>
          </div>`;
      }

      case 'audio':
        return `
          <div class="mgp-audio-container">
            <div class="mgp-audio-art">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
              </svg>
            </div>
            <audio class="mgp-audio" src="${mediaUrl}" controls autoplay></audio>
          </div>`;

      case 'text':
        return `<div class="mgp-text-container" id="mgp-text-body"><div class="mgp-loading-pulse">Loading…</div></div>`;

      default:
        return `
          <div class="mgp-unknown-container">
            <div class="mgp-unknown-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" opacity="0.6">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>
            </div>
            <p class="mgp-unknown-msg">Cannot preview this file type</p>
            <p class="mgp-unknown-sub">Open with default application instead</p>
          </div>`;
    }
  }

  private async loadTextContent(path: string, overlay: HTMLElement) {
    const body = overlay.querySelector('#mgp-text-body');
    if (!body) return;
    try {
      const content = await (window.electronApi as any).readTextFile?.(path, 8000);
      if (content) {
        const lines = (content as string).split('\n');
        const html = lines
          .slice(0, 500)
          .map(
            (line, i) =>
              `<div class="mgp-line"><span class="mgp-ln">${i + 1}</span><span class="mgp-lc">${escapeHtml(line)}</span></div>`
          )
          .join('');
        body.innerHTML = `<div class="mgp-text-scroll">${html}</div>`;
        if (lines.length > 500) {
          body.innerHTML += `<div class="mgp-text-truncated">… (showing first 500 lines of ${lines.length})</div>`;
        }
      } else {
        body.innerHTML = `<div class="mgp-error">Cannot read file contents</div>`;
      }
    } catch {
      body.innerHTML = `<div class="mgp-error">Error reading file</div>`;
    }
  }

  private toggleFullscreen() {
    this.isFullscreen = !this.isFullscreen;
    const win = this.overlay?.querySelector('.mgp-window');
    if (win) {
      win.classList.toggle('fullscreen', this.isFullscreen);
    }
    const fsBtn = this.overlay?.querySelector('#mgp-btn-fs') as HTMLButtonElement;
    if (fsBtn) {
      fsBtn.title = this.isFullscreen ? 'Restore (F)' : 'Maximize (F)';
      fsBtn.innerHTML = this.isFullscreen
        ? `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.2">
             <rect x="2" y="0.6" width="7.4" height="7.4" rx="0.5"/>
             <path d="M0.6 3.2V9.4H6.8"/>
           </svg>`
        : `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.2">
             <rect x="0.6" y="0.6" width="8.8" height="8.8" rx="0.5"/>
           </svg>`;
    }
  }

  close() {
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
    const currentOverlay = this.overlay;
    this.overlay = null;
    if (currentOverlay) {
      currentOverlay.classList.remove('visible');
      currentOverlay.remove();
    }
    // Also remove any stray overlays if any exist
    document.querySelectorAll('#mac-glass-preview-overlay').forEach((el) => el.remove());
    this.isFullscreen = false;
    this.resetZoom();
  }

  private getTypeIcon(type: PreviewType): string {
    const icons: Record<PreviewType, string> = {
      image: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
      video: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg>`,
      pdf: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
      audio: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
      text: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="21" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="3" y2="18"/></svg>`,
      unknown: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
    };
    return icons[type] || icons.unknown;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const macGlassPreview = new MacGlassPreview();
