import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import TrashScreen from '../../../src/app/trash';
import { useTrashStore } from '../../../src/store/useTrashStore';
import { useMediaStore } from '../../../src/store/useMediaStore';
import * as MediaLibrary from 'expo-media-library/legacy';
import { Alert } from 'react-native';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const renderWithSafeArea = async (ui: React.ReactElement) => {
  return await render(
    <SafeAreaProvider
      initialMetrics={{
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
        frame: { x: 0, y: 0, width: 375, height: 812 },
      }}
    >
      {ui}
    </SafeAreaProvider>
  );
};

describe('Trash Screen - Empty Trash & Single Confirmation', () => {
  const sampleItems = [
    {
      id: 'trash-1',
      uri: 'file:///trash1.jpg',
      filename: 'trash1.jpg',
      mediaType: 'photo' as const,
      width: 100,
      height: 100,
      creationTime: 1000,
      duration: 0,
      trashedAt: Date.now(),
    },
    {
      id: 'trash-2',
      uri: 'file:///trash2.jpg',
      filename: 'trash2.jpg',
      mediaType: 'photo' as const,
      width: 100,
      height: 100,
      creationTime: 2000,
      duration: 0,
      trashedAt: Date.now(),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    useTrashStore.setState({
      items: [...sampleItems],
      permanentlyDeletedIds: [],
      permanentlyDeletedUris: [],
    });
    useMediaStore.setState({
      media: [],
      refreshMedia: jest.fn().mockResolvedValue(undefined),
    });
  });

  it('tapping Empty Trash shows exactly ONE confirmation modal', async () => {
    const { getByText, queryByText } = await renderWithSafeArea(<TrashScreen />);

    // Empty button in header
    const emptyBtn = getByText('Empty');
    fireEvent.press(emptyBtn);

    // Pixora's confirmation modal is displayed
    await waitFor(() => {
      expect(getByText('Empty Recently Deleted?')).toBeTruthy();
      expect(getByText('All items in Recently Deleted will be permanently deleted. This action cannot be undone.')).toBeTruthy();
    });
  });

  it('cancelling Empty Trash leaves all items unchanged', async () => {
    const { getByText, queryByText } = await renderWithSafeArea(<TrashScreen />);

    fireEvent.press(getByText('Empty'));
    await waitFor(() => {
      expect(getByText('Empty Recently Deleted?')).toBeTruthy();
    });

    // Tap Cancel
    fireEvent.press(getByText('Cancel'));

    await waitFor(() => {
      expect(queryByText('Empty Recently Deleted?')).toBeNull();
    });

    // Items remain intact
    expect(useTrashStore.getState().items).toHaveLength(2);
    expect(MediaLibrary.deleteAssetsAsync).not.toHaveBeenCalled();
  });

  it('confirming Empty Trash calls deleteAssetsAsync ONCE with all IDs in a single batch', async () => {
    (MediaLibrary.deleteAssetsAsync as jest.Mock).mockResolvedValueOnce(true);

    const { getByText, queryByText } = await renderWithSafeArea(<TrashScreen />);

    fireEvent.press(getByText('Empty'));
    await waitFor(() => {
      expect(getByText('Empty Recently Deleted?')).toBeTruthy();
    });

    // Confirm button inside modal
    const confirmBtn = getByText('Empty Trash');
    fireEvent.press(confirmBtn);

    await waitFor(() => {
      // Must be called EXACTLY ONCE with the array of both IDs
      expect(MediaLibrary.deleteAssetsAsync).toHaveBeenCalledTimes(1);
      expect(MediaLibrary.deleteAssetsAsync).toHaveBeenCalledWith(['trash-1', 'trash-2']);
    });

    await waitFor(() => {
      expect(useTrashStore.getState().items).toHaveLength(0);
    });
  });

  it('reports partial failure accurately when some items could not be deleted', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    // Simulate batch call returning false (declined or partial)
    (MediaLibrary.deleteAssetsAsync as jest.Mock).mockResolvedValueOnce(false);

    // Mock mediaStoreService to report trash-2 still exists, but trash-1 was deleted
    const { mediaStoreService } = require('../../../src/services/media/MediaStoreService');
    jest.spyOn(mediaStoreService, 'getAssetsByIdsAsync').mockResolvedValueOnce([
      { id: 'trash-2', uri: 'file:///trash2.jpg' },
    ]);

    const { getByText } = await renderWithSafeArea(<TrashScreen />);

    fireEvent.press(getByText('Empty'));
    await waitFor(() => {
      expect(getByText('Empty Trash')).toBeTruthy();
    });
    fireEvent.press(getByText('Empty Trash'));

    await waitFor(() => {
      expect(MediaLibrary.deleteAssetsAsync).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      // trash-1 was deleted, trash-2 remains
      expect(useTrashStore.getState().items).toHaveLength(1);
      expect(useTrashStore.getState().items[0].id).toBe('trash-2');
      expect(alertSpy).toHaveBeenCalledWith(
        'Partial Deletion',
        expect.stringContaining('1 of 2 items were deleted')
      );
    });
  });
});
