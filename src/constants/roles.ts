export type Role = 'CEO' | 'ADMIN' | 'LINE_MANAGER' | 'INVESTOR' | 'PROJECT_OWNER';

export const ROLES: Role[] = ['CEO', 'ADMIN', 'LINE_MANAGER', 'INVESTOR', 'PROJECT_OWNER'];

export const ROLE_LABELS: Record<Role, string> = {
  CEO: 'CEO',
  ADMIN: 'Admin',
  LINE_MANAGER: 'Line Manager',
  INVESTOR: 'Investor',
  PROJECT_OWNER: 'Project Owner',
};
