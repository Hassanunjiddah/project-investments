import { Stack } from 'expo-router';
import { Platform } from 'react-native';

/**
 * Keep this stack as thin as Users — extra contentStyle/animation options
 * blanked every projects scene on RN-web.
 */
export default function ProjectsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'none',
        freezeOnBlur: false,
        // @ts-expect-error web CSS lengths — stop 0-height blank scenes
        contentStyle:
          Platform.OS === 'web'
            ? { flex: 1, minHeight: '100%', height: '100%' }
            : { flex: 1 },
      }}
      // Nested detach under Tabs + enableScreens blanked list/detail on web.
      detachInactiveScreens={false}
    >
      <Stack.Screen name="index" />
      {/* create redirects to /project-create — kept so old links don't 404 */}
      <Stack.Screen name="create" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
