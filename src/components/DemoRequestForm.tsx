import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CalendarCheck, Loader2 } from "lucide-react";

const GRADES = [
  "Kindergarten",
  "1st Grade", "2nd Grade", "3rd Grade", "4th Grade", "5th Grade",
  "6th Grade", "7th Grade", "8th Grade", "9th Grade", "10th Grade",
  "11th Grade", "12th Grade"
];

const SUBJECTS = [
  "Mathematics",
  "Science",
  "English",
  "Reading",
  "Writing",
  "Social Studies",
  "Computer Science",
  "Other"
];

const TIMINGS = [
  "9-10 AM", "10-11 AM", "11-12 PM",
  "12-1 PM", "1-2 PM", "2-3 PM", "3-4 PM",
  "4-5 PM", "5-6 PM", "6-7 PM", "7-8 PM"
];

const DAYS = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
];

export function DemoRequestForm() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    studentName: "",
    parentName: "",
    parentEmail: "",
    age: "",
    grade: "",
    subject: "",
    timing: "",
    days: [] as string[],
    phone: "",
  });

  const handleDayToggle = (day: string) => {
    setFormData(prev => ({
      ...prev,
      days: prev.days.includes(day)
        ? prev.days.filter(d => d !== day)
        : [...prev.days, day]
    }));
  };

  const resetForm = () => {
    setFormData({
      studentName: "",
      parentName: "",
      parentEmail: "",
      age: "",
      grade: "",
      subject: "",
      timing: "",
      days: [],
      phone: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate
    if (!formData.studentName || !formData.parentName || !formData.parentEmail || 
        !formData.age || !formData.grade || !formData.subject || 
        !formData.timing || formData.days.length === 0 || !formData.phone) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-demo-request", {
        body: {
          ...formData,
          days: formData.days.join(", "),
        },
      });

      if (error) throw error;

      toast.success("Thank you! Your demo request has been sent to Shobs Academy. We'll contact you within 24 hours.");
      resetForm();
      setOpen(false);
    } catch (error: any) {
      console.error("Error submitting demo request:", error);
      toast.error("Sorry, something went wrong. Please try again or email shoba.raaju@gmail.com directly.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          size="lg" 
          className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300 gap-2"
        >
          <CalendarCheck className="h-5 w-5" />
          Book a Free Demo Class
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-display">Book a Demo Class</DialogTitle>
          <DialogDescription>
            Fill out the form below and we'll contact you within 24 hours to schedule your free demo class.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="studentName">Student Name *</Label>
              <Input
                id="studentName"
                value={formData.studentName}
                onChange={(e) => setFormData(prev => ({ ...prev, studentName: e.target.value }))}
                placeholder="Enter student name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="age">Student Age *</Label>
              <Input
                id="age"
                value={formData.age}
                onChange={(e) => setFormData(prev => ({ ...prev, age: e.target.value }))}
                placeholder="e.g., 10"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="grade">Preferred Class/Grade *</Label>
            <Select value={formData.grade} onValueChange={(value) => setFormData(prev => ({ ...prev, grade: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select grade" />
              </SelectTrigger>
              <SelectContent>
                {GRADES.map(grade => (
                  <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="parentName">Parent Name *</Label>
              <Input
                id="parentName"
                value={formData.parentName}
                onChange={(e) => setFormData(prev => ({ ...prev, parentName: e.target.value }))}
                placeholder="Enter parent name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="parentEmail">Parent Email *</Label>
              <Input
                id="parentEmail"
                type="email"
                value={formData.parentEmail}
                onChange={(e) => setFormData(prev => ({ ...prev, parentEmail: e.target.value }))}
                placeholder="parent@email.com"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number *</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="(123) 456-7890"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Preferred Subject *</Label>
            <Select value={formData.subject} onValueChange={(value) => setFormData(prev => ({ ...prev, subject: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select subject" />
              </SelectTrigger>
              <SelectContent>
                {SUBJECTS.map(subject => (
                  <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="timing">Preferred Timing *</Label>
            <Select value={formData.timing} onValueChange={(value) => setFormData(prev => ({ ...prev, timing: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select timing" />
              </SelectTrigger>
              <SelectContent>
                {TIMINGS.map(timing => (
                  <SelectItem key={timing} value={timing}>{timing}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Preferred Days *</Label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map(day => (
                <Button
                  key={day}
                  type="button"
                  variant={formData.days.includes(day) ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleDayToggle(day)}
                  className="text-xs"
                >
                  {day.slice(0, 3)}
                </Button>
              ))}
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending Request...
              </>
            ) : (
              "Submit Demo Request"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
