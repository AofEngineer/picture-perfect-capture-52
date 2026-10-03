import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Upload, ScanLine, ShieldCheck, RotateCw, PenLine, FileText, Printer, Download, Timer, ArrowRight, Gift, Undo2, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { meta } from "@/lib/meta";
import { useStore } from "@/lib/store";
import { PageHeader, Panel, StatusBadge, WorkflowStepper, Field, Timeline, DemoTag, EmptyState } from "@/components/app/ui-kit";
import { AMLO_STATUS, BOOKING_STATUS, ESIGN_STATUS, LTX_STATUS, REFUND_STATUS, TASK_STATUS, TASK_TYPE } from "@/lib/labels";
import { STEP_REQUIREMENTS, WORKFLOW_STEPS } from "@/lib/mock/seed";
import { daysFromToday, maskPhone, refId, thb, thDate, thDateTime, num } from "@/lib/format";
import { printHtml } from "@/lib/print";
import type { Booking, DemoState } from "@/lib/mock/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/bookings/$id")({
  head: ({ params }) => meta(`การจอง ${params.id}`, "รายละเอียดการจอง Workflow เอกสาร การชำระเงิน และการคืนเงิน"),
  component: BookingDetail,
  notFoundComponent: () => <EmptyState title="ไม่พบการจองนี้" hint="อาจถูกลบหรือเลขการจองไม่ถูกต้อง" />,
});

function BookingDetail() {
  const { id } = Route.useParams();
  const store = useStore();
  const { state, mutate, user, can, salesName, branchName, inScope } = store;
  const b = state.bookings.find((x) => x.id === id);
  if (!b) throw notFound();
  if (!inScope(b)) return <EmptyState title="ไม่มีสิทธิ์ดูการจองนี้" hint="รายการนี้อยู่นอกขอบเขตสาขาหรือเจ้าของข้อมูลของบทบาทปัจจุบัน" />;
  const c = state.customers.find((x) => x.id === b.customerId)!;
  const v = state.vehicles.find((x) => x.id === b.vehicleId)!;

  const upd = (fn: (bk: Booking, d: DemoState) => void, action: string, extra?: { before?: string; after?: string; reason?: string; ref?: string }) =>
    mutate((d) => { const bk = d.bookings.find((x) => x.id === id)!; fn(bk, d); bk.history.unshift({ at: new Date().toISOString(), by: user.name, text: action }); }, { branchId: b.branchId, action, entity: "Booking", entityId: id, ...extra });

  const daysLeft = daysFromToday(b.expiresAt);

  return (
    <div>
      <PageHeader
        title={b.id}
        subtitle={`${c.name} · ${v.model} (${v.color}) · ${branchName(b.branchId)} · Sales: ${salesName(b.salesId)}`}
        actions={<>
          <StatusBadge tone={BOOKING_STATUS[b.status][1]}>สถานะการจอง: {BOOKING_STATUS[b.status][0]}</StatusBadge>
          <StatusBadge tone="neutral">สถานะรถ: {{ available: "พร้อมขาย", reserved: "จองแล้ว", incoming: "รอรับเข้า", transfer: "โอนสาขา", prep: "เตรียมรถ", sold: "ขายแล้ว" }[v.status]}</StatusBadge>
        </>}
      />
      <Panel className="mb-5">
        <WorkflowStepper steps={WORKFLOW_STEPS} current={b.status === "closed" ? 8 : b.step} blocked={b.status === "expired"} />
      </Panel>

      <Tabs defaultValue="overview">
        <TabsList className="mb-4 flex h-auto flex-wrap justify-start">
          {[["overview", "Overview"], ["docs", "Customer & Documents"], ["pay", "Payment & Loyalty"], ["flow", "Workflow & Tasks"], ["contract", "Contracts & Delivery"], ["refund", "Refund"], ["history", "Activity History"]].map(([k, l]) => <TabsTrigger key={k} value={k}>{l}</TabsTrigger>)}
        </TabsList>

        <TabsContent value="overview"><Overview b={b} upd={upd} daysLeft={daysLeft} /></TabsContent>
        <TabsContent value="docs"><DocsTab b={b} upd={upd} /></TabsContent>
        <TabsContent value="pay"><PayTab b={b} upd={upd} /></TabsContent>
        <TabsContent value="flow"><FlowTab b={b} upd={upd} /></TabsContent>
        <TabsContent value="contract"><ContractTab b={b} upd={upd} /></TabsContent>
        <TabsContent value="refund"><RefundTab b={b} upd={upd} /></TabsContent>
        <TabsContent value="history">
          <Panel title="Activity History"><Timeline items={b.history.map((h) => ({ at: h.at, title: h.text, sub: `${thDateTime(h.at)} · ${h.by}` }))} /></Panel>
        </TabsContent>
      </Tabs>
      {!can("booking", "edit") && <p className="mt-4 text-xs text-muted-foreground">บทบาทปัจจุบันดูได้อย่างเดียว ปุ่มแก้ไขบางรายการจะถูกปิด</p>}
    </div>
  );
}

type Upd = (fn: (bk: Booking, d: DemoState) => void, action: string, extra?: { before?: string; after?: string; reason?: string; ref?: string }) => void;

