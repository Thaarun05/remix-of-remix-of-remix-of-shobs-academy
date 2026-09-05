# Auto-calculate Teacher Salary from Work Done + Fee Settings

Make the Teacher Salary page fill itself in, instead of the admin typing hours and rates by hand.

## How it will work

1. Admin opens Teacher Salary and picks a teacher and a month.
2. The page pulls that teacher's attendance/Work Done records for that month (only classes marked present).
3. For every student in that list it looks up the hourly pay set on the Student Fee Settings page.
4. It shows a per-student breakdown:
   - Student name, number of classes, total hours, hourly pay, amount
5. Totals fill in automatically: total classes, total hours, total amount. The admin can still edit them before sending, and can add a note as today.
6. Sending works exactly as now: the salary record is saved and the teacher gets a notification.

## Details the admin will see

- Any student with no hourly pay set yet is highlighted as "rate not set" and counts 0 towards the amount, with a shortcut hint to set it in Student Fee Settings.
- A "Recalculate" action re-pulls the month if attendance changed.
- Amounts shown in INR using the existing Rs. text format.

## Technical notes

- New helper in `src/pages/AdminDashboard.tsx` (or a small extracted component `src/components/admin/TeacherSalaryCalculator.tsx`) that:
  - queries `attendance_records` for `teacher_user_id = <teacher>`, `date` within the selected month, `status = 'present'`, `deleted_at is null`, paginated in 1000-row pages (same cap fix used in Work Done);
  - groups by `student_user_id`, summing `hours` (falling back to start/end time difference, else 1h) and counting classes;
  - joins names from `student_profiles`, rates from `student_fee_settings` (`fee_given`, keyed on student + teacher).
- Amount per student = hours x fee_given; total amount = sum.
- `teacher_salary` has a single `salary_per_hour`, so it stores the blended rate = total amount / total hours (rounded to 2dp), keeping the existing schema and the teacher-side view unchanged. `num_classes` and `total_hours` come from the computed totals; `amount` is the exact summed total.
- No database changes required.
