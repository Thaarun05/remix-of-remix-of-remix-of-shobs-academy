# Reduce generated PDF file sizes

## Why files are huge

The AI Notetaker PDF was already rewritten to use **native jsPDF text rendering**, so its output should now be small (typically < 200 KB).

The 30–40 MB files are coming from **`TeacherWorksheetBuilder.tsx`**, which still uses the old approach:

```ts
const canvas = await html2canvas(docRef.current, { scale: 2, ... });
const imgData = canvas.toDataURL("image/png");   // huge lossless PNG
pdf.addImage(imgData, "PNG", 0, position, w, h); // same image re-added per page
```

Two compounding problems:
1. The entire worksheet is rasterized at 2× scale into a single **PNG** (lossless, no compression for photos/gradients) — easily 10–30 MB before it even enters the PDF.
2. That same massive image is **embedded again on every page** of the PDF (the loop calls `addImage` for each page with a shifted Y offset), multiplying the size by the page count.

## Fix

Rewrite `handleDownloadPDF` in `src/components/teacher/TeacherWorksheetBuilder.tsx` to use native jsPDF text rendering, mirroring the approach already used in `TeacherAiNotetaker.tsx`:

- Drop `html2canvas` from the PDF path entirely (keep it out of the import if unused).
- Render worksheet content directly with jsPDF primitives:
  - Header: logo (small JPEG/PNG via `urlToDataUrl`, drawn once), academy name, worksheet title, subject/grade/topic, instructions block.
  - Questions: numbered, wrapped with `splitTextToSize` and `contentW = pageW - 2*marginX`; auto-paginate via an `ensureSpace(h)` helper.
  - MCQ options A–D on their own lines.
  - `part_question` parts (a)(b)(c) with hanging indent and per-part marks.
  - `working` and `answer` blocks rendered in a muted/italic style only if the teacher toggled "include answer key" (preserve current behavior — read the existing flag in the file).
  - Diagrams: keep the current diagram rendering path if any (read the file to confirm — if diagrams are drawn via SVG/canvas today, rasterize only that small element as JPEG quality 0.7 and `addImage(..., "JPEG", ...)` inline, not the whole page).
- Footer with page number on every page.
- Save with `pdf.save(...)` and reuse the same blob (`pdf.output("blob")`) for any "save to resources" / upload path that currently exists in the worksheet builder, so uploaded copies shrink too.

Expected result: worksheet PDFs drop from 30–40 MB to typically **under 300 KB**, with sharper text (vector instead of raster) and selectable/searchable content.

## Files to edit

- `src/components/teacher/TeacherWorksheetBuilder.tsx` — rewrite `handleDownloadPDF` (and any sibling upload-blob path) to native jsPDF; remove `html2canvas` import if no longer used.

## Out of scope

- `TeacherAiNotetaker.tsx` — already on native jsPDF; no change needed (confirm size is small after this is merged; if not, revisit).
- Edge function, schema, UI layout, on-screen preview (`.worksheet-doc`) — all unchanged.
- No new dependencies.

## Open question

The worksheet builder currently supports diagrams (triangles, graphs, etc.) rendered in the preview. Should I:
- **(A)** Rasterize only the diagram element per question as a small JPEG and embed it inline (keeps diagrams visible, adds modest size per diagram), or
- **(B)** Skip diagrams in the PDF and add a "[Diagram: see on-screen preview]" placeholder (smallest files, but loses visual)?

I'll default to **(A)** unless you say otherwise.
