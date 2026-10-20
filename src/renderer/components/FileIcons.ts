import { FileItem } from '../../shared/types';

// Helper to escape HTML attributes safely
function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg', 'ico']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mkv', 'mov', 'avi']);
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma']);
const ARCHIVE_EXTENSIONS = new Set(['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz']);

export class FileIcons {
  static isImage(item: FileItem): boolean {
    return !item.isDirectory && IMAGE_EXTENSIONS.has((item.extension || '').toLowerCase());
  }

  static isVideo(item: FileItem): boolean {
    return !item.isDirectory && VIDEO_EXTENSIONS.has((item.extension || '').toLowerCase());
  }

  static isAudio(item: FileItem): boolean {
    return !item.isDirectory && AUDIO_EXTENSIONS.has((item.extension || '').toLowerCase());
  }

  /**
   * Renders the small symbol/icon for list rows (18px - 24px)
   */
  static getListIcon(item: FileItem, size = 18): string {
    if (item.isDirectory) {
      return `
        <svg class="file-icon-svg folder-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none">
          <path d="M2.5 7C2.5 5.61929 3.61929 4.5 5 4.5H9.2C9.86304 4.5 10.4989 4.76339 10.9678 5.23223L12.7355 7H19C20.3807 7 21.5 8.11929 21.5 9.5V17C21.5 18.3807 20.3807 19.5 19 19.5H5C3.61929 19.5 2.5 18.3807 2.5 17V7Z" fill="url(#folder-grad)" />
          <path d="M2.5 10.5C2.5 9.39543 3.39543 8.5 4.5 8.5H19.5C20.6046 8.5 21.5 9.39543 21.5 10.5V17C21.5 18.3807 20.3807 19.5 19 19.5H5C3.61929 19.5 2.5 18.3807 2.5 17V10.5Z" fill="url(#folder-front-grad)" />
          <defs>
            <linearGradient id="folder-grad" x1="2.5" y1="4.5" x2="21.5" y2="19.5" gradientUnits="userSpaceOnUse">
              <stop stop-color="#818CF8" />
              <stop offset="1" stop-color="#4F46E5" />
            </linearGradient>
            <linearGradient id="folder-front-grad" x1="2.5" y1="8.5" x2="21.5" y2="19.5" gradientUnits="userSpaceOnUse">
              <stop stop-color="#6366F1" />
              <stop offset="1" stop-color="#4338CA" />
            </linearGradient>
          </defs>
        </svg>
      `;
    }

    const ext = (item.extension || '').toLowerCase();
    return this.getCodeOrDocSymbol(ext, size);
  }

