import React, { useRef, useEffect } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Animated, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommonActions } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { Search, Send, Plus, Ticket, User } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';

const tabs = [
  { id: 'Home', label: 'Discover', Icon: Search },
  { id: 'Friends', label: 'Conversations', Icon: Send },
  { id: 'CreateEvent', label: 'Post', Icon: Plus, isCenter: true },
  { id: 'MyTickets', label: 'Tickets', Icon: Ticket },
  { id: 'Profile', label: 'Profile', Icon: User },
];

export default function BottomNav({ navigation, activeTab, visible = true }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const slideUp = useRef(new Animated.Value(100)).current;
  useEffect(() => {
    Animated.spring(slideUp, {
      toValue: 0,
      tension: 50,
      friction: 12,
      useNativeDriver: true,
    }).start();
  }, []);

  const hideAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(hideAnim, {
      toValue: visible ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  const handleTabPress = (tabId) => {
    // Center "+" button pushes CreateEvent instead of resetting
    if (tabId === 'CreateEvent') {
      navigation.navigate('CreateEvent');
      return;
    }
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: tabId }],
      })
    );
  };

  const renderTabs = () =>
    tabs.map((tab) => {
      const isActive = activeTab === tab.id;
      const { Icon } = tab;

      if (tab.isCenter) {
        return (
          <TouchableOpacity
            key={tab.id}
            style={styles.centerTab}
            onPress={() => handleTabPress(tab.id)}
          >
            <View style={[styles.centerButton, {
              backgroundColor: colors.buttonPrimary,
              shadowColor: colors.accent,
            }]}>
              <Icon size={22} color="#FFF" strokeWidth={2.5} />
            </View>
          </TouchableOpacity>
        );
      }

      return (
        <TouchableOpacity
          key={tab.id}
          style={styles.tab}
          onPress={() => handleTabPress(tab.id)}
        >
          <View style={[styles.iconWrap, isActive && { backgroundColor: colors.accentBg }]}>
            <Icon
              size={22}
              color={isActive ? colors.accent : colors.textMuted}
              strokeWidth={isActive ? 2.5 : 1.8}
            />
          </View>
          <Text style={[styles.label, {
            color: isActive ? colors.accent : colors.textMuted,
            fontWeight: isActive ? '600' : '400',
          }]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      );
    });

  return (
    <Animated.View style={[styles.wrapper, { transform: [{ translateY: slideUp }], opacity: hideAnim, pointerEvents: visible ? 'auto' : 'none' }]}>
      {Platform.OS === 'ios' ? (
        <BlurView
          intensity={colors.blurIntensity}
          tint={colors.blurTint}
          style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) }]}
        >
          <View style={[styles.glassOverlay, {
            backgroundColor: colors.glass,
            borderTopColor: colors.glassBorder,
          }]} />
          {renderTabs()}
        </BlurView>
      ) : (
        <View
          style={[styles.container, styles.androidNav, {
            paddingBottom: Math.max(insets.bottom, 8),
            backgroundColor: colors.surface,
            borderTopColor: colors.glassBorder,
          }]}
        >
          {renderTabs()}
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 6,
  },
  androidNav: {
    borderTopWidth: StyleSheet.hairlineWidth,
    elevation: 8,
  },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    alignItems: 'center',
    gap: 2,
    flex: 1,
  },
  iconWrap: {
    width: 36,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 10,
  },
  centerTab: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginTop: -18,
  },
  centerButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
});
