import { create } from 'zustand';

type StatsState = {
  stats: {
    totalProjects: number;
    activeProjects: number;
    pendingApprovals: number;
  };
  setStats: (stats: StatsState['stats']) => void;
};

export const useStatsStore = create<StatsState>((set) => ({
  stats: {
    totalProjects: 0,
    activeProjects: 0,
    pendingApprovals: 0,
  },
  setStats: (stats) => set({ stats }),
}));
