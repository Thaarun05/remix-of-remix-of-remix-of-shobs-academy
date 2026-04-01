import { endOfMonth, format, isValid, parseISO } from "date-fns";

const numberFormatter = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const fallbackText = "—";

const toValidDate = (value?: string | Date | null): Date | null => {
  if (!value) return null;
  if (value instanceof Date) {
    return isValid(value) ? value : null;
  }

  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
};

const toSafeNumber = (value: number | null | undefined) =>
  Number.isFinite(value) ? Number(value) : 0;

export const formatPdfCurrency = (amount: number | null | undefined): string =>
  `INR ${numberFormatter.format(toSafeNumber(amount))}`;

export const formatPdfHours = (hours: number | null | undefined): string =>
  `${numberFormatter.format(toSafeNumber(hours))} hrs`;

export const formatPdfDate = (
  value?: string | Date | null,
  pattern = "MMM d, yyyy",
): string => {
  const date = toValidDate(value);
  return date ? format(date, pattern) : fallbackText;
};

export const getIssueDate = (createdAt?: string): Date =>
  toValidDate(createdAt) ?? new Date();

export const getDueDate = (issueDate: Date): Date => endOfMonth(issueDate);

export const createInvoiceNumber = (invoiceId: string | undefined, issueDate: Date): string => {
  const compactId = invoiceId?.replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase();
  return compactId ? `INV-${compactId}` : `INV-${format(issueDate, "yyyyMMdd")}`;
};

export const sanitizePdfFilePart = (value: string): string => {
  const sanitized = value
    .trim()
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "");

  return sanitized || "document";
};

export const formatPdfText = (value?: string | null): string => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallbackText;
};