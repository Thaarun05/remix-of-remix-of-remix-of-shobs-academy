import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageSquare, Send, Sparkles } from "lucide-react";
import type { RefineChatMessage } from "@/lib/worksheet/types";

const QUICK_CHIPS = [
  { label: "Harden", message: "Make the worksheet harder overall — raise difficulty and deepen reasoning without changing the topic." },
  { label: "Simplify", message: "Simplify the language and difficulty for struggling students while keeping the same topic coverage." },
  { label: "Add 3 MCQs", message: "Add 3 new multiple-choice questions at the end, then renumber everything." },
  { label: "More workings", message: "Add clear step-by-step workings for every question that needs them (especially numerical and short answer)." },
  { label: "Shorter instructions", message: "Rewrite the worksheet instructions to be shorter and clearer for students." },
];

interface WorksheetRefineChatProps {
  messages: RefineChatMessage[];
  refining: boolean;
  disabled?: boolean;
  onSend: (message: string) => void;
}

export function WorksheetRefineChat({ messages, refining, disabled, onSend }: WorksheetRefineChatProps) {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, refining]);

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || refining || disabled) return;
    onSend(trimmed);
    setDraft("");
  };

  return (
    <Card className="form-panel">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquare className="h-5 w-5 text-teacher" />
          Refine with AI
        </CardTitle>
        <CardDescription>
          ChatGPT-style edits — ask to harden questions, add MCQs, rewrite the title, and more. Your current worksheet is the source of truth.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {QUICK_CHIPS.map((chip) => (
            <Badge
              key={chip.label}
              variant="secondary"
              className={`cursor-pointer hover:bg-teacher/15 ${refining || disabled ? "opacity-50 pointer-events-none" : ""}`}
              onClick={() => submit(chip.message)}
            >
              <Sparkles className="h-3 w-3 mr-1" />
              {chip.label}
            </Badge>
          ))}
        </div>

        <div className="rounded-lg border bg-muted/30 max-h-64 overflow-y-auto p-3 space-y-3">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Example: “Make questions 4–6 harder” or “Add two diagram questions on triangles”.
            </p>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`text-sm rounded-lg px-3 py-2 max-w-[95%] ${
                m.role === "user"
                  ? "ml-auto bg-teacher/15 text-foreground"
                  : "mr-auto bg-background border"
              }`}
            >
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                {m.role === "user" ? "You" : "Assistant"}
              </div>
              <p className="whitespace-pre-wrap">{m.content}</p>
            </div>
          ))}
          {refining && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Refining worksheet…
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="flex gap-2 items-end">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            placeholder="Tell the AI how to refine this worksheet…"
            disabled={refining || disabled}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(draft);
              }
            }}
          />
          <Button
            variant="teacher"
            size="icon"
            className="shrink-0 h-10 w-10"
            disabled={refining || disabled || !draft.trim()}
            onClick={() => submit(draft)}
            title="Send"
          >
            {refining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
