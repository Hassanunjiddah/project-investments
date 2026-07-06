import { useAuthStore } from '@/src/store/useAuthStore';
import { isInvestor, canApproveProjects } from '@/src/helpers/guards';
import MockProjectDetailScreen from '@/src/screens/shared/MockProjectDetailScreen';
import ManagerProjectScreen from '@/src/screens/manager/ManagerProjectScreen';
import InvestorProjectScreen from '@/src/screens/investor/InvestorProjectScreen';

export default function RoleProjectDetailScreen() {
  const role = useAuthStore((s) => s.role);

  if (isInvestor(role)) {
    return <InvestorProjectScreen />;
  }
  if (role === 'LINE_MANAGER') {
    return <ManagerProjectScreen />;
  }
  if (canApproveProjects(role)) {
    return <MockProjectDetailScreen />;
  }
  return <MockProjectDetailScreen />;
}
