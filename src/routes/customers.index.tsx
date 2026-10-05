import { createFileRoute } from "@tanstack/react-router";
import { CustomerList } from "@/components/app/CustomerPages";
import { meta } from "@/lib/meta";
export const Route = createFileRoute("/customers/")({
  head: () => meta("Customer", "ข้อมูลลูกค้าและ Loyalty"),
  component: CustomerList,
});
