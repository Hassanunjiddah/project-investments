import { Stack } from 'expo-router';
import { Platform } from 'react-native';

export default function PortfolioLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'none',
        freezeOnBlur: false,
        // @ts-expect-error web CSS lengths
        contentStyle:
          Platform.OS === 'web'
            ? { flex: 1, minHeight: '100%', height: '100%' }
            : { flex: 1 },
      }}
      detachInactiveScreens={false}
    />
  );
}
