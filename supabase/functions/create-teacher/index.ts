import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateTeacherRequest {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  subjects?: string;
  availability?: string;
  bio?: string;
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
        JSON.stringify({ error: "Only admins can create teacher accounts" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body: CreateTeacherRequest = await req.json();
    console.log("Creating teacher for email:", body.email);

    // Validate required fields
    if (!body.email || !body.password || !body.fullName) {
      return new Response(
        JSON.stringify({ error: "Email, password, and full name are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create the teacher user using admin API
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true, // Auto-confirm email
    });

    if (createError) {
      console.log("Error creating user:", createError);
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!newUser.user) {
      return new Response(
        JSON.stringify({ error: "Failed to create user" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("User created:", newUser.user.id);

    // Create profile for the teacher
    const { error: profileInsertError } = await supabaseAdmin
      .from("profiles")
      .insert({
        user_id: newUser.user.id,
        role: "teacher",
        full_name: body.fullName,
        phone: body.phone || null,
      });

    if (profileInsertError) {
      console.log("Error creating profile:", profileInsertError);
      // Try to clean up the created user
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      return new Response(
        JSON.stringify({ error: "Failed to create teacher profile" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create teacher_profiles entry
    const { error: teacherProfileError } = await supabaseAdmin
      .from("teacher_profiles")
      .insert({
        user_id: newUser.user.id,
        subjects: body.subjects || null,
        availability: body.availability || null,
        bio: body.bio || null,
      });

    if (teacherProfileError) {
      console.log("Error creating teacher_profiles:", teacherProfileError);
      // Non-fatal error, profile is already created
    }

    console.log("Teacher created successfully:", newUser.user.email);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Teacher account created successfully",
        email: newUser.user.email,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in create-teacher function:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
