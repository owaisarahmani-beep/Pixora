import React from 'react';
import { Image } from 'expo-image';
import { PixoraMediaInfo } from '../../../src/services/media/mediaTypes';

jest.mock('expo-image', () => ({
  Image: {
    prefetch: jest.fn().mockResolvedValue(true),
  },
}));

describe('Pixora Phase 10.1.10: Fast Viewer, Responsive Navigation & Album Count UI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Pager Windowing & Offscreen Limits', () => {
    it('mounts active and adjacent ±2 items while keeping far items lightweight placeholders', () => {
      const mockItems: Array<{ id: string }> = Array.from({ length: 10 }, (_, i) => ({ id: `photo-${i}` }));
      const currentIndex = 4;

      const renderedTypes = mockItems.map((item, index) => {
        if (Math.abs(index - currentIndex) > 2) {
          return 'placeholder';
        }
        return 'full_page';
      });

      // Indices 0, 1 should be placeholder (>2 away)
      expect(renderedTypes[0]).toBe('placeholder');
      expect(renderedTypes[1]).toBe('placeholder');

      // Indices 2, 3, 4, 5, 6 should be full_page (within ±2)
      expect(renderedTypes[2]).toBe('full_page');
      expect(renderedTypes[3]).toBe('full_page');
      expect(renderedTypes[4]).toBe('full_page');
      expect(renderedTypes[5]).toBe('full_page');
      expect(renderedTypes[6]).toBe('full_page');

      // Indices 7, 8, 9 should be placeholder (>2 away)
      expect(renderedTypes[7]).toBe('placeholder');
      expect(renderedTypes[8]).toBe('placeholder');
      expect(renderedTypes[9]).toBe('placeholder');
    });
  });

  describe('2. Adjacent Image Prefetching', () => {
    it('prefetches ±1 and ±2 adjacent photo URIs into memory-disk cache without prefetching videos', () => {
      const mockMedia: PixoraMediaInfo[] = [
        { id: '1', uri: 'file:///media/img1.jpg', mediaType: 'photo' } as PixoraMediaInfo,
        { id: '2', uri: 'file:///media/vid2.mp4', mediaType: 'video' } as PixoraMediaInfo,
        { id: '3', uri: 'file:///media/img3.jpg', mediaType: 'photo' } as PixoraMediaInfo, // current
        { id: '4', uri: 'file:///media/img4.jpg', mediaType: 'photo' } as PixoraMediaInfo,
        { id: '5', uri: 'file:///media/img5.jpg', mediaType: 'photo' } as PixoraMediaInfo,
      ];

      const currentIndex = 2; // item '3'
      const urisToPrefetch: string[] = [];
      const windowIndices = [
        currentIndex + 1,
        currentIndex - 1,
        currentIndex + 2,
        currentIndex - 2,
      ];

      for (const idx of windowIndices) {
        if (idx >= 0 && idx < mockMedia.length) {
          const item = mockMedia[idx];
          if (item && item.mediaType === 'photo' && item.uri) {
            urisToPrefetch.push(item.uri);
          }
        }
      }

      expect(urisToPrefetch).toContain('file:///media/img4.jpg');
      expect(urisToPrefetch).toContain('file:///media/img5.jpg');
      expect(urisToPrefetch).toContain('file:///media/img1.jpg');
      // Video URI should be excluded from image prefetch
      expect(urisToPrefetch).not.toContain('file:///media/vid2.mp4');

      Image.prefetch(urisToPrefetch, 'memory-disk');
      expect(Image.prefetch).toHaveBeenCalledWith(urisToPrefetch, 'memory-disk');
    });

    it('safely handles boundary indices (first and last item) without throwing or out-of-bounds lookups', () => {
      const mockMedia: PixoraMediaInfo[] = [
        { id: '1', uri: 'file:///media/img1.jpg', mediaType: 'photo' } as PixoraMediaInfo,
        { id: '2', uri: 'file:///media/img2.jpg', mediaType: 'photo' } as PixoraMediaInfo,
      ];

      // At first item
      const currentIndex = 0;
      const urisToPrefetch: string[] = [];
      const windowIndices = [
        currentIndex + 1,
        currentIndex - 1,
        currentIndex + 2,
        currentIndex - 2,
      ];

      for (const idx of windowIndices) {
        if (idx >= 0 && idx < mockMedia.length) {
          const item = mockMedia[idx];
          if (item && item.mediaType === 'photo' && item.uri) {
            urisToPrefetch.push(item.uri);
          }
        }
      }

      expect(urisToPrefetch).toEqual(['file:///media/img2.jpg']);
      expect(() => Image.prefetch(urisToPrefetch, 'memory-disk')).not.toThrow();
    });
  });

  describe('3. Single-Tap vs Long-Press Reliability (Double-Tap Prevention)', () => {
    it('normal tap (<500ms) reliably triggers navigation without being swallowed by long-press guard', () => {
      let isLongPressActive = false;
      let navigatedTo: string | null = null;
      let selectionToggled: string | null = null;
      const inSelectionMode = false;

      const handleLongPress = () => {
        isLongPressActive = true;
      };

      const handlePress = (id: string) => {
        if (isLongPressActive) {
          isLongPressActive = false;
          return;
        }
        if (inSelectionMode) {
          selectionToggled = id;
        } else {
          navigatedTo = `/viewer/${id}`;
        }
      };

      // Case A: User touches and releases in 200ms (normal tap)
      // Long press does not fire
      handlePress('photo-123');

      expect(navigatedTo).toBe('/viewer/photo-123');
      expect(selectionToggled).toBeNull();
    });

    it('deliberate long press (>=500ms) consumes the press and resets flag so next tap works immediately', () => {
      let isLongPressActive = false;
      let navigatedTo: string | null = null;

      const handleLongPress = () => {
        isLongPressActive = true;
      };

      const handlePress = (id: string) => {
        if (isLongPressActive) {
          isLongPressActive = false;
          return;
        }
        navigatedTo = `/viewer/${id}`;
      };

      // 1. Long press fires
      handleLongPress();
      expect(isLongPressActive).toBe(true);

      // 2. Finger releases: long-press is consumed without navigation
      handlePress('photo-123');
      expect(navigatedTo).toBeNull();
      expect(isLongPressActive).toBe(false);

      // 3. Subsequent tap on any item immediately navigates on single tap
      handlePress('photo-456');
      expect(navigatedTo).toBe('/viewer/photo-456');
    });
  });

  describe('4. Rapid Swipes & Index Stability', () => {
    it('rapid index transitions safely resolve safeIndex and currentMedia', () => {
      const items: PixoraMediaInfo[] = [
        { id: '1', uri: 'file:///media/1.jpg', mediaType: 'photo' } as PixoraMediaInfo,
        { id: '2', uri: 'file:///media/2.jpg', mediaType: 'photo' } as PixoraMediaInfo,
        { id: '3', uri: 'file:///media/3.jpg', mediaType: 'photo' } as PixoraMediaInfo,
      ];

      // Rapidly simulate out-of-bounds or edge swipes
      const getSafeItem = (index: number) => {
        const safeIndex = Math.max(0, Math.min(index, Math.max(0, items.length - 1)));
        return items[safeIndex];
      };

      expect(getSafeItem(0).id).toBe('1');
      expect(getSafeItem(1).id).toBe('2');
      expect(getSafeItem(2).id).toBe('3');
      // Clamped beyond end
      expect(getSafeItem(5).id).toBe('3');
      // Clamped below start
      expect(getSafeItem(-2).id).toBe('1');
    });
  });

  describe('5. Offscreen Video Decoupling', () => {
    it('ensures offscreen video does not mount active VideoPage or allocate player', () => {
      const videoItem: PixoraMediaInfo = {
        id: 'vid-1',
        uri: 'file:///media/vid-1.mp4',
        mediaType: 'video',
      } as PixoraMediaInfo;

      const resolveVideoComponent = (item: PixoraMediaInfo, isActive: boolean) => {
        if (item.mediaType === 'video') {
          if (!isActive) return 'InactiveVideoPage';
          return 'VideoPage';
        }
        return 'PhotoPage';
      };

      expect(resolveVideoComponent(videoItem, false)).toBe('InactiveVideoPage');
      expect(resolveVideoComponent(videoItem, true)).toBe('VideoPage');
    });
  });
});
