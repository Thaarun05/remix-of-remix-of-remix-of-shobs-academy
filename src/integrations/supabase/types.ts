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
          hours?: number | null
          id?: string
          status?: string
          student_user_id?: string
          teacher_user_id?: string
          topic?: string | null
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
      student_profiles: {
        Row: {
          created_at: string | null
          grade: string | null
          student_name: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          grade?: string | null
          student_name: string
          user_id: string
        }
        Update: {
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
      zoom_links: {
        Row: {
          meeting_id: string | null
          meeting_url: string
          passcode: string | null
          student_user_id: string
          updated_at: string | null
        }
        Insert: {
          meeting_id?: string | null
          meeting_url: string
          passcode?: string | null
          student_user_id: string
          updated_at?: string | null
        }
        Update: {
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
