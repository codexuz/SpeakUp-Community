import { TG } from '@/constants/theme';
import { useTelegram } from '@/store/telegram';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { Send, X } from 'lucide-react-native';
import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function TelegramLinkModal() {
  const { linked, checked, deepLink, loading, dismissed, checkLink, dismiss } = useTelegram();
  const translateY = useRef(new Animated.Value(300)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const visible = checked && !linked && !dismissed;

  // Animate in/out with both slide and fade for a premium feel
  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: visible ? 0 : 300,
        useNativeDriver: true,
        tension: 50,
        friction: 9,
      }),
      Animated.timing(opacity, {
        toValue: visible ? 1 : 0,
        duration: visible ? 250 : 200,
        useNativeDriver: true,
      })
    ]).start();
  }, [visible]);

  if (!checked || linked) return null;

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateY }], opacity }]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <TouchableOpacity 
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => deepLink && Linking.openURL(deepLink)}
        disabled={!deepLink || loading}
      >
        <TouchableOpacity style={styles.closeBtn} onPress={dismiss} activeOpacity={0.6} hitSlop={12}>
          <X size={16} color={TG.textHint} strokeWidth={2.5} />
        </TouchableOpacity>

        <View style={styles.row}>
          <LinearGradient 
            colors={['#38BDF8', '#2563EB']} 
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconContainer}
          >
            <Send size={16} color="#FFFFFF" strokeWidth={2.5} style={{ marginLeft: -1, marginTop: 1 }} />
          </LinearGradient>

          <View style={styles.textContainer}>
            <Text style={styles.title}>Connect Telegram</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              Get updates & feedback
            </Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.primaryAction}
              activeOpacity={0.8}
              onPress={checkLink}
              disabled={loading}
            >
              <LinearGradient 
                colors={['#34A853', '#059669']} 
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientBtn}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryBtnText}>Verify</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 90 : 70,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  card: {
    width: SCREEN_WIDTH - 24,
    backgroundColor: TG.bg,
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 14,
    // Premium soft shadow
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  closeBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: TG.bgSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderWidth: 1,
    borderColor: TG.separator,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: TG.textPrimary,
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 11,
    color: TG.textSecondary,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'column',
    gap: 6,
    alignItems: 'center',
  },
  primaryAction: {
    borderRadius: 10,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  gradientBtn: {
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  secondaryAction: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: TG.bgSecondary,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
  },
  secondaryBtnText: {
    color: TG.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
});
