import { useEffect, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";

export interface TeacherOption {
  user_id: string;
  full_name: string | null;
}

interface Props {
  teachers: TeacherOption[];
  value: string[]; // ordered teacher ids
  onChange: (ids: string[]) => void;
  idPrefix?: string;
}

/**
 * Allocate one or many teachers to a student.
 * - Mode "one": single dropdown.
 * - Mode "many": user enters a count, then fills N empty slots by clicking teacher names.
 */
export function MultiTeacherAssign({ teachers, value, onChange, idPrefix = "ta" }: Props) {
  const [mode, setMode] = useState<"one" | "many">(value.length > 1 ? "many" : "one");
  const [count, setCount] = useState<number>(value.length > 1 ? value.length : 2);

  // Internal slot positions (length = count). Empty slot = "".
  // Preserves slot index when a teacher is removed so a new selection refills it.
  const [slots, setSlots] = useState<string[]>(() =>
    Array.from({ length: Math.max(count, value.length) }, (_, i) => value[i] || "")
  );

  const lastEmittedRef = useRef<string>("");
  const emit = (next: string[]) => {
    const compact = next.filter(Boolean);
    const key = compact.join(",");
    if (key !== lastEmittedRef.current) {
      lastEmittedRef.current = key;
      onChange(compact);
    }
  };

  // Sync slots when external value changes (e.g. loading existing assignments)
  useEffect(() => {
    const compactSlots = slots.filter(Boolean).join(",");
    const compactValue = value.join(",");
    if (compactSlots !== compactValue) {
      setSlots((prev) => {
        const len = Math.max(count, value.length, prev.length);
        return Array.from({ length: len }, (_, i) => value[i] || "");
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleModeChange = (m: "one" | "many") => {
    setMode(m);
    if (m === "one") {
      const first = slots.find(Boolean) || value[0] || "";
      setSlots([first]);
      emit(first ? [first] : []);
    } else {
      setSlots((prev) => Array.from({ length: count }, (_, i) => prev[i] || value[i] || ""));
    }
  };

  const handleCountChange = (n: number) => {
    const safe = Math.max(1, Math.min(20, isNaN(n) ? 1 : n));
    setCount(safe);
    setSlots((prev) => {
      const next = Array.from({ length: safe }, (_, i) => prev[i] || "");
      emit(next);
      return next;
    });
  };

  const fillNextSlot = (teacherId: string) => {
    if (slots.includes(teacherId)) return; // no duplicates
    const emptyIdx = slots.findIndex((s) => !s);
    if (emptyIdx === -1) return;
    const next = [...slots];
    next[emptyIdx] = teacherId;
    setSlots(next);
    emit(next);
  };

  const removeSlot = (idx: number) => {
    const next = [...slots];
    next[idx] = ""; // clear in place; refilled on next selection
    setSlots(next);
    emit(next);
  };

  const filledCount = slots.filter(Boolean).length;
  const allFilled = mode === "many" && filledCount === count && count > 0;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>One or Many Teachers? *</Label>
        <Select value={mode} onValueChange={(v: "one" | "many") => handleModeChange(v)}>
          <SelectTrigger id={`${idPrefix}-mode`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="one">One Teacher</SelectItem>
            <SelectItem value="many">Many Teachers</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {mode === "one" ? (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-single`}>Assign Teacher *</Label>
          <Select
            value={value[0] || ""}
            onValueChange={(v) => onChange(v ? [v] : [])}
          >
            <SelectTrigger id={`${idPrefix}-single`}>
              <SelectValue placeholder="Select a teacher" />
            </SelectTrigger>
            <SelectContent>
              {teachers.map((t) => (
                <SelectItem key={t.user_id} value={t.user_id}>
                  {t.full_name || "Unnamed Teacher"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-count`}>How many teachers? *</Label>
            <Input
              id={`${idPrefix}-count`}
              type="number"
              min={1}
              max={20}
              value={count}
              onChange={(e) => handleCountChange(parseInt(e.target.value, 10))}
            />
          </div>

          <div className="space-y-2">
            <Label>Selected Teachers</Label>
            <div className="grid grid-cols-1 gap-2">
              {slots.map((id, idx) => {
                const teacher = teachers.find((t) => t.user_id === id);
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 min-h-10"
                  >
                    <span className="text-sm">
                      <span className="text-muted-foreground mr-2">#{idx + 1}</span>
                      {teacher ? (
                        teacher.full_name || "Unnamed Teacher"
                      ) : (
                        <span className="text-muted-foreground italic">Empty — click a teacher below</span>
                      )}
                    </span>
                    {teacher && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSlot(idx)}
                        className="h-7 px-2"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Available Teachers</Label>
            <div className="flex flex-wrap gap-2">
              {teachers.length === 0 && (
                <p className="text-sm text-muted-foreground">No teachers available.</p>
              )}
              {teachers.map((t) => {
                const used = slots.includes(t.user_id);
                const disabled = used || filledCount >= count;
                return (
                  <Button
                    key={t.user_id}
                    type="button"
                    variant={used ? "secondary" : "outline"}
                    size="sm"
                    disabled={disabled && !used}
                    onClick={() => fillNextSlot(t.user_id)}
                  >
                    {t.full_name || "Unnamed Teacher"}
                    {used && <Check className="h-3 w-3 ml-1" />}
                  </Button>
                );
              })}
            </div>
          </div>

          {allFilled && (
            <Badge className="bg-green-100 text-green-700 border-green-200">
              <Check className="h-3 w-3 mr-1" /> Done — {count} teacher{count > 1 ? "s" : ""} assigned
            </Badge>
          )}
        </>
      )}
    </div>
  );
}