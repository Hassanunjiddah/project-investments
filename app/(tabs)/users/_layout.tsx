import { Stack } from 'expo-router';

/** Keep Users as a thin Stack — it has been reliable on web. */
export default function UsersLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'none', freezeOnBlur: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="create" />
    </Stack>
  );
}