  /**
   * Renders the rich visual card preview (MacBook squircle grid card),
   * displaying real image/video thumbnails or crisp developer symbol badges.
   */
  static getGridPreview(item: FileItem, cardWidth: number): string {
    const mediaUrl = `afe-media://load?path=${encodeURIComponent(item.path)}`;
    const previewHeight = Math.max(48, Math.round(cardWidth * 0.58));

    // 1. Direct Image Thumbnail
    if (this.isImage(item)) {
      return `
        <div class="card-thumb-container" style="height: ${previewHeight}px;">
          <img 
            src="${mediaUrl}" 
            class="card-thumb-img" 
            loading="lazy" 
            alt="${escapeHtml(item.name)}" 
            onload="this.classList.add('loaded')" 
            onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
          />
          <div class="card-thumb-fallback" style="display: none; width: 100%; height: 100%; align-items: center; justify-content: center;">
            ${this.getCodeOrDocSymbol(item.extension || '', Math.round(previewHeight * 0.55))}
          </div>
        </div>
      `;
    }

    // 2. Direct Video Thumbnail
    if (this.isVideo(item)) {
      return `
        <div class="card-thumb-container video-thumb-container" style="height: ${previewHeight}px;">
          <video 
            src="${mediaUrl}#t=0.5" 
            class="card-thumb-video" 
            preload="metadata" 
            muted 
            playsinline 
            onloadeddata="this.classList.add('loaded')"
            onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
          ></video>
          <div class="card-thumb-fallback" style="display: none; width: 100%; height: 100%; align-items: center; justify-content: center;">
            ${this.getCodeOrDocSymbol('video', Math.round(previewHeight * 0.55))}
          </div>
          <div class="video-pill-badge">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            <span>VIDEO</span>
          </div>
        </div>
      `;
    }

    // 3. Folder Squircle Icon
    if (item.isDirectory) {
      const folderSize = Math.max(38, Math.round(cardWidth * 0.46));
      return `
        <div class="card-thumb-container card-folder-container" style="height: ${previewHeight}px;">
          <svg width="${folderSize}" height="${folderSize}" viewBox="0 0 24 24" fill="none">
            <path d="M2.5 7C2.5 5.61929 3.61929 4.5 5 4.5H9.2C9.86304 4.5 10.4989 4.76339 10.9678 5.23223L12.7355 7H19C20.3807 7 21.5 8.11929 21.5 9.5V17C21.5 18.3807 20.3807 19.5 19 19.5H5C3.61929 19.5 2.5 18.3807 2.5 17V7Z" fill="url(#card-fld-bg)" />
            <path d="M2.5 10.5C2.5 9.39543 3.39543 8.5 4.5 8.5H19.5C20.6046 8.5 21.5 9.39543 21.5 10.5V17C21.5 18.3807 20.3807 19.5 19 19.5H5C3.61929 19.5 2.5 18.3807 2.5 17V10.5Z" fill="url(#card-fld-fg)" />
            <defs>
              <linearGradient id="card-fld-bg" x1="2.5" y1="4.5" x2="21.5" y2="19.5" gradientUnits="userSpaceOnUse">
                <stop stop-color="#818CF8" />
                <stop offset="1" stop-color="#4F46E5" />
              </linearGradient>
              <linearGradient id="card-fld-fg" x1="2.5" y1="8.5" x2="21.5" y2="19.5" gradientUnits="userSpaceOnUse">
                <stop stop-color="#6366F1" />
                <stop offset="1" stop-color="#4338CA" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      `;
    }

    // 4. Developer / Document / Audio / Archive Rich Badge
    const symbolSize = Math.max(34, Math.round(cardWidth * 0.44));
    return `
      <div class="card-thumb-container card-symbol-container" style="height: ${previewHeight}px;">
        ${this.getCodeOrDocSymbol((item.extension || '').toLowerCase(), symbolSize)}
      </div>
    `;
  }

