import { createFileRoute } from "@tanstack/react-router";
import { AuditLog } from "@/components/app/AdminPages";
import { meta } from "@/lib/meta";
export const Route = createFileRoute("/admin/audit")({
  head: () => meta("Audit Log", "ประวัติกิจกรรม"),
  component: AuditLog,
});
