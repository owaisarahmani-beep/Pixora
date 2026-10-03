import * as MediaLibrary from 'expo-media-library/legacy';
import * as MediaLibraryNew from 'expo-media-library';
import { PixoraMediaInfo, MediaPermissionStatus } from './mediaTypes';

const PAGE_SIZE = 50;

class MediaStoreService {
  /**
   * Request permissions and return status.
   */
  async requestPermissionsAsync(): Promise<MediaPermissionStatus> {
    const response = await MediaLibraryNew.requestPermissionsAsync();
    
    if (response.granted) {
      return response.accessPrivileges === 'limited' ? 'LIMITED' : 'GRANTED';
    }
    
    if (response.canAskAgain) {
      return 'UNDETERMINED';
    }
    
    return 'DENIED';
  }

  /**
   * Get permissions without requesting.
   */
  async getPermissionsAsync(): Promise<MediaPermissionStatus> {
    const response = await MediaLibraryNew.getPermissionsAsync();
    
    if (response.granted) {
      return response.accessPrivileges === 'limited' ? 'LIMITED' : 'GRANTED';
    }
    
    return response.canAskAgain ? 'UNDETERMINED' : 'DENIED';
  }

  /**
   * Load a page of media.
   */
  async getMediaAsync(after?: string): Promise<{
    assets: PixoraMediaInfo[];
    hasNextPage: boolean;
    endCursor: string;
  }> {
    const result = await MediaLibrary.getAssetsAsync({
      first: PAGE_SIZE,
      after,
      mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
      sortBy: [MediaLibrary.SortBy.creationTime],
    });

    const assets: PixoraMediaInfo[] = result.assets.map((asset) => ({
      id: asset.id,
      uri: asset.uri,
      filename: asset.filename,
      mediaType: asset.mediaType,
      width: asset.width,
      height: asset.height,
      creationTime: asset.creationTime,
      modificationTime: asset.modificationTime,
      duration: asset.duration,
      albumId: asset.albumId,
    }));

    return {
      assets,
      hasNextPage: result.hasNextPage,
      endCursor: result.endCursor,
    };
  }
  /**
   * Fast aggressive metadata fetch for search indexing.
   */
  async getAllMediaMetadataAsync(): Promise<PixoraMediaInfo[]> {
    let hasNextPage = true;
    let endCursor: string | undefined = undefined;
    const allAssets: PixoraMediaInfo[] = [];
    
    // We fetch in large chunks to index quickly
    while (hasNextPage) {
      const result = await MediaLibrary.getAssetsAsync({
        first: 500,
        after: endCursor,
        mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
        sortBy: [MediaLibrary.SortBy.creationTime],
      });
      
      const mapped = result.assets.map(asset => ({
        id: asset.id,
        uri: asset.uri,
        filename: asset.filename,
        mediaType: asset.mediaType,
        width: asset.width,
        height: asset.height,
        creationTime: asset.creationTime,
        modificationTime: asset.modificationTime,
        duration: asset.duration,
        albumId: asset.albumId,
      }));
      
      allAssets.push(...mapped);
      
      hasNextPage = result.hasNextPage;
      endCursor = result.endCursor;
    }
    
    return allAssets;
  }

  async getAlbumsAsync() {
    return await MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true });
  }

  async getAssetsByIdsAsync(ids: string[]): Promise<PixoraMediaInfo[]> {
    const assets = await Promise.all(
      ids.map(id => MediaLibrary.getAssetInfoAsync(id).catch(() => null))
    );

    return assets
      .filter((a): a is MediaLibrary.AssetInfo => a !== null)
      .map(asset => ({
        id: asset.id,
        uri: asset.localUri || asset.uri,
        filename: asset.filename,
        mediaType: asset.mediaType,
        width: asset.width,
        height: asset.height,
        creationTime: asset.creationTime,
        modificationTime: asset.modificationTime,
        duration: asset.duration,
        albumId: asset.albumId,
      }));
  }

  async getAlbumAssetsAsync(albumId: string, after?: string | MediaLibrary.AssetRef) {
    const result = await MediaLibrary.getAssetsAsync({
      album: albumId,
      after: after as any,
      first: 100,
      sortBy: [MediaLibrary.SortBy.creationTime],
      mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video]
    });

    const mapped = result.assets.map(asset => ({
      id: asset.id,
      uri: asset.uri,
      filename: asset.filename,
      mediaType: asset.mediaType,
      width: asset.width,
      height: asset.height,
      creationTime: asset.creationTime,
      modificationTime: asset.modificationTime,
      duration: asset.duration,
      albumId: asset.albumId,
    }));

    return { assets: mapped, hasNextPage: result.hasNextPage, endCursor: result.endCursor };
  }

  async getAlbumCoverAsync(albumId: string): Promise<string | null> {
    try {
      const result = await MediaLibrary.getAssetsAsync({
        album: albumId,
        first: 1,
        sortBy: [MediaLibrary.SortBy.creationTime]
      });
      if (result.assets.length > 0) {
        return result.assets[0].uri;
      }
    } catch {
      // Ignore gracefully
    }
    return null;
  }

  async exportImageToMediaStoreAsync(localUri: string): Promise<PixoraMediaInfo | null> {
    try {
      const asset = await MediaLibrary.createAssetAsync(localUri);
      
      const assetInfo = await MediaLibrary.getAssetInfoAsync(asset.id);
      
      return {
        id: assetInfo.id,
        uri: assetInfo.localUri || assetInfo.uri,
        filename: assetInfo.filename,
        mediaType: assetInfo.mediaType,
        width: assetInfo.width,
        height: assetInfo.height,
        creationTime: assetInfo.creationTime,
        modificationTime: assetInfo.modificationTime,
        duration: assetInfo.duration,
        albumId: assetInfo.albumId,
      };
    } catch (e) {
      console.error('Failed to export image to MediaStore', e);
      return null;
    }
  }
}

export const mediaStoreService = new MediaStoreService();
