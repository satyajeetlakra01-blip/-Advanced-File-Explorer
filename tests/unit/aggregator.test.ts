import { describe, it, expect, beforeEach } from 'vitest';
import { Aggregator } from '../../src/workers/Aggregator';

describe('Aggregator Engine', () => {
  let aggregator: Aggregator;

  beforeEach(() => {
    aggregator = new Aggregator();
  });

  it('correctly aggregates direct files, folders, and bytes', () => {
    aggregator.addFolder('docs', 'C:\\root\\docs', true);
    aggregator.addFolder('src', 'C:\\root\\src', true);
    aggregator.addFile('main.ts', 'C:\\root\\src\\main.ts', 1024);
    aggregator.addFile('readme.md', 'C:\\root\\readme.md', 2048);

    expect(aggregator.totalFolders).toBe(2);
    expect(aggregator.totalFiles).toBe(2);
    expect(aggregator.totalBytes).toBe(3072);
  });

  it('accurately categorizes file types into breakdown buckets', () => {
    aggregator.addFile('code.ts', 'C:\\code.ts', 1000);
    aggregator.addFile('video.mp4', 'C:\\video.mp4', 5000);
    aggregator.addFile('doc.pdf', 'C:\\doc.pdf', 2000);
    aggregator.addFile('bundle.zip', 'C:\\bundle.zip', 2000);

    const breakdown = aggregator.getTypeBreakdown();
    expect(breakdown.length).toBe(4);

    const media = breakdown.find((b) => b.category === 'Media');
    expect(media).toBeDefined();
    expect(media?.sizeBytes).toBe(5000);
    expect(media?.percentage).toBe(50); // 5000 / 10000 = 50%
  });

  it('maintains the top-5 largest files in descending order', () => {
    aggregator.addFile('small.txt', 'C:\\small.txt', 10);
    aggregator.addFile('huge.iso', 'C:\\huge.iso', 100000);
    aggregator.addFile('medium.dat', 'C:\\medium.dat', 5000);
    aggregator.addFile('large.zip', 'C:\\large.zip', 20000);
    aggregator.addFile('tiny.log', 'C:\\tiny.log', 5);
    aggregator.addFile('giant.tar', 'C:\\giant.tar', 50000);

    const topFiles = aggregator.getLargestFiles();
    expect(topFiles.length).toBe(5);
    expect(topFiles[0].name).toBe('huge.iso');
    expect(topFiles[0].sizeBytes).toBe(100000);
    expect(topFiles[1].name).toBe('giant.tar');
    expect(topFiles[1].sizeBytes).toBe(50000);
    expect(topFiles[2].name).toBe('large.zip');
    expect(topFiles[2].sizeBytes).toBe(20000);
  });

  it('tracks empty folders accurately', () => {
    aggregator.incrementEmptyFolders();
    aggregator.incrementEmptyFolders();
    expect(aggregator.emptyFolders).toBe(2);
  });
});
