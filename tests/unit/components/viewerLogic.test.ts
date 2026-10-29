describe('Viewer Logic', () => {
  const getInitialIndex = (media: { id: string }[], id: string) => {
    const idx = media.findIndex(m => m.id === id);
    return idx >= 0 ? idx : 0;
  };

  const shouldFetchMore = (currentIndex: number, totalLength: number, hasNextPage: boolean) => {
    return currentIndex >= totalLength - 10 && hasNextPage;
  };

  it('resolves initial index correctly', () => {
    const mockMedia = [{ id: '1' }, { id: '2' }, { id: '3' }];
    expect(getInitialIndex(mockMedia, '2')).toBe(1);
    expect(getInitialIndex(mockMedia, '3')).toBe(2);
    // Fallback to 0 if not found
    expect(getInitialIndex(mockMedia, '4')).toBe(0);
  });

  it('calculates pagination boundary correctly', () => {
    // 100 items, at index 89, has next page -> false
    expect(shouldFetchMore(89, 100, true)).toBe(false);
    
    // 100 items, at index 90 (which is 10 from the end) -> true
    expect(shouldFetchMore(90, 100, true)).toBe(true);
    
    // 100 items, at index 95 -> true
    expect(shouldFetchMore(95, 100, true)).toBe(true);

    // 100 items, at index 95, but NO next page -> false
    expect(shouldFetchMore(95, 100, false)).toBe(false);
  });

  const formatVideoTime = (totalSeconds: number): string => {
    if (!totalSeconds || isNaN(totalSeconds) || totalSeconds < 0) return '0:00';
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  it('formats video time elapsed and duration accurately', () => {
    expect(formatVideoTime(0)).toBe('0:00');
    expect(formatVideoTime(-5)).toBe('0:00');
    expect(formatVideoTime(NaN)).toBe('0:00');
    expect(formatVideoTime(4)).toBe('0:04');
    expect(formatVideoTime(59)).toBe('0:59');
    expect(formatVideoTime(60)).toBe('1:00');
    expect(formatVideoTime(75)).toBe('1:15');
    expect(formatVideoTime(625)).toBe('10:25');
  });

  describe('Viewer Advance on Media Removal', () => {
    interface Item {
      id: string;
      title: string;
    }

    const resolveNextTargetOnDelete = (
      collection: Item[],
      targetId: string
    ): { nextTargetId: string | null; shouldDismiss: boolean } => {
      if (collection.length <= 1) {
        return { nextTargetId: null, shouldDismiss: true };
      }
      const currIdx = collection.findIndex((m) => m.id === targetId);
      if (currIdx < 0) {
        return { nextTargetId: null, shouldDismiss: false };
      }
      if (currIdx + 1 < collection.length) {
        return { nextTargetId: collection[currIdx + 1].id, shouldDismiss: false };
      }
      if (currIdx > 0) {
        return { nextTargetId: collection[currIdx - 1].id, shouldDismiss: false };
      }
      return { nextTargetId: null, shouldDismiss: true };
    };

    const getNewIndexForTarget = (
      remainingCollection: Item[],
      nextTargetId: string
    ): number => {
      const idx = remainingCollection.findIndex((m) => m.id === nextTargetId);
      return Math.max(0, Math.min(idx >= 0 ? idx : 0, remainingCollection.length - 1));
    };

    it('advances forward when first item is deleted', () => {
      const collection = [{ id: '1', title: 'A' }, { id: '2', title: 'B' }, { id: '3', title: 'C' }];
      const res = resolveNextTargetOnDelete(collection, '1');
      expect(res.shouldDismiss).toBe(false);
      expect(res.nextTargetId).toBe('2');

      const remaining = collection.filter((m) => m.id !== '1');
      expect(getNewIndexForTarget(remaining, res.nextTargetId!)).toBe(0);
      expect(remaining[0].id).toBe('2');
    });

    it('advances forward when middle item is deleted', () => {
      const collection = [{ id: '1', title: 'A' }, { id: '2', title: 'B' }, { id: '3', title: 'C' }];
      const res = resolveNextTargetOnDelete(collection, '2');
      expect(res.shouldDismiss).toBe(false);
      expect(res.nextTargetId).toBe('3');

      const remaining = collection.filter((m) => m.id !== '2');
      expect(getNewIndexForTarget(remaining, res.nextTargetId!)).toBe(1);
      expect(remaining[1].id).toBe('3');
    });

    it('advances backward when last item is deleted', () => {
      const collection = [{ id: '1', title: 'A' }, { id: '2', title: 'B' }, { id: '3', title: 'C' }];
      const res = resolveNextTargetOnDelete(collection, '3');
      expect(res.shouldDismiss).toBe(false);
      expect(res.nextTargetId).toBe('2');

      const remaining = collection.filter((m) => m.id !== '3');
      expect(getNewIndexForTarget(remaining, res.nextTargetId!)).toBe(1);
      expect(remaining[1].id).toBe('2');
    });

    it('signals dismissal when the only item in collection is removed', () => {
      const collection = [{ id: '1', title: 'Single' }];
      const res = resolveNextTargetOnDelete(collection, '1');
      expect(res.shouldDismiss).toBe(true);
      expect(res.nextTargetId).toBeNull();
    });

    it('preserves album context by advancing strictly within album collection', () => {
      const albumCollection = [
        { id: 'cam-101', title: 'DCIM 1' },
        { id: 'cam-102', title: 'DCIM 2' },
        { id: 'cam-103', title: 'DCIM 3' },
      ];
      const res = resolveNextTargetOnDelete(albumCollection, 'cam-102');
      expect(res.nextTargetId).toBe('cam-103');

      const remainingAlbum = albumCollection.filter((m) => m.id !== 'cam-102');
      const newIdx = getNewIndexForTarget(remainingAlbum, res.nextTargetId!);
      expect(newIdx).toBe(1);
      expect(remainingAlbum[newIdx].id).toBe('cam-103');
    });
  });
});
