import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { appLockService } from '../services/privacy/AppLockService';

export type LockPolicy = 'immediate' | 'inactivity';

interface PrivacyState {
  // Global Settings
  isAppLockEnabled: boolean;
  lockPolicy: LockPolicy;
  
  // Persistent Storage Arrays
  hiddenAlbumIds: string[];
  hiddenAssetIds: string[];
  privateAssetIds: string[];
  lockedAlbumIds: string[];
  archivedAssetIds: string[];
  
  // Ephemeral state
  isUnlocked: boolean; // Global App Lock session
  isCapabilityChecked: boolean;
  isSupportedOnDevice: boolean;
  
  // Auth Sessions
  isVaultUnlocked: boolean;
  unlockedAlbums: string[];

  // Actions
  initialize: () => Promise<void>;
  enableAppLock: (policy: LockPolicy) => Promise<boolean>;
  disableAppLock: () => Promise<boolean>;
  setLockPolicy: (policy: LockPolicy) => Promise<void>;
  
  // Ephemeral Actions
  lock: () => void;
  unlock: () => Promise<boolean>;
  
  // Auth Session Methods
  unlockVault: () => Promise<boolean>;
  lockVault: () => void;
  unlockAlbum: (albumId: string) => Promise<boolean>;
  lockAlbum: (albumId: string) => void;
  clearAllSessions: () => void;

  // Modifiers
  hideAlbum: (albumId: string) => Promise<void>;
  unhideAlbum: (albumId: string) => Promise<void>;
  
  hideAssets: (assetIds: string[]) => Promise<void>;
  unhideAssets: (assetIds: string[]) => Promise<void>;
  
  makeAssetsPrivate: (assetIds: string[]) => Promise<void>;
  removeAssetsFromPrivate: (assetIds: string[]) => Promise<void>;

  lockAlbumContent: (albumId: string) => Promise<void>;
  unlockAlbumContent: (albumId: string) => Promise<void>;
  
  archiveAssets: (assetIds: string[]) => Promise<void>;
  unarchiveAssets: (assetIds: string[]) => Promise<void>;

  // Selectors
  isHidden: (albumId: string | undefined | null) => boolean;
  isAssetHidden: (assetId: string) => boolean;
  isAssetPrivate: (assetId: string) => boolean;
  isAlbumLocked: (albumId: string | undefined | null) => boolean;
  isAssetArchived: (assetId: string) => boolean;
}

const PRIVACY_STORE_KEY = '@pixora_privacy_store_v2';

