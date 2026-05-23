import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, User } from "lucide-react";
import type { TabContext } from "./types";

export default function ProfileTab({ ctx }: { ctx: TabContext }) {
  const { profileForm, setProfileForm, handleUpdateProfile, submitting } = ctx;
  return (
    <Card className="max-w-lg dashboard-list-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          My Profile
        </CardTitle>
        <CardDescription>Update your teacher profile information</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subjects">Subjects</Label>
            <Input
              id="subjects"
              placeholder="e.g., Math, Physics, Chemistry"
              value={profileForm.subjects}
              onChange={(e) => setProfileForm({ ...profileForm, subjects: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="availability">Availability</Label>
            <Input
              id="availability"
              placeholder="e.g., Mon-Fri 9am-5pm"
              value={profileForm.availability}
              onChange={(e) => setProfileForm({ ...profileForm, availability: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              placeholder="Tell students about yourself..."
              value={profileForm.bio}
              onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
              rows={4}
            />
          </div>
          <Button type="submit" className="w-full dashboard-btn dashboard-btn-teacher" disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update Profile"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
