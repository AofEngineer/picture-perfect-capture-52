import { createFileRoute } from "@tanstack/react-router";
import { LoyaltyConfiguration } from "@/components/app/ConfigurationPages";
import { meta } from "@/lib/meta";
export const Route = createFileRoute("/admin/loyalty")({
  head: () => meta("Loyalty Configuration", "สูตรและ Simulator"),
  component: LoyaltyConfiguration,
});
