import { createFileRoute } from "@tanstack/react-router";
import { SalesDetail } from "@/components/app/SalesPages";
import { meta } from "@/lib/meta";
export const Route = createFileRoute("/sales/$id")({
  head: () => meta("Sales", "ข้อมูล Sales และ Commission"),
  component: Page,
});
function Page() {
  return <SalesDetail id={Route.useParams().id} />;
}
