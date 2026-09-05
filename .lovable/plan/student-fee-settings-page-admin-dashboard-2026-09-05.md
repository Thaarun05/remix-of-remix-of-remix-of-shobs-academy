# Student Fee Settings page (Admin Dashboard)

## What you'll see

A new **"Student Fee Settings"** item in the Admin Dashboard sidebar. Opening it shows:

1. A **teacher dropdown** listing every teacher by name.
2. Selecting a teacher lists **all their students** (from both assignment sources the app already uses).
3. Next to each student's name, two amount boxes:
   - **Fee Collected** — the amount the parent pays for that student.
   - **Fee Given** — the amount passed on to the teacher.
4. Entering or changing an amount saves it, and the saved values are shown again next time the page is opened. Amounts are displayed in INR (Rs.).

## How it will work

- New `src/components/admin/StudentFeeSettings.tsx` component:
  - Loads teachers from `profiles` (role = teacher), same as the existing admin pages.
  - On teacher selection, loads students via `student_teacher_assignments` merged with `student_profiles.assigned_teacher_id` (the same dual-source lookup used elsewhere, so no student is missed).
  - Each student row: name, a "Fee Collected" number input, a "Fee Given" number input, and a Save action (saves per row; empty = not set).
- New database table `student_fee_settings`:
  - `student_user_id`, `teacher_user_id`, `fee_collected` (numeric), `fee_given` (numeric), plus timestamps.
  - One row per student+teacher pair (upsert on save).
  - Admin-only access: only admins can view or edit these amounts; teachers and students cannot.
- Sidebar registration: add the item to `adminSidebarItems` in `DashboardSidebar.tsx` and render `{activeTab === "fee-settings" && <StudentFeeSettings />}` in `AdminDashboard.tsx`, following the same pattern as the existing Work Done / Recordings pages.

## Technical details

- Migration: `CREATE TABLE public.student_fee_settings` with GRANTs (`authenticated` select/insert/update/delete + `service_role` all), RLS enabled, policies scoped to `public.has_role(auth.uid(), 'admin')`, unique constraint on `(student_user_id, teacher_user_id)`, `updated_at` trigger.
- UI follows existing admin card/table styling and the INR ASCII "Rs." formatting rule.
- These are manually set admin settings — they do not change the existing fee calculator or salary calculations.