  /**
   * Generates developer symbols with distinct colors and glyphs (Java, C++, C#, Python, TS, etc.)
   */
  private static getCodeOrDocSymbol(ext: string, size: number): string {
    switch (ext) {
      // --- Java ---
      case 'java':
      case 'jar':
      case 'class':
        return `
          <div class="dev-badge dev-badge-java" style="width:${size}px; height:${size}px;" title="Java Source">
            <svg viewBox="0 0 32 32" width="100%" height="100%" fill="none">
              <rect width="32" height="32" rx="7" fill="url(#java-grad)" />
              <path d="M12 9C12 9 10 12 12.5 13C14.5 13.8 15.5 12.5 16 11.5C16.5 10.5 16 9.5 16 9.5" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" />
              <path d="M16 7C16 7 14 10 16.5 11C18.5 11.8 19.5 10.5 20 9.5" stroke="#FFD8A8" stroke-width="1.6" stroke-linecap="round" />
              <path d="M8 17.5C8 17.5 10 19 16 19C22 19 24 17.5 24 17.5M9.5 21C9.5 21 11.5 22.5 16 22.5C20.5 22.5 22.5 21 22.5 21" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" />
              <path d="M10 24.5C12 25.5 14 26 16 26C18 26 20 25.5 22 24.5" stroke="#FFD8A8" stroke-width="1.8" stroke-linecap="round" />
              <defs>
                <linearGradient id="java-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                  <stop stop-color="#EA580C" />
                  <stop offset="1" stop-color="#9A3412" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        `;

      // --- C++ ---
      case 'cpp':
      case 'cxx':
      case 'cc':
      case 'hpp':
      case 'hxx':
        return `
          <div class="dev-badge dev-badge-cpp" style="width:${size}px; height:${size}px;" title="C++ Source">
            <svg viewBox="0 0 32 32" width="100%" height="100%" fill="none">
              <rect width="32" height="32" rx="7" fill="url(#cpp-grad)" />
              <text x="5" y="22" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="12" fill="#FFFFFF" letter-spacing="-0.5">C++</text>
              <defs>
                <linearGradient id="cpp-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                  <stop stop-color="#0284C7" />
                  <stop offset="1" stop-color="#0369A1" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        `;

      // --- C# ---
      case 'cs':
      case 'csx':
        return `
          <div class="dev-badge dev-badge-cs" style="width:${size}px; height:${size}px;" title="C# Source">
            <svg viewBox="0 0 32 32" width="100%" height="100%" fill="none">
              <rect width="32" height="32" rx="7" fill="url(#cs-grad)" />
              <text x="7" y="22" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="13" fill="#FFFFFF" letter-spacing="-0.5">C#</text>
              <defs>
                <linearGradient id="cs-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                  <stop stop-color="#9333EA" />
                  <stop offset="1" stop-color="#6B21A8" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        `;

      // --- C ---
      case 'c':
      case 'h':
        return `
          <div class="dev-badge dev-badge-c" style="width:${size}px; height:${size}px;" title="C Source">
            <svg viewBox="0 0 32 32" width="100%" height="100%" fill="none">
              <rect width="32" height="32" rx="7" fill="url(#c-grad)" />
              <text x="10" y="23" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="16" fill="#FFFFFF">C</text>
              <defs>
                <linearGradient id="c-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                  <stop stop-color="#475569" />
                  <stop offset="1" stop-color="#1E293B" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        `;

      // --- Python ---
      case 'py':
      case 'pyw':
      case 'ipynb':
        return `
          <div class="dev-badge dev-badge-py" style="width:${size}px; height:${size}px;" title="Python Source">
            <svg viewBox="0 0 32 32" width="100%" height="100%" fill="none">
              <rect width="32" height="32" rx="7" fill="#1E293B" />
              <path d="M15.8 7C11.5 7 11.7 8.8 11.7 8.8L11.7 10.7H16V11.3H9.8C8 11.3 6.5 12.8 6.5 15.3C6.5 17.8 7.8 17.8 7.8 17.8H9.3V16.3C9.3 14.5 10.8 13.2 12.7 13.2H16.2C17.7 13.2 18.9 12 18.9 10.5V8.8C18.9 8.8 19.1 7 15.8 7Z" fill="#38BDF8" />
              <circle cx="13.5" cy="8.9" r="0.9" fill="#FFFFFF" />
              <path d="M16.2 25C20.5 25 20.3 23.2 20.3 23.2L20.3 21.3H16V20.7H22.2C24 20.7 25.5 19.2 25.5 16.7C25.5 14.2 24.2 14.2 24.2 14.2H22.7V15.7C22.7 17.5 21.2 18.8 19.3 18.8H15.8C14.3 18.8 13.1 20 13.1 21.5V23.2C13.1 23.2 12.9 25 16.2 25Z" fill="#FACC15" />
              <circle cx="18.5" cy="23.1" r="0.9" fill="#1E293B" />
            </svg>
          </div>
        `;

      // --- TypeScript ---
      case 'ts':
      case 'tsx':
        return `
          <div class="dev-badge dev-badge-ts" style="width:${size}px; height:${size}px;" title="TypeScript Source">
            <svg viewBox="0 0 32 32" width="100%" height="100%" fill="none">
              <rect width="32" height="32" rx="7" fill="#0284C7" />
              <text x="7" y="22" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="12" fill="#FFFFFF" letter-spacing="-0.5">TS</text>
            </svg>
          </div>
        `;

      // --- JavaScript ---
      case 'js':
      case 'jsx':
      case 'mjs':
      case 'cjs':
        return `
          <div class="dev-badge dev-badge-js" style="width:${size}px; height:${size}px;" title="JavaScript Source">
            <svg viewBox="0 0 32 32" width="100%" height="100%" fill="none">
              <rect width="32" height="32" rx="7" fill="#FACC15" />
              <text x="8" y="22" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="12" fill="#0F172A" letter-spacing="-0.5">JS</text>
            </svg>
          </div>
        `;

      // --- Rust ---
      case 'rs':
        return `
          <div class="dev-badge dev-badge-rs" style="width:${size}px; height:${size}px;" title="Rust Source">
            <svg viewBox="0 0 32 32" width="100%" height="100%" fill="none">
              <rect width="32" height="32" rx="7" fill="#C2410C" />
              <text x="8" y="22" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="13" fill="#FFFFFF">RS</text>
            </svg>
          </div>
        `;

      // --- Go ---
      case 'go':
        return `
          <div class="dev-badge dev-badge-go" style="width:${size}px; height:${size}px;" title="Go Source">
            <svg viewBox="0 0 32 32" width="100%" height="100%" fill="none">
              <rect width="32" height="32" rx="7" fill="#06B6D4" />
              <text x="6" y="22" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="13" fill="#FFFFFF">GO</text>
            </svg>
          </div>
        `;

      // --- HTML ---
      case 'html':
      case 'htm':
        return `
          <div class="dev-badge dev-badge-html" style="width:${size}px; height:${size}px;" title="HTML Document">
            <svg viewBox="0 0 32 32" width="100%" height="100%" fill="none">
              <rect width="32" height="32" rx="7" fill="#EA580C" />
              <path d="M11 11L7 16L11 21M21 11L25 16L21 21M18 9L14 23" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>
        `;

      // --- CSS / Sass ---
      case 'css':
      case 'scss':
      case 'sass':
      case 'less':
        return `
          <div class="dev-badge dev-badge-css" style="width:${size}px; height:${size}px;" title="StyleSheet">
            <svg viewBox="0 0 32 32" width="100%" height="100%" fill="none">
              <rect width="32" height="32" rx="7" fill="#2563EB" />
              <text x="8" y="23" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="15" fill="#FFFFFF">#</text>
            </svg>
          </div>
        `;

      // --- JSON / Config ---
      case 'json':
      case 'yaml':
      case 'yml':
      case 'xml':
      case 'toml':
        return `
          <div class="dev-badge dev-badge-json" style="width:${size}px; height:${size}px;" title="Data / Configuration">
            <svg viewBox="0 0 32 32" width="100%" height="100%" fill="none">
              <rect width="32" height="32" rx="7" fill="#D97706" />
              <text x="7" y="22" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="14" fill="#FFFFFF">{ }</text>
            </svg>
          </div>
        `;

      // --- SQL / Database ---
      case 'sql':
      case 'db':
      case 'sqlite':
        return `
          <div class="dev-badge dev-badge-sql" style="width:${size}px; height:${size}px;" title="Database / SQL">
            <svg viewBox="0 0 32 32" width="100%" height="100%" fill="none">
              <rect width="32" height="32" rx="7" fill="#059669" />
              <ellipse cx="16" cy="11" rx="7" ry="3" stroke="#FFFFFF" stroke-width="2" />
              <path d="M9 11V21C9 22.6569 12.134 24 16 24C19.866 24 23 22.6569 23 21V11" stroke="#FFFFFF" stroke-width="2" />
              <path d="M9 16C9 17.6569 12.134 19 16 19C19.866 19 23 17.6569 23 16" stroke="#FFFFFF" stroke-width="2" />
            </svg>
          </div>
        `;

      // --- Shell / Script ---
      case 'sh':
      case 'bash':
      case 'ps1':
      case 'bat':
      case 'cmd':
        return `
          <div class="dev-badge dev-badge-sh" style="width:${size}px; height:${size}px;" title="Shell Script">
            <svg viewBox="0 0 32 32" width="100%" height="100%" fill="none">
              <rect width="32" height="32" rx="7" fill="#1E293B" stroke="rgba(255,255,255,0.1)" />
              <path d="M9 12L13 16L9 20M15 20H22" stroke="#10B981" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>
        `;

      // --- Markdown ---
      case 'md':
      case 'markdown':
        return `
          <div class="dev-badge dev-badge-md" style="width:${size}px; height:${size}px;" title="Markdown">
            <svg viewBox="0 0 32 32" width="100%" height="100%" fill="none">
              <rect width="32" height="32" rx="7" fill="#3B82F6" />
              <path d="M7 21V11L11 15L15 11V21M22 17V21M19 18L22 21L25 18" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>
        `;

      // --- PDF ---
      case 'pdf':
        return `
          <div class="dev-badge dev-badge-pdf" style="width:${size}px; height:${size}px;" title="PDF Document">
            <svg viewBox="0 0 32 32" width="100%" height="100%" fill="none">
              <rect width="32" height="32" rx="7" fill="#DC2626" />
              <text x="6" y="21" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="10" fill="#FFFFFF">PDF</text>
            </svg>
          </div>
        `;

      // --- Archive ---
      case 'zip':
      case 'rar':
      case '7z':
      case 'tar':
      case 'gz':
        return `
          <div class="dev-badge dev-badge-zip" style="width:${size}px; height:${size}px;" title="Archive">
            <svg viewBox="0 0 32 32" width="100%" height="100%" fill="none">
              <rect width="32" height="32" rx="7" fill="#D97706" />
              <rect x="8" y="8" width="16" height="16" rx="2" stroke="#FFFFFF" stroke-width="1.8" />
              <path d="M16 8V24M14 10H16M16 12H18M14 14H16M16 16H18" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round" />
            </svg>
          </div>
        `;

      // --- Audio ---
      case 'mp3':
      case 'wav':
      case 'flac':
      case 'aac':
      case 'ogg':
      case 'm4a':
        return `
          <div class="dev-badge dev-badge-audio" style="width:${size}px; height:${size}px;" title="Audio File">
            <svg viewBox="0 0 32 32" width="100%" height="100%" fill="none">
              <rect width="32" height="32" rx="7" fill="#7C3AED" />
              <circle cx="12" cy="21" r="3" stroke="#FFFFFF" stroke-width="2" fill="#FFFFFF" />
              <circle cx="21" cy="18" r="3" stroke="#FFFFFF" stroke-width="2" fill="#FFFFFF" />
              <path d="M15 21V10L24 7V18" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>
        `;

      // --- Image generic / fallback ---
      case 'image':
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'webp':
      case 'gif':
      case 'bmp':
      case 'svg':
      case 'ico':
        return `
          <div class="dev-badge dev-badge-img" style="width:${size}px; height:${size}px;" title="Image File">
            <svg viewBox="0 0 32 32" width="100%" height="100%" fill="none">
              <rect width="32" height="32" rx="7" fill="url(#img-badge-grad)" />
              <circle cx="11" cy="11" r="2.5" fill="#FFFFFF" />
              <path d="M7 23L13 15L17 19L21 15L25 23H7Z" fill="#FFFFFF" />
              <defs>
                <linearGradient id="img-badge-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                  <stop stop-color="#06B6D4" />
                  <stop offset="1" stop-color="#0284C7" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        `;

      // --- Video generic ---
      case 'video':
      case 'mp4':
      case 'mkv':
      case 'mov':
      case 'avi':
      case 'webm':
        return `
          <div class="dev-badge dev-badge-video" style="width:${size}px; height:${size}px;" title="Video File">
            <svg viewBox="0 0 32 32" width="100%" height="100%" fill="none">
              <rect width="32" height="32" rx="7" fill="#E11D48" />
              <polygon points="12,10 22,16 12,22" fill="#FFFFFF" />
            </svg>
          </div>
        `;

      // --- Default Generic File ---
      default:
        return `
          <svg class="file-icon-svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/>
            <polyline points="13 2 13 9 20 9"/>
          </svg>
        `;
    }
  }
}
