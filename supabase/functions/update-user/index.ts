import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UpdateUserRequest {
  userId: string;
  email?: string;
  password?: string;
  fullName?: string;
  phone?: string;
  // Teacher-specific fields
  subjects?: string;
  availability?: string;
  bio?: string;
  // Student-specific fields
  studentName?: string;
  grade?: string;
  assignedTeacherId?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create admin client with service role
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Create regular client to verify caller
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.log("No authorization header provided");
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the caller is authenticated
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !caller) {
      console.log("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the caller is an admin
    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("user_id", caller.id)
      .single();

    if (profileError || callerProfile?.role !== "admin") {
      console.log("Caller is not an admin:", callerProfile?.role);
      return new Response(
        JSON.stringify({ error: "Only admins can update user accounts" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body: UpdateUserRequest = await req.json();
    console.log("Updating user:", body.userId);

    if (!body.userId) {
      return new Response(
        JSON.stringify({ error: "User ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the user's current role
    const { data: userProfile, error: userProfileError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("user_id", body.userId)
      .single();

    if (userProfileError || !userProfile) {
      console.log("User not found:", userProfileError);
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userRole = userProfile.role;

    // Update auth user (email and/or password)
    const authUpdates: { email?: string; password?: string } = {};
    if (body.email) authUpdates.email = body.email;
    if (body.password) authUpdates.password = body.password;

    if (Object.keys(authUpdates).length > 0) {
      const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
        body.userId,
        authUpdates
      );

      if (authUpdateError) {
        console.log("Error updating auth user:", authUpdateError);
        return new Response(
          JSON.stringify({ error: authUpdateError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.log("Auth user updated successfully");
    }

    // Update profiles table
    const profileUpdates: { full_name?: string | null; phone?: string | null } = {};
    if (body.fullName !== undefined) profileUpdates.full_name = body.fullName || null;
    if (body.phone !== undefined) profileUpdates.phone = body.phone || null;

    if (Object.keys(profileUpdates).length > 0) {
      const { error: profileUpdateError } = await supabaseAdmin
        .from("profiles")
        .update(profileUpdates)
        .eq("user_id", body.userId);

      if (profileUpdateError) {
        console.log("Error updating profile:", profileUpdateError);
        return new Response(
          JSON.stringify({ error: "Failed to update profile" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.log("Profile updated successfully");
    }

    // Update role-specific tables
    if (userRole === "teacher") {
      const teacherUpdates: { subjects?: string | null; availability?: string | null; bio?: string | null } = {};
      if (body.subjects !== undefined) teacherUpdates.subjects = body.subjects || null;
      if (body.availability !== undefined) teacherUpdates.availability = body.availability || null;
      if (body.bio !== undefined) teacherUpdates.bio = body.bio || null;

      if (Object.keys(teacherUpdates).length > 0) {
        // Check if teacher_profiles entry exists
        const { data: existingTeacherProfile } = await supabaseAdmin
          .from("teacher_profiles")
          .select("user_id")
          .eq("user_id", body.userId)
          .single();

        if (existingTeacherProfile) {
          const { error: teacherUpdateError } = await supabaseAdmin
            .from("teacher_profiles")
            .update(teacherUpdates)
            .eq("user_id", body.userId);

          if (teacherUpdateError) {
            console.log("Error updating teacher_profiles:", teacherUpdateError);
          }
        } else {
          // Create teacher_profiles entry if it doesn't exist
          const { error: teacherInsertError } = await supabaseAdmin
            .from("teacher_profiles")
            .insert({
              user_id: body.userId,
              ...teacherUpdates,
            });

          if (teacherInsertError) {
            console.log("Error creating teacher_profiles:", teacherInsertError);
          }
        }
        console.log("Teacher profile updated successfully");
      }
    } else if (userRole === "student") {
      const studentUpdates: { student_name?: string; grade?: string | null; assigned_teacher_id?: string | null } = {};
      if (body.studentName !== undefined) studentUpdates.student_name = body.studentName;
      if (body.grade !== undefined) studentUpdates.grade = body.grade || null;
      if (body.assignedTeacherId !== undefined) studentUpdates.assigned_teacher_id = body.assignedTeacherId || null;

      if (Object.keys(studentUpdates).length > 0) {
        // Check if student_profiles entry exists
        const { data: existingStudentProfile } = await supabaseAdmin
          .from("student_profiles")
          .select("user_id")
          .eq("user_id", body.userId)
          .single();

        if (existingStudentProfile) {
          const { error: studentUpdateError } = await supabaseAdmin
            .from("student_profiles")
            .update(studentUpdates)
            .eq("user_id", body.userId);

          if (studentUpdateError) {
            console.log("Error updating student_profiles:", studentUpdateError);
          }
        } else {
          // Create student_profiles entry if it doesn't exist
          const { error: studentInsertError } = await supabaseAdmin
            .from("student_profiles")
            .insert({
              user_id: body.userId,
              student_name: body.studentName || "Unknown",
              ...studentUpdates,
            });

          if (studentInsertError) {
            console.log("Error creating student_profiles:", studentInsertError);
          }
        }
        console.log("Student profile updated successfully");
      }
    }

    console.log("User updated successfully:", body.userId);

    return new Response(
      JSON.stringify({
        success: true,
        message: "User updated successfully",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in update-user function:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
