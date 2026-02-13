import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { EmptyState } from "@/components/EmptyState";
import { Calendar, CheckCircle2, XCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";

interface AttendanceRecord {
  id: string;
  date: string;
  status: string;
  hours: number | null;
  topic: string | null;
}

interface MonthGroup {
  key: string;
  label: string;
  monthIndex: number;
  year: number;
  records: AttendanceRecord[];
  present: number;
  absent: number;
  totalHours: number;
  percentage: number;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface Props {
  attendance: AttendanceRecord[];
}

export const StudentAttendanceHistory = ({ attendance }: Props) => {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(now.getMonth());

  // Get available years from data
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(now.getFullYear());
    attendance.forEach(r => years.add(new Date(r.date).getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
  }, [attendance]);

  // Group records by month for the selected year
  const monthGroups: MonthGroup[] = useMemo(() => {
    return MONTHS.map((label, monthIndex) => {
      const records = attendance.filter(r => {
        const d = new Date(r.date);
        return d.getFullYear() === selectedYear && d.getMonth() === monthIndex;
      }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const present = records.filter(r => r.status.toLowerCase() === "present").length;
      const absent = records.filter(r => r.status.toLowerCase() === "absent").length;
      const total = present + absent;
      const totalHours = records
        .filter(r => r.status.toLowerCase() === "present")
        .reduce((s, r) => s + (Number(r.hours) || 0), 0);

      return {
        key: `${selectedYear}-${monthIndex}`,
        label,
        monthIndex,
        year: selectedYear,
        records,
        present,
        absent,
        totalHours,
        percentage: total > 0 ? Math.round((present / total) * 100) : 0,
      };
    });
  }, [attendance, selectedYear]);

  const currentMonthKey = `${now.getFullYear()}-${now.getMonth()}`;

  const navigateMonth = (dir: -1 | 1) => {
    let m = selectedMonthIndex + dir;
    let y = selectedYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setSelectedMonthIndex(m);
    setSelectedYear(y);
  };

  const getPercentBadgeClass = (pct: number) => {
    if (pct >= 80) return "bg-success/10 text-success border-success/20";
    if (pct >= 50) return "bg-warning/10 text-warning border-warning/20";
    return "bg-destructive/10 text-destructive border-destructive/20";
  };

  if (attendance.length === 0) {
    return (
      <Card className="dashboard-list-card">
        <CardHeader>
          <CardTitle>Attendance History</CardTitle>
          <CardDescription>Your complete attendance record</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={Calendar}
            title="No attendance records yet"
            description="Once your teacher marks your attendance, your records will appear here."
          />
        </CardContent>
      </Card>
    );
  }

  // Default open the current or selected month
  const defaultOpen = `${selectedYear}-${selectedMonthIndex}`;

  return (
    <Card className="dashboard-list-card">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle>Attendance History</CardTitle>
            <CardDescription>Your complete attendance record</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateMonth(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Select value={String(selectedMonthIndex)} onValueChange={v => setSelectedMonthIndex(Number(v))}>
              <SelectTrigger className="w-[130px] h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
              <SelectTrigger className="w-[90px] h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateMonth(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible defaultValue={defaultOpen} key={`${selectedYear}`}>
          {monthGroups.map(group => {
            const isCurrent = group.key === currentMonthKey;
            return (
              <AccordionItem key={group.key} value={group.key} className={isCurrent ? "border-primary/30" : ""}>
                <AccordionTrigger className="hover:no-underline px-2">
                  <div className="flex items-center gap-3 flex-1 text-left">
                    <span className="text-sm font-semibold">
                      📅 {group.label} {group.year}
                    </span>
                    {isCurrent && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/40 text-primary">
                        Current
                      </Badge>
                    )}
                    {group.records.length > 0 ? (
                      <div className="flex items-center gap-2 ml-auto mr-2">
                        <Badge variant="outline" className={`text-xs ${getPercentBadgeClass(group.percentage)}`}>
                          {group.percentage}%
                        </Badge>
                        <span className="text-xs text-muted-foreground hidden sm:inline">
                          {group.present}/{group.records.length} days • {group.totalHours} hrs
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground ml-auto mr-2">No classes</span>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  {group.records.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No classes this month.</p>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Date</th>
                              <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Status</th>
                              <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Hours</th>
                              <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Topic</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.records.map(r => (
                              <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                <td className="px-4 py-2.5 text-xs">{format(new Date(r.date), "dd-MMM-yyyy")}</td>
                                <td className="px-4 py-2.5">
                                  {r.status.toLowerCase() === "present" ? (
                                    <Badge className="bg-success/10 text-success hover:bg-success/20 border-success/20 text-xs">
                                      <CheckCircle2 className="h-3 w-3 mr-1" />Present
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20 text-xs">
                                      <XCircle className="h-3 w-3 mr-1" />Absent
                                    </Badge>
                                  )}
                                </td>
                                <td className="px-4 py-2.5 text-xs">{r.hours ?? "-"}</td>
                                <td className="px-4 py-2.5 text-xs text-muted-foreground">{r.topic || "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="px-4 py-2 bg-muted/30 text-xs text-muted-foreground flex flex-wrap gap-4 justify-between">
                        <span>Present: {group.present} days</span>
                        <span>Absent: {group.absent} days</span>
                        <span>Total Hours: {group.totalHours} hrs</span>
                        <span>Attendance: {group.percentage}%</span>
                      </div>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
    </Card>
  );
};
