import type { PayAccount, ApprovalStatus } from '@/src/types/project.types';
import type { InvitationDetail } from '@/src/types/invitation.types';
import { supabase } from '@/src/services/supabase';
import { normalizeError, AppError } from '@/src/helpers/supabaseError';

type EdgeErrorBody = { error?: string };

async function parseEdgeResponse<T>(response: { data: T | null; error: unknown }): Promise<T> {
  if (response.error) {
    const err = response.error as {
      context?: { json?: () => Promise<EdgeErrorBody> };
      message?: string;
    };
    if (err.context?.json) {
      try {
        const body = await err.context.json();
        throw new AppError(body.error ?? err.message ?? 'Edge function failed');
      } catch (err) {
        throw normalizeError(err);
      }
    }
    throw normalizeError(response.error);
  }
  if (response.data === null || response.data === undefined) {
    throw new AppError('Empty response from edge function');
  }
  return response.data;
}

export type CreateProjectEdgeInput = {
  name: string;
  sector: string;
  location: string;
  targetMinor: number;
  durationValue: number;
  durationUnit: 'DAYS' | 'WEEKS' | 'MONTHS';
  summary: string;
  fullDetails: string;
  risks: string;
  timeline: string;
  payAccount: PayAccount;
  estimatedRoiBps?: number;
  isPublic?: boolean;
  profitSplitInvestorBps?: number;
  exitNoticeDays?: number;
  earlyExitPenaltyBps?: number;
  currencyCode?: string;
};

export type CreateProjectEdgeResult = {
  projectId: string;
  code: string;
  approvalStatus: ApprovalStatus;
  stage: string;
};

export async function invokeCreateProject(
  input: CreateProjectEdgeInput,
): Promise<CreateProjectEdgeResult> {
  const response = await supabase.functions.invoke('create-project', { body: input });
  return parseEdgeResponse<CreateProjectEdgeResult>(response);
}

export type SubmitProjectEdgeResult = {
  projectId: string;
  code: string;
  approvalStatus: ApprovalStatus;
  stage: string;
  submittedAt: string;
};

export async function invokeSubmitProject(projectId: string): Promise<SubmitProjectEdgeResult> {
  const response = await supabase.functions.invoke('submit-project', { body: { projectId } });
  return parseEdgeResponse<SubmitProjectEdgeResult>(response);
}

export async function invokeApproveProject(
  projectId: string,
  approvalStatus: 'APPROVED' | 'REJECTED',
  rejectionNote?: string,
): Promise<{
  project: {
    id: string;
    code: string;
    name: string;
    approval_status: string;
    stage: string;
    approved_by: string | null;
    rejected_by: string | null;
  };
}> {
  const response = await supabase.functions.invoke('approve-project', {
    body: { projectId, approvalStatus, rejectionNote },
  });
  return parseEdgeResponse(response);
}

export async function invokeSendInvitation(input: {
  projectId: string;
  email: string;
  maxInvestmentAmountMinor?: number;
}): Promise<{
  invite: {
    id: string;
    project_id: string;
    email: string;
    investor_id: string;
    status: string;
    amount_minor: number | null;
    projected_profit_minor: number | null;
    max_investment_amount_minor: number | null;
    is_new_investor?: boolean;
    created_at: string;
  };
  emailSent: boolean;
  emailError?: string;
  signinCode?: string;
}> {
  const response = await supabase.functions.invoke('send-invitation', { body: input });
  return parseEdgeResponse(response);
}

export async function invokeGetInvitationDetail(
  lookup: { inviteId: string } | { projectId: string },
): Promise<InvitationDetail> {
  const body =
    'inviteId' in lookup ? { inviteId: lookup.inviteId } : { projectId: lookup.projectId };
  const response = await supabase.functions.invoke('get-invitation-detail', { body });
  return parseEdgeResponse<InvitationDetail>(response);
}

export async function invokeConfirmInvitePayment(inviteId: string): Promise<{
  invite: {
    id: string;
    project_id: string;
    investor_id: string;
    status: string;
    amount_minor: number | null;
    projected_profit_minor: number | null;
    max_investment_amount_minor: number | null;
  };
}> {
  const response = await supabase.functions.invoke('confirm-invite-payment', {
    body: { inviteId },
  });
  return parseEdgeResponse(response);
}

export async function invokeSubmitPaymentProof(
  inviteId: string,
  uri: string,
  fileName: string,
  mimeType: string,
  webFile?: File | Blob,
): Promise<{ invite: { id: string; status: string; proof_file_name?: string } }> {
  const formData = new FormData();
  formData.append('inviteId', inviteId);

  // Web: use the real File/Blob so FormData produces a valid multipart body.
  // Native: use the { uri, name, type } shape that RN FormData understands.
  const isWeb = typeof window !== 'undefined' && typeof document !== 'undefined';
  if (isWeb) {
    let blob: Blob | File | undefined = webFile;
    if (!blob) {
      // Fallback: fetch the URI and turn it into a Blob (works for data:, blob:, http(s):)
      const fileRes = await fetch(uri);
      if (!fileRes.ok) throw new AppError('Could not read file for upload');
      blob = await fileRes.blob();
    }
    formData.append('file', blob, fileName);
  } else {
    formData.append(
      'file',
      { uri, name: fileName, type: mimeType } as unknown as Blob,
      fileName,
    );
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new AppError('Not authenticated');

  const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

  const res = await fetch(`${baseUrl}/functions/v1/submit-payment-proof`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
    },
    body: formData,
  });

  const json = (await res.json()) as { error?: string; invite?: unknown };
  if (!res.ok) {
    throw new AppError(json.error ?? 'Failed to submit payment proof');
  }
  return json as { invite: { id: string; status: string; proof_file_name?: string } };
}

export async function getPaymentProofSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('payment-proofs')
    .createSignedUrl(storagePath, 3600);

  if (error) throw normalizeError(error);
  if (!data?.signedUrl) throw new AppError('Could not generate proof URL');
  return data.signedUrl;
}

export type CreateUserEdgeInput = {
  email: string;
  fullName: string;
  role: 'LINE_MANAGER' | 'INVESTOR';
};

export type CreateUserEdgeResult = {
  userId: string;
  email: string;
  fullName: string;
  role: 'LINE_MANAGER' | 'INVESTOR';
  password: string;
};

export async function invokeCreateUser(input: CreateUserEdgeInput): Promise<CreateUserEdgeResult> {
  const response = await supabase.functions.invoke('create-user', { body: input });
  return parseEdgeResponse<CreateUserEdgeResult>(response);
}
