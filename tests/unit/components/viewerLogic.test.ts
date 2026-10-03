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
});
