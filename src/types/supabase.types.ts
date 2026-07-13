// Regenerate after applying migrations:
// supabase gen types typescript --linked > src/types/supabase.types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          role: Database['public']['Enums']['user_role'];
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          email: string;
          role?: Database['public']['Enums']['user_role'];
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          email?: string;
          role?: Database['public']['Enums']['user_role'];
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          code: string;
          name: string;
          sector: string;
          location: string;
          banner_storage_path: string | null;
          banner_mime_type: string | null;
          summary: string;
          full_details: string;
          risks: string;
          timeline: string;
          currency_code: string;
          target_minor: number;
          raised_minor: number;
          estimated_roi_bps: number;
          profit_split_investor_bps: number;
          exit_notice_days: number;
          early_exit_penalty_bps: number;
          duration_value: number;
          duration_unit: Database['public']['Enums']['duration_unit'];
          pay_account: Json | null;
          stage: Database['public']['Enums']['project_stage'];
          approval_status: Database['public']['Enums']['approval_status'];
          is_public: boolean;
          submitted_at: string | null;
          created_by: string;
          approved_by: string | null;
          approved_at: string | null;
          rejected_by: string | null;
          rejected_at: string | null;
          rejection_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code?: string;
          name: string;
          sector: string;
          location: string;
          banner_storage_path?: string | null;
          banner_mime_type?: string | null;
          summary?: string;
          full_details?: string;
          risks?: string;
          timeline?: string;
          currency_code?: string;
          target_minor: number;
          raised_minor?: number;
          estimated_roi_bps?: number;
          profit_split_investor_bps?: number;
          exit_notice_days?: number;
          early_exit_penalty_bps?: number;
          duration_value: number;
          duration_unit?: Database['public']['Enums']['duration_unit'];
          pay_account?: Json | null;
          stage?: Database['public']['Enums']['project_stage'];
          approval_status?: Database['public']['Enums']['approval_status'];
          is_public?: boolean;
          submitted_at?: string | null;
          created_by: string;
          approved_by?: string | null;
          approved_at?: string | null;
          rejected_by?: string | null;
          rejected_at?: string | null;
          rejection_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          name?: string;
          sector?: string;
          location?: string;
          banner_storage_path?: string | null;
          banner_mime_type?: string | null;
          summary?: string;
          full_details?: string;
          risks?: string;
          timeline?: string;
          currency_code?: string;
          target_minor?: number;
          raised_minor?: number;
          estimated_roi_bps?: number;
          profit_split_investor_bps?: number;
          exit_notice_days?: number;
          early_exit_penalty_bps?: number;
          duration_value?: number;
          duration_unit?: Database['public']['Enums']['duration_unit'];
          pay_account?: Json | null;
          stage?: Database['public']['Enums']['project_stage'];
          approval_status?: Database['public']['Enums']['approval_status'];
          is_public?: boolean;
          submitted_at?: string | null;
          created_by?: string;
          approved_by?: string | null;
          approved_at?: string | null;
          rejected_by?: string | null;
          rejected_at?: string | null;
          rejection_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'projects_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      project_docs: {
        Row: {
          id: string;
          project_id: string;
          kind: Database['public']['Enums']['doc_kind'];
          title: string;
          file_name: string;
          storage_path: string;
          mime_type: string;
          file_size_bytes: number | null;
          amount_minor: number | null;
          note: string | null;
          uploaded_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          kind: Database['public']['Enums']['doc_kind'];
          title: string;
          file_name: string;
          storage_path: string;
          mime_type: string;
          file_size_bytes?: number | null;
          amount_minor?: number | null;
          note?: string | null;
          uploaded_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          kind?: Database['public']['Enums']['doc_kind'];
          title?: string;
          file_name?: string;
          storage_path?: string;
          mime_type?: string;
          file_size_bytes?: number | null;
          amount_minor?: number | null;
          note?: string | null;
          uploaded_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'project_docs_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      tasks: {
        Row: {
          id: string;
          kind: Database['public']['Enums']['task_kind'];
          status: Database['public']['Enums']['task_status'];
          title: string;
          project_id: string;
          assignee_role: Database['public']['Enums']['user_role'];
          created_at: string;
          completed_at: string | null;
          completed_by: string | null;
        };
        Insert: {
          id?: string;
          kind: Database['public']['Enums']['task_kind'];
          status?: Database['public']['Enums']['task_status'];
          title: string;
          project_id: string;
          assignee_role?: Database['public']['Enums']['user_role'];
          created_at?: string;
          completed_at?: string | null;
          completed_by?: string | null;
        };
        Update: {
          id?: string;
          kind?: Database['public']['Enums']['task_kind'];
          status?: Database['public']['Enums']['task_status'];
          title?: string;
          project_id?: string;
          assignee_role?: Database['public']['Enums']['user_role'];
          created_at?: string;
          completed_at?: string | null;
          completed_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'tasks_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      /** @deprecated invites table deferred to investment phase */
      invites: {
        Row: {
          id: string;
          project_id: string;
          investor_id: string;
          status: Database['public']['Enums']['invite_status'];
          amount_kobo: number;
          projected_profit_kobo: number;
          proof_name: string | null;
          proof_storage_path: string | null;
          proof_file_name: string | null;
          proof_mime_type: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          investor_id: string;
          status?: Database['public']['Enums']['invite_status'];
          amount_kobo: number;
          projected_profit_kobo?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          investor_id?: string;
          status?: Database['public']['Enums']['invite_status'];
          amount_kobo?: number;
          projected_profit_kobo?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'invites_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invites_investor_id_fkey';
            columns: ['investor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      current_user_role: {
        Args: Record<string, never>;
        Returns: Database['public']['Enums']['user_role'];
      };
      is_ceo_or_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_project_owner: {
        Args: { p_project_id: string };
        Returns: boolean;
      };
      is_project_doc_reader: {
        Args: { p_project_id: string };
        Returns: boolean;
      };
      submit_project_for_review: {
        Args: { p_project_id: string };
        Returns: Database['public']['Tables']['projects']['Row'];
      };
      decide_project_approval: {
        Args: {
          p_project_id: string;
          p_approval_status: Database['public']['Enums']['approval_status'];
          p_rejection_note?: string | null;
        };
        Returns: Database['public']['Tables']['projects']['Row'];
      };
      /** @deprecated deferred to investment phase */
      list_investor_invitations: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          project_id: string;
          investor_id: string;
          status: Database['public']['Enums']['invite_status'];
          amount_kobo: number;
          projected_profit_kobo: number;
          proof_name: string | null;
          proof_file_name: string | null;
          project_name: string;
          created_at: string;
        }[];
      };
    };
    Enums: {
      user_role: 'CEO' | 'ADMIN' | 'LINE_MANAGER' | 'INVESTOR';
      project_stage: 'INITIATION' | 'ACCEPTANCE' | 'PROGRESS' | 'END';
      approval_status: 'PENDING' | 'APPROVED' | 'REJECTED';
      duration_unit: 'DAYS' | 'WEEKS' | 'MONTHS';
      doc_kind: 'OVERVIEW' | 'FUND_USE' | 'RISK' | 'DECISION';
      task_kind: 'REVIEW_PROJECT';
      task_status: 'OPEN' | 'COMPLETED' | 'CANCELLED';
      invite_status:
        | 'INVITED'
        | 'ACCEPTED'
        | 'COMMITTED'
        | 'PROOF_SUBMITTED'
        | 'CONFIRMED'
        | 'DECLINED';
    };
    CompositeTypes: Record<string, never>;
  };
};

export type UserRole = Database['public']['Enums']['user_role'];
export type ProjectStage = Database['public']['Enums']['project_stage'];
export type ApprovalStatus = Database['public']['Enums']['approval_status'];
export type InviteStatus = Database['public']['Enums']['invite_status'];
export type DurationUnit = Database['public']['Enums']['duration_unit'];

export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type ProjectRow = Database['public']['Tables']['projects']['Row'];
export type InviteRow = Database['public']['Tables']['invites']['Row'];
export type ProjectDocRow = Database['public']['Tables']['project_docs']['Row'];
export type TaskRow = Database['public']['Tables']['tasks']['Row'];
export type DocKind = Database['public']['Enums']['doc_kind'];
