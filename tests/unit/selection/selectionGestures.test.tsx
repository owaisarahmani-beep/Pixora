import React from 'react';
import { render, fireEvent, act, cleanup } from '@testing-library/react-native';
import PhotoThumbnail from '../../../src/components/gallery/PhotoThumbnail';
import { useSelectionStore } from '../../../src/store/useSelectionStore';
import { router } from 'expo-router';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

describe('Selection Gestures & Single-Tap Toggling', () => {
  const sampleMedia1 = {
    id: 'item-1',
    uri: 'file:///photo1.jpg',
    filename: 'photo1.jpg',
    mediaType: 'photo' as const,
    width: 100,
    height: 100,
    creationTime: 1000,
    modificationTime: 1000,
    duration: 0,
  };

  const sampleMedia2 = {
    id: 'item-2',
    uri: 'file:///photo2.jpg',
    filename: 'photo2.jpg',
    mediaType: 'photo' as const,
    width: 100,
    height: 100,
    creationTime: 2000,
    modificationTime: 2000,
    duration: 0,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useSelectionStore.setState({
      isSelectionMode: false,
      selectionContext: null,
      selectedIds: new Set(),
      availableIds: ['item-1', 'item-2'],
    });
  });

  afterEach(async () => {
    await cleanup();
  });

  it('normal tap outside selection mode opens the viewer', async () => {
    const { getByTestId } = await render(
      <PhotoThumbnail item={sampleMedia1} numColumns={3} allIds={['item-1', 'item-2']} />
    );

    const pressable = getByTestId('photo-thumbnail-pressable');
    fireEvent.press(pressable);

    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/viewer/[id]',
        params: expect.objectContaining({ id: 'item-1' }),
      })
    );
  });

  it('long-press enters selection mode and selects pressed item exactly once', async () => {
    const { getByTestId } = await render(
      <PhotoThumbnail item={sampleMedia1} numColumns={3} allIds={['item-1', 'item-2']} />
    );

    const pressable = getByTestId('photo-thumbnail-pressable');

    // Trigger long press
    fireEvent(pressable, 'longPress');

    const state = useSelectionStore.getState();
    expect(state.isSelectionMode).toBe(true);
    expect(state.selectionContext).toBe('media');
    expect(state.selectedIds.has('item-1')).toBe(true);
    expect(state.selectedIds.size).toBe(1);
    expect(router.push).not.toHaveBeenCalled();
  });

  it('once selection mode is active, ONE tap selects an unselected item', async () => {
    // Start with selection mode active from item-1
    useSelectionStore.setState({
      isSelectionMode: true,
      selectionContext: 'media',
      selectedIds: new Set(['item-1']),
      availableIds: ['item-1', 'item-2'],
    });

    const { getByTestId } = await render(
      <PhotoThumbnail item={sampleMedia2} numColumns={3} allIds={['item-1', 'item-2']} />
    );

    const pressable2 = getByTestId('photo-thumbnail-pressable');

    // Single tap on item-2
    fireEvent.press(pressable2);

    const state = useSelectionStore.getState();
    // item-2 is selected immediately on the FIRST tap!
    expect(state.selectedIds.has('item-2')).toBe(true);
    expect(state.selectedIds.size).toBe(2);
    // Viewer must NEVER be opened during selection mode
    expect(router.push).not.toHaveBeenCalled();
  });

  it('once selection mode is active, ONE tap deselects an already selected item', async () => {
    useSelectionStore.setState({
      isSelectionMode: true,
      selectionContext: 'media',
      selectedIds: new Set(['item-1', 'item-2']),
      availableIds: ['item-1', 'item-2'],
    });

    const { getByTestId } = await render(
      <PhotoThumbnail item={sampleMedia2} numColumns={3} allIds={['item-1', 'item-2']} />
    );

    const pressable2 = getByTestId('photo-thumbnail-pressable');

    // Single tap to deselect item-2
    fireEvent.press(pressable2);

    const state = useSelectionStore.getState();
    expect(state.selectedIds.has('item-2')).toBe(false);
    expect(state.selectedIds.has('item-1')).toBe(true);
    expect(state.selectedIds.size).toBe(1);
    expect(state.isSelectionMode).toBe(true);
  });

  it('deselecting the final selected item exits selection mode', async () => {
    useSelectionStore.setState({
      isSelectionMode: true,
      selectionContext: 'media',
      selectedIds: new Set(['item-1']),
      availableIds: ['item-1', 'item-2'],
    });

    const { getByTestId } = await render(
      <PhotoThumbnail item={sampleMedia1} numColumns={3} allIds={['item-1', 'item-2']} />
    );

    const pressable1 = getByTestId('photo-thumbnail-pressable');

    // Deselect the only remaining item
    fireEvent.press(pressable1);

    const state = useSelectionStore.getState();
    expect(state.selectedIds.size).toBe(0);
    expect(state.isSelectionMode).toBe(false);
    expect(state.selectionContext).toBeNull();
  });
});
