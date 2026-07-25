import { View, StyleSheet, Platform } from 'react-native';
import type { ReactNode } from 'react';
import { Toast } from '@/src/components/ui/Toast';
import { useUiStore } from '@/src/store/useUiStore';

type ToastProviderProps = {
  children: ReactNode;
};

export function ToastProvider({ children }: ToastProviderProps) {
  const toasts = useUiStore((s) => s.toasts);
  const dismissToast = useUiStore((s) => s.dismissToast);

  const toastList = toasts.map((toast) => (
    <Toast key={toast.id} toast={toast} onDismiss={() => dismissToast(toast.id)} />
  ));

  // On web, use a native <div> so the SR live region + role are guaranteed
  // to be in the DOM (RN-Web 0.21 does not forward these props reliably on
  // View). On native, fall back to the RN View — no ARIA needed there.
  if (Platform.OS === 'web') {
    return (
      <>
        {children}
        <div
          role="region"
          aria-label="Notifications"
          style={{
            position: 'fixed',
            bottom: 48,
            left: 16,
            right: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            zIndex: 9999,
            pointerEvents: 'none',
          }}
        >
          {/* Individual Toasts re-enable pointerEvents on themselves. */}
          <div style={{ pointerEvents: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {toastList}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {children}
      <View style={styles.container} pointerEvents="box-none">
        {toastList}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 48,
    left: 16,
    right: 16,
    gap: 8,
    zIndex: 9999,
  },
});
