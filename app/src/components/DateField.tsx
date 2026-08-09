import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { darkColors, radius, spacing, type Palette } from '../lib/theme';
import { useAppColors, useStyles } from '../hooks/useTheme';

let dateStylesInjected = false;

// One-time stylesheet for the native date <input> on web:
// - empty date inputs are :invalid, so the raw dd/mm/yyyy text is hidden and
//   the themed overlay placeholder (DateField's `placeholder`) shows instead;
// - the calendar icon is toned down to sit quietly in both themes.
function injectDateStyles(): void {
  if (dateStylesInjected || typeof document === 'undefined') {
    return;
  }
  dateStylesInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    input[data-pawly-date]:invalid { color: transparent; }
    input[data-pawly-date]::-webkit-calendar-picker-indicator {
      opacity: 0.55;
      cursor: pointer;
    }
  `;
  document.head.appendChild(style);
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    wrap: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.sm,
      position: 'relative',
      justifyContent: 'center',
    },
    placeholderOverlay: {
      position: 'absolute',
      left: spacing.md,
      right: spacing.md,
      top: 0,
      bottom: 0,
      justifyContent: 'center',
    },
    placeholderText: { fontFamily: 'Roboto_400Regular', fontSize: 15, color: colors.textMuted },
    button: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.sm,
      minHeight: 46,
      paddingHorizontal: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    text: { fontFamily: 'Roboto_400Regular', fontSize: 15, color: colors.text },
    placeholder: { color: colors.textMuted },
    pressed: { opacity: 0.7 },
  });

// One date control for every form: a native picker on iOS/Android and a
// themed <input type="date"> on web. Value is always 'YYYY-MM-DD' or ''.
export function DateField({
  value,
  onChange,
  accessibilityLabel,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  accessibilityLabel: string;
  placeholder?: string;
}) {
  const colors = useAppColors();
  const styles = useStyles(createStyles);
  const [showPicker, setShowPicker] = useState(false);
  const isDark = colors.background === darkColors.background;

  useEffect(() => {
    injectDateStyles();
  }, []);

  if (Platform.OS === 'web') {
    return (
      <View style={styles.wrap}>
        <input
          type="date"
          value={value}
          aria-label={accessibilityLabel}
          data-pawly-date=""
          onClick={(e) => {
            // Click anywhere on the field opens the calendar popup right
            // away — no hunting for the tiny native indicator icon.
            const el = e.currentTarget;
            if (typeof el.showPicker === 'function') {
              try {
                el.showPicker();
              } catch {
                // already open or unsupported — plain focus is fine
                el.focus();
              }
            } else {
              el.focus();
            }
          }}
          onChange={(e) => onChange(e.currentTarget.value)}
          style={{
            width: '100%',
            height: 46,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: 15,
            color: colors.text,
            fontFamily: 'inherit',
            // Make the native calendar popup + icon follow the app theme.
            colorScheme: isDark ? 'dark' : 'light',
            accentColor: colors.primary,
          }}
        />
        {!value ? (
          <View style={styles.placeholderOverlay} pointerEvents="none">
            <Text style={styles.placeholderText}>{placeholder ?? ''}</Text>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <>
      <Pressable
        onPress={() => setShowPicker(true)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Text style={[styles.text, value ? null : styles.placeholder]}>
          {value ? value : (placeholder ?? '')}
        </Text>
        <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
      </Pressable>
      {showPicker ? (
        <DateTimePicker
          value={value ? new Date(value + 'T12:00:00') : new Date()}
          mode="date"
          display="default"
          accentColor={colors.primary}
          // v9 API: onChange is deprecated; onValueChange fires on confirm,
          // onDismiss on cancel/back.
          onValueChange={(_event, date) => {
            setShowPicker(false);
            onChange(date.toLocaleDateString('en-CA'));
          }}
          onDismiss={() => setShowPicker(false)}
        />
      ) : null}
    </>
  );
}
