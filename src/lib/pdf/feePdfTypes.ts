export interface AttendanceRow {
  date: string;
  status: string;
  hours: number | null;
  topic: string | null;
}

export interface FeeData {
  invoiceId?: string;
  studentName: string;
  month: string;
  totalHours: number;
  feePerHour: number;
  totalAmount: number;
  attendance: AttendanceRow[];
  teacherName?: string;
  createdAt?: string;
  siblingDiscountPct?: number;
  siblingDiscountAmount?: number;
  finalAmount?: number;
}