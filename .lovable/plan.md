# Deep Component Pass — Student Experience + Product-Wide Polish

Two tracks, applied across the public site and all three dashboards. No new content pages, no business-logic or database changes.

## Track A — Student and parent experience

The student side currently shows raw data (lists of assignments, quizzes, fees, attendance) with no sense of progress or "what do I do next". This track adds the layer a tutoring family actually cares about, built only from data already in the app.

- **"Next up" panel** on the student dashboard: the next class, the nearest assignment deadline, and any open quiz, in one glanceable card at the top.
- **Progress summary**: quiz average and attempt history, assignments completed vs pending, attendance rate this month — derived from existing tables, no new schema.
- **Deadline urgency**: due-date chips that read "Due today", "Due in 3 days", "Overdue" instead of bare dates, colour-coded with status tokens.
- **Attendance and fee transparency**: clear month summary at the top of each screen (classes attended, amount due, last payment) so a parent can read it in five seconds.
- **Notification clarity**: notification bell items get a type icon, relative time, and a click-through to the exact tab.
- **Empty states with a next action**: "No quizzes yet — your teacher will assign one" rather than "No data".

## Track B — Product-wide component and copy polish

Applied to every screen, every role.

- **Buttons**: one size/variant vocabulary. Every destructive action goes through a confirm dialog; every async button shows a spinner and disables while pending; every icon-only button has a label and tooltip.
- **Forms**: consistent label, helper text, inline error, and success feedback. Required fields marked. Submit disabled only when genuinely invalid, never silently.
- **Loading**: replace spinner-only waits with skeletons shaped like the final content (the app has a Skeleton primitive but no screen uses it today).
- **Tables and lists**: one row density, sticky headers, horizontal scroll or card collapse on mobile, and a consistent row-actions pattern.
- **Dialogs**: uniform widths, footer button order (cancel left, primary right), scroll behaviour on small screens, ESC and focus handling.
- **Toasts**: consistent titles and tone across the 35 files that raise them — short, factual, no exclamation marks, and always say what happened to what.
- **Micro-copy sweep**: every heading, button, placeholder, tooltip, empty state and error message reviewed for sentence case, plain English, and academy tone. Removes leftover developer phrasing.
- **Status vocabulary**: one shared set of badges for pending / submitted / graded / approved / overdue, used identically by student, teacher and admin.
- **Keyboard and focus**: tab order, visible focus, and dialog focus traps checked on every route.
- **Responsive checks** at 375 / 768 / 1280 for each dashboard tab.

## Technical notes

- New shared primitives: `StatusBadge`, `DueDateChip`, `ConfirmButton`, `SkeletonList` / `SkeletonTable`, and a `toastMessages` helper for consistent notification copy.
- Existing `PageHeader`, `EmptyState`, `StateViews`, and `ErrorBoundary` become mandatory on every panel; ad-hoc versions get removed.
- Student summary values are computed client-side from existing queries; no migrations, no RLS changes, no edge function changes.

## Out of scope

Pricing, teacher bios, testimonials, FAQ and legal pages (skipped per your choice). No changes to fee formulas, quiz grading, worksheet generation, or auth flows.

## Order of work

1. Shared primitives and status vocabulary.
2. Student dashboard experience track.
3. Teacher dashboard sweep.
4. Admin dashboard sweep.
5. Public site and auth final polish, then a responsive and keyboard pass with screenshots.
