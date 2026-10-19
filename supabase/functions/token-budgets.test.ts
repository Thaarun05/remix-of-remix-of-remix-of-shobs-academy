import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

// Exercise the actual inline budgets without importing Deno HTTP handlers.
function budget(functionName: string, flagName: string, enabled: boolean) {
  const source = readFileSync(new URL(`./${functionName}/index.ts`, import.meta.url), "utf8");
  const expression = source.match(/const budgetFor = \([^)]*\) =>\s*([^;]+);/)?.[1];
  if (!expression) throw new Error(`Missing budget in ${functionName}`);
  return new Function("n", "qCount", flagName, `return ${expression};`) as
    (n: number, qCount: number, enabled: boolean) => number;
}

describe("approved generation token budgets", () => {
  test("worksheet scales with count and optional answers, capped at 32000", () => {
    const calculate = budget("generate-worksheet", "includeAnswers", true);
    for (const [count, without, withAnswers] of [[10, 9500, 13000], [20, 15000, 22000], [30, 20500, 31000], [50, 31500, 32000]]) {
      expect(calculate(count, count, false)).toBe(without);
      expect(calculate(count, count, true)).toBe(withAnswers);
    }
    expect(calculate(15, 15, true)).toBe(17500);
  });

  test("quiz scales with count and optional explanations, capped at 32000", () => {
    const calculate = budget("generate-quiz", "includeExplanations", true);
    expect(calculate(10, 10, true)).toBe(8500);
    expect(calculate(10, 10, false)).toBe(6500);
    expect(calculate(30, 30, true)).toBe(19500);
    expect(calculate(50, 50, true)).toBe(30500);
    expect(calculate(100, 100, true)).toBe(32000);
    expect(calculate(15, 15, true)).toBe(11250);
  });
});