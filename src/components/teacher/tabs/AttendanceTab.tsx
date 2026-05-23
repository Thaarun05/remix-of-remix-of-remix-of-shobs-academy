import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import { Calendar, Loader2, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import type { TabContext } from "./types";

export default function AttendanceTab({ ctx }: { ctx: TabContext }) {
  const {
    students, attendanceRecords, attendanceForm, setAttendanceForm,
    handleAddAttendance, submitting, selectedStudent,
    filterMonth, setFilterMonth, filterStudent, setFilterStudent,
    filteredAttendance, setFilteredAttendance, filterLoading,
    openEditAttendance, openDeleteDialog, MONTHS,
  } = ctx;

  return (
    <div className="space-y-6">
      <Card className="dashboard-list-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            View Attendance Records
          </CardTitle>
          <CardDescription>Select a month and student to view their attendance history</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2 min-w-[200px] flex-1">
              <Label>Select Month *</Label>
              <Select value={filterMonth} onValueChange={setFilterMonth}>
                <SelectTrigger><SelectValue placeholder="Select Month" /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => (<SelectItem key={m} value={m}>{m}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 min-w-[200px] flex-1">
              <Label>Select Student *</Label>
              <Select value={filterStudent} onValueChange={setFilterStudent}>
                <SelectTrigger><SelectValue placeholder="Select Student" /></SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.user_id} value={s.user_id}>
                      {s.student_name} {s.grade && `(${s.grade})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              onClick={() => { setFilterMonth(""); setFilterStudent(""); setFilteredAttendance([]); }}
              disabled={!filterMonth && !filterStudent}
            >
              <X className="h-4 w-4 mr-1" /> Clear Filters
            </Button>
          </div>

          {(!filterMonth || !filterStudent) && (filterMonth || filterStudent) && (
            <p className="text-sm text-destructive">Please select both a month and a student to view records.</p>
          )}

          {filterLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-teacher" />
            </div>
          )}

          {filterMonth && filterStudent && !filterLoading && (
            filteredAttendance.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title="No attendance records found"
                description={`No records for ${students.find(s => s.user_id === filterStudent)?.student_name || "this student"} in ${filterMonth}.`}
              />
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Hours</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Notes</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAttendance.map((record) => (
                      <tr key={record.id} className="border-t border-border hover:bg-muted/30">
                        <td className="px-4 py-3">{new Date(record.date).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <Badge className={record.status === "present" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}>
                            {record.status === "present" ? "Present" : "Absent"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">{record.hours ? `${record.hours}h` : "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{record.topic || "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditAttendance(record)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => openDeleteDialog("attendance_records", record.id, `${students.find(s => s.user_id === record.student_user_id)?.student_name || "student"}'s attendance`)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="dashboard-list-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Record Attendance
            </CardTitle>
            <CardDescription>Mark attendance for the selected student</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddAttendance} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={attendanceForm.date}
                    onChange={(e) => setAttendanceForm({ ...attendanceForm, date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={attendanceForm.status}
                    onValueChange={(v) => setAttendanceForm({ ...attendanceForm, status: v as "present" | "absent" })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="present">Present</SelectItem>
                      <SelectItem value="absent">Absent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="hours">Hours (optional)</Label>
                <Input
                  id="hours"
                  type="number"
                  step="0.5"
                  placeholder="e.g., 2"
                  value={attendanceForm.hours}
                  onChange={(e) => setAttendanceForm({ ...attendanceForm, hours: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="topic">Topic (optional)</Label>
                <Input
                  id="topic"
                  placeholder="What was covered in class?"
                  value={attendanceForm.topic}
                  onChange={(e) => setAttendanceForm({ ...attendanceForm, topic: e.target.value })}
                />
              </div>
              <Button type="submit" className="w-full dashboard-btn dashboard-btn-teacher" disabled={!selectedStudent || submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Record Attendance"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="dashboard-list-card h-fit">
          <CardHeader>
            <CardTitle className="text-base">Recent Attendance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
            {attendanceRecords.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No records yet</p>
            ) : (
              attendanceRecords.map((record) => (
                <div key={record.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{record.student_name}</p>
                    <p className="text-xs text-muted-foreground">{new Date(record.date).toLocaleDateString()} • {record.status}</p>
                    {record.topic && <p className="text-xs text-muted-foreground truncate">{record.topic}</p>}
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <Badge className={record.status === "present" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}>
                      {record.hours ? `${record.hours}h` : record.status}
                    </Badge>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditAttendance(record)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => openDeleteDialog("attendance_records", record.id, `${record.student_name}'s attendance`)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
