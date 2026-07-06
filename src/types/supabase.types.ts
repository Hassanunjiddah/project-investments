// Regenerate after applying migrations:
// supabase gen types typescript --project-id <id> > src/types/supabase.types.ts
// Or: supabase gen types typescript --linked > src/types/supabase.types.ts

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
          name: string;
          sector: string;
          location: string;
          summary: string;
          full_details: string;
          risks: string;
          timeline: string;
          pay_account: Json | null;
          stage: Database['public']['Enums']['project_stage'];
          approval_status: Database['public']['Enums']['approval_status'];
          target_kobo: number;
          raised_kobo: number;
          profit_split_investor_bps: number;
          exit_notice_days: number;
          early_exit_penalty_bps: number;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          sector: string;
          location?: string;
          summary?: string;
          full_details?: string;
          risks?: string;
          timeline?: string;
          pay_account?: Json | null;
          stage?: Database['public']['Enums']['project_stage'];
          approval_status?: Database['public']['Enums']['approval_status'];
          target_kobo: number;
          raised_kobo?: number;
          profit_split_investor_bps?: number;
          exit_notice_days?: number;
          early_exit_penalty_bps?: number;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          sector?: string;
          location?: string;
          summary?: string;
          full_details?: string;
          risks?: string;
          timeline?: string;
          pay_account?: Json | null;
          stage?: Database['public']['Enums']['project_stage'];
          approval_status?: Database['public']['Enums']['approval_status'];
          target_kobo?: number;
          raised_kobo?: number;
          profit_split_investor_bps?: number;
          exit_notice_days?: number;
          early_exit_penalty_bps?: number;
          created_by?: string;
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
          proof_name?: string | null;
          proof_storage_path?: string | null;
          proof_file_name?: string | null;
          proof_mime_type?: string | null;
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
          proof_name?: string | null;
          proof_storage_path?: string | null;
          proof_file_name?: string | null;
          proof_mime_type?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'invites_investor_id_fkey';
            columns: ['investor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invites_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
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
          amount_kobo: number | null;
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
          amount_kobo?: number | null;
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
          amount_kobo?: number | null;
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
          {
            foreignKeyName: 'project_docs_uploaded_by_fkey';
            columns: ['uploaded_by'];
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
      investor_has_invite_on_project: {
        Args: { p_project_id: string };
        Returns: boolean;
      };
      is_project_doc_reader: {
        Args: { p_project_id: string };
        Returns: boolean;
      };
      get_project_docs_summary: {
        Args: { p_project_id: string; p_investor_id: string };
        Returns: {
          id: string;
          kind: Database['public']['Enums']['doc_kind'];
          title: string;
          file_name: string;
        }[];
      };
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
      invite_status:
        | 'INVITED'
        | 'ACCEPTED'
        | 'COMMITTED'
        | 'PROOF_SUBMITTED'
        | 'CONFIRMED'
        | 'DECLINED';
      doc_kind: 'OVERVIEW' | 'FUND_USE' | 'RISK' | 'DECISION';
    };
    CompositeTypes: Record<string, never>;
  };
};

export type UserRole = Database['public']['Enums']['user_role'];
export type ProjectStage = Database['public']['Enums']['project_stage'];
export type ApprovalStatus = Database['public']['Enums']['approval_status'];
export type InviteStatus = Database['public']['Enums']['invite_status'];

export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type ProjectRow = Database['public']['Tables']['projects']['Row'];
export type InviteRow = Database['public']['Tables']['invites']['Row'];
export type ProjectDocRow = Database['public']['Tables']['project_docs']['Row'];
export type DocKind = Database['public']['Enums']['doc_kind'];
