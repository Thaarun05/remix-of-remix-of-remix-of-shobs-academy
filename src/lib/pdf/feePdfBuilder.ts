import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { FeeData } from "@/lib/pdf/feePdfTypes";
import {
  createInvoiceNumber,
  formatPdfCurrency,
  formatPdfDate,
  formatPdfHours,
  formatPdfText,
  getDueDate,
  getIssueDate,
  sanitizePdfFilePart,
} from "@/lib/pdf/feePdfFormatters";

type PdfDocument = jsPDF & {
  lastAutoTable?: {
    finalY: number;
  };
};

type PdfColor = readonly [number, number, number];

type InfoItem = {
  label: string;
  value: string;
};

const COLORS = {
  accent: [99, 102, 241] as const,
  accentSoft: [238, 242, 255] as const,
  accentTint: [248, 250, 255] as const,
  border: [199, 210, 254] as const,
  text: [30, 41, 59] as const,
  muted: [100, 116, 139] as const,
  success: [22, 163, 74] as const,
  danger: [220, 38, 38] as const,
  warning: [180, 83, 9] as const,
  warningBg: [255, 251, 235] as const,
  warningBorder: [245, 158, 11] as const,
  white: [255, 255, 255] as const,
  rowAlt: [248, 250, 252] as const,
};

const PAGE = {
  margin: 16,
  footerReserve: 16,
  sectionGap: 8,
};

const setTextColor = (pdf: jsPDF, color: PdfColor) => {
  pdf.setTextColor(...color);
};

const getPageWidth = (pdf: jsPDF) => pdf.internal.pageSize.getWidth();

const getPageHeight = (pdf: jsPDF) => pdf.internal.pageSize.getHeight();

const getContentWidth = (pdf: jsPDF) => getPageWidth(pdf) - PAGE.margin * 2;

const ensurePageSpace = (pdf: jsPDF, y: number, requiredHeight: number) => {
  const maxY = getPageHeight(pdf) - PAGE.margin - PAGE.footerReserve;

  if (y + requiredHeight <= maxY) {
    return y;
  }

  pdf.addPage();
  return PAGE.margin + 2;
};

const getTextLines = (pdf: jsPDF, value: string, width: number): string[] => {
  const split = pdf.splitTextToSize(value, Math.max(width, 20));
  return Array.isArray(split) ? split : [split];
};

const getInfoPanelHeight = (pdf: jsPDF, items: InfoItem[], width: number) => {
  return items.reduce((height, item) => {
    const valueLines = getTextLines(pdf, item.value, width - 10);
    return height + 7 + valueLines.length * 5;
  }, 10);
};

const drawInfoPanel = (
  pdf: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  items: InfoItem[],
) => {
  pdf.setFillColor(...COLORS.accentTint);
  pdf.setDrawColor(...COLORS.border);
  pdf.setLineWidth(0.25);
  pdf.roundedRect(x, y, width, height, 4, 4, "FD");

  let cursorY = y + 8;

  items.forEach((item, index) => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.5);
    setTextColor(pdf, COLORS.muted);
    pdf.text(item.label, x + 5, cursorY);
    cursorY += 4.5;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    setTextColor(pdf, COLORS.text);
    const valueLines = getTextLines(pdf, item.value, width - 10);
    pdf.text(valueLines, x + 5, cursorY);
    cursorY += valueLines.length * 5;

    if (index < items.length - 1) {
      cursorY += 2.5;
    }
  });
};

const drawHeader = (pdf: jsPDF) => {
  const pageWidth = getPageWidth(pdf);
  let y = 20;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  setTextColor(pdf, COLORS.accent);
  pdf.text("Shobs Academy", pageWidth / 2, y, { align: "center" });

  y += 8;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(12);
  setTextColor(pdf, COLORS.muted);
  pdf.text("Student Fee Invoice", pageWidth / 2, y, { align: "center" });

  y += 8;
  pdf.setDrawColor(...COLORS.accent);
  pdf.setLineWidth(0.8);
  pdf.line(PAGE.margin, y, pageWidth - PAGE.margin, y);

  return y + 8;
};

