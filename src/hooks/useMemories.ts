import { useMemo } from 'react';
import { PixoraMediaInfo } from '../services/media/mediaTypes';

export interface Memory {
  id: string;
  title: string;
  subtitle: string;
  coverAsset: PixoraMediaInfo;
  assets: PixoraMediaInfo[];
}

export function useMemories(allMedia: PixoraMediaInfo[]): Memory[] {
  return useMemo(() => {
    const memories: Memory[] = [];
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentDay = now.getDate();
    const currentYear = now.getFullYear();

    // 1. "On This Day" (Past Years)
    const onThisDay = allMedia.filter(m => {
      const d = new Date(m.creationTime);
      return d.getMonth() === currentMonth && d.getDate() === currentDay && d.getFullYear() < currentYear;
    });

    if (onThisDay.length > 0) {
      // Group by year
      const byYear = onThisDay.reduce((acc, m) => {
        const y = new Date(m.creationTime).getFullYear();
        if (!acc[y]) acc[y] = [];
        acc[y].push(m);
        return acc;
      }, {} as Record<number, PixoraMediaInfo[]>);

      Object.entries(byYear).forEach(([yearStr, assets]) => {
        const year = parseInt(yearStr, 10);
        const yearsAgo = currentYear - year;
        memories.push({
          id: `on-this-day-${year}`,
          title: 'On This Day',
          subtitle: `${yearsAgo} year${yearsAgo > 1 ? 's' : ''} ago`,
          coverAsset: assets[Math.floor(Math.random() * assets.length)],
          assets,
        });
      });
    }

    // 2. "Recent Highlights" (If we don't have many past memories, show something from 1-3 months ago)
    if (memories.length === 0 && allMedia.length > 10) {
      const oneMonthAgo = new Date(now);
      oneMonthAgo.setMonth(now.getMonth() - 1);
      
      const highlights = allMedia.filter(m => {
        const d = new Date(m.creationTime);
        return d.getMonth() === oneMonthAgo.getMonth() && d.getFullYear() === oneMonthAgo.getFullYear();
      });

      if (highlights.length > 5) {
        memories.push({
          id: 'recent-highlights',
          title: 'Recent Highlights',
          subtitle: oneMonthAgo.toLocaleString('default', { month: 'long', year: 'numeric' }),
          coverAsset: highlights[0], // newest from that month
          assets: highlights,
        });
      }
    }

    return memories.slice(0, 5); // Limit to top 5 memories
  }, [allMedia]);
}
