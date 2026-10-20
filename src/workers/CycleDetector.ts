export class CycleDetector {
  private visitedIds: Set<string> = new Set();
  private visitedRealPaths: Set<string> = new Set();

  checkAndMark(dev: number, ino: number, realPath?: string): boolean {
    // If dev and ino are provided and non-zero
    if (dev !== 0 || ino !== 0) {
      const id = `${dev}:${ino}`;
      if (this.visitedIds.has(id)) {
        return true; // Cycle detected!
      }
      this.visitedIds.add(id);
      return false;
    }

    if (realPath) {
      const normalized = realPath.toLowerCase();
      if (this.visitedRealPaths.has(normalized)) {
        return true; // Cycle detected!
      }
      this.visitedRealPaths.add(normalized);
    }

    return false;
  }

  reset(): void {
    this.visitedIds.clear();
    this.visitedRealPaths.clear();
  }
}
