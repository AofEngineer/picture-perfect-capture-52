import { createFileRoute } from "@tanstack/react-router";
import { VehicleDetail } from "@/components/app/StockPages";
import { meta } from "@/lib/meta";
export const Route = createFileRoute("/stock/$id")({
  head: () => meta("Vehicle", "รายละเอียดรถและประวัติ"),
  component: Page,
});
function Page() {
  return <VehicleDetail id={Route.useParams().id} />;
}
