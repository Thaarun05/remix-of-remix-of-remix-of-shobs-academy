import { create, all, MathNode } from "mathjs";

// Restricted mathjs instance — no import, no eval, disable dangerous functions.
const math = create(all, {});
math.import({
  import: function () { throw new Error("Disabled"); },
  createUnit: function () { throw new Error("Disabled"); },
  evaluate: function () { throw new Error("Disabled"); },
  parse: function () { throw new Error("Disabled"); },
  simplify: function () { throw new Error("Disabled"); },
  derivative: function () { throw new Error("Disabled"); },
}, { override: true });

const ALLOWED_FUNCS = new Set([
  "sin", "cos", "tan", "asin", "acos", "atan",
  "sqrt", "abs", "log", "log10", "ln", "exp",
  "min", "max", "pow", "round", "floor", "ceil",
]);

function walkSafe(node: MathNode) {
  node.forEach((child) => walkSafe(child));
  const type = (node as any).type;
  if (type === "FunctionNode") {
    const name = (node as any).fn?.name;
    if (!name || !ALLOWED_FUNCS.has(name)) {
      throw new Error(`Function ${name} not allowed`);
    }
  }
  if (type === "SymbolNode") {
    const name = (node as any).name;
    if (name !== "x" && name !== "e" && name !== "pi" && !ALLOWED_FUNCS.has(name)) {
      throw new Error(`Symbol ${name} not allowed`);
    }
  }
  if (type === "AssignmentNode" || type === "FunctionAssignmentNode" || type === "AccessorNode") {
    throw new Error("Statement type not allowed");
  }
}

export function compileExpr(expr: string): (x: number) => number {
  // Normalize ^ (mathjs treats ^ as power OK). Reject empty.
  const src = String(expr || "").trim();
  if (!src) throw new Error("Empty expression");
  const node = math.parse(src);
  walkSafe(node);
  const compiled = node.compile();
  return (x: number) => {
    try {
      const v = compiled.evaluate({ x });
      return typeof v === "number" ? v : Number(v);
    } catch {
      return NaN;
    }
  };
}