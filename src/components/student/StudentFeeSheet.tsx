import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/EmptyState";
import { FileSpreadsheet, Calculator, CheckCircle2, AlertTriangle, Loader2, DollarSign } from "lucide-react";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface FeeRow {
  id: string;
  class_date: string;
  hours: number;
  topic: string;
  row_order: number;
}

interface Invoice {
  id: string;
  student_name: string;
  fee_per_hour: number;
  status: string;
  admin_notes: string | null;
  student_notes: string | null;
  sent_at: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export const StudentFeeSheet = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [invoiceRows, setInvoiceRows] = useState<FeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);
  const [studentNotes, setStudentNotes] = useState("");
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingResponse, setPendingResponse] = useState<"correct" | "correction_needed" | null>(null);

  useEffect(() => {
    if (user) {
      fetchInvoices();
    }
  }, [user]);

  const fetchInvoices = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("student_fee_invoices")
      .select("*")
      .eq("student_user_id", user!.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    
    setInvoices((data as Invoice[]) || []);
    
    // Auto-select the most recent sent invoice
    const sentInvoice = (data as Invoice[] || []).find(i => i.status === "sent");
    if (sentInvoice) {
      loadInvoiceDetails(sentInvoice);
    }
    
    setLoading(false);
  };

  const loadInvoiceDetails = async (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setStudentNotes(invoice.student_notes || "");
    
    const { data: rows } = await supabase
      .from("student_fee_invoice_rows")
      .select("*")
      .eq("invoice_id", invoice.id)
      .order("row_order");
    
    setInvoiceRows((rows || []).map(r => ({
      id: r.id,
      class_date: r.class_date,
      hours: Number(r.hours),
      topic: r.topic,
      row_order: r.row_order
    })));
  };

  const handleResponse = (response: "correct" | "correction_needed") => {
    if (response === "correct") {
      // Show confirmation dialog
      setPendingResponse(response);
      setConfirmDialogOpen(true);
    } else {
      // For correction, require notes
      if (!studentNotes.trim()) {
        toast({ 
          title: "Please provide details", 
          description: "Explain what needs to be corrected.",
          variant: "destructive" 
        });
        return;
      }
      submitResponse(response);
    }
  };

  const submitResponse = async (response: "correct" | "correction_needed") => {
    if (!selectedInvoice) return;
    setResponding(true);

    try {
      const { error } = await supabase
        .from("student_fee_invoices")
        .update({
          status: response,
          student_notes: studentNotes || null,
          reviewed_at: new Date().toISOString()
        })
        .eq("id", selectedInvoice.id);

      if (error) throw error;

      // Notify admins
      const { data: admins } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("role", "admin");

      if (admins) {
        for (const admin of admins) {
          await supabase.from("notifications").insert({
            recipient_id: admin.user_id,
            sender_id: user!.id,
            type: "fee",
            title: response === "correct" ? "Fee Sheet Confirmed" : "Fee Sheet Needs Correction",
            body: response === "correct"
              ? `${selectedInvoice.student_name} has confirmed their fee sheet.`
              : `${selectedInvoice.student_name} has requested corrections to their fee sheet.`,
            entity_table: "student_fee_invoices",
            entity_id: selectedInvoice.id
          });
        }
      }

      toast({
        title: response === "correct" ? "Thank you!" : "Correction requested",
        description: response === "correct"
          ? "Your fee sheet has been confirmed."
          : "The admin will review and send an updated fee sheet."
      });

      setConfirmDialogOpen(false);
      fetchInvoices();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setResponding(false);
    }
  };

  // Calculations
  const totalHours = invoiceRows.reduce((sum, r) => sum + r.hours, 0);
  const totalClasses = invoiceRows.length;
  const feeRate = selectedInvoice?.fee_per_hour || 0;
  const totalFee = totalHours * feeRate;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent": return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Pending Review</Badge>;
      case "correct": return <Badge className="bg-success/10 text-success border-success/20">Confirmed</Badge>;
      case "correction_needed": return <Badge className="bg-warning/10 text-warning border-warning/20">Correction Requested</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-student" />
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <EmptyState
        icon={DollarSign}
        title="No fee sheets yet"
        description="When the admin sends you a fee sheet, it will appear here for your review."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Invoice List (if multiple) */}
      {invoices.length > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Your Fee Sheets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {invoices.map((invoice) => (
                <Button
                  key={invoice.id}
                  variant={selectedInvoice?.id === invoice.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => loadInvoiceDetails(invoice)}
                >
                  {format(new Date(invoice.created_at), "MMM d, yyyy")}
                  <span className="ml-2">{getStatusBadge(invoice.status)}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Selected Invoice Details */}
      {selectedInvoice && (
        <Card className="dashboard-list-card">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-student" />
                  Fee Sheet
                </CardTitle>
                <CardDescription>
                  Created on {format(new Date(selectedInvoice.created_at), "MMMM d, yyyy")}
                </CardDescription>
              </div>
              {getStatusBadge(selectedInvoice.status)}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Rate Info */}
            <div className="p-3 bg-muted rounded-lg">
              <span className="text-sm text-muted-foreground">Fee Rate:</span>
              <span className="ml-2 font-medium">${feeRate} per hour</span>
            </div>

            {/* Admin Notes */}
            {selectedInvoice.admin_notes && (
              <div className="p-3 bg-primary/5 rounded-lg border-l-2 border-primary">
                <span className="text-sm font-medium">Note from Admin:</span>
                <p className="text-sm mt-1">{selectedInvoice.admin_notes}</p>
              </div>
            )}

            {/* Fee Sheet Table */}
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Date</TableHead>
                    <TableHead className="w-[80px]">Hours</TableHead>
                    <TableHead>Topic</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoiceRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{format(new Date(row.class_date), "MMM d, yyyy")}</TableCell>
                      <TableCell>{row.hours}</TableCell>
                      <TableCell className="text-muted-foreground">{row.topic || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-student/5 font-medium">
                    <TableCell>Total</TableCell>
                    <TableCell>{totalHours} hrs</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-lg">
                        <Calculator className="h-4 w-4" />
                        <span>{totalClasses} classes</span>
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow className="bg-student/10">
                    <TableCell colSpan={3} className="text-right">
                      <div className="flex items-center justify-end gap-2 text-xl font-bold text-student">
                        <DollarSign className="h-5 w-5" />
                        <span>Total Fee: ${totalFee.toFixed(2)}</span>
                      </div>
                      <p className="text-sm text-muted-foreground font-normal mt-1">
                        ({totalHours} hours × ${feeRate}/hr)
                      </p>
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>

            {/* Response Section */}
            {selectedInvoice.status === "sent" && (
              <div className="space-y-4 pt-4 border-t">
                <div>
                  <Label>Notes (if requesting correction)</Label>
                  <Textarea
                    value={studentNotes}
                    onChange={(e) => setStudentNotes(e.target.value)}
                    placeholder="If you need any corrections, please describe what needs to be changed..."
                    rows={3}
                  />
                </div>
                
                <div className="flex gap-3">
                  <Button
                    onClick={() => handleResponse("correct")}
                    disabled={responding}
                    className="flex-1 bg-success hover:bg-success/90"
                  >
                    {responding && pendingResponse === "correct" ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                    )}
                    Correct - Confirm
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleResponse("correction_needed")}
                    disabled={responding}
                    className="flex-1 border-warning text-warning hover:bg-warning/10"
                  >
                    {responding && pendingResponse === "correction_needed" ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 mr-2" />
                    )}
                    Needs Correction
                  </Button>
                </div>
              </div>
            )}

            {/* Already Responded */}
            {selectedInvoice.status !== "sent" && (
              <div className={`p-4 rounded-lg ${selectedInvoice.status === "correct" ? "bg-success/10" : "bg-warning/10"}`}>
                <div className="flex items-center gap-2">
                  {selectedInvoice.status === "correct" ? (
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-warning" />
                  )}
                  <span className="font-medium">
                    {selectedInvoice.status === "correct" 
                      ? "You have confirmed this fee sheet"
                      : "You have requested corrections"}
                  </span>
                </div>
                {selectedInvoice.student_notes && (
                  <p className="text-sm mt-2">Your notes: {selectedInvoice.student_notes}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Fee Sheet</AlertDialogTitle>
            <AlertDialogDescription>
              <p className="mb-4">
                Please confirm that the fee details are correct:
              </p>
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <p><strong>Total Classes:</strong> {totalClasses}</p>
                <p><strong>Total Hours:</strong> {totalHours}</p>
                <p><strong>Rate:</strong> ${feeRate}/hour</p>
                <p className="text-lg font-bold text-primary"><strong>Total Fee:</strong> ${totalFee.toFixed(2)}</p>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                ⚠️ Please have a parent/guardian review before confirming.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => submitResponse("correct")}
              className="bg-success hover:bg-success/90"
            >
              {responding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Confirm Fee Sheet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
