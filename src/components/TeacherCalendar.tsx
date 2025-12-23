import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  Calendar as CalendarIcon,
  Plus,
  Clock,
  BookOpen,
  FileText,
  Loader2,
  User,
  Link as LinkIcon,
} from "lucide-react";

interface Student {
  user_id: string;
  student_name: string;
}

interface Assignment {
  id: string;
  title: string;
  student_user_id: string;
}

interface Event {
  id: string;
  title: string;
  description: string | null;
  event_type: "class" | "assignment";
  start_time: string;
  end_time: string | null;
  student_user_id: string;
  teacher_user_id: string | null;
  assignment_id: string | null;
  created_at: string;
  student_name?: string;
  assignment_title?: string;
}

interface TeacherCalendarProps {
  students: Student[];
}

export const TeacherCalendar = ({ students }: TeacherCalendarProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<Event[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    studentId: "",
    eventType: "class" as "class" | "assignment",
    title: "",
    description: "",
    startDate: undefined as Date | undefined,
    startTime: "09:00",
    endTime: "10:00",
    assignmentId: "",
  });

  useEffect(() => {
    if (user) {
      fetchEvents();
      fetchAssignments();
    }
  }, [user]);

  const fetchEvents = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .or(`teacher_user_id.eq.${user.id},created_by.eq.${user.id}`)
        .order("start_time", { ascending: true });

      if (error) throw error;

      // Map student names
      const studentsMap = new Map(students.map((s) => [s.user_id, s.student_name]));
      const eventsWithNames = (data || []).map((e) => ({
        ...e,
        event_type: e.event_type as "class" | "assignment",
        student_name: studentsMap.get(e.student_user_id) || "Unknown Student",
      }));

      setEvents(eventsWithNames);
    } catch (error) {
      console.error("Error fetching events:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignments = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from("assignments")
        .select("id, title, student_user_id")
        .eq("teacher_user_id", user.id);
      setAssignments(data || []);
    } catch (error) {
      console.error("Error fetching assignments:", error);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.studentId || !form.startDate) return;

    setSubmitting(true);
    try {
      const startDateTime = new Date(form.startDate);
      const [startHour, startMinute] = form.startTime.split(":").map(Number);
      startDateTime.setHours(startHour, startMinute, 0, 0);

      let endDateTime: Date | null = null;
      if (form.endTime) {
        endDateTime = new Date(form.startDate);
        const [endHour, endMinute] = form.endTime.split(":").map(Number);
        endDateTime.setHours(endHour, endMinute, 0, 0);
      }

      const { error } = await supabase.from("events").insert({
        title: form.title,
        description: form.description || null,
        event_type: form.eventType,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime?.toISOString() || null,
        student_user_id: form.studentId,
        teacher_user_id: user.id,
        assignment_id: form.assignmentId || null,
        created_by: user.id,
      });

      if (error) throw error;

      toast({ title: "Event created", description: "The event has been added to the calendar." });

      setForm({
        studentId: "",
        eventType: "class",
        title: "",
        description: "",
        startDate: undefined,
        startTime: "09:00",
        endTime: "10:00",
        assignmentId: "",
      });
      setShowForm(false);
      fetchEvents();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create event";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      const { error } = await supabase.from("events").delete().eq("id", eventId);
      if (error) throw error;
      toast({ title: "Event deleted" });
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete event";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    }
  };

  const now = new Date();
  const todayEvents = events.filter((e) => {
    const eventDate = new Date(e.start_time);
    return eventDate.toDateString() === now.toDateString();
  });
  const upcomingEvents = events.filter((e) => {
    const eventDate = new Date(e.start_time);
    return eventDate > now && eventDate.toDateString() !== now.toDateString();
  });
  const pastEvents = events.filter((e) => new Date(e.start_time) < now && new Date(e.start_time).toDateString() !== now.toDateString());

  const filteredAssignments = assignments.filter((a) => a.student_user_id === form.studentId);

  const renderEventCard = (event: Event) => (
    <div
      key={event.id}
      className="p-3 rounded-lg border border-border hover:border-teacher/30 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-medium text-foreground truncate">{event.title}</h4>
            <Badge
              variant={event.event_type === "class" ? "default" : "secondary"}
              className={event.event_type === "class" ? "bg-teacher text-teacher-foreground" : ""}
            >
              {event.event_type === "class" ? <BookOpen className="h-3 w-3 mr-1" /> : <FileText className="h-3 w-3 mr-1" />}
              {event.event_type === "class" ? "Class" : "Assignment"}
            </Badge>
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
            <User className="h-3 w-3" />
            <span>{event.student_name}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            <Clock className="h-3 w-3" />
            <span>
              {format(new Date(event.start_time), "PPp")}
              {event.end_time && ` - ${format(new Date(event.end_time), "p")}`}
            </span>
          </div>
          {event.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{event.description}</p>
          )}
          {event.assignment_id && (
            <div className="flex items-center gap-1 text-xs text-teacher mt-1">
              <LinkIcon className="h-3 w-3" />
              <span>Linked to assignment</span>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={() => handleDeleteEvent(event.id)}
        >
          Delete
        </Button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-teacher" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Create Event Form */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Calendar
              </CardTitle>
              <CardDescription>Manage class sessions and assignment events</CardDescription>
            </div>
            <Button variant="teacher" onClick={() => setShowForm(!showForm)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Event
            </Button>
          </div>
        </CardHeader>
        {showForm && (
          <CardContent className="border-t pt-4">
            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Student *</Label>
                  <Select value={form.studentId} onValueChange={(v) => setForm({ ...form, studentId: v, assignmentId: "" })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select student" />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map((s) => (
                        <SelectItem key={s.user_id} value={s.user_id}>
                          {s.student_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Event Type *</Label>
                  <Select value={form.eventType} onValueChange={(v) => setForm({ ...form, eventType: v as "class" | "assignment" })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="class">Class Session</SelectItem>
                      <SelectItem value="assignment">Assignment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Title *</Label>
                <Input
                  placeholder="Event title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn("w-full justify-start text-left font-normal", !form.startDate && "text-muted-foreground")}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {form.startDate ? format(form.startDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={form.startDate}
                        onSelect={(d) => setForm({ ...form, startDate: d })}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
                </div>
              </div>

              {form.eventType === "assignment" && form.studentId && (
                <div className="space-y-2">
                  <Label>Link to Assignment (optional)</Label>
                  <Select value={form.assignmentId} onValueChange={(v) => setForm({ ...form, assignmentId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an assignment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {filteredAssignments.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  placeholder="Event details..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" variant="teacher" disabled={!form.studentId || !form.startDate || !form.title || submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Event"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        )}
      </Card>

      {/* Events List */}
      <div className="grid gap-6">
        {/* Today */}
        {todayEvents.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Badge variant="default" className="bg-teacher">Today</Badge>
                <span className="text-muted-foreground font-normal text-sm">
                  {format(now, "EEEE, MMMM d")}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {todayEvents.map(renderEventCard)}
            </CardContent>
          </Card>
        )}

        {/* Upcoming */}
        {upcomingEvents.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Upcoming</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {upcomingEvents.slice(0, 10).map(renderEventCard)}
            </CardContent>
          </Card>
        )}

        {/* Past */}
        {pastEvents.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-muted-foreground">Past Events</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {pastEvents.slice(0, 5).map(renderEventCard)}
            </CardContent>
          </Card>
        )}

        {events.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No events yet. Create your first event above.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
