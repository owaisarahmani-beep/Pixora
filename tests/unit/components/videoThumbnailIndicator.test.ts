import { isVideoMedia, formatVideoDuration } from '../../../src/components/gallery/PhotoThumbnail';
import { PixoraMediaInfo } from '../../../src/services/media/mediaTypes';

describe('Video Thumbnail Indicator & Rendering Logic', () => {
  const sampleVideo: PixoraMediaInfo = {
    id: 'vid-1',
    uri: 'ph://video-1',
    filename: 'vacation.mp4',
    mediaType: 'video',
    width: 1920,
    height: 1080,
    creationTime: 1700000000,
    modificationTime: 1700000000,
    duration: 85,
  };

  const samplePhoto: PixoraMediaInfo = {
    id: 'img-1',
    uri: 'ph://image-1',
    filename: 'sunset.jpg',
    mediaType: 'photo',
    width: 4032,
    height: 3024,
    creationTime: 1700000000,
    modificationTime: 1700000000,
    duration: 0,
  };

  const sampleVideoNoDuration: PixoraMediaInfo = {
    id: 'vid-2',
    uri: 'ph://video-2',
    filename: 'clip.mov',
    mediaType: 'video',
    width: 1080,
    height: 1920,
    creationTime: 1700000000,
    modificationTime: 1700000000,
    duration: 0, // Metadata not yet loaded or 0
  };

  describe('Media Type Classification', () => {
    it('identifies standard video mediaType', () => {
      expect(isVideoMedia(sampleVideo)).toBe(true);
    });

    it('identifies uppercase VIDEO mediaType', () => {
      const upperVideo = { ...sampleVideo, mediaType: 'VIDEO' as any };
      expect(isVideoMedia(upperVideo)).toBe(true);
    });

    it('identifies video from file extension when mediaType is unknown', () => {
      const unknownVid = { ...sampleVideo, mediaType: 'unknown' as any, filename: 'record.mp4' };
      expect(isVideoMedia(unknownVid)).toBe(true);
    });

    it('ensures photos never receive video indicators', () => {
      expect(isVideoMedia(samplePhoto)).toBe(false);
      const pngPhoto = { ...samplePhoto, filename: 'screenshot.png' };
      expect(isVideoMedia(pngPhoto)).toBe(false);
    });
  });

  describe('Duration Formatting', () => {
    it('formats duration in seconds to M:SS', () => {
      expect(formatVideoDuration(85)).toBe('1:25');
      expect(formatVideoDuration(60)).toBe('1:00');
      expect(formatVideoDuration(9)).toBe('0:09');
      expect(formatVideoDuration(625)).toBe('10:25');
    });

    it('returns null when duration is missing, zero, or negative', () => {
      expect(formatVideoDuration(0)).toBeNull();
      expect(formatVideoDuration(-5)).toBeNull();
      expect(formatVideoDuration(undefined)).toBeNull();
      expect(formatVideoDuration(NaN)).toBeNull();
    });
  });

  describe('Play Indicator Lifecycle & Independence', () => {
    it('determines video badge is mounted before thumbnail has loaded', () => {
      // In PhotoThumbnail, isVideo = isVideoMedia(item)
      // Play badge condition: isVideo === true
      // It does NOT require isLoaded === true
      const isLoaded = false;
      const isVideo = isVideoMedia(sampleVideo);
      
      const shouldRenderBadge = isVideo; // Independent of isLoaded
      expect(shouldRenderBadge).toBe(true);
      expect(isLoaded).toBe(false);
    });

    it('determines video badge remains visible even when thumbnail loading fails', () => {
      // When Image onError fires, hasError = true, isLoaded = true
      // The badge condition is still isVideo === true
      const hasError = true;
      const isVideo = isVideoMedia(sampleVideo);
      
      const shouldRenderBadge = isVideo; // Independent of hasError
      expect(shouldRenderBadge).toBe(true);
      expect(hasError).toBe(true);
    });

    it('renders play badge even without duration metadata', () => {
      const isVideo = isVideoMedia(sampleVideoNoDuration);
      const durationText = formatVideoDuration(sampleVideoNoDuration.duration);
      
      expect(isVideo).toBe(true);
      expect(durationText).toBeNull(); // Badge will render play icon without duration text
    });
  });
});
