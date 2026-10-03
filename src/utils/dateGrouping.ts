import { format, isToday, isYesterday, isThisYear } from 'date-fns';
import { PixoraMediaInfo, MediaGroup } from '../services/media/mediaTypes';

export function groupMediaByDate(media: PixoraMediaInfo[]): MediaGroup[] {
  const groups: Record<string, PixoraMediaInfo[]> = {};

  for (const item of media) {
    const date = new Date(item.creationTime);
    let title = '';

    if (isToday(date)) {
      title = 'Today';
    } else if (isYesterday(date)) {
      title = 'Yesterday';
    } else if (isThisYear(date)) {
      // E.g., September 12
      title = format(date, 'MMMM d');
    } else {
      // E.g., September 2026
      title = format(date, 'MMMM yyyy');
    }

    if (!groups[title]) {
      groups[title] = [];
    }
    groups[title].push(item);
  }

  // Convert to array
  return Object.keys(groups).map((title) => ({
    title,
    data: groups[title],
  }));
}
