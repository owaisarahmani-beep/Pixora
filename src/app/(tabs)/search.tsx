import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';
import { useSearchStore } from '../../store/useSearchStore';
import PhotoGrid from '../../components/gallery/PhotoGrid';
import { groupMediaByDate } from '../../utils/dateGrouping';
import { useVisibleMedia, useVisibleAlbums } from '../../hooks/useVisibleMedia';

export default function SearchScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  
  const { 
    isIndexing, 
    buildIndex, 
    searchQuery, 
    setSearchQuery, 
    mediaTypeFilter, 
    setMediaTypeFilter, 
    dateFilter,
    setDateFilter,
    albums: canonicalAlbums,
    albumFilter,
    setAlbumFilter,
    searchResults: canonicalSearchResults 
  } = useSearchStore();

  const searchResults = useVisibleMedia(canonicalSearchResults);
  const albums = useVisibleAlbums(canonicalAlbums);

  useEffect(() => {
    buildIndex();
  }, [buildIndex]);

  const groupedResults = useMemo(() => groupMediaByDate(searchResults), [searchResults]);

  const hasActiveFilters = searchQuery !== '' || mediaTypeFilter !== 'all' || dateFilter !== 'all' || albumFilter !== null;

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Search</Text>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={theme.textMuted} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: theme.text, backgroundColor: theme.surface }]}
          placeholder="Search by filename..."
          placeholderTextColor={theme.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')} style={styles.clearButton}>
            <Ionicons name="close-circle" size={20} color={theme.textMuted} />
          </Pressable>
        )}
      </View>

      <View style={styles.filtersContainer}>
        {/* Type & Date Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {(['all', 'photo', 'video'] as const).map(type => (
            <Pressable
              key={type}
              style={[
                styles.filterChip,
                { backgroundColor: mediaTypeFilter === type ? theme.accent : theme.surface }
              ]}
              onPress={() => setMediaTypeFilter(type)}
            >
              <Text style={[styles.filterText, { color: mediaTypeFilter === type ? '#000' : theme.text }]}>
                {type === 'all' ? 'All Types' : type.charAt(0).toUpperCase() + type.slice(1) + 's'}
              </Text>
            </Pressable>
          ))}
          <View style={styles.filterDivider} />
          {([
            { id: 'all', label: 'All Time' },
            { id: 'today', label: 'Today' },
            { id: 'month', label: 'Past Month' },
            { id: 'year', label: 'Past Year' },
          ] as const).map(date => (
            <Pressable
              key={date.id}
              style={[
                styles.filterChip,
                { backgroundColor: dateFilter === date.id ? theme.accent : theme.surface }
              ]}
              onPress={() => setDateFilter(date.id)}
            >
              <Text style={[styles.filterText, { color: dateFilter === date.id ? '#000' : theme.text }]}>
                {date.label}
              </Text>
            </Pressable>
          ))}
          
          {albums.length > 0 && <View style={styles.filterDivider} />}
          {albums.map(album => (
            <Pressable
              key={album.id}
              style={[
                styles.filterChip,
                { backgroundColor: albumFilter === album.id ? theme.accent : theme.surface }
              ]}
              onPress={() => setAlbumFilter(albumFilter === album.id ? null : album.id)}
            >
              <Text style={[styles.filterText, { color: albumFilter === album.id ? '#000' : theme.text }]}>
                {album.title}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {isIndexing ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={[styles.stateText, { color: theme.textMuted }]}>Indexing media...</Text>
        </View>
      ) : hasActiveFilters ? (
        searchResults.length > 0 ? (
          <PhotoGrid
            groupedMedia={groupedResults}
            onEndReached={() => {}}
            isRefreshing={false}
            onRefresh={() => {}}
            source="search"
          />
        ) : (
          <View style={styles.centerState}>
            <Ionicons name="search-outline" size={64} color={theme.textMuted} />
            <Text style={[styles.stateText, { color: theme.textMuted }]}>No results found.</Text>
          </View>
        )
      ) : (
        <View style={styles.centerState}>
          <Ionicons name="images-outline" size={64} color={theme.textMuted} />
          <Text style={[styles.stateText, { color: theme.textMuted }]}>Start searching your gallery.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    position: 'relative',
  },
  searchIcon: {
    position: 'absolute',
    left: 12,
    zIndex: 1,
  },
  searchInput: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    paddingLeft: 40,
    paddingRight: 40,
    fontSize: 16,
  },
  clearButton: {
    position: 'absolute',
    right: 12,
  },
  filtersContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  filterText: {
    fontWeight: '600',
  },
  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stateText: {
    marginTop: 16,
    fontSize: 16,
  },
  filterDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#334155',
    marginHorizontal: 8,
    alignSelf: 'center',
  },
  filterScroll: {
    paddingRight: 16,
    alignItems: 'center',
  },
});
