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

// Simple in-memory rate limiting (resets on function cold start)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 5; // max requests per window
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour window

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_WINDOW_MS });
    return false;
  }
  
  if (record.count >= RATE_LIMIT) {
    return true;
  }
  
  record.count++;
  return false;
}

// Basic spam detection
function isSpam(data: DemoRequest): boolean {
  const spamPatterns = [
    /https?:\/\//i,  // URLs in fields
    /<script/i,      // Script tags
    /\[url=/i,       // BBCode links
    /viagra|casino|crypto|lottery|winner/i,  // Common spam words
  ];
  
  const fieldsToCheck = [
    data.studentName,
    data.parentName,
    data.parentEmail,
    data.phone,
  ];
  
  return fieldsToCheck.some(field => 
    spamPatterns.some(pattern => pattern.test(field || ""))
  );
}

// Input validation
function validateInput(data: DemoRequest): string | null {
  const requiredFields: (keyof DemoRequest)[] = [
    'studentName', 'parentName', 'parentEmail', 'age', 'grade', 'subject', 'timing', 'days', 'phone'
  ];
  
  for (const field of requiredFields) {
    if (!data[field] || (typeof data[field] === 'string' && data[field].trim() === '')) {
      return `Missing required field: ${field}`;
    }
  }
  
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(data.parentEmail)) {
    return "Invalid email format";
  }
  
  // Validate field lengths
  if (data.studentName.length > 100) return "Student name too long";
  if (data.parentName.length > 100) return "Parent name too long";
  if (data.parentEmail.length > 255) return "Email too long";
  if (data.phone.length > 20) return "Phone number too long";
  if (data.age.length > 10) return "Age field too long";
  if (data.grade.length > 50) return "Grade field too long";
  if (data.subject.length > 100) return "Subject field too long";
  if (data.timing.length > 50) return "Timing field too long";
  if (data.days.length > 200) return "Days field too long";
  
  return null;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get client IP for rate limiting
    const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                     req.headers.get("cf-connecting-ip") || 
                     "unknown";
    
    // Check rate limit
    if (isRateLimited(clientIP)) {
      console.log(`Rate limited IP: ${clientIP}`);
      return new Response(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const data: DemoRequest = await req.json();
    
    console.log("Received demo request from IP:", clientIP);

    // Validate input
    const validationError = validateInput(data);
    if (validationError) {
      console.log("Validation error:", validationError);
      return new Response(
        JSON.stringify({ error: validationError }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check for spam
    if (isSpam(data)) {
      console.log("Spam detected from IP:", clientIP);
      return new Response(
        JSON.stringify({ error: "Request rejected" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Initialize Supabase client with service role key (bypasses RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Insert into database
    const { error: dbError } = await supabase.from("demo_requests").insert({
      student_name: data.studentName.trim(),
      parent_name: data.parentName.trim(),
      parent_email: data.parentEmail.trim().toLowerCase(),
      age: data.age.trim(),
      grade: data.grade.trim(),
      subject: data.subject.trim(),
      timing: data.timing.trim(),
      days: data.days.trim(),
      phone: data.phone.trim(),
      status: "pending",
    });

    if (dbError) {
      console.error("Database insert error:", dbError);
      throw new Error("Failed to save demo request");
    }

    console.log("Demo request saved successfully");

    // Optionally send email notification
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (RESEND_API_KEY) {
      try {
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

        if (!emailResponse.ok) {
          const emailError = await emailResponse.json();
          console.error("Email send error (non-critical):", emailError);
        } else {
          console.log("Email notification sent successfully");
        }
      } catch (emailError) {
        console.error("Email send error (non-critical):", emailError);
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: "Demo request submitted successfully" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in submit-demo-request function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "An error occurred" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
