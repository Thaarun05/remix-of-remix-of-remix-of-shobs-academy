/**
 * Shared toast copy so every screen reports outcomes the same way:
 * short, factual, sentence case, always naming the thing that changed.
 */
export const toastCopy = {
  saved: (thing: string) => ({ title: `${thing} saved` }),
  created: (thing: string) => ({ title: `${thing} created` }),
  updated: (thing: string) => ({ title: `${thing} updated` }),
  deleted: (thing: string) => ({ title: `${thing} deleted` }),
  uploaded: (count: number) => ({
    title: count === 1 ? "File uploaded" : `${count} files uploaded`,
  }),
  sent: (thing: string) => ({ title: `${thing} sent` }),
  failed: (action: string, error?: unknown) => ({
    title: `Could not ${action}`,
    description:
      error instanceof Error
        ? error.message
        : typeof error === "string" && error
          ? error
          : "Please try again in a moment.",
    variant: "destructive" as const,
  }),
  loadFailed: (thing: string) => ({
    title: `Could not load ${thing}`,
    description: "Check your connection and try again.",
    variant: "destructive" as const,
  }),
};