function Overview({ b, upd, daysLeft }: { b: Booking; upd: Upd; daysLeft: number }) {
  const { state, can, salesName } = useStore();
  const c = state.customers.find((x) => x.id === b.customerId)!;
  const v = state.vehicles.find((x) => x.id === b.vehicleId)!;
  const [expDate, setExpDate] = useState(b.expiresAt.slice(0, 10));
  const pointValue = b.pointsUsed * state.loyaltyConfig.pointValue;
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Panel title="ข้อมูลการจอง" className="lg:col-span-2">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Field label="ลูกค้า"><Link to="/customers/$id" params={{ id: c.id }} className="text-primary hover:underline">{c.name}</Link></Field>
          <Field label="เบอร์โทร">{maskPhone(c.phone)}</Field>
          <Field label="Sales">{salesName(b.salesId)}</Field>
          <Field label="รถ"><Link to="/stock/$id" params={{ id: v.id }} className="text-primary hover:underline">{v.model}</Link></Field>
          <Field label="VIN">{v.vin}</Field>
          <Field label="สี / ปี">{v.color} / {v.year}</Field>
          <Field label="ราคารถ">{thb(b.price)}</Field>
          <Field label="เงินจอง">{thb(b.deposit)}</Field>
          <Field label="ชำระแล้ว + Point">{thb(b.paid)} + {thb(pointValue)}</Field>
          <Field label="วันที่จอง">{thDate(b.createdAt)}</Field>
          <Field label="นัดส่งมอบ">{thDate(b.deliveryAt)}</Field>
          <Field label="ขั้นตอนปัจจุบัน">{b.status === "closed" ? "ปิดการขายแล้ว" : WORKFLOW_STEPS[b.step]}</Field>
        </div>
      </Panel>
      <Panel title={<span className="flex items-center gap-2"><Timer className="size-4" /> การหมดอายุการจอง</span>}>
        {b.status === "active" && (
          <>
            <div className={cn("text-4xl font-semibold", daysLeft <= 2 ? "text-destructive" : "")}>{daysLeft < 0 ? "เลยกำหนด" : `${daysLeft} วัน`}</div>
            <div className="text-xs text-muted-foreground">หมดอายุ {thDateTime(b.expiresAt)}</div>
            {can("booking", "edit") && (
              <div className="mt-4 space-y-2">
                <Label className="text-xs">ปรับวันหมดอายุตามข้อตกลง</Label>
                <div className="flex gap-2">
                  <Input type="date" value={expDate} onChange={(e) => setExpDate(e.target.value)} className="h-9" />
                  <Button size="sm" variant="outline" onClick={() => { upd((bk) => { bk.expiresAt = new Date(expDate + "T18:00").toISOString(); }, "ปรับวันหมดอายุการจอง", { before: thDate(b.expiresAt), after: thDate(expDate) }); toast.success("ปรับวันหมดอายุแล้ว"); }}>บันทึก</Button>
                </div>
                <Button size="sm" variant="ghost" className="w-full text-destructive" onClick={() => {
                  upd((bk, d) => {
                    bk.status = "expired"; bk.expireReason = "ลูกค้าไม่ชำระเงินตามกำหนด (จำลอง)"; bk.releaseState = "awaiting";
                    d.vehicles.find((x) => x.id === bk.vehicleId)!.releaseEvent = { at: new Date().toISOString(), reason: bk.expireReason };
                    d.tasks.push({ id: `T${Date.now()}`, type: "payment", title: "ตรวจสอบเงินจอง (หลุดจอง)", date: new Date().toISOString(), customerId: bk.customerId, bookingId: bk.id, assignee: bk.salesId, branchId: bk.branchId, status: "todo" });
                  }, "หลุดจอง", { before: "active", after: "expired" });
                  toast.warning("การจองหลุดแล้ว — สร้างงานติดตามเงินจองให้อัตโนมัติ");
                }}>จำลองหลุดจอง (Demo)</Button>
              </div>
            )}
          </>
        )}
        {b.status === "expired" && (
          <div className="space-y-3">
            <StatusBadge tone="danger">หลุดจอง</StatusBadge>
            <Field label="เหตุผล">{b.expireReason}</Field>
            <Field label="สถานะรถ">{b.releaseState === "released" ? <StatusBadge tone="success">ปล่อยรถแล้ว — พร้อมให้จองใหม่</StatusBadge> : <StatusBadge tone="warning">รอผู้มีสิทธิ์อนุมัติปล่อยรถ</StatusBadge>}</Field>
            {b.releaseState === "awaiting" && (can("booking", "approve") ? (
              <Button className="w-full" onClick={() => { upd((bk, d) => { bk.releaseState = "released"; const veh = d.vehicles.find((x) => x.id === bk.vehicleId)!; veh.status = "available"; veh.ready = true; veh.history.unshift({ at: new Date().toISOString(), text: `ปล่อยรถจากการจอง ${bk.id}` }); }, "อนุมัติปล่อยรถจากการจอง", { before: "reserved", after: "available" }); toast.success("ปล่อยรถแล้ว รถพร้อมให้จองใหม่"); }}>อนุมัติปล่อยรถ</Button>
            ) : <p className="text-xs text-muted-foreground">ต้องเป็น Branch Manager ขึ้นไปจึงจะอนุมัติปล่อยรถได้</p>)}
          </div>
        )}
        {b.status === "closed" && <div className="flex items-center gap-2 text-success"><CheckCircle2 className="size-5" /> ปิดการขายเรียบร้อย</div>}
      </Panel>
    </div>
  );
}

