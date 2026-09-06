import type { ReactNode } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryProvider } from '@/src/providers/QueryProvider';
import { AuthProvider } from '@/src/providers/AuthProvider';
import { ToastProvider } from '@/src/providers/ToastProvider';
import { WebDocumentBackground } from '@/src/utils/webViewport';
import { WebFlexFill } from '@/src/components/nav/WebFlexFill';

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <SafeAreaProvider
      style={
        Platform.OS === 'web'
          ? { flex: 1, height: '100%', minHeight: 0 }
          : { flex: 1 }
      }
    >
      <WebDocumentBackground />
      <QueryProvider>
        <AuthProvider>
          <ToastProvider>
            {Platform.OS === 'web' ? <WebFlexFill label="providers">{children}</WebFlexFill> : children}
          </ToastProvider>
        </AuthProvider>
      </QueryProvider>
    </SafeAreaProvider>
  );
}
