import { createFileRoute } from "@tanstack/react-router";
import { ServiceOrders } from "@/components/app/StockWorkflowPages";
import { meta } from "@/lib/meta";
export const Route = createFileRoute("/stock/service-orders")({
  head: () => meta("Service Orders", "งานดูแลรถและ Checklist"),
  component: ServiceOrders,
});
