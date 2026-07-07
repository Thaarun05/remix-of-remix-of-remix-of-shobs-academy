const PDFJS_VERSION = "6.0.227";

export async function extractFromPdf(file: File): Promise<{ text: string; images: string[] }> {
  const pdfjs: any = await import("pdfjs-dist/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.mjs`;
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  let combined = "";
  const images: string[] = [];
  const maxPages = Math.min(doc.numPages, 30);
  for (let i = 1; i <= maxPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    const pageText = tc.items.map((it: any) => it.str).join(" ").trim();
    if (pageText.length > 40) {
      combined += `\n\n--- Page ${i} ---\n${pageText}`;
    } else {
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d")!;
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      images.push(canvas.toDataURL("image/png"));
    }
  }
  return { text: combined.trim(), images };
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

export async function extractSourceFiles(files: File[]): Promise<{ text: string; images: string[] }> {
  let text = "";
  const images: string[] = [];
  for (const f of files) {
    if (/\.pdf$/i.test(f.name)) {
      const r = await extractFromPdf(f);
      text += `\n\n[From ${f.name}]\n${r.text}`;
      images.push(...r.images);
    } else {
      images.push(await fileToDataUrl(f));
    }
  }
  return { text: text.trim(), images };
}