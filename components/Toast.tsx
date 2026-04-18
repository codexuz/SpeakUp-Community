import { AlertTriangle, CheckCircle, Info, X } from 'lucide-react-native';
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
const TOAST_CONFIG: Record<ToastType, { bg: string; accent: string; Icon: any }> = {
  success: { bg: '#06d899', accent: '#ffffff', Icon: CheckCircle },
  error:   { bg: '#e00661', accent: '#ffffff', Icon: AlertTriangle },
  info:    { bg: '#008bfd', accent: '#ffffff', Icon: Info },
  warning: { bg: '#3c3c3c', accent: '#ffffff', Icon: Info },
};

// ── Single toast renderer ───────────────────────────────────
function ToastItem({ toast, onDismiss }: { toast: ToastData; onDismiss: (id: number) => void }) {
  const translateY = useRef(new Animated.Value(-80)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const config = TOAST_CONFIG[toast.type];

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.parallel([
      Animated.timing(translateY, { toValue: -80, duration: 200, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 0.9, duration: 200, useNativeDriver: true }),
    ]).start(() => onDismiss(toast.id));
  }, [toast.id, onDismiss, translateY, opacity, scale]);

  React.useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, tension: 80, friction: 12, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, tension: 80, friction: 10, useNativeDriver: true }),
    ]).start();

    timerRef.current = setTimeout(dismiss, toast.duration ?? 3000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return (
    <Animated.View style={[styles.toast, { backgroundColor: config.bg, transform: [{ translateY }, { scale }], opacity }]}>
      <View style={styles.iconCircle}>
        <config.Icon size={20} color={config.bg} />
      </View>
      <View style={styles.toastBody}>
        <Text style={styles.toastTitle} numberOfLines={1}>{toast.title}</Text>
        {toast.message ? <Text style={styles.toastMessage} numberOfLines={2}>{toast.message}</Text> : null}
      </View>
      <TouchableOpacity onPress={dismiss} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <X size={20} color="rgba(255,255,255,0.85)" />
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
    left: 16,
    right: 16,
    zIndex: 9999,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingLeft: 14,
    paddingRight: 14,
    paddingVertical: 16,
    borderRadius: 20,
    marginBottom: 10,
    gap: 14,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24 },
      android: { elevation: 10 },
    }),
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastBody: { flex: 1 },
  toastTitle: { fontSize: 16, fontWeight: '700', color: '#ffffff' },
  toastMessage: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2, lineHeight: 18 },
  closeBtn: {
    padding: 6,
  },
});
