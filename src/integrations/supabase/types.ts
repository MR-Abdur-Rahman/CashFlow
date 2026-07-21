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
      accounts: {
        Row: {
          created_at: string
          current_balance: number
          icon_color: string | null
          icon_name: string | null
          icon_type: string
          icon_url: string | null
          id: string
          institution: string | null
          label: string
          opening_balance: number
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_balance?: number
          icon_color?: string | null
          icon_name?: string | null
          icon_type?: string
          icon_url?: string | null
          id?: string
          institution?: string | null
          label: string
          opening_balance?: number
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_balance?: number
          icon_color?: string | null
          icon_name?: string | null
          icon_type?: string
          icon_url?: string | null
          id?: string
          institution?: string | null
          label?: string
          opening_balance?: number
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          is_default: boolean
          name: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          is_default?: boolean
          name: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          is_default?: boolean
          name?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          id: string
          member_user_id: string | null
          person_id: string
        }
        Insert: {
          group_id: string
          id?: string
          member_user_id?: string | null
          person_id: string
        }
        Update: {
          group_id?: string
          id?: string
          member_user_id?: string | null
          person_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_member_user_id_fkey"
            columns: ["member_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          avatar_url: string | null
          created_at: string
          created_by: string
          id: string
          is_archived: boolean
          name: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_by: string
          id?: string
          is_archived?: boolean
          name: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string
          id?: string
          is_archived?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string | null
          daily_expense_reminder: boolean | null
          daily_expense_reminder_time: string | null
          id: string
          settlement_reminders: boolean | null
          split_notifications: boolean | null
          toast_account_selection: boolean | null
          toast_delete_attempt: boolean | null
          toast_payment_reminder: boolean | null
          toast_settlement_bank: boolean | null
          toast_settlement_cash: boolean | null
          toast_settlement_ewallet: boolean | null
          toast_split_added: boolean | null
          toast_split_deleted: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          daily_expense_reminder?: boolean | null
          daily_expense_reminder_time?: string | null
          id?: string
          settlement_reminders?: boolean | null
          split_notifications?: boolean | null
          toast_account_selection?: boolean | null
          toast_delete_attempt?: boolean | null
          toast_payment_reminder?: boolean | null
          toast_settlement_bank?: boolean | null
          toast_settlement_cash?: boolean | null
          toast_settlement_ewallet?: boolean | null
          toast_split_added?: boolean | null
          toast_split_deleted?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          daily_expense_reminder?: boolean | null
          daily_expense_reminder_time?: string | null
          id?: string
          settlement_reminders?: boolean | null
          split_notifications?: boolean | null
          toast_account_selection?: boolean | null
          toast_delete_attempt?: boolean | null
          toast_payment_reminder?: boolean | null
          toast_settlement_bank?: boolean | null
          toast_settlement_cash?: boolean | null
          toast_settlement_ewallet?: boolean | null
          toast_split_added?: boolean | null
          toast_split_deleted?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          related_settlement_id: string | null
          related_split_id: string | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          related_settlement_id?: string | null
          related_split_id?: string | null
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          related_settlement_id?: string | null
          related_split_id?: string | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_related_settlement_id_fkey"
            columns: ["related_settlement_id"]
            isOneToOne: false
            referencedRelation: "settlements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_split_id_fkey"
            columns: ["related_split_id"]
            isOneToOne: false
            referencedRelation: "splits"
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
      people: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          linked_user_id: string | null
          name: string
          nickname: string | null
          phone_number: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          linked_user_id?: string | null
          name: string
          nickname?: string | null
          phone_number?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          linked_user_id?: string | null
          name?: string
          nickname?: string | null
          phone_number?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_linked_user_id_fkey"
            columns: ["linked_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_visibility_exceptions: {
        Row: {
          created_at: string
          excluded_user_id: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          excluded_user_id: string
          owner_id: string
        }
        Update: {
          created_at?: string
          excluded_user_id?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "phone_visibility_exceptions_excluded_user_id_fkey"
            columns: ["excluded_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phone_visibility_exceptions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_visibility_exceptions: {
        Row: {
          created_at: string
          excluded_user_id: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          excluded_user_id: string
          owner_id: string
        }
        Update: {
          created_at?: string
          excluded_user_id?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_visibility_exceptions_excluded_user_id_fkey"
            columns: ["excluded_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_visibility_exceptions_owner_id_fkey"
            columns: ["owner_id"]
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
          currency_code: string
          currency_symbol: string
          daily_reminder_time: string | null
          decimal_places: number
          full_name: string | null
          google_email: string | null
          id: string
          notification_prefs: Json | null
          notify_daily: boolean
          notify_settlement: boolean
          notify_splits: boolean
          onboarded_at: string | null
          phone_number: string | null
          phone_share_enabled: boolean
          phone_share_scope: string
          profile_share_enabled: boolean
          reminder_methods: string[]
          theme: string
          thousand_separator: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          currency_code?: string
          currency_symbol?: string
          daily_reminder_time?: string | null
          decimal_places?: number
          full_name?: string | null
          google_email?: string | null
          id: string
          notification_prefs?: Json | null
          notify_daily?: boolean
          notify_settlement?: boolean
          notify_splits?: boolean
          onboarded_at?: string | null
          phone_number?: string | null
          phone_share_enabled?: boolean
          phone_share_scope?: string
          profile_share_enabled?: boolean
          reminder_methods?: string[]
          theme?: string
          thousand_separator?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          currency_code?: string
          currency_symbol?: string
          daily_reminder_time?: string | null
          decimal_places?: number
          full_name?: string | null
          google_email?: string | null
          id?: string
          notification_prefs?: Json | null
          notify_daily?: boolean
          notify_settlement?: boolean
          notify_splits?: boolean
          onboarded_at?: string | null
          phone_number?: string | null
          phone_share_enabled?: boolean
          phone_share_scope?: string
          profile_share_enabled?: boolean
          reminder_methods?: string[]
          theme?: string
          thousand_separator?: string
          updated_at?: string
        }
        Relationships: []
      }
      scheduled_transactions: {
        Row: {
          account_id: string
          amount: number
          category_id: string | null
          created_at: string
          day_of_month: number
          description: string | null
          id: string
          income_person_id: string | null
          income_source_text: string | null
          income_source_type: string | null
          is_active: boolean
          last_posted_date: string | null
          note: string | null
          pending_confirmation: boolean
          scheduled_time: string
          sub_category_id: string | null
          to_account_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          category_id?: string | null
          created_at?: string
          day_of_month: number
          description?: string | null
          id?: string
          income_person_id?: string | null
          income_source_text?: string | null
          income_source_type?: string | null
          is_active?: boolean
          last_posted_date?: string | null
          note?: string | null
          pending_confirmation?: boolean
          scheduled_time: string
          sub_category_id?: string | null
          to_account_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          category_id?: string | null
          created_at?: string
          day_of_month?: number
          description?: string | null
          id?: string
          income_person_id?: string | null
          income_source_text?: string | null
          income_source_type?: string | null
          is_active?: boolean
          last_posted_date?: string | null
          note?: string | null
          pending_confirmation?: boolean
          scheduled_time?: string
          sub_category_id?: string | null
          to_account_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_transactions_sub_category_id_fkey"
            columns: ["sub_category_id"]
            isOneToOne: false
            referencedRelation: "sub_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_transactions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      settlement_reminders: {
        Row: {
          channel: string
          created_at: string
          id: string
          message: string | null
          person_id: string | null
          split_id: string
          split_share_id: string | null
          user_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          id?: string
          message?: string | null
          person_id?: string | null
          split_id: string
          split_share_id?: string | null
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          message?: string | null
          person_id?: string | null
          split_id?: string
          split_share_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlement_reminders_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_reminders_split_id_fkey"
            columns: ["split_id"]
            isOneToOne: false
            referencedRelation: "splits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_reminders_split_share_id_fkey"
            columns: ["split_share_id"]
            isOneToOne: false
            referencedRelation: "split_shares"
            referencedColumns: ["id"]
          },
        ]
      }
      settlements: {
        Row: {
          account_id: string | null
          amount: number
          created_at: string
          created_by: string
          description: string | null
          id: string
          method: string
          note: string | null
          pending_for_user_id: string | null
          person_id: string | null
          receiver_account_id: string | null
          receiver_account_pending: boolean
          receiver_confirmed_at: string | null
          settler_is_creditor: boolean
          split_id: string | null
          split_share_id: string | null
        }
        Insert: {
          account_id?: string | null
          amount: number
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          method: string
          note?: string | null
          pending_for_user_id?: string | null
          person_id?: string | null
          receiver_account_id?: string | null
          receiver_account_pending?: boolean
          receiver_confirmed_at?: string | null
          settler_is_creditor?: boolean
          split_id?: string | null
          split_share_id?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          method?: string
          note?: string | null
          pending_for_user_id?: string | null
          person_id?: string | null
          receiver_account_id?: string | null
          receiver_account_pending?: boolean
          receiver_confirmed_at?: string | null
          settler_is_creditor?: boolean
          split_id?: string | null
          split_share_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "settlements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_pending_for_user_id_fkey"
            columns: ["pending_for_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_receiver_account_id_fkey"
            columns: ["receiver_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_split_id_fkey"
            columns: ["split_id"]
            isOneToOne: false
            referencedRelation: "splits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_split_share_id_fkey"
            columns: ["split_share_id"]
            isOneToOne: false
            referencedRelation: "split_shares"
            referencedColumns: ["id"]
          },
        ]
      }
      split_shares: {
        Row: {
          id: string
          is_settled: boolean
          person_id: string | null
          person_name: string
          settled_at: string | null
          share_amount: number
          split_id: string
        }
        Insert: {
          id?: string
          is_settled?: boolean
          person_id?: string | null
          person_name: string
          settled_at?: string | null
          share_amount: number
          split_id: string
        }
        Update: {
          id?: string
          is_settled?: boolean
          person_id?: string | null
          person_name?: string
          settled_at?: string | null
          share_amount?: number
          split_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "split_shares_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "split_shares_split_id_fkey"
            columns: ["split_id"]
            isOneToOne: false
            referencedRelation: "splits"
            referencedColumns: ["id"]
          },
        ]
      }
      splits: {
        Row: {
          account_confirmed_at: string | null
          account_id: string | null
          account_pending: boolean
          category_id: string | null
          created_at: string
          created_by: string
          date: string
          description: string | null
          group_id: string | null
          id: string
          paid_by: string
          paid_by_person_id: string | null
          pending_for_user_id: string | null
          person_id: string | null
          split_type: string
          sub_category_id: string | null
          time: string
          total_amount: number
          type: string
        }
        Insert: {
          account_confirmed_at?: string | null
          account_id?: string | null
          account_pending?: boolean
          category_id?: string | null
          created_at?: string
          created_by: string
          date?: string
          description?: string | null
          group_id?: string | null
          id?: string
          paid_by: string
          paid_by_person_id?: string | null
          pending_for_user_id?: string | null
          person_id?: string | null
          split_type: string
          sub_category_id?: string | null
          time?: string
          total_amount: number
          type: string
        }
        Update: {
          account_confirmed_at?: string | null
          account_id?: string | null
          account_pending?: boolean
          category_id?: string | null
          created_at?: string
          created_by?: string
          date?: string
          description?: string | null
          group_id?: string | null
          id?: string
          paid_by?: string
          paid_by_person_id?: string | null
          pending_for_user_id?: string | null
          person_id?: string | null
          split_type?: string
          sub_category_id?: string | null
          time?: string
          total_amount?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "splits_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "splits_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "splits_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "splits_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "splits_paid_by_person_id_fkey"
            columns: ["paid_by_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "splits_pending_for_user_id_fkey"
            columns: ["pending_for_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "splits_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "splits_sub_category_id_fkey"
            columns: ["sub_category_id"]
            isOneToOne: false
            referencedRelation: "sub_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      sub_categories: {
        Row: {
          category_id: string
          created_at: string
          icon: string | null
          id: string
          is_default: boolean
          name: string
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          icon?: string | null
          id?: string
          is_default?: boolean
          name: string
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          icon?: string | null
          id?: string
          is_default?: boolean
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_categories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string | null
          amount: number
          category_id: string | null
          created_at: string
          date: string
          id: string
          income_person_id: string | null
          income_source_text: string | null
          income_source_type: string | null
          is_split: boolean
          note: string | null
          split_id: string | null
          sub_category_id: string | null
          time: string
          to_account_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          category_id?: string | null
          created_at?: string
          date?: string
          id?: string
          income_person_id?: string | null
          income_source_text?: string | null
          income_source_type?: string | null
          is_split?: boolean
          note?: string | null
          split_id?: string | null
          sub_category_id?: string | null
          time?: string
          to_account_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category_id?: string | null
          created_at?: string
          date?: string
          id?: string
          income_person_id?: string | null
          income_source_text?: string | null
          income_source_type?: string | null
          is_split?: boolean
          note?: string | null
          split_id?: string | null
          sub_category_id?: string | null
          time?: string
          to_account_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_income_person_id_fkey"
            columns: ["income_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_split_id_fkey"
            columns: ["split_id"]
            isOneToOne: false
            referencedRelation: "splits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_sub_category_id_fkey"
            columns: ["sub_category_id"]
            isOneToOne: false
            referencedRelation: "sub_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_see_person_via_split: {
        Args: { p_person_id: string }
        Returns: boolean
      }
      can_see_split: { Args: { _split_id: string }; Returns: boolean }
      contact_phones: {
        Args: { target_ids: string[] }
        Returns: {
          phone_number: string
          user_id: string
        }[]
      }
      contact_profiles: {
        Args: { target_ids: string[] }
        Returns: {
          avatar_url: string
          full_name: string
          user_id: string
        }[]
      }
      create_mutual_connection: {
        Args: {
          scanned_name: string
          scanned_phone: string
          scanned_user_id: string
          scanner_name: string
          scanner_phone: string
          scanner_user_id: string
        }
        Returns: undefined
      }
      delete_settlement: {
        Args: { p_settlement_id: string }
        Returns: undefined
      }
      delete_split: { Args: { p_split_id: string }; Returns: undefined }
      has_unsettled_splits: { Args: { _user_id: string }; Returns: boolean }
      is_group_member: { Args: { gid: string }; Returns: boolean }
      my_phone: { Args: never; Returns: string }
      seed_default_categories: { Args: { p_user: string }; Returns: undefined }
      sync_group_member_connections: {
        Args: { p_group_id: string }
        Returns: undefined
      }
      update_split: {
        Args: {
          p_category_id: string
          p_date: string
          p_description: string
          p_group_id: string
          p_person_id: string
          p_shares: Json
          p_split_id: string
          p_split_type: string
          p_sub_category_id: string
          p_time: string
          p_total_amount: number
          p_type: string
        }
        Returns: undefined
      }
      user_participates_in_split: {
        Args: { p_split_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
