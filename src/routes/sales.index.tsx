import { createFileRoute } from "@tanstack/react-router";
import { SalesList } from "@/components/app/SalesPages";
import { meta } from "@/lib/meta";
export const Route = createFileRoute("/sales/")({
  head: () => meta("Sales", "ทีมขายและเป้าหมาย"),
  component: SalesList,
});
