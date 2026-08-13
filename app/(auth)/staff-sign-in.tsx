import SignInScreen from '@/src/screens/auth/SignInScreen';

/** CEO / Line Manager / Project Owner portal — investors are rejected here. */
export default function StaffSignInRoute() {
  return <SignInScreen portal="staff" />;
}
