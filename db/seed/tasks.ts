import type { ManagerTask } from '../types/task';

export const MOCK_TASKS: ManagerTask[] = [
  {
    id: 'task-1',
    title: 'Confirm 2 investor payments',
    subtext: 'Kano Solar, Agro Hub',
    managerId: 'u_lm1',
    kind: 'payment',
  },
  {
    id: 'task-2',
    title: 'Upload Risk Assessment',
    subtext: 'Abuja Modular Housing',
    managerId: 'u_lm1',
    kind: 'upload',
  },
  {
    id: 'task-3',
    title: 'CEO approved Lagos Logistics',
    subtext: 'Action required',
    action: 'Add additional documents',
    managerId: 'u_lm1',
    kind: 'approval',
  },
  {
    id: 'task-4',
    title: '3 investors awaiting your response',
    subtext: 'Unread messages',
    action: 'View messages',
    managerId: 'u_lm1',
    kind: 'message',
  },
  {
    id: 'task-5',
    title: 'Project update due today',
    subtext: 'Kano Solar Cold-Chain',
    managerId: 'u_lm1',
    kind: 'update',
  },
];
