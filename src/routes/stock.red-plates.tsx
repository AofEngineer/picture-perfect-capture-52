import { createFileRoute } from "@tanstack/react-router";
import { RedPlates } from "@/components/app/StockWorkflowPages";
import { meta } from "@/lib/meta";
export const Route = createFileRoute("/stock/red-plates")({
  head: () => meta("Red Plate Management", "จัดการและติดตามป้ายแดง"),
  component: RedPlates,
});
