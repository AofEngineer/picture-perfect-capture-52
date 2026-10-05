import { createFileRoute } from "@tanstack/react-router";
import { Inventory } from "@/components/app/StockPages";
import { meta } from "@/lib/meta";
export const Route = createFileRoute("/stock/")({
  head: () => meta("Vehicle Inventory", "สต็อกรถทุกสาขา"),
  component: Inventory,
});
