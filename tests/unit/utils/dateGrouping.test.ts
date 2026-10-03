import { groupMediaByDate } from '../../../src/utils/dateGrouping';
import { PixoraMediaInfo } from '../../../src/services/media/mediaTypes';
import * as MediaLibrary from 'expo-media-library/legacy';

describe('groupMediaByDate', () => {
  it('groups media correctly by today and yesterday', () => {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    const media: PixoraMediaInfo[] = [
      {
        id: '1',
        uri: 'file://1',
        filename: '1.jpg',
        mediaType: MediaLibrary.MediaType.photo,
        width: 100,
        height: 100,
        creationTime: now,
        modificationTime: now,
        duration: 0,
      },
      {
        id: '2',
        uri: 'file://2',
        filename: '2.jpg',
        mediaType: MediaLibrary.MediaType.photo,
        width: 100,
        height: 100,
        creationTime: now - oneDayMs,
        modificationTime: now - oneDayMs,
        duration: 0,
      }
    ];

    const grouped = groupMediaByDate(media);
    
    expect(grouped.length).toBe(2);
    expect(grouped[0].title).toBe('Today');
    expect(grouped[0].data[0].id).toBe('1');
    
    expect(grouped[1].title).toBe('Yesterday');
    expect(grouped[1].data[0].id).toBe('2');
  });

  it('handles empty arrays', () => {
    const grouped = groupMediaByDate([]);
    expect(grouped.length).toBe(0);
  });
});
