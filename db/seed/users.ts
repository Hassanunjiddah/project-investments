import type { MockUser } from '../types/user';

export const MOCK_USERS: MockUser[] = [
  {
    id: 'u_ceo',
    fullName: 'Aisha',
    email: 'aisha@ribhshare.com',
    role: 'CEO',
  },
  {
    id: 'u_admin',
    fullName: 'Bilal',
    email: 'bilal@ribhshare.com',
    role: 'ADMIN',
  },
  {
    id: 'u_lm1',
    fullName: 'Khadija Ali',
    email: 'khadija@ribhshare.com',
    role: 'LINE_MANAGER',
    verified: true,
  },
  {
    id: 'u_lm2',
    fullName: 'Yusuf Bello',
    email: 'yusuf@ribhshare.com',
    role: 'LINE_MANAGER',
    verified: true,
  },
  {
    id: 'u_inv1',
    fullName: 'Ibrahim',
    email: 'ibrahim@ribhshare.com',
    role: 'INVESTOR',
  },
  {
    id: 'u_inv2',
    fullName: 'Fatima',
    email: 'fatima@ribhshare.com',
    role: 'INVESTOR',
  },
];

export const MOCK_USER_BY_ID = Object.fromEntries(MOCK_USERS.map((u) => [u.id, u]));

export const MOCK_USER_BY_ROLE: Record<string, string> = {
  CEO: 'u_ceo',
  ADMIN: 'u_admin',
  LINE_MANAGER: 'u_lm1',
  INVESTOR: 'u_inv1',
};
