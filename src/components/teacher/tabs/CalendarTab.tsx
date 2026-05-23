import { TeacherCalendar } from "@/components/TeacherCalendar";
import type { TabContext } from "./types";

export default function CalendarTab({ ctx }: { ctx: TabContext }) {
  return (
    <TeacherCalendar
      students={ctx.students.map((s) => ({ user_id: s.user_id, student_name: s.student_name }))}
    />
  );
}
