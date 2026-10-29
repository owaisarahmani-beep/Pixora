import React from 'react';
import { View } from 'react-native';
import { useMediaStore } from '../../../src/store/useMediaStore';
import { useTrashStore } from '../../../src/store/useTrashStore';
import { useAuthorizedMedia, MediaContext } from '../../../src/hooks/useVisibleMedia';
import { SMART_ALBUM_DEFS } from '../../../src/hooks/useSmartAlbums';
import { mediaStoreService } from '../../../src/services/media/MediaStoreService';
import { PixoraMediaInfo } from '../../../src/services/media/mediaTypes';
import { act, render, cleanup } from '@testing-library/react-native';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

function HookTester({
  media,
  context,
  onCapture,
}: {
  media: PixoraMediaInfo[];
  context: MediaContext;
  onCapture: (items: PixoraMediaInfo[]) => void;
}) {
  const items = useAuthorizedMedia(media, context);
  onCapture(items);
  return <View testID="hook-tester-view" />;
}

describe('Pixora — Android Video Deletion Reliability & Consistency', () => {
  const testVideo: PixoraMediaInfo & { mediaType: 'video' } = {
    id: 'video-ms-8821',
    uri: 'file:///storage/emulated/0/DCIM/Camera/VID_8821.mp4',
    filename: 'VID_8821.mp4',
    mediaType: 'video',
    width: 1920,
    height: 1080,
    creationTime: 1710000000,
    modificationTime: 1710000000,
    duration: 45,
  };

  const testPhoto: PixoraMediaInfo & { mediaType: 'photo' } = {
    id: 'photo-ms-1011',
    uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_1011.jpg',
    filename: 'IMG_1011.jpg',
    mediaType: 'photo',
    width: 1920,
    height: 1080,
    creationTime: 1710000050,
    modificationTime: 1710000050,
    duration: 0,
  };

  beforeEach(() => {
    useMediaStore.setState({
      media: [testVideo, testPhoto],
      isLoading: false,
      isRefreshing: false,
      hasNextPage: false,
      endCursor: undefined,
    });

    useTrashStore.setState({
      items: [],
      permanentlyDeletedIds: [],
      permanentlyDeletedUris: [],
    });
  });

  it('1. Soft-deleted video remains absent from Gallery and Videos after refresh and app restart, but remains recoverable', async () => {
    // Normal Delete
    const success = await useMediaStore.getState().deleteMediaAsync('video-ms-8821');

    expect(success).toBe(true);

    // Absent from Gallery state
    expect(useMediaStore.getState().media.some(m => m.id === 'video-ms-8821')).toBe(false);

    // Present in Recently Deleted (Trash store)
    const trashItems = useTrashStore.getState().items;
    expect(trashItems.some(i => i.id === 'video-ms-8821')).toBe(true);
    expect(useTrashStore.getState().getDaysRemaining(trashItems[0].trashedAt)).toBeGreaterThan(0);

    // Simulate Android MediaStore returning the video on refresh (since physical file is retained for 30 days)
    jest.spyOn(mediaStoreService, 'getMediaAsync').mockResolvedValueOnce({
      assets: [testVideo, testPhoto],
      hasNextPage: false,
      endCursor: 'cursor-1',
    });

    await useMediaStore.getState().refreshMedia();

    // Refreshing MediaStore must NOT silently restore soft-deleted item into media
    expect(useMediaStore.getState().media.some(m => m.id === 'video-ms-8821')).toBe(false);

    // Videos tab / Smart album must also exclude it
    let filteredVideos: PixoraMediaInfo[] = [];
    render(
      <HookTester
        media={useMediaStore.getState().media}
        context="public"
        onCapture={(res) => {
          const videosSmartAlbum = SMART_ALBUM_DEFS.find(d => d.id === '__smart_videos');
          filteredVideos = res.filter(videosSmartAlbum!.filter);
        }}
      />
    );
    expect(filteredVideos.some(m => m.id === 'video-ms-8821')).toBe(false);
  });

  it('2. Successful permanent deletion removes the item from public lists and prevents resurrection from stale MediaStore queries', async () => {
    const legacyMediaLib = require('expo-media-library/legacy');
    (legacyMediaLib.deleteAssetsAsync as jest.Mock).mockResolvedValueOnce(true);

    // Place in trash first
    useTrashStore.setState({
      items: [{
        ...testVideo,
        trashedAt: Date.now(),
      }],
      permanentlyDeletedIds: [],
      permanentlyDeletedUris: [],
    });

    // Permanent Delete
    const success = await useMediaStore.getState().permanentDeleteAsync('video-ms-8821');

    expect(success).toBe(true);

    // Removed from trash
    expect(useTrashStore.getState().items.some(i => i.id === 'video-ms-8821')).toBe(false);

    // Tombstone is recorded to prevent asynchronous MediaStore race condition
    expect(useTrashStore.getState().permanentlyDeletedIds).toContain('video-ms-8821');
    expect(useTrashStore.getState().permanentlyDeletedUris).toContain(testVideo.uri);

    // Stale MediaStore query still returns the deleted asset before OS MediaScanner finishes
    jest.spyOn(mediaStoreService, 'getMediaAsync').mockResolvedValueOnce({
      assets: [testVideo, testPhoto],
      hasNextPage: false,
      endCursor: 'cursor-1',
    });

    await useMediaStore.getState().refreshMedia();

    // Must NOT be resurrected into media
    expect(useMediaStore.getState().media.some(m => m.id === 'video-ms-8821')).toBe(false);

    // Absent from public filtering
    let publicItems: PixoraMediaInfo[] = [];
    render(
      <HookTester
        media={useMediaStore.getState().media}
        context="public"
        onCapture={(res) => {
          publicItems = res;
        }}
      />
    );
    expect(publicItems.some(m => m.id === 'video-ms-8821')).toBe(false);
  });

  it('3. Failed or cancelled permanent deletion is handled honestly and safely', async () => {
    const legacyMediaLib = require('expo-media-library/legacy');
    const spyWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const spyError = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Case A: User cancels or declines Android system deletion prompt
    (legacyMediaLib.deleteAssetsAsync as jest.Mock).mockResolvedValueOnce(false);

    useTrashStore.setState({
      items: [{
        ...testVideo,
        trashedAt: Date.now(),
      }],
      permanentlyDeletedIds: [],
      permanentlyDeletedUris: [],
    });

    let success = await useMediaStore.getState().permanentDeleteAsync('video-ms-8821');

    expect(success).toBe(false);
    // Item is preserved in Trash
    expect(useTrashStore.getState().items.some(i => i.id === 'video-ms-8821')).toBe(true);
    expect(useTrashStore.getState().permanentlyDeletedIds).not.toContain('video-ms-8821');

    // Case B: Native permission throws
    (legacyMediaLib.deleteAssetsAsync as jest.Mock).mockRejectedValueOnce(
      new Error('User did not grant write permission to requested files.')
    );

    success = await useMediaStore.getState().permanentDeleteAsync('video-ms-8821');

    expect(success).toBe(false);
    expect(useTrashStore.getState().items.some(i => i.id === 'video-ms-8821')).toBe(true);

    spyWarn.mockRestore();
    spyError.mockRestore();
  });

  it('4. The Videos section uses the same correct deletion filtering as Gallery by ID and URI', async () => {
    // Both gallery filter and smart album filter
    useTrashStore.setState({
      items: [{
        ...testVideo,
        trashedAt: Date.now(),
      }],
      permanentlyDeletedIds: [],
      permanentlyDeletedUris: [],
    });

    // Simulate item in raw media
    const allMedia = [testVideo, testPhoto];
    let authorizedItems: PixoraMediaInfo[] = [];
    render(
      <HookTester
        media={allMedia}
        context="public"
        onCapture={(res) => {
          authorizedItems = res;
        }}
      />
    );

    // Gallery filterType === 'video'
    const galleryVideos = authorizedItems.filter(m => m.mediaType === 'video');
    expect(galleryVideos.some(m => m.id === 'video-ms-8821')).toBe(false);

    // Smart Album 'Videos'
    const videosSmartDef = SMART_ALBUM_DEFS.find(d => d.id === '__smart_videos')!;
    const smartAlbumVideos = authorizedItems.filter(videosSmartDef.filter);
    expect(smartAlbumVideos.some(m => m.id === 'video-ms-8821')).toBe(false);

    cleanup();

    // Matching by URI even if ID format varies
    const videoWithDifferentIdFormat: PixoraMediaInfo = {
      ...testVideo,
      id: '8821', // numeric string without prefix
      uri: testVideo.uri,
    };

    let diffItems: PixoraMediaInfo[] = [];
    render(
      <HookTester
        media={[videoWithDifferentIdFormat]}
        context="public"
        onCapture={(res) => {
          diffItems = res;
        }}
      />
    );
    expect(diffItems.some(m => m.uri === testVideo.uri)).toBe(false);
  });

  it('5. Restoring a video does not create duplicates in media', async () => {
    // Soft delete
    await useMediaStore.getState().deleteMediaAsync('video-ms-8821');

    expect(useTrashStore.getState().items.some(i => i.id === 'video-ms-8821')).toBe(true);

    // Restore item
    useTrashStore.getState().restoreItems(['video-ms-8821']);

    // Simulate proactive add from trash screen restore handler
    const currentMedia = useMediaStore.getState().media;
    const currentIds = new Set(currentMedia.map(m => String(m.id)));
    if (!currentIds.has('video-ms-8821')) {
      useMediaStore.setState({
        media: [...currentMedia, testVideo].sort((a, b) => b.creationTime - a.creationTime),
      });
    }

    // Simulate subsequent MediaStore refresh returning the restored video
    jest.spyOn(mediaStoreService, 'getMediaAsync').mockResolvedValueOnce({
      assets: [testVideo, testPhoto],
      hasNextPage: false,
      endCursor: 'cursor-1',
    });

    await useMediaStore.getState().refreshMedia();

    // Check no duplicate IDs exist
    const media = useMediaStore.getState().media;
    const matchingVideos = media.filter(m => m.id === 'video-ms-8821');
    expect(matchingVideos.length).toBe(1);
  });
});
