import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalendarCheck, Car, Truck, AlertTriangle, Undo2, CreditCard, BadgeDollarSign, KeyRound, List, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { meta } from "@/lib/meta";
import { useStore } from "@/lib/store";
import { Kpi, PageHeader, Panel, StatusBadge, DetailDrawer, Field, FilterSelect, EmptyState } from "@/components/app/ui-kit";
import { TASK_STATUS, TASK_TYPE } from "@/lib/labels";
import { WORKFLOW_STEPS } from "@/lib/mock/seed";
import { daysFromToday, thDate, thDateTime, startOfToday } from "@/lib/format";
import type { Task, TaskStatus } from "@/lib/mock/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => meta("Dashboard", "ภาพรวมการจอง สต็อก งานค้าง และงานประจำสัปดาห์ตามสาขาและสิทธิ์ผู้ใช้"),
  component: Dashboard,
});

const DOW = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

function Dashboard() {
  const { state, inScope, salesName, branchName, mutate, user } = useStore();
  const navigate = useNavigate();
  const [view, setView] = useState<"list" | "cal">("list");
  const [week, setWeek] = useState(0);
  const [fAssignee, setFAssignee] = useState("all");
  const [fType, setFType] = useState("all");
  const [sel, setSel] = useState<Task | null>(null);

  const bookings = state.bookings.filter(inScope);
  const tasks = state.tasks.filter((t) => inScope({ branchId: t.branchId, salesId: t.assignee }));
  const vehicles = state.vehicles.filter((v) => inScope({ branchId: v.branchId }));
  const commissions = state.commissions.filter((c) => { const b = state.bookings.find((x) => x.id === c.bookingId)!; return inScope(b); });
  const plates = state.plates.filter((p) => p.status === "matched" && inScope({ branchId: p.branchId }));

  const isOverdue = (t: Task) => t.status !== "done" && (t.status === "overdue" || daysFromToday(t.date) < 0);

  const kpis = [
    { label: "การจองที่กำลังดำเนินการ", value: bookings.filter((b) => b.status === "active").length, icon: <CalendarCheck className="size-4" />, to: "/bookings" },
    { label: "รถพร้อมขาย", value: vehicles.filter((v) => v.status === "available" && v.ready).length, icon: <Car className="size-4" />, to: "/stock" },
    { label: "นัด Test Drive (สัปดาห์นี้)", value: tasks.filter((t) => t.type === "testdrive" && daysFromToday(t.date) >= 0 && daysFromToday(t.date) < 7).length, icon: <KeyRound className="size-4" />, to: "/" },
    { label: "นัดส่งมอบรถ", value: tasks.filter((t) => t.type === "delivery" && t.status !== "done").length, icon: <Truck className="size-4" />, to: "/bookings" },
    { label: "งานเกินกำหนด", value: tasks.filter(isOverdue).length, icon: <AlertTriangle className="size-4" />, tone: "danger" as const, to: "/" },
    { label: "คำขอคืนเงินรออนุมัติ", value: bookings.filter((b) => b.refund && b.refund.status === "pending").length, icon: <Undo2 className="size-4" />, tone: "warning" as const, to: "/bookings/refunds" },
    { label: "ป้ายแดงต้องติดตามคืน", value: plates.filter((p) => p.registeredAt || (p.borrowedAt && -daysFromToday(p.borrowedAt) >= state.plateFollowDays)).length, icon: <CreditCard className="size-4" />, tone: "warning" as const, to: "/stock/red-plates" },
    { label: "Commission รอส่งเบิก/อนุมัติ", value: commissions.filter((c) => !["paid"].includes(c.status)).length, icon: <BadgeDollarSign className="size-4" />, to: "/sales/commission" },
  ];

  const weekStart = useMemo(() => { const d = startOfToday(); d.setDate(d.getDate() - d.getDay() + week * 7); return d; }, [week]);
  const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; });
  const weekTasks = tasks
    .filter((t) => { const d = new Date(t.date); return d >= weekStart && d < new Date(weekStart.getTime() + 7 * 86400000); })
    .filter((t) => (fAssignee === "all" || t.assignee === fAssignee) && (fType === "all" || t.type === fType))
    .sort((a, b) => a.date.localeCompare(b.date));

  const today = tasks.filter((t) => daysFromToday(t.date) === 0);
  const tomorrow = tasks.filter((t) => daysFromToday(t.date) === 1);

  const bottleneck = WORKFLOW_STEPS.map((s, i) => ({ step: s, count: bookings.filter((b) => b.status === "active" && b.step === i).length }));
  const maxB = Math.max(1, ...bottleneck.map((b) => b.count));

  const statusOf = (t: Task): TaskStatus => (isOverdue(t) ? "overdue" : t.status);

  const update = (patch: Partial<Task>, action: string) => {
    if (!sel) return;
    mutate((d) => { Object.assign(d.tasks.find((x) => x.id === sel.id)!, patch); }, { branchId: sel.branchId, action, entity: "Task", entityId: sel.id, after: JSON.stringify(patch) });
    setSel({ ...sel, ...patch });
    toast.success("บันทึกแล้ว");
  };

  const TaskRow = ({ t }: { t: Task }) => {
    const c = state.customers.find((x) => x.id === t.customerId);
    const v = state.vehicles.find((x) => x.id === t.vehicleId);
    const [l, tone] = TASK_STATUS[statusOf(t)];
    return (
      <button onClick={() => setSel(t)} className="flex w-full items-center gap-3 border-b px-1 py-2.5 text-left last:border-0 hover:bg-accent/40">
        <div className="w-14 shrink-0 text-xs text-muted-foreground">{new Date(t.date).toTimeString().slice(0, 5)}</div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{t.title}</div>
          <div className="truncate text-xs text-muted-foreground">{TASK_TYPE[t.type]} · {c?.name ?? v?.model ?? "-"} · {salesName(t.assignee)}</div>
        </div>
        <StatusBadge tone={tone}>{l}</StatusBadge>
      </button>
    );
  };

  return (
    <div>
      <PageHeader title={`สวัสดี, ${user.name}`} subtitle={`ภาพรวมวันที่ ${thDate(new Date().toISOString())} · บทบาท ${user.roleName}`} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map((k) => <Kpi key={k.label} label={k.label} value={k.value} icon={k.icon} tone={k.tone} onClick={() => navigate({ to: k.to })} />)}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Panel title={`งานที่ต้องทำวันนี้ (${today.length})`} bodyClass="py-1">
          {today.length ? today.map((t) => <TaskRow key={t.id} t={t} />) : <EmptyState title="ไม่มีงานวันนี้" hint="" />}
        </Panel>
        <Panel title={`งานวันพรุ่งนี้ (${tomorrow.length})`} bodyClass="py-1">
          {tomorrow.length ? tomorrow.map((t) => <TaskRow key={t.id} t={t} />) : <EmptyState title="ไม่มีงานวันพรุ่งนี้" hint="" />}
        </Panel>
        <Panel title="งานคงค้างตามขั้นตอน (Bottleneck)">
          <ul className="space-y-2.5">
            {bottleneck.map((b) => (
              <li key={b.step}>
                <div className="flex justify-between text-xs"><span>{b.step}</span><span className="font-semibold">{b.count}</span></div>
                <div className="mt-1 h-2 rounded-sm bg-muted"><div className={cn("h-2 rounded-sm", b.count === maxB && b.count > 0 ? "bg-destructive" : "bg-primary")} style={{ width: `${(b.count / maxB) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel
        className="mt-5"
        title="To-do List รายสัปดาห์"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="icon" className="size-8" onClick={() => setWeek(week - 1)}><ChevronLeft className="size-4" /></Button>
            <span className="text-xs font-medium">{thDate(weekDays[0].toISOString())} – {thDate(weekDays[6].toISOString())}</span>
            <Button variant="ghost" size="icon" className="size-8" onClick={() => setWeek(week + 1)}><ChevronRight className="size-4" /></Button>
            <FilterSelect value={fAssignee} onChange={setFAssignee} placeholder="ผู้รับผิดชอบ" options={state.sales.map((s) => ({ value: s.id, label: s.name }))} />
            <FilterSelect value={fType} onChange={setFType} placeholder="ประเภทงาน" options={Object.entries(TASK_TYPE).map(([value, label]) => ({ value, label }))} />
            <div className="flex rounded-sm border">
              <Button variant={view === "list" ? "default" : "ghost"} size="sm" className="h-8 rounded-none" onClick={() => setView("list")}><List className="size-4" /> List</Button>
              <Button variant={view === "cal" ? "default" : "ghost"} size="sm" className="h-8 rounded-none" onClick={() => setView("cal")}><CalendarDays className="size-4" /> Calendar</Button>
            </div>
          </div>
        }
      >
        {view === "list" ? (
          weekTasks.length ? (
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-2">วันเวลา</th><th>งาน</th><th>ลูกค้า</th><th>รถ</th><th>ผู้รับผิดชอบ</th><th>สาขา</th><th>สถานะ</th></tr></thead>
              <tbody>
                {weekTasks.map((t) => {
                  const [l, tone] = TASK_STATUS[statusOf(t)];
                  return (
                    <tr key={t.id} onClick={() => setSel(t)} className="cursor-pointer border-b last:border-0 hover:bg-accent/40">
                      <td className="py-2.5 text-xs">{thDateTime(t.date)}</td>
                      <td><div className="font-medium">{t.title}</div><div className="text-xs text-muted-foreground">{TASK_TYPE[t.type]}</div></td>
                      <td>{state.customers.find((c) => c.id === t.customerId)?.name ?? "-"}</td>
                      <td className="text-xs">{state.vehicles.find((v) => v.id === t.vehicleId)?.model ?? "-"}</td>
                      <td>{salesName(t.assignee)}</td>
                      <td className="text-xs">{branchName(t.branchId)}</td>
                      <td><StatusBadge tone={tone}>{l}</StatusBadge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : <EmptyState title="ไม่มีงานในสัปดาห์นี้" />
        ) : (
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-sm border bg-border">
            {weekDays.map((d) => {
              const iso = d.toISOString();
              const isToday = daysFromToday(iso) === 0;
              const list = weekTasks.filter((t) => new Date(t.date).toDateString() === d.toDateString());
              return (
                <div key={iso} className="min-h-48 bg-card p-2">
                  <div className={cn("mb-2 text-xs", isToday ? "font-semibold text-primary" : "text-muted-foreground")}>{DOW[d.getDay()]} {d.getDate()}{isToday && " · วันนี้"}</div>
                  <div className="space-y-1.5">
                    {list.map((t) => {
                      const st = statusOf(t);
                      return (
                        <button key={t.id} onClick={() => setSel(t)} className={cn("w-full rounded-sm border-l-2 bg-muted p-1.5 text-left text-[11px] hover:bg-accent", st === "overdue" ? "border-destructive" : st === "done" ? "border-success" : "border-primary")}>
                          <div className="font-medium leading-tight">{t.title}</div>
                          <div className="text-muted-foreground">{new Date(t.date).toTimeString().slice(0, 5)} · {TASK_STATUS[st][0]}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <DetailDrawer open={!!sel} onOpenChange={(o) => !o && setSel(null)} title={sel?.title} description={sel && `${TASK_TYPE[sel.type]} · ${branchName(sel.branchId)}`}>
        {sel && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Field label="วันเวลา">{thDateTime(sel.date)}</Field>
              <Field label="สถานะ"><StatusBadge tone={TASK_STATUS[statusOf(sel)][1]}>{TASK_STATUS[statusOf(sel)][0]}</StatusBadge></Field>
              <Field label="ลูกค้า">{state.customers.find((c) => c.id === sel.customerId)?.name ?? "-"}</Field>
              <Field label="รถ">{state.vehicles.find((v) => v.id === sel.vehicleId)?.model ?? "-"}</Field>
            </div>
            <div className="space-y-1.5">
              <div className="text-xs text-muted-foreground">เปลี่ยนสถานะ</div>
              <Select value={sel.status} onValueChange={(v) => update({ status: v as TaskStatus }, "เปลี่ยนสถานะงาน")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(TASK_STATUS).map(([k, [l]]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <div className="text-xs text-muted-foreground">มอบหมายให้</div>
              <Select value={sel.assignee} onValueChange={(v) => update({ assignee: v }, "มอบหมายงาน")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{state.sales.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} · {branchName(s.branchId)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <div className="text-xs text-muted-foreground">เลื่อนนัด</div>
              <Input type="datetime-local" defaultValue={sel.date.slice(0, 16)} onBlur={(e) => e.target.value && update({ date: new Date(e.target.value).toISOString(), status: sel.status === "overdue" ? "todo" : sel.status }, "เลื่อนนัด")} />
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              {sel.bookingId && <Button asChild size="sm"><Link to="/bookings/$id" params={{ id: sel.bookingId }}>เปิด Booking</Link></Button>}
              {sel.customerId && <Button asChild size="sm" variant="outline"><Link to="/customers/$id" params={{ id: sel.customerId }}>เปิด Customer</Link></Button>}
              {sel.serviceOrderId && <Button asChild size="sm" variant="outline"><Link to="/stock/service-orders">เปิด Service Order</Link></Button>}
            </div>
          </>
        )}
      </DetailDrawer>
    </div>
  );
}
