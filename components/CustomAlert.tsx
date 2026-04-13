import { TG } from '@/constants/theme';
import { AlertTriangle, CheckCircle, Info, Trash2, XCircle } from 'lucide-react-native';
import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import {
    Animated,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

type AlertType = 'info' | 'success' | 'error' | 'warning' | 'destructive';

interface AlertButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

interface AlertOptions {
  type?: AlertType;
  title: string;
  message?: string;
  buttons?: AlertButton[];
}

interface CustomAlertContextType {
  alert: (title: string, message?: string, buttons?: AlertButton[], type?: AlertType) => void;
  confirm: (title: string, message: string, onConfirm: () => void, destructive?: boolean) => void;
}

const CustomAlertContext = createContext<CustomAlertContextType>({
  alert: () => {},
  confirm: () => {},
});

export const useAlert = () => useContext(CustomAlertContext);

// ── Icon map ────────────────────────────────────────────────
const ICON_MAP: Record<AlertType, { Icon: any; color: string; bg: string }> = {
  info: { Icon: Info, color: TG.accent, bg: 'rgba(51, 144, 236, 0.1)' },
  success: { Icon: CheckCircle, color: TG.green, bg: TG.greenLight },
  error: { Icon: XCircle, color: TG.red, bg: TG.redLight },
  warning: { Icon: AlertTriangle, color: TG.orange, bg: TG.orangeLight },
  destructive: { Icon: Trash2, color: TG.red, bg: TG.redLight },
};

// ── Provider ────────────────────────────────────────────────
export function CustomAlertProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [options, setOptions] = useState<AlertOptions | null>(null);
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const show = useCallback((opts: AlertOptions) => {
    setOptions(opts);
    setVisible(true);
    scaleAnim.setValue(0.85);
    opacityAnim.setValue(0);
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, tension: 100, friction: 9, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [scaleAnim, opacityAnim]);

  const hide = useCallback((callback?: () => void) => {
    Animated.parallel([
      Animated.timing(scaleAnim, { toValue: 0.85, duration: 150, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setVisible(false);
      setOptions(null);
      callback?.();
    });
  }, [scaleAnim, opacityAnim]);

  const alert = useCallback((title: string, message?: string, buttons?: AlertButton[], type?: AlertType) => {
    const resolvedType = type ?? (title.toLowerCase().includes('error') ? 'error' : 'info');
    show({ type: resolvedType, title, message, buttons });
  }, [show]);

  const confirm = useCallback((title: string, message: string, onConfirm: () => void, destructive = false) => {
    show({
      type: destructive ? 'destructive' : 'warning',
      title,
      message,
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { text: destructive ? 'Delete' : 'Confirm', style: destructive ? 'destructive' : 'default', onPress: onConfirm },
      ],
    });
  }, [show]);

  const ctx = React.useMemo(() => ({ alert, confirm }), [alert, confirm]);

  const buttons = options?.buttons ?? [{ text: 'OK', style: 'default' as const }];
  const iconInfo = ICON_MAP[options?.type ?? 'info'];

  return (
    <CustomAlertContext.Provider value={ctx}>
      {children}
      {visible && options && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => {
              const cancelBtn = buttons.find(b => b.style === 'cancel');
              hide(cancelBtn?.onPress);
            }} />
          </Animated.View>

          <View style={styles.centerer} pointerEvents="box-none">
            <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
              {/* Icon */}
              <View style={[styles.iconCircle, { backgroundColor: iconInfo.bg }]}>
                <iconInfo.Icon size={28} color={iconInfo.color} />
              </View>

              {/* Text */}
              <Text style={styles.title}>{options.title}</Text>
              {options.message ? <Text style={styles.message}>{options.message}</Text> : null}

              {/* Buttons */}
              <View style={[styles.buttonRow, buttons.length === 1 && { justifyContent: 'center' }]}>
                {buttons.map((btn, i) => {
                  const isCancel = btn.style === 'cancel';
                  const isDestructive = btn.style === 'destructive';
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[
                        styles.button,
                        isCancel && styles.cancelButton,
                        isDestructive && styles.destructiveButton,
                        !isCancel && !isDestructive && styles.primaryButton,
                        buttons.length === 1 && { flex: 0, paddingHorizontal: 40 },
                      ]}
                      activeOpacity={0.7}
                      onPress={() => hide(btn.onPress)}
                    >
                      <Text style={[
                        styles.buttonText,
                        isCancel && styles.cancelButtonText,
                        isDestructive && styles.destructiveButtonText,
                        !isCancel && !isDestructive && styles.primaryButtonText,
                      ]}>
                        {btn.text}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Animated.View>
          </View>
        </View>
      )}
    </CustomAlertContext.Provider>
  );
}

// ── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  centerer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingTop: 28,
    paddingHorizontal: 24,
    paddingBottom: 20,
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 24 },
      android: { elevation: 12 },
    }),
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: TG.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: TG.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    width: '100%',
  },
  button: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: TG.bgSecondary,
  },
  cancelButtonText: {
    color: TG.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: TG.accent,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  destructiveButton: {
    backgroundColor: TG.red,
  },
  destructiveButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
