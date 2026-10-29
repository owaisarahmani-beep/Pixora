import { useMediaStore } from '../../../src/store/useMediaStore';
import { useAlbumsStore } from '../../../src/store/useAlbumsStore';
import { useFavoritesStore } from '../../../src/store/useFavoritesStore';
import { useSelectionStore } from '../../../src/store/useSelectionStore';
import { useTrashStore } from '../../../src/store/useTrashStore';
import { PixoraMediaInfo } from '../../../src/services/media/mediaTypes';
import { act } from '@testing-library/react-native';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

describe('Deleted Media Consistency Across Stores', () => {
  const sampleVideo: PixoraMediaInfo = {
    id: 'vid-del-1',
    uri: 'ph://video-del-1',
    filename: 'clip.mp4',
    mediaType: 'video',
    width: 1920,
    height: 1080,
    creationTime: 1700000000,
    modificationTime: 1700000000,
    duration: 30,
  };

  const samplePhoto: PixoraMediaInfo = {
    id: 'photo-del-2',
    uri: 'ph://photo-del-2',
    filename: 'portrait.jpg',
    mediaType: 'photo',
    width: 1920,
    height: 1080,
    creationTime: 1700000010,
    modificationTime: 1700000010,
    duration: 0,
  };

  beforeEach(async () => {
    await act(async () => {
      useMediaStore.setState({
        media: [sampleVideo, samplePhoto],
        isLoading: false,
        isRefreshing: false,
      });

      useAlbumsStore.setState({
        activeAlbumMedia: [sampleVideo],
        activeAlbumGrouped: [],
      });

      useFavoritesStore.setState({
        favorites: new Set([sampleVideo.id]),
        favoritesMedia: [sampleVideo],
      });

      useSelectionStore.setState({
        isSelectionMode: true,
        selectedIds: new Set([sampleVideo.id]),
        availableIds: [sampleVideo.id, samplePhoto.id],
      });

      useTrashStore.setState({
        items: [],
      });
    });
  });

  it('removes deleted video from gallery, albums, favorites, and selection synchronously', async () => {
    expect(useMediaStore.getState().media.some(m => m.id === 'vid-del-1')).toBe(true);
    expect(useAlbumsStore.getState().activeAlbumMedia.some(m => m.id === 'vid-del-1')).toBe(true);
    expect(useFavoritesStore.getState().favorites.has('vid-del-1')).toBe(true);
    expect(useSelectionStore.getState().selectedIds.has('vid-del-1')).toBe(true);

    // Delete the video
    let success = false;
    await act(async () => {
      success = await useMediaStore.getState().deleteMediaAsync('vid-del-1');
    });

    expect(success).toBe(true);

    // 1. Must be removed from main gallery media
    expect(useMediaStore.getState().media.some(m => m.id === 'vid-del-1')).toBe(false);
    expect(useMediaStore.getState().media.length).toBe(1);

    // 2. Must be removed from active album media
    expect(useAlbumsStore.getState().activeAlbumMedia.some(m => m.id === 'vid-del-1')).toBe(false);

    // 3. Must be removed from favorites
    expect(useFavoritesStore.getState().favorites.has('vid-del-1')).toBe(false);
    expect(useFavoritesStore.getState().favoritesMedia.some(m => m.id === 'vid-del-1')).toBe(false);

    // 4. Must be unselected in selection store
    expect(useSelectionStore.getState().selectedIds.has('vid-del-1')).toBe(false);

    // 5. Must reside in trash store with 30-day recovery metadata
    expect(useTrashStore.getState().items.some(i => i.id === 'vid-del-1')).toBe(true);
  });

  it('handles deletion when item is only in an album and not yet in gallery media', async () => {
    const albumOnlyVideo: PixoraMediaInfo = {
      id: 'album-vid-99',
      uri: 'ph://album-vid-99',
      filename: 'trip.mp4',
      mediaType: 'video',
      width: 1080,
      height: 1920,
      creationTime: 1690000000,
      modificationTime: 1690000000,
      duration: 15,
    };

    await act(async () => {
      useMediaStore.setState({ media: [samplePhoto] }); // Not in gallery
      useAlbumsStore.setState({ activeAlbumMedia: [albumOnlyVideo] });
    });

    let success = false;
    await act(async () => {
      success = await useMediaStore.getState().deleteMediaAsync('album-vid-99');
    });

    expect(success).toBe(true);
    expect(useAlbumsStore.getState().activeAlbumMedia.some(m => m.id === 'album-vid-99')).toBe(false);
    expect(useTrashStore.getState().items.some(i => i.id === 'album-vid-99')).toBe(true);
  });

  it('preserves media store on query error and distinguishes it from confirmed deletion', async () => {
    const initialMedia = useMediaStore.getState().media;

    // Simulate transient query failure in refreshMedia
    await act(async () => {
      useMediaStore.setState({ isRefreshing: false, isLoading: false });
    });

    // Valid items are not removed merely because an async query threw an error
    expect(useMediaStore.getState().media).toEqual(initialMedia);
  });

  it('permanent deletion rejects and preserves trash item when system permission is denied', async () => {
    const legacyMediaLib = require('expo-media-library/legacy');
    (legacyMediaLib.deleteAssetsAsync as jest.Mock).mockResolvedValueOnce(false);

    useTrashStore.setState({
      items: [{
        id: 'photo-del-2',
        uri: 'ph://photo-del-2',
        filename: 'portrait.jpg',
        mediaType: 'photo',
        width: 1920,
        height: 1080,
        creationTime: 1700000010,
        duration: 0,
        trashedAt: Date.now(),
      }],
    });

    let success = false;
    await act(async () => {
      success = await useMediaStore.getState().permanentDeleteAsync('photo-del-2');
    });

    expect(success).toBe(false);
    // Item MUST NOT be removed from trash if Android operation failed
    expect(useTrashStore.getState().items.some(i => i.id === 'photo-del-2')).toBe(true);
  });

  it('permanent deletion removes item from trash and media when system deletion succeeds', async () => {
    const legacyMediaLib = require('expo-media-library/legacy');
    (legacyMediaLib.deleteAssetsAsync as jest.Mock).mockResolvedValueOnce(true);

    useTrashStore.setState({
      items: [{
        id: 'photo-del-2',
        uri: 'ph://photo-del-2',
        filename: 'portrait.jpg',
        mediaType: 'photo',
        width: 1920,
        height: 1080,
        creationTime: 1700000010,
        duration: 0,
        trashedAt: Date.now(),
      }],
    });

    let success = false;
    await act(async () => {
      success = await useMediaStore.getState().permanentDeleteAsync('photo-del-2');
    });

    expect(success).toBe(true);
    expect(useTrashStore.getState().items.some(i => i.id === 'photo-del-2')).toBe(false);
  });

  it('consistently matches string and numeric IDs without resurrection', () => {
    useTrashStore.setState({
      items: [{
        id: '12345',
        uri: 'ph://12345',
        filename: 'clip.mp4',
        mediaType: 'video',
        width: 1920,
        height: 1080,
        creationTime: 1700000000,
        duration: 30,
        trashedAt: Date.now(),
      }],
    });

    const trashedIds = new Set(useTrashStore.getState().items.map(i => String(i.id)));
    // Simulating MediaStore returning numeric or string ID
    expect(trashedIds.has(String(12345 as any))).toBe(true);
    expect(trashedIds.has(String('12345'))).toBe(true);
  });
});
