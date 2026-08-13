import { RoleGate } from '@/src/components/auth/RoleGate';
import UsersListScreen from '@/src/screens/users/UsersListScreen';

export default function UsersRoute() {
  return (
    <RoleGate allow={['CEO', 'ADMIN']}>
      <UsersListScreen />
    </RoleGate>
  );
}
