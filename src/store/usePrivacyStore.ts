import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { appLockService } from '../services/privacy/AppLockService';

export type LockPolicy = 'immediate' | 'inactivity';

interface PrivacyState {
  isAppLockEnabled: boolean;
  lockPolicy: LockPolicy;
  hiddenAlbumIds: string[];
  hiddenAssetIds: string[];
  
  // Ephemeral state
  isUnlocked: boolean;
  isCapabilityChecked: boolean;
  isSupportedOnDevice: boolean;

  // Actions
  initialize: () => Promise<void>;
  enableAppLock: (policy: LockPolicy) => Promise<boolean>;
  disableAppLock: () => Promise<boolean>;
  setLockPolicy: (policy: LockPolicy) => Promise<void>;
  
  // Ephemeral Actions
  lock: () => void;
  unlock: () => Promise<boolean>;
  
  // Hidden Albums
  hideAlbum: (albumId: string) => Promise<void>;
  unhideAlbum: (albumId: string) => Promise<void>;

  // Hidden Assets
  hideAssets: (assetIds: string[]) => Promise<void>;
  unhideAssets: (assetIds: string[]) => Promise<void>;
  
  // Visibility Selectors
  isHidden: (albumId: string | undefined | null) => boolean;
  isAssetHidden: (assetId: string) => boolean;
}

const PRIVACY_STORE_KEY = '@pixora_privacy_store_v1';

export const usePrivacyStore = create<PrivacyState>((set, get) => ({
  isAppLockEnabled: false,
  lockPolicy: 'immediate',
  hiddenAlbumIds: [],
  hiddenAssetIds: [],
  
  isUnlocked: false,
  isCapabilityChecked: false,
  isSupportedOnDevice: false,

  initialize: async () => {
    try {
      const capability = await appLockService.checkCapabilityAsync();
      const storedStr = await AsyncStorage.getItem(PRIVACY_STORE_KEY);
      
      let isAppLockEnabled = false;
      let lockPolicy: LockPolicy = 'immediate';
      let hiddenAlbumIds: string[] = [];
      let hiddenAssetIds: string[] = [];

      if (storedStr) {
        const parsed = JSON.parse(storedStr);
        // Only restore lock if device still supports it
        isAppLockEnabled = capability.isAvailable ? Boolean(parsed.isAppLockEnabled) : false;
        lockPolicy = parsed.lockPolicy === 'inactivity' ? 'inactivity' : 'immediate';
        hiddenAlbumIds = Array.isArray(parsed.hiddenAlbumIds) ? parsed.hiddenAlbumIds : [];
        hiddenAssetIds = Array.isArray(parsed.hiddenAssetIds) ? parsed.hiddenAssetIds : [];
      }

      set({
        isAppLockEnabled,
        lockPolicy,
        hiddenAlbumIds,
        hiddenAssetIds,
        isSupportedOnDevice: capability.isAvailable,
        isCapabilityChecked: true,
        // If app lock is not enabled, we consider the app intrinsically "unlocked"
        isUnlocked: !isAppLockEnabled,
      });
    } catch (e) {
      console.error('Failed to initialize privacy store', e);
      // Safe defaults
      set({ isCapabilityChecked: true, isUnlocked: true });
    }
  },

  enableAppLock: async (policy: LockPolicy) => {
    const success = await appLockService.authenticateAsync('Authenticate to enable App Lock');
    if (success) {
      set({ isAppLockEnabled: true, lockPolicy: policy, isUnlocked: true });
      await savePrivacyState(get());
      return true;
    }
    return false;
  },

  disableAppLock: async () => {
    const success = await appLockService.authenticateAsync('Authenticate to disable App Lock');
    if (success) {
      set({ isAppLockEnabled: false, isUnlocked: true });
      await savePrivacyState(get());
      return true;
    }
    return false;
  },

  setLockPolicy: async (policy: LockPolicy) => {
    set({ lockPolicy: policy });
    await savePrivacyState(get());
  },

  lock: () => {
    if (get().isAppLockEnabled) {
      set({ isUnlocked: false });
    }
  },

  unlock: async () => {
    if (!get().isAppLockEnabled) return true;
    
    const success = await appLockService.authenticateAsync('Unlock Pixora');
    if (success) {
      set({ isUnlocked: true });
    }
    return success;
  },

  hideAlbum: async (albumId: string) => {
    const state = get();
    if (!state.hiddenAlbumIds.includes(albumId)) {
      set({ hiddenAlbumIds: [...state.hiddenAlbumIds, albumId] });
      await savePrivacyState(get());
    }
  },

  unhideAlbum: async (albumId: string) => {
    const state = get();
    set({ hiddenAlbumIds: state.hiddenAlbumIds.filter(id => id !== albumId) });
    await savePrivacyState(get());
  },

  hideAssets: async (assetIds: string[]) => {
    const state = get();
    const newIds = assetIds.filter(id => !state.hiddenAssetIds.includes(id));
    if (newIds.length > 0) {
      set({ hiddenAssetIds: [...state.hiddenAssetIds, ...newIds] });
      await savePrivacyState(get());
    }
  },

  unhideAssets: async (assetIds: string[]) => {
    const state = get();
    set({ hiddenAssetIds: state.hiddenAssetIds.filter(id => !assetIds.includes(id)) });
    await savePrivacyState(get());
  },

  isHidden: (albumId: string | undefined | null) => {
    if (!albumId) return false;
    return get().hiddenAlbumIds.includes(albumId);
  },

  isAssetHidden: (assetId: string) => {
    return get().hiddenAssetIds.includes(assetId);
  }
}));

async function savePrivacyState(state: PrivacyState) {
  try {
    const data = {
      isAppLockEnabled: state.isAppLockEnabled,
      lockPolicy: state.lockPolicy,
      hiddenAlbumIds: state.hiddenAlbumIds,
      hiddenAssetIds: state.hiddenAssetIds,
    };
    await AsyncStorage.setItem(PRIVACY_STORE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save privacy state', e);
  }
}
