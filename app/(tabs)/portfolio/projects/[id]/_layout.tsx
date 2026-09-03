import { Slot } from 'expo-router';
import { Platform } from 'react-native';
import { useEffect } from 'react';
import { useUiStore } from '@/src/store/useUiStore';

/** Slot instead of nested Stack — same RN-web blank fix as staff project detail. */
export default function PortfolioProjectIdLayout() {
  const { hideTabBar, showTabBar } = useUiStore();

  useEffect(() => {
    if (Platform.OS === 'web') return;
    hideTabBar();
    return () => {
      showTabBar();
    };
  }, [hideTabBar, showTabBar]);

  return <Slot />;
}
