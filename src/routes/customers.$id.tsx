import { createFileRoute } from "@tanstack/react-router";
import { CustomerDetail } from "@/components/app/CustomerPages";
import { meta } from "@/lib/meta";
export const Route = createFileRoute("/customers/$id")({
  head: () => meta("Customer", "ข้อมูลลูกค้าและประวัติการซื้อ"),
  component: Page,
});
function Page() {
  return <CustomerDetail id={Route.useParams().id} />;
}
