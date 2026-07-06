import { View, StyleSheet } from 'react-native';
import type { ReactNode } from 'react';
import { Toast } from '@/src/components/ui/Toast';
import { useUiStore } from '@/src/store/useUiStore';

type ToastProviderProps = {
  children: ReactNode;
};

export function ToastProvider({ children }: ToastProviderProps) {
  const toasts = useUiStore((s) => s.toasts);
  const dismissToast = useUiStore((s) => s.dismissToast);

  return (
    <>
      {children}
      <View style={styles.container} pointerEvents="box-none">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={() => dismissToast(toast.id)} />
        ))}
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
