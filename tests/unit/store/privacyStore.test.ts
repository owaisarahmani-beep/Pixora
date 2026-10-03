import { usePrivacyStore } from '../../../src/store/usePrivacyStore';
import { appLockService } from '../../../src/services/privacy/AppLockService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock the AppLockService
jest.mock('../../../src/services/privacy/AppLockService', () => ({
  appLockService: {
    checkCapabilityAsync: jest.fn(),
    authenticateAsync: jest.fn(),
  }
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

describe('usePrivacyStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    usePrivacyStore.setState({
      isAppLockEnabled: false,
      lockPolicy: 'immediate',
      hiddenAlbumIds: [],
      isUnlocked: true,
      isCapabilityChecked: false,
      isSupportedOnDevice: false,
    });
  });

  it('initializes correctly with hardware support but no saved state', async () => {
    (appLockService.checkCapabilityAsync as jest.Mock).mockResolvedValue({ isAvailable: true });
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

    await usePrivacyStore.getState().initialize();

    const state = usePrivacyStore.getState();
    expect(state.isSupportedOnDevice).toBe(true);
    expect(state.isAppLockEnabled).toBe(false);
    expect(state.isUnlocked).toBe(true); // Unlocked if not enabled
  });

  it('initializes correctly with saved state', async () => {
    (appLockService.checkCapabilityAsync as jest.Mock).mockResolvedValue({ isAvailable: true });
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({
      isAppLockEnabled: true,
      lockPolicy: 'inactivity',
      hiddenAlbumIds: ['album-1', 'album-2'],
    }));

    await usePrivacyStore.getState().initialize();

    const state = usePrivacyStore.getState();
    expect(state.isAppLockEnabled).toBe(true);
    expect(state.lockPolicy).toBe('inactivity');
    expect(state.hiddenAlbumIds).toEqual(['album-1', 'album-2']);
    expect(state.isUnlocked).toBe(false); // Locked if enabled on startup
  });

  it('enables app lock successfully if authentication passes', async () => {
    (appLockService.authenticateAsync as jest.Mock).mockResolvedValue(true);

    const success = await usePrivacyStore.getState().enableAppLock('immediate');

    const state = usePrivacyStore.getState();
    expect(success).toBe(true);
    expect(state.isAppLockEnabled).toBe(true);
    expect(state.lockPolicy).toBe('immediate');
    expect(state.isUnlocked).toBe(true); // Left unlocked after enabling
    expect(AsyncStorage.setItem).toHaveBeenCalled();
  });

  it('does not enable app lock if authentication fails', async () => {
    (appLockService.authenticateAsync as jest.Mock).mockResolvedValue(false);

    const success = await usePrivacyStore.getState().enableAppLock('immediate');

    const state = usePrivacyStore.getState();
    expect(success).toBe(false);
    expect(state.isAppLockEnabled).toBe(false);
  });

  it('locks correctly', () => {
    usePrivacyStore.setState({ isAppLockEnabled: true, isUnlocked: true });
    
    usePrivacyStore.getState().lock();
    
    expect(usePrivacyStore.getState().isUnlocked).toBe(false);
  });

  it('unlocks correctly on successful authentication', async () => {
    usePrivacyStore.setState({ isAppLockEnabled: true, isUnlocked: false });
    (appLockService.authenticateAsync as jest.Mock).mockResolvedValue(true);
    
    const success = await usePrivacyStore.getState().unlock();
    
    expect(success).toBe(true);
    expect(usePrivacyStore.getState().isUnlocked).toBe(true);
  });

  it('adds and removes hidden albums', async () => {
    await usePrivacyStore.getState().hideAlbum('test-1');
    
    expect(usePrivacyStore.getState().hiddenAlbumIds).toContain('test-1');
    expect(usePrivacyStore.getState().isHidden('test-1')).toBe(true);
    
    await usePrivacyStore.getState().unhideAlbum('test-1');
    
    expect(usePrivacyStore.getState().hiddenAlbumIds).not.toContain('test-1');
    expect(usePrivacyStore.getState().isHidden('test-1')).toBe(false);
  });
});
