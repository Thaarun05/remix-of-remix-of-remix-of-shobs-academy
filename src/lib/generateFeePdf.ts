import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, endOfMonth } from "date-fns";

interface AttendanceRow {
  date: string;
  status: string;
  hours: number | null;
  topic: string | null;
}

interface FeeData {
  studentName: string;
  month: string;
  totalHours: number;
  feePerHour: number;
  totalAmount: number;
  attendance: AttendanceRow[];
  teacherName?: string;
  createdAt?: string;
}

const formatINR = (amount: number): string =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);

export const generateFeePdf = (data: FeeData) => {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 14;
  let y = 20;

  // Header
  pdf.setFontSize(22);
  pdf.setTextColor(108, 99, 255);
  pdf.text("Shobs Academy", pageWidth / 2, y, { align: "center" });
  y += 8;
  pdf.setFontSize(12);
  pdf.setTextColor(100, 100, 100);
  pdf.text("Student Fee Invoice", pageWidth / 2, y, { align: "center" });
  y += 4;

  // Header line
  pdf.setDrawColor(108, 99, 255);
  pdf.setLineWidth(0.8);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 10;

  // Meta info
  pdf.setFontSize(11);
  pdf.setTextColor(30, 30, 30);

  pdf.setFont("helvetica", "bold");
  pdf.text("Student:", margin, y);
  pdf.setFont("helvetica", "normal");
  pdf.text(data.studentName, margin + 22, y);

  const invoiceNo = `INV-${Date.now().toString(36).toUpperCase()}`;
  pdf.setFont("helvetica", "bold");
  pdf.text("Invoice #:", pageWidth - margin - 50, y);
  pdf.setFont("helvetica", "normal");
  pdf.text(invoiceNo, pageWidth - margin - 25, y);
  y += 6;

  pdf.setFont("helvetica", "bold");
  pdf.text("Month:", margin, y);
  pdf.setFont("helvetica", "normal");
  pdf.text(data.month, margin + 22, y);

  pdf.setFont("helvetica", "bold");
  pdf.text("Date:", pageWidth - margin - 50, y);
  pdf.setFont("helvetica", "normal");
  pdf.text(format(new Date(), "MMM d, yyyy"), pageWidth - margin - 35, y);
  y += 6;

  if (data.teacherName) {
    pdf.setFont("helvetica", "bold");
    pdf.text("Teacher:", margin, y);
    pdf.setFont("helvetica", "normal");
    pdf.text(data.teacherName, margin + 22, y);
    y += 6;
  }

  // Due date
  const dueDate = format(endOfMonth(new Date()), "MMM d, yyyy");
  pdf.setFont("helvetica", "bold");
  pdf.text("Due Date:", pageWidth - margin - 50, y - 6);
  pdf.setFont("helvetica", "normal");
  pdf.text(dueDate, pageWidth - margin - 28, y - 6);
  y += 8;

  // Attendance table
  if (data.attendance.length > 0) {
    pdf.setFontSize(13);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(30, 30, 30);
    pdf.text("Attendance Record", margin, y);
    y += 2;

    const presentCount = data.attendance.filter(a => a.status.toLowerCase() === "present").length;
    const absentCount = data.attendance.filter(a => a.status.toLowerCase() === "absent").length;
    const totalPresentHours = data.attendance
      .filter(a => a.status.toLowerCase() === "present")
      .reduce((s, a) => s + (Number(a.hours) || 0), 0);

    autoTable(pdf, {
      startY: y,
      head: [["#", "Date", "Status", "Hours", "Topic"]],
      body: data.attendance.map((r, i) => [
        (i + 1).toString(),
        format(new Date(r.date), "MMM d, yyyy"),
        r.status,
        r.hours?.toString() ?? "-",
        r.topic || "-",
      ]),
      headStyles: {
        fillColor: [108, 99, 255],
        textColor: 255,
        fontSize: 10,
        fontStyle: "bold",
      },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [248, 248, 255] },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        2: { cellWidth: 22 },
        3: { cellWidth: 18, halign: "center" },
      },
      margin: { left: margin, right: margin },
      didParseCell: (hookData) => {
        if (hookData.section === "body" && hookData.column.index === 2) {
          const val = hookData.cell.raw?.toString()?.toLowerCase();
          if (val === "present") hookData.cell.styles.textColor = [22, 163, 74];
          else if (val === "absent") hookData.cell.styles.textColor = [220, 38, 38];
          hookData.cell.styles.fontStyle = "bold";
        }
      },
    });

    y = (pdf as any).lastAutoTable.finalY + 4;

    // Attendance summary
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    pdf.text(
      `Present: ${presentCount} days  |  Absent: ${absentCount} days  |  Total Present Hours: ${totalPresentHours} hrs`,
      margin, y
    );
    y += 10;
  } else {
    pdf.setFontSize(10);
    pdf.setTextColor(150, 150, 150);
    pdf.text("No attendance records available.", pageWidth / 2, y, { align: "center" });
    y += 14;
  }

  // Fee Summary box
  pdf.setFillColor(240, 239, 255);
  pdf.roundedRect(margin, y, pageWidth - 2 * margin, 46, 3, 3, "F");
  y += 8;

  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(108, 99, 255);
  pdf.text("Fee Summary", margin + 6, y);
  y += 8;

  pdf.setFontSize(11);
  pdf.setTextColor(30, 30, 30);
  pdf.setFont("helvetica", "normal");
  pdf.text("Total Present Hours", margin + 6, y);
  pdf.text(`${data.totalHours} hrs`, pageWidth - margin - 6, y, { align: "right" });
  y += 7;

  pdf.text("Hourly Rate", margin + 6, y);
  pdf.text(formatINR(data.feePerHour), pageWidth - margin - 6, y, { align: "right" });
  y += 7;

  // Total line
  pdf.setDrawColor(108, 99, 255);
  pdf.setLineWidth(0.5);
  pdf.line(margin + 6, y, pageWidth - margin - 6, y);
  y += 7;

  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(108, 99, 255);
  pdf.text("Total Fee", margin + 6, y);
  pdf.text(formatINR(data.totalAmount), pageWidth - margin - 6, y, { align: "right" });
  y += 14;

  // Payment instructions
  pdf.setFillColor(255, 251, 235);
  pdf.setDrawColor(245, 158, 11);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(margin, y, pageWidth - 2 * margin, 22, 3, 3, "FD");
  y += 7;

  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(180, 83, 9);
  pdf.text("Payment Instructions", margin + 6, y);
  y += 6;

  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(146, 64, 14);
  pdf.text(`Please ensure payment is made by ${dueDate}. For queries, contact Shobs Academy administration.`, margin + 6, y);
  y += 14;

  // Footer
  pdf.setFontSize(9);
  pdf.setTextColor(160, 160, 160);
  pdf.text(
    `Generated on ${format(new Date(), "MMMM d, yyyy 'at' h:mm a")} • Shobs Academy`,
    pageWidth / 2, pdf.internal.pageSize.getHeight() - 10,
    { align: "center" }
  );

  // Save
  const filename = `Invoice_${data.studentName}_${data.month.replace(/\s/g, "_")}.pdf`;
  pdf.save(filename);
};
