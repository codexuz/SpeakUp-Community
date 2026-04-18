import { TG } from '@/constants/theme';
import { useTelegram } from '@/store/telegram';
import * as Linking from 'expo-linking';
import { Send } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function TelegramLinkModal() {
  const { linked, deepLink, loading, checkLink } = useTelegram();

  if (linked) return null;

  return (
    <Modal visible={!linked} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Send size={32} color={TG.accent} strokeWidth={1.5} />
          </View>

          <Text style={styles.title}>Connect Telegram</Text>
          <Text style={styles.description}>
            Link your Telegram account to receive password reset codes and important notifications.
          </Text>

          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.7}
            onPress={() => {
              if (deepLink) Linking.openURL(deepLink);
            }}
            disabled={!deepLink || loading}
          >
            {loading ? (
              <ActivityIndicator color={TG.textWhite} />
            ) : (
              <Text style={styles.primaryButtonText}>Open Telegram</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.checkButton} activeOpacity={0.7} onPress={checkLink}>
            <Text style={styles.checkButtonText}>Check connection</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    backgroundColor: TG.bg,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: TG.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: TG.textPrimary,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: TG.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: TG.accent,
    borderRadius: 12,
    paddingVertical: 16,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: TG.textWhite,
    fontSize: 16,
    fontWeight: '700',
  },
  checkButton: {
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingVertical: 16,
    width: '100%',
    alignItems: 'center',
  },
  checkButtonText: {
    color: TG.textWhite,
    fontSize: 16,
    fontWeight: '700',
  },
});
