import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { daysBetween, daysFromToday, refId, thDateTime, thDate, localDateTime } from "@/lib/format";
import {
  finishService,
  matchPlate,
  unmatchPlate,
  returnPlate,
  transferPlate,
  receivePlateTransfer,
  notify,
  requireRecord,
} from "@/lib/mock/service";
import { PLATE_STATUS, SO_STATUS } from "@/lib/labels";
import type { ServiceOrder } from "@/lib/mock/types";
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
} from "./ui-kit";
import { ConfirmAction, useDemoAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function ServiceOrders() {
  const { state, inScope, branchName, can, user } = useStore();
  const run = useDemoAction();
  const [period, setPeriod] = useState("all");
  const [branch, setBranch] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [create, setCreate] = useState(false);
  const order = state.serviceOrders.find((s) => s.id === selected);
  const rows = state.serviceOrders
    .filter(inScope)
    .filter(
      (s) =>
        (branch === "all" || s.branchId === branch) &&
        (period === "all" ||
          (period === "today"
            ? daysFromToday(s.due) === 0
            : period === "tomorrow"
              ? daysFromToday(s.due) === 1
              : s.status !== "done" && daysFromToday(s.due) < 0)),
    );
  return (
    <>
      <PageHeader
        title="Service Orders"
        subtitle="งานดูแลรถวันนี้ วันพรุ่งนี้ และงานเกินกำหนด"
        demo
        actions={
          can("stock", "create") && (
            <Button onClick={() => setCreate(true)}>
              <Plus className="size-4" /> สร้างงานดูแลรถ
            </Button>
          )
        }
      />
      <DataTable
        rows={rows}
        searchText={(s) =>
          `${s.id} ${s.type} ${s.assignee} ${state.vehicles.find((v) => v.id === s.vehicleId)?.model}`
        }
        onRowClick={(s) => setSelected(s.id)}
        toolbar={
          <>
            <FilterSelect
              value={branch}
              onChange={setBranch}
              placeholder="สาขา"
              options={state.branches.map((b) => ({ value: b.id, label: b.short }))}
            />
            <FilterSelect
              value={period}
              onChange={setPeriod}
              placeholder="วันครบกำหนด"
              options={[
                { value: "today", label: "วันนี้" },
                { value: "tomorrow", label: "พรุ่งนี้" },
                { value: "overdue", label: "เกินกำหนด" },
              ]}
            />
          </>
        }
        columns={[
          {
            key: "id",
            header: "Service Order",
            cell: (s) => <span className="text-primary">{s.id}</span>,
            sort: (s) => s.id,
          },
          {
            key: "car",
            header: "รถ / ประเภทงาน",
            cell: (s) => (
              <div>
                {state.vehicles.find((v) => v.id === s.vehicleId)?.model}
                <div className="text-xs text-muted-foreground">{s.type}</div>
              </div>
            ),
          },
          { key: "branch", header: "สาขา", cell: (s) => branchName(s.branchId) },
          { key: "due", header: "ครบกำหนด", cell: (s) => thDateTime(s.due), sort: (s) => s.due },
          { key: "assignee", header: "ผู้รับผิดชอบ", cell: (s) => s.assignee },
          {
            key: "check",
            header: "Checklist",
            cell: (s) => `${s.items.filter((i) => i.done).length} / ${s.items.length}`,
          },
          {
            key: "status",
            header: "สถานะ",
            cell: (s) => (
              <StatusBadge tone={SO_STATUS[s.status][1]}>{SO_STATUS[s.status][0]}</StatusBadge>
            ),
          },
        ]}
      />
      <DetailDrawer
        open={!!order}
        onOpenChange={(o) => !o && setSelected(null)}
        title={order?.id ?? "Service Order"}
        description="ตรวจ Checklist และบันทึกผู้ตรวจรับ"
      >
        {order && (
          <>
            <Link to="/stock/$id" params={{ id: order.vehicleId }} className="text-primary">
              เปิดข้อมูลรถ
            </Link>
            <div className="space-y-3">
              <Label>ผู้รับผิดชอบ</Label>
              <Input
                aria-label="ผู้รับผิดชอบงานดูแลรถ"
                key={order.id}
                defaultValue={order.assignee}
                disabled={!can("stock", "edit") || order.status === "done"}
                onBlur={(e) =>
                  e.target.value !== order.assignee &&
                  run("stock", "edit", "ServiceOrder", order, "อัปเดตผู้รับผิดชอบแล้ว", (d) => {
                    if (!e.target.value.trim()) throw new Error("ต้องระบุผู้รับผิดชอบ");
                    d.serviceOrders.find((s) => s.id === order.id)!.assignee = e.target.value;
                  })
                }
              />
              <Label>วันครบกำหนด</Label>
              <Input
                type="datetime-local"
                aria-label="วันครบกำหนด Service Order"
                defaultValue={localDateTime(order.due)}
                disabled={!can("stock", "edit") || order.status === "done"}
                onBlur={(e) => {
                  if (e.target.value && new Date(e.target.value).toISOString() !== order.due)
                    run("stock", "edit", "ServiceOrder", order, "เลื่อนนัดงานดูแลรถแล้ว", (d) => {
                      d.serviceOrders.find((s) => s.id === order.id)!.due = new Date(
                        e.target.value,
                      ).toISOString();
                      d.tasks
                        .filter((t) => t.serviceOrderId === order.id)
                        .forEach((t) => {
                          t.date = new Date(e.target.value).toISOString();
                        });
                    });
                }}
              />
            </div>
            <div className="space-y-3">
              {order.items.map((item, index) => (
                <div key={item.name} className="rounded-sm border p-3">
                  <label className="flex gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={item.done}
                      disabled={!can("stock", "edit") || order.status === "done"}
                      onChange={(e) =>
                        run(
                          "stock",
                          "edit",
                          "ServiceOrder",
                          order,
                          "อัปเดต Checklist แล้ว",
                          (d) => {
                            const s = d.serviceOrders.find((x) => x.id === order.id)!;
                            const i = s.items[index]!;
                            i.done = e.target.checked;
                            if (i.done) i.doneAt = new Date().toISOString();
                            else delete i.doneAt;
                            s.status = "doing";
                          },
                        )
                      }
                    />
                    {item.name}
                  </label>
                  <Input
                    aria-label={`หมายเหตุ ${item.name}`}
                    className="mt-2"
                    defaultValue={item.note ?? ""}
                    placeholder="หมายเหตุ / หลักฐานตัวอย่าง"
                    disabled={!can("stock", "edit") || order.status === "done"}
                    onBlur={(e) => {
                      if (e.target.value !== (item.note ?? ""))
                        run(
                          "stock",
                          "edit",
                          "ServiceOrder",
                          order,
                          "บันทึกหลักฐาน Checklist แล้ว",
                          (d) => {
                            d.serviceOrders.find((s) => s.id === order.id)!.items[index]!.note =
                              e.target.value;
                          },
                        );
                    }}
                  />
                  {item.doneAt && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      เสร็จ {thDateTime(item.doneAt)} · ผู้ตรวจรับ {item.checker ?? "รอตรวจรับ"}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <ConfirmAction
              disabled={!can("stock", "edit") || order.status === "done"}
              description={`ตรวจรับงาน ${order.id} เมื่อ Checklist ครบ`}
              onConfirm={() =>
                run("stock", "edit", "ServiceOrder", order, "ตรวจรับงานดูแลรถแล้ว", (d) =>
                  finishService(d, order.id, user.name),
                )
              }
            >
              ยืนยันตรวจรับงาน
            </ConfirmAction>
          </>
        )}
      </DetailDrawer>
      {create && <ServiceCreator onClose={() => setCreate(false)} />}
    </>
  );
}
function ServiceCreator({ onClose }: { onClose: () => void }) {
  const { state, inScope } = useStore();
  const run = useDemoAction();
  const [vehicle, setVehicle] = useState("");
  const [assignee, setAssignee] = useState("");
  const [due, setDue] = useState(localDateTime(new Date().toISOString()));
  const [type, setType] = useState("เตรียมรถก่อนส่งมอบ");
  const v = state.vehicles.find((x) => x.id === vehicle);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>สร้าง Service Order</DialogTitle>
          <DialogDescription>เชื่อมกับรถและงานบน Dashboard</DialogDescription>
        </DialogHeader>
        <Select value={vehicle} onValueChange={setVehicle}>
          <SelectTrigger>
            <SelectValue placeholder="เลือกรถ" />
          </SelectTrigger>
          <SelectContent>
            {state.vehicles
              .filter(inScope)
              .filter((v) => !["sold", "incoming", "transfer"].includes(v.status))
              .map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.model} · {v.code}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Input aria-label="ประเภทงาน" value={type} onChange={(e) => setType(e.target.value)} />
        <Input
          aria-label="ผู้รับผิดชอบ"
          placeholder="ผู้รับผิดชอบ"
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
        />
        <Input
          aria-label="นัดหมายงานดูแลรถ"
          type="datetime-local"
          value={due}
          onChange={(e) => setDue(e.target.value)}
        />
        <Button
          disabled={!v}
          onClick={() => {
            if (
              v &&
              run(
                "stock",
                "create",
                "ServiceOrder",
                { id: refId("SO"), branchId: v.branchId },
                "สร้างงานดูแลรถแล้ว",
                (d) => {
                  if (
                    !assignee.trim() ||
                    !type.trim() ||
                    !due ||
                    !Number.isFinite(new Date(due).getTime())
                  )
                    throw new Error("กรุณาระบุผู้รับผิดชอบ ประเภท และวันนัดหมาย");
                  const id = refId("SO");
                  const date = new Date(due).toISOString();
                  d.serviceOrders.push({
                    id,
                    vehicleId: v.id,
                    branchId: v.branchId,
                    type,
                    assignee,
                    due: date,
                    status: "todo",
                    items: [
                      "ตรวจสภาพรถ",
                      "ตรวจยางและแรงดันลม",
                      "ทำความสะอาด",
                      "ตรวจความพร้อมก่อนส่งมอบ",
                    ].map((name) => ({ name, done: false })),
                  });
                  const bk = d.bookings.find((b) => b.vehicleId === v.id && b.status === "active");
                  d.tasks.push({
                    id: refId("T"),
                    type: "prep",
                    title: `${type} ${v.model}`,
                    date,
                    vehicleId: v.id,
                    serviceOrderId: id,
                    ...(bk ? { bookingId: bk.id, customerId: bk.customerId } : {}),
                    assignee:
                      bk?.salesId ??
                      d.sales.find((s) => s.branchId === v.branchId)?.id ??
                      "service",
                    branchId: v.branchId,
                    status: "todo",
                  });
                  const car = d.vehicles.find((x) => x.id === v.id)!;
                  car.ready = false;
                  car.readyNote = "รอ Service Order";
                  notify(d, `service:${id}`, {
                    type: "Service",
                    title: "มีงานดูแลรถใหม่",
                    detail: `${id} · ${type}`,
                    link: "/stock/service-orders",
                    branchId: v.branchId,
                    assignee: "service",
                    priority: "medium",
                  });
                },
              )
            )
              onClose();
          }}
        >
          สร้างงาน
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export function RedPlates() {
  const { state, inScope, branchName, salesName, can, user, allowedBranches, sensitive } =
    useStore();
  const run = useDemoAction();
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [booking, setBooking] = useState("");
  const [reason, setReason] = useState("");
  const [target, setTarget] = useState("");
  const [create, setCreate] = useState(false);
  const [number, setNumber] = useState("");
  const [province, setProvince] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const p = state.plates.find((x) => x.id === selected);
  const bookingFor = (id?: string) => state.bookings.find((b) => b.id === id);
  const scope = (plate: (typeof state.plates)[number]) => {
    const b = bookingFor(plate.bookingId ?? plate.previousBookingId);
    return { id: plate.id, branchId: plate.branchId, ...(b ? { salesId: b.salesId } : {}) };
  };
  const plates = state.plates
    .filter((x) => inScope(scope(x)) || (!!x.transferTo && inScope({ branchId: x.transferTo })))
    .filter((x) => status === "all" || x.status === status);
  const overdue = plates.filter(
    (x) =>
      x.status === "matched" &&
      x.borrowedAt &&
      daysBetween(x.borrowedAt, new Date().toISOString()) >= state.plateFollowDays,
  );
  const registered = plates.filter((x) => x.status === "matched" && x.registeredAt);
  const table = (rows: typeof plates) => (
    <DataTable
      rows={rows}
      searchText={(x) =>
        `${x.id} ${x.number} ${bookingFor(x.bookingId)?.id} ${state.customers.find((c) => c.id === bookingFor(x.bookingId)?.customerId)?.name}`
      }
      onRowClick={(x) => {
        setSelected(x.id);
        setReason("");
        setBooking("");
        setTarget("");
      }}
      columns={[
        {
          key: "id",
          header: "ป้ายแดง",
          cell: (x) => (
            <div className="font-medium text-primary">
              {x.number}
              <div className="text-xs text-muted-foreground">
                {x.id} · {x.province ?? branchName(x.branchId)}
              </div>
            </div>
          ),
          sort: (x) => x.number,
        },
        {
          key: "branch",
          header: "สาขาเจ้าของ / ที่เก็บ",
          cell: (x) => `${branchName(x.ownerBranchId ?? x.branchId)} / ${branchName(x.branchId)}`,
        },
        {
          key: "customer",
          header: "ลูกค้า / รถ / Sales",
          cell: (x) => {
            const b = bookingFor(x.bookingId ?? x.previousBookingId);
            const c = state.customers.find((c) => c.id === b?.customerId);
            return b && inScope(b) ? (
              <div>
                {c?.name}
                <div className="text-xs text-muted-foreground">
                  {c && (sensitive ? c.phone : `${c.phone.slice(0, 3)}-xxx-${c.phone.slice(-4)}`)} ·{" "}
                  {salesName(b.salesId)}
                </div>
                <Link to="/bookings/$id" params={{ id: b.id }} className="text-primary">
                  {b.id}
                </Link>
              </div>
            ) : (
              "—"
            );
          },
        },
        {
          key: "days",
          header: "ยืม / ครบกำหนด / เกิน",
          cell: (x) =>
            x.borrowedAt ? (
              <div>
                {thDate(x.borrowedAt)}
                <div className="text-xs text-muted-foreground">
                  ครบ{" "}
                  {thDate(
                    new Date(
                      new Date(x.borrowedAt).getTime() + state.plateFollowDays * 86400000,
                    ).toISOString(),
                  )}{" "}
                  · เกิน{" "}
                  {Math.max(
                    0,
                    daysBetween(x.borrowedAt, new Date().toISOString()) - state.plateFollowDays,
                  )}{" "}
                  วัน
                </div>
              </div>
            ) : (
              "—"
            ),
        },
        {
          key: "status",
          header: "สถานะ",
          cell: (x) => (
            <StatusBadge tone={PLATE_STATUS[x.status][1]}>{PLATE_STATUS[x.status][0]}</StatusBadge>
          ),
        },
        {
          key: "follow",
          header: "ติดตามล่าสุด",
          cell: (x) => (
            <div>
              {x.follow ?? "—"}
              <div className="text-xs text-muted-foreground">
                {thDateTime(x.lastContact)} · นัดคืน {thDate(x.appointment)}
              </div>
            </div>
          ),
        },
      ]}
    />
  );
  return (
    <>
      <PageHeader
        title="Red Plate Management"
        subtitle="จับคู่ป้าย โอนสาขา ติดตามคืน และตรวจรับป้ายจริง"
        demo
        actions={
          can("stock", "create") && (
            <Button
              onClick={() => {
                setEditingId(null);
                setNumber("");
                setProvince("");
                setTarget("");
                setCreate(true);
              }}
            >
              <Plus className="size-4" /> เพิ่ม Master Data
            </Button>
          )
        }
      />
      <div className="mb-4 flex gap-3">
        <FilterSelect
          value={status}
          onChange={setStatus}
          placeholder="สถานะป้าย"
          options={Object.entries(PLATE_STATUS).map(([value, [label]]) => ({ value, label }))}
        />
        <span className="self-center text-xs text-muted-foreground">
          ติดตามเมื่อครบ {state.plateFollowDays} วัน
        </span>
      </div>
      <Tabs defaultValue="master">
        <TabsList className="mb-4">
          <TabsTrigger value="master">Master Data</TabsTrigger>
          <TabsTrigger value="overdue">
            ครบกำหนด {state.plateFollowDays} วัน ({overdue.length})
          </TabsTrigger>
          <TabsTrigger value="registered">
            จดทะเบียนแล้ว ยังไม่คืน ({registered.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="master">{table(plates)}</TabsContent>
        <TabsContent value="overdue">{table(overdue)}</TabsContent>
        <TabsContent value="registered">{table(registered)}</TabsContent>
      </Tabs>
      <DetailDrawer
        open={!!p}
        onOpenChange={(o) => !o && setSelected(null)}
        title={p?.number ?? "ป้ายแดง"}
        description="Un-Matching ไม่ใช่การยืนยันรับคืนจริง"
      >
        {p && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Field label="สถานะ">
                <StatusBadge tone={PLATE_STATUS[p.status][1]}>
                  {PLATE_STATUS[p.status][0]}
                </StatusBadge>
              </Field>
              <Field label="สาขาที่เก็บ">{branchName(p.branchId)}</Field>
              <Field label="วันที่ยืม">{thDate(p.borrowedAt)}</Field>
              <Field label="จดทะเบียนสำเร็จ">{thDate(p.registeredAt)}</Field>
            </div>
            {can("stock", "edit") && (
              <div className="space-y-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingId(p.id);
                    setNumber(p.number);
                    setProvince(p.province ?? "");
                    setTarget(p.ownerBranchId ?? p.branchId);
                    setCreate(true);
                  }}
                >
                  แก้ไข Master Data
                </Button>
                {p.status === "available" && (
                  <>
                    <Label>จับคู่กับ Booking</Label>
                    <Select value={booking} onValueChange={setBooking}>
                      <SelectTrigger>
                        <SelectValue placeholder="เลือก Booking" />
                      </SelectTrigger>
                      <SelectContent>
                        {state.bookings
                          .filter(inScope)
                          .filter(
                            (b) =>
                              b.status === "active" &&
                              !b.refund &&
                              b.branchId === p.branchId &&
                              !state.plates.some((x) => x.bookingId === b.id),
                          )
                          .map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.id} · {state.customers.find((c) => c.id === b.customerId)?.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <ConfirmAction
                      disabled={!booking}
                      description={`จับคู่ ${p.number} กับ ${booking}`}
                      onConfirm={() =>
                        run("stock", "edit", "RedPlate", scope(p), "จับคู่ป้ายแดงแล้ว", (d) =>
                          matchPlate(d, p.id, booking, user.name),
                        )
                      }
                    >
                      Matching
                    </ConfirmAction>
                    <Label>โอนป้ายไปสาขา</Label>
                    <Select value={target} onValueChange={setTarget}>
                      <SelectTrigger>
                        <SelectValue placeholder="เลือกปลายทาง" />
                      </SelectTrigger>
                      <SelectContent>
                        {state.branches
                          .filter((b) => b.id !== p.branchId)
                          .map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <ConfirmAction
                      disabled={!target}
                      description="ส่งป้ายไปปลายทาง โดยยังไม่เปลี่ยนสาขาจนตรวจรับ"
                      onConfirm={() =>
                        run("stock", "edit", "RedPlate", scope(p), "ส่งป้ายระหว่างสาขาแล้ว", (d) =>
                          transferPlate(d, p.id, target, user.name),
                        )
                      }
                    >
                      โอนป้าย
                    </ConfirmAction>
                  </>
                )}
                {p.status === "matched" && (
                  <>
                    <Input
                      aria-label="รายละเอียดติดตามป้าย"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="รายละเอียดการติดตาม / เหตุผล"
                    />
                    <Button
                      variant="outline"
                      onClick={() =>
                        run(
                          "stock",
                          "edit",
                          "RedPlate",
                          scope(p),
                          "บันทึกติดตามป้ายแดงแล้ว",
                          (d) => {
                            if (reason.trim().length < 5)
                              throw new Error("ระบุรายละเอียดอย่างน้อย 5 ตัวอักษร");
                            const x = d.plates.find((x) => x.id === p.id)!;
                            x.follow = reason;
                            x.lastContact = new Date().toISOString();
                            x.history ??= [];
                            x.history.unshift({ at: x.lastContact, by: user.name, text: reason });
                          },
                        )
                      }
                    >
                      บันทึกการติดตาม
                    </Button>
                    <Label>นัดคืนป้าย</Label>
                    <Input
                      type="date"
                      aria-label="นัดคืนป้าย"
                      defaultValue={p.appointment?.slice(0, 10)}
                      onChange={(e) => {
                        if (e.target.value)
                          run("stock", "edit", "RedPlate", scope(p), "นัดคืนป้ายแล้ว", (d) => {
                            const x = d.plates.find((x) => x.id === p.id)!;
                            x.appointment = new Date(e.target.value + "T10:00").toISOString();
                            const b = requireRecord(
                              d.bookings,
                              (b) => b.id === x.bookingId,
                              "Booking",
                            );
                            const task = d.tasks.find(
                              (t) =>
                                t.type === "plate" && t.bookingId === b.id && t.status !== "done",
                            );
                            if (task) task.date = x.appointment;
                            else
                              d.tasks.push({
                                id: refId("T"),
                                type: "plate",
                                title: `นัดคืน ${x.number}`,
                                date: x.appointment,
                                customerId: b.customerId,
                                bookingId: b.id,
                                assignee: b.salesId,
                                branchId: b.branchId,
                                status: "todo",
                              });
                            notify(d, `plate-appointment:${p.id}:${x.appointment}`, {
                              type: "RedPlate",
                              title: "นัดคืนป้ายแดง",
                              detail: x.number,
                              link: "/stock/red-plates",
                              branchId: b.branchId,
                              assignee: b.salesId,
                              priority: "medium",
                            });
                          });
                      }}
                    />
                    <ConfirmAction
                      description="Un-Matching โดยป้ายยังรอตรวจรับคืนและยังไม่พร้อมใช้"
                      onConfirm={() =>
                        run(
                          "stock",
                          "edit",
                          "RedPlate",
                          scope(p),
                          "Un-Matching แล้ว รอตรวจรับคืน",
                          (d) => unmatchPlate(d, p.id, reason, user.name),
                        )
                      }
                    >
                      Un-Matching
                    </ConfirmAction>
                    {!p.registeredAt && (
                      <Button
                        variant="outline"
                        onClick={() =>
                          run(
                            "stock",
                            "edit",
                            "RedPlate",
                            scope(p),
                            "บันทึกจดทะเบียนสำเร็จแล้ว",
                            (d) => {
                              d.plates.find((x) => x.id === p.id)!.registeredAt =
                                new Date().toISOString();
                            },
                          )
                        }
                      >
                        บันทึกจดทะเบียนสำเร็จ
                      </Button>
                    )}
                  </>
                )}
                {["matched", "checking"].includes(p.status) && (
                  <ConfirmAction
                    description="ยืนยันได้รับป้ายจริง ตรวจสภาพครบ และเปลี่ยนป้ายเป็นพร้อมใช้"
                    onConfirm={() =>
                      run("stock", "edit", "RedPlate", scope(p), "ตรวจรับคืนป้ายแดงแล้ว", (d) =>
                        returnPlate(d, p.id, user.name),
                      )
                    }
                  >
                    ยืนยันรับคืนจริง
                  </ConfirmAction>
                )}
                {p.status === "transfer" && (
                  <ConfirmAction
                    disabled={!p.transferTo || !allowedBranches.includes(p.transferTo)}
                    description="ปลายทางยืนยันได้รับป้ายที่โอนแล้ว"
                    onConfirm={() =>
                      run(
                        "stock",
                        "edit",
                        "RedPlate",
                        { id: p.id, branchId: p.transferTo! },
                        "ตรวจรับป้ายที่โอนแล้ว",
                        (d) => receivePlateTransfer(d, p.id, user.name, allowedBranches),
                      )
                    }
                  >
                    ปลายทางรับป้าย
                  </ConfirmAction>
                )}
                {["available", "matched"].includes(p.status) && (
                  <>
                    <Input
                      aria-label="เหตุผลแจ้งสูญหาย"
                      placeholder="รายละเอียดการสูญหาย"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                    <ConfirmAction
                      variant="destructive"
                      description="แจ้งป้ายสูญหายและปิดความพร้อมในการจับคู่"
                      onConfirm={() =>
                        run("stock", "edit", "RedPlate", scope(p), "บันทึกป้ายสูญหายแล้ว", (d) => {
                          if (reason.trim().length < 5)
                            throw new Error("ระบุรายละเอียดอย่างน้อย 5 ตัวอักษร");
                          const x = d.plates.find((x) => x.id === p.id)!;
                          x.status = "lost";
                          x.history ??= [];
                          x.history.unshift({
                            at: new Date().toISOString(),
                            by: user.name,
                            text: `สูญหาย: ${reason}`,
                          });
                        })
                      }
                    >
                      แจ้งสูญหาย
                    </ConfirmAction>
                  </>
                )}
              </div>
            )}
            <Panel title="ประวัติการใช้งาน">
              <Timeline
                items={(p.history ?? []).map((h) => ({
                  at: h.at,
                  title: h.text,
                  sub: `${thDateTime(h.at)} · ${h.by}`,
                }))}
              />
            </Panel>
          </>
        )}
      </DetailDrawer>
      <Dialog open={create} onOpenChange={setCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "แก้ไข" : "เพิ่ม"} Master Data ป้ายแดง</DialogTitle>
            <DialogDescription>ใช้หมายเลขตัวอย่างในการกรอกแบบฟอร์ม</DialogDescription>
          </DialogHeader>
          <Input
            aria-label="หมายเลขป้าย"
            placeholder="หมายเลขป้าย"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
          />
          <Input
            aria-label="จังหวัด"
            placeholder="จังหวัด"
            value={province}
            onChange={(e) => setProvince(e.target.value)}
          />
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger>
              <SelectValue placeholder="สาขาเจ้าของ" />
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
          <Button
            onClick={() => {
              if (
                run(
                  "stock",
                  editingId ? "edit" : "create",
                  "RedPlate",
                  {
                    id: editingId ?? refId("RP"),
                    branchId: editingId
                      ? state.plates.find((x) => x.id === editingId)!.branchId
                      : target,
                  },
                  editingId ? "แก้ไข Master Data ป้ายแดงแล้ว" : "เพิ่มป้ายแดงแล้ว",
                  (d) => {
                    if (!number.trim() || !province.trim())
                      throw new Error("ระบุหมายเลขป้ายและจังหวัด");
                    if (!allowedBranches.includes(target))
                      throw new Error("เลือกสาขาเจ้าของที่ได้รับสิทธิ์");
                    if (d.plates.some((p) => p.id !== editingId && p.number === number.trim()))
                      throw new Error("หมายเลขป้ายซ้ำ");
                    if (editingId) {
                      const x = requireRecord(d.plates, (x) => x.id === editingId, "ป้ายแดง");
                      x.number = number.trim();
                      x.province = province.trim();
                      x.ownerBranchId = target;
                      x.history ??= [];
                      x.history.unshift({
                        at: new Date().toISOString(),
                        by: user.name,
                        text: "แก้ไข Master Data",
                      });
                    } else
                      d.plates.push({
                        id: refId("RP"),
                        number: number.trim(),
                        province,
                        branchId: target,
                        ownerBranchId: target,
                        status: "available",
                        history: [],
                      });
                  },
                )
              ) {
                setCreate(false);
                setNumber("");
                setTarget("");
              }
            }}
          >
            บันทึกป้ายแดง
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
