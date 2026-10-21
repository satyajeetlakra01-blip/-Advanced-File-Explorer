import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Code Sandbox Editor & Debugger', () => {
  it('detects language based on file extension accurately', () => {
    const detectLanguage = (fileName: string): string => {
      const ext = fileName.toLowerCase().split('.').pop() || '';
      const map: Record<string, string> = {
        ts: 'TypeScript',
        tsx: 'TypeScript (React)',
        js: 'JavaScript',
        jsx: 'JavaScript (React)',
        py: 'Python',
        json: 'JSON',
        html: 'HTML',
        css: 'CSS',
        rs: 'Rust',
        sh: 'Shell Script',
        ps1: 'PowerShell',
        bat: 'Batch',
        md: 'Markdown',
      };
      return map[ext] || 'Plain Text';
    };

    expect(detectLanguage('index.ts')).toBe('TypeScript');
    expect(detectLanguage('App.tsx')).toBe('TypeScript (React)');
    expect(detectLanguage('script.py')).toBe('Python');
    expect(detectLanguage('package.json')).toBe('JSON');
    expect(detectLanguage('run.ps1')).toBe('PowerShell');
    expect(detectLanguage('unknown.xyz')).toBe('Plain Text');
  });

  it('tracks dirty unsaved status when file content changes', () => {
    const initialContent = 'console.log("hello world");';
    let currentContent = initialContent;
    let isDirty = currentContent !== initialContent;
    expect(isDirty).toBe(false);

    currentContent = 'console.log("hello universe");';
    isDirty = currentContent !== initialContent;
    expect(isDirty).toBe(true);

    currentContent = initialContent;
    isDirty = currentContent !== initialContent;
    expect(isDirty).toBe(false);
  });

  it('handles tab indentation and auto-indent calculations correctly', () => {
    const line = '    function test() {';
    const match = line.match(/^(\s+)/);
    const indent = match ? match[1] : '';
    const extraIndent = line.trim().endsWith('{') ? '  ' : '';
    const nextLineIndent = indent + extraIndent;

    expect(nextLineIndent).toBe('      ');
  });
});
