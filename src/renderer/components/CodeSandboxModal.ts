import { appStore } from '../store/appStore';
import { Modals } from './Modals';

interface OpenEditorFile {
  path: string;
  name: string;
  content: string;
  savedContent: string;
  language: string;
  sizeBytes: number;
  modifiedMs: number;
  isDirty: boolean;
  line: number;
  col: number;
}

export class CodeSandboxModal {
  private overlay: HTMLElement | null = null;
  private openFiles: OpenEditorFile[] = [];
  private activeIndex = -1;
  private consoleLogs: { type: 'info' | 'warn' | 'error' | 'success'; text: string; time: string }[] = [];
  private isRunning = false;

  constructor() {
    window.addEventListener('app:open-code-sandbox', (e: Event) => {
      const detail = (e as CustomEvent).detail as { path: string };
      if (detail?.path) {
        this.open(detail.path);
      }
    });
  }

  public async open(filePath: string) {
    // If already open, switch to it
    const existingIndex = this.openFiles.findIndex(
      (f) => f.path.toLowerCase() === filePath.toLowerCase()
    );
    if (existingIndex !== -1) {
      this.activeIndex = existingIndex;
      this.render();
      this.focusEditor();
      return;
    }

    try {
      const res = await window.electronApi.readTextFile(filePath);
      if (!res.success || res.content === undefined) {
        throw new Error(res.error || 'Failed to read file');
      }

      const name = filePath.split(/[\\/]/).pop() || filePath;
      const language = this.detectLanguage(name);

      const file: OpenEditorFile = {
        path: filePath,
        name,
        content: res.content,
        savedContent: res.content,
        language,
        sizeBytes: res.sizeBytes || 0,
        modifiedMs: res.modifiedMs || Date.now(),
        isDirty: false,
        line: 1,
        col: 1,
      };

      this.openFiles.push(file);
      this.activeIndex = this.openFiles.length - 1;
      this.addLog('info', `Opened '${name}' (${language})`);
      this.render();
      this.focusEditor();
    } catch (err: any) {
      Modals.showToast(`Cannot open file in sandbox: ${err.message}`);
    }
  }

  private detectLanguage(fileName: string): string {
    const ext = fileName.toLowerCase().split('.').pop() || '';
    const map: Record<string, string> = {
      ts: 'TypeScript',
      tsx: 'TypeScript (React)',
      js: 'JavaScript',
      jsx: 'JavaScript (React)',
      mjs: 'JavaScript (ESM)',
      cjs: 'JavaScript (CJS)',
      json: 'JSON',
      html: 'HTML',
      css: 'CSS',
      scss: 'SCSS',
      less: 'LESS',
      py: 'Python',
      rs: 'Rust',
      go: 'Go',
      c: 'C',
      cpp: 'C++',
      h: 'C Header',
      hpp: 'C++ Header',
      java: 'Java',
      cs: 'C#',
      php: 'PHP',
      rb: 'Ruby',
      sh: 'Shell Script',
      bash: 'Bash',
      ps1: 'PowerShell',
      bat: 'Batch',
      cmd: 'Command Script',
      md: 'Markdown',
      txt: 'Plain Text',
      yml: 'YAML',
      yaml: 'YAML',
      toml: 'TOML',
      xml: 'XML',
      svg: 'SVG XML',
      sql: 'SQL',
      env: 'Environment Config',
    };
    return map[ext] || 'Plain Text';
  }

  private addLog(type: 'info' | 'warn' | 'error' | 'success', text: string) {
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    this.consoleLogs.push({ type, text, time });
    if (this.consoleLogs.length > 200) {
      this.consoleLogs.shift();
    }
    this.updateConsoleDom();
  }

  public close() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  private async saveActiveFile() {
    if (this.activeIndex < 0 || this.activeIndex >= this.openFiles.length) return;
    const file = this.openFiles[this.activeIndex];
    try {
      const res = await window.electronApi.writeTextFile(file.path, file.content);
      if (res.success) {
        file.savedContent = file.content;
        file.isDirty = false;
        file.sizeBytes = res.sizeBytes || file.sizeBytes;
        file.modifiedMs = res.modifiedMs || Date.now();
        this.addLog('success', `Saved '${file.name}' (${file.content.length} characters)`);
        Modals.showToast(`Saved '${file.name}'`);
        this.renderTabs();
        this.updateStatusBar();
      } else {
        throw new Error(res.error || 'Write error');
      }
    } catch (err: any) {
      this.addLog('error', `Failed to save '${file.name}': ${err.message}`);
      Modals.showToast(`Error saving file: ${err.message}`);
    }
  }

