import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';
import { Memory } from '../../hooks/useMemories';

interface Props {
  memories: Memory[];
}

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.45;
const CARD_HEIGHT = CARD_WIDTH * 1.3;

export default function MemoriesCarousel({ memories }: Props) {
  const theme = useTheme();

  if (!memories || memories.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: theme.text }]}>Memories</Text>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {memories.map((memory) => (
          <Pressable 
            key={memory.id} 
            style={[styles.card, { backgroundColor: theme.surface }]}
            onPress={() => {
              // We could navigate to a dedicated memory viewer, 
              // but for now let's reuse the slideshow component
              router.push({
                pathname: '/slideshow',
                params: { source: 'memory', memoryId: memory.id }
              });
            }}
          >
            <Image 
              source={{ uri: memory.coverAsset.uri }} 
              style={styles.image} 
              contentFit="cover"
            />
            <View style={styles.overlay}>
              <Text style={styles.cardTitle} numberOfLines={1}>{memory.title}</Text>
              <Text style={styles.cardSubtitle}>{memory.subtitle}</Text>
            </View>
            <View style={styles.playIcon}>
              <Ionicons name="play-circle" size={32} color="#FFF" />
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  scrollContent: {
    paddingHorizontal: 12,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 16,
    marginHorizontal: 4,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    paddingTop: 32,
    backgroundColor: 'rgba(0,0,0,0.4)', // Gradient in a real app
  },
  cardTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  cardSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 2,
  },
  playIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
    opacity: 0.8,
  }
});
