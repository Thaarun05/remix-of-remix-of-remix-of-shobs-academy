/** Extract a useful message from supabase.functions.invoke failures. */
export async function edgeFunctionErrorMessage(
  error: unknown,
  data?: unknown,
): Promise<string> {
  if (data && typeof data === "object" && data !== null && "error" in data) {
    const msg = (data as { error?: unknown }).error;
    if (typeof msg === "string" && msg.trim()) return msg;
  }

  // FunctionsHttpError / FunctionsRelayError often carry a Response in `context`
  const ctx = error && typeof error === "object" && "context" in error
    ? (error as { context?: unknown }).context
    : undefined;

  if (ctx && typeof ctx === "object" && ctx !== null && "json" in ctx && typeof (ctx as { json: unknown }).json === "function") {
    try {
      const body = await (ctx as Response).clone().json();
      if (body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string") {
        return (body as { error: string }).error;
      }
    } catch {
      try {
        const text = await (ctx as Response).clone().text();
        if (text.trim()) return text.trim().slice(0, 300);
      } catch { /* ignore */ }
    }
  }

  if (error instanceof Error && error.message) {
    if (error.message.includes("non-2xx")) {
      return "Worksheet service failed. Check OPENAI_API_KEY in Lovable Secrets and that generate-worksheet is redeployed.";
    }
    return error.message;
  }

  return "Generation failed. Please try again.";
}
