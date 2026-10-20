import { describe, it, expect } from 'vitest';

export function calculateVirtualWindow(
  totalItems: number,
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number,
  buffer = 5
) {
  if (totalItems === 0) {
    return { startIndex: 0, endIndex: 0, offsetY: 0, totalHeight: 0 };
  }
  const totalHeight = totalItems * rowHeight;
  const rawStart = Math.floor(scrollTop / rowHeight);
  const startIndex = Math.max(0, rawStart - buffer);
  const visibleCount = Math.ceil(viewportHeight / rowHeight);
  const endIndex = Math.min(totalItems, startIndex + visibleCount + buffer * 2);
  const offsetY = startIndex * rowHeight;

  return { startIndex, endIndex, offsetY, totalHeight };
}

describe('DOM Virtualization Calculations', () => {
  it('handles empty items correctly', () => {
    const res = calculateVirtualWindow(0, 0, 500, 34);
    expect(res.startIndex).toBe(0);
    expect(res.endIndex).toBe(0);
    expect(res.totalHeight).toBe(0);
    expect(res.offsetY).toBe(0);
  });

  it('calculates initial window at top of scroll', () => {
    const totalItems = 10000;
    const rowHeight = 34;
    const viewportHeight = 500; // ~15 rows visible

    const res = calculateVirtualWindow(totalItems, 0, viewportHeight, rowHeight, 5);
    expect(res.totalHeight).toBe(340000);
    expect(res.startIndex).toBe(0);
    expect(res.endIndex).toBe(25); // 0 + 15 + 10 buffer
    expect(res.offsetY).toBe(0);
  });

  it('slides window correctly as user scrolls deep into list', () => {
    const totalItems = 50000;
    const rowHeight = 34;
    const viewportHeight = 680; // 20 rows visible
    const scrollTop = 34000; // Scrolled past 1,000 items

    const res = calculateVirtualWindow(totalItems, scrollTop, viewportHeight, rowHeight, 5);
    expect(res.startIndex).toBe(995); // 1000 - 5 buffer
    expect(res.offsetY).toBe(995 * 34);
    expect(res.endIndex).toBe(1025); // 995 + 20 + 10 buffer
  });

  it('bounds endIndex strictly to totalItems at bottom of list', () => {
    const totalItems = 100;
    const rowHeight = 34;
    const viewportHeight = 500;
    const scrollTop = 3400; // Scrolled to end

    const res = calculateVirtualWindow(totalItems, scrollTop, viewportHeight, rowHeight, 5);
    expect(res.endIndex).toBe(100);
  });
});
