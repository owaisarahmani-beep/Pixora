import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TRASH_EXPIRY_DAYS = 30;

export interface TrashedItem {
  id: string;
  uri: string;
  filename: string;
  mediaType: 'photo' | 'video';
  width: number;
  height: number;
  creationTime: number;
  duration: number;
  trashedAt: number; // timestamp ms
}

interface TrashState {
  items: TrashedItem[];
  // Move an item to trash (soft-delete - Pixora tracks it)
  moveToTrash: (item: Omit<TrashedItem, 'trashedAt'>) => void;
  // Restore from trash
  restoreItems: (ids: string[]) => void;
  // Permanently delete from trash list (actual file deletion handled by caller)
  permanentlyDelete: (ids: string[]) => void;
  // Remove expired items (> 30 days old)
  purgeExpired: () => string[]; // returns IDs that need actual file deletion
  // Get remaining days
  getDaysRemaining: (trashedAt: number) => number;
}

export const useTrashStore = create<TrashState>()(
  persist(
    (set, get) => ({
      items: [],

      moveToTrash: (item) => {
        set(state => ({
          items: [
            ...state.items.filter(i => i.id !== item.id), // avoid duplicates
            { ...item, trashedAt: Date.now() },
          ],
        }));
      },

      restoreItems: (ids) => {
        set(state => ({
          items: state.items.filter(i => !ids.includes(i.id)),
        }));
      },

      permanentlyDelete: (ids) => {
        set(state => ({
          items: state.items.filter(i => !ids.includes(i.id)),
        }));
      },

      purgeExpired: () => {
        const now = Date.now();
        const expiryMs = TRASH_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
        const expired = get().items.filter(i => now - i.trashedAt > expiryMs);
        if (expired.length > 0) {
          set(state => ({
            items: state.items.filter(i => now - i.trashedAt <= expiryMs),
          }));
        }
        return expired.map(i => i.id);
      },

      getDaysRemaining: (trashedAt) => {
        const elapsed = Date.now() - trashedAt;
        const elapsedDays = elapsed / (24 * 60 * 60 * 1000);
        return Math.max(0, Math.ceil(TRASH_EXPIRY_DAYS - elapsedDays));
      },
    }),
    {
      name: 'pixora-trash',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
