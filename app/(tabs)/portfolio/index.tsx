import { RoleGate } from '@/src/components/auth/RoleGate';
import InvestorPortfolioScreen from '@/src/screens/investor/InvestorPortfolioScreen';

export default function PortfolioRoute() {
  return (
    <RoleGate allow={['INVESTOR']}>
      <InvestorPortfolioScreen />
    </RoleGate>
  );
}
