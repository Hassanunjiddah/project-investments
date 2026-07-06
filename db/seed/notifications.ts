import type { PendingAction, ProjectUpdate } from '../types/notification';

export const MOCK_PENDING_ACTIONS: PendingAction[] = [
  {
    id: 'pa-1',
    type: 'payment',
    title: 'Complete payment for Kano Solar Cold-Chain',
    projectId: 'PRJ-104',
    projectName: 'Kano Solar Cold-Chain',
    timeRemaining: '2h left',
    investorId: 'u_inv1',
  },
  {
    id: 'pa-2',
    type: 'upload_proof',
    title: 'Upload payment proof for Abuja Modular Housing',
    projectId: 'PRJ-121',
    projectName: 'Abuja Modular Housing',
    timeRemaining: '1d left',
    investorId: 'u_inv1',
  },
  {
    id: 'pa-3',
    type: 'review',
    title: 'Review updated terms for Lagos Last-Mile Logistics',
    projectId: 'PRJ-118',
    projectName: 'Lagos Last-Mile Logistics',
    timeRemaining: '3d left',
    investorId: 'u_inv1',
  },
];

export const MOCK_PROJECT_UPDATES: ProjectUpdate[] = [
  {
    id: 'upd-1',
    projectId: 'PRJ-104',
    projectName: 'Kano Solar Cold-Chain',
    message: 'New project update posted',
    elapsed: '2h ago',
  },
  {
    id: 'upd-2',
    projectId: 'PRJ-121',
    projectName: 'Abuja Modular Housing',
    message: 'Funding milestone reached — 42%',
    elapsed: '1d ago',
  },
  {
    id: 'upd-3',
    projectId: 'PRJ-099',
    projectName: 'Port Harcourt Fish Farm',
    message: 'Profit distributed — ₦280,000',
    elapsed: '3d ago',
  },
];
