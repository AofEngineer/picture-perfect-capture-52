import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Car, Download, LayoutGrid, List, Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import {
  daysBetween,
  daysFromToday,
  downloadCsv,
  refId,
  thb,
  thDate,
  thDateTime,
} from "@/lib/format";
import {
  addVehicle,
  advanceTransfer,
  notify,
  receiveVehicle,
  requestTransfer,
} from "@/lib/mock/service";
import type { DemoState, Vehicle } from "@/lib/mock/types";
import { STOCK_STATUS, BOOKING_STATUS, SO_STATUS } from "@/lib/labels";
import {
  DataTable,
  DetailDrawer,
  EmptyState,
  Field,
  FilterSelect,
  PageHeader,
  Panel,
  StatusBadge,
  Timeline,
  type Column,
} from "./ui-kit";
import { useDemoAction, ConfirmAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import sedan from "@/assets/car-sedan.jpg";
import suv from "@/assets/car-suv.jpg";
import ev from "@/assets/car-ev.jpg";
export const carImage = (v: Vehicle) => ({ sedan, suv, ev })[v.body];
export const age = (v: Vehicle) =>
  v.status === "incoming" ? 0 : Math.max(0, daysBetween(v.receivedAt, new Date().toISOString()));

export function Inventory({ check = false }: { check?: boolean }) {
  const { state, inScope, branchName, sensitive, can } = useStore();
  const navigate = useNavigate();
  const [branch, setBranch] = useState("all");
  const [status, setStatus] = useState("all");
  const [bonus, setBonus] = useState("all");
  const [year, setYear] = useState("all");
  const [minAge, setMinAge] = useState("");
  const [minMargin, setMargin] = useState("");
  const [q, setQ] = useState("");
  const [cards, setCards] = useState(check);
  const [selected, setSelected] = useState<string | null>(null);
  const rows = state.vehicles
    .filter(inScope)
    .filter(
      (v) =>
        (branch === "all" || v.branchId === branch) &&
        (status === "all" || v.status === status) &&
        (year === "all" || String(v.year) === year) &&
        (bonus === "all" ||
          (!!v.bonus && daysFromToday(v.bonus.until) >= 0) === (bonus === "yes")) &&
        (!minAge || age(v) >= Number(minAge)) &&
        (!sensitive || !minMargin || v.price - v.cost >= Number(minMargin)) &&
        `${v.code} ${v.model} ${v.color} ${v.vin}`.toLowerCase().includes(q.toLowerCase()),
    );
  const selectedCar = state.vehicles.find((v) => v.id === selected);
  const columns: Column<Vehicle>[] = [
    {
      key: "car",
      header: "รถ",
      cell: (v) => (
        <div className="flex items-center gap-3">
          <img className="h-12 w-20 rounded-sm object-cover" src={carImage(v)} alt={v.model} />
          <div className="font-medium">
            {v.model}
            <div className="text-xs text-muted-foreground">
              {v.color} · {v.year} · {v.code}
            </div>
            <div className="text-xs text-muted-foreground">{v.vin}</div>
          </div>
        </div>
      ),
      sort: (v) => v.model,
    },
    { key: "branch", header: "สาขา", cell: (v) => branchName(v.branchId) },
    { key: "price", header: "ราคาขาย", cell: (v) => thb(v.price), sort: (v) => v.price },
    ...(sensitive
      ? [
          {
            key: "margin",
            header: "Margin",
            cell: (v: Vehicle) => thb(v.price - v.cost),
            sort: (v: Vehicle) => v.price - v.cost,
          },
        ]
      : []),
    {
      key: "age",
      header: "อายุรถ / สาขาปัจจุบัน",
      cell: (v) =>
        v.status === "incoming"
          ? `คาดเข้า ${thDate(v.expectedAt)}`
          : `${age(v)} / ${Math.max(0, daysBetween(v.branchSince, new Date().toISOString()))} วัน`,
      sort: age,
    },
    {
      key: "status",
      header: "สถานะ / ความพร้อม",
      cell: (v) => (
        <div className="space-y-1">
          <StatusBadge tone={STOCK_STATUS[v.status][1]}>{STOCK_STATUS[v.status][0]}</StatusBadge>
          <div className="text-xs text-muted-foreground">
            {v.ready && v.status === "available"
              ? "พร้อมจอง"
              : v.ready
                ? "พร้อมส่งมอบ"
                : (v.readyNote ?? "ยังไม่พร้อมจอง")}
          </div>
        </div>
      ),
    },
    {
      key: "bonus",
      header: "Bonus",
      cell: (v) =>
        v.bonus ? (
          <div>
            {thb(v.bonus.amount)}
            <div className="text-xs text-muted-foreground">ถึง {thDate(v.bonus.until)}</div>
          </div>
        ) : (
          "—"
        ),
      sort: (v) => v.bonus?.amount ?? 0,
    },
  ];
  const filters = (
    <>
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="ค้นหารุ่น สี VIN รหัสรถ"
        className="h-9 w-60"
      />
      <FilterSelect
        value={branch}
        onChange={setBranch}
        placeholder="สาขา"
        options={state.branches.map((b) => ({ value: b.id, label: b.short }))}
      />
      <FilterSelect
        value={status}
        onChange={setStatus}
        placeholder="สถานะ"
        options={Object.entries(STOCK_STATUS).map(([value, [label]]) => ({ value, label }))}
      />
      <FilterSelect
        value={year}
        onChange={setYear}
        placeholder="ปี"
        options={[...new Set(state.vehicles.map((v) => String(v.year)))].map((value) => ({
          value,
          label: value,
        }))}
      />
      <FilterSelect
        value={bonus}
        onChange={setBonus}
        placeholder="Bonus"
        options={[
          { value: "yes", label: "มี Bonus ที่ยังใช้ได้" },
          { value: "no", label: "ไม่มี Bonus / หมดอายุ" },
        ]}
      />
      <Input
        type="number"
        min="0"
        value={minAge}
        onChange={(e) => setMinAge(e.target.value)}
        placeholder="อายุขั้นต่ำ (วัน)"
        className="h-9 w-36"
      />
      {sensitive && (
        <Input
          type="number"
          value={minMargin}
          onChange={(e) => setMargin(e.target.value)}
          placeholder="Margin ขั้นต่ำ"
          className="h-9 w-36"
        />
      )}
    </>
  );
  return (
    <>
      <PageHeader
        title={check ? "Sales Stock Check" : "Vehicle Inventory"}
        subtitle="ค้นหารถพร้อมขาย ความพร้อมส่งมอบ และ Bonus ตามสาขาที่ได้รับสิทธิ์"
        demo
        actions={
          <>
            <Button variant="outline" onClick={() => setCards(!cards)}>
              {cards ? <List className="size-4" /> : <LayoutGrid className="size-4" />}
              {cards ? "Table View" : "Card View"}
            </Button>
            {can("stock", "export") && (
              <Button
                variant="outline"
                onClick={() =>
                  downloadCsv("vehicles.csv", [
                    ["รหัส", "รุ่น", "VIN", "สาขา", "ราคา", "สถานะ"],
                    ...rows.map((v) => [
                      v.code,
                      v.model,
                      v.vin,
                      branchName(v.branchId),
                      v.price,
                      STOCK_STATUS[v.status][0],
                    ]),
                  ])
                }
              >
                <Download className="size-4" /> Export CSV
              </Button>
            )}
          </>
        }
      />
      {cards ? (
        <>
          <div className="mb-4 flex flex-wrap gap-2 rounded-md border bg-card p-3">{filters}</div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((v) => (
              <Panel key={v.id} bodyClass="p-0">
                <img src={carImage(v)} alt={v.model} className="h-40 w-full object-cover" />
                <div className="space-y-3 p-4">
                  <div className="flex justify-between gap-2">
                    <h2 className="text-sm font-semibold">{v.model}</h2>
                    <StatusBadge tone={STOCK_STATUS[v.status][1]}>
                      {STOCK_STATUS[v.status][0]}
                    </StatusBadge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {v.color} · {v.year} · {branchName(v.branchId)}
                    <br />
                    VIN {v.vin}
                  </div>
                  <div className="text-xl font-semibold">{thb(v.price)}</div>
                  {v.bonus && (
                    <p className="text-sm text-primary">
                      Bonus {thb(v.bonus.amount)} · {v.bonus.condition}
                    </p>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {v.status === "incoming"
                      ? `คาดรับเข้า ${thDate(v.expectedAt)}`
                      : `อายุรถ ${age(v)} วัน`}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setSelected(v.id)}>
                      รายละเอียด
                    </Button>
                    {can("booking", "create") && v.status === "available" && v.ready && (
                      <Button
                        size="sm"
                        onClick={() => navigate({ to: "/bookings", search: { vehicle: v.id } })}
                      >
                        สร้างการจอง
                      </Button>
                    )}
                  </div>
                </div>
              </Panel>
            ))}
          </div>
          {!rows.length && (
            <EmptyState
              title="สินค้าหมดในสาขานี้หรือไม่ตรงกับตัวกรอง"
              hint="เลือกทุกสาขาที่มีสิทธิ์เพื่อดูรถสาขาอื่นและรถรอรับเข้า"
            />
          )}
        </>
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          onRowClick={(v) => setSelected(v.id)}
          toolbar={filters}
          emptyTitle="สินค้าหมดในสาขานี้หรือไม่ตรงกับตัวกรอง"
        />
      )}
      <DetailDrawer
        open={!!selectedCar}
        onOpenChange={(o) => !o && setSelected(null)}
        title={selectedCar?.model ?? "รถ"}
        description="ข้อมูลรถและความพร้อมขาย"
      >
        {selectedCar && (
          <>
            <VehicleInfo vehicle={selectedCar} />
            <Button asChild variant="outline">
              <Link to="/stock/$id" params={{ id: selectedCar.id }}>
                เปิดรายละเอียดเต็ม
              </Link>
            </Button>
            {can("booking", "create") &&
              selectedCar.status === "available" &&
              selectedCar.ready && (
                <Button asChild>
                  <Link to="/bookings" search={{ vehicle: selectedCar.id }}>
                    สร้างการจองจากรถคันนี้
                  </Link>
                </Button>
              )}
          </>
        )}
      </DetailDrawer>
    </>
  );
}

function VehicleInfo({ vehicle: v }: { vehicle: Vehicle }) {
  const { branchName, sensitive } = useStore();
  return (
    <>
      <img src={carImage(v)} alt={v.model} className="mb-4 h-44 w-full rounded-sm object-cover" />
      <div className="grid grid-cols-2 gap-4">
        <Field label="VIN">{v.vin}</Field>
        <Field label="สี / ปี">
          {v.color} / {v.year}
        </Field>
        <Field label="สาขาปัจจุบัน">{branchName(v.branchId)}</Field>
        <Field label="ราคาขาย">{thb(v.price)}</Field>
        {sensitive && (
          <>
            <Field label="ต้นทุน">{thb(v.cost)}</Field>
            <Field label="Margin">{thb(v.price - v.cost)}</Field>
          </>
        )}
        <Field label="สถานะ">
          <StatusBadge tone={STOCK_STATUS[v.status][1]}>{STOCK_STATUS[v.status][0]}</StatusBadge>
        </Field>
        <Field label="ความพร้อม">{v.ready ? "พร้อม" : (v.readyNote ?? "ยังไม่พร้อม")}</Field>
        <Field label="วันที่รับเข้า">
          {v.status === "incoming" ? `คาดเข้า ${thDate(v.expectedAt)}` : thDate(v.receivedAt)}
        </Field>
        <Field label="อายุรถ">{age(v)} วัน</Field>
        {v.bonus && (
          <>
            <Field label="Bonus">
              {thb(v.bonus.amount)} · ถึง {thDate(v.bonus.until)}
            </Field>
            <Field label="เงื่อนไข Bonus">{v.bonus.condition}</Field>
          </>
        )}
      </div>
    </>
  );
}

export function VehicleDetail({ id }: { id: string }) {
  const { state, inScope } = useStore();
  const v = state.vehicles.find((x) => x.id === id);
  if (!v || !inScope(v)) return <EmptyState title="ไม่พบรถหรือไม่มีสิทธิ์ดูข้อมูล" />;
  const bookings = state.bookings.filter((b) => b.vehicleId === id && inScope(b));
  return (
    <>
      <PageHeader title={v.model} subtitle={`${v.code} · VIN ${v.vin}`} demo />
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="ข้อมูลรถ">
          <VehicleInfo vehicle={v} />
        </Panel>
        <Panel title="ประวัติรับเข้าและโอน">
          <Timeline
            items={v.history.map((h) => ({ at: h.at, title: h.text, sub: thDateTime(h.at) }))}
          />
        </Panel>
        <Panel title="Booking ที่เกี่ยวข้อง">
          {bookings.map((b) => (
            <div key={b.id} className="flex justify-between border-b py-2">
              <Link to="/bookings/$id" params={{ id: b.id }} className="text-primary">
                {b.id}
              </Link>
              <StatusBadge tone={BOOKING_STATUS[b.status][1]}>
                {BOOKING_STATUS[b.status][0]}
              </StatusBadge>
            </div>
          ))}
          {!bookings.length && <EmptyState title="ยังไม่มีการจอง" />}
        </Panel>
        <Panel title="Service Orders & Checklist">
          {state.serviceOrders
            .filter((s) => s.vehicleId === id)
            .map((s) => (
              <div key={s.id} className="flex justify-between border-b py-2 text-sm">
                <Link to="/stock/service-orders" className="text-primary">
                  {s.id} · {s.type}
                </Link>
                <StatusBadge tone={SO_STATUS[s.status][1]}>{SO_STATUS[s.status][0]}</StatusBadge>
              </div>
            ))}
        </Panel>
      </div>
    </>
  );
}

type Transfer = DemoState["transfers"][number];
const TRANSFER_LABEL: Record<Transfer["status"], string> = {
  request: "ขออนุมัติ",
  approved: "อนุมัติแล้ว",
  moving: "กำลังโอน",
  received: "รับแล้ว",
  cancelled: "ยกเลิก",
};
export function StockOperations() {
  const { state, inScope, branchName, can, allowedBranches, user } = useStore();
  const run = useDemoAction();
  const [create, setCreate] = useState(false);
  const [vehicleId, setVehicle] = useState("");
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState("");
  const rows = state.transfers.filter(
    (t) => inScope({ branchId: t.from }) || inScope({ branchId: t.to }),
  );
  const v = state.vehicles.find((x) => x.id === vehicleId);
  return (
    <>
      <PageHeader
        title="Stock Operations"
        subtitle="รับรถเข้า ขอโอน อนุมัติ และยืนยันรับรถที่ปลายทาง"
        demo
        actions={
          can("stock", "create") && (
            <Button onClick={() => setCreate(true)}>
              <Plus className="size-4" /> รับรถใหม่เข้า
            </Button>
          )
        }
      />
      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Panel title="รถรอรับเข้า">
          {state.vehicles
            .filter(inScope)
            .filter((v) => v.status === "incoming")
            .map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-3 border-b py-3">
                <div className="text-sm">
                  {v.model}
                  <div className="text-xs text-muted-foreground">
                    {v.vin} · คาดเข้า {thDate(v.expectedAt)}
                  </div>
                </div>
                <ConfirmAction
                  disabled={!can("stock", "edit")}
                  description={`ยืนยันตรวจรับ ${v.model} และ Checklist รับรถ`}
                  onConfirm={() =>
                    run("stock", "edit", "Vehicle", v, "รับรถเข้าแล้ว", (d) =>
                      receiveVehicle(d, v.id),
                    )
                  }
                >
                  ยืนยันตรวจรับ
                </ConfirmAction>
              </div>
            ))}
        </Panel>
        <Panel title="ขอโอนรถระหว่างสาขา">
          <div className="space-y-3">
            <Label>รถพร้อมขาย</Label>
            <Select value={vehicleId} onValueChange={setVehicle}>
              <SelectTrigger>
                <SelectValue placeholder="เลือกรถ" />
              </SelectTrigger>
              <SelectContent>
                {state.vehicles
                  .filter(inScope)
                  .filter((v) => v.status === "available" && v.ready)
                  .map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.code} · {v.model}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Label>สาขาปลายทาง</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger>
                <SelectValue placeholder="เลือกปลายทาง" />
              </SelectTrigger>
              <SelectContent>
                {state.branches
                  .filter((b) => b.id !== v?.branchId)
                  .map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Input
              aria-label="เหตุผลขอโอน"
              placeholder="เหตุผลขอโอน"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <Button
              disabled={!v || !target || !can("stock", "create")}
              onClick={() => {
                if (
                  v &&
                  run("stock", "create", "Vehicle", v, "ส่งคำขอโอนแล้ว", (d) =>
                    requestTransfer(d, v.id, target, reason, user.name),
                  )
                ) {
                  setVehicle("");
                  setReason("");
                }
              }}
            >
              ส่งคำขอโอน
            </Button>
          </div>
        </Panel>
      </div>
      <DataTable
        rows={rows}
        searchText={(t) => `${t.id} ${t.vehicleId} ${t.reason}`}
        columns={[
          { key: "id", header: "เลขที่โอน", cell: (t) => t.id, sort: (t) => t.id },
          {
            key: "v",
            header: "รถ",
            cell: (t) => state.vehicles.find((v) => v.id === t.vehicleId)?.model,
          },
          {
            key: "branches",
            header: "ต้นทาง → ปลายทาง",
            cell: (t) => `${branchName(t.from)} → ${branchName(t.to)}`,
          },
          {
            key: "reason",
            header: "เหตุผล / ผู้ขอ",
            cell: (t) => (
              <div>
                {t.reason}
                <div className="text-xs text-muted-foreground">
                  {t.by} · {thDateTime(t.at)}
                </div>
              </div>
            ),
          },
          {
            key: "status",
            header: "สถานะ",
            cell: (t) => (
              <StatusBadge tone={t.status === "received" ? "success" : "info"}>
                {TRANSFER_LABEL[t.status]}
              </StatusBadge>
            ),
          },
          {
            key: "action",
            header: "ดำเนินการ",
            cell: (t) =>
              !["received", "cancelled"].includes(t.status) && (
                <div className="flex flex-wrap gap-2">
                  <ConfirmAction
                    disabled={
                      !can("stock", t.status === "request" ? "approve" : "edit") ||
                      !allowedBranches.includes(t.status === "moving" ? t.to : t.from)
                    }
                    description={`${t.id}: ${t.status === "moving" ? "ยืนยันรับรถที่ปลายทางและเปลี่ยนสาขาปัจจุบัน" : "ดำเนินการโอนรถ"}`}
                    onConfirm={() =>
                      run(
                        "stock",
                        t.status === "request" ? "approve" : "edit",
                        "Transfer",
                        { id: t.id, branchId: t.status === "moving" ? t.to : t.from },
                        "อัปเดตการโอนรถแล้ว",
                        (d) => advanceTransfer(d, t.id, user.name, allowedBranches),
                      )
                    }
                  >
                    {t.status === "request"
                      ? "อนุมัติ"
                      : t.status === "approved"
                        ? "ส่งรถ"
                        : "ปลายทางรับรถ"}
                  </ConfirmAction>
                  {["request", "approved"].includes(t.status) && (
                    <ConfirmAction
                      variant="outline"
                      disabled={!can("stock", "approve") || !allowedBranches.includes(t.from)}
                      description={`ยกเลิกคำขอโอน ${t.id} ก่อนส่งรถ`}
                      onConfirm={() =>
                        run(
                          "stock",
                          "approve",
                          "Transfer",
                          { id: t.id, branchId: t.from },
                          "ยกเลิกคำขอโอนแล้ว",
                          (d) => advanceTransfer(d, t.id, user.name, allowedBranches, true),
                        )
                      }
                    >
                      ยกเลิกคำขอ
                    </ConfirmAction>
                  )}
                </div>
              ),
          },
        ]}
      />
      {create && <VehicleReceiver onClose={() => setCreate(false)} />}
    </>
  );
}

