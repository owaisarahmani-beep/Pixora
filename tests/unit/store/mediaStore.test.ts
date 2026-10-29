import { useMediaStore } from '../../../src/store/useMediaStore';
import { mediaStoreService } from '../../../src/services/media/MediaStoreService';

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('expo-media-library', () => ({}));
jest.mock('expo-media-library/legacy', () => ({}));
jest.mock('../../../src/services/media/MediaStoreService', () => ({
  mediaStoreService: {
    getPermissionsAsync: jest.fn(),
    requestPermissionsAsync: jest.fn(),
    getMediaAsync: jest.fn(),
    getAlbumAssetsAsync: jest.fn(),
    getAlbumsAsync: jest.fn(),
    getAlbumCoverAsync: jest.fn(),
  },
}));

describe('useMediaStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useMediaStore.setState({
      permissionStatus: 'UNDETERMINED',
      isCheckingPermission: true,
      media: [],
      isLoading: false,
      isRefreshing: false,
      lastRefreshTime: 0,
    });
  });

  it('initializes with UNDETERMINED permission and isCheckingPermission: true', () => {
    const store = useMediaStore.getState();
    expect(store.permissionStatus).toBe('UNDETERMINED');
    expect(store.isCheckingPermission).toBe(true);
  });

  it('checkPermissions sets isCheckingPermission: false and updates permissionStatus when granted', async () => {
    (mediaStoreService.getPermissionsAsync as jest.Mock).mockResolvedValue('GRANTED');
    (mediaStoreService.getMediaAsync as jest.Mock).mockResolvedValue({
      assets: [],
      hasNextPage: false,
      endCursor: undefined,
    });

    await useMediaStore.getState().checkPermissions();

    const store = useMediaStore.getState();
    expect(store.permissionStatus).toBe('GRANTED');
    expect(store.isCheckingPermission).toBe(false);
  });

  it('checkPermissions sets isCheckingPermission: false when permission is undetermined', async () => {
    (mediaStoreService.getPermissionsAsync as jest.Mock).mockResolvedValue('UNDETERMINED');

    await useMediaStore.getState().checkPermissions();

    const store = useMediaStore.getState();
    expect(store.permissionStatus).toBe('UNDETERMINED');
    expect(store.isCheckingPermission).toBe(false);
  });

  it('concurrent checkPermissions calls share a single in-flight promise', async () => {
    let resolvePermission: (status: any) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePermission = resolve;
    });
    (mediaStoreService.getPermissionsAsync as jest.Mock).mockReturnValue(pendingPromise);

    const call1 = useMediaStore.getState().checkPermissions();
    const call2 = useMediaStore.getState().checkPermissions();

    expect(call1).toBe(call2);
    expect(mediaStoreService.getPermissionsAsync).toHaveBeenCalledTimes(1);

    resolvePermission!('GRANTED');
    (mediaStoreService.getMediaAsync as jest.Mock).mockResolvedValue({
      assets: [],
      hasNextPage: false,
      endCursor: undefined,
    });

    await Promise.all([call1, call2]);
    expect(useMediaStore.getState().isCheckingPermission).toBe(false);
  });

  it('requestPermissions sets isCheckingPermission: false and updates status', async () => {
    (mediaStoreService.requestPermissionsAsync as jest.Mock).mockResolvedValue('GRANTED');
    (mediaStoreService.getMediaAsync as jest.Mock).mockResolvedValue({
      assets: [],
      hasNextPage: false,
      endCursor: undefined,
    });

    await useMediaStore.getState().requestPermissions();

    const store = useMediaStore.getState();
    expect(store.permissionStatus).toBe('GRANTED');
    expect(store.isCheckingPermission).toBe(false);
  });

  it('loadInitialMedia updates lastRefreshTime', async () => {
    (mediaStoreService.getMediaAsync as jest.Mock).mockResolvedValue({
      assets: [],
      hasNextPage: false,
      endCursor: undefined,
    });

    const before = Date.now();
    await useMediaStore.getState().loadInitialMedia();
    const after = Date.now();

    const lastRefresh = useMediaStore.getState().lastRefreshTime;
    expect(lastRefresh).toBeGreaterThanOrEqual(before);
    expect(lastRefresh).toBeLessThanOrEqual(after);
  });
});