export const usePrivacyStore = create<PrivacyState>((set, get) => ({
  isAppLockEnabled: false,
  lockPolicy: 'immediate',
  
  hiddenAlbumIds: [],
  hiddenAssetIds: [],
  privateAssetIds: [],
  lockedAlbumIds: [],
  archivedAssetIds: [],
  
  isUnlocked: false,
  isCapabilityChecked: false,
  isSupportedOnDevice: false,
  
  isVaultUnlocked: false,
  unlockedAlbums: [],

  initialize: async () => {
    try {
      const capability = await appLockService.checkCapabilityAsync();
      const storedStr = await AsyncStorage.getItem(PRIVACY_STORE_KEY);
      
      let isAppLockEnabled = false;
      let lockPolicy: LockPolicy = 'immediate';
      let hiddenAlbumIds: string[] = [];
      let hiddenAssetIds: string[] = [];
      let privateAssetIds: string[] = [];
      let lockedAlbumIds: string[] = [];
      let archivedAssetIds: string[] = [];

      if (storedStr) {
        const parsed = JSON.parse(storedStr);
        isAppLockEnabled = capability.isAvailable ? Boolean(parsed.isAppLockEnabled) : false;
        lockPolicy = parsed.lockPolicy === 'inactivity' ? 'inactivity' : 'immediate';
        hiddenAlbumIds = Array.isArray(parsed.hiddenAlbumIds) ? parsed.hiddenAlbumIds : [];
        hiddenAssetIds = Array.isArray(parsed.hiddenAssetIds) ? parsed.hiddenAssetIds : [];
        privateAssetIds = Array.isArray(parsed.privateAssetIds) ? parsed.privateAssetIds : [];
        lockedAlbumIds = Array.isArray(parsed.lockedAlbumIds) ? parsed.lockedAlbumIds : [];
        archivedAssetIds = Array.isArray(parsed.archivedAssetIds) ? parsed.archivedAssetIds : [];
      } else {
        // Migration from v1
        const legacyStr = await AsyncStorage.getItem('@pixora_privacy_store_v1');
        if (legacyStr) {
           const legacyParsed = JSON.parse(legacyStr);
           isAppLockEnabled = capability.isAvailable ? Boolean(legacyParsed.isAppLockEnabled) : false;
           lockPolicy = legacyParsed.lockPolicy === 'inactivity' ? 'inactivity' : 'immediate';
           hiddenAlbumIds = Array.isArray(legacyParsed.hiddenAlbumIds) ? legacyParsed.hiddenAlbumIds : [];
           hiddenAssetIds = Array.isArray(legacyParsed.hiddenAssetIds) ? legacyParsed.hiddenAssetIds : [];
           // Save migrated data immediately
           await AsyncStorage.setItem(PRIVACY_STORE_KEY, JSON.stringify({
             isAppLockEnabled, lockPolicy, hiddenAlbumIds, hiddenAssetIds, privateAssetIds, lockedAlbumIds, archivedAssetIds
           }));
        }
      }

      set({
        isAppLockEnabled,
        lockPolicy,
        hiddenAlbumIds,
        hiddenAssetIds,
        privateAssetIds,
        lockedAlbumIds,
        archivedAssetIds,
        isSupportedOnDevice: capability.isAvailable,
        isCapabilityChecked: true,
        isUnlocked: !isAppLockEnabled,
      });
    } catch (e) {
      console.error('Failed to initialize privacy store', e);
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
    get().clearAllSessions();
  },

  unlock: async () => {
    if (!get().isAppLockEnabled) return true;
    const success = await appLockService.authenticateAsync('Unlock Pixora');
    if (success) {
      set({ isUnlocked: true });
    }
    return success;
  },

  unlockVault: async () => {
    const success = await appLockService.authenticateAsync('Unlock Private Vault');
    if (success) set({ isVaultUnlocked: true });
    return success;
  },

  lockVault: () => set({ isVaultUnlocked: false }),

  unlockAlbum: async (albumId: string) => {
    const success = await appLockService.authenticateAsync('Unlock Album');
    if (success) {
      set(state => ({ unlockedAlbums: [...state.unlockedAlbums.filter(id => id !== albumId), albumId] }));
    }
    return success;
  },

  lockAlbum: (albumId: string) => set(state => ({ unlockedAlbums: state.unlockedAlbums.filter(id => id !== albumId) })),

  clearAllSessions: () => set({ isVaultUnlocked: false, unlockedAlbums: [] }),

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

  makeAssetsPrivate: async (assetIds: string[]) => {
    const state = get();
    const newIds = assetIds.filter(id => !state.privateAssetIds.includes(id));
    if (newIds.length > 0) {
      set({ privateAssetIds: [...state.privateAssetIds, ...newIds] });
      await savePrivacyState(get());
    }
  },

  removeAssetsFromPrivate: async (assetIds: string[]) => {
    const state = get();
    set({ privateAssetIds: state.privateAssetIds.filter(id => !assetIds.includes(id)) });
    await savePrivacyState(get());
  },

  lockAlbumContent: async (albumId: string) => {
    const state = get();
    if (!state.lockedAlbumIds.includes(albumId)) {
      set({ lockedAlbumIds: [...state.lockedAlbumIds, albumId] });
      await savePrivacyState(get());
    }
  },

  unlockAlbumContent: async (albumId: string) => {
    const state = get();
    set({ lockedAlbumIds: state.lockedAlbumIds.filter(id => id !== albumId) });
    await savePrivacyState(get());
  },

  archiveAssets: async (assetIds: string[]) => {
    const state = get();
    const newIds = assetIds.filter(id => !state.archivedAssetIds.includes(id));
    if (newIds.length > 0) {
      set({ archivedAssetIds: [...state.archivedAssetIds, ...newIds] });
      await savePrivacyState(get());
    }
  },

  unarchiveAssets: async (assetIds: string[]) => {
    const state = get();
    set({ archivedAssetIds: state.archivedAssetIds.filter(id => !assetIds.includes(id)) });
    await savePrivacyState(get());
  },

  isHidden: (albumId: string | undefined | null) => {
    if (!albumId) return false;
    return get().hiddenAlbumIds.includes(albumId);
  },

  isAssetHidden: (assetId: string) => get().hiddenAssetIds.includes(assetId),
  isAssetPrivate: (assetId: string) => get().privateAssetIds.includes(assetId),
  isAlbumLocked: (albumId: string | undefined | null) => {
    if (!albumId) return false;
    return get().lockedAlbumIds.includes(albumId);
  },
  isAssetArchived: (assetId: string) => get().archivedAssetIds.includes(assetId),
}));

async function savePrivacyState(state: PrivacyState) {
  try {
    const data = {
      isAppLockEnabled: state.isAppLockEnabled,
      lockPolicy: state.lockPolicy,
      hiddenAlbumIds: state.hiddenAlbumIds,
      hiddenAssetIds: state.hiddenAssetIds,
      privateAssetIds: state.privateAssetIds,
      lockedAlbumIds: state.lockedAlbumIds,
      archivedAssetIds: state.archivedAssetIds,
    };
    await AsyncStorage.setItem(PRIVACY_STORE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save privacy state', e);
  }
}
