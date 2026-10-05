import { createFileRoute } from "@tanstack/react-router";
import { Integrations } from "@/components/app/AdminPages";
import { meta } from "@/lib/meta";
export const Route = createFileRoute("/admin/integrations")({
  head: () => meta("Integrations", "การเชื่อมต่อจำลอง"),
  component: Integrations,
});
