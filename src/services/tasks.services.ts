import type { ManagerTask, TaskKind } from '@/db/types/task';
import { supabase } from '@/src/services/supabase';
import { normalizeError } from '@/src/helpers/supabaseError';

type TaskRow = {
  id: string;
  kind: string;
  title: string;
  status: string;
  project_id: string;
  invite_id: string | null;
  created_at: string;
  projects: { name: string } | null;
};

function mapKind(dbKind: string): TaskKind {
  switch (dbKind) {
    case 'CONFIRM_PAYMENT_PROOF':
      return 'payment';
    case 'REVIEW_PROJECT':
      return 'approval';
    default:
      return 'update';
  }
}

function mapAction(dbKind: string): string | undefined {
  switch (dbKind) {
    case 'CONFIRM_PAYMENT_PROOF':
      return 'Confirm payment';
    case 'REVIEW_PROJECT':
      return 'Review project';
    default:
      return undefined;
  }
}

function mapRow(row: TaskRow, managerId: string): ManagerTask & { projectId: string } {
  return {
    id: row.id,
    title: row.title,
    subtext: row.projects?.name,
    action: mapAction(row.kind),
    managerId,
    kind: mapKind(row.kind),
    projectId: row.project_id,
  };
}

export type AppTask = ManagerTask & { projectId: string };

export async function fetchTasks(userId: string): Promise<AppTask[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('id, kind, title, status, project_id, invite_id, created_at, projects(name)')
    .eq('status', 'OPEN')
    .order('created_at', { ascending: false });

  if (error) throw normalizeError(error);

  return (data ?? []).map((row) => mapRow(row as TaskRow, userId));
}
