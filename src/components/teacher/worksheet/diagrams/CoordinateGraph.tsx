import { CoordinateGraphSpecT } from "@/lib/diagrams/schemas";
import { compileExpr } from "@/lib/diagrams/mathExpr";

const W = 480;
const H = 360;
const PAD_L = 34;
const PAD_R = 14;
const PAD_T = 14;
const PAD_B = 28;

export function CoordinateGraph({ spec }: { spec: CoordinateGraphSpecT }) {
  const [xMin, xMax] = spec.x_range;
  const [yMin, yMax] = spec.y_range;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const px = (x: number) => PAD_L + ((x - xMin) / (xMax - xMin || 1)) * plotW;
  const py = (y: number) => PAD_T + (1 - (y - yMin) / (yMax - yMin || 1)) * plotH;

  const stroke = "#111";
  const gridStroke = "#bbb";
  const textStyle = { fontFamily: "Georgia, serif", fontSize: 10, fill: "#111" } as const;

  const xTicks: number[] = [];
  for (let v = Math.ceil(xMin / spec.x_step) * spec.x_step; v <= xMax + 1e-9; v += spec.x_step) xTicks.push(+v.toFixed(6));
  const yTicks: number[] = [];
  for (let v = Math.ceil(yMin / spec.y_step) * spec.y_step; v <= yMax + 1e-9; v += spec.y_step) yTicks.push(+v.toFixed(6));

  const curves = (spec.functions ?? []).map((f, idx) => {
    let fn: (x: number) => number;
    try { fn = compileExpr(f.expr); } catch { return { d: "", label: f.label, error: true, idx }; }
    const [a, b] = f.domain ?? [xMin, xMax];
    const steps = 200;
    let d = "";
    let started = false;
    for (let i = 0; i <= steps; i++) {
      const x = a + ((b - a) * i) / steps;
      const y = fn(x);
      if (!Number.isFinite(y) || y < yMin - (yMax - yMin) || y > yMax + (yMax - yMin)) { started = false; continue; }
      const X = px(x), Y = py(y);
      d += (started ? " L " : " M ") + `${X.toFixed(2)} ${Y.toFixed(2)}`;
      started = true;
    }
    return { d, label: f.label, error: false, idx };
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: "100%", height: "auto" }} preserveAspectRatio="xMidYMid meet">
      {spec.grid && (
        <g>
          {xTicks.map((t, i) => (
            <line key={`gx${i}`} x1={px(t)} y1={PAD_T} x2={px(t)} y2={H - PAD_B} stroke={gridStroke} strokeWidth={0.5} />
          ))}
          {yTicks.map((t, i) => (
            <line key={`gy${i}`} x1={PAD_L} y1={py(t)} x2={W - PAD_R} y2={py(t)} stroke={gridStroke} strokeWidth={0.5} />
          ))}
        </g>
      )}
      {/* axes */}
      <line x1={PAD_L} y1={py(0)} x2={W - PAD_R} y2={py(0)} stroke={stroke} strokeWidth={1} />
      <line x1={px(0)} y1={PAD_T} x2={px(0)} y2={H - PAD_B} stroke={stroke} strokeWidth={1} />
      {/* tick labels */}
      {xTicks.map((t, i) => (
        <g key={`xl${i}`}>
          <line x1={px(t)} y1={py(0) - 3} x2={px(t)} y2={py(0) + 3} stroke={stroke} />
          {t !== 0 && <text x={px(t)} y={py(0) + 14} textAnchor="middle" style={textStyle}>{t}</text>}
        </g>
      ))}
      {yTicks.map((t, i) => (
        <g key={`yl${i}`}>
          <line x1={px(0) - 3} y1={py(t)} x2={px(0) + 3} y2={py(t)} stroke={stroke} />
          {t !== 0 && <text x={px(0) - 6} y={py(t) + 3} textAnchor="end" style={textStyle}>{t}</text>}
        </g>
      ))}
      {curves.map((c, i) => c.d && (
        <path key={`c${i}`} d={c.d} fill="none" stroke={stroke} strokeWidth={1.5} />
      ))}
      {(spec.segments ?? []).map((s, i) => (
        <line key={`s${i}`} x1={px(s.from.x)} y1={py(s.from.y)} x2={px(s.to.x)} y2={py(s.to.y)} stroke={stroke} strokeWidth={1.5} />
      ))}
      {(spec.points ?? []).map((p, i) => (
        <g key={`p${i}`}>
          <circle cx={px(p.x)} cy={py(p.y)} r={3} fill={stroke} />
          {p.label && <text x={px(p.x) + 6} y={py(p.y) - 6} style={textStyle}>{p.label}</text>}
        </g>
      ))}
    </svg>
  );
}