import { RoleGate } from '@/src/components/auth/RoleGate';
import EarningsScreen from '@/src/screens/earnings/EarningsScreen';

export default function EarningsRoute() {
  return (
    <RoleGate allow={['LINE_MANAGER']}>
      <EarningsScreen />
    </RoleGate>
  );
}
