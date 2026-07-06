// Pure helpers for computing sibling discounts.
// No DB access — takes settings + members list and returns the breakdown.

export interface SiblingDiscountSettings {
  second_child_pct: number;
  third_plus_pct: number;
  family_cap_pct: number;
  per_student_floor_pct: number;
}

export interface SiblingMemberInput {
  student_user_id: string;
  student_name?: string;
  base_fee: number;
  rank: number; // 1-based, computed from enrollment order among active members
}

export interface SiblingDiscountRow {
  student_user_id: string;
  student_name?: string;
  rank: number;
  base_fee: number;
  tier_pct: number;
  raw_discount: number;
  final_discount_pct: number;
  final_discount_amount: number;
  final_fee: number;
  floor_applied: boolean;
  cap_applied: boolean;
}

export function tierPctForRank(
  rank: number,
  settings: SiblingDiscountSettings,
  familyOverridePct?: number | null,
): number {
  if (rank <= 1) return 0;
  if (familyOverridePct != null) return Number(familyOverridePct);
  if (rank === 2) return Number(settings.second_child_pct);
  return Number(settings.third_plus_pct);
}

export function computeSiblingDiscounts(
  members: SiblingMemberInput[],
  settings: SiblingDiscountSettings,
  familyOverridePct?: number | null,
): SiblingDiscountRow[] {
  const floorPct = Number(settings.per_student_floor_pct);
  const capPct = Number(settings.family_cap_pct);

  // Step 1-2: tier + raw
  const stage = members.map((m) => {
    const tier_pct = tierPctForRank(m.rank, settings, familyOverridePct);
    const raw_discount = (m.base_fee * tier_pct) / 100;
    return { m, tier_pct, raw_discount };
  });

  // Step 3: per-student floor
  const floored = stage.map(({ m, tier_pct, raw_discount }) => {
    const floorAmt = (m.base_fee * floorPct) / 100;
    const capped = Math.min(raw_discount, floorAmt);
    return { m, tier_pct, raw_discount, capped, floor_applied: capped < raw_discount };
  });

  // Step 4: family cap
  const totalBase = floored.reduce((s, r) => s + r.m.base_fee, 0);
  const familyCap = (totalBase * capPct) / 100;
  const sumCapped = floored.reduce((s, r) => s + r.capped, 0);
  const scale = sumCapped > familyCap && sumCapped > 0 ? familyCap / sumCapped : 1;
  const capApplied = scale < 1;

  return floored.map(({ m, tier_pct, raw_discount, capped, floor_applied }) => {
    const final_discount_amount = capped * scale;
    const final_discount_pct = m.base_fee > 0 ? (final_discount_amount / m.base_fee) * 100 : 0;
    return {
      student_user_id: m.student_user_id,
      student_name: m.student_name,
      rank: m.rank,
      base_fee: m.base_fee,
      tier_pct,
      raw_discount,
      final_discount_pct,
      final_discount_amount,
      final_fee: m.base_fee - final_discount_amount,
      floor_applied,
      cap_applied: capApplied,
    };
  });
}

export function rankSuffix(rank: number): string {
  if (rank === 1) return "1st";
  if (rank === 2) return "2nd";
  if (rank === 3) return "3rd";
  return `${rank}th`;
}