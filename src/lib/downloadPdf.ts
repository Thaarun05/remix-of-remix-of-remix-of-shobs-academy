import type jsPDF from "jspdf";

/**
 * Reliable PDF download.
 * jsPDF's built-in save() revokes its blob URL immediately, which makes larger
 * files (or downloads inside sandboxed/preview iframes) fail intermittently
 * with "Site wasn't available". Anchor + delayed revoke fixes that.
 */
export function downloadPdf(pdf: jsPDF, filename: string) {
  const safeName = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  const blob = pdf.output("blob") as Blob;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = safeName;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 60000);
}
