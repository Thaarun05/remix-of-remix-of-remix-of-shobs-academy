import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DemoRequest {
  studentName: string;
  parentName: string;
  parentEmail: string;
  age: string;
  grade: string;
  subject: string;
  timing: string;
  days: string;
  phone: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: DemoRequest = await req.json();
    
    console.log("Received demo request:", data);

    // Validate required fields
    const requiredFields = ['studentName', 'parentName', 'parentEmail', 'age', 'grade', 'subject', 'timing', 'days', 'phone'];
    for (const field of requiredFields) {
      if (!data[field as keyof DemoRequest]) {
        return new Response(
          JSON.stringify({ error: `Missing required field: ${field}` }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    // Send email via Resend REST API
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Shobs Academy <onboarding@resend.dev>",
        to: ["shoba.raaju@gmail.com"],
        subject: `New Demo Class Request - ${data.studentName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">New Demo Class Request</h2>
            <p>Hi Shoba,</p>
            <p>A new demo class request has been received:</p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr style="background-color: #f3f4f6;">
                <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Student Name</td>
                <td style="padding: 10px; border: 1px solid #e5e7eb;">${data.studentName}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Age</td>
                <td style="padding: 10px; border: 1px solid #e5e7eb;">${data.age}</td>
              </tr>
              <tr style="background-color: #f3f4f6;">
                <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Class/Grade</td>
                <td style="padding: 10px; border: 1px solid #e5e7eb;">${data.grade}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Parent Name</td>
                <td style="padding: 10px; border: 1px solid #e5e7eb;">${data.parentName}</td>
              </tr>
              <tr style="background-color: #f3f4f6;">
                <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Parent Email</td>
                <td style="padding: 10px; border: 1px solid #e5e7eb;">${data.parentEmail}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Phone</td>
                <td style="padding: 10px; border: 1px solid #e5e7eb;">${data.phone}</td>
              </tr>
              <tr style="background-color: #f3f4f6;">
                <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Subject</td>
                <td style="padding: 10px; border: 1px solid #e5e7eb;">${data.subject}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Preferred Timing</td>
                <td style="padding: 10px; border: 1px solid #e5e7eb;">${data.timing}</td>
              </tr>
              <tr style="background-color: #f3f4f6;">
                <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Preferred Days</td>
                <td style="padding: 10px; border: 1px solid #e5e7eb;">${data.days}</td>
              </tr>
            </table>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="color: #6b7280; font-size: 12px;">Sent from Shobs Academy website</p>
          </div>
        `,
      }),
    });

    const emailResult = await emailResponse.json();
    console.log("Email response:", emailResult);

    if (!emailResponse.ok) {
      throw new Error(emailResult.message || "Failed to send email");
    }

    // Log to database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error: dbError } = await supabase.from("demo_requests").insert({
      student_name: data.studentName,
      parent_name: data.parentName,
      parent_email: data.parentEmail,
      age: data.age,
      grade: data.grade,
      subject: data.subject,
      timing: data.timing,
      days: data.days,
      phone: data.phone,
      status: "sent",
    });

    if (dbError) {
      console.error("Database insert error (non-critical):", dbError);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Demo request sent successfully" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-demo-request function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
