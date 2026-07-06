import { useAuthStore } from '@/src/store/useAuthStore';
import { isInvestor, canApproveProjects } from '@/src/helpers/guards';
import CeoDashboardScreen from '@/src/screens/ceo/CeoDashboardScreen';
import ManagerHomeScreen from '@/src/screens/manager/ManagerHomeScreen';
import InvestorHomeScreen from '@/src/screens/investor/InvestorHomeScreen';

export default function HomeScreen() {
  const role = useAuthStore((s) => s.role);

  if (canApproveProjects(role)) {
    return <CeoDashboardScreen />;
  }
  if (role === 'LINE_MANAGER') {
    return <ManagerHomeScreen />;
  }
  if (isInvestor(role)) {
    return <InvestorHomeScreen />;
  }
  return <ManagerHomeScreen />;
}
