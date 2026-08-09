import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, shadow, spacing, type Palette } from '../lib/theme';
import { useAppColors, useStyles } from '../hooks/useTheme';

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    wrap: { flex: 1 },
    toast: {
      position: 'absolute',
      left: spacing.lg,
      right: spacing.lg,
      bottom: spacing.xxl * 2 + spacing.xl,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      // Inverted surface: dark toast on light theme, light toast on dark.
      backgroundColor: colors.text,
      borderRadius: radius.md,
      paddingVertical: 12,
      paddingHorizontal: spacing.md,
      ...shadow.card,
    },
    message: { flex: 1, color: colors.background, fontSize: 14, fontFamily: 'Roboto_500Medium' },
    undo: { paddingVertical: 4, paddingHorizontal: 8 },
    undoText: { color: colors.primary, fontSize: 14, fontFamily: 'Roboto_700Bold' },
    pressed: { opacity: 0.7 },
  });

export interface ToastState {
  message: string;
  undoLabel?: string;
  undo?: () => void;
}

const ToastContext = createContext<{ showToast: (toast: ToastState) => void }>({
  showToast: () => undefined,
});

export function useToast() {
  return useContext(ToastContext);
}

// Renders a single, app-wide confirmation toast (fixed overlay — it cannot
// scroll away with its screen). Auto-dismisses after 5s with a fade.
export function ToastProvider({ children }: { children: ReactNode }) {
  const colors = useAppColors();
  const styles = useStyles(createStyles);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (timer.current) {
      clearTimeout(timer.current);
    }
    if (!toast) {
      return;
    }
    opacity.setValue(reduceMotion ? 1 : 0);
    if (!reduceMotion) {
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    }
    timer.current = setTimeout(() => {
      if (!reduceMotion) {
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }).start();
      }
      setToast(null);
    }, 5000);
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, [toast, reduceMotion, opacity]);

  const showToast = useCallback((t: ToastState) => setToast(t), []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      <View style={styles.wrap}>{children}</View>
      {toast ? (
        <Animated.View style={[styles.toast, { opacity }]} accessibilityLiveRegion="polite">
          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
          <Text style={styles.message} numberOfLines={1}>
            {toast.message}
          </Text>
          {toast.undoLabel && toast.undo ? (
            <Pressable
              onPress={() => {
                toast.undo?.();
                setToast(null);
              }}
              accessibilityRole="button"
              accessibilityLabel={toast.undoLabel}
              hitSlop={8}
              style={({ pressed }) => [styles.undo, pressed && styles.pressed]}
            >
              <Text style={styles.undoText}>{toast.undoLabel}</Text>
            </Pressable>
          ) : null}
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}
