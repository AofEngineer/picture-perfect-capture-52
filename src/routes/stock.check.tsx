import { createFileRoute } from "@tanstack/react-router";
import { Inventory } from "@/components/app/StockPages";
import { meta } from "@/lib/meta";
export const Route = createFileRoute("/stock/check")({
  head: () => meta("Sales Stock Check", "ค้นหารถและ Bonus"),
  component: () => <Inventory check />,
});
