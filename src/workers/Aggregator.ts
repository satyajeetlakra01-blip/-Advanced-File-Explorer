import { LargestItem, TypeBreakdownItem, TypeCategory } from '../shared/types';

const EXTENSION_CATEGORIES: Record<string, TypeCategory> = {
  // Documents
  pdf: 'Documents', doc: 'Documents', docx: 'Documents', txt: 'Documents',
  rtf: 'Documents', odt: 'Documents', xls: 'Documents', xlsx: 'Documents',
  ppt: 'Documents', pptx: 'Documents', csv: 'Documents', tsv: 'Documents',
  md: 'Documents', epub: 'Documents',

  // Media
  mp4: 'Media', mkv: 'Media', avi: 'Media', mov: 'Media', wmv: 'Media',
  mp3: 'Media', wav: 'Media', flac: 'Media', aac: 'Media', ogg: 'Media',
  png: 'Media', jpg: 'Media', jpeg: 'Media', webp: 'Media', gif: 'Media',
  svg: 'Media', bmp: 'Media', ico: 'Media', psd: 'Media', tiff: 'Media',

  // Archives
  zip: 'Archives', rar: 'Archives', '7z': 'Archives', tar: 'Archives',
  gz: 'Archives', bz2: 'Archives', xz: 'Archives', iso: 'Archives',
  dmg: 'Archives', cab: 'Archives',

  // Code
  js: 'Code', ts: 'Code', jsx: 'Code', tsx: 'Code', html: 'Code',
  css: 'Code', scss: 'Code', json: 'Code', py: 'Code', c: 'Code',
  cpp: 'Code', h: 'Code', hpp: 'Code', cs: 'Code', rs: 'Code',
  go: 'Code', java: 'Code', sh: 'Code', ps1: 'Code', yml: 'Code',
  yaml: 'Code', xml: 'Code', sql: 'Code', php: 'Code', rb: 'Code',
  vue: 'Code', svelte: 'Code', wasm: 'Code',

  // Executables
  exe: 'Executables', dll: 'Executables', msi: 'Executables',
  bat: 'Executables', cmd: 'Executables', sys: 'Executables',
};

export class Aggregator {
  totalFiles = 0;
  totalFolders = 0;
  totalBytes = 0;
  physicalBytes = 0;
  emptyFolders = 0;
  hiddenCount = 0;
  clusterSize = 4096; // NTFS standard cluster size

  private typeStats: Record<TypeCategory, { sizeBytes: number; count: number }> = {
    Documents: { sizeBytes: 0, count: 0 },
    Media: { sizeBytes: 0, count: 0 },
    Archives: { sizeBytes: 0, count: 0 },
    Code: { sizeBytes: 0, count: 0 },
    Executables: { sizeBytes: 0, count: 0 },
    Other: { sizeBytes: 0, count: 0 },
  };

  private topFiles: LargestItem[] = [];
  private subfolderSizes: Map<string, number> = new Map();

  addFile(name: string, path: string, sizeBytes: number, isHidden = false): void {
    this.totalFiles += 1;
    this.totalBytes += sizeBytes;

    // NTFS physical cluster allocation
    const allocated = sizeBytes === 0 ? 0 : Math.ceil(sizeBytes / this.clusterSize) * this.clusterSize;
    this.physicalBytes += allocated;

    if (isHidden) this.hiddenCount += 1;

    // Type classification
    const ext = name.split('.').pop()?.toLowerCase() || '';
    const category = EXTENSION_CATEGORIES[ext] || 'Other';
    this.typeStats[category].sizeBytes += sizeBytes;
    this.typeStats[category].count += 1;

    // Top-5 largest files insertion
    this.insertTopFile({
      name,
      path,
      sizeBytes,
      isDirectory: false,
    });
  }

  addFolder(name: string, path: string, isDirectChild: boolean, isHidden = false): void {
    this.totalFolders += 1;
    if (isHidden) this.hiddenCount += 1;
    if (isDirectChild) {
      if (!this.subfolderSizes.has(name)) {
        this.subfolderSizes.set(name, 0);
      }
    }
  }

  addBytesToDirectSubfolder(folderName: string, sizeBytes: number): void {
    const current = this.subfolderSizes.get(folderName) || 0;
    this.subfolderSizes.set(folderName, current + sizeBytes);
  }

  incrementEmptyFolders(): void {
    this.emptyFolders += 1;
  }

  private insertTopFile(item: LargestItem): void {
    if (this.topFiles.length < 5) {
      this.topFiles.push(item);
      this.topFiles.sort((a, b) => b.sizeBytes - a.sizeBytes);
    } else if (item.sizeBytes > this.topFiles[this.topFiles.length - 1].sizeBytes) {
      this.topFiles[this.topFiles.length - 1] = item;
      this.topFiles.sort((a, b) => b.sizeBytes - a.sizeBytes);
    }
  }

  getLargestFiles(): LargestItem[] {
    return [...this.topFiles];
  }

  getLargestSubfolders(rootPath: string): LargestItem[] {
    const items: LargestItem[] = [];
    for (const [name, sizeBytes] of this.subfolderSizes.entries()) {
      items.push({
        name,
        path: `${rootPath}\\${name}`,
        sizeBytes,
        isDirectory: true,
      });
    }
    items.sort((a, b) => b.sizeBytes - a.sizeBytes);
    return items.slice(0, 5);
  }

  getTypeBreakdown(): TypeBreakdownItem[] {
    const result: TypeBreakdownItem[] = [];
    const total = this.totalBytes || 1;

    for (const [cat, data] of Object.entries(this.typeStats)) {
      if (data.count > 0 || data.sizeBytes > 0) {
        result.push({
          category: cat as TypeCategory,
          sizeBytes: data.sizeBytes,
          fileCount: data.count,
          percentage: Math.round((data.sizeBytes / total) * 1000) / 10,
        });
      }
    }

    result.sort((a, b) => b.sizeBytes - a.sizeBytes);
    return result;
  }
}