  private async runActiveCode() {
    if (this.activeIndex < 0 || this.activeIndex >= this.openFiles.length) return;
    const file = this.openFiles[this.activeIndex];

    // If dirty, auto-save first
    if (file.isDirty) {
      await this.saveActiveFile();
    }

    this.isRunning = true;
    this.renderActions();
    this.addLog('info', `Executing ${file.name} in sandbox runtime...`);

    try {
      const res = await window.electronApi.runCodeSandbox({
        code: file.content,
        language: file.language,
        filePath: file.path,
      });

      this.isRunning = false;
      this.renderActions();

      if (res.stdout) {
        this.addLog('info', res.stdout.trimEnd());
      }
      if (res.stderr) {
        this.addLog('error', res.stderr.trimEnd());
      }

      if (res.success) {
        this.addLog(
          'success',
          `Process exited with code 0 in ${res.durationMs}ms`
        );
      } else {
        this.addLog(
          'error',
          `Process finished with error (exit code ${res.exitCode}) in ${res.durationMs}ms`
        );
      }
    } catch (err: any) {
      this.isRunning = false;
      this.renderActions();
      this.addLog('error', `Execution error: ${err.message}`);
    }
  }

  private render() {
    if (this.openFiles.length === 0) {
      this.close();
      return;
    }

    if (!this.overlay) {
      this.overlay = document.createElement('div');
      this.overlay.className = 'code-sandbox-overlay';
      document.body.appendChild(this.overlay);
    }

    const file = this.openFiles[this.activeIndex];
    const lineCount = file.content.split('\n').length;
    let lineNumbersHtml = '';
    for (let i = 1; i <= Math.max(1, lineCount); i++) {
      lineNumbersHtml += `<div>${i}</div>`;
    }

    this.overlay.innerHTML = `
      <div class="code-sandbox-window">
        <!-- Top Titlebar / Controls -->
        <div class="sandbox-titlebar">
          <div class="sandbox-title-left">
            <svg class="sandbox-vscode-icon" width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M17.5 2.5L7 11.5L2 7.5L0.5 8.5L7 14L2 19L7 22.5L17.5 13.5V2.5Z" fill="#ef233c"/>
              <path d="M17.5 2.5L23.5 6V18L17.5 21.5V2.5Z" fill="#ff4d6d"/>
            </svg>
            <span class="sandbox-brand">Armeture Code Sandbox</span>
            <span class="sandbox-path-badge">${file.path}</span>
          </div>

          <div class="sandbox-title-actions" id="sandbox-actions-container">
            <!-- Buttons dynamically populated -->
          </div>
        </div>

        <!-- VSCode-style Tab Header Bar -->
        <div class="sandbox-tabs-bar" id="sandbox-tabs"></div>

        <!-- Main Editor Body -->
        <div class="sandbox-editor-split">
          <div class="sandbox-editor-pane">
            <div class="sandbox-gutter" id="sandbox-gutter">
              ${lineNumbersHtml}
            </div>
            <textarea
              id="sandbox-textarea"
              class="sandbox-code-area"
              spellcheck="false"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="off"
            >${this.escapeHtml(file.content)}</textarea>
          </div>

          <!-- Integrated Bottom Debug Console -->
          <div class="sandbox-console-pane">
            <div class="sandbox-console-header">
              <div class="sandbox-console-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
                </svg>
                <span>Debug Console & Sandbox Terminal</span>
                <span class="sandbox-runtime-pill">${file.language} Runtime</span>
              </div>
              <div class="sandbox-console-actions">
                <button class="sandbox-mini-btn" id="btn-clear-console" title="Clear Console">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                  </svg>
                  <span>Clear</span>
                </button>
              </div>
            </div>
            <div class="sandbox-console-output" id="sandbox-console-output"></div>
          </div>
        </div>

        <!-- Status Bar -->
        <div class="sandbox-statusbar" id="sandbox-statusbar"></div>
      </div>
    `;

    this.renderTabs();
    this.renderActions();
    this.updateConsoleDom();
    this.updateStatusBar();
    this.attachEditorEvents();
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private renderTabs() {
    const tabsContainer = this.overlay?.querySelector('#sandbox-tabs');
    if (!tabsContainer) return;

    let html = '';
    this.openFiles.forEach((f, idx) => {
      const isActive = idx === this.activeIndex;
      html += `
        <div class="sandbox-tab ${isActive ? 'active' : ''}" data-tab-idx="${idx}">
          <span class="sandbox-tab-name">${f.name}</span>
          ${f.isDirty ? '<span class="sandbox-dirty-dot" title="Unsaved changes">●</span>' : ''}
          <button class="sandbox-tab-close" data-close-idx="${idx}" title="Close">✕</button>
        </div>
      `;
    });

    tabsContainer.innerHTML = html;

    tabsContainer.querySelectorAll<HTMLElement>('.sandbox-tab').forEach((tabEl) => {
      tabEl.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.sandbox-tab-close')) return;
        const idx = parseInt(tabEl.getAttribute('data-tab-idx') || '0', 10);
        this.activeIndex = idx;
        this.render();
        this.focusEditor();
      });
    });

