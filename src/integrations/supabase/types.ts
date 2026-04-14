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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      appointment_treatments: {
        Row: {
          appointment_id: string
          created_at: string
          duration_minutes: number
          id: string
          price: number
          treatment_id: string
        }
        Insert: {
          appointment_id: string
          created_at?: string
          duration_minutes: number
          id?: string
          price?: number
          treatment_id: string
        }
        Update: {
          appointment_id?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          price?: number
          treatment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_treatments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_treatments_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          appointment_date: string
          booked_by_admin: boolean
          client_id: string
          created_at: string
          end_time: string
          id: string
          notes: string | null
          start_time: string
          status: string
          treatment_id: string
          updated_at: string
        }
        Insert: {
          appointment_date: string
          booked_by_admin?: boolean
          client_id: string
          created_at?: string
          end_time: string
          id?: string
          notes?: string | null
          start_time: string
          status?: string
          treatment_id: string
          updated_at?: string
        }
        Update: {
          appointment_date?: string
          booked_by_admin?: boolean
          client_id?: string
          created_at?: string
          end_time?: string
          id?: string
          notes?: string | null
          start_time?: string
          status?: string
          treatment_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      business_settings: {
        Row: {
          admin_email: string | null
          admin_phone: string | null
          advance_booking_days: number
          break_end: string | null
          break_start: string | null
          business_name: string
          cancellation_hours: number
          created_at: string
          custom_texts: Json | null
          day_schedules: Json | null
          end_time: string
          font_family: string | null
          id: string
          primary_color: string | null
          secondary_color: string | null
          slot_duration_minutes: number
          start_time: string
          updated_at: string
          working_days: number[]
        }
        Insert: {
          admin_email?: string | null
          admin_phone?: string | null
          advance_booking_days?: number
          break_end?: string | null
          break_start?: string | null
          business_name?: string
          cancellation_hours?: number
          created_at?: string
          custom_texts?: Json | null
          day_schedules?: Json | null
          end_time?: string
          font_family?: string | null
          id?: string
          primary_color?: string | null
          secondary_color?: string | null
          slot_duration_minutes?: number
          start_time?: string
          updated_at?: string
          working_days?: number[]
        }
        Update: {
          admin_email?: string | null
          admin_phone?: string | null
          advance_booking_days?: number
          break_end?: string | null
          break_start?: string | null
          business_name?: string
          cancellation_hours?: number
          created_at?: string
          custom_texts?: Json | null
          day_schedules?: Json | null
          end_time?: string
          font_family?: string | null
          id?: string
          primary_color?: string | null
          secondary_color?: string | null
          slot_duration_minutes?: number
          start_time?: string
          updated_at?: string
          working_days?: number[]
        }
        Relationships: []
      }
      notification_log: {
        Row: {
          appointment_id: string | null
          channel: string
          created_at: string
          id: string
          payload: Json | null
          scheduled_at: string | null
          sent_at: string | null
          status: string
          type: string
          user_id: string
        }
        Insert: {
          appointment_id?: string | null
          channel?: string
          created_at?: string
          id?: string
          payload?: Json | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          type?: string
          user_id: string
        }
        Update: {
          appointment_id?: string | null
          channel?: string
          created_at?: string
          id?: string
          payload?: Json | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          email_enabled: boolean
          id: string
          sms_enabled: boolean
          updated_at: string
          user_id: string
          whatsapp_enabled: boolean
        }
        Insert: {
          created_at?: string
          email_enabled?: boolean
          id?: string
          sms_enabled?: boolean
          updated_at?: string
          user_id: string
          whatsapp_enabled?: boolean
        }
        Update: {
          created_at?: string
          email_enabled?: boolean
          id?: string
          sms_enabled?: boolean
          updated_at?: string
          user_id?: string
          whatsapp_enabled?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          reminder_preference: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          reminder_preference?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          reminder_preference?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      time_blocks: {
        Row: {
          block_date: string
          created_at: string | null
          end_time: string
          id: string
          notes: string | null
          start_time: string
        }
        Insert: {
          block_date: string
          created_at?: string | null
          end_time: string
          id?: string
          notes?: string | null
          start_time: string
        }
        Update: {
          block_date?: string
          created_at?: string | null
          end_time?: string
          id?: string
          notes?: string | null
          start_time?: string
        }
        Relationships: []
      }
      treatment_price_tiers: {
        Row: {
          created_at: string
          id: string
          max_minutes: number
          min_minutes: number
          price_per_minute: number
          treatment_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          max_minutes: number
          min_minutes?: number
          price_per_minute?: number
          treatment_id: string
        }
        Update: {
          created_at?: string
          id?: string
          max_minutes?: number
          min_minutes?: number
          price_per_minute?: number
          treatment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_price_tiers_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      treatments: {
        Row: {
          category: string | null
          color: string | null
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          is_active: boolean
          is_variable_duration: boolean
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          category?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          is_variable_duration?: boolean
          name: string
          price?: number
          updated_at?: string
        }
        Update: {
          category?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          is_variable_duration?: boolean
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          client_id: string
          created_at: string
          id: string
          notes: string | null
          preferred_date: string | null
          preferred_time_end: string | null
          preferred_time_start: string | null
          status: string
          treatment_id: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          notes?: string | null
          preferred_date?: string | null
          preferred_time_end?: string | null
          preferred_time_start?: string | null
          status?: string
          treatment_id?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          preferred_date?: string | null
          preferred_time_end?: string | null
          preferred_time_start?: string | null
          status?: string
          treatment_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "client"
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
      app_role: ["admin", "client"],
    },
  },
} as const
