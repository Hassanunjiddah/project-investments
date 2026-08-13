import SignInScreen from '@/src/screens/auth/SignInScreen';

/** Investor portal — staff accounts are rejected here. */
export default function InvestorSignInRoute() {
  return <SignInScreen portal="investor" />;
}
