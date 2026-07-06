export type Role = 'CEO' | 'ADMIN' | 'LINE_MANAGER' | 'INVESTOR';

export const ROLES: Role[] = ['CEO', 'ADMIN', 'LINE_MANAGER', 'INVESTOR'];

export const ROLE_LABELS: Record<Role, string> = {
  CEO: 'CEO',
  ADMIN: 'Admin',
  LINE_MANAGER: 'Line Manager',
  INVESTOR: 'Investor',
};
