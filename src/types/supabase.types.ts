npm warn Unknown env config "devdir". This will stop working in the next major version of npm.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_events: {
        Row: {
          actor_id: string | null
          context: Json
          created_at: string
          entity_id: string | null
          entity_type: string
          event_type: string
          id: string
          project_id: string | null
        }
        Insert: {
          actor_id?: string | null
          context?: Json
          created_at?: string
          entity_id?: string | null
          entity_type: string
          event_type: string
          id?: string
          project_id?: string | null
        }
        Update: {
          actor_id?: string | null
          context?: Json
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          event_type?: string
          id?: string
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      distribution_notices: {
        Row: {
          capital_returned_minor: number
          created_at: string
          declaration_id: string
          id: string
          investor_id: string
          invite_id: string
          is_final: boolean
          per_unit_minor: number
          profit_minor: number
          project_id: string
          reference: string | null
          units_held: number
        }
        Insert: {
          capital_returned_minor?: number
          created_at?: string
          declaration_id: string
          id?: string
          investor_id: string
          invite_id: string
          is_final?: boolean
          per_unit_minor: number
          profit_minor: number
          project_id: string
          reference?: string | null
          units_held: number
        }
        Update: {
          capital_returned_minor?: number
          created_at?: string
          declaration_id?: string
          id?: string
          investor_id?: string
          invite_id?: string
          is_final?: boolean
          per_unit_minor?: number
          profit_minor?: number
          project_id?: string
          reference?: string | null
          units_held?: number
        }
        Relationships: [
          {
            foreignKeyName: "distribution_notices_declaration_id_fkey"
            columns: ["declaration_id"]
            isOneToOne: false
            referencedRelation: "profit_declarations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distribution_notices_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distribution_notices_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "invites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distribution_notices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_payouts: {
        Row: {
          capital_minor: number
          created_at: string
          id: string
          investor_id: string
          invite_id: string
          paid_at: string | null
          profit_minor: number
          project_id: string
        }
        Insert: {
          capital_minor: number
          created_at?: string
          id?: string
          investor_id: string
          invite_id: string
          paid_at?: string | null
          profit_minor: number
          project_id: string
        }
        Update: {
          capital_minor?: number
          created_at?: string
          id?: string
          investor_id?: string
          invite_id?: string
          paid_at?: string | null
          profit_minor?: number
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investor_payouts_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_payouts_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: true
            referencedRelation: "invites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_payouts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          amount_minor: number | null
          created_at: string
          email: string
          first_signin_code: string | null
          first_signin_code_expires_at: string | null
          first_signin_code_redeemed_at: string | null
          id: string
          investor_id: string
          invited_by: string
          is_new_investor: boolean
          max_investment_amount_minor: number | null
          min_units: number | null
          payment_claim_amount_minor: number | null
          payment_claim_bank: string | null
          payment_claim_date: string | null
          payment_claim_narration: string | null
          payment_reference: string | null
          pledge_expires_at: string | null
          pledged_at: string | null
          project_id: string
          projected_profit_minor: number | null
          proof_file_name: string | null
          proof_mime_type: string | null
          proof_name: string | null
          proof_storage_path: string | null
          status: Database["public"]["Enums"]["invite_status"]
          units_allotted: number | null
          units_pledged: number | null
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount_minor?: number | null
          created_at?: string
          email: string
          first_signin_code?: string | null
          first_signin_code_expires_at?: string | null
          first_signin_code_redeemed_at?: string | null
          id?: string
          investor_id: string
          invited_by: string
          is_new_investor?: boolean
          max_investment_amount_minor?: number | null
          min_units?: number | null
          payment_claim_amount_minor?: number | null
          payment_claim_bank?: string | null
          payment_claim_date?: string | null
          payment_claim_narration?: string | null
          payment_reference?: string | null
          pledge_expires_at?: string | null
          pledged_at?: string | null
          project_id: string
          projected_profit_minor?: number | null
          proof_file_name?: string | null
          proof_mime_type?: string | null
          proof_name?: string | null
          proof_storage_path?: string | null
          status?: Database["public"]["Enums"]["invite_status"]
          units_allotted?: number | null
          units_pledged?: number | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount_minor?: number | null
          created_at?: string
          email?: string
          first_signin_code?: string | null
          first_signin_code_expires_at?: string | null
          first_signin_code_redeemed_at?: string | null
          id?: string
          investor_id?: string
          invited_by?: string
          is_new_investor?: boolean
          max_investment_amount_minor?: number | null
          min_units?: number | null
          payment_claim_amount_minor?: number | null
          payment_claim_bank?: string | null
          payment_claim_date?: string | null
          payment_claim_narration?: string | null
          payment_reference?: string | null
          pledge_expires_at?: string | null
          pledged_at?: string | null
          project_id?: string
          projected_profit_minor?: number | null
          proof_file_name?: string | null
          proof_mime_type?: string | null
          proof_name?: string | null
          proof_storage_path?: string | null
          status?: Database["public"]["Enums"]["invite_status"]
          units_allotted?: number | null
          units_pledged?: number | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invites_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          account_code: string
          actor_id: string | null
          amount_minor: number
          created_at: string
          direction: string
          id: string
          memo: string | null
          party_id: string | null
          project_id: string | null
          ref_id: string | null
          ref_type: string | null
          sequence: number
          transaction_ref: string
        }
        Insert: {
          account_code: string
          actor_id?: string | null
          amount_minor: number
          created_at?: string
          direction: string
          id?: string
          memo?: string | null
          party_id?: string | null
          project_id?: string | null
          ref_id?: string | null
          ref_type?: string | null
          sequence?: number
          transaction_ref: string
        }
        Update: {
          account_code?: string
          actor_id?: string | null
          amount_minor?: number
          created_at?: string
          direction?: string
          id?: string
          memo?: string | null
          party_id?: string | null
          project_id?: string | null
          ref_id?: string | null
          ref_type?: string | null
          sequence?: number
          transaction_ref?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      message_threads: {
        Row: {
          created_at: string
          id: string
          investor_id: string
          investor_unread_count: number
          last_message_at: string | null
          last_message_preview: string | null
          last_sender_id: string | null
          manager_id: string
          manager_unread_count: number
          project_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          investor_id: string
          investor_unread_count?: number
          last_message_at?: string | null
          last_message_preview?: string | null
          last_sender_id?: string | null
          manager_id: string
          manager_unread_count?: number
          project_id: string
        }
        Update: {
          created_at?: string
          id?: string
          investor_id?: string
          investor_unread_count?: number
          last_message_at?: string | null
          last_message_preview?: string | null
          last_sender_id?: string | null
          manager_id?: string
          manager_unread_count?: number
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_threads_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_threads_last_sender_id_fkey"
            columns: ["last_sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_threads_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_threads_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
          thread_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
          thread_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          entity_id: string | null
          href: string | null
          id: string
          project_id: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          entity_id?: string | null
          href?: string | null
          id?: string
          project_id?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          entity_id?: string | null
          href?: string | null
          id?: string
          project_id?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          password_set_at: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          password_set_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          password_set_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      profit_declarations: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          costs_minor: number
          declared_at: string
          declared_by: string
          distributable_minor: number
          gross_amount_minor: number
          id: string
          investor_pool_minor: number
          is_final: boolean
          label: string | null
          manager_share_minor: number
          net_amount_minor: number
          per_unit_minor: number
          platform_fee_bps: number
          platform_fee_minor: number
          profit_split_investor_bps: number
          project_id: string
          reference: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_note: string | null
          status: string
          total_units_at_declaration: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          costs_minor?: number
          declared_at?: string
          declared_by: string
          distributable_minor: number
          gross_amount_minor: number
          id?: string
          investor_pool_minor: number
          is_final?: boolean
          label?: string | null
          manager_share_minor: number
          net_amount_minor: number
          per_unit_minor: number
          platform_fee_bps: number
          platform_fee_minor: number
          profit_split_investor_bps: number
          project_id: string
          reference?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_note?: string | null
          status?: string
          total_units_at_declaration: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          costs_minor?: number
          declared_at?: string
          declared_by?: string
          distributable_minor?: number
          gross_amount_minor?: number
          id?: string
          investor_pool_minor?: number
          is_final?: boolean
          label?: string | null
          manager_share_minor?: number
          net_amount_minor?: number
          per_unit_minor?: number
          platform_fee_bps?: number
          platform_fee_minor?: number
          profit_split_investor_bps?: number
          project_id?: string
          reference?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_note?: string | null
          status?: string
          total_units_at_declaration?: number
        }
        Relationships: [
          {
            foreignKeyName: "profit_declarations_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profit_declarations_declared_by_fkey"
            columns: ["declared_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profit_declarations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profit_declarations_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profit_updates: {
        Row: {
          amount_minor: number
          created_at: string
          id: string
          note: string
          posted_by: string
          project_id: string
        }
        Insert: {
          amount_minor: number
          created_at?: string
          id?: string
          note?: string
          posted_by: string
          project_id: string
        }
        Update: {
          amount_minor?: number
          created_at?: string
          id?: string
          note?: string
          posted_by?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profit_updates_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profit_updates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_docs: {
        Row: {
          amount_minor: number | null
          created_at: string
          file_name: string
          file_size_bytes: number | null
          id: string
          kind: Database["public"]["Enums"]["doc_kind"]
          mime_type: string
          note: string | null
          project_id: string
          storage_path: string
          title: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          amount_minor?: number | null
          created_at?: string
          file_name: string
          file_size_bytes?: number | null
          id?: string
          kind: Database["public"]["Enums"]["doc_kind"]
          mime_type: string
          note?: string | null
          project_id: string
          storage_path: string
          title: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          amount_minor?: number | null
          created_at?: string
          file_name?: string
          file_size_bytes?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["doc_kind"]
          mime_type?: string
          note?: string | null
          project_id?: string
          storage_path?: string
          title?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_docs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_docs_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_updates: {
        Row: {
          amount_minor: number | null
          body: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["project_update_kind"]
          posted_by: string
          project_id: string
          title: string
        }
        Insert: {
          amount_minor?: number | null
          body?: string
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["project_update_kind"]
          posted_by: string
          project_id: string
          title: string
        }
        Update: {
          amount_minor?: number | null
          body?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["project_update_kind"]
          posted_by?: string
          project_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_updates_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_updates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          approval_status: Database["public"]["Enums"]["approval_status"]
          approved_at: string | null
          approved_by: string | null
          banner_mime_type: string | null
          banner_storage_path: string | null
          code: string
          created_at: string
          created_by: string
          currency_code: string
          duration_unit: Database["public"]["Enums"]["duration_unit"]
          duration_value: number
          early_exit_penalty_bps: number
          estimated_roi_bps: number
          exit_notice_days: number
          full_details: string
          id: string
          is_public: boolean
          location: string
          min_units_per_investor: number | null
          name: string
          pay_account: Json | null
          platform_fee_bps: number | null
          pledge_expiry_hours: number | null
          profit_split_investor_bps: number
          progress_started_at: string | null
          raised_minor: number
          realised_profit_minor: number
          rejected_at: string | null
          rejected_by: string | null
          rejection_note: string | null
          risks: string
          sector: string
          stage: Database["public"]["Enums"]["project_stage"]
          submitted_at: string | null
          summary: string
          target_minor: number
          timeline: string
          total_units: number | null
          updated_at: string
        }
        Insert: {
          approval_status?: Database["public"]["Enums"]["approval_status"]
          approved_at?: string | null
          approved_by?: string | null
          banner_mime_type?: string | null
          banner_storage_path?: string | null
          code?: string
          created_at?: string
          created_by: string
          currency_code?: string
          duration_unit?: Database["public"]["Enums"]["duration_unit"]
          duration_value: number
          early_exit_penalty_bps?: number
          estimated_roi_bps?: number
          exit_notice_days?: number
          full_details?: string
          id?: string
          is_public?: boolean
          location: string
          min_units_per_investor?: number | null
          name: string
          pay_account?: Json | null
          platform_fee_bps?: number | null
          pledge_expiry_hours?: number | null
          profit_split_investor_bps?: number
          progress_started_at?: string | null
          raised_minor?: number
          realised_profit_minor?: number
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_note?: string | null
          risks?: string
          sector: string
          stage?: Database["public"]["Enums"]["project_stage"]
          submitted_at?: string | null
          summary?: string
          target_minor: number
          timeline?: string
          total_units?: number | null
          updated_at?: string
        }
        Update: {
          approval_status?: Database["public"]["Enums"]["approval_status"]
          approved_at?: string | null
          approved_by?: string | null
          banner_mime_type?: string | null
          banner_storage_path?: string | null
          code?: string
          created_at?: string
          created_by?: string
          currency_code?: string
          duration_unit?: Database["public"]["Enums"]["duration_unit"]
          duration_value?: number
          early_exit_penalty_bps?: number
          estimated_roi_bps?: number
          exit_notice_days?: number
          full_details?: string
          id?: string
          is_public?: boolean
          location?: string
          min_units_per_investor?: number | null
          name?: string
          pay_account?: Json | null
          platform_fee_bps?: number | null
          pledge_expiry_hours?: number | null
          profit_split_investor_bps?: number
          progress_started_at?: string | null
          raised_minor?: number
          realised_profit_minor?: number
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_note?: string | null
          risks?: string
          sector?: string
          stage?: Database["public"]["Enums"]["project_stage"]
          submitted_at?: string | null
          summary?: string
          target_minor?: number
          timeline?: string
          total_units?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_signin_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          redeemed_at: string | null
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          expires_at: string
          redeemed_at?: string | null
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          redeemed_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_signin_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_role: Database["public"]["Enums"]["user_role"]
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          invite_id: string | null
          kind: Database["public"]["Enums"]["task_kind"]
          project_id: string
          status: Database["public"]["Enums"]["task_status"]
          title: string
        }
        Insert: {
          assignee_role?: Database["public"]["Enums"]["user_role"]
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          invite_id?: string | null
          kind: Database["public"]["Enums"]["task_kind"]
          project_id: string
          status?: Database["public"]["Enums"]["task_status"]
          title: string
        }
        Update: {
          assignee_role?: Database["public"]["Enums"]["user_role"]
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          invite_id?: string | null
          kind?: Database["public"]["Enums"]["task_kind"]
          project_id?: string
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "invites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      ledger_project_balances: {
        Row: {
          account_code: string | null
          balance_minor: number | null
          party_id: string | null
          project_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_invite: {
        Args: { p_invite_id: string }
        Returns: {
          amount_minor: number | null
          created_at: string
          email: string
          first_signin_code: string | null
          first_signin_code_expires_at: string | null
          first_signin_code_redeemed_at: string | null
          id: string
          investor_id: string
          invited_by: string
          is_new_investor: boolean
          max_investment_amount_minor: number | null
          min_units: number | null
          payment_claim_amount_minor: number | null
          payment_claim_bank: string | null
          payment_claim_date: string | null
          payment_claim_narration: string | null
          payment_reference: string | null
          pledge_expires_at: string | null
          pledged_at: string | null
          project_id: string
          projected_profit_minor: number | null
          proof_file_name: string | null
          proof_mime_type: string | null
          proof_name: string | null
          proof_storage_path: string | null
          status: Database["public"]["Enums"]["invite_status"]
          units_allotted: number | null
          units_pledged: number | null
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "invites"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      approve_profit_declaration: {
        Args: { p_declaration_id: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          costs_minor: number
          declared_at: string
          declared_by: string
          distributable_minor: number
          gross_amount_minor: number
          id: string
          investor_pool_minor: number
          is_final: boolean
          label: string | null
          manager_share_minor: number
          net_amount_minor: number
          per_unit_minor: number
          platform_fee_bps: number
          platform_fee_minor: number
          profit_split_investor_bps: number
          project_id: string
          reference: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_note: string | null
          status: string
          total_units_at_declaration: number
        }
        SetofOptions: {
          from: "*"
          to: "profit_declarations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      backfill_ledger: { Args: never; Returns: Json }
      can_read_payment_proof: { Args: { p_path: string }; Returns: boolean }
      can_upload_payment_proof: { Args: { p_path: string }; Returns: boolean }
      ceo_admin_ids: { Args: never; Returns: string[] }
      check_ledger_integrity: { Args: never; Returns: Json }
      commit_invite_investment: {
        Args: { p_amount_minor: number; p_invite_id: string }
        Returns: {
          amount_minor: number | null
          created_at: string
          email: string
          first_signin_code: string | null
          first_signin_code_expires_at: string | null
          first_signin_code_redeemed_at: string | null
          id: string
          investor_id: string
          invited_by: string
          is_new_investor: boolean
          max_investment_amount_minor: number | null
          min_units: number | null
          payment_claim_amount_minor: number | null
          payment_claim_bank: string | null
          payment_claim_date: string | null
          payment_claim_narration: string | null
          payment_reference: string | null
          pledge_expires_at: string | null
          pledged_at: string | null
          project_id: string
          projected_profit_minor: number | null
          proof_file_name: string | null
          proof_mime_type: string | null
          proof_name: string | null
          proof_storage_path: string | null
          status: Database["public"]["Enums"]["invite_status"]
          units_allotted: number | null
          units_pledged: number | null
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "invites"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      confirm_invite_payment: {
        Args: { p_invite_id: string }
        Returns: {
          amount_minor: number | null
          created_at: string
          email: string
          first_signin_code: string | null
          first_signin_code_expires_at: string | null
          first_signin_code_redeemed_at: string | null
          id: string
          investor_id: string
          invited_by: string
          is_new_investor: boolean
          max_investment_amount_minor: number | null
          min_units: number | null
          payment_claim_amount_minor: number | null
          payment_claim_bank: string | null
          payment_claim_date: string | null
          payment_claim_narration: string | null
          payment_reference: string | null
          pledge_expires_at: string | null
          pledged_at: string | null
          project_id: string
          projected_profit_minor: number | null
          proof_file_name: string | null
          proof_mime_type: string | null
          proof_name: string | null
          proof_storage_path: string | null
          status: Database["public"]["Enums"]["invite_status"]
          units_allotted: number | null
          units_pledged: number | null
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "invites"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      confirmed_investor_ids: {
        Args: { p_project_id: string }
        Returns: string[]
      }
      create_notifications: {
        Args: {
          p_body: string
          p_entity_id?: string
          p_href?: string
          p_project_id?: string
          p_title: string
          p_type: string
          p_user_ids: string[]
        }
        Returns: undefined
      }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      decide_project_approval: {
        Args: {
          p_approval_status: Database["public"]["Enums"]["approval_status"]
          p_project_id: string
          p_rejection_note?: string
        }
        Returns: {
          approval_status: Database["public"]["Enums"]["approval_status"]
          approved_at: string | null
          approved_by: string | null
          banner_mime_type: string | null
          banner_storage_path: string | null
          code: string
          created_at: string
          created_by: string
          currency_code: string
          duration_unit: Database["public"]["Enums"]["duration_unit"]
          duration_value: number
          early_exit_penalty_bps: number
          estimated_roi_bps: number
          exit_notice_days: number
          full_details: string
          id: string
          is_public: boolean
          location: string
          min_units_per_investor: number | null
          name: string
          pay_account: Json | null
          platform_fee_bps: number | null
          pledge_expiry_hours: number | null
          profit_split_investor_bps: number
          progress_started_at: string | null
          raised_minor: number
          realised_profit_minor: number
          rejected_at: string | null
          rejected_by: string | null
          rejection_note: string | null
          risks: string
          sector: string
          stage: Database["public"]["Enums"]["project_stage"]
          submitted_at: string | null
          summary: string
          target_minor: number
          timeline: string
          total_units: number | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "projects"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      declare_profit: {
        Args: {
          p_costs_minor?: number
          p_gross_minor: number
          p_is_final?: boolean
          p_label?: string
          p_project_id: string
        }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          costs_minor: number
          declared_at: string
          declared_by: string
          distributable_minor: number
          gross_amount_minor: number
          id: string
          investor_pool_minor: number
          is_final: boolean
          label: string | null
          manager_share_minor: number
          net_amount_minor: number
          per_unit_minor: number
          platform_fee_bps: number
          platform_fee_minor: number
          profit_split_investor_bps: number
          project_id: string
          reference: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_note: string | null
          status: string
          total_units_at_declaration: number
        }
        SetofOptions: {
          from: "*"
          to: "profit_declarations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      decline_invite: {
        Args: { p_invite_id: string }
        Returns: {
          amount_minor: number | null
          created_at: string
          email: string
          first_signin_code: string | null
          first_signin_code_expires_at: string | null
          first_signin_code_redeemed_at: string | null
          id: string
          investor_id: string
          invited_by: string
          is_new_investor: boolean
          max_investment_amount_minor: number | null
          min_units: number | null
          payment_claim_amount_minor: number | null
          payment_claim_bank: string | null
          payment_claim_date: string | null
          payment_claim_narration: string | null
          payment_reference: string | null
          pledge_expires_at: string | null
          pledged_at: string | null
          project_id: string
          projected_profit_minor: number | null
          proof_file_name: string | null
          proof_mime_type: string | null
          proof_name: string | null
          proof_storage_path: string | null
          status: Database["public"]["Enums"]["invite_status"]
          units_allotted: number | null
          units_pledged: number | null
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "invites"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      end_project_now: {
        Args: { p_project_id: string }
        Returns: {
          approval_status: Database["public"]["Enums"]["approval_status"]
          approved_at: string | null
          approved_by: string | null
          banner_mime_type: string | null
          banner_storage_path: string | null
          code: string
          created_at: string
          created_by: string
          currency_code: string
          duration_unit: Database["public"]["Enums"]["duration_unit"]
          duration_value: number
          early_exit_penalty_bps: number
          estimated_roi_bps: number
          exit_notice_days: number
          full_details: string
          id: string
          is_public: boolean
          location: string
          min_units_per_investor: number | null
          name: string
          pay_account: Json | null
          platform_fee_bps: number | null
          pledge_expiry_hours: number | null
          profit_split_investor_bps: number
          progress_started_at: string | null
          raised_minor: number
          realised_profit_minor: number
          rejected_at: string | null
          rejected_by: string | null
          rejection_note: string | null
          risks: string
          sector: string
          stage: Database["public"]["Enums"]["project_stage"]
          submitted_at: string | null
          summary: string
          target_minor: number
          timeline: string
          total_units: number | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "projects"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ensure_message_thread: {
        Args: { p_investor_id: string; p_project_id: string }
        Returns: string
      }
      expire_stale_pledges: { Args: { p_project_id: string }; Returns: number }
      finalize_project_if_due: {
        Args: { p_project_id: string }
        Returns: {
          approval_status: Database["public"]["Enums"]["approval_status"]
          approved_at: string | null
          approved_by: string | null
          banner_mime_type: string | null
          banner_storage_path: string | null
          code: string
          created_at: string
          created_by: string
          currency_code: string
          duration_unit: Database["public"]["Enums"]["duration_unit"]
          duration_value: number
          early_exit_penalty_bps: number
          estimated_roi_bps: number
          exit_notice_days: number
          full_details: string
          id: string
          is_public: boolean
          location: string
          min_units_per_investor: number | null
          name: string
          pay_account: Json | null
          platform_fee_bps: number | null
          pledge_expiry_hours: number | null
          profit_split_investor_bps: number
          progress_started_at: string | null
          raised_minor: number
          realised_profit_minor: number
          rejected_at: string | null
          rejected_by: string | null
          rejection_note: string | null
          risks: string
          sector: string
          stage: Database["public"]["Enums"]["project_stage"]
          submitted_at: string | null
          summary: string
          target_minor: number
          timeline: string
          total_units: number | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "projects"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      generate_invite_signin_code: {
        Args: { p_invite_id: string }
        Returns: string
      }
      generate_staff_signin_code: {
        Args: { p_user_id: string }
        Returns: string
      }
      get_investor_profit_summary: {
        Args: { p_investor_id?: string }
        Returns: {
          capital_minor: number
          investor_share_minor: number
          invite_id: string
          project_id: string
          project_name: string
          project_stage: Database["public"]["Enums"]["project_stage"]
          realised_profit_minor: number
        }[]
      }
      get_manager_profit_summary: {
        Args: { p_manager_id?: string }
        Returns: {
          manager_share_minor: number
          project_count: number
          total_realised_profit_minor: number
        }[]
      }
      get_project_docs_summary: {
        Args: { p_investor_id: string; p_project_id: string }
        Returns: {
          file_name: string
          id: string
          kind: Database["public"]["Enums"]["doc_kind"]
          title: string
        }[]
      }
      get_project_nav_series: {
        Args: { p_limit?: number; p_project_id: string }
        Returns: Json
      }
      investor_can_read_doc_summary: {
        Args: { p_project_id: string }
        Returns: boolean
      }
      investor_has_invite_on_project: {
        Args: { p_project_id: string }
        Returns: boolean
      }
      investor_invite_status_on_project: {
        Args: { p_project_id: string }
        Returns: Database["public"]["Enums"]["invite_status"]
      }
      is_ceo_or_admin: { Args: never; Returns: boolean }
      is_investor_invited_to_project: {
        Args: { p_project_id: string }
        Returns: boolean
      }
      is_invite_investor: { Args: { p_invite_id: string }; Returns: boolean }
      is_invite_project_manager: {
        Args: { p_invite_id: string }
        Returns: boolean
      }
      is_project_doc_reader: {
        Args: { p_project_id: string }
        Returns: boolean
      }
      is_project_owner: { Args: { p_project_id: string }; Returns: boolean }
      is_valid_invite_transition: {
        Args: {
          p_new: Database["public"]["Enums"]["invite_status"]
          p_old: Database["public"]["Enums"]["invite_status"]
        }
        Returns: boolean
      }
      is_valid_pay_account: { Args: { pay: Json }; Returns: boolean }
      list_investor_invitations: {
        Args: never
        Returns: {
          amount_minor: number
          created_at: string
          email: string
          id: string
          investor_id: string
          max_investment_amount_minor: number
          min_units: number
          project_banner_storage_path: string
          project_id: string
          project_name: string
          project_sector: string
          project_stage: Database["public"]["Enums"]["project_stage"]
          projected_profit_minor: number
          proof_file_name: string
          proof_name: string
          proof_storage_path: string
          status: Database["public"]["Enums"]["invite_status"]
        }[]
      }
      list_investor_notices: {
        Args: never
        Returns: {
          capital_returned_minor: number
          created_at: string
          declaration_id: string
          declaration_label: string
          declaration_reference: string
          gross_minor: number
          id: string
          investor_pool_minor: number
          invite_id: string
          is_final: boolean
          net_minor: number
          per_unit_minor: number
          platform_fee_bps: number
          platform_fee_minor: number
          profit_minor: number
          profit_split_investor_bps: number
          project_code: string
          project_id: string
          project_name: string
          reference: string
          units_held: number
        }[]
      }
      list_pending_declarations: {
        Args: never
        Returns: {
          approved_at: string | null
          approved_by: string | null
          costs_minor: number
          declared_at: string
          declared_by: string
          distributable_minor: number
          gross_amount_minor: number
          id: string
          investor_pool_minor: number
          is_final: boolean
          label: string | null
          manager_share_minor: number
          net_amount_minor: number
          per_unit_minor: number
          platform_fee_bps: number
          platform_fee_minor: number
          profit_split_investor_bps: number
          project_id: string
          reference: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_note: string | null
          status: string
          total_units_at_declaration: number
        }[]
        SetofOptions: {
          from: "*"
          to: "profit_declarations"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      list_project_audit: {
        Args: { p_limit?: number; p_project_id: string }
        Returns: {
          actor_id: string | null
          context: Json
          created_at: string
          entity_id: string | null
          entity_type: string
          event_type: string
          id: string
          project_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "audit_events"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      list_project_ledger: {
        Args: { p_limit?: number; p_project_id: string }
        Returns: {
          account_code: string
          actor_id: string | null
          amount_minor: number
          created_at: string
          direction: string
          id: string
          memo: string | null
          party_id: string | null
          project_id: string | null
          ref_id: string | null
          ref_type: string | null
          sequence: number
          transaction_ref: string
        }[]
        SetofOptions: {
          from: "*"
          to: "ledger_entries"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      log_audit: {
        Args: {
          p_actor_id?: string
          p_context?: Json
          p_entity_id: string
          p_entity_type: string
          p_event_type: string
          p_project_id: string
        }
        Returns: undefined
      }
      mark_password_set: { Args: { p_user_id?: string }; Returns: undefined }
      mark_thread_read: { Args: { p_thread_id: string }; Returns: Json }
      notify_investors_via_edge: {
        Args: { p_record_id: string; p_type: string }
        Returns: undefined
      }
      pledge_by_amount: {
        Args: { p_amount_minor: number; p_invite_id: string }
        Returns: {
          amount_minor: number | null
          created_at: string
          email: string
          first_signin_code: string | null
          first_signin_code_expires_at: string | null
          first_signin_code_redeemed_at: string | null
          id: string
          investor_id: string
          invited_by: string
          is_new_investor: boolean
          max_investment_amount_minor: number | null
          min_units: number | null
          payment_claim_amount_minor: number | null
          payment_claim_bank: string | null
          payment_claim_date: string | null
          payment_claim_narration: string | null
          payment_reference: string | null
          pledge_expires_at: string | null
          pledged_at: string | null
          project_id: string
          projected_profit_minor: number | null
          proof_file_name: string | null
          proof_mime_type: string | null
          proof_name: string | null
          proof_storage_path: string | null
          status: Database["public"]["Enums"]["invite_status"]
          units_allotted: number | null
          units_pledged: number | null
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "invites"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      pledge_units: {
        Args: { p_invite_id: string; p_units: number }
        Returns: {
          amount_minor: number | null
          created_at: string
          email: string
          first_signin_code: string | null
          first_signin_code_expires_at: string | null
          first_signin_code_redeemed_at: string | null
          id: string
          investor_id: string
          invited_by: string
          is_new_investor: boolean
          max_investment_amount_minor: number | null
          min_units: number | null
          payment_claim_amount_minor: number | null
          payment_claim_bank: string | null
          payment_claim_date: string | null
          payment_claim_narration: string | null
          payment_reference: string | null
          pledge_expires_at: string | null
          pledged_at: string | null
          project_id: string
          projected_profit_minor: number | null
          proof_file_name: string | null
          proof_mime_type: string | null
          proof_name: string | null
          proof_storage_path: string | null
          status: Database["public"]["Enums"]["invite_status"]
          units_allotted: number | null
          units_pledged: number | null
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "invites"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      post_ledger: {
        Args: {
          p_actor_id: string
          p_lines: Json
          p_project_id: string
          p_ref_id: string
          p_ref_type: string
          p_transaction_ref: string
        }
        Returns: undefined
      }
      post_profit_update: {
        Args: { p_amount_minor: number; p_note?: string; p_project_id: string }
        Returns: {
          amount_minor: number
          created_at: string
          id: string
          note: string
          posted_by: string
          project_id: string
        }
        SetofOptions: {
          from: "*"
          to: "profit_updates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      post_project_update: {
        Args: {
          p_amount_minor?: number
          p_body?: string
          p_kind: Database["public"]["Enums"]["project_update_kind"]
          p_project_id: string
          p_title: string
        }
        Returns: {
          amount_minor: number | null
          body: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["project_update_kind"]
          posted_by: string
          project_id: string
          title: string
        }
        SetofOptions: {
          from: "*"
          to: "project_updates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      project_reconciliation: {
        Args: { p_project_id: string }
        Returns: {
          claim_bank: string
          claim_date: string
          claim_narration: string
          claimed_minor: number
          expected_minor: number
          investor_id: string
          investor_name: string
          invite_id: string
          payment_reference: string
          status: string
          units_allotted: number
          units_pledged: number
          variance_minor: number
          verified_at: string
          verified_by: string
          verified_by_name: string
        }[]
      }
      project_units_committed: {
        Args: { p_project_id: string }
        Returns: number
      }
      redeem_invite_signin_code: {
        Args: { p_code: string; p_email: string }
        Returns: {
          investor_id: string
          invite_id: string
          password_already_set: boolean
          project_id: string
        }[]
      }
      redeem_staff_signin_code: {
        Args: { p_code: string; p_email: string }
        Returns: {
          password_already_set: boolean
          user_id: string
          user_role: string
        }[]
      }
      reject_profit_declaration: {
        Args: { p_declaration_id: string; p_note?: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          costs_minor: number
          declared_at: string
          declared_by: string
          distributable_minor: number
          gross_amount_minor: number
          id: string
          investor_pool_minor: number
          is_final: boolean
          label: string | null
          manager_share_minor: number
          net_amount_minor: number
          per_unit_minor: number
          platform_fee_bps: number
          platform_fee_minor: number
          profit_split_investor_bps: number
          project_id: string
          reference: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_note: string | null
          status: string
          total_units_at_declaration: number
        }
        SetofOptions: {
          from: "*"
          to: "profit_declarations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      send_message: {
        Args: { p_body: string; p_thread_id: string }
        Returns: string
      }
      storage_invite_id_from_path: { Args: { path: string }; Returns: string }
      storage_project_id_from_path: { Args: { path: string }; Returns: string }
      submit_project_for_review: {
        Args: { p_project_id: string }
        Returns: {
          approval_status: Database["public"]["Enums"]["approval_status"]
          approved_at: string | null
          approved_by: string | null
          banner_mime_type: string | null
          banner_storage_path: string | null
          code: string
          created_at: string
          created_by: string
          currency_code: string
          duration_unit: Database["public"]["Enums"]["duration_unit"]
          duration_value: number
          early_exit_penalty_bps: number
          estimated_roi_bps: number
          exit_notice_days: number
          full_details: string
          id: string
          is_public: boolean
          location: string
          min_units_per_investor: number | null
          name: string
          pay_account: Json | null
          platform_fee_bps: number | null
          pledge_expiry_hours: number | null
          profit_split_investor_bps: number
          progress_started_at: string | null
          raised_minor: number
          realised_profit_minor: number
          rejected_at: string | null
          rejected_by: string | null
          rejection_note: string | null
          risks: string
          sector: string
          stage: Database["public"]["Enums"]["project_stage"]
          submitted_at: string | null
          summary: string
          target_minor: number
          timeline: string
          total_units: number | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "projects"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      approval_status: "PENDING" | "APPROVED" | "REJECTED"
      doc_kind: "OVERVIEW" | "FUND_USE" | "RISK" | "DECISION"
      duration_unit: "DAYS" | "WEEKS" | "MONTHS"
      invite_status:
        | "INVITED"
        | "ACCEPTED"
        | "COMMITTED"
        | "PROOF_SUBMITTED"
        | "CONFIRMED"
        | "DECLINED"
      project_stage: "INITIATION" | "ACCEPTANCE" | "PROGRESS" | "END"
      project_update_kind:
        | "RISK"
        | "FUND_USE"
        | "ENGAGEMENT"
        | "MILESTONE"
        | "ANNOUNCEMENT"
      task_kind: "REVIEW_PROJECT" | "CONFIRM_PAYMENT_PROOF"
      task_status: "OPEN" | "COMPLETED" | "CANCELLED"
      user_role: "CEO" | "ADMIN" | "LINE_MANAGER" | "INVESTOR"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null
          avif_autodetection: boolean | null
          created_at: string | null
          file_size_limit: number | null
          id: string
          name: string
          owner: string | null
          owner_id: string | null
          public: boolean | null
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string | null
        }
        Insert: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id: string
          name: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Update: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id?: string
          name?: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Relationships: []
      }
      buckets_analytics: {
        Row: {
          created_at: string
          deleted_at: string | null
          format: string
          id: string
          name: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      buckets_vectors: {
        Row: {
          created_at: string
          id: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          bucket_id: string | null
          created_at: string | null
          id: string
          last_accessed_at: string | null
          metadata: Json | null
          name: string | null
          owner: string | null
          owner_id: string | null
          path_tokens: string[] | null
          updated_at: string | null
          user_metadata: Json | null
          version: string | null
        }
        Insert: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Update: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          in_progress_size: number
          key: string
          metadata: Json | null
          owner_id: string | null
          upload_signature: string
          user_metadata: Json | null
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id: string
          in_progress_size?: number
          key: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature: string
          user_metadata?: Json | null
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          in_progress_size?: number
          key?: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature?: string
          user_metadata?: Json | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string
          created_at: string
          etag: string
          id: string
          key: string
          owner_id: string | null
          part_number: number
          size: number
          upload_id: string
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          etag: string
          id?: string
          key: string
          owner_id?: string | null
          part_number: number
          size?: number
          upload_id: string
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          etag?: string
          id?: string
          key?: string
          owner_id?: string | null
          part_number?: number
          size?: number
          upload_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "s3_multipart_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      vector_indexes: {
        Row: {
          bucket_id: string
          created_at: string
          data_type: string
          dimension: number
          distance_metric: string
          id: string
          metadata_configuration: Json | null
          name: string
          updated_at: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          data_type: string
          dimension: number
          distance_metric: string
          id?: string
          metadata_configuration?: Json | null
          name: string
          updated_at?: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          data_type?: string
          dimension?: number
          distance_metric?: string
          id?: string
          metadata_configuration?: Json | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vector_indexes_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets_vectors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      allow_any_operation: {
        Args: { expected_operations: string[] }
        Returns: boolean
      }
      allow_only_operation: {
        Args: { expected_operation: string }
        Returns: boolean
      }
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string }
        Returns: undefined
      }
      extension: { Args: { name: string }; Returns: string }
      filename: { Args: { name: string }; Returns: string }
      foldername: { Args: { name: string }; Returns: string[] }
      get_common_prefix: {
        Args: { p_delimiter: string; p_key: string; p_prefix: string }
        Returns: string
      }
      get_size_by_bucket: {
        Args: never
        Returns: {
          bucket_id: string
          size: number
        }[]
      }
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_key_token?: string
          next_upload_token?: string
          prefix_param: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
        }[]
      }
      list_objects_with_delimiter: {
        Args: {
          _bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_token?: string
          prefix_param: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      operation: { Args: never; Returns: string }
      search: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_by_timestamp: {
        Args: {
          p_bucket_id: string
          p_level: number
          p_limit: number
          p_prefix: string
          p_sort_column: string
          p_sort_column_after: string
          p_sort_order: string
          p_start_after: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_v2: {
        Args: {
          bucket_name: string
          levels?: number
          limits?: number
          prefix: string
          sort_column?: string
          sort_column_after?: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
    }
    Enums: {
      buckettype: "STANDARD" | "ANALYTICS" | "VECTOR"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      approval_status: ["PENDING", "APPROVED", "REJECTED"],
      doc_kind: ["OVERVIEW", "FUND_USE", "RISK", "DECISION"],
      duration_unit: ["DAYS", "WEEKS", "MONTHS"],
      invite_status: [
        "INVITED",
        "ACCEPTED",
        "COMMITTED",
        "PROOF_SUBMITTED",
        "CONFIRMED",
        "DECLINED",
      ],
      project_stage: ["INITIATION", "ACCEPTANCE", "PROGRESS", "END"],
      project_update_kind: [
        "RISK",
        "FUND_USE",
        "ENGAGEMENT",
        "MILESTONE",
        "ANNOUNCEMENT",
      ],
      task_kind: ["REVIEW_PROJECT", "CONFIRM_PAYMENT_PROOF"],
      task_status: ["OPEN", "COMPLETED", "CANCELLED"],
      user_role: ["CEO", "ADMIN", "LINE_MANAGER", "INVESTOR"],
    },
  },
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS", "VECTOR"],
    },
  },
} as const
