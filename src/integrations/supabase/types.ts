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
          person_id: string
        }
        Insert: {
          group_id: string
          id?: string
          person_id: string
        }
        Update: {
          group_id?: string
          id?: string
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
          created_at: string
          created_by: string
          id: string
          is_archived: boolean
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_archived?: boolean
          name: string
        }
        Update: {
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
      people: {
        Row: {
          created_at: string
          id: string
          linked_user_id: string | null
          name: string
          phone_number: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          linked_user_id?: string | null
          name: string
          phone_number?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          linked_user_id?: string | null
          name?: string
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
          notify_daily: boolean
          notify_settlement: boolean
          notify_splits: boolean
          phone_number: string | null
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
          notify_daily?: boolean
          notify_settlement?: boolean
          notify_splits?: boolean
          phone_number?: string | null
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
          notify_daily?: boolean
          notify_settlement?: boolean
          notify_splits?: boolean
          phone_number?: string | null
          theme?: string
          thousand_separator?: string
          updated_at?: string
        }
        Relationships: []
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
          receiver_account_id: string | null
          receiver_account_pending: boolean
          receiver_confirmed_at: string | null
          split_id: string
          split_share_id: string
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
          receiver_account_id?: string | null
          receiver_account_pending?: boolean
          receiver_confirmed_at?: string | null
          split_id: string
          split_share_id: string
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
          receiver_account_id?: string | null
          receiver_account_pending?: boolean
          receiver_confirmed_at?: string | null
          split_id?: string
          split_share_id?: string
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
          description: string
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
          description: string
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
          description?: string
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
          id: string
          is_default: boolean
          name: string
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
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
          account_id: string
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
          account_id: string
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
          account_id?: string
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
      can_see_split: { Args: { _split_id: string }; Returns: boolean }
      delete_split: { Args: { p_split_id: string }; Returns: undefined }
      has_unsettled_splits: { Args: { _user_id: string }; Returns: boolean }
      run_rls_tests: {
        Args: never
        Returns: {
          detail: string
          passed: boolean
          test_name: string
        }[]
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
