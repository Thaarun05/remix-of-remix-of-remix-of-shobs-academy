# Professional Restyle: Shobs Academy

## What "professional" means here

A legit tutoring academy site reads as credible before it reads as pretty. In practice that means: one committed colour system used consistently, a real typographic scale (not eight ad-hoc font sizes), predictable spacing rhythm, restrained shadows, and components that look like a family rather than a collection. The good news: the codebase already uses semantic tokens almost everywhere (only a handful of files carry hardcoded colours), so most of the upgrade happens in the design system itself and propagates automatically.

## Direction (locked from your picks)

- **Palette — Navy Trust:** `#0f1b3d` deep navy, `#1e3a5f` mid navy, `#3b6fa0` accent blue, `#e8edf3` pale surface.
- **Type — Libre Baskerville (headings) + IBM Plex Sans (body)**, IBM Plex Mono for numbers/IDs.
- **Layout — Dashboard panels:** header + sidebar + panel grid for all three role dashboards.
- **Scope — Everything:** public site, auth pages, and Student/Teacher/Admin dashboards.

## 1. Rebuild the design system

Rewrite the token layer in `src/index.css` and `tailwind.config.ts`:

- Replace the current purple/teal primaries with the navy scale (light and dark themes both).
- Role accents rebuilt as tints of the same family so they stop clashing: Student = accent blue, Teacher = deep navy, Admin = gold-adjacent brass reserved for authority actions.
- Swap Playfair/Montserrat for Libre Baskerville + IBM Plex Sans; define a fixed heading scale (display / h1 / h2 / h3 / body / caption) instead of per-page sizes.
- Tighten shadows to three levels (`sm`, `md`, `lg`) plus one focus ring. Drop the heavy glow/glass stack that currently reads as consumer-app rather than academy.
- Standardise radius (cards 12px, controls 8px), border colour, and a 4px spacing rhythm.

Remove the leftover Vite boilerplate in `src/App.css`.

## 2. Refit the shared components

Update the shadcn variants and shared pieces so every screen inherits the new system: Button, Card, Input/Select, Badge, Table, Tabs, Dialog, Toast. Then the app-level shell:

- `Navbar` — solid navy bar, logo lockup restored (it is currently rendered as an empty brand slot), user identity and sign-out grouped on the right.
- `DashboardLayout` / `DashboardSidebar` — proper app shell: fixed top bar, grouped sidebar navigation with section labels and active state, content region on a pale surface.
- `StatCard`, `ActionCard`, `ListCard`, `RecentItemsList`, `EmptyState` — one visual family: quiet borders, clear label/value hierarchy, consistent icon treatment.

## 3. Restyle the pages

- **Public:** Index (hero, credibility strip, subjects, how-it-works, demo CTA), About, NotFound.
- **Auth:** Student/Teacher/Admin login pages share one centred card layout, differing only by role accent.
- **Dashboards:** apply the panel grid — summary stats row, primary work panel, secondary side panel — to Student, Teacher, and Admin. Tab contents (assignments, attendance, fees, quizzes, worksheets, messaging, resources) get consistent page headers, toolbars, and table/card styling.
- Clean up the few files with hardcoded colours: `Whiteboard.tsx`, `TeacherWorksheetBuilder.tsx`, `StudentWhiteboards.tsx`, `StudentQuizzes.tsx`, `AttendanceBasedFeeCalculator.tsx`.

## 4. Polish pass

Responsive checks at mobile/tablet/desktop, light and dark mode contrast (WCAG AA on text), visible focus states, consistent loading skeletons and empty states, and a screenshot review of each major route before handing back.

## Out of scope

No changes to business logic, database, edge functions, or PDF generation output. Brand-coloured PDF headers will be updated to the new navy only if you ask.

## Notes

Work proceeds in the order above so the token layer lands first and the rest inherits it; each phase is reviewable in the preview.
