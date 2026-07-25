/** Shared worksheet types for teacher AI Worksheet Builder */

export type QuestionType =
  | "mcq"
  | "short_answer"
  | "fill_blank"
  | "numerical"
  | "true_false"
  | "diagram"
  | "part_question";

export interface QuestionPart {
  label: string;
  prompt: string;
  marks?: number;
  answer?: string;
}

export interface WorksheetDiagram {
  kind?: "geometry_2d" | "coordinate_graph" | "number_line" | string;
  description?: string;
  caption?: string;
  spec?: unknown;
  error?: string;
}

export interface Question {
  number: number;
  type: QuestionType;
  prompt: string;
  options?: string[];
  answer?: string;
  parts?: QuestionPart[];
  diagram?: WorksheetDiagram | null;
  marks?: number;
  difficulty?: "easy" | "medium" | "hard";
  blooms_level?: "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";
  rubric?: string;
  working?: string;
}

export interface WorksheetMetadata {
  topic_tags: string[];
  estimated_minutes: number;
}

export interface Worksheet {
  worksheet_title: string;
  instructions: string;
  metadata?: WorksheetMetadata;
  questions: Question[];
}

export type RefineChatRole = "user" | "assistant";

export interface RefineChatMessage {
  id: string;
  role: RefineChatRole;
  content: string;
}
