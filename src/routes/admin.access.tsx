import { createFileRoute } from "@tanstack/react-router";
import { AccessControl } from "@/components/app/ConfigurationPages";
import { meta } from "@/lib/meta";
export const Route = createFileRoute("/admin/access")({
  head: () => meta("Access Control", "Role และ Permission"),
  component: AccessControl,
});
