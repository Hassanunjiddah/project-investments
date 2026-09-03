import { Slot } from 'expo-router';
import { Platform } from 'react-native';
import { useEffect } from 'react';
import { useUiStore } from '@/src/store/useUiStore';

/**
 * No nested Stack here — Stack-in-Stack under Tabs blanked project detail
 * on RN-web. Slot keeps /projects/:id|/edit|/invest without a second navigator.
 */
export default function ProjectIdLayout() {
  const { hideTabBar, showTabBar } = useUiStore();

  useEffect(() => {
    // Hiding the tab bar on web remeasures tab scenes and has collapsed
    // projects to a blank viewport. Desktop already hides the bottom bar.
    if (Platform.OS === 'web') return;
    hideTabBar();
    return () => {
      showTabBar();
    };
  }, [hideTabBar, showTabBar]);

  return <Slot />;
}
