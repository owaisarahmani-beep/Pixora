import { format, isToday, isYesterday, isThisYear } from 'date-fns';
import { PixoraMediaInfo, MediaGroup } from '../services/media/mediaTypes';

/**
 * Normalizes timestamps across different device platforms and media providers.
 * Handles:
 * - 10-digit Unix timestamps (seconds) -> converts to 13-digit milliseconds
 * - 16-digit microsecond timestamps -> converts to milliseconds
 * - Corrupted (<= 0, NaN, or post-2100) timestamps -> falls back safely to current time
 */
export function normalizeTimestamp(ts: number | undefined | null, fallback: number = 0): number {
  if (!ts || isNaN(ts) || ts <= 0) return fallback;
  // Unix timestamp in seconds (e.g. 1729584000 < 100_000_000_000)
  if (ts < 100_000_000_000) {
    return ts * 1000;
  }
  // Microsecond timestamp (e.g. 1729584000000000 > 10_000_000_000_000)
  if (ts > 10_000_000_000_000) {
    return Math.floor(ts / 1000);
  }
  // Corrupted future timestamp (after year 2100 ~ 4102444800000)
  if (ts > 4102444800000) {
    return fallback;
  }
  return ts;
}

/**
 * Resolves the canonical timestamp for chronological sorting and month grouping.
 * Follows the strict policy:
 * - Genuine creation/capture time is prioritized when valid (> 0 and <= year 2100).
 * - Falls back to modificationTime if creationTime is missing or invalid.
 * - Safely normalizes 10-digit second timestamps and 16-digit microsecond timestamps to 13-digit ms.
 * - Falls back safely to Date.now() if both are missing/corrupted.
 */
export function getMediaEffectiveTimestamp(item: { creationTime?: number | null; modificationTime?: number | null }): number {
  let rawTs = item.creationTime;
  if (!rawTs || isNaN(rawTs) || rawTs <= 0 || rawTs > 4102444800000) {
    rawTs = item.modificationTime;
  }
  if (!rawTs || isNaN(rawTs) || rawTs <= 0 || rawTs > 4102444800000) {
    rawTs = Date.now();
  }
  return normalizeTimestamp(rawTs, Date.now()) || Date.now();
}

export function groupMediaByDate(media: PixoraMediaInfo[]): MediaGroup[] {
  const groups: Record<string, PixoraMediaInfo[]> = {};
  const seenIds = new Set<string>();

  for (const item of media) {
    const strId = String(item.id);
    if (seenIds.has(strId)) {
      continue;
    }
    seenIds.add(strId);

    const ts = getMediaEffectiveTimestamp(item);
    const date = new Date(ts);
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
