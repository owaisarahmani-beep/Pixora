import { useMediaStore } from '../../../src/store/useMediaStore';

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('expo-media-library', () => ({}));
jest.mock('expo-media-library/legacy', () => ({}));

describe('useMediaStore', () => {
  beforeEach(() => {
    // Reset state before each test
    useMediaStore.setState({ permissionStatus: 'UNDETERMINED' });
  });

  it('initializes with UNDETERMINED permission', () => {
    const store = useMediaStore.getState();
    expect(store.permissionStatus).toBe('UNDETERMINED');
  });
});