function DocsTab({ b, upd }: { b: Booking; upd: Upd }) {
  const { state, user, can } = useStore();
  const c = state.customers.find((x) => x.id === b.customerId)!;
  const [stage, setStage] = useState<"idle" | "reading" | "result">(b.ocr.confirmed ? "result" : "idle");
  const [fields, setFields] = useState([
    { k: "ชื่อ-นามสกุล", v: c.name.replace("คุณ", ""), conf: 98 },
    { k: "เลขประจำตัวประชาชน", v: c.idCard, conf: 95 },
    { k: "วันเกิด", v: "12 มี.ค. 2528", conf: 91 },
    { k: "ที่อยู่", v: "99/9 ถ.สมมติ แขวงตัวอย่าง เขตทดสอบ กทม. 10xxx", conf: 72 },
    { k: "วันหมดอายุบัตร", v: "11 มี.ค. 2572", conf: 64 },
  ]);
  const [amloBusy, setAmloBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const runOcr = () => { setStage("reading"); setTimeout(() => setStage("result"), 1400); };
  const runAmlo = () => {
    setAmloBusy(true);
    upd((bk) => { bk.amlo = { status: "checking" }; }, "เริ่มตรวจสอบ AMLO (จำลอง)");
    setTimeout(() => {
      // first attempt on a booking previously errored → succeed on retry; otherwise deterministic by booking
      const outcomes = ["clear", "clear", "review", "error"] as const;
      const prev = b.amlo.status;
      const res = prev === "error" ? "clear" : outcomes[(b.id.charCodeAt(b.id.length - 1) + (b.amlo.ref ? 1 : 0)) % 4];
      const ref = `AMLO-DEMO-${Math.floor(Math.random() * 90000 + 10000)}`;
      upd((bk) => { bk.amlo = { status: res, at: new Date().toISOString(), ref }; }, `ผลตรวจ AMLO (จำลอง): ${AMLO_STATUS[res][0]}`, { ref });
      setAmloBusy(false);
      res === "error" ? toast.error("ระบบ AMLO ขัดข้อง (จำลอง) — กด Retry") : toast.success(`ผลจำลอง: ${AMLO_STATUS[res][0]}`);
    }, 1500);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel title={<span className="flex items-center gap-2"><ScanLine className="size-4" /> OCR เอกสารลูกค้า</span>} actions={<DemoTag />} className="lg:col-span-2">
        {stage === "idle" && (
          <div onClick={() => fileRef.current?.click()} className="flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed p-10 text-center hover:border-primary hover:bg-accent/30">
            <Upload className="size-8 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">อัปโหลดบัตรประชาชน / เอกสารประกอบการขาย</p>
            <p className="text-xs text-muted-foreground">คลิกเพื่อเลือกไฟล์ หรือใช้เอกสารตัวอย่าง (ข้อมูลสมมติทั้งหมด)</p>
            <input ref={fileRef} type="file" className="hidden" onChange={runOcr} />
            <Button size="sm" variant="outline" className="mt-4" onClick={(e) => { e.stopPropagation(); runOcr(); }}>ใช้เอกสารตัวอย่าง</Button>
          </div>
        )}
        {stage === "reading" && <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground"><Loader2 className="size-5 animate-spin" /> กำลังอ่านข้อมูลด้วย OCR (จำลอง)...</div>}
        {stage === "result" && (
          <div className="grid gap-5 md:grid-cols-2">
            <div className="relative aspect-[1.6] rounded-md border bg-gradient-to-br from-accent to-muted p-5">
              <div className="text-xs font-semibold text-accent-foreground">บัตรประจำตัวประชาชน (ตัวอย่าง)</div>
              <div className="mt-6 space-y-2">{fields.slice(0, 3).map((f) => <div key={f.k} className="h-2.5 w-3/4 rounded bg-foreground/15" />)}</div>
              <div className="absolute bottom-4 right-4 size-16 rounded bg-foreground/10" />
              <DemoTag className="absolute left-4 bottom-4" label="SAMPLE" />
            </div>
            <div className="space-y-2.5">
              {fields.map((f, i) => (
                <div key={f.k}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{f.k}</span>
                    <StatusBadge tone={f.conf >= 90 ? "success" : f.conf >= 75 ? "warning" : "danger"}>ความมั่นใจ {f.conf}%{f.conf < 80 && " · ต้องตรวจสอบ"}</StatusBadge>
                  </div>
                  <Input disabled={b.ocr.confirmed} value={f.v} onChange={(e) => setFields(fields.map((x, j) => (j === i ? { ...x, v: e.target.value, conf: 100 } : x)))} className={cn("mt-1 h-8", f.conf < 80 && !b.ocr.confirmed && "border-warning bg-warning/10")} />
                </div>
              ))}
              {b.ocr.confirmed ? (
                <p className="flex items-center gap-1.5 pt-2 text-xs text-success"><CheckCircle2 className="size-4" /> ยืนยันข้อมูลโดย {b.ocr.by} เมื่อ {thDateTime(b.ocr.at)}</p>
              ) : (
                <Button disabled={!can("booking", "edit")} className="mt-2 w-full" onClick={() => { upd((bk) => { bk.ocr = { confirmed: true, by: user.name, at: new Date().toISOString() }; }, "ยืนยันข้อมูล OCR"); toast.success("ยืนยันข้อมูล OCR แล้ว"); }}>ตรวจสอบแล้ว — ยืนยันข้อมูล</Button>
              )}
            </div>
          </div>
        )}
      </Panel>

      <Panel title={<span className="flex items-center gap-2"><ShieldCheck className="size-4" /> ตรวจสอบ AMLO</span>} actions={<DemoTag label="ผลจำลอง" />}>
        <div className="flex items-center gap-3">
          <StatusBadge tone={AMLO_STATUS[b.amlo.status][1]}>{AMLO_STATUS[b.amlo.status][0]}</StatusBadge>
          {b.amlo.ref && <span className="text-xs text-muted-foreground">Ref {b.amlo.ref} · {thDateTime(b.amlo.at)}</span>}
        </div>
        <p className="mt-3 rounded-sm bg-demo/50 p-3 text-xs text-demo-foreground">
          ผลนี้เป็นผลจำลองสำหรับการสาธิตเท่านั้น ไม่ใช่ผลตรวจสอบจริง และไม่ถือเป็นการรับรองหรืออนุมัติทางกฎหมาย
        </p>
        {b.amlo.status === "review" && <p className="mt-2 text-xs">รายละเอียดจำลอง: พบชื่อใกล้เคียง 1 รายการ (ความคล้าย 71%) ต้องให้เจ้าหน้าที่ตรวจสอบเพิ่มเติม</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          {b.amlo.status === "error" ? (
            <Button disabled={amloBusy} onClick={runAmlo}><RotateCw className={cn("size-4", amloBusy && "animate-spin")} /> Retry</Button>
          ) : (
            <Button disabled={amloBusy || !can("booking", "edit")} onClick={runAmlo}>{amloBusy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} ตรวจสอบ AMLO</Button>
          )}
          {(b.amlo.status === "review" || b.amlo.status === "error") && (
            <Button variant="outline" onClick={() => { upd((bk, d) => { d.tasks.push({ id: `T${Date.now()}`, type: "docs", title: "ตรวจสอบ AMLO เพิ่มเติม", date: new Date(Date.now() + 86400000).toISOString(), customerId: bk.customerId, bookingId: bk.id, assignee: bk.salesId, branchId: bk.branchId, status: "todo", step: 2 }); }, "สร้างงานตรวจสอบ AMLO เพิ่มเติม"); toast.success("สร้างงานให้ผู้รับผิดชอบแล้ว"); }}>สร้างงานตรวจสอบเพิ่มเติม</Button>
          )}
        </div>
      </Panel>

      <Panel title="ข้อมูลลูกค้า">
        <div className="grid grid-cols-2 gap-4">
          <Field label="ชื่อ">{c.name}</Field>
          <Field label="เลขบัตร">{c.idCard.slice(0, 6)}xxxxxx</Field>
          <Field label="อีเมล">{c.email}</Field>
          <Field label="สมาชิก">{c.tier} · {c.loyaltyId}</Field>
        </div>
      </Panel>
    </div>
  );
}

function PayTab({ b, upd }: { b: Booking; upd: Upd }) {
  const { state, can } = useStore();
  const cfg = state.loyaltyConfig;
  const c = state.customers.find((x) => x.id === b.customerId)!;
  const txs = state.loyaltyTx.filter((t) => t.bookingId === b.id);
  const remaining = Math.max(0, b.price - b.paid - b.pointsUsed * cfg.pointValue);
  const maxByRule = Math.floor((b.price * cfg.maxBurnPct) / 100 / cfg.pointValue) - b.pointsUsed;
  const usable = Math.max(0, Math.min(c.points, maxByRule, Math.floor(remaining / cfg.pointValue)));
  const [pts, setPts] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pay, setPay] = useState("");
  const n = Number(pts);
  const err = !pts ? "" : !Number.isInteger(n) || n <= 0 ? "กรุณากรอกจำนวน Point เป็นจำนวนเต็มบวก" : n > c.points ? `เกิน Point คงเหลือ (${num(c.points)})` : n > usable ? `เกินเงื่อนไขการใช้ Point สูงสุด (${num(usable)} Point · ไม่เกิน ${cfg.maxBurnPct}% ของราคารถ)` : "";
  const pending = txs.some((t) => t.type === "Burn" && t.status === "Pending");

  const burn = () => {
    setConfirm(false); setBusy(true);
    const ref = refId("LYT-DEMO");
    const txId = `LT-${Date.now()}`;
    const fail = state.integrations.find((i) => i.id === "loyalty")?.status === "error" && Math.random() < 0.0; // deterministic success; error simulated via button
    upd((bk, d) => { d.loyaltyTx.unshift({ id: txId, customerId: bk.customerId, bookingId: bk.id, type: "Burn", points: n, value: n * cfg.pointValue, status: "Pending", ref, at: new Date().toISOString(), match: "pending", formulaVersion: cfg.version }); }, `ส่งคำขอ Burn ${num(n)} Point`, { ref });
    setTimeout(() => {
      upd((bk, d) => {
        const t = d.loyaltyTx.find((x) => x.id === txId)!;
        if (fail) { t.status = "Failed"; return; }
        t.status = "Success"; t.match = "matched";
        bk.pointsUsed += n;
        const cu = d.customers.find((x) => x.id === bk.customerId)!; cu.points -= n; cu.extPoints -= n;
      }, `Burn Point สำเร็จ ${num(n)} Point`, { ref });
      setBusy(false); setPts("");
      toast.success(`ใช้ ${num(n)} Point สำเร็จ (Ref ${ref})`);
    }, 1500);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel title="สรุปการชำระเงิน">
        <div className="space-y-2 text-sm">
          {[["ราคารถ", thb(b.price)], ["ชำระแล้ว (รวมเงินจอง)", thb(b.paid)], ["ส่วนลดจาก Point", `-${thb(b.pointsUsed * cfg.pointValue)}`]].map(([k, v]) => <div key={k} className="flex justify-between"><span className="text-muted-foreground">{k}</span><span>{v}</span></div>)}
          <div className="flex justify-between border-t pt-2 text-base font-semibold"><span>ยอดคงเหลือที่ต้องชำระ</span><span>{thb(remaining)}</span></div>
        </div>
        {remaining > 0 && can("booking", "edit") && (
          <div className="mt-4 flex gap-2">
            <Input type="number" placeholder="บันทึกรับชำระ (บาท)" value={pay} onChange={(e) => setPay(e.target.value)} className="h-9" />
            <Button size="sm" onClick={() => { const a = Number(pay); if (!a || a <= 0 || a > remaining) return toast.error(`ยอดต้องอยู่ระหว่าง 1 – ${thb(remaining)}`); upd((bk) => { bk.paid += a; }, `รับชำระเงิน ${thb(a)}`); setPay(""); toast.success("บันทึกรับชำระแล้ว"); }}>บันทึก</Button>
          </div>
        )}
      </Panel>
      <Panel title={<span className="flex items-center gap-2"><Gift className="size-4" /> ใช้ Point ชำระเงิน</span>} actions={<DemoTag />}>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-sm bg-muted p-3"><div className="text-xs text-muted-foreground">Point คงเหลือ</div><div className="text-lg font-semibold">{num(c.points)}</div></div>
          <div className="rounded-sm bg-muted p-3"><div className="text-xs text-muted-foreground">ใช้ได้สูงสุด</div><div className="text-lg font-semibold">{num(usable)}</div></div>
          <div className="rounded-sm bg-muted p-3"><div className="text-xs text-muted-foreground">อัตรา</div><div className="text-lg font-semibold">1 = {thb(cfg.pointValue)}</div></div>
        </div>
        <div className="mt-4 space-y-1.5">
          <Label>จำนวน Point ที่ต้องการใช้</Label>
          <Input type="number" value={pts} onChange={(e) => setPts(e.target.value)} aria-invalid={!!err} disabled={pending || busy || !can("booking", "edit")} />
          {err ? <p className="text-xs text-destructive">{err}</p> : n > 0 && <p className="text-xs text-muted-foreground">มูลค่า {thb(n * cfg.pointValue)} · ยอดที่ยังต้องชำระ {thb(remaining - n * cfg.pointValue)}</p>}
          {pending && <p className="text-xs text-warning-foreground">มีรายการ Burn ที่ Pending อยู่ — ป้องกันการทำรายการซ้ำ</p>}
        </div>
        <Button className="mt-3 w-full" disabled={!n || !!err || busy || pending} onClick={() => setConfirm(true)}>{busy ? <><Loader2 className="size-4 animate-spin" /> กำลังส่งไปยังระบบ Loyalty...</> : "ใช้ Point"}</Button>
      </Panel>
      <Panel title="ธุรกรรม Loyalty ของการจองนี้" className="lg:col-span-2">
        {txs.length ? (
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-2">วันเวลา</th><th>ประเภท</th><th>Point</th><th>มูลค่า</th><th>Reference ID</th><th>สูตร</th><th>สถานะ</th><th></th></tr></thead>
            <tbody>{txs.map((t) => (
              <tr key={t.id} className="border-b last:border-0">
                <td className="py-2 text-xs">{thDateTime(t.at)}</td><td>{t.type}</td><td>{num(t.points)}</td><td>{thb(t.value)}</td><td className="font-mono text-xs">{t.ref}</td><td className="text-xs">{t.formulaVersion}</td>
                <td><StatusBadge tone={LTX_STATUS[t.status][1]}>{t.status}</StatusBadge></td>
                <td>{t.type === "Burn" && t.status === "Success" && can("booking", "approve") && <Button size="sm" variant="ghost" onClick={() => { upd((bk, d) => { const x = d.loyaltyTx.find((y) => y.id === t.id)!; x.status = "Reversed"; bk.pointsUsed -= t.points; const cu = d.customers.find((y) => y.id === bk.customerId)!; cu.points += t.points; cu.extPoints += t.points; d.loyaltyTx.unshift({ ...t, id: `LT-${Date.now()}`, type: "Reverse", status: "Success", ref: refId("LYT-DEMO"), at: new Date().toISOString() }); }, `Reverse Point ${num(t.points)}`, { ref: t.ref }); toast.success("Reverse Point แล้ว"); }}>Reverse</Button>}</td>
              </tr>))}</tbody>
          </table>
        ) : <EmptyState title="ยังไม่มีธุรกรรม" hint="" />}
      </Panel>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการใช้ Point</AlertDialogTitle>
            <AlertDialogDescription>ใช้ {num(n)} Point (มูลค่า {thb(n * cfg.pointValue)}) จากสมาชิก {c.loyaltyId} สำหรับการจอง {b.id} — ระบบจะส่งคำขอ Burn ไปยังระบบ Loyalty (จำลอง)</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>ยกเลิก</AlertDialogCancel><AlertDialogAction onClick={burn}>ยืนยัน</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function checkStep(b: Booking, d: DemoState): string | null {
  const step = b.step;
  if (step === 1 && !b.ocr.confirmed) return "ยังไม่ได้ยืนยันข้อมูล OCR";
  if (step === 2 && b.amlo.status !== "clear") return "ผล AMLO ยังไม่เป็น “ไม่พบรายการตรงกัน”";
  if (step === 3 && b.esign.status !== "done") return "ยังลงนามไม่ครบทุกฝ่าย";
  if (step === 4 && b.paid + b.pointsUsed * d.loyaltyConfig.pointValue < b.price) return "ยังชำระเงินไม่ครบ";
  if (step === 5 && d.serviceOrders.some((s) => s.vehicleId === b.vehicleId && s.status !== "done")) return "Service Order ของรถยังไม่เสร็จ";
  if (step === 6 && !d.plates.some((p) => p.bookingId === b.id && p.status === "matched")) return "ยังไม่ได้จับคู่ป้ายแดง";
  return null;
}

function FlowTab({ b, upd }: { b: Booking; upd: Upd }) {
  const { state, can, salesName } = useStore();
  const tasks = state.tasks.filter((t) => t.bookingId === b.id);
  const block = checkStep(b, state);
  const [enforce, setEnforce] = useState(true);
  const advance = () => {
    if (enforce && block) return toast.error(`ยังไม่สามารถไปขั้นตอนถัดไป: ${block}`);
    upd((bk, d) => {
      if (bk.step === 7) { bk.status = "closed"; const veh = d.vehicles.find((x) => x.id === bk.vehicleId)!; veh.status = "sold"; veh.ready = false; return; }
      if (bk.step === 5) { const veh = d.vehicles.find((x) => x.id === bk.vehicleId)!; if (veh.status === "prep") veh.status = "reserved"; }
      bk.step += 1;
    }, b.step === 7 ? "ปิดการขาย" : `ผ่านขั้นตอน “${WORKFLOW_STEPS[b.step]}”`, { before: WORKFLOW_STEPS[b.step], after: WORKFLOW_STEPS[b.step + 1] ?? "ปิดการขาย" });
    toast.success("อัปเดตขั้นตอนแล้ว");
  };
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Panel title="ขั้นตอน Workflow การขาย" className="lg:col-span-2" bodyClass="p-0">
        <ul>
          {WORKFLOW_STEPS.map((s, i) => {
            const done = b.status === "closed" || i < b.step;
            const cur = b.status !== "closed" && i === b.step;
            return (
              <li key={s} className={cn("flex gap-4 border-b px-5 py-3 last:border-0", cur && "bg-accent/40")}>
                <div className="w-6 pt-0.5 text-sm font-semibold text-muted-foreground">{i + 1}</div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{s}</span>
                    <StatusBadge tone={done ? "success" : cur ? (block ? "warning" : "info") : "neutral"}>{done ? "เสร็จสิ้น" : cur ? (block ? "รอข้อมูล" : "กำลังดำเนินการ") : "ยังไม่เริ่ม"}</StatusBadge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">ผู้รับผิดชอบ: {i === 2 || i === 4 ? "Finance" : i === 5 ? "Service Officer" : i === 7 ? "Branch Manager" : salesName(b.salesId)} · เงื่อนไข: {STEP_REQUIREMENTS[i].join(", ")}</div>
                  {cur && block && <div className="mt-1 flex items-center gap-1 text-xs text-destructive"><AlertTriangle className="size-3" /> ข้อมูลที่ยังขาด: {block}</div>}
                </div>
              </li>
            );
          })}
        </ul>
      </Panel>
      <div className="space-y-5">
        <Panel title="ดำเนินการ">
          {b.status === "active" ? (
            <>
              <Button className="w-full" disabled={!can("booking", "edit")} onClick={advance}>{b.step === 7 ? "ปิดการขาย" : "ไปขั้นตอนถัดไป"} <ArrowRight className="size-4" /></Button>
              <label className="mt-3 flex items-center gap-2 text-xs"><input type="checkbox" checked={enforce} onChange={(e) => setEnforce(e.target.checked)} /> บังคับตรวจเงื่อนไขก่อนผ่านขั้นตอน (ปรับได้)</label>
            </>
          ) : <p className="text-sm text-muted-foreground">การจองไม่อยู่ในสถานะดำเนินการ</p>}
        </Panel>
        <Panel title={`งานที่เกี่ยวข้อง (${tasks.length})`} bodyClass="p-0">
          {tasks.length ? tasks.map((t) => (
            <div key={t.id} className="border-b px-4 py-2.5 last:border-0">
              <div className="flex items-center justify-between gap-2"><span className="text-sm">{t.title}</span><StatusBadge tone={TASK_STATUS[t.status][1]}>{TASK_STATUS[t.status][0]}</StatusBadge></div>
              <div className="text-xs text-muted-foreground">{TASK_TYPE[t.type]} · {thDateTime(t.date)} · {salesName(t.assignee)}</div>
            </div>
          )) : <EmptyState title="ไม่มีงาน" hint="" />}
        </Panel>
      </div>
    </div>
  );
}

const DOC_TYPES = ["ใบจอง", "สัญญาซื้อขาย", "ใบรับเงิน", "ใบตรวจรับรถ", "ใบส่งมอบรถ", "แบบฟอร์มยืมป้ายแดง"];

function ContractTab({ b, upd }: { b: Booking; upd: Upd }) {
  const { state, user, can, branchName, salesName } = useStore();
  const c = state.customers.find((x) => x.id === b.customerId)!;
  const v = state.vehicles.find((x) => x.id === b.vehicleId)!;
  const [signIdx, setSignIdx] = useState<number | null>(null);
  const [doc, setDoc] = useState<string | null>(null);
  const plate = state.plates.find((p) => p.bookingId === b.id);

  const docHtml = (t: string) => `<h1>${t}</h1><div class="muted">${branchName(b.branchId)} · เลขที่ ${b.id}-${DOC_TYPES.indexOf(t) + 1} · วันที่ ${thDate(new Date().toISOString())}</div><div class="bar"></div>
<table><tr><th>ลูกค้า</th><td>${c.name}</td><th>เบอร์โทร</th><td>${maskPhone(c.phone)}</td></tr>
<tr><th>รถ</th><td>${v.model}</td><th>สี/ปี</th><td>${v.color} / ${v.year}</td></tr>
<tr><th>VIN</th><td colspan="3">${v.vin}</td></tr>
<tr><th>ราคา</th><td>${thb(b.price)}</td><th>เงินจอง</th><td>${thb(b.deposit)}</td></tr>
<tr><th>ชำระแล้ว</th><td>${thb(b.paid)}</td><th>ส่วนลด Point</th><td>${thb(b.pointsUsed * state.loyaltyConfig.pointValue)}</td></tr>
<tr><th>Sales</th><td>${salesName(b.salesId)}</td><th>นัดส่งมอบ</th><td>${thDate(b.deliveryAt)}</td></tr>
${t === "แบบฟอร์มยืมป้ายแดง" ? `<tr><th>ป้ายแดง</th><td colspan="3">${plate?.number ?? "-"}</td></tr>` : ""}</table>
<p style="margin-top:40px;display:flex;justify-content:space-between"><span>ลงชื่อ ................................ ผู้ซื้อ</span><span>ลงชื่อ ................................ ผู้ขาย</span></p>`;

  const issue = (t: string, mode: "print" | "pdf") => {
    printHtml(`${t} ${b.id}`, docHtml(t));
    upd((bk) => { const prev = bk.docs.filter((x) => x.type === t).length; bk.docs.unshift({ type: t, version: prev + 1, at: new Date().toISOString(), by: user.name }); }, `ออกเอกสาร ${t}`);
    toast.success(mode === "pdf" ? "เปิดหน้าพิมพ์แล้ว — เลือก “Save as PDF” เพื่อดาวน์โหลด" : "ส่งเอกสารไปพิมพ์แล้ว");
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel title={<span className="flex items-center gap-2"><PenLine className="size-4" /> E-Signature · สัญญาซื้อขาย</span>} actions={<DemoTag />}>
        <div className="mb-3 flex items-center gap-2"><StatusBadge tone={ESIGN_STATUS[b.esign.status][1]}>{ESIGN_STATUS[b.esign.status][0]}</StatusBadge></div>
        <ol className="space-y-2">
          {b.esign.signers.map((s, i) => {
            const canSign = !s.signedAt && b.esign.signers.slice(0, i).every((x) => x.signedAt) && b.esign.status !== "draft";
            return (
              <li key={i} className="flex items-center gap-3 rounded-sm border p-3">
                <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-semibold">{i + 1}</span>
                <div className="flex-1"><div className="text-sm font-medium">{s.name}</div><div className="text-xs text-muted-foreground">{s.role}{s.signedAt && ` · ลงนาม ${thDateTime(s.signedAt)}`}</div></div>
                {s.signedAt ? <StatusBadge tone="success">ลงนามแล้ว</StatusBadge> : canSign ? <Button size="sm" onClick={() => setSignIdx(i)}>ลงนาม</Button> : <StatusBadge>รอคิว</StatusBadge>}
              </li>
            );
          })}
        </ol>
        <div className="mt-4 flex gap-2">
          {b.esign.status === "draft" && <Button disabled={!can("booking", "edit")} onClick={() => { upd((bk) => { bk.esign.status = "pending"; }, "ส่งสัญญาให้ลงนาม (E-Signature)"); toast.success("ส่งเอกสารลงนามแล้ว"); }}>ส่งให้ลงนาม</Button>}
          {b.esign.status === "done" && <Button variant="outline" onClick={() => issue("สัญญาซื้อขาย", "pdf")}><Download className="size-4" /> ดาวน์โหลดสัญญาที่ลงนามแล้ว</Button>}
        </div>
      </Panel>

      <Panel title={<span className="flex items-center gap-2"><FileText className="size-4" /> Document Center</span>}>
        <div className="grid grid-cols-2 gap-2">
          {DOC_TYPES.map((t) => {
            const issued = b.docs.filter((x) => x.type === t);
            return (
              <button key={t} onClick={() => setDoc(t)} className="rounded-sm border p-3 text-left hover:border-primary">
                <div className="text-sm font-medium">{t}</div>
                <div className="mt-1">{issued.length ? <StatusBadge tone="success">ออกแล้ว v{issued[0].version}</StatusBadge> : <StatusBadge>ยังไม่ออก</StatusBadge>}</div>
              </button>
            );
          })}
        </div>
        <div className="mt-4">
          <div className="mb-2 text-xs font-medium text-muted-foreground">ประวัติการออกเอกสาร</div>
          {b.docs.length ? <ul className="space-y-1 text-xs">{b.docs.map((x, i) => <li key={i}>{x.type} v{x.version} · {thDateTime(x.at)} · {x.by}</li>)}</ul> : <p className="text-xs text-muted-foreground">ยังไม่มี</p>}
        </div>
      </Panel>

      <Panel title="การส่งมอบ & ป้ายแดง" className="lg:col-span-2">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="นัดส่งมอบ">{thDateTime(b.deliveryAt)}</Field>
          <Field label="ป้ายแดง">{plate ? plate.number : <span className="text-muted-foreground">ยังไม่จับคู่ — จัดการได้ที่ <Link to="/stock/red-plates" className="text-primary">Red Plate Management</Link></span>}</Field>
          <Field label="สถานะรถ">{v.ready ? "พร้อมส่งมอบ" : v.readyNote ?? "-"}</Field>
        </div>
      </Panel>

      <Dialog open={!!doc} onOpenChange={(o) => !o && setDoc(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Preview: {doc}</DialogTitle></DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto rounded-sm border bg-card p-6 text-sm">
            <DemoTag label="เอกสารตัวอย่างสำหรับ Demo" />
            {doc && <div className="prose-sm mt-3 [&_table]:mt-3 [&_table]:w-full [&_td]:border [&_td]:p-1.5 [&_th]:border [&_th]:bg-muted [&_th]:p-1.5 [&_th]:text-left [&_h1]:text-lg [&_h1]:font-semibold [&_.bar]:my-3 [&_.bar]:h-1 [&_.bar]:m-stripe [&_.muted]:text-xs [&_.muted]:text-muted-foreground" dangerouslySetInnerHTML={{ __html: docHtml(doc) }} />}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => doc && issue(doc, "pdf")}><Download className="size-4" /> Download PDF</Button>
            <Button onClick={() => doc && issue(doc, "print")}><Printer className="size-4" /> Print</Button>
          </div>
        </DialogContent>
      </Dialog>

      <SignaturePad open={signIdx !== null} name={signIdx !== null ? b.esign.signers[signIdx].name : ""} onClose={() => setSignIdx(null)} onSign={() => {
        const i = signIdx!;
        upd((bk) => { bk.esign.signers[i].signedAt = new Date().toISOString(); const all = bk.esign.signers.every((s) => s.signedAt); bk.esign.status = all ? "done" : "partial"; }, `ลงนามเอกสาร: ${b.esign.signers[i].name}`);
        setSignIdx(null); toast.success("ลงนามสำเร็จ");
      }} />
    </div>
  );
}

function SignaturePad({ open, name, onClose, onSign }: { open: boolean; name: string; onClose: () => void; onSign: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [drawn, setDrawn] = useState(false);
  const drawing = useRef(false);
  useEffect(() => { if (open) setDrawn(false); }, [open]);
  const pos = (e: React.PointerEvent) => { const r = ref.current!.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>ลงนาม: {name}</DialogTitle></DialogHeader>
        <canvas ref={ref} width={440} height={180} className="w-full touch-none rounded-sm border bg-muted"
          onPointerDown={(e) => { drawing.current = true; const ctx = ref.current!.getContext("2d")!; const [x, y] = pos(e); ctx.beginPath(); ctx.moveTo(x, y); }}
          onPointerMove={(e) => { if (!drawing.current) return; const ctx = ref.current!.getContext("2d")!; ctx.lineWidth = 2; ctx.strokeStyle = "#1c3a8c"; const [x, y] = pos(e); ctx.lineTo(x, y); ctx.stroke(); setDrawn(true); }}
          onPointerUp={() => (drawing.current = false)} />
        <p className="text-xs text-muted-foreground">วาดลายเซ็นในกรอบ (จำลอง E-Signature)</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => { ref.current!.getContext("2d")!.clearRect(0, 0, 440, 180); setDrawn(false); }}>ล้าง</Button>
          <Button disabled={!drawn} onClick={onSign}>ยืนยันลายเซ็น</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const REFUND_STEPS = ["ขอคืนเงิน", "ตรวจสอบเงื่อนไข", "อนุมัติ", "ดำเนินการคืนเงิน", "บันทึกหลักฐาน", "ปิดคำขอ"];
const BRANCH_LABEL = { A: "A · คืนเต็มจำนวน", B: "B · คืนบางส่วน", C: "C · ไม่เข้าเงื่อนไขคืนเงิน", D: "D · มีการใช้ Loyalty Point" };

function RefundTab({ b, upd }: { b: Booking; upd: Upd }) {
  const { state, can, user, branchName } = useStore();
  const r = b.refund;
  const [br, setBr] = useState<"A" | "B" | "C" | "D">(b.pointsUsed > 0 ? "D" : "A");
  const [ded, setDed] = useState("0");
  const [dedNote, setDedNote] = useState("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");

  if (!r) {
    return (
      <Panel title={<span className="flex items-center gap-2"><Undo2 className="size-4" /> ขอคืนเงินจอง</span>}>
        <div className="grid max-w-2xl gap-4">
          <div className="space-y-1.5">
            <Label>แขนงการคืนเงิน</Label>
            <Select value={br} onValueChange={(x) => setBr(x as typeof br)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(BRANCH_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {br === "B" && <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>จำนวนหัก (บาท)</Label><Input type="number" value={ded} onChange={(e) => setDed(e.target.value)} /></div><div className="space-y-1.5"><Label>รายการหัก</Label><Input value={dedNote} onChange={(e) => setDedNote(e.target.value)} placeholder="เช่น ค่าดำเนินการเอกสาร" /></div></div>}
          <div className="space-y-1.5"><Label>เหตุผล *</Label><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          {err && <p className="text-xs text-destructive">{err}</p>}
          <Button className="w-fit" disabled={!can("booking", "edit")} onClick={() => {
            const dd = br === "B" ? Number(ded) : 0;
            if (reason.trim().length < 5) return setErr("กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร");
            if (br === "B" && (!dd || dd >= b.deposit || !dedNote)) return setErr("กรุณาระบุจำนวนหัก (น้อยกว่าเงินจอง) และรายการหัก");
            setErr("");
            upd((bk) => { bk.refund = { id: `RF-${Date.now().toString().slice(-4)}`, branch: br, step: 1, requestedAt: new Date().toISOString(), amount: br === "C" ? 0 : bk.deposit - dd, deduction: dd, deductionNote: dedNote, pointsReturn: br === "D" ? bk.pointsUsed : 0, reason, status: "pending", branchId: bk.branchId, history: [{ at: new Date().toISOString(), by: user.name, text: "ยื่นคำขอคืนเงิน" }] }; }, "ขอคืนเงินจอง", { reason });
            toast.success("ยื่นคำขอคืนเงินแล้ว รอผู้อนุมัติ");
          }}>ยื่นคำขอคืนเงิน</Button>
        </div>
      </Panel>
    );
  }

  const canApprove = can("booking", "approve");
  const step = (next: number, text: string, patch: Partial<NonNullable<Booking["refund"]>> = {}) => {
    upd((bk, d) => {
      Object.assign(bk.refund!, { step: next, ...patch });
      bk.refund!.history.unshift({ at: new Date().toISOString(), by: user.name, text });
      if (patch.status === "paid" && bk.refund!.pointsReturn > 0) {
        const cu = d.customers.find((x) => x.id === bk.customerId)!; cu.points += bk.refund!.pointsReturn; cu.extPoints += bk.refund!.pointsReturn;
        d.loyaltyTx.unshift({ id: `LT-${Date.now()}`, customerId: bk.customerId, bookingId: bk.id, type: "Reverse", points: bk.refund!.pointsReturn, value: bk.refund!.pointsReturn * d.loyaltyConfig.pointValue, status: "Success", ref: refId("LYT-DEMO"), at: new Date().toISOString(), match: "matched", formulaVersion: d.loyaltyConfig.version });
      }
      if (patch.status === "closed" && bk.status === "active") { bk.status = "cancelled"; const veh = d.vehicles.find((x) => x.id === bk.vehicleId)!; veh.status = "available"; veh.ready = true; }
    }, `คืนเงิน: ${text}`);
    toast.success(text);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Panel title={`คำขอคืนเงิน ${r.id}`} className="lg:col-span-2" actions={<StatusBadge tone={REFUND_STATUS[r.status][1]}>{REFUND_STATUS[r.status][0]}</StatusBadge>}>
        <WorkflowStepper steps={r.branch === "C" ? ["ขอคืนเงิน", "ตรวจสอบเงื่อนไข", "ผลพิจารณา", "ปิดคำขอ"] : REFUND_STEPS} current={r.branch === "C" ? Math.min(r.step, 4) : r.status === "closed" ? 6 : r.step} />
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <Field label="แขนง">{BRANCH_LABEL[r.branch]}</Field>
          <Field label="สาขาที่รับผิดชอบ">{branchName(r.branchId)}</Field>
          <Field label="วันที่ขอ">{thDate(r.requestedAt)}</Field>
          <Field label="เงินจอง">{thb(b.deposit)}</Field>
          <Field label="รายการหัก">{r.deduction ? `${thb(r.deduction)} (${r.deductionNote})` : "-"}</Field>
          <Field label="ยอดคืนสุทธิ">{thb(r.amount)}</Field>
          {r.branch === "D" && <Field label="Point ที่คืนแยก">{num(r.pointsReturn)} Point</Field>}
          <Field label="เหตุผล">{r.reason}</Field>
        </div>
        <div className="mt-6 flex flex-wrap gap-2 border-t pt-4">
          {r.step === 1 && r.status === "pending" && <Button onClick={() => step(2, r.branch === "C" ? "ตรวจสอบแล้ว: ไม่เข้าเงื่อนไข" : "ตรวจสอบเงื่อนไขผ่าน")}>ยืนยันการตรวจสอบเงื่อนไข</Button>}
          {r.step === 2 && r.status === "pending" && (canApprove ? (
            r.branch === "C" ? <Button variant="destructive" onClick={() => step(3, "ผลพิจารณา: ไม่อนุมัติคืนเงิน", { status: "rejected" })}>บันทึกผลพิจารณา (ไม่คืนเงิน)</Button> : <>
              <Button onClick={() => step(3, "อนุมัติคืนเงิน", { status: "approved" })}>อนุมัติ</Button>
              <Button variant="outline" onClick={() => step(3, "ไม่อนุมัติ — ไม่เข้าเงื่อนไข", { status: "rejected", branch: "C", amount: 0 })}>ไม่อนุมัติ</Button>
            </>
          ) : <p className="text-xs text-muted-foreground">รอผู้มีสิทธิ์อนุมัติ (Branch Manager / Finance) — ลองสลับบทบาท</p>)}
          {r.step === 3 && r.status === "approved" && (canApprove ? <Button onClick={() => step(4, `โอนคืนเงิน ${thb(r.amount)}${r.pointsReturn ? ` และคืน ${num(r.pointsReturn)} Point` : ""}`, { status: "paid" })}>ดำเนินการคืนเงิน</Button> : <p className="text-xs text-muted-foreground">รอฝ่ายการเงินดำเนินการ</p>)}
          {r.step === 4 && r.status === "paid" && <Button onClick={() => step(5, "บันทึกหลักฐานการโอน (สลิปตัวอย่าง)")}>บันทึกหลักฐาน</Button>}
          {((r.step === 5 && r.status === "paid") || (r.step === 3 && r.status === "rejected")) && <Button variant="outline" onClick={() => step(6, "ปิดคำขอ", { status: "closed" })}>ปิดคำขอ</Button>}
        </div>
      </Panel>
      <Panel title="ประวัติคำขอ"><Timeline items={r.history.map((h) => ({ at: h.at, title: h.text, sub: `${thDateTime(h.at)} · ${h.by}` }))} /></Panel>
    </div>
  );
}
