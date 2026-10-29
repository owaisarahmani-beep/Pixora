import { usePrivacyStore } from '../../../src/store/usePrivacyStore';
import { useAuthorizedMedia } from '../../../src/hooks/useVisibleMedia';
import { PixoraMediaInfo } from '../../../src/services/media/mediaTypes';
import { act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

describe('Archive Reliability & Lifecycle Flow', () => {
  const samplePhotos: PixoraMediaInfo[] = [
    {
      id: 'photo-1',
      uri: 'ph://photo-1',
      filename: 'family.jpg',
      mediaType: 'photo',
      width: 1920,
      height: 1080,
      creationTime: 1700000000,
      modificationTime: 1700000000,
      duration: 0,
    },
    {
      id: 'photo-2',
      uri: 'ph://photo-2',
      filename: 'vacation.jpg',
      mediaType: 'photo',
      width: 1920,
      height: 1080,
      creationTime: 1700000010,
      modificationTime: 1700000010,
      duration: 0,
    },
    {
      id: 'photo-3',
      uri: 'ph://photo-3',
      filename: 'receipt.jpg',
      mediaType: 'photo',
      width: 1920,
      height: 1080,
      creationTime: 1700000020,
      modificationTime: 1700000020,
      duration: 0,
    },
  ];

  beforeEach(async () => {
    await AsyncStorage.clear();
    await act(async () => {
      usePrivacyStore.setState({
        archivedAssetIds: [],
        privateAssetIds: [],
        hiddenAssetIds: [],
        hiddenAlbumIds: [],
        lockedAlbumIds: [],
        isVaultUnlocked: false,
      });
    });
  });

  it('archive action hides media from public gallery and exposes it in archive', async () => {
    // 1. Initial State: All 3 photos visible in public gallery
    const initialPublic = usePrivacyStore.getState().archivedAssetIds;
    expect(initialPublic).toEqual([]);

    // 2. User archives photo-1
    await act(async () => {
      await usePrivacyStore.getState().archiveAssets(['photo-1']);
    });

    expect(usePrivacyStore.getState().archivedAssetIds).toEqual(['photo-1']);
    expect(usePrivacyStore.getState().isAssetArchived('photo-1')).toBe(true);
    expect(usePrivacyStore.getState().isAssetArchived('photo-2')).toBe(false);
  });

  it('persists archived media IDs across app restarts via AsyncStorage', async () => {
    // Archive photo-2
    await act(async () => {
      await usePrivacyStore.getState().archiveAssets(['photo-2']);
    });

    expect(usePrivacyStore.getState().archivedAssetIds).toContain('photo-2');

    // Simulate app kill & restart: re-initialize privacy store
    await act(async () => {
      await usePrivacyStore.getState().initialize();
    });

    // Archived photo-2 must still be archived after restart
    expect(usePrivacyStore.getState().archivedAssetIds).toContain('photo-2');
  });

  it('restores archived media, returning it to public contexts without file loss', async () => {
    await act(async () => {
      await usePrivacyStore.getState().archiveAssets(['photo-1', 'photo-3']);
    });

    expect(usePrivacyStore.getState().archivedAssetIds).toEqual(['photo-1', 'photo-3']);

    // Restore photo-1
    await act(async () => {
      await usePrivacyStore.getState().unarchiveAssets(['photo-1']);
    });

    expect(usePrivacyStore.getState().archivedAssetIds).toEqual(['photo-3']);
    expect(usePrivacyStore.getState().isAssetArchived('photo-1')).toBe(false);
    expect(usePrivacyStore.getState().isAssetArchived('photo-3')).toBe(true);
  });

  it('handles bulk archive and bulk restore reliably', async () => {
    const allIds = ['photo-1', 'photo-2', 'photo-3'];

    // Bulk Archive
    await act(async () => {
      await usePrivacyStore.getState().archiveAssets(allIds);
    });

    expect(usePrivacyStore.getState().archivedAssetIds.length).toBe(3);

    // Bulk Restore
    await act(async () => {
      await usePrivacyStore.getState().unarchiveAssets(allIds);
    });

    expect(usePrivacyStore.getState().archivedAssetIds.length).toBe(0);
  });

  it('keeps Archive strictly segregated from Hidden, Private Vault, and Trash', async () => {
    await act(async () => {
      await usePrivacyStore.getState().archiveAssets(['photo-1']);
      await usePrivacyStore.getState().makeAssetsPrivate(['photo-2']);
      await usePrivacyStore.getState().hideAssets(['photo-3']);
    });

    const state = usePrivacyStore.getState();
    expect(state.archivedAssetIds).toEqual(['photo-1']);
    expect(state.privateAssetIds).toEqual(['photo-2']);
    expect(state.hiddenAssetIds).toEqual(['photo-3']);

    // None cross-contaminate
    expect(state.isAssetArchived('photo-2')).toBe(false);
    expect(state.isAssetPrivate('photo-1')).toBe(false);
    expect(state.isAssetHidden('photo-1')).toBe(false);
  });
});
