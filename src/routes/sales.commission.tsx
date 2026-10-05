import { createFileRoute } from "@tanstack/react-router";
import { Commissions } from "@/components/app/SalesPages";
import { meta } from "@/lib/meta";
export const Route = createFileRoute("/sales/commission")({
  head: () => meta("Commission", "คำนวณและส่งเบิก Commission"),
  component: Commissions,
});
