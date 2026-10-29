import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PixoraMediaInfo } from '../services/media/mediaTypes';

const TRASH_EXPIRY_DAYS = 30;

export interface TrashedItem {
  id: string;
  uri: string;
  filename: string;
  mediaType: 'photo' | 'video';
  width: number;
  height: number;
  creationTime: number;
  modificationTime?: number;
  duration: number;
  trashedAt: number; // timestamp ms
  albumId?: string;
}

interface TrashState {
  items: TrashedItem[];
  permanentlyDeletedIds: string[];
  permanentlyDeletedUris: string[];
  restoredTimestamps: Record<string, number>;
  restoredItems: PixoraMediaInfo[];
  // Move an item to trash (soft-delete - Pixora tracks it)
  moveToTrash: (item: Omit<TrashedItem, 'trashedAt'>) => void;
  // Batch move items to trash atomically
  batchMoveToTrash: (items: Omit<TrashedItem, 'trashedAt'>[]) => void;
  // Restore from trash
  restoreItems: (ids: string[]) => void;
  // Explicitly record or preserve restored timestamps
  recordRestoredTimestamps: (entries: { id: string; uri?: string; creationTime: number }[]) => void;
  // Get preserved genuine timestamp for restored item by ID or URI
  getPreservedTimestamp: (id: string, uri?: string) => number | undefined;
  // Permanently delete from trash list (actual file deletion handled by caller)
  permanentlyDelete: (ids: string[], uris?: string[]) => void;
  // Remove expired items (> 30 days old)
  purgeExpired: () => string[]; // returns IDs that need actual file deletion
  // Get remaining days
  getDaysRemaining: (trashedAt: number) => number;
  // Register enriched restored items with stable identity (ID/URI)
  registerRestoredItems: (items: PixoraMediaInfo[]) => void;
  // Check if an asset is soft-deleted or permanently deleted by ID or URI
  isDeleted: (id: string, uri?: string) => boolean;
}

