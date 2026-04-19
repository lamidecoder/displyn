import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  action?: { label: string; onPress: () => void };
}

interface ToastContextValue {
  show: (type: ToastType, title: string, message?: string, action?: { label: string; onPress: () => void }) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_CONFIG: Record<ToastType, { icon: string; color: string; bg: string; bgLight: string; border: string; borderLight: string }> = {
  success: {
    icon: 'checkmark-circle',
    color: '#22D47E',
    bg: '#051A0F',
    bgLight: '#F0FDF4',
    border: '#0D4A25',
    borderLight: '#BBF7D0',
  },
  error: {
    icon: 'close-circle',
    color: '#F87171',
    bg: '#1A0505',
    bgLight: '#FEF2F2',
    border: '#4A0D0D',
    borderLight: '#FECACA',
  },
  warning: {
    icon: 'warning',
    color: '#FBBF24',
    bg: '#1A1205',
    bgLight: '#FFFBEB',
    border: '#4A3500',
    borderLight: '#FDE68A',
  },
  info: {
    icon: 'information-circle',
    color: '#818CF8',
    bg: '#0A0A1A',
    bgLight: '#EEF2FF',
    border: '#1E1E5A',
    borderLight: '#C7D2FE',
  },
};

function ToastItem({
  toast,
  onDismiss,
  isDark,
}: {
  toast: ToastItem;
  onDismiss: () => void;
  isDark: boolean;
}) {
  const config = TOAST_CONFIG[toast.type];
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        tension: 65,
        friction: 11,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      dismiss();
    }, 3800);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: -100, duration: 250, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => onDismiss());
  };

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          backgroundColor: isDark ? config.bg : config.bgLight,
          borderColor: isDark ? config.border : config.borderLight,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: config.color + '20' }]}>
        <Ionicons name={config.icon as any} size={20} color={config.color} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#111111' }]}>{toast.title}</Text>
        {toast.message ? (
          <Text style={[styles.message, { color: isDark ? '#9999AA' : '#555566' }]} numberOfLines={2}>
            {toast.message}
          </Text>
        ) : null}
        {toast.action ? (
          <TouchableOpacity onPress={() => { toast.action!.onPress(); dismiss(); }}>
            <Text style={[styles.actionText, { color: config.color }]}>{toast.action.label}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <TouchableOpacity onPress={dismiss} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="close" size={16} color={isDark ? '#555566' : '#AAAABC'} />
      </TouchableOpacity>
    </Animated.View>
  );
}

export function ToastProvider({ children, isDark }: { children: React.ReactNode; isDark: boolean }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const insets = useSafeAreaInsets();

  const show = useCallback((
    type: ToastType,
    title: string,
    message?: string,
    action?: { label: string; onPress: () => void }
  ) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev.slice(-2), { id, type, title, message, action }]);
  }, []);

  const success = useCallback((t: string, m?: string) => show('success', t, m), [show]);
  const error = useCallback((t: string, m?: string) => show('error', t, m), [show]);
  const warning = useCallback((t: string, m?: string) => show('warning', t, m), [show]);
  const info = useCallback((t: string, m?: string) => show('info', t, m), [show]);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ show, success, error, warning, info }}>
      {children}
      <View
        style={[
          styles.container,
          { top: insets.top + (Platform.OS === 'android' ? 8 : 4) },
        ]}
        pointerEvents="box-none"
      >
        {toasts.map(toast => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onDismiss={() => dismiss(toast.id)}
            isDark={isDark}
          />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    gap: 8,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  message: {
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  closeBtn: {
    marginLeft: 8,
    padding: 2,
  },
});