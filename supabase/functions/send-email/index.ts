/**
 * Universal Email Sending Edge Function
 * 
 * Supports dual SMTP sender with fallback:
 * - Primary: shobaraju@shobsacademy.com (Custom domain, TLS port 587)
 * - Fallback: shobsacademy@gmail.com (Gmail, SSL port 465)
 * - Ultimate fallback: Resend API (if configured)
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { sendEmailWithResendFallback } from "../_shared/email-sender.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to: string;
  subject: string;
  html: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, subject, html }: EmailRequest = await req.json();

    // Validate required fields
    if (!to || !subject || !html) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Missing required fields: to, subject, html" 
        }),
        { 
          status: 400, 
          headers: { "Content-Type": "application/json", ...corsHeaders } 
        }
      );
    }

    console.log(`Processing email request to: ${to}`);
    console.log(`Subject: ${subject}`);

    // Send email with dual sender fallback
    const success = await sendEmailWithResendFallback(to, subject, html);

    if (success) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Email sent successfully" 
        }),
        { 
          status: 200, 
          headers: { "Content-Type": "application/json", ...corsHeaders } 
        }
      );
    } else {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Failed to send email via all available methods" 
        }),
        { 
          status: 500, 
          headers: { "Content-Type": "application/json", ...corsHeaders } 
        }
      );
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in send-email function:", errorMessage);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 500, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );
  }
};

serve(handler);
