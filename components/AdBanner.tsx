import { TG } from '@/constants/theme';
import { Ad, apiFetchActiveAds } from '@/lib/api';
import * as Linking from 'expo-linking';
import React, { useEffect, useRef, useState } from 'react';
import {
    Dimensions,
    FlatList,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ViewToken,
} from 'react-native';

import { ArrowUpRight } from 'lucide-react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;
const BANNER_MARGIN = 16;
const BANNER_WIDTH = SCREEN_WIDTH - BANNER_MARGIN * 2;
const AUTO_SCROLL_INTERVAL = 5000;

export default function AdBanner() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList<Ad>>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetchActiveAds();
        setAds(data || []);
      } catch {
        // silently fail — ads are non-critical
      }
    })();
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (ads.length <= 1) return;
    timerRef.current = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % ads.length;
        flatListRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, AUTO_SCROLL_INTERVAL);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [ads.length]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const handlePress = (ad: Ad) => {
    if (ad.linkUrl) {
      Linking.openURL(ad.linkUrl);
    }
  };

  if (ads.length === 0) return null;

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={ads}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => String(item.id)}
        snapToInterval={BANNER_WIDTH + 8}
        decelerationRate="fast"
        contentContainerStyle={{ gap: 8 }}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.banner}
            activeOpacity={item.linkUrl ? 0.8 : 1}
            onPress={() => handlePress(item)}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.adLabel}>Ad</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>what's this?</Text>
              </View>
            </View>

            <View style={styles.cardBody}>
              <View style={styles.textContent}>
                <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                {item.adText ? (
                  <Text style={styles.adText} numberOfLines={3}>{item.adText}</Text>
                ) : null}
              </View>
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.image} />
              ) : null}
            </View>

            {item.linkUrl ? (
              <View style={styles.cardFooter}>
                <Text style={styles.cta}>OPEN LINK</Text>
                <ArrowUpRight size={14} color="dodgerblue" strokeWidth={3} />
              </View>
            ) : null}
          </TouchableOpacity>
        )}
      />
      {ads.length > 1 && (
        <View style={styles.dots}>
          {ads.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === activeIndex && styles.dotActive]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: BANNER_MARGIN,
    marginTop: 24,
    marginBottom: 4,
  },
  banner: {
    width: BANNER_WIDTH,
    backgroundColor: '#F0F8FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CCE8FF',
    borderLeftWidth: 4,
    borderLeftColor: 'dodgerblue',
    overflow: 'hidden',
    paddingTop: 8,
    paddingBottom: 0,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 6,
    marginBottom: 4,
  },
  adLabel: {
    color: 'dodgerblue',
    fontWeight: '700',
    fontSize: 13,
  },
  badge: {
    backgroundColor: '#CCE8FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgeText: {
    color: '#0050A0',
    fontSize: 10,
    fontWeight: '600',
  },
  cardBody: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 12,
    alignItems: 'flex-start',
  },
  textContent: {
    flex: 1,
  },
  title: {
    color: '#000',
    fontWeight: '700',
    fontSize: 15,
    marginBottom: 2,
  },
  adText: {
    color: '#333',
    fontSize: 13,
    lineHeight: 18,
  },
  image: {
    width: 48,
    height: 48,
    borderRadius: 6,
    resizeMode: 'cover',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: '#CCE8FF',
  },
  cta: {
    color: 'dodgerblue',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
    marginTop: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: TG.separator,
  },
  dotActive: {
    backgroundColor: 'dodgerblue',
    width: 16,
    borderRadius: 3,
  },
});
