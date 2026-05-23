import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import { CheckCircle2, DollarSign } from "lucide-react";
import type { TabContext } from "./types";

export default function SalaryTab({ ctx }: { ctx: TabContext }) {
  const { salaries, handleSalaryResponse } = ctx;
  return (
    <Card className="dashboard-list-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          My Salary
        </CardTitle>
        <CardDescription>View and respond to salary details from admin</CardDescription>
      </CardHeader>
      <CardContent>
        {salaries.length === 0 ? (
          <EmptyState icon={DollarSign} title="No salary records" description="When admin sends salary details, they'll appear here." />
        ) : (
          <div className="space-y-4">
            {salaries.map((salary) => (
              <div key={salary.id} className="p-4 rounded-xl border border-border hover:border-teacher/30 transition-all">
                <div className="flex flex-wrap justify-between items-start gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      {new Date(salary.created_at || "").toLocaleDateString()}
                    </p>
                    <p className="text-lg font-semibold">
                      {salary.total_hours}h × ${salary.salary_per_hour}/h = ${salary.amount?.toFixed(2)}
                    </p>
                    {salary.num_classes && <p className="text-sm text-muted-foreground">{salary.num_classes} classes</p>}
                    {salary.note && <p className="text-sm text-muted-foreground">Note: {salary.note}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge className={
                      salary.status === "confirmed" ? "bg-success/10 text-success" :
                      salary.status === "needs_correction" ? "bg-destructive/10 text-destructive" :
                      "bg-warning/10 text-warning"
                    }>
                      {salary.status === "sent_to_teacher" ? "Pending Review" : salary.status}
                    </Badge>
                    {salary.status === "sent_to_teacher" && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="dashboard-btn dashboard-btn-teacher"
                          onClick={() => handleSalaryResponse(salary.id, "confirmed")}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />Yes, All Correct
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSalaryResponse(salary.id, "needs_correction")}
                        >
                          Need Corrections
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
