import { createFileRoute } from "@tanstack/react-router";
import { Reports } from "@/components/app/AdminPages";
import { meta } from "@/lib/meta";
export const Route = createFileRoute("/admin/reports")({
  head: () => meta("Reports", "รายงานยอดขายและ Loyalty"),
  component: Reports,
});
