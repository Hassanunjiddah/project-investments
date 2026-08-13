import { RoleGate } from '@/src/components/auth/RoleGate';
import HomeScreen from '@/src/screens/shared/HomeScreen';

/** Home is for investor / LM / owner — never CEO (they use /dashboard). */
export default function HomeRoute() {
  return (
    <RoleGate allow={['INVESTOR', 'LINE_MANAGER', 'PROJECT_OWNER']}>
      <HomeScreen />
    </RoleGate>
  );
}
