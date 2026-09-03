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
      assignment_completions: {
        Row: {
          assignment_id: string
          completed_at: string
          created_at: string
          id: string
          note: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          assignment_id: string
          completed_at?: string
          created_at?: string
          id?: string
          note?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          assignment_id?: string
          completed_at?: string
          created_at?: string
          id?: string
          note?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_completions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          class_id: string
          created_at: string
          created_by: string | null
          description: string | null
          due_at: string
          id: string
          link_url: string | null
          subject_id: string
          title: string
          type: Database["public"]["Enums"]["assignment_type"]
          updated_at: string
          updated_by: string | null
          weight: number | null
        }
        Insert: {
          class_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at: string
          id?: string
          link_url?: string | null
          subject_id: string
          title: string
          type?: Database["public"]["Enums"]["assignment_type"]
          updated_at?: string
          updated_by?: string | null
          weight?: number | null
        }
        Update: {
          class_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string
          id?: string
          link_url?: string | null
          subject_id?: string
          title?: string
          type?: Database["public"]["Enums"]["assignment_type"]
          updated_at?: string
          updated_by?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          changes: Json | null
          class_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          summary: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          changes?: Json | null
          class_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          summary?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          changes?: Json | null
          class_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_members: {
        Row: {
          class_id: string
          created_at: string
          created_by: string | null
          id: string
          joined_at: string
          role: Database["public"]["Enums"]["class_role"]
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["class_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["class_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_members_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          course_id: string
          created_at: string
          created_by: string | null
          ends_on: string | null
          grace_days: number
          id: string
          invite_code: string
          is_active: boolean
          monthly_price_cents: number
          name: string
          semester: string
          starts_on: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          course_id: string
          created_at?: string
          created_by?: string | null
          ends_on?: string | null
          grace_days?: number
          id?: string
          invite_code: string
          is_active?: boolean
          monthly_price_cents?: number
          name: string
          semester: string
          starts_on?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string
          created_by?: string | null
          ends_on?: string | null
          grace_days?: number
          id?: string
          invite_code?: string
          is_active?: boolean
          monthly_price_cents?: number
          name?: string
          semester?: string
          starts_on?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          created_at: string
          created_by: string | null
          degree: string | null
          id: string
          institution_id: string
          name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          degree?: string | null
          id?: string
          institution_id: string
          name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          degree?: string | null
          id?: string
          institution_id?: string
          name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      institutions: {
        Row: {
          city: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          short_name: string | null
          state: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          short_name?: string | null
          state?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          short_name?: string | null
          state?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      notification_log: {
        Row: {
          assignment_id: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          dedupe_key: string
          error: string | null
          id: string
          kind: Database["public"]["Enums"]["notification_kind"]
          sent_at: string
          user_id: string
        }
        Insert: {
          assignment_id?: string | null
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          dedupe_key: string
          error?: string | null
          id?: string
          kind: Database["public"]["Enums"]["notification_kind"]
          sent_at?: string
          user_id: string
        }
        Update: {
          assignment_id?: string | null
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          dedupe_key?: string
          error?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          sent_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          billing_alerts: boolean
          created_at: string
          email_enabled: boolean
          id: string
          remind_1_day: boolean
          remind_3_days: boolean
          remind_7_days: boolean
          updated_at: string
          user_id: string
          weekly_digest: boolean
        }
        Insert: {
          billing_alerts?: boolean
          created_at?: string
          email_enabled?: boolean
          id?: string
          remind_1_day?: boolean
          remind_3_days?: boolean
          remind_7_days?: boolean
          updated_at?: string
          user_id: string
          weekly_digest?: boolean
        }
        Update: {
          billing_alerts?: boolean
          created_at?: string
          email_enabled?: boolean
          id?: string
          remind_1_day?: boolean
          remind_3_days?: boolean
          remind_7_days?: boolean
          updated_at?: string
          user_id?: string
          weekly_digest?: boolean
        }
        Relationships: []
      }
      payment_webhook_events: {
        Row: {
          created_at: string
          event_id: string
          event_type: string | null
          id: string
          payload: Json
          processed_at: string | null
          processing_error: string | null
          provider: string
          provider_charge_id: string | null
          received_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          event_type?: string | null
          id?: string
          payload: Json
          processed_at?: string | null
          processing_error?: string | null
          provider: string
          provider_charge_id?: string | null
          received_at?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          event_type?: string | null
          id?: string
          payload?: Json
          processed_at?: string | null
          processing_error?: string | null
          provider?: string
          provider_charge_id?: string | null
          received_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_cents: number
          class_id: string | null
          created_at: string
          currency: string
          expires_at: string | null
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          paid_at: string | null
          pix_copia_e_cola: string | null
          pix_qr_code: string | null
          provider: string
          provider_charge_id: string | null
          raw_payload: Json | null
          reference_month: string | null
          status: Database["public"]["Enums"]["payment_status"]
          subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          class_id?: string | null
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          paid_at?: string | null
          pix_copia_e_cola?: string | null
          pix_qr_code?: string | null
          provider: string
          provider_charge_id?: string | null
          raw_payload?: Json | null
          reference_month?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          class_id?: string | null
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          paid_at?: string | null
          pix_copia_e_cola?: string | null
          pix_qr_code?: string | null
          provider?: string
          provider_charge_id?: string | null
          raw_payload?: Json | null
          reference_month?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      subjects: {
        Row: {
          class_id: string
          code: string | null
          color: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          professor: string | null
          room: string | null
          schedule: string | null
          updated_at: string
          updated_by: string | null
          workload_hours: number | null
        }
        Insert: {
          class_id: string
          code?: string | null
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          professor?: string | null
          room?: string | null
          schedule?: string | null
          updated_at?: string
          updated_by?: string | null
          workload_hours?: number | null
        }
        Update: {
          class_id?: string
          code?: string | null
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          professor?: string | null
          room?: string | null
          schedule?: string | null
          updated_at?: string
          updated_by?: string | null
          workload_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "subjects_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          amount_cents: number
          blocked_at: string | null
          canceled_at: string | null
          class_id: string
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          grace_days: number
          id: string
          method: Database["public"]["Enums"]["payment_method"] | null
          provider: string | null
          provider_subscription_id: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents?: number
          blocked_at?: string | null
          canceled_at?: string | null
          class_id: string
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          grace_days?: number
          id?: string
          method?: Database["public"]["Enums"]["payment_method"] | null
          provider?: string | null
          provider_subscription_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          blocked_at?: string | null
          canceled_at?: string | null
          class_id?: string
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          grace_days?: number
          id?: string
          method?: Database["public"]["Enums"]["payment_method"] | null
          provider?: string | null
          provider_subscription_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_manage_class: { Args: { _class_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_class_member: { Args: { _class_id: string }; Returns: boolean }
      my_class_ids: { Args: never; Returns: string[] }
    }
    Enums: {
      app_role: "admin"
      assignment_type:
        | "atividade"
        | "prova"
        | "trabalho"
        | "seminario"
        | "outro"
      class_role: "aluno" | "lider" | "vice_lider"
      membership_status: "ativo" | "inativo" | "removido"
      notification_channel: "email"
      notification_kind:
        | "welcome"
        | "assignment_due"
        | "exam_due"
        | "weekly_digest"
        | "billing_due"
        | "billing_blocked"
        | "payment_confirmed"
      payment_method: "pix" | "card"
      payment_status:
        | "pending"
        | "paid"
        | "failed"
        | "refunded"
        | "canceled"
        | "expired"
      subscription_status:
        | "trial"
        | "active"
        | "grace_period"
        | "blocked"
        | "canceled"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin"],
      assignment_type: ["atividade", "prova", "trabalho", "seminario", "outro"],
      class_role: ["aluno", "lider", "vice_lider"],
      membership_status: ["ativo", "inativo", "removido"],
      notification_channel: ["email"],
      notification_kind: [
        "welcome",
        "assignment_due",
        "exam_due",
        "weekly_digest",
        "billing_due",
        "billing_blocked",
        "payment_confirmed",
      ],
      payment_method: ["pix", "card"],
      payment_status: [
        "pending",
        "paid",
        "failed",
        "refunded",
        "canceled",
        "expired",
      ],
      subscription_status: [
        "trial",
        "active",
        "grace_period",
        "blocked",
        "canceled",
      ],
    },
  },
} as const
