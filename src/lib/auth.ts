import { supabase } from "@/integrations/supabase/client";

export type UserRole = "student" | "teacher" | "admin";

export interface UserProfile {
  user_id: string;
  role: UserRole;
  full_name: string | null;
  phone: string | null;
  created_at: string;
}

export interface StudentProfile {
  user_id: string;
  student_name: string;
  grade: string | null;
  created_at: string;
}

export interface TeacherProfile {
  user_id: string;
  subjects: string | null;
  availability: string | null;
  bio: string | null;
  updated_at: string;
}

export async function signUpStudent(
  email: string,
  password: string,
  studentName: string,
  fullName?: string,
  phone?: string,
  grade?: string
) {
  const redirectUrl = `${window.location.origin}/student`;

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectUrl,
    },
  });

  if (authError) throw authError;
  if (!authData.user) throw new Error("No user returned from signup");

  // Create profile
  const { error: profileError } = await supabase.from("profiles").insert({
    user_id: authData.user.id,
    role: "student",
    full_name: fullName || null,
    phone: phone || null,
  });

  if (profileError) throw profileError;

  // Create student profile
  const { error: studentError } = await supabase.from("student_profiles").insert({
    user_id: authData.user.id,
    student_name: studentName,
    grade: grade || null,
  });

  if (studentError) throw studentError;

  return authData;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getUserRole(userId: string): Promise<UserRole | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching user role:", error);
    return null;
  }

  return data?.role as UserRole | null;
}

export async function getStudentProfile(userId: string): Promise<StudentProfile | null> {
  const { data, error } = await supabase
    .from("student_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching student profile:", error);
    return null;
  }

  return data;
}

export async function getTeacherProfile(userId: string): Promise<TeacherProfile | null> {
  const { data, error } = await supabase
    .from("teacher_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching teacher profile:", error);
    return null;
  }

  return data;
}

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
}
