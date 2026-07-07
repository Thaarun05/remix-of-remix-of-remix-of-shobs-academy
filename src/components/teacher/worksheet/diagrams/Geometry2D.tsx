import { Geometry2DSpecT } from "@/lib/diagrams/schemas";

const W = 480;
const H = 320;
const PAD = 30;

export function Geometry2D({ spec }: { spec: Geometry2DSpecT }) {
  const verts = spec.vertices;
  const xs = verts.map((v) => v.x);
  const ys = verts.map((v) => v.y);
  const circleXs = (spec.circles ?? []).flatMap((c) => [c.center.x - c.radius, c.center.x + c.radius]);
  const circleYs = (spec.circles ?? []).flatMap((c) => [c.center.y - c.radius, c.center.y + c.radius]);
  const minX = Math.min(...xs, ...circleXs);
  const maxX = Math.max(...xs, ...circleXs);
  const minY = Math.min(...ys, ...circleYs);
  const maxY = Math.max(...ys, ...circleYs);
  const spanX = Math.max(1e-6, maxX - minX);
  const spanY = Math.max(1e-6, maxY - minY);
  const scale = Math.min((W - PAD * 2) / spanX, (H - PAD * 2) / spanY);
  const offsetX = (W - spanX * scale) / 2 - minX * scale;
  const offsetY = (H - spanY * scale) / 2 + maxY * scale; // flip y

  const project = (x: number, y: number) => ({
    x: x * scale + offsetX,
    y: offsetY - y * scale,
  });

  const byId = new Map(verts.map((v) => [v.id, project(v.x, v.y)]));

  const stroke = "#111";
  const common = { stroke, fill: "none", strokeWidth: 1.5 } as const;
  const textStyle = { fontFamily: "Georgia, serif", fontSize: 12, fill: "#111" } as const;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: "100%", height: "auto" }} preserveAspectRatio="xMidYMid meet">
      {(spec.circles ?? []).map((c, i) => {
        const p = project(c.center.x, c.center.y);
        return <circle key={`c${i}`} cx={p.x} cy={p.y} r={c.radius * scale} {...common} />;
      })}
      {spec.edges.map((e, i) => {
        const a = byId.get(e.from);
        const b = byId.get(e.to);
        if (!a || !b) return null;
        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;
        return (
          <g key={`e${i}`}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} {...common} />
            {e.length_label && (
              <text x={midX} y={midY - 6} textAnchor="middle" style={textStyle}>
                {e.length_label}{spec.units ? ` ${spec.units}` : ""}
              </text>
            )}
          </g>
        );
      })}
      {spec.angles.map((a, i) => {
        const at = byId.get(a.at_vertex);
        const from = byId.get(a.from);
        const to = byId.get(a.to);
        if (!at || !from || !to) return null;
        const v1 = { x: from.x - at.x, y: from.y - at.y };
        const v2 = { x: to.x - at.x, y: to.y - at.y };
        const n1 = Math.hypot(v1.x, v1.y) || 1;
        const n2 = Math.hypot(v2.x, v2.y) || 1;
        const r = 20;
        const p1 = { x: at.x + (v1.x / n1) * r, y: at.y + (v1.y / n1) * r };
        const p2 = { x: at.x + (v2.x / n2) * r, y: at.y + (v2.y / n2) * r };
        const labelPos = { x: at.x + ((v1.x / n1 + v2.x / n2) / 2) * (r + 10), y: at.y + ((v1.y / n1 + v2.y / n2) / 2) * (r + 10) };
        return (
          <g key={`ang${i}`}>
            {a.mark === "right" ? (
              <path d={`M ${p1.x} ${p1.y} L ${p1.x + (v2.x / n2) * r} ${p1.y + (v2.y / n2) * r} L ${p2.x} ${p2.y}`} {...common} />
            ) : (
              <path d={`M ${p1.x} ${p1.y} A ${r} ${r} 0 0 1 ${p2.x} ${p2.y}`} {...common} />
            )}
            {a.label && <text x={labelPos.x} y={labelPos.y} textAnchor="middle" style={textStyle}>{a.label}</text>}
          </g>
        );
      })}
      {verts.map((v) => {
        const p = byId.get(v.id)!;
        return (
          <g key={v.id}>
            <circle cx={p.x} cy={p.y} r={2.5} fill={stroke} />
            {v.label && <text x={p.x + 6} y={p.y - 6} style={textStyle}>{v.label}</text>}
          </g>
        );
      })}
    </svg>
  );
}