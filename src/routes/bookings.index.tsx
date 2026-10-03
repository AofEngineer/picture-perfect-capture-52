import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Download } from "lucide-react";
import { z } from "zod";
import { meta } from "@/lib/meta";
import { useStore } from "@/lib/store";
import { DataTable, FilterSelect, PageHeader, StatusBadge, type Column } from "@/components/app/ui-kit";
import { BookingForm } from "@/components/app/BookingForm";
import { BOOKING_STATUS } from "@/lib/labels";
import { WORKFLOW_STEPS } from "@/lib/mock/seed";
import { daysFromToday, downloadCsv, thb, thDate } from "@/lib/format";
import type { Booking } from "@/lib/mock/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/bookings/")({
  validateSearch: z.object({ vehicle: z.string().optional() }),
  head: () => meta("Booking", "รายการจองรถ ค้นหา กรอง และสร้างการจองใหม่"),
  component: BookingList,
});

function BookingList() {
  const { state, inScope, salesName, branchName, can } = useStore();
  const { vehicle } = Route.useSearch();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [fBranch, setFBranch] = useState("all");
  const [fStatus, setFStatus] = useState("all");
  const [fSales, setFSales] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => { if (vehicle) setOpen(true); }, [vehicle]);

  const rows = state.bookings.filter(inScope).filter((b) =>
    (fBranch === "all" || b.branchId === fBranch) && (fStatus === "all" || b.status === fStatus) && (fSales === "all" || b.salesId === fSales) &&
    (!from || b.createdAt >= from) && (!to || b.createdAt.slice(0, 10) <= to));

  const cust = (b: Booking) => state.customers.find((c) => c.id === b.customerId)!;
  const veh = (b: Booking) => state.vehicles.find((v) => v.id === b.vehicleId)!;

  const cols: Column<Booking>[] = [
    { key: "id", header: "เลขการจอง", cell: (b) => <span className="font-medium text-primary">{b.id}</span>, sort: (b) => b.id },
    { key: "c", header: "ลูกค้า", cell: (b) => cust(b).name, sort: (b) => cust(b).name },
    { key: "v", header: "รถ", cell: (b) => <div><div>{veh(b).model}</div><div className="text-xs text-muted-foreground">{veh(b).vin}</div></div> },
    { key: "br", header: "สาขา", cell: (b) => <span className="text-xs">{branchName(b.branchId)}</span> },
    { key: "s", header: "Sales", cell: (b) => salesName(b.salesId), sort: (b) => salesName(b.salesId) },
    { key: "cr", header: "วันที่จอง", cell: (b) => thDate(b.createdAt), sort: (b) => b.createdAt },
    { key: "dep", header: "เงินจอง", cell: (b) => thb(b.deposit), sort: (b) => b.deposit, className: "text-right" },
    { key: "exp", header: "หมดอายุ", cell: (b) => { const n = daysFromToday(b.expiresAt); return <div><div>{thDate(b.expiresAt)}</div>{b.status === "active" && n <= 2 && <StatusBadge tone="warning">อีก {n} วัน</StatusBadge>}</div>; }, sort: (b) => b.expiresAt },
    { key: "del", header: "นัดส่งมอบ", cell: (b) => thDate(b.deliveryAt), sort: (b) => b.deliveryAt ?? "" },
    { key: "st", header: "สถานะ", cell: (b) => <div className="space-y-1"><StatusBadge tone={BOOKING_STATUS[b.status][1]}>{BOOKING_STATUS[b.status][0]}</StatusBadge>{b.status === "active" && <div className="text-[11px] text-muted-foreground">{WORKFLOW_STEPS[b.step]}</div>}</div> },
  ];

  return (
    <div>
      <PageHeader title="Booking" subtitle="รายการจองรถทั้งหมดตามสิทธิ์และสาขา" actions={<>
        {can("booking", "export") && <Button variant="outline" onClick={() => downloadCsv("bookings.csv", [["เลขการจอง", "ลูกค้า", "รถ", "สาขา", "Sales", "เงินจอง", "สถานะ"], ...rows.map((b) => [b.id, cust(b).name, veh(b).model, branchName(b.branchId), salesName(b.salesId), b.deposit, BOOKING_STATUS[b.status][0]])])}><Download className="size-4" /> Export CSV</Button>}
        {can("booking", "create") && <Button onClick={() => setOpen(true)}><Plus className="size-4" /> สร้างการจองใหม่</Button>}
      </>} />
      <DataTable
        rows={rows}
        columns={cols}
        placeholder="ค้นหาเลขจอง ลูกค้า เบอร์ VIN Sales"
        searchText={(b) => `${b.id} ${cust(b).name} ${cust(b).phone} ${veh(b).vin} ${salesName(b.salesId)}`}
        onRowClick={(b) => navigate({ to: "/bookings/$id", params: { id: b.id } })}
        toolbar={<>
          <FilterSelect value={fBranch} onChange={setFBranch} placeholder="สาขา" options={state.branches.map((b) => ({ value: b.id, label: b.short }))} />
          <FilterSelect value={fStatus} onChange={setFStatus} placeholder="สถานะ" options={Object.entries(BOOKING_STATUS).map(([value, [label]]) => ({ value, label }))} />
          <FilterSelect value={fSales} onChange={setFSales} placeholder="ผู้รับผิดชอบ" options={state.sales.map((s) => ({ value: s.id, label: s.name }))} />
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-36" aria-label="จากวันที่" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-36" aria-label="ถึงวันที่" />
        </>}
      />
      <BookingForm open={open} onOpenChange={(o) => { setOpen(o); if (!o && vehicle) navigate({ to: "/bookings", search: {} }); }} vehicleId={vehicle} />
    </div>
  );
}
