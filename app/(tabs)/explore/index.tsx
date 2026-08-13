import { RoleGate } from '@/src/components/auth/RoleGate';
import ExploreScreen from '@/src/screens/investor/ExploreScreen';

export default function ExploreRoute() {
  return (
    <RoleGate allow={['INVESTOR']}>
      <ExploreScreen />
    </RoleGate>
  );
}
