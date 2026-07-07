import { NumberLineSpecT } from "@/lib/diagrams/schemas";

const W = 480;
const H = 120;
const PAD = 30;

export function NumberLine({ spec }: { spec: NumberLineSpecT }) {
  const [min, max] = spec.range;
  const px = (v: number) => PAD + ((v - min) / (max - min || 1)) * (W - PAD * 2);
  const y = 60;
  const ticks = spec.ticks && spec.ticks.length ? spec.ticks : (() => {
    const t: number[] = [];
    for (let v = min; v <= max + 1e-9; v += spec.step) t.push(+v.toFixed(6));
    return t;
  })();
  const stroke = "#111";
  const textStyle = { fontFamily: "Georgia, serif", fontSize: 11, fill: "#111" } as const;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: "100%", height: "auto" }} preserveAspectRatio="xMidYMid meet">
      <defs>
        <marker id="nl-arr-l" markerWidth="8" markerHeight="8" refX="1" refY="4" orient="auto">
          <path d="M8,0 L2,4 L8,8" fill="none" stroke={stroke} />
        </marker>
        <marker id="nl-arr-r" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L6,4 L0,8" fill="none" stroke={stroke} />
        </marker>
      </defs>
      <line x1={12} y1={y} x2={W - 12} y2={y} stroke={stroke} strokeWidth={1.2} markerStart="url(#nl-arr-l)" markerEnd="url(#nl-arr-r)" />
      {ticks.map((t, i) => (
        <g key={`t${i}`}>
          <line x1={px(t)} y1={y - 6} x2={px(t)} y2={y + 6} stroke={stroke} />
          <text x={px(t)} y={y + 22} textAnchor="middle" style={textStyle}>{t}</text>
        </g>
      ))}
      {(spec.intervals ?? []).map((iv, i) => {
        const x1 = px(iv.from), x2 = px(iv.to);
        return (
          <g key={`iv${i}`}>
            <line x1={x1} y1={y - 12} x2={x2} y2={y - 12} stroke={stroke} strokeWidth={3} />
            <circle cx={x1} cy={y - 12} r={4} fill={iv.open_from ? "#fff" : stroke} stroke={stroke} />
            <circle cx={x2} cy={y - 12} r={4} fill={iv.open_to ? "#fff" : stroke} stroke={stroke} />
            {iv.label && <text x={(x1 + x2) / 2} y={y - 20} textAnchor="middle" style={textStyle}>{iv.label}</text>}
          </g>
        );
      })}
      {(spec.points ?? []).map((p, i) => (
        <g key={`p${i}`}>
          <circle cx={px(p.value)} cy={y} r={4} fill={p.filled === false ? "#fff" : stroke} stroke={stroke} />
          {p.label && <text x={px(p.value)} y={y - 12} textAnchor="middle" style={textStyle}>{p.label}</text>}
        </g>
      ))}
    </svg>
  );
}