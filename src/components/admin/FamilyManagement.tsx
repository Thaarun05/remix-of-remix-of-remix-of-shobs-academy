import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Plus, Trash2, Users, Save, UserMinus } from "lucide-react";
import { format } from "date-fns";

interface Family {
  id: string;
  name: string;
  notes: string | null;
}

interface Member {
  id: string;
  family_id: string;
  student_user_id: string;
  enrolled_at: string;
  withdrawn_at: string | null;
  student_name?: string;
}

interface Student {
  user_id: string;
  student_name: string;
}

interface Settings {
  second_child_pct: number;
  third_plus_pct: number;
  family_cap_pct: number;
  per_student_floor_pct: number;
}

export const FamilyManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [families, setFamilies] = useState<Family[]>([]);
  const [members, setMembers] = useState<Record<string, Member[]>>({});
  const [students, setStudents] = useState<Student[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  const [newFamilyStudentId, setNewFamilyStudentId] = useState("");
  const [addingMember, setAddingMember] = useState<Record<string, string>>({});

  const [confirmDelete, setConfirmDelete] = useState<Family | null>(null);
  const [confirmWithdraw, setConfirmWithdraw] = useState<Member | null>(null);

  useEffect(() => {
    void loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    const [{ data: fams }, { data: fmData }, { data: sp }, { data: st }] = await Promise.all([
      supabase.from("families").select("*").is("deleted_at", null).order("name"),
      supabase.from("family_members").select("*").order("enrolled_at"),
      supabase.from("student_profiles").select("user_id, student_name").order("student_name"),
      supabase.from("sibling_discount_settings").select("*").eq("id", 1).maybeSingle(),
    ]);
    const nameById = new Map((sp || []).map((s) => [s.user_id, s.student_name]));
    const grouped: Record<string, Member[]> = {};
    (fmData || []).forEach((m) => {
      (grouped[m.family_id] ||= []).push({ ...m, student_name: nameById.get(m.student_user_id) });
    });
    setFamilies((fams as Family[]) || []);
    setMembers(grouped);
    setStudents((sp as Student[]) || []);
    if (st) setSettings(st as Settings);
    setLoading(false);
  };

  const createFamily = async () => {
    if (!newFamilyStudentId) return;
    const student = students.find((s) => s.user_id === newFamilyStudentId);
    if (!student) return;
    const { data: fam, error } = await supabase
      .from("families")
      .insert({ name: `${student.student_name} Family` })
      .select("id")
      .single();
    if (error || !fam) return toast({ title: "Error", description: error?.message, variant: "destructive" });
    const { error: memErr } = await supabase
      .from("family_members")
      .insert({ family_id: fam.id, student_user_id: newFamilyStudentId });
    if (memErr && memErr.code !== "23505") {
      toast({ title: "Family created but student not added", description: memErr.message, variant: "destructive" });
    } else {
      toast({ title: "Family created" });
    }
    setNewFamilyStudentId("");
    loadAll();
  };

  const softDeleteFamily = async (f: Family) => {
    const { error } = await supabase.from("families").update({ deleted_at: new Date().toISOString() }).eq("id", f.id);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    toast({ title: "Family removed" });
    setConfirmDelete(null);
    loadAll();
  };

  const addMember = async (familyId: string) => {
    const sid = addingMember[familyId];
    if (!sid) return;
    const { error } = await supabase
      .from("family_members")
      .insert({ family_id: familyId, student_user_id: sid });
    if (error) {
      if (error.code === "23505") {
        return toast({
          title: "Already in a family",
          description: "This student is already an active member of another family. Withdraw them first.",
          variant: "destructive",
        });
      }
      return toast({ title: "Error", description: error.message, variant: "destructive" });
    }
    setAddingMember((s) => ({ ...s, [familyId]: "" }));
    toast({ title: "Student added" });
    loadAll();
  };

  const updateEnrolledAt = async (m: Member, value: string) => {
    const iso = new Date(value).toISOString();
    const { error } = await supabase.from("family_members").update({ enrolled_at: iso }).eq("id", m.id);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    loadAll();
  };

  const withdrawMember = async (m: Member) => {
    const { error } = await supabase
      .from("family_members")
      .update({ withdrawn_at: new Date().toISOString() })
      .eq("id", m.id);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    toast({ title: "Marked withdrawn", description: "Sibling ranks recalc from next cycle." });
    setConfirmWithdraw(null);
    loadAll();
  };

  const removeMember = async (m: Member) => {
    const { error } = await supabase.from("family_members").delete().eq("id", m.id);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    loadAll();
  };

  const saveSettings = async () => {
    if (!settings) return;
    const { error } = await supabase
      .from("sibling_discount_settings")
      .update({
        second_child_pct: settings.second_child_pct,
        third_plus_pct: settings.third_plus_pct,
        family_cap_pct: settings.family_cap_pct,
        per_student_floor_pct: settings.per_student_floor_pct,
        updated_by: user?.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    toast({ title: "Settings saved" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-admin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Settings */}
      {settings && (
        <Card className="dashboard-list-card">
          <CardHeader>
            <CardTitle>Sibling Discount Settings</CardTitle>
            <CardDescription>Applies to all families. Change any time — future invoices only.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label>2nd student %</Label>
              <Input type="number" min="0" max="100" value={settings.second_child_pct}
                onChange={(e) => setSettings({ ...settings, second_child_pct: Number(e.target.value) })} />
            </div>
            <div>
              <Label>3rd+ student %</Label>
              <Input type="number" min="0" max="100" value={settings.third_plus_pct}
                onChange={(e) => setSettings({ ...settings, third_plus_pct: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Family cap %</Label>
              <Input type="number" min="0" max="100" value={settings.family_cap_pct}
                onChange={(e) => setSettings({ ...settings, family_cap_pct: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Per-student floor %</Label>
              <Input type="number" min="0" max="100" value={settings.per_student_floor_pct}
                onChange={(e) => setSettings({ ...settings, per_student_floor_pct: Number(e.target.value) })} />
            </div>
            <div className="col-span-full">
              <Button onClick={saveSettings}><Save className="h-4 w-4 mr-2" />Save Settings</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create family */}
      <Card className="dashboard-list-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-admin" />Families</CardTitle>
          <CardDescription>Group siblings manually. Rank is by enrolled date within a family.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Select value={newFamilyStudentId} onValueChange={setNewFamilyStudentId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select first student..." />
              </SelectTrigger>
              <SelectContent>
                {students
                  .filter((s) => !Object.values(members).flat().some((m) => m.student_user_id === s.user_id && !m.withdrawn_at))
                  .map((s) => (
                    <SelectItem key={s.user_id} value={s.user_id}>{s.student_name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Button onClick={createFamily} disabled={!newFamilyStudentId}>
              <Plus className="h-4 w-4 mr-2" />Add Family
            </Button>
          </div>

          {families.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No families yet.</div>
          ) : (
            <div className="space-y-4">
              {families.map((f) => {
                const fam = members[f.id] || [];
                const active = fam.filter((m) => !m.withdrawn_at);
                const availableStudents = students.filter(
                  (s) => !fam.some((m) => m.student_user_id === s.user_id && !m.withdrawn_at),
                );
                const draft = overrideDraft[f.id] || { pct: "", reason: "" };
                return (
                  <div key={f.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{f.name}</span>
                          <Badge variant="outline">{active.length} active</Badge>
                          {f.manual_override_pct != null && (
                            <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/30">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Manual override {f.manual_override_pct}%
                            </Badge>
                          )}
                        </div>
                        {f.manual_override_reason && (
                          <p className="text-xs text-muted-foreground mt-1">Reason: {f.manual_override_reason}</p>
                        )}
                      </div>
                      <Button variant="ghost" size="sm" className="text-destructive"
                        onClick={() => setConfirmDelete(f)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Members */}
                    <div className="space-y-2">
                      {fam.length === 0 && <p className="text-sm text-muted-foreground">No members yet.</p>}
                      {fam.map((m, idx) => {
                        const rank = active.findIndex((a) => a.id === m.id) + 1;
                        return (
                          <div key={m.id} className="grid grid-cols-1 md:grid-cols-[1fr_180px_120px_auto] gap-2 items-center bg-muted/30 rounded p-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{m.student_name || m.student_user_id.slice(0, 8)}</span>
                              {m.withdrawn_at ? (
                                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                                  Withdrawn {format(new Date(m.withdrawn_at), "MMM d, yyyy")}
                                </Badge>
                              ) : (
                                <Badge variant="outline">Rank {rank}</Badge>
                              )}
                            </div>
                            <Input type="date" value={format(new Date(m.enrolled_at), "yyyy-MM-dd")}
                              onChange={(e) => updateEnrolledAt(m, e.target.value)} />
                            {!m.withdrawn_at ? (
                              <Button size="sm" variant="outline" onClick={() => setConfirmWithdraw(m)}>
                                <UserMinus className="h-3.5 w-3.5 mr-1" />Withdraw
                              </Button>
                            ) : (
                              <span />
                            )}
                            <Button size="sm" variant="ghost" className="text-destructive"
                              onClick={() => removeMember(m)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>

                    {/* Add member */}
                    {availableStudents.length > 0 && (
                      <div className="flex gap-2">
                        <Select value={addingMember[f.id] || ""}
                          onValueChange={(v) => setAddingMember((s) => ({ ...s, [f.id]: v }))}>
                          <SelectTrigger className="max-w-sm">
                            <SelectValue placeholder="Add student..." />
                          </SelectTrigger>
                          <SelectContent>
                            {availableStudents.map((s) => (
                              <SelectItem key={s.user_id} value={s.user_id}>{s.student_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="sm" onClick={() => addMember(f.id)}><Plus className="h-4 w-4" /></Button>
                      </div>
                    )}

                    {/* Manual override */}
                    <div className="pt-3 border-t">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">Manual family override (logged)</p>
                      <div className="grid grid-cols-1 md:grid-cols-[120px_1fr_auto_auto] gap-2 items-end">
                        <div>
                          <Label className="text-xs">Discount %</Label>
                          <Input type="number" min="0" max="100" placeholder="e.g. 12" value={draft.pct}
                            onChange={(e) => setOverrideDraft((s) => ({ ...s, [f.id]: { ...draft, pct: e.target.value } }))} />
                        </div>
                        <div>
                          <Label className="text-xs">Reason</Label>
                          <Input placeholder="Reason" value={draft.reason}
                            onChange={(e) => setOverrideDraft((s) => ({ ...s, [f.id]: { ...draft, reason: e.target.value } }))} />
                        </div>
                        <Button size="sm" onClick={() => setOverride(f, false)}>Apply</Button>
                        {f.manual_override_pct != null && (
                          <Button size="sm" variant="outline" onClick={() => setOverride(f, true)}>Clear</Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete family?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes "{confirmDelete?.name}". Past invoices are preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground"
              onClick={() => confirmDelete && softDeleteFamily(confirmDelete)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmWithdraw} onOpenChange={(o) => !o && setConfirmWithdraw(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark withdrawn?</AlertDialogTitle>
            <AlertDialogDescription>
              This student stops receiving sibling discounts from the next billing cycle. Siblings' ranks recalculate. Past invoices are not changed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmWithdraw && withdrawMember(confirmWithdraw)}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
