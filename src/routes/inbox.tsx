import { createFileRoute } from "@tanstack/react-router";
import { NotificationCenter } from "@/components/app/ConfigurationPages";
import { meta } from "@/lib/meta";
export const Route = createFileRoute("/inbox")({
  head: () => meta("Notification Center", "รายการแจ้งเตือน"),
  component: NotificationCenter,
});
