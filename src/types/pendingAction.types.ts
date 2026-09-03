export type PendingActionType =
  | 'payment'
  | 'upload_proof'
  | 'awaiting_confirm'
  | 'review'
  | 'message';

export type PendingAction = {
  id: string;
  type: PendingActionType;
  title: string;
  projectId: string;
  projectName: string;
  timeRemaining: string;
  investorId: string;
};

export type ProjectUpdate = {
  id: string;
  projectId: string;
  projectName: string;
  message: string;
  elapsed: string;
};