const drawMetaSection = (
  pdf: jsPDF,
  y: number,
  data: FeeData,
  issueDate: Date,
  dueDate: Date,
  invoiceNumber: string,
) => {
  const contentWidth = getContentWidth(pdf);
  const gap = 8;
  const panelWidth = (contentWidth - gap) / 2;

  const leftItems: InfoItem[] = [
    { label: "Student", value: formatPdfText(data.studentName) },
    { label: "Month", value: formatPdfText(data.month) },
  ];

  if (data.teacherName) {
    leftItems.push({ label: "Teacher", value: formatPdfText(data.teacherName) });
  }

  const rightItems: InfoItem[] = [
    { label: "Invoice #", value: invoiceNumber },
    { label: "Date", value: formatPdfDate(issueDate) },
    { label: "Due Date", value: formatPdfDate(dueDate) },
  ];

  const panelHeight = Math.max(
    getInfoPanelHeight(pdf, leftItems, panelWidth),
    getInfoPanelHeight(pdf, rightItems, panelWidth),
  );

  y = ensurePageSpace(pdf, y, panelHeight + PAGE.sectionGap);

  drawInfoPanel(pdf, PAGE.margin, y, panelWidth, panelHeight, leftItems);
  drawInfoPanel(pdf, PAGE.margin + panelWidth + gap, y, panelWidth, panelHeight, rightItems);

  return y + panelHeight + PAGE.sectionGap;
};

const drawSectionHeading = (pdf: jsPDF, title: string, y: number) => {
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  setTextColor(pdf, COLORS.text);
  pdf.text(title, PAGE.margin, y);

  return y + 5;
};

const drawEmptyAttendanceState = (pdf: jsPDF, y: number) => {
  const contentWidth = getContentWidth(pdf);
  const textLines = getTextLines(pdf, "No attendance records are available for this fee sheet.", contentWidth - 12);
  const height = 10 + textLines.length * 5;

  y = ensurePageSpace(pdf, y, height + PAGE.sectionGap);

  pdf.setFillColor(...COLORS.accentTint);
  pdf.setDrawColor(...COLORS.border);
  pdf.roundedRect(PAGE.margin, y, contentWidth, height, 3, 3, "FD");

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  setTextColor(pdf, COLORS.muted);
  pdf.text(textLines, getPageWidth(pdf) / 2, y + 8, { align: "center" });

  return y + height + PAGE.sectionGap;
};

const drawAttendanceSection = (pdf: PdfDocument, y: number, data: FeeData) => {
  y = ensurePageSpace(pdf, y, 18);
  y = drawSectionHeading(pdf, "Attendance Record", y);

  if (data.attendance.length === 0) {
    return drawEmptyAttendanceState(pdf, y);
  }

  const presentCount = data.attendance.filter((item) => item.status.toLowerCase() === "present").length;
  const absentCount = data.attendance.filter((item) => item.status.toLowerCase() === "absent").length;
  const totalPresentHours = data.attendance
    .filter((item) => item.status.toLowerCase() === "present")
    .reduce((sum, item) => sum + (Number(item.hours) || 0), 0);

  autoTable(pdf, {
    startY: y,
    head: [["#", "Date", "Status", "Hours", "Topic"]],
    body: data.attendance.map((item, index) => [
      String(index + 1),
      formatPdfDate(item.date),
      formatPdfText(item.status),
      item.hours == null ? "-" : String(item.hours),
      formatPdfText(item.topic),
    ]),
    margin: {
      left: PAGE.margin,
      right: PAGE.margin,
      bottom: PAGE.footerReserve,
    },
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 2.5,
      overflow: "linebreak",
      textColor: COLORS.text,
      valign: "middle",
    },
    headStyles: {
      fillColor: COLORS.accent,
      textColor: COLORS.white,
      fontStyle: "bold",
      halign: "left",
    },
    alternateRowStyles: {
      fillColor: COLORS.rowAlt,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 28 },
      2: { cellWidth: 24, halign: "center" },
      3: { cellWidth: 18, halign: "center" },
    },
    didParseCell: ({ section, column, cell }) => {
      if (section === "body" && column.index === 2) {
        const status = cell.raw?.toString().toLowerCase();
        cell.styles.fontStyle = "bold";

        if (status === "present") {
          cell.styles.textColor = COLORS.success;
        } else if (status === "absent") {
          cell.styles.textColor = COLORS.danger;
        }
      }
    },
  });

  const summaryText = `Present: ${presentCount} days  |  Absent: ${absentCount} days  |  Total Present Hours: ${formatPdfHours(totalPresentHours)}`;
  const summaryLines = getTextLines(pdf, summaryText, getContentWidth(pdf));
  const tableEndY = pdf.lastAutoTable?.finalY ?? y;
  let summaryY = ensurePageSpace(pdf, tableEndY + 6, summaryLines.length * 4 + PAGE.sectionGap);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9.5);
  setTextColor(pdf, COLORS.muted);
  pdf.text(summaryLines, PAGE.margin, summaryY);

  return summaryY + summaryLines.length * 4 + PAGE.sectionGap;
};

