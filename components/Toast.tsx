import { TG } from '@/constants/theme';
import { AlertCircle, CheckCircle, Info, X, XCircle } from 'lucide-react-native';
import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import {
    Animated,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastData {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  show: (type: ToastType, title: string, message?: string, duration?: number) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextType>({
  show: () => {},
  success: () => {},
  error: () => {},
  info: () => {},
  warning: () => {},
});

export const useToast = () => useContext(ToastContext);

// ── Appearance map ──────────────────────────────────────────
const TOAST_CONFIG: Record<ToastType, { bg: string; border: string; color: string; Icon: any }> = {
  success: { bg: '#f0fdf4', border: TG.green, color: '#15803d', Icon: CheckCircle },
  error: { bg: '#fef2f2', border: TG.red, color: '#b91c1c', Icon: XCircle },
  info: { bg: '#eff6ff', border: TG.accent, color: '#1d4ed8', Icon: Info },
  warning: { bg: '#fffbeb', border: TG.orange, color: '#92400e', Icon: AlertCircle },
};

// ── Single toast renderer ───────────────────────────────────
function ToastItem({ toast, onDismiss }: { toast: ToastData; onDismiss: (id: number) => void }) {
  const translateY = useRef(new Animated.Value(-80)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const config = TOAST_CONFIG[toast.type];

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.parallel([
      Animated.timing(translateY, { toValue: -80, duration: 250, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => onDismiss(toast.id));
  }, [toast.id, onDismiss, translateY, opacity]);

  React.useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    timerRef.current = setTimeout(dismiss, toast.duration ?? 3000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return (
    <Animated.View style={[styles.toast, { backgroundColor: config.bg, borderLeftColor: config.border, transform: [{ translateY }], opacity }]}>
      <config.Icon size={20} color={config.color} />
      <View style={styles.toastBody}>
        <Text style={[styles.toastTitle, { color: config.color }]}>{toast.title}</Text>
        {toast.message ? <Text style={styles.toastMessage} numberOfLines={3}>{toast.message}</Text> : null}
      </View>
      <TouchableOpacity onPress={dismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <X size={16} color={TG.textSecondary} />
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Provider ────────────────────────────────────────────────
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const counter = useRef(0);
  const insets = useSafeAreaInsets();

  const show = useCallback((type: ToastType, title: string, message?: string, duration?: number) => {
    const id = ++counter.current;
    setToasts((prev) => [...prev.slice(-2), { id, type, title, message, duration }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const ctx: ToastContextType = React.useMemo(() => ({
    show,
    success: (t, m) => show('success', t, m),
    error: (t, m) => show('error', t, m),
    info: (t, m) => show('info', t, m),
    warning: (t, m) => show('warning', t, m),
  }), [show]);

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <View style={[styles.container, { top: insets.top + 8 }]} pointerEvents="box-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

// ── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 9999,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
    marginBottom: 8,
    gap: 10,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12 },
      android: { elevation: 6 },
    }),
  },
  toastBody: { flex: 1 },
  toastTitle: { fontSize: 14, fontWeight: '700' },
  toastMessage: { fontSize: 13, color: TG.textSecondary, marginTop: 2, lineHeight: 18 },
});
