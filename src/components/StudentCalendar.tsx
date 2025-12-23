import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import {
  Calendar as CalendarIcon,
  Clock,
  BookOpen,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface Event {
  id: string;
  title: string;
  description: string | null;
  event_type: "class" | "assignment";
  start_time: string;
  end_time: string | null;
  assignment_id: string | null;
}

interface Assignment {
  id: string;
  title: string;
  due_date: string | null;
  status: string;
}

interface StudentCalendarProps {
  onNavigateToAssignment?: () => void;
}

export const StudentCalendar = ({ onNavigateToAssignment }: StudentCalendarProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<Event[]>([]);
  const [assignments, setAssignments] = useState<Map<string, Assignment>>(new Map());

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Fetch events
      const { data: eventsData } = await supabase
        .from("events")
        .select("*")
        .eq("student_user_id", user.id)
        .order("start_time", { ascending: true });

      // Fetch assignments for linked events
      const { data: assignmentsData } = await supabase
        .from("assignments")
        .select("id, title, due_date, status")
        .eq("student_user_id", user.id);

      setEvents(
        (eventsData || []).map((e) => ({
          ...e,
          event_type: e.event_type as "class" | "assignment",
        }))
      );

      const assignmentsMap = new Map<string, Assignment>();
      (assignmentsData || []).forEach((a) => {
        assignmentsMap.set(a.id, a);
      });
      setAssignments(assignmentsMap);
    } catch (error) {
      console.error("Error fetching calendar data:", error);
    } finally {
      setLoading(false);
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

  const isOverdue = (date: string | null) => {
    if (!date) return false;
    return new Date(date) < now;
  };

  const renderEventCard = (event: Event) => {
    const linkedAssignment = event.assignment_id ? assignments.get(event.assignment_id) : null;

    return (
      <div
        key={event.id}
        className="p-4 rounded-lg border border-border hover:border-student/30 transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-medium text-foreground">{event.title}</h4>
              <Badge
                variant={event.event_type === "class" ? "default" : "secondary"}
                className={event.event_type === "class" ? "bg-student text-student-foreground" : ""}
              >
                {event.event_type === "class" ? (
                  <BookOpen className="h-3 w-3 mr-1" />
                ) : (
                  <FileText className="h-3 w-3 mr-1" />
                )}
                {event.event_type === "class" ? "Class" : "Assignment"}
              </Badge>
            </div>

            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-2">
              <Clock className="h-3 w-3" />
              <span>
                {format(new Date(event.start_time), "EEEE, MMMM d 'at' h:mm a")}
                {event.end_time && ` - ${format(new Date(event.end_time), "h:mm a")}`}
              </span>
            </div>

            {event.description && (
              <p className="text-sm text-muted-foreground mt-2">{event.description}</p>
            )}

            {/* Linked Assignment Info */}
            {linkedAssignment && (
              <div className="mt-3 p-2 rounded-md bg-muted/50">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{linkedAssignment.title}</p>
                    {linkedAssignment.due_date && (
                      <p
                        className={`text-xs flex items-center gap-1 ${
                          isOverdue(linkedAssignment.due_date) && linkedAssignment.status !== "submitted"
                            ? "text-destructive"
                            : "text-muted-foreground"
                        }`}
                      >
                        <AlertCircle className="h-3 w-3" />
                        Due: {format(new Date(linkedAssignment.due_date), "PPP")}
                        {isOverdue(linkedAssignment.due_date) && linkedAssignment.status !== "submitted" && " (Overdue)"}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {linkedAssignment.status === "submitted" ? (
                      <Badge className="bg-teacher/10 text-teacher">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Submitted
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-secondary border-secondary">
                        Pending
                      </Badge>
                    )}
                    {onNavigateToAssignment && (
                      <Button size="sm" variant="outline" onClick={onNavigateToAssignment}>
                        View
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-student" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-student" />
            My Schedule
          </CardTitle>
          <CardDescription>Your upcoming classes and assignment deadlines</CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="text-center py-8">
              <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No scheduled events yet.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Today */}
              {todayEvents.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="default" className="bg-student">Today</Badge>
                    <span className="text-sm text-muted-foreground">
                      {format(now, "EEEE, MMMM d")}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {todayEvents.map(renderEventCard)}
                  </div>
                </div>
              )}

              {/* Upcoming */}
              {upcomingEvents.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Upcoming</h3>
                  <div className="space-y-3">
                    {upcomingEvents.slice(0, 10).map(renderEventCard)}
                  </div>
                </div>
              )}

              {todayEvents.length === 0 && upcomingEvents.length === 0 && (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">No upcoming events.</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
