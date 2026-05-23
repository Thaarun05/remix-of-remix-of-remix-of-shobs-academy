import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calculator, Loader2, Send, Trash2 } from "lucide-react";
import type { TabContext } from "./types";

export default function FeesTab({ ctx }: { ctx: TabContext }) {
  const {
    feeForm, setFeeForm, handleSendFeeToAdmin, submitting, selectedStudent,
    recentFees, handleSoftDelete,
  } = ctx;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="dashboard-list-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Student Fee Calculator
          </CardTitle>
          <CardDescription>Calculate and send fee details to admin</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSendFeeToAdmin} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Month *</Label>
                <Input type="month" value={feeForm.month} onChange={(e) => setFeeForm({ ...feeForm, month: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Total Hours *</Label>
                <Input type="number" step="0.5" placeholder="e.g., 20" value={feeForm.totalHours} onChange={(e) => setFeeForm({ ...feeForm, totalHours: e.target.value })} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Fee Per Hour *</Label>
              <Input type="number" step="0.01" placeholder="e.g., 30.00" value={feeForm.feePerHour} onChange={(e) => setFeeForm({ ...feeForm, feePerHour: e.target.value })} required />
            </div>
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-sm text-muted-foreground">Total Amount</p>
              <p className="text-2xl font-bold text-teacher">${((parseFloat(feeForm.totalHours) || 0) * (parseFloat(feeForm.feePerHour) || 0)).toFixed(2)}</p>
            </div>
            <div className="space-y-2">
              <Label>Class Dates</Label>
              <Textarea placeholder="e.g., Jan 5, 7, 12, 14..." value={feeForm.classDates} onChange={(e) => setFeeForm({ ...feeForm, classDates: e.target.value })} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Subjects Covered</Label>
              <Textarea placeholder="e.g., Algebra, Geometry..." value={feeForm.subjects} onChange={(e) => setFeeForm({ ...feeForm, subjects: e.target.value })} rows={2} />
            </div>
            <Button type="submit" className="w-full dashboard-btn dashboard-btn-teacher" disabled={!selectedStudent || submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-2" />Send to Admin</>}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="dashboard-list-card h-fit">
        <CardHeader><CardTitle className="text-base">Recent Fees Sent</CardTitle></CardHeader>
        <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
          {recentFees.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No fees sent yet</p>
          ) : (
            recentFees.map((fee) => (
              <div key={fee.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{fee.student_name}</p>
                  <p className="text-xs text-muted-foreground">{fee.month} • ${fee.total_amount?.toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={fee.status === "sent_to_student" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}>{fee.status === "sent_to_student" ? "Sent" : "Pending"}</Badge>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleSoftDelete("student_fees", fee.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
