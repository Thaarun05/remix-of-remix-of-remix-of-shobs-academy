# Fix Work Done counts + make Work Done fully attendance-driven

## What's wrong today (verified)

Checking the database directly for the teacher in question:

- August 2026 has **199** attendance records, July 2026 has **179** — and the teacher's full-year total is **1020** records.
- The Work Done tab loads the **whole year in one request**, and the backend caps a single request at **1000 rows**. The last 20 rows of the year get silently dropped, so August shows 179 (July's number) instead of 199.

The same uncapped year query exists in the Admin "Work Done" tab, where it loads every teacher at once (even more rows), so admin badges are wrong too.

Also, Work Done currently has its own "Add Entry" form that writes new rows into attendance. That is a second, parallel way of creating attendance data — the user wants Work Done to be a pure reflection of attendance.

## Changes

### 1. Correct the counts (no data changes)

- Replace the single year-wide fetch with **12 per-month count queries** (count only, no rows) in the teacher Work Done tab, so month badges are exact regardless of volume.
- Apply the same fix in the Admin Work Done tab, counted per teacher/month.
- For the month and week views, fetch rows in pages (1000 at a time) so no day is ever missing entries.

No attendance rows are added, edited, or deleted. Existing totals stay exactly as they are — only the displayed numbers become accurate (August will read 199).

### 2. Work Done becomes read-only, auto-fed by attendance

- Remove the "Add Entry" form (student / topic / start / end / Save entry) and the delete button from the Work Done day panel.
- The day panel becomes a full detail list of that day's attendance, showing every field stored on the record: student name, status (Present/Absent), date, start–end time when set, hours, and topic/work covered.
- Add a short note pointing teachers to the Attendance tab as the single place to add or edit entries.
- Month/week/year badges keep counting attendance records exactly as they do now.
- Editing continues to happen in the Attendance tab; Work Done refreshes from attendance on every visit.

### 3. Attendance keeps all the detail Work Done shows

The attendance entry form currently captures date, status, hours, topic. Start/end time exist on the record but can only be set from the old Work Done form. To keep Work Done complete once that form is gone, add optional **Start time** and **End time** inputs to the Attendance record form and the Edit Attendance dialog; when both are filled, hours is auto-computed (still overridable).

### 4. Monthly submission unchanged

The "Submit to Admin" monthly flow and admin approval logic stay exactly as they are.

## Technical notes

- Files: `src/components/teacher/TeacherWorkDone.tsx`, `src/components/admin/AdminWorkDone.tsx`, `src/components/teacher/tabs/AttendanceTab.tsx`, and the attendance form/edit-dialog state in `src/pages/TeacherDashboard.tsx`.
- Counting uses `select("*", { count: "exact", head: true })` per month; row fetches use `.range()` pagination.
- No database migration required — `attendance_records` already has `start_time`, `end_time`, `hours`, `topic`, `status`.
