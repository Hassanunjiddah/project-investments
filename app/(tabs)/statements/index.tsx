import { RoleGate } from '@/src/components/auth/RoleGate';
import StatementsScreen from '@/src/screens/investor/StatementsScreen';

export default function StatementsRoute() {
  return (
    <RoleGate allow={['INVESTOR']}>
      <StatementsScreen />
    </RoleGate>
  );
}
