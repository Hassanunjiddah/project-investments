import { RoleGate } from '@/src/components/auth/RoleGate';
import CeoDashboardScreen from '@/src/screens/ceo/CeoDashboardScreen';

export default function DashboardRoute() {
  return (
    <RoleGate allow={['CEO', 'ADMIN']}>
      <CeoDashboardScreen />
    </RoleGate>
  );
}
