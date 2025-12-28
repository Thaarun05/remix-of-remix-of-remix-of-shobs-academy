import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConfirmationRequest {
  parentEmail: string;
  parentName: string;
  studentName: string;
  subject: string;
  timing: string;
  days: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: ConfirmationRequest = await req.json();
    
    console.log("Sending confirmation email to:", data.parentEmail);

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Shobs Academy <onboarding@resend.dev>",
        to: [data.parentEmail],
        subject: `Demo Class Confirmation - ${data.studentName} | Shobs Academy`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2563eb; margin: 0;">Shobs Academy</h1>
              <p style="color: #6b7280; margin-top: 5px;">Empowering Education, One Student at a Time</p>
            </div>
            
            <h2 style="color: #1f2937;">Thank You for Your Interest!</h2>
            
            <p>Dear ${data.parentName},</p>
            
            <p>Thank you for requesting a demo class for <strong>${data.studentName}</strong> at Shobs Academy. We're excited to help your child on their learning journey!</p>
            
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #1f2937; margin-top: 0;">Your Request Details:</h3>
              <table style="width: 100%;">
                <tr>
                  <td style="padding: 5px 0; color: #6b7280;">Subject:</td>
                  <td style="padding: 5px 0; font-weight: bold;">${data.subject}</td>
                </tr>
                <tr>
                  <td style="padding: 5px 0; color: #6b7280;">Preferred Timing:</td>
                  <td style="padding: 5px 0; font-weight: bold;">${data.timing}</td>
                </tr>
                <tr>
                  <td style="padding: 5px 0; color: #6b7280;">Preferred Days:</td>
                  <td style="padding: 5px 0; font-weight: bold;">${data.days}</td>
                </tr>
              </table>
            </div>
            
            <h3 style="color: #1f2937;">What's Next?</h3>
            <ol style="color: #4b5563; line-height: 1.8;">
              <li>Our team will review your request within 24 hours</li>
              <li>We'll contact you to schedule the demo class at a convenient time</li>
              <li>You'll receive a Zoom link before the scheduled session</li>
            </ol>
            
            <p>If you have any questions, feel free to reply to this email or contact us directly.</p>
            
            <p style="margin-top: 30px;">
              Best regards,<br/>
              <strong>Shoba Raaju</strong><br/>
              <span style="color: #6b7280;">Founder, Shobs Academy</span>
            </p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
            <p style="color: #9ca3af; font-size: 12px; text-align: center;">
              © ${new Date().getFullYear()} Shobs Academy. All rights reserved.
            </p>
          </div>
        `,
      }),
    });

    const emailResult = await emailResponse.json();
    console.log("Email response:", emailResult);

    if (!emailResponse.ok) {
      throw new Error(emailResult.message || "Failed to send confirmation email");
    }

    return new Response(
      JSON.stringify({ success: true, message: "Confirmation email sent" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-demo-confirmation function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
