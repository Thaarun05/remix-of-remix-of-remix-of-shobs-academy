/**
 * Dual SMTP Email Sender with Fallback
 * 
 * Primary: shobaraju@shobsacademy.com (Custom domain, TLS port 587)
 * Fallback: shobsacademy@gmail.com (Gmail, SSL port 465)
 * 
 * Logic:
 * 1. Always try primary first
 * 2. If primary fails (auth/connection/send error), switch to fallback
 * 3. Log which sender worked
 * 4. Return true on success (any sender), false only if both fail
 */

import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

interface EmailConfig {
  hostname: string;
  port: number;
  username: string;
  password: string;
  tls: boolean;
  from: string;
  name: string;
}

// Primary sender configuration (Custom domain)
const PRIMARY_CONFIG: EmailConfig = {
  hostname: Deno.env.get("SMTP_PRIMARY_HOST") || "smtp.shobsacademy.com",
  port: 587,
  username: Deno.env.get("SMTP_PRIMARY_USER") || "shobaraju@shobsacademy.com",
  password: Deno.env.get("SMTP_PRIMARY_PASS") || "",
  tls: true,
  from: "shobaraju@shobsacademy.com",
  name: "primary"
};

// Fallback sender configuration (Gmail)
const FALLBACK_CONFIG: EmailConfig = {
  hostname: "smtp.gmail.com",
  port: 465,
  username: Deno.env.get("SMTP_FALLBACK_USER") || "shobsacademy@gmail.com",
  password: Deno.env.get("SMTP_FALLBACK_PASS") || "",
  tls: true,
  from: "shobsacademy@gmail.com",
  name: "fallback"
};

// Connection timeout in milliseconds
const CONNECTION_TIMEOUT = 10000;

/**
 * Attempts to send email using specified SMTP configuration
 */
async function trySendEmail(
  config: EmailConfig,
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; error?: string }> {
  let client: SMTPClient | null = null;
  
  try {
    // Create SMTP client with timeout
    const connectPromise = new Promise<SMTPClient>((resolve, reject) => {
      try {
        const smtpClient = new SMTPClient({
          connection: {
            hostname: config.hostname,
            port: config.port,
            tls: config.tls,
            auth: {
              username: config.username,
              password: config.password,
            },
          },
        });
        resolve(smtpClient);
      } catch (err) {
        reject(err);
      }
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Connection timeout exceeded 10s")), CONNECTION_TIMEOUT);
    });

    // Race between connection and timeout
    client = await Promise.race([connectPromise, timeoutPromise]);

    // Send the email
    await client.send({
      from: `Shobs Academy <${config.from}>`,
      to: to,
      subject: subject,
      html: html,
    });

    // Close connection gracefully
    await client.close();
    
    return { success: true };
  } catch (error: unknown) {
    // Attempt to close client if it was created
    if (client) {
      try {
        await client.close();
      } catch {
        // Ignore close errors
      }
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Main email sending function with dual sender fallback
 * 
 * @param to - Recipient email address
 * @param subject - Email subject line
 * @param html - HTML content of the email
 * @returns Promise<boolean> - true if sent successfully, false if both senders failed
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  // Validate inputs
  if (!to || !subject || !html) {
    console.error("Email validation failed: missing required fields");
    return false;
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(to)) {
    console.error("Email validation failed: invalid email format");
    return false;
  }

  // Check if primary credentials are configured
  const hasPrimaryCredentials = PRIMARY_CONFIG.password && PRIMARY_CONFIG.password.length > 0;
  const hasFallbackCredentials = FALLBACK_CONFIG.password && FALLBACK_CONFIG.password.length > 0;

  if (!hasPrimaryCredentials && !hasFallbackCredentials) {
    console.error("No SMTP credentials configured. Set SMTP_PRIMARY_PASS or SMTP_FALLBACK_PASS secrets.");
    return false;
  }

  // Try primary sender first (if configured)
  if (hasPrimaryCredentials) {
    console.log(`Attempting to send email via primary sender (${PRIMARY_CONFIG.from})...`);
    
    const primaryResult = await trySendEmail(PRIMARY_CONFIG, to, subject, html);
    
    if (primaryResult.success) {
      console.log("✓ Email sent via primary sender successfully");
      return true;
    }
    
    console.warn(`Primary sender failed: ${primaryResult.error}`);
  } else {
    console.log("Primary sender not configured, skipping to fallback...");
  }

  // Try fallback sender
  if (hasFallbackCredentials) {
    console.log(`Attempting to send email via fallback sender (${FALLBACK_CONFIG.from})...`);
    
    const fallbackResult = await trySendEmail(FALLBACK_CONFIG, to, subject, html);
    
    if (fallbackResult.success) {
      console.log("✓ Email sent via fallback sender successfully");
      return true;
    }
    
    console.error(`Fallback sender failed: ${fallbackResult.error}`);
  } else {
    console.log("Fallback sender not configured");
  }

  // Both failed
  console.error("✗ Email sending failed: both primary and fallback senders failed");
  return false;
}

/**
 * Alternative function using Resend API as ultimate fallback
 * Use this if SMTP is not available
 */
export async function sendEmailWithResendFallback(
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  // First try SMTP
  const smtpResult = await sendEmail(to, subject, html);
  if (smtpResult) {
    return true;
  }

  // Fallback to Resend API if SMTP fails
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    console.error("Resend API key not configured, cannot use API fallback");
    return false;
  }

  console.log("Attempting to send email via Resend API fallback...");
  
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Shobs Academy <onboarding@resend.dev>",
        to: [to],
        subject: subject,
        html: html,
      }),
    });

    if (response.ok) {
      console.log("✓ Email sent via Resend API fallback successfully");
      return true;
    }

    const errorData = await response.json();
    console.error(`Resend API failed: ${errorData.message || response.statusText}`);
    return false;
  } catch (error) {
    console.error("Resend API error:", error);
    return false;
  }
}
