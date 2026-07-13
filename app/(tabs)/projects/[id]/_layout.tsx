import { useUiStore } from '@/src/store/useUiStore';
import { Stack } from 'expo-router';
import { useEffect } from 'react';

export default function ProjectIdLayout() {
  const { hideTabBar, showTabBar } = useUiStore();
  useEffect(() => {
    hideTabBar();
    return () => {
      showTabBar();
    };
  }, [hideTabBar, showTabBar]);
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="edit" />
    </Stack>
  );
}