function VehicleReceiver({ onClose }: { onClose: () => void }) {
  const { state, allowedBranches, sensitive } = useStore();
  const run = useDemoAction();
  const [form, setForm] = useState({
    model: "",
    vin: "",
    color: "",
    price: "",
    cost: "",
    year: String(new Date().getFullYear()),
    branchId: allowedBranches[0] ?? "",
  });
  const [checked, setChecked] = useState(false);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>รับรถเข้า</DialogTitle>
          <DialogDescription>ระบุข้อมูลรถและตรวจ Checklist ก่อนรับเข้า</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              "model",
              "vin",
              "color",
              "year",
              "price",
              ...(sensitive ? ["cost"] : []),
            ] as (keyof typeof form)[]
          ).map((key) => (
            <div key={key}>
              <Label htmlFor={`receive-${key}`}>
                {
                  {
                    model: "รุ่นรถ",
                    vin: "VIN (17 ตัวอักษร)",
                    color: "สี",
                    year: "ปี",
                    price: "ราคาขาย",
                    cost: "ต้นทุน",
                    branchId: "สาขา",
                  }[key]
                }
              </Label>
              <Input
                id={`receive-${key}`}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </div>
          ))}
        </div>
        <Select value={form.branchId} onValueChange={(branchId) => setForm({ ...form, branchId })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {state.branches
              .filter((b) => allowedBranches.includes(b.id))
              .map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <label className="flex gap-2 text-sm">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />{" "}
          ตรวจสภาพรถ เอกสาร และ VIN ตรงกับรถที่รับเข้าแล้ว
        </label>
        <Button
          disabled={!checked}
          onClick={() => {
            if (
              run(
                "stock",
                "create",
                "Vehicle",
                { id: refId("VIN"), branchId: form.branchId },
                "รับรถใหม่เข้าสต็อกแล้ว",
                (d) => {
                  const id = addVehicle(d, {
                    ...form,
                    price: Number(form.price),
                    cost: Number(form.cost),
                    year: Number(form.year),
                  });
                  notify(d, `received:${id}`, {
                    type: "Stock",
                    title: "รถใหม่พร้อมขาย",
                    detail: form.model,
                    link: `/stock/${id}`,
                    branchId: form.branchId,
                    assignee: "stock",
                    priority: "low",
                  });
                },
              )
            )
              onClose();
          }}
        >
          ยืนยันรับรถเข้า
        </Button>
      </DialogContent>
    </Dialog>
  );
}
