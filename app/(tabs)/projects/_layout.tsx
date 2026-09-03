import { Stack } from 'expo-router';
import { colors } from '@/src/constants/colors';
import { useUiStore } from '@/src/store/useUiStore';

export default function ProjectsLayout() {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { flex: 1, backgroundColor: palette.background },
        // Fade animations have blanked nested stack scenes on RN-web.
        animation: 'none',
      }}
    >
      <Stack.Screen name="index" />
      {/* create redirects to /project-create — kept so old links don't 404 */}
      <Stack.Screen name="create" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
