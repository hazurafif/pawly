import { Alert, Platform } from 'react-native';

// react-native-web's Alert is a no-op, so destructive confirmations on web
// use the browser confirm dialog instead; native keeps the system alert.
export function confirmAction(opts: {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
}): void {
  if (Platform.OS === 'web') {
    const message = [opts.title, opts.message].filter(Boolean).join('\n');
        const ok = globalThis.confirm(message);
        if (ok) {
      opts.onConfirm();
          }
    return;
  }
  Alert.alert(opts.title, opts.message ?? '', [
    { text: opts.cancelLabel, style: 'cancel' },
    {
      text: opts.confirmLabel,
      style: opts.destructive ? 'destructive' : 'default',
      onPress: opts.onConfirm,
    },
  ]);
}