export const useTrashStore = create<TrashState>()(
  persist(
    (set, get) => ({
      items: [],
      permanentlyDeletedIds: [],
      permanentlyDeletedUris: [],
      restoredTimestamps: {},
      restoredItems: [],

      moveToTrash: (item) => {
        const strId = String(item.id);
        set(state => {
          const nextRestoredTimestamps = { ...state.restoredTimestamps };
          delete nextRestoredTimestamps[strId];
          if (item.uri) delete nextRestoredTimestamps[item.uri];

          return {
            items: [
              ...state.items.filter(i => String(i.id) !== strId && (!item.uri || i.uri !== item.uri)), // avoid duplicates
              { ...item, id: strId, trashedAt: Date.now() },
            ],
            restoredItems: (state.restoredItems || []).filter(
              r => String(r.id) !== strId && (!item.uri || r.uri !== item.uri)
            ),
            restoredTimestamps: nextRestoredTimestamps,
          };
        });
      },

      batchMoveToTrash: (newItems) => {
        if (!newItems || newItems.length === 0) return;
        const now = Date.now();
        const incomingMap = new Map<string, TrashedItem>();
        for (const item of newItems) {
          incomingMap.set(String(item.id), { ...item, id: String(item.id), trashedAt: now });
        }
        set(state => {
          const nextRestoredTimestamps = { ...state.restoredTimestamps };
          for (const item of newItems) {
            delete nextRestoredTimestamps[String(item.id)];
            if (item.uri) delete nextRestoredTimestamps[item.uri];
          }
          const incomingIds = new Set(newItems.map(i => String(i.id)));
          const incomingUris = new Set(newItems.map(i => i.uri).filter(Boolean));

          const remainingItems = state.items.filter(
            i => !incomingIds.has(String(i.id)) && (!i.uri || !incomingUris.has(i.uri))
          );
          const remainingRestored = (state.restoredItems || []).filter(
            r => !incomingIds.has(String(r.id)) && (!r.uri || !incomingUris.has(r.uri))
          );

          return {
            items: [...remainingItems, ...Array.from(incomingMap.values())],
            restoredItems: remainingRestored,
            restoredTimestamps: nextRestoredTimestamps,
          };
        });
      },

      restoreItems: (ids) => {
        const idSet = new Set(ids.map(id => String(id)));
        const itemsToRestore = get().items.filter(i => idSet.has(String(i.id)));
        const restoredUris = new Set(
          itemsToRestore.map(i => i.uri).filter(Boolean)
        );

        // Convert TrashedItem to PixoraMediaInfo baseline
        const newlyRestored: PixoraMediaInfo[] = itemsToRestore.map(item => ({
          id: String(item.id),
          uri: item.uri,
          filename: item.filename,
          mediaType: item.mediaType,
          width: item.width,
          height: item.height,
          creationTime: item.creationTime,
          modificationTime: item.modificationTime || item.creationTime,
          duration: item.duration,
        }));

        // Preserve genuine creation timestamps of restored media so subsequent
        // MediaStore queries and refreshes never overwrite historical dates.
        const updatedTimestamps = { ...get().restoredTimestamps };
        for (const item of itemsToRestore) {
          if (item.creationTime && item.creationTime > 0) {
            updatedTimestamps[String(item.id)] = item.creationTime;
            if (item.uri) {
              updatedTimestamps[item.uri] = item.creationTime;
            }
          }
        }

        // Merge into persistent restoredItems registry
        const existingRestored = get().restoredItems || [];
        const restoredMap = new Map<string, PixoraMediaInfo>();
        for (const r of existingRestored) {
          restoredMap.set(String(r.id), r);
        }
        for (const nr of newlyRestored) {
          restoredMap.set(String(nr.id), nr);
        }

        // Legitimate restoration explicitly clears active trash and any prior tombstone for these specific assets
        set(state => ({
          items: state.items.filter(i => !idSet.has(String(i.id))),
          permanentlyDeletedIds: state.permanentlyDeletedIds.filter(id => !idSet.has(String(id))),
          permanentlyDeletedUris: state.permanentlyDeletedUris.filter(uri => !restoredUris.has(uri)),
          restoredTimestamps: updatedTimestamps,
          restoredItems: Array.from(restoredMap.values()),
        }));
      },

      registerRestoredItems: (items) => {
        set(state => {
          const updatedTimestamps = { ...state.restoredTimestamps };
          const restoredMap = new Map<string, PixoraMediaInfo>();
          for (const r of state.restoredItems || []) {
            restoredMap.set(String(r.id), r);
          }

          for (const item of items) {
            const strId = String(item.id);
            const existing = restoredMap.get(strId);
            const merged: PixoraMediaInfo = existing ? { ...existing, ...item } : item;
            restoredMap.set(strId, merged);

            const genuineTime = merged.creationTime || existing?.creationTime || item.creationTime;
            if (genuineTime && genuineTime > 0) {
              updatedTimestamps[strId] = genuineTime;
              if (merged.uri) {
                updatedTimestamps[merged.uri] = genuineTime;
              }
            }
          }

          return {
            restoredItems: Array.from(restoredMap.values()),
            restoredTimestamps: updatedTimestamps,
          };
        });
      },

      recordRestoredTimestamps: (entries) => {
        set(state => {
          const next = { ...state.restoredTimestamps };
          for (const entry of entries) {
            if (entry.creationTime && entry.creationTime > 0) {
              next[String(entry.id)] = entry.creationTime;
              if (entry.uri) {
                next[entry.uri] = entry.creationTime;
              }
            }
          }
          return { restoredTimestamps: next };
        });
      },

      getPreservedTimestamp: (id, uri) => {
        const { restoredTimestamps, restoredItems } = get();
        const strId = String(id);
        if (restoredTimestamps) {
          if (restoredTimestamps[strId] && restoredTimestamps[strId] > 0) {
            return restoredTimestamps[strId];
          }
          if (uri && restoredTimestamps[uri] && restoredTimestamps[uri] > 0) {
            return restoredTimestamps[uri];
          }
        }
        if (restoredItems && restoredItems.length > 0) {
          const found = restoredItems.find(
            r => String(r.id) === strId || (uri && r.uri === uri)
          );
          if (found && found.creationTime > 0) {
            return found.creationTime;
          }
        }
        return undefined;
      },

      permanentlyDelete: (ids, uris = []) => {
        const idSet = new Set(ids.map(id => String(id)));
        const uriSet = new Set(uris.filter(Boolean));
        set(state => {
          const newDeletedIds = new Set(state.permanentlyDeletedIds);
          const newDeletedUris = new Set(state.permanentlyDeletedUris);
          ids.forEach(id => newDeletedIds.add(String(id)));
          uris.forEach(uri => {
            if (uri) newDeletedUris.add(uri);
          });

          const nextRestored = { ...state.restoredTimestamps };
          for (const id of ids) delete nextRestored[String(id)];
          for (const uri of uris) if (uri) delete nextRestored[uri];

          const nextRestoredItems = (state.restoredItems || []).filter(
            r => !idSet.has(String(r.id)) && (!r.uri || !uriSet.has(r.uri))
          );

          return {
            items: state.items.filter(i => !idSet.has(String(i.id)) && (!i.uri || !uriSet.has(i.uri))),
            permanentlyDeletedIds: Array.from(newDeletedIds),
            permanentlyDeletedUris: Array.from(newDeletedUris),
            restoredTimestamps: nextRestored,
            restoredItems: nextRestoredItems,
          };
        });
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
        return expired.map(i => String(i.id));
      },

      getDaysRemaining: (trashedAt) => {
        const elapsed = Date.now() - trashedAt;
        const elapsedDays = elapsed / (24 * 60 * 60 * 1000);
        return Math.max(0, Math.ceil(TRASH_EXPIRY_DAYS - elapsedDays));
      },

      isDeleted: (id: string, uri?: string) => {
        const strId = String(id);
        const { items, permanentlyDeletedIds, permanentlyDeletedUris } = get();

        // 1. Authoritative active Trash check: soft-deleted items are always hidden from public views
        if (items.some(i => String(i.id) === strId || (uri && i.uri && i.uri === uri))) {
          return true;
        }

        // 2. Authoritative permanent deletion tombstones: permanently deleted items can NEVER reappear
        if (permanentlyDeletedIds.includes(strId)) {
          return true;
        }
        if (uri && permanentlyDeletedUris.includes(uri)) {
          return true;
        }

        return false;
      },
    }),
    {
      name: 'pixora-trash',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

/**
 * Ensures trash store is fully hydrated from AsyncStorage before any query or mutation runs.
 */
export async function ensureTrashHydrated(): Promise<void> {
  if (useTrashStore.persist && !useTrashStore.persist.hasHydrated()) {
    await useTrashStore.persist.rehydrate();
  }
}
