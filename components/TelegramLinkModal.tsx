import { TG } from '@/constants/theme';
import { useTelegram } from '@/store/telegram';
import * as Linking from 'expo-linking';
import { useSegments } from 'expo-router';
import { Send, X } from 'lucide-react-native';
import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function TelegramLinkModal() {
  const { linked, deepLink, loading, dismissed, checkLink, dismiss, resetDismiss } = useTelegram();
  const segments = useSegments();
  const translateY = useRef(new Animated.Value(200)).current;
  const visible = !linked && !dismissed;

  // Reshow sheet on navigation change
  useEffect(() => {
    if (!linked) resetDismiss();
  }, [segments.join('/'), linked]);

  // Animate in/out
  useEffect(() => {
    Animated.spring(translateY, {
      toValue: visible ? 0 : 200,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, [visible]);

  if (linked) return null;

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateY }] }]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <View style={styles.sheet}>
        {/* Dismiss button */}
        <TouchableOpacity style={styles.closeBtn} onPress={dismiss} activeOpacity={0.7} hitSlop={8}>
          <X size={18} color={TG.textSecondary} strokeWidth={2} />
        </TouchableOpacity>

        <View style={styles.row}>
          <View style={styles.iconWrap}>
            <Send size={20} color="#fff" strokeWidth={2} />
          </View>

          <View style={styles.textCol}>
            <Text style={styles.title}>Connect Telegram</Text>
            <Text style={styles.subtitle} numberOfLines={2}>
              Get password resets & notifications
            </Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.connectBtn}
              activeOpacity={0.75}
              onPress={() => {
                if (deepLink) Linking.openURL(deepLink);
              }}
              disabled={!deepLink || loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.connectBtnText}>Connect</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.checkBtn} activeOpacity={0.75} onPress={checkLink}>
              <Text style={styles.checkBtnText}>Verify</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 90,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999,
  },
  sheet: {
    width: SCREEN_WIDTH - 24,
    backgroundColor: TG.bg,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    paddingRight: 14,
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: TG.separator,
  },
  closeBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: TG.bgSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: TG.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textCol: {
    flex: 1,
    marginRight: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: TG.textPrimary,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: TG.textSecondary,
    lineHeight: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 6,
  },
  connectBtn: {
    backgroundColor: TG.accent,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 70,
  },
  connectBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  checkBtn: {
    backgroundColor: TG.green,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
