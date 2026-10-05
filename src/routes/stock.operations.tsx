import { createFileRoute } from "@tanstack/react-router";
import { StockOperations } from "@/components/app/StockPages";
import { meta } from "@/lib/meta";
export const Route = createFileRoute("/stock/operations")({
  head: () => meta("Stock Operations", "รับรถและโอนรถ"),
  component: StockOperations,
});
