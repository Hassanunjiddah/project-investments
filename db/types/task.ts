export type TaskKind = 'payment' | 'upload' | 'approval' | 'message' | 'update';

export type ManagerTask = {
  id: string;
  title: string;
  subtext?: string;
  action?: string;
  managerId: string;
  kind?: TaskKind;
};
