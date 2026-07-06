## Sibling Discount Feature

Add a sibling-discount layer on top of the existing fee calculators (`AttendanceBasedFeeCalculator` and, where relevant, `FeeSheetCalculator`). Base-fee math is untouched — the discount is applied afterwards and stored as a separate breakdown.

---

### 1. Data model (migration)

New tables (public schema, RLS on, GRANTs to `authenticated` + `service_role`, admin-only policies via `has_role(auth.uid(), 'admin')`):

- **`families`**
  - `id uuid pk`, `name text not null` (e.g. "Sharma Family"), `notes text`, `created_at`, `updated_at`, `deleted_at`

- **`family_members`**
  - `id uuid pk`, `family_id uuid fk families`, `student_user_id uuid fk auth.users`
  - `enrolled_at timestamptz not null default now()` — admin-editable; drives sibling rank
  - `withdrawn_at timestamptz null` — mid-term withdrawal marker; when set, this student stops receiving discounts from that date onward
  - `unique(student_user_id) where withdrawn_at is null` (a student is in at most one active family)

- **`sibling_discount_settings`** (singleton row, id=1)
  - `second_child_pct numeric not null default 10`
  - `third_plus_pct numeric not null default 15`
  - `family_cap_pct numeric not null default 18`
  - `per_student_floor_pct numeric not null default 20`
  - `updated_by`, `updated_at`

New columns on **`student_fees`** (no changes to how `total_amount` is computed today; add breakdown columns):
- `base_amount numeric` — snapshot of pre-discount fee (= `total_hours * fee_per_hour`)
- `sibling_discount_pct numeric default 0`
- `sibling_discount_amount numeric default 0`
- `final_amount numeric` — `base_amount - sibling_discount_amount` (this becomes the "amount due")
- `sibling_rank int null`
- `family_id uuid null` — snapshot at time of invoice
- `discount_override_pct numeric null` — manual override, per invoice
- `discount_override_reason text null`
- `discount_override_by uuid null` (admin user_id)

Rationale: `total_amount` stays as the base for backward compat; UI/PDF start reading `final_amount` when present, falling back to `total_amount`.

Also add `manual_override_pct` / `manual_override_reason` / `override_set_by` / `override_set_at` on **`families`** for a family-wide standing override (applies to future cycles until cleared, logged in an audit trail).

- **`family_discount_overrides`** (audit log)
  - `id`, `family_id`, `admin_user_id`, `override_pct numeric null` (null = cleared), `reason text`, `created_at`

---

### 2. Discount computation (client-side, in the calculator)

Pure helper `src/lib/siblingDiscount.ts`:

```text
input:  [{ student_user_id, base_fee, rank }], settings
        rank = enrollment order among active (non-withdrawn) family members
output: [{ student_user_id, base_fee, tier_pct, raw_discount,
          final_discount_pct, final_discount_amount, final_fee }]
```

Steps (matches spec exactly):
1. Assign `tier_pct` by rank: rank 1 → 0%, rank 2 → `second_child_pct`, rank ≥3 → `third_plus_pct`.
2. `raw_discount[i] = base_fee[i] * tier_pct[i] / 100`.
3. Enforce per-student floor: `capped_i = min(raw_discount[i], base_fee[i] * floor_pct / 100)`.
4. Enforce family cap: if `sum(capped_i) > sum(base_fee) * family_cap_pct / 100`, scale all `capped_i` down proportionally (`* cap_total / sum(capped_i)`).
5. Return final numbers + breakdown.

Family-level manual override (`families.manual_override_pct`) bypasses tier logic: every non-rank-1 member gets exactly that pct (still subject to per-student floor). Logged in `family_discount_overrides` whenever set/changed.

Rank computation at calculation time: `ORDER BY enrolled_at ASC` among members where `withdrawn_at IS NULL OR withdrawn_at > invoice_month_end`. Withdrawn students: no discount from the withdrawal date forward; siblings re-rank automatically next cycle. Past invoices are never rewritten (breakdown is snapshotted).

---

### 3. Admin UI

**a. Family management page** — new tab in Admin dashboard "Families"
- List families with member count + total active members
- Create family, rename, soft-delete
- Add/remove students (searchable dropdown, blocked if student is already in another active family)
- Edit `enrolled_at` per member (default = row creation time, admin can correct)
- Mark member withdrawn (sets `withdrawn_at`)
- Family manual-override control: pct + reason (creates audit-log entry; shows badge "Manual override active")

**b. Sibling discount settings** — new section inside the same Families tab (or a small settings card):
- Editable numeric inputs for `second_child_pct`, `third_plus_pct`, `family_cap_pct`, `per_student_floor_pct` with Save

**c. Fee calculator integration** (`AttendanceBasedFeeCalculator.tsx`)
- When the selected student belongs to an active family with ≥2 active members, after `handleCalculate`:
  1. Fetch the family's active siblings + settings (single query).
  2. Compute each member's would-be base fee for the month using their own attendance × the same rate (or the last saved base for that month if a fee already exists — falls back to just this student when others have no attendance yet).
  3. Show a "Sibling discount applied" panel under the fee breakdown:
     - Base fee, Rank (1st/2nd/3rd+), Tier %, Applied discount %, Discount amount, Final fee
     - Note if family cap or per-student floor was the binding constraint
     - "Manual override active" badge if applicable
- `saveFeeRecord` writes the new breakdown columns (`base_amount`, `sibling_discount_pct`, `sibling_discount_amount`, `final_amount`, `sibling_rank`, `family_id`). `total_amount` continues to hold the base (unchanged code path); `final_amount` is what students see as the amount due.

**d. Student fee sheet + PDF**
- `StudentFeeSheet.tsx` and `feePdfBuilder`: if `sibling_discount_amount > 0`, render an extra breakdown block (Base, Sibling discount −X%, Final). Otherwise unchanged.
- Notification body uses `final_amount` when present.

Non-family flow is byte-identical to today (all new columns default to 0/null).

---

### 4. Out of scope
- Auto-detecting families by surname/phone.
- Retroactive rewrites of past invoices.
- Applying the discount inside `FeeSheetCalculator` (the older calculator) unless you want that too — I'll wire the breakdown display there as a read-only enhancement but keep authoring in `AttendanceBasedFeeCalculator`.

---

### Technical notes
- RLS: all new tables admin-only for writes; `authenticated` read allowed on `sibling_discount_settings` and `family_members` filtered to `student_user_id = auth.uid()` so students can see their own family membership (needed if we ever want to show them "Sibling discount applied").
- Rank is derived, never stored on `family_members`; only snapshotted onto the invoice row (`sibling_rank`).
- The pure discount helper gets a small unit-testable surface (no DB deps).
- `student_fees.total_amount` stays as the base so existing queries/reports don't break; new `final_amount` is authoritative for amount-due UI going forward.
