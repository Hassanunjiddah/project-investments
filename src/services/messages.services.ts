import { supabase } from '@/src/services/supabase';
import { normalizeError } from '@/src/helpers/supabaseError';

export type MessageThread = {
  id: string;
  projectId: string;
  investorId: string | null;
  ownerId: string | null;
  managerId: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  lastSenderId: string | null;
  investorUnreadCount: number;
  managerUnreadCount: number;
  createdAt: string;
  // Join fields — hydrated per-row from `projects` and `profiles`.
  projectName?: string;
  counterpartyName?: string;
};

export type Message = {
  id: string;
  threadId: string;
  senderId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};

/** Fetch every thread the current user participates in (investor, owner, or LM). */
export async function fetchMessageThreads(userId: string): Promise<MessageThread[]> {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('message_threads')
    .select(
      'id, project_id, investor_id, owner_id, manager_id, last_message_at, last_message_preview, last_sender_id, investor_unread_count, manager_unread_count, created_at, projects(name), investor:profiles!message_threads_investor_id_fkey(full_name), owner:profiles!message_threads_owner_id_fkey(full_name), manager:profiles!message_threads_manager_id_fkey(full_name)',
    )
    .or(`investor_id.eq.${userId},owner_id.eq.${userId},manager_id.eq.${userId}`)
    .order('last_message_at', { ascending: false, nullsFirst: false });
  if (error) throw normalizeError(error);
  return ((data ?? []) as any[]).map((r) => {
    const isManager = userId === r.manager_id;
    let counterpartyName: string | undefined;
    if (isManager) {
      counterpartyName = r.investor?.full_name ?? r.owner?.full_name;
    } else {
      counterpartyName = r.manager?.full_name;
    }
    return {
      id: r.id,
      projectId: r.project_id,
      investorId: r.investor_id,
      ownerId: r.owner_id,
      managerId: r.manager_id,
      lastMessageAt: r.last_message_at,
      lastMessagePreview: r.last_message_preview,
      lastSenderId: r.last_sender_id,
      investorUnreadCount: r.investor_unread_count,
      managerUnreadCount: r.manager_unread_count,
      createdAt: r.created_at,
      projectName: r.projects?.name,
      counterpartyName,
    };
  });
}

export async function fetchThreadMessages(threadId: string): Promise<Message[]> {
  if (!threadId) return [];
  const { data, error } = await supabase
    .from('messages')
    .select('id, thread_id, sender_id, body, created_at, read_at')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
    .limit(500);
  if (error) throw normalizeError(error);
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    threadId: r.thread_id,
    senderId: r.sender_id,
    body: r.body,
    createdAt: r.created_at,
    readAt: r.read_at,
  }));
}

export async function ensureMessageThread(
  projectId: string,
  investorId: string,
): Promise<string> {
  const { data, error } = await (supabase.rpc as any)('ensure_message_thread', {
    p_project_id: projectId,
    p_investor_id: investorId,
  });
  if (error) throw normalizeError(error);
  return String(data);
}

/** Owner ↔ Prism LM thread (no investor on this thread). */
export async function ensureOwnerLmThread(projectId: string): Promise<string> {
  const { data, error } = await (supabase.rpc as any)('ensure_owner_lm_thread', {
    p_project_id: projectId,
  });
  if (error) throw normalizeError(error);
  return String(data);
}

export async function sendMessage(threadId: string, body: string): Promise<string> {
  const { data, error } = await (supabase.rpc as any)('send_message', {
    p_thread_id: threadId,
    p_body: body,
  });
  if (error) throw normalizeError(error);
  return String(data);
}

export async function markThreadRead(threadId: string): Promise<void> {
  const { error } = await (supabase.rpc as any)('mark_thread_read', {
    p_thread_id: threadId,
  });
  if (error) throw normalizeError(error);
}
