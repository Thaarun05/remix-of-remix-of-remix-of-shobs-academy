import { DiagramV2 } from "@/lib/diagrams/schemas";
import { Geometry2D } from "./Geometry2D";
import { CoordinateGraph } from "./CoordinateGraph";
import { NumberLine } from "./NumberLine";

export function DiagramRenderer({ diagram }: { diagram: DiagramV2 }) {
  if (!diagram || !diagram.spec || diagram.error) {
    return (
      <div className="text-xs italic text-destructive border border-destructive/40 bg-destructive/10 rounded p-2">
        Diagram could not be generated for this question.
        {diagram?.description ? <> Intended figure: {diagram.description}</> : null}
      </div>
    );
  }
  if (diagram.kind === "geometry_2d") return <Geometry2D spec={diagram.spec} />;
  if (diagram.kind === "coordinate_graph") return <CoordinateGraph spec={diagram.spec} />;
  if (diagram.kind === "number_line") return <NumberLine spec={diagram.spec} />;
  return null;
}