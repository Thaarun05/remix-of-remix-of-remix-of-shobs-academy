# Parent Dashboard

A read-only parent view of a child's progress, opened with the child's own login. No new accounts are created.

## How a parent gets in

- On the student login page, add a "Parent view" option. The parent signs in with their child's ID and password, exactly as the child does.
- After sign-in with parent view chosen, the app opens `/parent` instead of the student dashboard.
- A link in the header lets them switch back to the full student dashboard, and the sign-out button works the same.
- Because the login is the child's, everything shown is already data that login is allowed to see. No permission changes are needed.

## Children switcher

- If the child belongs to a family with siblings, a switcher at the top lets the parent move between children.
- Sibling data is only visible when those siblings are in the same family record. A small, tightly-scoped backend read is added for this, returning only siblings of the signed-in student's family.
- If there is only one child, the switcher is hidden.

## What the parent sees

Overview (landing): child's name and grade, plus summary cards — attendance this month, classes attended, pending assignments, quizzes due, and outstanding fees. A "Next up" panel shows the next class and nearest assignment deadline.

Sections in the sidebar:
- **Schedule** — calendar of upcoming and past classes.
- **Attendance** — full history with dates, hours, topic and present/absent status.
- **Assignments** — title, subject, due date and status. View-only: no submitting, no uploads.
- **Quizzes** — assigned quizzes, attempts used, and scores. View-only: no starting an attempt.
- **Learning material** — notes, whiteboards and shared recordings, downloadable.
- **Fees** — fee sheet and invoices with amounts in INR, status, and PDF download.
- **Message admin** — a conversation with the academy admin. Teacher messaging stays in the student dashboard.

## Technical notes

- New route `/parent` rendering `src/pages/ParentDashboard.tsx`, using the existing `DashboardLayout` with a new `parent` colour variant and its own sidebar item list in `DashboardSidebar.tsx`.
- Guarded by the existing `ProtectedRoute` with `allowedRole="student"`; a `parentMode` flag in `AuthContext` (persisted in `localStorage`) decides whether `/student` or `/parent` is the landing page after login.
- Reuses existing components in read-only mode: `StudentCalendar`, `StudentAttendanceHistory`, `StudentNotes`, `StudentWhiteboards`, `StudentQuizzes`, `StudentFeeSheet`, `NextUpPanel`. Where a component has write actions (assignment upload, quiz start), a `readOnly` prop hides those controls rather than duplicating the component.
- Parent-admin messaging reuses the messaging components; conversations are keyed to the student and an admin, mirroring the existing admin-teacher pattern. This needs one new table for parent-admin threads with row-level rules limiting access to the student and admins.
- Sibling lookup uses a security-definer function returning siblings sharing a `family_members.family_id` with the signed-in student, plus a policy allowing a student to read a sibling's attendance, assignments, quizzes and fees only through the parent view queries.
- Money stays formatted with the plain `INR` label, per existing convention.

## Note on the reference image

No reference image came through with the request. The layout follows the existing dashboard style (sidebar plus summary cards). If you re-attach the image, the layout can be adjusted to match it.
