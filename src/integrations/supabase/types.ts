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
      assignments: {
        Row: {
          attachments: Json | null
          created_at: string | null
          deleted_at: string | null
          description: string | null
          due_date: string | null
          has_attachments: boolean | null
          id: string
          status: string
          student_user_id: string
          subject: string | null
          submission_attachments: Json | null
          teacher_user_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          attachments?: Json | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          has_attachments?: boolean | null
          id?: string
          status?: string
          student_user_id: string
          subject?: string | null
          submission_attachments?: Json | null
          teacher_user_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          attachments?: Json | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          has_attachments?: boolean | null
          id?: string
          status?: string
          student_user_id?: string
          subject?: string | null
          submission_attachments?: Json | null
          teacher_user_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      attendance_records: {
        Row: {
          created_at: string | null
          date: string
          deleted_at: string | null
          hours: number | null
          id: string
          status: string
          student_user_id: string
          teacher_user_id: string
          topic: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          deleted_at?: string | null
          hours?: number | null
          id?: string
          status: string
          student_user_id: string
          teacher_user_id: string
          topic?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          deleted_at?: string | null
          hours?: number | null
          id?: string
          status?: string
          student_user_id?: string
          teacher_user_id?: string
          topic?: string | null
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string | null
          id: string
          student_user_id: string
          teacher_user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          student_user_id: string
          teacher_user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          student_user_id?: string
          teacher_user_id?: string
        }
        Relationships: []
      }
      demo_requests: {
        Row: {
          age: string
          created_at: string | null
          days: string
          grade: string
          id: string
          parent_email: string
          parent_name: string
          phone: string
          status: string | null
          student_name: string
          subject: string
          timing: string
        }
        Insert: {
          age: string
          created_at?: string | null
          days: string
          grade: string
          id?: string
          parent_email: string
          parent_name: string
          phone: string
          status?: string | null
          student_name: string
          subject: string
          timing: string
        }
        Update: {
          age?: string
          created_at?: string | null
          days?: string
          grade?: string
          id?: string
          parent_email?: string
          parent_name?: string
          phone?: string
          status?: string | null
          student_name?: string
          subject?: string
          timing?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          assignment_id: string | null
          created_at: string | null
          created_by: string
          description: string | null
          end_time: string | null
          event_type: string
          id: string
          start_time: string
          student_user_id: string
          teacher_user_id: string | null
          title: string
        }
        Insert: {
          assignment_id?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          end_time?: string | null
          event_type: string
          id?: string
          start_time: string
          student_user_id: string
          teacher_user_id?: string | null
          title: string
        }
        Update: {
          assignment_id?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          end_time?: string | null
          event_type?: string
          id?: string
          start_time?: string
          student_user_id?: string
          teacher_user_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          deleted_for_role: string | null
          edited_at: string | null
          id: string
          original_content: string | null
          read_at: string | null
          receiver_user_id: string
          sender_user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_for_role?: string | null
          edited_at?: string | null
          id?: string
          original_content?: string | null
          read_at?: string | null
          receiver_user_id: string
          sender_user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_for_role?: string | null
          edited_at?: string | null
          id?: string
          original_content?: string | null
          read_at?: string | null
          receiver_user_id?: string
          sender_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          created_at: string
          deleted_at: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          grade: string | null
          id: string
          storage_path: string
          student_user_id: string | null
          subject: string | null
          teacher_user_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          grade?: string | null
          id?: string
          storage_path: string
          student_user_id?: string | null
          subject?: string | null
          teacher_user_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          grade?: string | null
          id?: string
          storage_path?: string
          student_user_id?: string | null
          subject?: string | null
          teacher_user_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string | null
          entity_id: string | null
          entity_table: string | null
          id: string
          is_read: boolean | null
          recipient_id: string
          role_target: string | null
          sender_id: string | null
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_table?: string | null
          id?: string
          is_read?: boolean | null
          recipient_id: string
          role_target?: string | null
          sender_id?: string | null
          title: string
          type: string
        }
        Update: {
          body?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_table?: string | null
          id?: string
          is_read?: boolean | null
          recipient_id?: string
          role_target?: string | null
          sender_id?: string | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          full_name: string | null
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          full_name?: string | null
          phone?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          full_name?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      student_fee_invoice_rows: {
        Row: {
          class_date: string
          created_at: string
          hours: number
          id: string
          invoice_id: string
          row_order: number
          topic: string
        }
        Insert: {
          class_date: string
          created_at?: string
          hours?: number
          id?: string
          invoice_id: string
          row_order?: number
          topic?: string
        }
        Update: {
          class_date?: string
          created_at?: string
          hours?: number
          id?: string
          invoice_id?: string
          row_order?: number
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_fee_invoice_rows_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "student_fee_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      student_fee_invoices: {
        Row: {
          admin_notes: string | null
          created_at: string
          created_by_admin_user_id: string
          deleted_at: string | null
          fee_per_hour: number
          id: string
          reviewed_at: string | null
          sent_at: string | null
          status: string
          student_name: string
          student_notes: string | null
          student_user_id: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          created_by_admin_user_id: string
          deleted_at?: string | null
          fee_per_hour?: number
          id?: string
          reviewed_at?: string | null
          sent_at?: string | null
          status?: string
          student_name: string
          student_notes?: string | null
          student_user_id: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          created_by_admin_user_id?: string
          deleted_at?: string | null
          fee_per_hour?: number
          id?: string
          reviewed_at?: string | null
          sent_at?: string | null
          status?: string
          student_name?: string
          student_notes?: string | null
          student_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      student_fees: {
        Row: {
          admin_viewed_at: string | null
          class_dates: string | null
          created_at: string | null
          deleted_at: string | null
          fee_per_hour: number | null
          id: string
          month: string
          status: string | null
          student_ack_status: string | null
          student_id: string
          student_name: string | null
          subjects: string | null
          teacher_id: string
          teacher_name: string | null
          total_amount: number | null
          total_hours: number | null
        }
        Insert: {
          admin_viewed_at?: string | null
          class_dates?: string | null
          created_at?: string | null
          deleted_at?: string | null
          fee_per_hour?: number | null
          id?: string
          month: string
          status?: string | null
          student_ack_status?: string | null
          student_id: string
          student_name?: string | null
          subjects?: string | null
          teacher_id: string
          teacher_name?: string | null
          total_amount?: number | null
          total_hours?: number | null
        }
        Update: {
          admin_viewed_at?: string | null
          class_dates?: string | null
          created_at?: string | null
          deleted_at?: string | null
          fee_per_hour?: number | null
          id?: string
          month?: string
          status?: string | null
          student_ack_status?: string | null
          student_id?: string
          student_name?: string | null
          subjects?: string | null
          teacher_id?: string
          teacher_name?: string | null
          total_amount?: number | null
          total_hours?: number | null
        }
        Relationships: []
      }
      student_profiles: {
        Row: {
          assigned_teacher_id: string | null
          created_at: string | null
          grade: string | null
          student_name: string
          user_id: string
        }
        Insert: {
          assigned_teacher_id?: string | null
          created_at?: string | null
          grade?: string | null
          student_name: string
          user_id: string
        }
        Update: {
          assigned_teacher_id?: string | null
          created_at?: string | null
          grade?: string | null
          student_name?: string
          user_id?: string
        }
        Relationships: []
      }
      teacher_profiles: {
        Row: {
          availability: string | null
          bio: string | null
          subjects: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          availability?: string | null
          bio?: string | null
          subjects?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          availability?: string | null
          bio?: string | null
          subjects?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      teacher_salary: {
        Row: {
          amount: number | null
          created_at: string | null
          deleted_at: string | null
          id: string
          note: string | null
          num_classes: number | null
          salary_per_hour: number | null
          status: string | null
          teacher_id: string
          teacher_name: string | null
          total_hours: number | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          note?: string | null
          num_classes?: number | null
          salary_per_hour?: number | null
          status?: string | null
          teacher_id: string
          teacher_name?: string | null
          total_hours?: number | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          note?: string | null
          num_classes?: number | null
          salary_per_hour?: number | null
          status?: string | null
          teacher_id?: string
          teacher_name?: string | null
          total_hours?: number | null
        }
        Relationships: []
      }
      whiteboard_shares: {
        Row: {
          deleted_at: string | null
          id: string
          sent_at: string
          student_user_id: string
          teacher_user_id: string
          thumbnail_data: string | null
          title: string
          whiteboard_id: string
        }
        Insert: {
          deleted_at?: string | null
          id?: string
          sent_at?: string
          student_user_id: string
          teacher_user_id: string
          thumbnail_data?: string | null
          title?: string
          whiteboard_id: string
        }
        Update: {
          deleted_at?: string | null
          id?: string
          sent_at?: string
          student_user_id?: string
          teacher_user_id?: string
          thumbnail_data?: string | null
          title?: string
          whiteboard_id?: string
        }
        Relationships: []
      }
      whiteboards: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          image_data: string
          share_token: string | null
          teacher_user_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          image_data: string
          share_token?: string | null
          teacher_user_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          image_data?: string
          share_token?: string | null
          teacher_user_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      zoom_links: {
        Row: {
          deleted_at: string | null
          meeting_id: string | null
          meeting_url: string
          passcode: string | null
          student_user_id: string
          updated_at: string | null
        }
        Insert: {
          deleted_at?: string | null
          meeting_id?: string | null
          meeting_url: string
          passcode?: string | null
          student_user_id: string
          updated_at?: string | null
        }
        Update: {
          deleted_at?: string | null
          meeting_id?: string | null
          meeting_url?: string
          passcode?: string | null
          student_user_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_conversation_participant: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "student" | "teacher" | "admin"
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
      app_role: ["student", "teacher", "admin"],
    },
  },
} as const
