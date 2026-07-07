import { z } from "zod";

// geometry_2d
export const Geometry2DSpec = z.object({
  vertices: z.array(z.object({
    id: z.string(),
    x: z.number(),
    y: z.number(),
    label: z.string().optional(),
  })).min(1),
  edges: z.array(z.object({
    from: z.string(),
    to: z.string(),
    length_label: z.string().optional(),
  })).default([]),
  angles: z.array(z.object({
    at_vertex: z.string(),
    from: z.string(),
    to: z.string(),
    label: z.string().optional(),
    mark: z.enum(["arc", "right"]).optional(),
  })).default([]),
  circles: z.array(z.object({
    center: z.object({ x: z.number(), y: z.number() }),
    radius: z.number().positive(),
    label: z.string().optional(),
  })).optional(),
  units: z.string().optional().default(""),
});
export type Geometry2DSpecT = z.infer<typeof Geometry2DSpec>;

// coordinate_graph
export const CoordinateGraphSpec = z.object({
  x_range: z.tuple([z.number(), z.number()]),
  y_range: z.tuple([z.number(), z.number()]),
  x_step: z.number().positive().default(1),
  y_step: z.number().positive().default(1),
  grid: z.boolean().default(true),
  functions: z.array(z.object({
    expr: z.string(),
    domain: z.tuple([z.number(), z.number()]).optional(),
    label: z.string().optional(),
  })).optional(),
  points: z.array(z.object({
    x: z.number(),
    y: z.number(),
    label: z.string().optional(),
  })).optional(),
  segments: z.array(z.object({
    from: z.object({ x: z.number(), y: z.number() }),
    to: z.object({ x: z.number(), y: z.number() }),
    label: z.string().optional(),
  })).optional(),
});
export type CoordinateGraphSpecT = z.infer<typeof CoordinateGraphSpec>;

// number_line
export const NumberLineSpec = z.object({
  range: z.tuple([z.number(), z.number()]),
  step: z.number().positive().default(1),
  ticks: z.array(z.number()).optional(),
  points: z.array(z.object({
    value: z.number(),
    label: z.string().optional(),
    filled: z.boolean().optional(),
  })).optional(),
  intervals: z.array(z.object({
    from: z.number(),
    to: z.number(),
    open_from: z.boolean().optional(),
    open_to: z.boolean().optional(),
    label: z.string().optional(),
  })).optional(),
});
export type NumberLineSpecT = z.infer<typeof NumberLineSpec>;

export type DiagramKind = "geometry_2d" | "coordinate_graph" | "number_line";

export interface DiagramV2 {
  kind: DiagramKind;
  spec: any | null;
  caption?: string;
  error?: string;
  // legacy fallback description from Pass A
  description?: string;
}

export function validateDiagramSpec(kind: DiagramKind, spec: unknown) {
  if (kind === "geometry_2d") return Geometry2DSpec.safeParse(spec);
  if (kind === "coordinate_graph") return CoordinateGraphSpec.safeParse(spec);
  return NumberLineSpec.safeParse(spec);
}