const drawSummaryCard = (pdf: jsPDF, y: number, data: FeeData) => {
  const pageWidth = getPageWidth(pdf);
  const cardHeight = 44;

  y = ensurePageSpace(pdf, y, cardHeight + PAGE.sectionGap);

  pdf.setFillColor(...COLORS.accentSoft);
  pdf.roundedRect(PAGE.margin, y, getContentWidth(pdf), cardHeight, 4, 4, "F");

  let cursorY = y + 8;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  setTextColor(pdf, COLORS.accent);
  pdf.text("Fee Summary", PAGE.margin + 6, cursorY);

  const rows = [
    { label: "Total Present Hours", value: formatPdfHours(data.totalHours) },
    { label: "Hourly Rate", value: formatPdfCurrency(data.feePerHour) },
  ];

  rows.forEach((row) => {
    cursorY += 8;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    setTextColor(pdf, COLORS.text);
    pdf.text(row.label, PAGE.margin + 6, cursorY);
    pdf.text(row.value, pageWidth - PAGE.margin - 6, cursorY, { align: "right" });
  });

  cursorY += 6;
  pdf.setDrawColor(...COLORS.accent);
  pdf.setLineWidth(0.4);
  pdf.line(PAGE.margin + 6, cursorY, pageWidth - PAGE.margin - 6, cursorY);

  cursorY += 8;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  setTextColor(pdf, COLORS.accent);
  pdf.text("Total Fee", PAGE.margin + 6, cursorY);
  pdf.text(formatPdfCurrency(data.totalAmount), pageWidth - PAGE.margin - 6, cursorY, { align: "right" });

  return y + cardHeight + PAGE.sectionGap;
};

const drawPaymentInstructions = (pdf: jsPDF, y: number, dueDate: Date) => {
  const note = `Please ensure payment is made by ${formatPdfDate(dueDate)}. For queries, contact Shobs Academy administration.`;
  const textLines = getTextLines(pdf, note, getContentWidth(pdf) - 12);
  const cardHeight = 12 + textLines.length * 4;

  y = ensurePageSpace(pdf, y, cardHeight + PAGE.sectionGap);

  pdf.setFillColor(...COLORS.warningBg);
  pdf.setDrawColor(...COLORS.warningBorder);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(PAGE.margin, y, getContentWidth(pdf), cardHeight, 4, 4, "FD");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  setTextColor(pdf, COLORS.warning);
  pdf.text("Payment Instructions", PAGE.margin + 6, y + 7);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9.5);
  pdf.text(textLines, PAGE.margin + 6, y + 13);

  return y + cardHeight + PAGE.sectionGap;
};

const addFooterToAllPages = (pdf: jsPDF, issueDate: Date) => {
  const pageWidth = getPageWidth(pdf);
  const pageHeight = getPageHeight(pdf);
  const pageCount = pdf.getNumberOfPages();
  const generatedOn = `Generated on ${formatPdfDate(issueDate, "MMMM d, yyyy")} • Shobs Academy`;

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    pdf.setPage(pageNumber);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    setTextColor(pdf, COLORS.muted);
    pdf.text(generatedOn, pageWidth / 2, pageHeight - 8, { align: "center" });
    pdf.text(`Page ${pageNumber} of ${pageCount}`, pageWidth - PAGE.margin, pageHeight - 8, {
      align: "right",
    });
  }
};

export const getFeePdfFileName = (data: FeeData) =>
  `Invoice_${sanitizePdfFilePart(data.studentName)}_${sanitizePdfFilePart(data.month)}.pdf`;

export const createFeePdfDocument = (data: FeeData) => {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" }) as PdfDocument;
  const issueDate = getIssueDate(data.createdAt);
  const dueDate = getDueDate(issueDate);
  const invoiceNumber = createInvoiceNumber(data.invoiceId, issueDate);

  let y = drawHeader(pdf);
  y = drawMetaSection(pdf, y, data, issueDate, dueDate, invoiceNumber);
  y = drawAttendanceSection(pdf, y, data);
  y = drawSummaryCard(pdf, y, data);
  drawPaymentInstructions(pdf, y, dueDate);
  addFooterToAllPages(pdf, issueDate);

  return pdf;
};