import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * Legacy mock invest wizard — redirect to the live Payment tab on project detail.
 */
export default function InvestRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!id) {
    return <Redirect href="/(tabs)/projects" />;
  }
  return <Redirect href={`/(tabs)/projects/${id}?tab=payment` as never} />;
}
