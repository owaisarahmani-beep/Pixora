import React from 'react';
import { View } from 'react-native';
import { render, act } from '@testing-library/react-native';
import { usePrivacyStore } from '../../../src/store/usePrivacyStore';
import { useAuthorizedMedia, MediaContext } from '../../../src/hooks/useVisibleMedia';
import { PixoraMediaInfo } from '../../../src/services/media/mediaTypes';

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

describe('Private Vault Access & Security Boundary', () => {
  const mockMedia: PixoraMediaInfo[] = [
    {
      id: 'pub-1',
      uri: 'ph://pub-1',
      filename: 'family.jpg',
      mediaType: 'photo',
      width: 1000,
      height: 1000,
      creationTime: 1700000000,
      modificationTime: 1700000000,
      duration: 0,
    },
    {
      id: 'priv-1',
      uri: 'ph://priv-1',
      filename: 'passport.jpg',
      mediaType: 'photo',
      width: 1000,
      height: 1000,
      creationTime: 1700000010,
      modificationTime: 1700000010,
      duration: 0,
    },
    {
      id: 'priv-2',
      uri: 'ph://priv-2',
      filename: 'financial.mp4',
      mediaType: 'video',
      width: 1920,
      height: 1080,
      creationTime: 1700000020,
      modificationTime: 1700000020,
      duration: 45,
    },
  ];

  beforeEach(() => {
    usePrivacyStore.setState({
      privateAssetIds: ['priv-1', 'priv-2'],
      hiddenAssetIds: [],
      hiddenAlbumIds: [],
      lockedAlbumIds: [],
      archivedAssetIds: [],
      isVaultUnlocked: false,
    });
  });

  it('never renders or exposes vault media before authorization is valid', async () => {
    let captured: PixoraMediaInfo[] = [];
    await render(
      <HookTester
        media={mockMedia}
        context="private"
        onCapture={(items) => {
          captured = items;
        }}
      />
    );

    // Vault is locked -> Must return empty array
    expect(usePrivacyStore.getState().isVaultUnlocked).toBe(false);
    expect(captured).toEqual([]);
  });

  it('renders vault media after successful authorization', async () => {
    let captured: PixoraMediaInfo[] = [];
    const screen = await render(
      <HookTester
        media={mockMedia}
        context="private"
        onCapture={(items) => {
          captured = items;
        }}
      />
    );

    expect(captured).toEqual([]);

    // Simulate successful biometric / PIN authorization
    await act(async () => {
      usePrivacyStore.setState({ isVaultUnlocked: true });
    });

    await screen.rerender(
      <HookTester
        media={mockMedia}
        context="private"
        onCapture={(items) => {
          captured = items;
        }}
      />
    );

    expect(captured.length).toBe(2);
    expect(captured.map((m) => m.id)).toEqual(['priv-1', 'priv-2']);
  });

  it('immediately clears protected content when session is locked or expired', async () => {
    usePrivacyStore.setState({ isVaultUnlocked: true });

    let captured: PixoraMediaInfo[] = [];
    const screen = await render(
      <HookTester
        media={mockMedia}
        context="private"
        onCapture={(items) => {
          captured = items;
        }}
      />
    );

    expect(captured.length).toBe(2);

    // User locks vault or inactivity timeout triggers
    await act(async () => {
      usePrivacyStore.getState().lockVault();
    });

    expect(usePrivacyStore.getState().isVaultUnlocked).toBe(false);

    await screen.rerender(
      <HookTester
        media={mockMedia}
        context="private"
        onCapture={(items) => {
          captured = items;
        }}
      />
    );

    // Must be completely wiped
    expect(captured).toEqual([]);
  });

  it('prevents private vault media from ever leaking into public context', async () => {
    let captured: PixoraMediaInfo[] = [];
    await render(
      <HookTester
        media={mockMedia}
        context="public"
        onCapture={(items) => {
          captured = items;
        }}
      />
    );

    // Public context must strictly exclude priv-1 and priv-2
    expect(captured.length).toBe(1);
    expect(captured[0].id).toBe('pub-1');
  });
});
