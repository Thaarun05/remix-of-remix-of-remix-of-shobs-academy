import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Send, Save, Loader2, Calculator, FileSpreadsheet, Edit2 } from "lucide-react";
import { format } from "date-fns";

interface FeeRow {
  id?: string;
  class_date: string;
  hours: number;
  topic: string;
  row_order: number;
}

interface Student {
  user_id: string;
  student_name: string;
}

interface Invoice {
  id: string;
  student_user_id: string;
  student_name: string;
  fee_per_hour: number;
  status: string;
  admin_notes: string | null;
  student_notes: string | null;
  sent_at: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export const FeeSheetCalculator = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [feePerHour, setFeePerHour] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [rows, setRows] = useState<FeeRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  
  // Recent invoices
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  
  // Editing state for inline editing
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; field: keyof FeeRow } | null>(null);

  useEffect(() => {
    fetchStudents();
    fetchRecentInvoices();
  }, []);

  const fetchStudents = async () => {
    const { data } = await supabase
      .from("student_profiles")
      .select("user_id, student_name")
      .order("student_name");
    setStudents(data || []);
  };

  const fetchRecentInvoices = async () => {
    const { data } = await supabase
      .from("student_fee_invoices")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(10);
    setRecentInvoices((data as Invoice[]) || []);
  };

  const loadInvoiceForEdit = async (invoice: Invoice) => {
    setEditingInvoiceId(invoice.id);
    setSelectedStudentId(invoice.student_user_id);
    setFeePerHour(invoice.fee_per_hour.toString());
    setAdminNotes(invoice.admin_notes || "");
    
    // Load rows
    const { data: rowsData } = await supabase
      .from("student_fee_invoice_rows")
      .select("*")
      .eq("invoice_id", invoice.id)
      .order("row_order");
    
    setRows((rowsData || []).map(r => ({
      id: r.id,
      class_date: r.class_date,
      hours: Number(r.hours),
      topic: r.topic,
      row_order: r.row_order
    })));
    
    toast({ title: "Invoice loaded", description: "Edit the sheet and save or resend." });
  };

  const resetForm = () => {
    setEditingInvoiceId(null);
    setSelectedStudentId("");
    setFeePerHour("");
    setAdminNotes("");
    setRows([]);
  };

  const addRow = () => {
    setRows([...rows, {
      class_date: format(new Date(), "yyyy-MM-dd"),
      hours: 1,
      topic: "",
      row_order: rows.length
    }]);
  };

  const removeRow = (index: number) => {
    setRows(rows.filter((_, i) => i !== index));
  };

  const updateRow = (index: number, field: keyof FeeRow, value: string | number) => {
    setRows(rows.map((row, i) => 
      i === index ? { ...row, [field]: value } : row
    ));
  };

  const handleCellClick = (rowIndex: number, field: keyof FeeRow) => {
    if (field !== "row_order") {
      setEditingCell({ rowIndex, field });
    }
  };

  const handleCellBlur = () => {
    setEditingCell(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number, field: keyof FeeRow) => {
    if (e.key === "Enter" || e.key === "Tab") {
      setEditingCell(null);
    } else if (e.key === "Escape") {
      setEditingCell(null);
    }
  };

  // Calculations
  const totalHours = rows.reduce((sum, r) => sum + (Number(r.hours) || 0), 0);
  const totalClasses = rows.length;
  const feeRate = parseFloat(feePerHour) || 0;
  const totalFee = totalHours * feeRate;

  const selectedStudent = students.find(s => s.user_id === selectedStudentId);

  const saveInvoice = async (sendToStudent: boolean) => {
    if (!selectedStudentId || !selectedStudent) {
      toast({ title: "Select a student", variant: "destructive" });
      return;
    }
    if (rows.length === 0) {
      toast({ title: "Add at least one row", variant: "destructive" });
      return;
    }

    sendToStudent ? setSending(true) : setSaving(true);

    try {
      let invoiceId = editingInvoiceId;

      if (editingInvoiceId) {
        // Update existing invoice
        const { error } = await supabase
          .from("student_fee_invoices")
          .update({
            fee_per_hour: feeRate,
            admin_notes: adminNotes || null,
            status: sendToStudent ? "sent" : "draft",
            sent_at: sendToStudent ? new Date().toISOString() : null,
            updated_at: new Date().toISOString()
          })
          .eq("id", editingInvoiceId);
        
        if (error) throw error;

        // Delete old rows and insert new ones
        await supabase.from("student_fee_invoice_rows").delete().eq("invoice_id", editingInvoiceId);
      } else {
        // Create new invoice
        const { data, error } = await supabase
          .from("student_fee_invoices")
          .insert({
            student_user_id: selectedStudentId,
            student_name: selectedStudent.student_name,
            fee_per_hour: feeRate,
            admin_notes: adminNotes || null,
            status: sendToStudent ? "sent" : "draft",
            sent_at: sendToStudent ? new Date().toISOString() : null,
            created_by_admin_user_id: user!.id
          })
          .select("id")
          .single();
        
        if (error) throw error;
        invoiceId = data.id;
      }

      // Insert rows
      const rowsToInsert = rows.map((r, i) => ({
        invoice_id: invoiceId,
        class_date: r.class_date,
        hours: r.hours,
        topic: r.topic,
        row_order: i
      }));

      const { error: rowsError } = await supabase
        .from("student_fee_invoice_rows")
        .insert(rowsToInsert);

      if (rowsError) throw rowsError;

      // Send notification if sending to student
      if (sendToStudent) {
        await supabase.from("notifications").insert({
          recipient_id: selectedStudentId,
          sender_id: user!.id,
          type: "fee",
          title: "Fee Sheet Available",
          body: `Your fee sheet is ready for review. Total: $${totalFee.toFixed(2)}`,
          entity_table: "student_fee_invoices",
          entity_id: invoiceId
        });
      }

      toast({
        title: sendToStudent ? "Fee sheet sent!" : "Draft saved",
        description: sendToStudent 
          ? `Fee sheet sent to ${selectedStudent.student_name}` 
          : "Your draft has been saved."
      });

      resetForm();
      fetchRecentInvoices();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
      setSending(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft": return <Badge variant="outline">Draft</Badge>;
      case "sent": return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Sent</Badge>;
      case "correct": return <Badge className="bg-success/10 text-success border-success/20">Confirmed</Badge>;
      case "correction_needed": return <Badge className="bg-warning/10 text-warning border-warning/20">Needs Correction</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Calculator / Spreadsheet */}
      <Card className="dashboard-list-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Student Fee Sheet
            {editingInvoiceId && <Badge variant="outline" className="ml-2">Editing</Badge>}
          </CardTitle>
          <CardDescription>
            Create a tabular fee sheet with date, hours, and topic
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Student Selector + Fee Rate */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Student</Label>
              <Select value={selectedStudentId} onValueChange={setSelectedStudentId} disabled={!!editingInvoiceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select student" />
                </SelectTrigger>
                <SelectContent>
                  {students.map(s => (
                    <SelectItem key={s.user_id} value={s.user_id}>{s.student_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fee per Hour ($)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={feePerHour}
                onChange={(e) => setFeePerHour(e.target.value)}
                placeholder="e.g. 50"
              />
            </div>
          </div>

          {/* Spreadsheet Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[140px]">Date</TableHead>
                  <TableHead className="w-[80px]">Hours</TableHead>
                  <TableHead>Topic</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Click "Add Row" to start building the fee sheet
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row, index) => (
                    <TableRow key={index} className="group">
                      <TableCell 
                        className="p-0 cursor-pointer"
                        onClick={() => handleCellClick(index, "class_date")}
                      >
                        {editingCell?.rowIndex === index && editingCell?.field === "class_date" ? (
                          <Input
                            type="date"
                            value={row.class_date}
                            onChange={(e) => updateRow(index, "class_date", e.target.value)}
                            onBlur={handleCellBlur}
                            onKeyDown={(e) => handleKeyDown(e, index, "class_date")}
                            className="border-0 rounded-none h-10 focus-visible:ring-1"
                            autoFocus
                          />
                        ) : (
                          <div className="px-4 py-2 hover:bg-muted/50">{format(new Date(row.class_date), "MMM d, yyyy")}</div>
                        )}
                      </TableCell>
                      <TableCell 
                        className="p-0 cursor-pointer"
                        onClick={() => handleCellClick(index, "hours")}
                      >
                        {editingCell?.rowIndex === index && editingCell?.field === "hours" ? (
                          <Input
                            type="number"
                            min="0"
                            step="0.5"
                            value={row.hours}
                            onChange={(e) => updateRow(index, "hours", parseFloat(e.target.value) || 0)}
                            onBlur={handleCellBlur}
                            onKeyDown={(e) => handleKeyDown(e, index, "hours")}
                            className="border-0 rounded-none h-10 focus-visible:ring-1"
                            autoFocus
                          />
                        ) : (
                          <div className="px-4 py-2 hover:bg-muted/50">{row.hours}</div>
                        )}
                      </TableCell>
                      <TableCell 
                        className="p-0 cursor-pointer"
                        onClick={() => handleCellClick(index, "topic")}
                      >
                        {editingCell?.rowIndex === index && editingCell?.field === "topic" ? (
                          <Input
                            type="text"
                            value={row.topic}
                            onChange={(e) => updateRow(index, "topic", e.target.value)}
                            onBlur={handleCellBlur}
                            onKeyDown={(e) => handleKeyDown(e, index, "topic")}
                            className="border-0 rounded-none h-10 focus-visible:ring-1"
                            autoFocus
                            placeholder="Topic covered"
                          />
                        ) : (
                          <div className="px-4 py-2 hover:bg-muted/50 truncate">{row.topic || <span className="text-muted-foreground italic">Click to add topic</span>}</div>
                        )}
                      </TableCell>
                      <TableCell className="p-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                          onClick={() => removeRow(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {rows.length > 0 && (
                <TableFooter>
                  <TableRow className="bg-primary/5 font-medium">
                    <TableCell>Total</TableCell>
                    <TableCell>{totalHours} hrs</TableCell>
                    <TableCell colSpan={2}>
                      <div className="flex items-center gap-2 text-lg">
                        <Calculator className="h-4 w-4" />
                        <span>{totalClasses} classes × ${feeRate}/hr = </span>
                        <span className="font-bold text-primary">${totalFee.toFixed(2)}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>

          {/* Add Row Button */}
          <Button variant="outline" onClick={addRow} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Row
          </Button>

          {/* Admin Notes */}
          <div>
            <Label>Notes (Optional)</Label>
            <Textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Any notes for the student..."
              rows={2}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            {editingInvoiceId && (
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            )}
            <Button variant="outline" onClick={() => saveInvoice(false)} disabled={saving || sending}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Draft
            </Button>
            <Button onClick={() => saveInvoice(true)} disabled={saving || sending} className="flex-1">
              {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Send to Student
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Right: Recent Invoices */}
      <Card className="dashboard-list-card">
        <CardHeader>
          <CardTitle>Recent Fee Sheets</CardTitle>
          <CardDescription>View and manage sent fee sheets</CardDescription>
        </CardHeader>
        <CardContent>
          {recentInvoices.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No fee sheets created yet
            </div>
          ) : (
            <div className="space-y-3">
              {recentInvoices.map((invoice) => (
                <div key={invoice.id} className="p-4 rounded-lg border bg-card hover:border-primary/30 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{invoice.student_name}</span>
                        {getStatusBadge(invoice.status)}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Rate: ${invoice.fee_per_hour}/hr • Created: {format(new Date(invoice.created_at), "MMM d, yyyy")}
                      </p>
                      {invoice.student_notes && (
                        <p className="text-sm mt-2 p-2 bg-warning/10 rounded border-l-2 border-warning">
                          <strong>Student:</strong> {invoice.student_notes}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadInvoiceForEdit(invoice)}
                    >
                      <Edit2 className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
