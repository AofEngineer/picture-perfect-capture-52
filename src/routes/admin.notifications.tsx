import { createFileRoute } from "@tanstack/react-router";
import { NotificationSettings } from "@/components/app/ConfigurationPages";
import { meta } from "@/lib/meta";
export const Route = createFileRoute("/admin/notifications")({
  head: () => meta("Notification Settings", "ตั้งค่าแจ้งเตือน"),
  component: NotificationSettings,
});
