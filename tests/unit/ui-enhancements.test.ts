import { describe, it, expect } from 'vitest';
import { appStore } from '../../src/renderer/store/appStore';
import { FileIcons } from '../../src/renderer/components/FileIcons';
import { FileItem } from '../../src/shared/types';

describe('UI Enhancements & Quality-of-Life Upgrades', () => {
  it('correctly manages zoom levels between 0 (compact rectangle) and 100 (extra large) with viewMode sync', () => {
    // Zoom 0 should automatically switch viewMode to details
    appStore.setZoomLevel(0);
    expect(appStore.getState().zoomLevel).toBe(0);
    expect(appStore.getState().viewMode).toBe('details');

    // Zooming in (delta +15) should switch to grid view
    appStore.adjustZoom(15);
    expect(appStore.getState().zoomLevel).toBe(15);
    expect(appStore.getState().viewMode).toBe('grid');

    // Zooming up to level 50
    appStore.adjustZoom(35);
    expect(appStore.getState().zoomLevel).toBe(50);
    expect(appStore.getState().viewMode).toBe('grid');

    // Clamping: cannot zoom past level 100
    appStore.adjustZoom(80);
    expect(appStore.getState().zoomLevel).toBe(100);

    // Clamping: cannot zoom below level 0
    appStore.adjustZoom(-150);
    expect(appStore.getState().zoomLevel).toBe(0);
    expect(appStore.getState().viewMode).toBe('details');
  });

  it('identifies image and video files for direct thumbnail rendering', () => {
    const pngItem: FileItem = {
      name: 'screenshot.png',
      path: 'C:\\Images\\screenshot.png',
      isDirectory: false,
      isFile: true,
      isSymbolicLink: false,
      isHidden: false,
      isSystem: false,
      sizeBytes: 1048576,
      modifiedMs: Date.now(),
      createdMs: Date.now(),
      extension: 'png',
      typeDescription: 'PNG Image',
    };

    const mp4Item: FileItem = {
      name: 'recording.mp4',
      path: 'C:\\Videos\\recording.mp4',
      isDirectory: false,
      isFile: true,
      isSymbolicLink: false,
      isHidden: false,
      isSystem: false,
      sizeBytes: 52428800,
      modifiedMs: Date.now(),
      createdMs: Date.now(),
      extension: 'mp4',
      typeDescription: 'MP4 Video',
    };

    const javaItem: FileItem = {
      name: 'Main.java',
      path: 'C:\\Projects\\Main.java',
      isDirectory: false,
      isFile: true,
      isSymbolicLink: false,
      isHidden: false,
      isSystem: false,
      sizeBytes: 2048,
      modifiedMs: Date.now(),
      createdMs: Date.now(),
      extension: 'java',
      typeDescription: 'Java Source File',
    };

    expect(FileIcons.isImage(pngItem)).toBe(true);
    expect(FileIcons.isVideo(pngItem)).toBe(false);

    expect(FileIcons.isVideo(mp4Item)).toBe(true);
    expect(FileIcons.isImage(mp4Item)).toBe(false);

    expect(FileIcons.isImage(javaItem)).toBe(false);
    expect(FileIcons.isVideo(javaItem)).toBe(false);
  });

  it('renders dedicated developer symbol badges for Java, C++, C#, Python, and TypeScript', () => {
    const javaItem: FileItem = {
      name: 'Service.java',
      path: 'C:\\src\\Service.java',
      isDirectory: false,
      isFile: true,
      isSymbolicLink: false,
      isHidden: false,
      isSystem: false,
      sizeBytes: 4096,
      modifiedMs: Date.now(),
      createdMs: Date.now(),
      extension: 'java',
      typeDescription: 'Java Source File',
    };

    const cppItem: FileItem = {
      name: 'engine.cpp',
      path: 'C:\\src\\engine.cpp',
      isDirectory: false,
      isFile: true,
      isSymbolicLink: false,
      isHidden: false,
      isSystem: false,
      sizeBytes: 8192,
      modifiedMs: Date.now(),
      createdMs: Date.now(),
      extension: 'cpp',
      typeDescription: 'C++ Source File',
    };

    const csItem: FileItem = {
      name: 'Program.cs',
      path: 'C:\\src\\Program.cs',
      isDirectory: false,
      isFile: true,
      isSymbolicLink: false,
      isHidden: false,
      isSystem: false,
      sizeBytes: 5120,
      modifiedMs: Date.now(),
      createdMs: Date.now(),
      extension: 'cs',
      typeDescription: 'C# Source File',
    };

    const pyItem: FileItem = {
      name: 'script.py',
      path: 'C:\\src\\script.py',
      isDirectory: false,
      isFile: true,
      isSymbolicLink: false,
      isHidden: false,
      isSystem: false,
      sizeBytes: 1024,
      modifiedMs: Date.now(),
      createdMs: Date.now(),
      extension: 'py',
      typeDescription: 'Python Script',
    };

    const javaPreview = FileIcons.getGridPreview(javaItem, 136);
    expect(javaPreview).toContain('dev-badge-java');
    expect(javaPreview).toContain('Java Source');

    const cppPreview = FileIcons.getGridPreview(cppItem, 136);
    expect(cppPreview).toContain('dev-badge-cpp');
    expect(cppPreview).toContain('C++');

    const csPreview = FileIcons.getGridPreview(csItem, 136);
    expect(csPreview).toContain('dev-badge-cs');
    expect(csPreview).toContain('C#');

    const pyPreview = FileIcons.getGridPreview(pyItem, 136);
    expect(pyPreview).toContain('dev-badge-py');
  });

  it('renders safe protocol afe-media URLs for direct image and video thumbnails', () => {
    const imgItem: FileItem = {
      name: 'photo.jpg',
      path: 'C:\\Users\\Pictures\\photo.jpg',
      isDirectory: false,
      isFile: true,
      isSymbolicLink: false,
      isHidden: false,
      isSystem: false,
      sizeBytes: 204800,
      modifiedMs: Date.now(),
      createdMs: Date.now(),
      extension: 'jpg',
      typeDescription: 'JPEG Image',
    };

    const vidItem: FileItem = {
      name: 'clip.mp4',
      path: 'C:\\Users\\Videos\\clip.mp4',
      isDirectory: false,
      isFile: true,
      isSymbolicLink: false,
      isHidden: false,
      isSystem: false,
      sizeBytes: 10485760,
      modifiedMs: Date.now(),
      createdMs: Date.now(),
      extension: 'mp4',
      typeDescription: 'MP4 Video',
    };

    const imgPreview = FileIcons.getGridPreview(imgItem, 140);
    expect(imgPreview).toContain(`afe-media://load?path=${encodeURIComponent(imgItem.path)}`);
    expect(imgPreview).toContain('card-thumb-img');

    const vidPreview = FileIcons.getGridPreview(vidItem, 140);
    expect(vidPreview).toContain(`afe-media://load?path=${encodeURIComponent(vidItem.path)}#t=0.5`);
    expect(vidPreview).toContain('video-pill-badge');
  });

  it('calculates rectangular 2D marquee AABB collision intersections correctly', () => {
    // Helper function mirroring the marquee intersection math in VirtualizedFileList
    function checkIntersection(
      box: { left: number; top: number; width: number; height: number },
      item: { left: number; top: number; width: number; height: number }
    ): boolean {
      const boxRight = box.left + box.width;
      const boxBottom = box.top + box.height;
      const itemRight = item.left + item.width;
      const itemBottom = item.top + item.height;

      return !(box.left > itemRight || boxRight < item.left || box.top > itemBottom || boxBottom < item.top);
    }

    const dragBox = { left: 50, top: 50, width: 200, height: 150 };

    // Item 1: Completely inside the drag box
    expect(checkIntersection(dragBox, { left: 60, top: 60, width: 100, height: 80 })).toBe(true);

    // Item 2: Partially overlapping bottom-right edge
    expect(checkIntersection(dragBox, { left: 200, top: 180, width: 120, height: 100 })).toBe(true);

    // Item 3: Completely outside to the right
    expect(checkIntersection(dragBox, { left: 300, top: 60, width: 100, height: 80 })).toBe(false);

    // Item 4: Completely outside above
    expect(checkIntersection(dragBox, { left: 60, top: 10, width: 100, height: 30 })).toBe(false);
  });
});
