import type { ListRequest } from '@/src/types/list.types';
import type { ApprovalStatus } from '@/src/types/project.types';

export const queryKeys = {
  profile: {
    byId: (userId: string) => ['profile', userId] as const,
    investors: () => ['profile', 'investors'] as const,
    users: () => ['profile', 'users'] as const,
  },
  projects: {
    all: () => ['projects', 'all'] as const,
    list: (props?: ListRequest<{ status?: ApprovalStatus }>) =>
      [...queryKeys.projects.all(), 'list', props?.limit, props?.skip, props?.status] as const,
    byId: (id: string) => ['projects', id] as const,
  },
  documents: {
    forProject: (projectId: string) => ['documents', 'project', projectId] as const,
  },
  invitations: {
    forUser: (userId: string) => ['invitations', userId] as const,
    forProject: (projectId: string) => ['invitations', 'project', projectId] as const,
    detail: (inviteId: string) => ['invitations', 'detail', inviteId] as const,
    lookup: (key: string) => ['invitations', 'lookup', key] as const,
  },
  portfolio: {
    forUser: (userId: string) => ['portfolio', userId] as const,
  },
  stats: {
    forUser: (userId: string) => ['stats', userId] as const,
  },
  tasks: {
    list: (userId: string) => ['tasks', userId] as const,
  },
  profits: {
    updates: (projectId: string) => ['profits', 'updates', projectId] as const,
    investorSummary: (userId: string) => ['profits', 'investor', userId] as const,
    managerSummary: (userId: string) => ['profits', 'manager', userId] as const,
    payout: (inviteId: string) => ['profits', 'payout', inviteId] as const,
  },
} as const;
