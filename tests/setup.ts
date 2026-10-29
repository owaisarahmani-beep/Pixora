jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('react-native-reanimated', () => {
  const { View, Text } = require('react-native');
  const mockAnimated = {
    View,
    Text,
    createAnimatedComponent: (c: any) => c,
    timing: () => ({ start: (cb?: any) => cb && cb() }),
    spring: () => ({ start: (cb?: any) => cb && cb() }),
    Value: function(v: any) { (this as any).value = v; },
  };

  return {
    __esModule: true,
    default: mockAnimated,
    ...mockAnimated,
    FadeIn: { duration: () => ({ delay: () => ({}) }) },
    FadeOut: { duration: () => ({ delay: () => ({}) }) },
    FadeInDown: { duration: () => ({ delay: () => ({}) }) },
    FadeInUp: { duration: () => ({ delay: () => ({}) }) },
    FadeOutDown: { duration: () => ({ delay: () => ({}) }) },
    FadeOutUp: { duration: () => ({ delay: () => ({}) }) },
    SlideInDown: { duration: () => ({ delay: () => ({}) }) },
    SlideInUp: { duration: () => ({ delay: () => ({}) }) },
    SlideOutDown: { duration: () => ({ delay: () => ({}) }) },
    SlideOutUp: { duration: () => ({ delay: () => ({}) }) },
    useAnimatedStyle: (fn: any) => (fn ? fn() : {}),
    useSharedValue: (init: any) => ({ value: init }),
    withTiming: (to: any) => to,
    withSpring: (to: any) => to,
    interpolate: (v: any) => v,
    Extrapolation: { CLAMP: 'clamp' },
  };
});

jest.mock('expo-router', () => {
  const React = require('react');
  return {
    router: {
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
    },
    useLocalSearchParams: jest.fn(() => ({})),
    useFocusEffect: (callback: any) => {
      React.useEffect(callback, []);
    },
    Stack: {
      Screen: ({ options }: any) => {
        if (options?.headerShown === false) return null;
        return React.createElement(
          React.Fragment,
          null,
          typeof options?.headerLeft === 'function' ? options.headerLeft() : null,
          typeof options?.headerTitle === 'function' ? options.headerTitle() : null,
          typeof options?.headerRight === 'function' ? options.headerRight() : null
        );
      },
    },
    Link: () => null,
  };
});

jest.mock('expo-media-library', () => ({
  deleteAssetsAsync: jest.fn(async () => true),
  getAssetsAsync: jest.fn(async () => ({ assets: [], hasNextPage: false, endCursor: '' })),
  getAssetInfoAsync: jest.fn(async () => null),
  getAlbumsAsync: jest.fn(async () => []),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  getPermissionsAsync: jest.fn(async () => ({ granted: true })),
  addListener: jest.fn(() => ({ remove: jest.fn() })),
  removeSubscription: jest.fn(),
  removeAllListeners: jest.fn(),
  MediaType: { photo: 'photo', video: 'video' },
  SortBy: { creationTime: 'creationTime', modificationTime: 'modificationTime', default: 'default' },
}));

jest.mock('expo-media-library/legacy', () => ({
  deleteAssetsAsync: jest.fn(async () => true),
  getAssetsAsync: jest.fn(async () => ({ assets: [], hasNextPage: false, endCursor: '' })),
  getAssetInfoAsync: jest.fn(async () => null),
  getAlbumsAsync: jest.fn(async () => []),
  addListener: jest.fn(() => ({ remove: jest.fn() })),
  removeSubscription: jest.fn(),
  removeAllListeners: jest.fn(),
  MediaType: { photo: 'photo', video: 'video' },
  SortBy: { creationTime: 'creationTime', modificationTime: 'modificationTime', default: 'default' },
}));
