import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { X, MapPin } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { freeFoodService } from '../services/freefood.service';
import { supabase } from '../config/supabase';

export default function FreeFoodBanner() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [alertPost, setAlertPost] = useState(null);
  const slideAnim = useRef(new Animated.Value(-120)).current;
  const dismissTimer = useRef(null);
  const channelRef = useRef(null);

  const showBanner = useCallback((post) => {
    setAlertPost(post);
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 60,
      friction: 10,
      useNativeDriver: true,
    }).start();

    // Auto-dismiss after 5 seconds
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(() => {
      hideBanner();
    }, 5000);
  }, [slideAnim]);

  const hideBanner = useCallback(() => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    Animated.timing(slideAnim, {
      toValue: -120,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setAlertPost(null);
    });
  }, [slideAnim]);

  useEffect(() => {
    channelRef.current = freeFoodService.subscribeToNewPosts((payload) => {
      if (payload.new) {
        showBanner(payload.new);
      }
    });

    // Hide the banner when the displayed post is deactivated
    const changesChannel = supabase
      .channel('free-food-banner-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'free_food_posts' }, (payload) => {
        if (
          payload.eventType === 'UPDATE' &&
          payload.new?.is_active === false
        ) {
          setAlertPost((current) => {
            if (current && current.id === payload.new.id) {
              hideBanner();
            }
            return current;
          });
        }
      })
      .subscribe();

    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      channelRef.current?.unsubscribe();
      changesChannel?.unsubscribe();
    };
  }, [showBanner, hideBanner]);

  const handlePress = useCallback(() => {
    hideBanner();
    navigation.navigate('FreeFood');
  }, [navigation, hideBanner]);

  if (!alertPost) return null;

  const bannerContent = (
    <>
      <View style={styles.contentRow}>
        <Text style={styles.emoji}>{alertPost.emoji || '\u{1F355}'}</Text>
        <View style={styles.textCol}>
          <Text style={styles.title} numberOfLines={1}>{alertPost.title || 'Free food spotted!'}</Text>
          <View style={styles.locationRow}>
            <MapPin size={11} color="rgba(255,255,255,0.7)" />
            <Text style={styles.location} numberOfLines={1}>
              {alertPost.location_name || 'On campus'}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.closeBtn} onPress={hideBanner} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <X size={16} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <Animated.View
      style={[
        styles.wrapper,
        { top: insets.top + 4, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <TouchableOpacity activeOpacity={0.9} onPress={handlePress}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={80} tint="dark" style={styles.banner}>
            <View style={styles.bannerOverlay} />
            {bannerContent}
          </BlurView>
        ) : (
          <View style={[styles.banner, styles.bannerAndroid]}>
            {bannerContent}
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 9999,
  },
  banner: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(34,197,94,0.18)',
  },
  bannerAndroid: {
    backgroundColor: 'rgba(20,50,30,0.95)',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  emoji: { fontSize: 28 },
  textCol: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '800', color: '#FFF' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  location: { fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.7)' },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