    tabsContainer.querySelectorAll<HTMLElement>('.sandbox-tab-close').forEach((closeBtn) => {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(closeBtn.getAttribute('data-close-idx') || '0', 10);
        this.closeTab(idx);
      });
    });
  }

  private closeTab(index: number) {
    const file = this.openFiles[index];
    if (file.isDirty) {
      if (!confirm(`'${file.name}' has unsaved changes. Do you want to close it?`)) {
        return;
      }
    }

    this.openFiles.splice(index, 1);
    if (this.openFiles.length === 0) {
      this.close();
      return;
    }
    if (this.activeIndex >= this.openFiles.length) {
      this.activeIndex = this.openFiles.length - 1;
    }
    this.render();
    this.focusEditor();
  }

  private renderActions() {
    const actionsContainer = this.overlay?.querySelector('#sandbox-actions-container');
    if (!actionsContainer) return;

    actionsContainer.innerHTML = `
      <button class="sandbox-btn-run ${this.isRunning ? 'running' : ''}" id="btn-run-code" title="Execute script in sandbox (Ctrl+Enter)">
        ${
          this.isRunning
            ? `<div class="sandbox-spinner"></div><span>Running...</span>`
            : `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg><span>Run / Debug</span>`
        }
      </button>

      <button class="sandbox-action-btn" id="btn-save-code" title="Save changes (Ctrl+S)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
          <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
        </svg>
        <span>Save</span>
      </button>

      <button class="sandbox-action-btn" id="btn-open-external" title="Open in default editor / VS Code">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
        <span>External</span>
      </button>

      <button class="sandbox-action-btn close-btn" id="btn-close-sandbox" title="Close Sandbox (Esc)">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;

    actionsContainer.querySelector('#btn-run-code')?.addEventListener('click', () => {
      this.runActiveCode();
    });

    actionsContainer.querySelector('#btn-save-code')?.addEventListener('click', () => {
      this.saveActiveFile();
    });

    actionsContainer.querySelector('#btn-open-external')?.addEventListener('click', () => {
      const file = this.openFiles[this.activeIndex];
      if (file) {
        window.electronApi.openPath(file.path);
      }
    });

    actionsContainer.querySelector('#btn-close-sandbox')?.addEventListener('click', () => {
      this.close();
    });
  }

  private updateConsoleDom() {
    const consoleOutput = this.overlay?.querySelector('#sandbox-console-output');
    if (!consoleOutput) return;

    let html = '';
    for (const log of this.consoleLogs) {
      html += `
        <div class="sandbox-log-row log-${log.type}">
          <span class="log-time">[${log.time}]</span>
          <span class="log-badge ${log.type}">${log.type.toUpperCase()}</span>
          <pre class="log-text">${this.escapeHtml(log.text)}</pre>
        </div>
      `;
    }
    consoleOutput.innerHTML = html;
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
  }

  private updateStatusBar() {
    const statusbar = this.overlay?.querySelector('#sandbox-statusbar');
    if (!statusbar) return;

    const file = this.openFiles[this.activeIndex];
    const lines = file.content.split('\n').length;
    const chars = file.content.length;

    statusbar.innerHTML = `
      <div class="statusbar-left">
        <span class="status-item"><span class="status-dot ${file.isDirty ? 'dirty' : 'clean'}"></span>${file.isDirty ? 'Modified' : 'Saved'}</span>
        <span class="status-item">${file.language}</span>
        <span class="status-item">UTF-8</span>
        <span class="status-item">Spaces: 2</span>
      </div>
      <div class="statusbar-right">
        <span class="status-item">Ln ${file.line}, Col ${file.col}</span>
        <span class="status-item">${lines} lines, ${chars} chars</span>
        <span class="status-item">${(file.sizeBytes / 1024).toFixed(1)} KB</span>
      </div>
    `;
  }

  private attachEditorEvents() {
    const textarea = this.overlay?.querySelector('#sandbox-textarea') as HTMLTextAreaElement | null;
    const gutter = this.overlay?.querySelector('#sandbox-gutter') as HTMLElement | null;
    const btnClear = this.overlay?.querySelector('#btn-clear-console');

    btnClear?.addEventListener('click', () => {
      this.consoleLogs = [];
      this.updateConsoleDom();
    });

    if (!textarea || !gutter) return;

    // Synchronize gutter scrolling with textarea
    textarea.addEventListener('scroll', () => {
      gutter.scrollTop = textarea.scrollTop;
    });

    // Content change handler
    textarea.addEventListener('input', () => {
      const file = this.openFiles[this.activeIndex];
      file.content = textarea.value;
      file.isDirty = file.content !== file.savedContent;

      // Update gutter line numbers
      const lines = file.content.split('\n').length;
      let lineNumbersHtml = '';
      for (let i = 1; i <= Math.max(1, lines); i++) {
        lineNumbersHtml += `<div>${i}</div>`;
      }
      gutter.innerHTML = lineNumbersHtml;

      this.updateCursorPosition(textarea, file);
      this.renderTabs();
      this.updateStatusBar();
    });

    // Cursor position tracking on click/keyup
    const trackCursor = () => {
      const file = this.openFiles[this.activeIndex];
      this.updateCursorPosition(textarea, file);
      this.updateStatusBar();
    };

    textarea.addEventListener('click', trackCursor);
    textarea.addEventListener('keyup', trackCursor);

    // Keyboard Shortcuts: Tab, Enter auto-indent, Auto-closing brackets, Ctrl+S, Ctrl+Enter, Esc
    textarea.addEventListener('keydown', (e) => {
      // Ctrl+S: Save
      if (e.ctrlKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        this.saveActiveFile();
        return;
      }

      // Ctrl+Enter: Run
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        this.runActiveCode();
        return;
      }

      // Esc: Close if not busy
      if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
        return;
      }

      // Tab key: Insert 2 spaces
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;

        if (e.shiftKey) {
          // Unindent
          const val = textarea.value;
          const lineStart = val.lastIndexOf('\n', start - 1) + 1;
          if (val.slice(lineStart, lineStart + 2) === '  ') {
            textarea.value = val.slice(0, lineStart) + val.slice(lineStart + 2);
            textarea.selectionStart = textarea.selectionEnd = Math.max(lineStart, start - 2);
            textarea.dispatchEvent(new Event('input'));
          }
        } else {
          // Indent 2 spaces
          textarea.setRangeText('  ', start, end, 'end');
          textarea.dispatchEvent(new Event('input'));
        }
        return;
      }

      // Auto-closing brackets & quotes
      const pairs: Record<string, string> = {
        '(': ')',
        '[': ']',
        '{': '}',
        '"': '"',
        "'": "'",
        '`': '`',
      };

      if (pairs[e.key] && textarea.selectionStart === textarea.selectionEnd) {
        const start = textarea.selectionStart;
        const closing = pairs[e.key];
        e.preventDefault();
        textarea.setRangeText(`${e.key}${closing}`, start, start, 'end');
        textarea.selectionStart = textarea.selectionEnd = start + 1;
        textarea.dispatchEvent(new Event('input'));
        return;
      }

      // Auto-indent on Enter
      if (e.key === 'Enter') {
        const start = textarea.selectionStart;
        const val = textarea.value;
        const lineStart = val.lastIndexOf('\n', start - 1) + 1;
        const currentLine = val.slice(lineStart, start);
        const match = currentLine.match(/^(\s+)/);
        const indent = match ? match[1] : '';

        // If line ends with '{', increase indent
        const extraIndent = currentLine.trim().endsWith('{') ? '  ' : '';

        e.preventDefault();
        const insertText = '\n' + indent + extraIndent;
        textarea.setRangeText(insertText, start, start, 'end');
        textarea.dispatchEvent(new Event('input'));
        return;
      }
    });
  }

  private updateCursorPosition(textarea: HTMLTextAreaElement, file: OpenEditorFile) {
    const pos = textarea.selectionStart;
    const textBefore = textarea.value.substring(0, pos);
    const lines = textBefore.split('\n');
    file.line = lines.length;
    file.col = lines[lines.length - 1].length + 1;
  }

  private focusEditor() {
    setTimeout(() => {
      const textarea = this.overlay?.querySelector('#sandbox-textarea') as HTMLTextAreaElement | null;
      textarea?.focus();
    }, 50);
  }
}

export const codeSandbox = new CodeSandboxModal();
