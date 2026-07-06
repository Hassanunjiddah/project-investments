export type MockRole = 'CEO' | 'ADMIN' | 'LINE_MANAGER' | 'INVESTOR';

export type MockUser = {
  id: string;
  fullName: string;
  email: string;
  role: MockRole;
  avatarUrl?: string;
  verified?: boolean;
};
