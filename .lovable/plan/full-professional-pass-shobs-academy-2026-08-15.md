# Full Professional Pass — Shobs Academy

The Navy Trust design system, app shell, dashboards, and login pages are already restyled. This pass finishes the job across the four areas you picked, using your existing logo (`src/assets/shobs-academy-logo.png`) throughout — no new brand assets, no stock photos of students.

## 1. Visual polish everywhere

Sweep the feature screens that were never touched by the restyle so nothing looks like a different app:

- Teacher: Worksheet Builder, Quiz Maker, AI Notetaker, Resources, Recordings, Notes, Work Done, Whiteboard, Attendance, Fees/Salary.
- Student: Quizzes, Notes, Whiteboards, Fee Sheet, Attendance History, Calendar.
- Admin: User Management, Work Done, Recording Submissions, Fee Calculator, Family Management, Messaging.

For each: replace leftover hardcoded colours with tokens, use one page-header pattern (title + short description + right-aligned actions), one toolbar/filter pattern, consistent card and table styling, and the shared empty/loading/error panels instead of ad-hoc spinners and "No data" text. Dialogs and forms get uniform widths, footers, and button order.

## 2. Content and credibility

- Rewrite the homepage as a real academy landing page: clear headline and subhead, what is taught and for which grades, how classes run, teacher-quality statement, honest trust strip (no invented numbers, ratings or testimonials), and a single strong demo-booking CTA.
- Rewrite About with founding story placeholders you can fill, teaching approach, and contact details.
- Add a proper footer: brand lockup, navigation, contact, and legal line.
- Metadata is already in place; refresh the homepage/About copy-driven titles and descriptions to match the new wording, and keep the JSON-LD accurate.
- Any fact I cannot verify (years running, student counts, exam results) I will leave as a clearly marked blank for you rather than inventing it.

## 3. Accessibility and responsiveness

- Audit every route: alt text, `aria-label` on icon-only buttons, labels bound to inputs, keyboard operability, visible focus, no skipped heading levels, one `<main>` per page.
- Contrast check both light and dark themes to WCAG AA.
- Tap targets to 44x44 on mobile; `h-dvh` instead of `h-screen`.
- Responsive checks at 375 / 768 / 1280: tables scroll or collapse to cards, dialogs fit small screens, sidebar and navbar behave, worksheet/quiz builders remain usable on tablet.

## 4. Performance and reliability

- Route-level code splitting for the three dashboards and heavy libraries (pdfjs, jsPDF, html2canvas) so the public site loads light.
- Add an app-level error boundary plus per-tab fallbacks so one failing panel does not blank the dashboard.
- Replace spinner-only waits with skeletons matching the final layout to stop layout shift.
- Trim any unused assets and dead CSS left over from the old design.

## Out of scope

No changes to business logic, database schema, RLS, edge functions, or AI generation behaviour. Fee, quiz, and worksheet output stay functionally identical.

## Approach

Delivered in the order above so the visual base lands first; each stage is reviewable in the preview, and I will screenshot the main routes at desktop and mobile before handing back.
