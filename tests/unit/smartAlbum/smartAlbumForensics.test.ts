import {
  SMART_ALBUM_DEFS,
  isScreenshotMedia,
  isWhatsAppMedia,
  isDownloadMedia,
  isCameraMedia,
  getSmartAlbumsList,
} from '../../../src/hooks/useSmartAlbums';
import { mediaStoreService } from '../../../src/services/media/MediaStoreService';
import { useAlbumsStore } from '../../../src/store/useAlbumsStore';
import { PixoraMediaInfo } from '../../../src/services/media/mediaTypes';
import * as MediaLibrary from 'expo-media-library/legacy';

jest.mock('expo-media-library/legacy');
jest.mock('expo-media-library');

describe('Pixora Phase 9.1 — Smart Album Forensic Tests', () => {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  // 10 Deterministic Test Fixtures covering all edge cases
  const fixtureCameraPhoto: PixoraMediaInfo = {
    id: 'cam-photo-1',
    uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_20261027_1001.jpg',
    filename: 'IMG_20261027_1001.jpg',
    mediaType: 'photo',
    width: 4000,
    height: 3000,
    creationTime: now - 1 * day,
    modificationTime: now - 1 * day,
    duration: 0,
    albumId: 'bucket-camera',
  };

  const fixtureCameraVideo: PixoraMediaInfo = {
    id: 'cam-video-1',
    uri: 'file:///storage/emulated/0/DCIM/Camera/VID_20261027_1002.mp4',
    filename: 'VID_20261027_1002.mp4',
    mediaType: 'video',
    width: 1920,
    height: 1080,
    creationTime: now - 2 * day,
    modificationTime: now - 2 * day,
    duration: 30,
    albumId: 'bucket-camera',
  };

  const fixtureCameraHyphen: PixoraMediaInfo = {
    id: 'cam-hyphen-1',
    uri: 'file:///storage/emulated/0/DCIM/Camera/IMG-20261027-143022.jpg',
    filename: 'IMG-20261027-143022.jpg',
    mediaType: 'photo',
    width: 4000,
    height: 3000,
    creationTime: now - 3 * day,
    modificationTime: now - 3 * day,
    duration: 0,
    albumId: 'bucket-camera',
  };

  const fixtureSamsungScreenshot: PixoraMediaInfo = {
    id: 'samsung-ss-1',
    uri: 'file:///storage/emulated/0/DCIM/Screenshots/Screenshot_20261027_150000.jpg',
    filename: 'Screenshot_20261027_150000.jpg',
    mediaType: 'photo',
    width: 1080,
    height: 2400,
    creationTime: now - 4 * day,
    modificationTime: now - 4 * day,
    duration: 0,
    albumId: 'bucket-screenshots',
  };

  const fixturePixelScreenshot: PixoraMediaInfo = {
    id: 'pixel-ss-1',
    uri: 'file:///storage/emulated/0/Pictures/Screenshots/Screenshot_20261027-160000.png',
    filename: 'Screenshot_20261027-160000.png',
    mediaType: 'photo',
    width: 1080,
    height: 2400,
    creationTime: now - 5 * day,
    modificationTime: now - 5 * day,
    duration: 0,
    albumId: 'bucket-screenshots',
  };

  const fixtureWhatsAppPhoto: PixoraMediaInfo = {
    id: 'wa-photo-1',
    uri: 'file:///storage/emulated/0/Android/media/com.whatsapp/WhatsApp/Media/WhatsApp Images/IMG-20261027-WA0001.jpg',
    filename: 'IMG-20261027-WA0001.jpg',
    mediaType: 'photo',
    width: 1200,
    height: 1600,
    creationTime: 0,
    modificationTime: now - 6 * day,
    duration: 0,
    albumId: 'bucket-whatsapp',
  };

  const fixtureWhatsAppVideo: PixoraMediaInfo = {
    id: 'wa-video-1',
    uri: 'file:///storage/emulated/0/Android/media/com.whatsapp/WhatsApp/Media/WhatsApp Video/VID-20261027-WA0002.mp4',
    filename: 'VID-20261027-WA0002.mp4',
    mediaType: 'video',
    width: 720,
    height: 1280,
    creationTime: 0,
    modificationTime: now - 7 * day,
    duration: 12,
    albumId: 'bucket-whatsapp',
  };

  const fixtureDownloadGeneric: PixoraMediaInfo = {
    id: 'dl-generic-1',
    uri: 'file:///storage/emulated/0/Download/october_invoice.jpg',
    filename: 'october_invoice.jpg',
    mediaType: 'photo',
    width: 800,
    height: 1200,
    creationTime: 0,
    modificationTime: now - 8 * day,
    duration: 0,
    albumId: 'bucket-download',
  };

  const fixtureDownloadImgPrefixed: PixoraMediaInfo = {
    id: 'dl-img-1',
    uri: 'file:///storage/emulated/0/Download/IMG_9999_reddit.jpg',
    filename: 'IMG_9999_reddit.jpg',
    mediaType: 'photo',
    width: 1920,
    height: 1080,
    creationTime: 0,
    modificationTime: now - 9 * day,
    duration: 0,
    albumId: 'bucket-download',
  };

  const fixtureOldCameraPhoto: PixoraMediaInfo = {
    id: 'old-cam-1',
    uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_20140510_001.jpg',
    filename: 'IMG_20140510_001.jpg',
    mediaType: 'photo',
    width: 3264,
    height: 2448,
    creationTime: 1400000000000, // May 2014
    modificationTime: 1400000000000,
    duration: 0,
    albumId: 'bucket-camera',
  };

  const allFixtures: PixoraMediaInfo[] = [
    fixtureCameraPhoto,
    fixtureCameraVideo,
    fixtureCameraHyphen,
    fixtureSamsungScreenshot,
    fixturePixelScreenshot,
    fixtureWhatsAppPhoto,
    fixtureWhatsAppVideo,
    fixtureDownloadGeneric,
    fixtureDownloadImgPrefixed,
    fixtureOldCameraPhoto,
  ];

  const mockPhysicalAlbums: MediaLibrary.Album[] = [
    { id: 'bucket-camera', title: 'Camera', assetCount: 4 } as any,
    { id: 'bucket-screenshots', title: 'Screenshots', assetCount: 2 } as any,
    { id: 'bucket-whatsapp', title: 'WhatsApp Images', assetCount: 2 } as any,
    { id: 'bucket-download', title: 'Download', assetCount: 2 } as any,
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    useAlbumsStore.setState({
      albums: mockPhysicalAlbums,
      activeSmartAlbumId: null,
      activeSmartAlbumMedia: [],
      activeSmartAlbumGrouped: [],
      isLoadingSmartAlbum: false,
      hasMoreSmartAlbum: true,
      smartAlbumCursor: undefined,
      smartAlbumSortOrder: 'newest',
    });
  });

  describe('1. Individual Smart Album Filter Forensics', () => {
    test('Camera: includes genuine camera captures, excludes Samsung screenshots in DCIM, WhatsApp, & Downloads', () => {
      const cameraMatches = allFixtures.filter((item) => isCameraMedia(item, mockPhysicalAlbums));
      const matchIds = cameraMatches.map((m) => m.id);

      expect(matchIds).toContain('cam-photo-1');
      expect(matchIds).toContain('cam-video-1');
      expect(matchIds).toContain('cam-hyphen-1');
      expect(matchIds).toContain('old-cam-1');

      // Crucial exclusions:
      expect(matchIds).not.toContain('samsung-ss-1'); // Must not leak DCIM/Screenshots
      expect(matchIds).not.toContain('pixel-ss-1');
      expect(matchIds).not.toContain('wa-photo-1');
      expect(matchIds).not.toContain('wa-video-1');
      expect(matchIds).not.toContain('dl-generic-1');
      expect(matchIds).not.toContain('dl-img-1'); // Must not leak IMG_ downloads
    });

    test('Screenshots: captures both Samsung (DCIM) and standard screenshots, rejects camera photos', () => {
      const ssMatches = allFixtures.filter((item) => isScreenshotMedia(item, mockPhysicalAlbums));
      const matchIds = ssMatches.map((m) => m.id);

      expect(matchIds).toEqual(['samsung-ss-1', 'pixel-ss-1']);
      expect(matchIds).not.toContain('cam-photo-1');
      expect(matchIds).not.toContain('wa-photo-1');
      expect(matchIds).not.toContain('dl-generic-1');
    });

    test('WhatsApp: captures WhatsApp items with -WA pattern, rejects camera photos named with hyphen date', () => {
      const waMatches = allFixtures.filter((item) => isWhatsAppMedia(item, mockPhysicalAlbums));
      const matchIds = waMatches.map((m) => m.id);

      expect(matchIds).toContain('wa-photo-1');
      expect(matchIds).toContain('wa-video-1');

      // Crucial: IMG-20261027-143022.jpg is a camera photo, NOT WhatsApp!
      expect(matchIds).not.toContain('cam-hyphen-1');
      expect(matchIds).not.toContain('cam-photo-1');
      expect(matchIds).not.toContain('samsung-ss-1');
    });

    test('Downloads: captures generic and img-prefixed downloads, rejects camera and screenshots', () => {
      const dlMatches = allFixtures.filter((item) => isDownloadMedia(item, mockPhysicalAlbums));
      const matchIds = dlMatches.map((m) => m.id);

      expect(matchIds).toContain('dl-generic-1');
      expect(matchIds).toContain('dl-img-1');
      expect(matchIds).not.toContain('cam-photo-1');
      expect(matchIds).not.toContain('samsung-ss-1');
      expect(matchIds).not.toContain('wa-photo-1');
    });

    test('Videos: matches all video files regardless of origin, rejects photos', () => {
      const videoDef = SMART_ALBUM_DEFS.find((d) => d.id === '__smart_videos')!;
      const videoMatches = allFixtures.filter((item) => videoDef.filter(item, mockPhysicalAlbums));
      const matchIds = videoMatches.map((m) => m.id);

      expect(matchIds).toEqual(['cam-video-1', 'wa-video-1']);
      expect(matchIds).not.toContain('cam-photo-1');
      expect(matchIds).not.toContain('samsung-ss-1');
    });

    test('Recently Added: matches all items within 30 days regardless of origin, excludes old photos', () => {
      const recentDef = SMART_ALBUM_DEFS.find((d) => d.id === '__smart_recent')!;
      const recentMatches = allFixtures.filter((item) => recentDef.filter(item, mockPhysicalAlbums));
      const matchIds = recentMatches.map((m) => m.id);

      // Old photo from 2014 must be excluded
      expect(matchIds).not.toContain('old-cam-1');
      // All recent items (cam, ss, wa, dl within last 10 days) must be included
      expect(matchIds).toContain('cam-photo-1');
      expect(matchIds).toContain('samsung-ss-1');
      expect(matchIds).toContain('wa-photo-1');
      expect(matchIds).toContain('dl-generic-1');
    });
  });

  describe('2. Physical Album Bucket Fast-Path & Query Routing', () => {
    test('routes Camera directly to getAlbumAssetsAsync when physical bucket exists', async () => {
      const spyGetAlbum = jest.spyOn(mediaStoreService, 'getAlbumAssetsAsync').mockResolvedValueOnce({
        assets: [fixtureCameraPhoto, fixtureCameraVideo] as any,
        hasNextPage: false,
        endCursor: 'cursor-cam',
      });

      const result = await mediaStoreService.getSmartAlbumMediaAsync(
        '__smart_camera',
        undefined,
        50,
        'newest',
        mockPhysicalAlbums
      );

      expect(spyGetAlbum).toHaveBeenCalledWith('bucket-camera', undefined, 'newest');
      expect(result.assets.map((a) => a.id)).toEqual(['cam-photo-1', 'cam-video-1']);
    });

    test('routes Screenshots directly to getAlbumAssetsAsync when physical bucket exists', async () => {
      const spyGetAlbum = jest.spyOn(mediaStoreService, 'getAlbumAssetsAsync').mockResolvedValueOnce({
        assets: [fixtureSamsungScreenshot, fixturePixelScreenshot] as any,
        hasNextPage: false,
        endCursor: 'cursor-ss',
      });

      const result = await mediaStoreService.getSmartAlbumMediaAsync(
        '__smart_screenshots',
        undefined,
        50,
        'newest',
        mockPhysicalAlbums
      );

      expect(spyGetAlbum).toHaveBeenCalledWith('bucket-screenshots', undefined, 'newest');
      expect(result.assets.map((a) => a.id)).toEqual(['samsung-ss-1', 'pixel-ss-1']);
    });

    test('routes Downloads directly to getAlbumAssetsAsync when physical bucket exists', async () => {
      const spyGetAlbum = jest.spyOn(mediaStoreService, 'getAlbumAssetsAsync').mockResolvedValueOnce({
        assets: [fixtureDownloadGeneric, fixtureDownloadImgPrefixed] as any,
        hasNextPage: false,
        endCursor: 'cursor-dl',
      });

      const result = await mediaStoreService.getSmartAlbumMediaAsync(
        '__smart_downloads',
        undefined,
        50,
        'newest',
        mockPhysicalAlbums
      );

      expect(spyGetAlbum).toHaveBeenCalledWith('bucket-download', undefined, 'newest');
      expect(result.assets.map((a) => a.id)).toEqual(['dl-generic-1', 'dl-img-1']);
    });
  });

  describe('3. Asynchronous Race Conditions & Cross-Album Isolation', () => {
    test('slower response from previous smart album does NOT overwrite currently active smart album', async () => {
      let resolveVideos: (val: any) => void;
      const videosPromise = new Promise((resolve) => {
        resolveVideos = resolve;
      });

      jest.spyOn(mediaStoreService, 'getSmartAlbumMediaAsync').mockImplementation(async (id: string) => {
        if (id === '__smart_videos') {
          return (await videosPromise) as any;
        }
        if (id === '__smart_screenshots') {
          return {
            assets: [fixturePixelScreenshot],
            hasNextPage: false,
            endCursor: '1',
          };
        }
        return { assets: [], hasNextPage: false, endCursor: '' };
      });

      // User opens Videos
      const openVideosPromise = useAlbumsStore.getState().openSmartAlbum('__smart_videos');

      // User quickly navigates away to Screenshots
      await useAlbumsStore.getState().openSmartAlbum('__smart_screenshots');

      // Screenshots state is now active
      expect(useAlbumsStore.getState().activeSmartAlbumId).toBe('__smart_screenshots');
      expect(useAlbumsStore.getState().activeSmartAlbumMedia.map((m) => m.id)).toEqual(['pixel-ss-1']);

      // Now the slower Videos response resolves
      resolveVideos!({
        assets: [fixtureCameraVideo],
        hasNextPage: false,
        endCursor: '1',
      });
      await openVideosPromise;

      // Crucial: Screenshots state MUST NOT be overwritten by the delayed Videos response!
      expect(useAlbumsStore.getState().activeSmartAlbumId).toBe('__smart_screenshots');
      expect(useAlbumsStore.getState().activeSmartAlbumMedia.map((m) => m.id)).toEqual(['pixel-ss-1']);
    });
  });

  describe('4. Accurate Asset Counts on Albums Screen', () => {
    test('getSmartAlbumsList reports canonical device asset counts for Camera, Screenshots, Downloads, WhatsApp', () => {
      const smartAlbums = getSmartAlbumsList(allFixtures, mockPhysicalAlbums);

      const cameraAlbum = smartAlbums.find((a) => a.id === '__smart_camera')!;
      expect(cameraAlbum.count).toBe(4); // from mockPhysicalAlbums Camera assetCount

      const ssAlbum = smartAlbums.find((a) => a.id === '__smart_screenshots')!;
      expect(ssAlbum.count).toBe(2); // from mockPhysicalAlbums Screenshots assetCount

      const dlAlbum = smartAlbums.find((a) => a.id === '__smart_downloads')!;
      expect(dlAlbum.count).toBe(2); // from mockPhysicalAlbums Download assetCount

      const waAlbum = smartAlbums.find((a) => a.id === '__smart_whatsapp')!;
      expect(waAlbum.count).toBe(2); // from mockPhysicalAlbums WhatsApp assetCount
    });
  });
});
