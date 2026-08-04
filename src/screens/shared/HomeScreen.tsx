import { ActivityIndicator, View } from 'react-native';
import { useAuthStore } from '@/src/store/useAuthStore';
import { isInvestor, canApproveProjects, isProjectOwner } from '@/src/helpers/guards';
import CeoDashboardScreen from '@/src/screens/ceo/CeoDashboardScreen';
import ManagerHomeScreen from '@/src/screens/manager/ManagerHomeScreen';
import InvestorHomeScreen from '@/src/screens/investor/InvestorHomeScreen';
import OwnerHomeScreen from '@/src/screens/owner/OwnerHomeScreen';
import { colors } from '@/src/constants/colors';
import { useUiStore } from '@/src/store/useUiStore';

export default function HomeScreen() {
  const role = useAuthStore((s) => s.role);
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];

  // Never default to the LM shell — a null/unknown role used to flash
  // ManagerHomeScreen for brand-new investors until profile hydrated.
  if (!role) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={palette.primary} />
      </View>
    );
  }

  if (canApproveProjects(role)) {
    return <CeoDashboardScreen />;
  }
  if (role === 'LINE_MANAGER') {
    return <ManagerHomeScreen />;
  }
  if (isProjectOwner(role)) {
    return <OwnerHomeScreen />;
  }
  if (isInvestor(role)) {
    return <InvestorHomeScreen />;
  }
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={palette.primary} />
    </View>
  );
}
