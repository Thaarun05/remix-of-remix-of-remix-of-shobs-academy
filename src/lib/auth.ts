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

export async function signIn(email: string, password: string, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      return data;
    } catch (err: any) {
      const isNetworkError = err?.message === "Failed to fetch" || err?.message?.includes("NetworkError") || err?.message?.includes("network");
      if (isNetworkError && attempt < retries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      if (isNetworkError) {
        throw new Error("Network error. Please check your internet connection and try again.");
      }
      throw err;
    }
  }
  throw new Error("Sign in failed after retries");
}

export async function signOut() {
  try {
    // Use 'local' scope to only clear local session, avoiding 403 if session already invalid
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    // Don't throw on signout errors - session may already be invalidated
    if (error) {
      console.warn("Sign out warning (non-fatal):", error.message);
    }
  } catch (err) {
    // Catch any unexpected errors but don't propagate - user intent is to sign out
    console.warn("Sign out error (non-fatal):", err);
  }
}

export async function getUserRole(userId: string, retries = 2): Promise<UserRole | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
          continue;
        }
        console.error("Error fetching user role:", error);
        return null;
      }

      return data?.role as UserRole | null;
    } catch (err) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      console.error("Error fetching user role:", err);
      return null;
    }
  }
  return null;
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
