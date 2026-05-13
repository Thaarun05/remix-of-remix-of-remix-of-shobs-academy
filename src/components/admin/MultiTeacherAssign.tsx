import { useMemo, useState } from "react";
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

  // Slots array of length = count, filled with selected ids in order
  const slots = useMemo(() => {
    const arr = Array.from({ length: count }, (_, i) => value[i] || "");
    return arr;
  }, [count, value]);

  const handleModeChange = (m: "one" | "many") => {
    setMode(m);
    if (m === "one") {
      onChange(value[0] ? [value[0]] : []);
    } else {
      // keep existing or grow to count
      const next = Array.from({ length: count }, (_, i) => value[i] || "").filter(Boolean);
      onChange(next);
    }
  };

  const handleCountChange = (n: number) => {
    const safe = Math.max(1, Math.min(20, isNaN(n) ? 1 : n));
    setCount(safe);
    onChange(value.slice(0, safe));
  };

  const fillNextSlot = (teacherId: string) => {
    if (value.includes(teacherId)) return; // no duplicates
    if (value.length >= count) return;
    onChange([...value, teacherId]);
  };

  const removeSlot = (idx: number) => {
    const next = [...value];
    next.splice(idx, 1);
    onChange(next);
  };

  const allFilled = mode === "many" && value.length === count && count > 0;

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
                const used = value.includes(t.user_id);
                const disabled = used || value.length >= count;
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