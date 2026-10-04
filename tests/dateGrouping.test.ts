import { groupMediaByDate } from '../src/utils/dateGrouping';
import { PixoraMediaInfo } from '../src/services/media/mediaTypes';
import { format, isToday, isYesterday, isThisYear, subDays } from 'date-fns';

describe('groupMediaByDate', () => {
  const createMedia = (id: string, creationTime: number, modificationTime: number = Date.now()): PixoraMediaInfo => ({
    id,
    uri: 'file://test',
    filename: 'test.jpg',
    mediaType: 'photo',
    width: 100,
    height: 100,
    creationTime,
    modificationTime,
    duration: 0
  });

  it('groups valid timestamps correctly', () => {
    const today = Date.now();
    const media = [
      createMedia('1', today),
      createMedia('2', today - 86400000), // yesterday
    ];
    const groups = groupMediaByDate(media);
    
    expect(groups.length).toBe(2);
    expect(groups[0].title).toBe('Today');
    expect(groups[1].title).toBe('Yesterday');
  });

  it('handles negative timestamps (before 1970) by using modificationTime', () => {
    const negativeTime = -1000000; // 1969
    const validModTime = Date.now() - 86400000; // yesterday
    const media = [createMedia('1', negativeTime, validModTime)];
    
    const groups = groupMediaByDate(media);
    expect(groups[0].title).toBe('Yesterday');
  });

  it('handles zero timestamp (exactly Jan 1 1970) by using modificationTime', () => {
    const zeroTime = 0;
    const validModTime = Date.now() - 86400000; // yesterday
    const media = [createMedia('1', zeroTime, validModTime)];
    
    const groups = groupMediaByDate(media);
    expect(groups[0].title).toBe('Yesterday');
  });

  it('handles timestamps too far in the future by using modificationTime', () => {
    const futureTime = 4200000000000; // past 2100
    const validModTime = Date.now(); // today
    const media = [createMedia('1', futureTime, validModTime)];
    
    const groups = groupMediaByDate(media);
    expect(groups[0].title).toBe('Today');
  });

  it('falls back to Date.now() if both creation and modification times are corrupt', () => {
    const media = [createMedia('1', 0, 0)];
    
    const groups = groupMediaByDate(media);
    expect(groups[0].title).toBe('Today');
  });
});
