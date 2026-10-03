import * as MediaLibrary from 'expo-media-library/legacy';

export type PixoraMediaInfo = {
  id: string;
  uri: string;
  filename: string;
  mediaType: MediaLibrary.MediaTypeValue;
  width: number;
  height: number;
  creationTime: number;
  modificationTime: number;
  duration: number; // for videos
  albumId?: string;
};

export type MediaGroup = {
  title: string;
  data: PixoraMediaInfo[];
};

export type MediaPermissionStatus = 
  | 'UNDETERMINED'
  | 'GRANTED'
  | 'DENIED'
  | 'LIMITED';
