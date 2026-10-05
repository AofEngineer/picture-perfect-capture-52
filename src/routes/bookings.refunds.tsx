import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { DataTable, FilterSelect, PageHeader, StatusBadge } from "@/components/app/ui-kit";
import { useStore } from "@/lib/store";
import { REFUND_STATUS } from "@/lib/labels";
import { thb, thDate } from "@/lib/format";
import { meta } from "@/lib/meta";
export const Route = createFileRoute("/bookings/refunds")({
  head: () => meta("Refund", "คำขอคืนเงินจอง"),
  component: Refunds,
});
function Refunds() {
  const { state, inScope, branchName } = useStore();
  const [status, setStatus] = useState("all");
  return (
    <>
      <PageHeader title="Refund" subtitle="คำขอคืนเงินจองและ Point แยกตามสาขาที่รับผิดชอบ" demo />
      <DataTable
        rows={state.bookings
          .filter(inScope)
          .filter((b) => b.refund && (status === "all" || b.refund.status === status))}
        searchText={(b) =>
          `${b.id} ${b.refund?.id} ${state.customers.find((c) => c.id === b.customerId)?.name}`
        }
        toolbar={
          <FilterSelect
            value={status}
            onChange={setStatus}
            placeholder="สถานะ"
            options={Object.entries(REFUND_STATUS).map(([value, [label]]) => ({ value, label }))}
          />
        }
        columns={[
          {
            key: "id",
            header: "เลขที่คำขอ / Booking",
            cell: (b) => (
              <Link to="/bookings/$id" params={{ id: b.id }} className="text-primary">
                {b.refund?.id} · {b.id}
              </Link>
            ),
          },
          { key: "date", header: "วันที่ขอ", cell: (b) => thDate(b.refund?.requestedAt) },
          {
            key: "branch",
            header: "สาขารับเงิน / คืนเงิน",
            cell: (b) => `${branchName(b.branchId)} / ${branchName(b.refund!.branchId)}`,
          },
          {
            key: "amount",
            header: "เงินจอง / คืนสุทธิ / Point",
            cell: (b) =>
              `${thb(b.deposit)} / ${thb(b.refund!.amount)} / ${b.refund!.pointsReturn} Point`,
          },
          {
            key: "status",
            header: "สถานะ",
            cell: (b) => (
              <StatusBadge tone={REFUND_STATUS[b.refund!.status][1]}>
                {REFUND_STATUS[b.refund!.status][0]}
              </StatusBadge>
            ),
          },
        ]}
      />
    </>
  );
}
