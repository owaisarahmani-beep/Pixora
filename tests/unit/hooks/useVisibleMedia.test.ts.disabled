import React from 'react';
import { render } from '@testing-library/react-native';
import { useAuthorizedMedia, useAuthorizedAlbums, MediaContext } from '../../../src/hooks/useVisibleMedia';
import { usePrivacyStore } from '../../../src/store/usePrivacyStore';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Helper to test hooks since renderHook might not be available
function HookWrapper({ 
  hookFn, 
  args, 
  onResult 
}: { 
  hookFn: Function, 
  args: any[], 
  onResult: (res: any) => void 
}) {
  const result = hookFn(...args);
  React.useEffect(() => {
    onResult(result);
  }, [result]);
  return null;
}

describe('Visibility Filters (Central Access Control)', () => {
  beforeEach(() => {
    usePrivacyStore.setState({
      hiddenAlbumIds: [],
      hiddenAssetIds: [],
      privateAssetIds: [],
      lockedAlbumIds: [],
      archivedAssetIds: [],
      isVaultUnlocked: false,
      unlockedAlbums: []
    });
  });

  const mockMedia: any[] = [
    { id: '1', albumId: 'public-1' },
    { id: '2', albumId: 'hidden-1' },
    { id: '3', albumId: null },
    { id: '4', albumId: 'locked-1' },
    { id: '5', albumId: 'public-1' }, // Private
    { id: '6', albumId: 'public-1' }, // Archived
  ];

  it('filters out protected media from public context by default', () => {
    usePrivacyStore.setState({
      hiddenAlbumIds: ['hidden-1'],
      lockedAlbumIds: ['locked-1'],
      privateAssetIds: ['5'],
      archivedAssetIds: ['6']
    });

    let result: any[] = [];
    render(<HookWrapper hookFn={useAuthorizedMedia} args={[mockMedia, 'public']} onResult={(res) => result = res} />);
    
    expect(result.length).toBe(2);
    expect(result.map(m => m.id)).toEqual(['1', '3']);
  });

  it('exposes private media ONLY when context is private AND vault is unlocked', () => {
    usePrivacyStore.setState({ privateAssetIds: ['5'] });

    let result: any[] = [];
    const { rerender } = render(<HookWrapper hookFn={useAuthorizedMedia} args={[mockMedia, 'private']} onResult={(res) => result = res} />);
    
    expect(result.length).toBe(0);

    usePrivacyStore.setState({ isVaultUnlocked: true });
    rerender(<HookWrapper hookFn={useAuthorizedMedia} args={[mockMedia, 'private']} onResult={(res) => result = res} />);
    
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('5');
  });

  it('exposes locked album media ONLY when context is locked_album AND album is unlocked', () => {
    usePrivacyStore.setState({ lockedAlbumIds: ['locked-1'] });
    const context: MediaContext = { type: 'locked_album', albumId: 'locked-1' };

    let result: any[] = [];
    const { rerender } = render(<HookWrapper hookFn={useAuthorizedMedia} args={[mockMedia, context]} onResult={(res) => result = res} />);
    
    expect(result.length).toBe(0);

    usePrivacyStore.setState({ unlockedAlbums: ['locked-1'] });
    rerender(<HookWrapper hookFn={useAuthorizedMedia} args={[mockMedia, context]} onResult={(res) => result = res} />);
    
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('4');
  });

  it('filters out hidden albums from useAuthorizedAlbums', () => {
    const mockAlbums: any[] = [
      { id: 'public-1', title: 'Public' },
      { id: 'hidden-1', title: 'Hidden' },
      { id: 'locked-1', title: 'Locked' },
    ];
    
    usePrivacyStore.setState({ hiddenAlbumIds: ['hidden-1'], lockedAlbumIds: ['locked-1'] });

    let result: any[] = [];
    render(<HookWrapper hookFn={useAuthorizedAlbums} args={[mockAlbums]} onResult={(res) => result = res} />);
    
    expect(result.length).toBe(2);
    expect(result.map(a => a.id)).toEqual(['public-1', 'locked-1']);
  });
});
