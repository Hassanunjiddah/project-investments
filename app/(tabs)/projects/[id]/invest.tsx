import { Redirect, useLocalSearchParams } from 'expo-router';
import { investorProjectHref } from '@/src/helpers/routing';

/**
 * Legacy mock invest wizard — redirect to the live Payment tab on investor project detail.
 */
export default function InvestRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!id) {
    return <Redirect href="/(tabs)/portfolio" />;
  }
  return (
    <Redirect
      href={`${String(investorProjectHref(id))}?tab=payment` as never}
    />
  );
}
