import { createFeePdfDocument, getFeePdfFileName } from "@/lib/pdf/feePdfBuilder";
import type { FeeData } from "@/lib/pdf/feePdfTypes";

export type { AttendanceRow, FeeData } from "@/lib/pdf/feePdfTypes";

export const generateFeePdf = (data: FeeData) => {
  const pdf = createFeePdfDocument(data);
  pdf.save(getFeePdfFileName(data));
  return pdf;
};
