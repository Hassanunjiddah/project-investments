import { RoleGate } from '@/src/components/auth/RoleGate';
import ApprovalsListScreen from '@/src/screens/ceo/ApprovalsListScreen';

export default function ApprovalsRoute() {
  return (
    <RoleGate allow={['CEO', 'ADMIN']}>
      <ApprovalsListScreen />
    </RoleGate>
  );
}
