import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { mediaStoreService } from '../services/media/MediaStoreService';
import { PixoraMediaInfo, MediaGroup } from '../services/media/mediaTypes';
import { groupMediaByDate } from '../utils/dateGrouping';

interface FavoritesState {
  favorites: Set<string>;
  favoritesMedia: PixoraMediaInfo[];
  groupedFavorites: MediaGroup[];
  isLoading: boolean;
  isHydrated: boolean;
  
  toggleFavorite: (id: string, item?: PixoraMediaInfo) => void;
  loadFavorites: () => Promise<void>;
  setHydrated: (state: boolean) => void;
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      favorites: new Set<string>(),
      favoritesMedia: [],
      groupedFavorites: [],
      isLoading: false,
      isHydrated: false,

      setHydrated: (state) => set({ isHydrated: state }),

      toggleFavorite: (id: string, item?: PixoraMediaInfo) => {
        const state = get();
        const newFavorites = new Set(state.favorites);
        
        if (newFavorites.has(id)) {
          newFavorites.delete(id);
          
          const newMedia = state.favoritesMedia.filter(m => m.id !== id);
          set({
            favorites: newFavorites,
            favoritesMedia: newMedia,
            groupedFavorites: groupMediaByDate(newMedia)
          });
        } else {
          newFavorites.add(id);
          
          if (item) {
            // Immediately populate UI without a native re-fetch
            const newMedia = [item, ...state.favoritesMedia];
            newMedia.sort((a, b) => b.creationTime - a.creationTime);
            set({
              favorites: newFavorites,
              favoritesMedia: newMedia,
              groupedFavorites: groupMediaByDate(newMedia)
            });
          } else {
            set({ favorites: newFavorites });
            get().loadFavorites();
          }
        }
      },

      loadFavorites: async () => {
        const { favorites } = get();
        const favoriteIds = Array.from(favorites);
        
        if (favoriteIds.length === 0) {
          set({ favoritesMedia: [], groupedFavorites: [], isLoading: false });
          return;
        }

        set({ isLoading: true });
        
        try {
          const assets = await mediaStoreService.getAssetsByIdsAsync(favoriteIds);
          // Prioritize by creationTime descending (newest first)
          assets.sort((a, b) => b.creationTime - a.creationTime);
          
          set({ 
            favoritesMedia: assets,
            groupedFavorites: groupMediaByDate(assets),
            isLoading: false
          });
        } catch (e) {
          console.error('Failed to load favorites', e);
          set({ isLoading: false });
        }
      },
    }),
    {
      name: 'pixora-favorites-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ 
        favorites: Array.from(state.favorites) 
      } as unknown as Partial<FavoritesState>),
      merge: (persistedState: any, currentState) => ({
        ...currentState,
        favorites: new Set(persistedState?.favorites || []),
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setHydrated(true);
        }
      }
    }
  )
);
