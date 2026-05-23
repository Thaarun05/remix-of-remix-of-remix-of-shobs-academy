import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MessagingPanel } from "@/components/messaging/MessagingPanel";
import { AdminTeacherMessaging } from "@/components/messaging/AdminTeacherMessaging";
import type { TabContext } from "./types";

export default function MessagingTab({ ctx }: { ctx: TabContext }) {
  return (
    <div>
      <Tabs defaultValue="students" className="space-y-4">
        <TabsList>
          <TabsTrigger value="students">My Students</TabsTrigger>
          <TabsTrigger value="admin">Admin Messages</TabsTrigger>
        </TabsList>
        <TabsContent value="students">
          <MessagingPanel userRole="teacher" preselectedConversationId={ctx.selectedConversationId} />
        </TabsContent>
        <TabsContent value="admin">
          <AdminTeacherMessaging userRole="teacher" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
