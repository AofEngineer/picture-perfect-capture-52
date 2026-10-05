import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Upload,
  ScanLine,
  ShieldCheck,
  RotateCw,
  PenLine,
  FileText,
  Printer,
  Download,
  Timer,
  ArrowRight,
  Gift,
  Undo2,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { meta } from "@/lib/meta";
import { useStore } from "@/lib/store";
import {
  PageHeader,
  Panel,
  StatusBadge,
  WorkflowStepper,
  Field,
  Timeline,
  DemoTag,
  EmptyState,
} from "@/components/app/ui-kit";
import {
  AMLO_STATUS,
  BOOKING_STATUS,
  ESIGN_STATUS,
  LTX_STATUS,
  REFUND_STATUS,
  TASK_STATUS,
  TASK_TYPE,
} from "@/lib/labels";
import { STEP_REQUIREMENTS, WORKFLOW_STEPS } from "@/lib/mock/seed";
import { daysFromToday, maskPhone, refId, thb, thDate, thDateTime, num } from "@/lib/format";
import { printHtml, escapeHtml } from "@/lib/print";
import type { Booking, DemoState } from "@/lib/mock/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { DocumentReview } from "@/components/app/DocumentReview";
import { RefundWorkflow } from "@/components/app/RefundWorkflow";
import {
  pointValueFor,
  remainingPayment,
  settleBurn,
  notify,
  calculateCommission,
  simulateLoyalty,
  receivePayment,
  reverseBurn,
  releaseBookingVehicle,
} from "@/lib/mock/service";

export const Route = createFileRoute("/bookings/$id")({
  head: ({ params }) =>
    meta(`การจอง ${params.id}`, "รายละเอียดการจอง Workflow เอกสาร การชำระเงิน และการคืนเงิน"),
  component: BookingDetail,
  notFoundComponent: () => (
    <EmptyState title="ไม่พบการจองนี้" hint="อาจถูกลบหรือเลขการจองไม่ถูกต้อง" />
  ),
});

function BookingDetail() {
  const { id } = Route.useParams();
  const store = useStore();
  const { state, mutate, user, can, salesName, branchName, inScope } = store;
  const b = state.bookings.find((x) => x.id === id);
  if (!b) throw notFound();
  if (!inScope(b))
    return (
      <EmptyState
        title="ไม่มีสิทธิ์ดูการจองนี้"
        hint="รายการนี้อยู่นอกขอบเขตสาขาหรือเจ้าของข้อมูลของบทบาทปัจจุบัน"
      />
    );
  const c = state.customers.find((x) => x.id === b.customerId)!;
  const v = state.vehicles.find((x) => x.id === b.vehicleId)!;

  const upd = (
    fn: (bk: Booking, d: DemoState) => void,
    action: string,
    extra?: {
      before?: string | undefined;
      after?: string | undefined;
      reason?: string | undefined;
      ref?: string | undefined;
    },
  ) => {
    const permission = action.startsWith("ออกเอกสาร")
      ? "export"
      : action.startsWith("Reverse") || action.startsWith("อนุมัติ") || action === "ปิดการขาย"
        ? "approve"
        : "edit";
    if (!can("booking", permission) || !inScope(b)) {
      toast.error("ไม่มีสิทธิ์ดำเนินการ");
      return false;
    }
    try {
      mutate(
        (d) => {
          const bk = d.bookings.find((x) => x.id === id)!;
          fn(bk, d);
          bk.history.unshift({ at: new Date().toISOString(), by: user.name, text: action });
        },
        { branchId: b.branchId, action, entity: "Booking", entityId: id, ...extra },
      );
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ไม่สามารถบันทึกรายการได้");
      return false;
    }
  };

  const daysLeft = daysFromToday(b.expiresAt);

  return (
    <div>
      <PageHeader
        title={b.id}
        subtitle={`${c.name} · ${v.model} (${v.color}) · ${branchName(b.branchId)} · Sales: ${salesName(b.salesId)}`}
        actions={
          <>
            <StatusBadge tone={BOOKING_STATUS[b.status][1]}>
              สถานะการจอง: {BOOKING_STATUS[b.status][0]}
            </StatusBadge>
            <StatusBadge tone="neutral">
              สถานะรถ:{" "}
              {
                {
                  available: "พร้อมขาย",
                  reserved: "จองแล้ว",
                  incoming: "รอรับเข้า",
                  transfer: "โอนสาขา",
                  prep: "เตรียมรถ",
                  sold: "ขายแล้ว",
                }[v.status]
              }
            </StatusBadge>
          </>
        }
      />
      <Panel className="mb-5">
        <WorkflowStepper
          steps={WORKFLOW_STEPS}
          current={b.status === "closed" ? 8 : b.step}
          blocked={b.status === "expired"}
        />
      </Panel>

      <Tabs defaultValue="overview">
        <TabsList className="mb-4 flex h-auto flex-wrap justify-start">
          {[
            ["overview", "Overview"],
            ["docs", "Customer & Documents"],
            ["pay", "Payment & Loyalty"],
            ["flow", "Workflow & Tasks"],
            ["contract", "Contracts & Delivery"],
            ["refund", "Refund"],
            ["history", "Activity History"],
          ].map(([k, l]) => (
            <TabsTrigger key={k} value={k!}>
              {l}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview">
          <Overview b={b} upd={upd} daysLeft={daysLeft} />
        </TabsContent>
        <TabsContent value="docs">
          <DocsTab b={b} upd={upd} />
        </TabsContent>
        <TabsContent value="pay">
          <PayTab b={b} upd={upd} />
        </TabsContent>
        <TabsContent value="flow">
          <FlowTab b={b} upd={upd} />
        </TabsContent>
        <TabsContent value="contract">
          <ContractTab b={b} upd={upd} />
        </TabsContent>
        <TabsContent value="refund">
          <RefundTab b={b} upd={upd} />
        </TabsContent>
        <TabsContent value="history">
          <Panel title="Activity History">
            <Timeline
              items={b.history.map((h) => ({
                at: h.at,
                title: h.text,
                sub: `${thDateTime(h.at)} · ${h.by}`,
              }))}
            />
          </Panel>
        </TabsContent>
      </Tabs>
      {!can("booking", "edit") && (
        <p className="mt-4 text-xs text-muted-foreground">
          บทบาทปัจจุบันดูได้อย่างเดียว ปุ่มแก้ไขบางรายการจะถูกปิด
        </p>
      )}
    </div>
  );
}

type Upd = (
  fn: (bk: Booking, d: DemoState) => void,
  action: string,
  extra?: {
    before?: string | undefined;
    after?: string | undefined;
    reason?: string | undefined;
    ref?: string | undefined;
  },
) => boolean;

function Overview({ b, upd, daysLeft }: { b: Booking; upd: Upd; daysLeft: number }) {
  const { state, can, salesName } = useStore();
  const c = state.customers.find((x) => x.id === b.customerId)!;
  const v = state.vehicles.find((x) => x.id === b.vehicleId)!;
  const [expDate, setExpDate] = useState(b.expiresAt.slice(0, 10));
  const pointValue = b.pointsUsed * pointValueFor(b, state);
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Panel title="ข้อมูลการจอง" className="lg:col-span-2">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Field label="ลูกค้า">
            <Link
              to="/customers/$id"
              params={{ id: c.id }}
              className="text-primary hover:underline"
            >
              {c.name}
            </Link>
          </Field>
          <Field label="เบอร์โทร">{maskPhone(c.phone)}</Field>
          <Field label="Sales">{salesName(b.salesId)}</Field>
          <Field label="รถ">
            <Link to="/stock/$id" params={{ id: v.id }} className="text-primary hover:underline">
              {v.model}
            </Link>
          </Field>
          <Field label="VIN">{v.vin}</Field>
          <Field label="สี / ปี">
            {v.color} / {v.year}
          </Field>
          <Field label="ราคารถ">{thb(b.price)}</Field>
          <Field label="เงินจอง">{thb(b.deposit)}</Field>
          <Field label="ชำระแล้ว + Point">
            {thb(b.paid)} + {thb(pointValue)}
          </Field>
          <Field label="วันที่จอง">{thDate(b.createdAt)}</Field>
          <Field label="นัดส่งมอบ">{thDate(b.deliveryAt)}</Field>
          <Field label="ขั้นตอนปัจจุบัน">
            {b.status === "closed" ? "ปิดการขายแล้ว" : WORKFLOW_STEPS[b.step]}
          </Field>
        </div>
      </Panel>
      <Panel
        title={
          <span className="flex items-center gap-2">
            <Timer className="size-4" /> การหมดอายุการจอง
          </span>
        }
      >
        {b.status === "active" && (
          <>
            <div className={cn("text-4xl font-semibold", daysLeft <= 2 ? "text-destructive" : "")}>
              {daysLeft < 0 ? "เลยกำหนด" : `${daysLeft} วัน`}
            </div>
            <div className="text-xs text-muted-foreground">หมดอายุ {thDateTime(b.expiresAt)}</div>
            {can("booking", "edit") && (
              <div className="mt-4 space-y-2">
                <Label className="text-xs">ปรับวันหมดอายุตามข้อตกลง</Label>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                    className="h-9"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      upd(
                        (bk) => {
                          bk.expiresAt = new Date(expDate + "T18:00").toISOString();
                        },
                        "ปรับวันหมดอายุการจอง",
                        { before: thDate(b.expiresAt), after: thDate(expDate) },
                      );
                      toast.success("ปรับวันหมดอายุแล้ว");
                    }}
                  >
                    บันทึก
                  </Button>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full text-destructive"
                  onClick={() => {
                    upd(
                      (bk, d) => {
                        bk.status = "expired";
                        bk.expireReason = "ลูกค้าไม่ชำระเงินตามกำหนด (จำลอง)";
                        bk.releaseState = "awaiting";
                        d.vehicles.find((x) => x.id === bk.vehicleId)!.releaseEvent = {
                          at: new Date().toISOString(),
                          reason: bk.expireReason,
                        };
                        d.tasks.push({
                          id: `T${Date.now()}`,
                          type: "payment",
                          title: "ตรวจสอบเงินจอง (หลุดจอง)",
                          date: new Date().toISOString(),
                          customerId: bk.customerId,
                          bookingId: bk.id,
                          assignee: bk.salesId,
                          branchId: bk.branchId,
                          status: "todo",
                        });
                      },
                      "หลุดจอง",
                      { before: "active", after: "expired" },
                    );
                    toast.warning("การจองหลุดแล้ว — สร้างงานติดตามเงินจองให้อัตโนมัติ");
                  }}
                >
                  จำลองหลุดจอง
                </Button>
              </div>
            )}
          </>
        )}
        {(b.status === "expired" || b.status === "cancelled") && (
          <div className="space-y-3">
            <StatusBadge tone="danger">หลุดจอง</StatusBadge>
            <Field label="เหตุผล">{b.expireReason}</Field>
            <Field label="สถานะรถ">
              {b.releaseState === "released" ? (
                <StatusBadge tone="success">ปล่อยรถแล้ว — พร้อมให้จองใหม่</StatusBadge>
              ) : (
                <StatusBadge tone="warning">รอผู้มีสิทธิ์อนุมัติปล่อยรถ</StatusBadge>
              )}
            </Field>
            {b.releaseState === "awaiting" &&
              (can("booking", "approve") ? (
                <Button
                  className="w-full"
                  onClick={() => {
                    const saved = upd(
                      (bk, d) => releaseBookingVehicle(d, bk.id),
                      "อนุมัติปล่อยรถจากการจอง",
                      { before: "reserved", after: "available" },
                    );
                    if (saved) toast.success("อนุมัติปล่อยรถแล้ว ตรวจความพร้อมได้ที่ Stock");
                  }}
                >
                  อนุมัติปล่อยรถ
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">
                  ต้องเป็น Branch Manager ขึ้นไปจึงจะอนุมัติปล่อยรถได้
                </p>
              ))}
          </div>
        )}
        {b.status === "closed" && (
          <div className="flex items-center gap-2 text-success">
            <CheckCircle2 className="size-5" /> ปิดการขายเรียบร้อย
          </div>
        )}
      </Panel>
    </div>
  );
}

function DocsTab({ b, upd }: { b: Booking; upd: Upd }) {
  const { state, roleId, branch, can } = useStore();
  const c = state.customers.find((x) => x.id === b.customerId)!;
  const [amloBusy, setAmloBusy] = useState(false);
  const runAmlo = () => {
    setAmloBusy(true);
    upd((bk) => {
      bk.amlo = { status: "checking" };
    }, "เริ่มตรวจสอบ AMLO (จำลอง)");
    setTimeout(() => {
      // first attempt on a booking previously errored → succeed on retry; otherwise deterministic by booking
      const outcomes = ["clear", "clear", "review", "error"] as const;
      const prev = b.amlo.status;
      const res =
        state.integrations.find((i) => i.id === "amlo")?.status !== "connected"
          ? "error"
          : prev === "error"
            ? "clear"
            : outcomes[(b.id.charCodeAt(b.id.length - 1) + (b.amlo.ref ? 1 : 0)) % 4]!;
      const ref = `AMLO-${Math.floor(Math.random() * 90000 + 10000)}`;
      upd(
        (bk) => {
          bk.amlo = { status: res, at: new Date().toISOString(), ref };
        },
        `ผลตรวจ AMLO (จำลอง): ${AMLO_STATUS[res][0]}`,
        { ref },
      );
      setAmloBusy(false);
      if (res === "error") toast.error("ระบบ AMLO ขัดข้อง (จำลอง) — กด Retry");
      else toast.success(`ผลจำลอง: ${AMLO_STATUS[res][0]}`);
    }, 1500);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <DocumentReview key={`${b.id}:${roleId}:${branch}`} booking={b} />

      <Panel
        title={
          <span className="flex items-center gap-2">
            <ShieldCheck className="size-4" /> ตรวจสอบ AMLO
          </span>
        }
        actions={<DemoTag label="ผลจำลอง" />}
      >
        <div className="flex items-center gap-3">
          <StatusBadge tone={AMLO_STATUS[b.amlo.status][1]}>
            {AMLO_STATUS[b.amlo.status][0]}
          </StatusBadge>
          {b.amlo.ref && (
            <span className="text-xs text-muted-foreground">
              Ref {b.amlo.ref} · {thDateTime(b.amlo.at)}
            </span>
          )}
        </div>
        <p className="mt-3 rounded-sm bg-demo/50 p-3 text-xs text-demo-foreground">
          ผลนี้เป็นผลจำลองสำหรับการสาธิตเท่านั้น ไม่ใช่ผลตรวจสอบจริง
          และไม่ถือเป็นการรับรองหรืออนุมัติทางกฎหมาย
        </p>
        {b.amlo.status === "review" && (
          <p className="mt-2 text-xs">
            รายละเอียดจำลอง: พบชื่อใกล้เคียง 1 รายการ (ความคล้าย 71%)
            ต้องให้เจ้าหน้าที่ตรวจสอบเพิ่มเติม
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {b.amlo.status === "error" ? (
            <Button disabled={amloBusy || !can("booking", "edit")} onClick={runAmlo}>
              <RotateCw className={cn("size-4", amloBusy && "animate-spin")} /> Retry
            </Button>
          ) : (
            <Button disabled={amloBusy || !can("booking", "edit")} onClick={runAmlo}>
              {amloBusy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ShieldCheck className="size-4" />
              )}{" "}
              ตรวจสอบ AMLO
            </Button>
          )}
          {(b.amlo.status === "review" || b.amlo.status === "error") && (
            <Button
              disabled={!can("booking", "edit")}
              variant="outline"
              onClick={() => {
                upd((bk, d) => {
                  if (
                    d.tasks.some(
                      (t) =>
                        t.bookingId === bk.id &&
                        t.title === "ตรวจสอบ AMLO เพิ่มเติม" &&
                        t.status !== "done",
                    )
                  )
                    return;
                  d.tasks.push({
                    id: `T${Date.now()}`,
                    type: "docs",
                    title: "ตรวจสอบ AMLO เพิ่มเติม",
                    date: new Date(Date.now() + 86400000).toISOString(),
                    customerId: bk.customerId,
                    bookingId: bk.id,
                    assignee: bk.salesId,
                    branchId: bk.branchId,
                    status: "todo",
                    step: 2,
                  });
                }, "สร้างงานตรวจสอบ AMLO เพิ่มเติม");
                toast.success("สร้างงานให้ผู้รับผิดชอบแล้ว");
              }}
            >
              สร้างงานตรวจสอบเพิ่มเติม
            </Button>
          )}
        </div>
      </Panel>

      <Panel title="ข้อมูลลูกค้า">
        <div className="grid grid-cols-2 gap-4">
          <Field label="ชื่อ">{c.name}</Field>
          <Field label="เลขบัตร">{c.idCard.slice(0, 6)}xxxxxx</Field>
          <Field label="อีเมล">{c.email}</Field>
          <Field label="สมาชิก">
            {c.tier} · {c.loyaltyId}
          </Field>
        </div>
      </Panel>
    </div>
  );
}

function PayTab({ b, upd }: { b: Booking; upd: Upd }) {
  const { state, can } = useStore();
  const cfg = { ...state.loyaltyConfig, pointValue: pointValueFor(b, state) };
  const c = state.customers.find((x) => x.id === b.customerId)!;
  const txs = state.loyaltyTx.filter((t) => t.bookingId === b.id);
  const remaining = Math.max(0, b.price - b.paid - b.pointsUsed * pointValueFor(b, state));
  const maxByRule = Math.floor((b.price * cfg.maxBurnPct) / 100 / cfg.pointValue) - b.pointsUsed;
  const usable = Math.max(0, Math.min(c.points, maxByRule, Math.floor(remaining / cfg.pointValue)));
  const [pts, setPts] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pay, setPay] = useState("");
  const n = Number(pts);
  const err = !pts
    ? ""
    : !Number.isInteger(n) || n <= 0
      ? "กรุณากรอกจำนวน Point เป็นจำนวนเต็มบวก"
      : n > c.points
        ? `เกิน Point คงเหลือ (${num(c.points)})`
        : n > usable
          ? `เกินเงื่อนไขการใช้ Point สูงสุด (${num(usable)} Point · ไม่เกิน ${cfg.maxBurnPct}% ของราคารถ)`
          : "";
  const pending = txs.some((t) => t.type === "Burn" && t.status === "Pending");

  const burn = () => {
    if (err || !n || pending || busy) return;
    setConfirm(false);
    setBusy(true);
    const ref = refId("LYT-DEMO");
    const txId = `LT-${Date.now()}`;
    const created = upd(
      (bk, d) => {
        if (bk.status !== "active" || bk.refund) throw new Error("การจองนี้ไม่สามารถใช้ Point ได้");
        if (
          d.loyaltyTx.some(
            (t) => t.bookingId === bk.id && t.type === "Burn" && t.status === "Pending",
          )
        )
          throw new Error("มีคำขอ Burn รอดำเนินการอยู่แล้ว");
        bk.pointValue ??= cfg.pointValue;
        bk.formulaVersion ??= cfg.version;
        d.loyaltyTx.unshift({
          id: txId,
          customerId: bk.customerId,
          bookingId: bk.id,
          type: "Burn",
          points: n,
          value: n * pointValueFor(bk, d),
          status: "Pending",
          ref,
          at: new Date().toISOString(),
          match: "pending",
          formulaVersion: bk.formulaVersion,
        });
      },
      `ส่งคำขอ Burn ${num(n)} Point`,
      { ref },
    );
    if (!created) {
      setBusy(false);
      return;
    }
    setTimeout(() => {
      let success = false;
      const saved = upd(
        (_bk, d) => {
          success = settleBurn(d, txId);
        },
        `รับผล Burn ${num(n)} Point`,
        { ref },
      );
      setBusy(false);
      setPts("");
      if (saved) {
        if (!success) toast.error("ระบบ Loyalty จำลองขัดข้อง — Retry ที่ Integrations");
        else toast.success(`ใช้ ${num(n)} Point สำเร็จ (Ref ${ref})`);
      }
    }, 1500);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel title="สรุปการชำระเงิน">
        <div className="space-y-2 text-sm">
          {[
            ["ราคารถ", thb(b.price)],
            ["ชำระแล้ว (รวมเงินจอง)", thb(b.paid)],
            ["ส่วนลดจาก Point", `-${thb(b.pointsUsed * pointValueFor(b, state))}`],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span className="text-muted-foreground">{k}</span>
              <span>{v}</span>
            </div>
          ))}
          <div className="flex justify-between border-t pt-2 text-base font-semibold">
            <span>ยอดคงเหลือที่ต้องชำระ</span>
            <span>{thb(remaining)}</span>
          </div>
        </div>
        {remaining > 0 && can("booking", "edit") && b.status === "active" && !b.refund && (
          <div className="mt-4 flex gap-2">
            <Input
              type="number"
              placeholder="บันทึกรับชำระ (บาท)"
              value={pay}
              onChange={(e) => setPay(e.target.value)}
              className="h-9"
            />
            <Button
              size="sm"
              onClick={() => {
                const a = Number(pay);
                if (!Number.isFinite(a) || a <= 0 || a > remaining) {
                  toast.error(`ยอดต้องอยู่ระหว่าง 1 – ${thb(remaining)}`);
                  return;
                }
                const saved = upd((bk, d) => receivePayment(d, bk.id, a), `รับชำระเงิน ${thb(a)}`);
                if (saved) {
                  setPay("");
                  toast.success("บันทึกรับชำระแล้ว");
                }
              }}
            >
              บันทึก
            </Button>
          </div>
        )}
      </Panel>
      <Panel
        title={
          <span className="flex items-center gap-2">
            <Gift className="size-4" /> ใช้ Point ชำระเงิน
          </span>
        }
        actions={<DemoTag />}
      >
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-sm bg-muted p-3">
            <div className="text-xs text-muted-foreground">Point คงเหลือ</div>
            <div className="text-lg font-semibold">{num(c.points)}</div>
          </div>
          <div className="rounded-sm bg-muted p-3">
            <div className="text-xs text-muted-foreground">ใช้ได้สูงสุด</div>
            <div className="text-lg font-semibold">{num(usable)}</div>
          </div>
          <div className="rounded-sm bg-muted p-3">
            <div className="text-xs text-muted-foreground">อัตรา</div>
            <div className="text-lg font-semibold">1 = {thb(cfg.pointValue)}</div>
          </div>
        </div>
        <div className="mt-4 space-y-1.5">
          <Label>จำนวน Point ที่ต้องการใช้</Label>
          <Input
            type="number"
            value={pts}
            onChange={(e) => setPts(e.target.value)}
            aria-invalid={!!err}
            disabled={pending || busy || !can("booking", "edit")}
          />
          {err ? (
            <p className="text-xs text-destructive">{err}</p>
          ) : (
            n > 0 && (
              <p className="text-xs text-muted-foreground">
                มูลค่า {thb(n * cfg.pointValue)} · ยอดที่ยังต้องชำระ{" "}
                {thb(remaining - n * cfg.pointValue)}
              </p>
            )
          )}
          {pending && (
            <p className="text-xs text-warning-foreground">
              มีรายการ Burn ที่ Pending อยู่ — ป้องกันการทำรายการซ้ำ
            </p>
          )}
        </div>
        <Button
          className="mt-3 w-full"
          disabled={
            !can("booking", "edit") ||
            b.status !== "active" ||
            !!b.refund ||
            !n ||
            !!err ||
            busy ||
            pending
          }
          onClick={() => setConfirm(true)}
        >
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" /> กำลังส่งไปยังระบบ Loyalty...
            </>
          ) : (
            "ใช้ Point"
          )}
        </Button>
      </Panel>
      <Panel title="ธุรกรรม Loyalty ของการจองนี้" className="lg:col-span-2">
        {txs.length ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2">วันเวลา</th>
                <th>ประเภท</th>
                <th>Point</th>
                <th>มูลค่า</th>
                <th>Reference ID</th>
                <th>สูตร</th>
                <th>สถานะ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {txs.map((t) => (
                <tr key={t.id} className="border-b last:border-0">
                  <td className="py-2 text-xs">{thDateTime(t.at)}</td>
                  <td>{t.type}</td>
                  <td>{num(t.points)}</td>
                  <td>{thb(t.value)}</td>
                  <td className="font-mono text-xs">{t.ref}</td>
                  <td className="text-xs">{t.formulaVersion}</td>
                  <td>
                    <StatusBadge tone={LTX_STATUS[t.status][1]}>{t.status}</StatusBadge>
                  </td>
                  <td>
                    {t.type === "Burn" &&
                      t.status === "Success" &&
                      b.status === "active" &&
                      !b.refund &&
                      can("booking", "approve") && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            const saved = upd(
                              (_bk, d) => reverseBurn(d, t.id),
                              `Reverse Point ${num(t.points)}`,
                              { ref: t.ref },
                            );
                            if (saved) toast.success("Reverse Point แล้ว");
                          }}
                        >
                          Reverse
                        </Button>
                      )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState title="ยังไม่มีธุรกรรม" hint="" />
        )}
      </Panel>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการใช้ Point</AlertDialogTitle>
            <AlertDialogDescription>
              ใช้ {num(n)} Point (มูลค่า {thb(n * cfg.pointValue)}) จากสมาชิก {c.loyaltyId}{" "}
              สำหรับการจอง {b.id} — ระบบจะส่งคำขอ Burn ไปยังระบบ Loyalty (จำลอง)
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={burn}>ยืนยัน</AlertDialogAction>
          </AlertDialogFooter>
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
  if (step === 4 && remainingPayment(b, d) > 0) return "ยังชำระเงินไม่ครบ";
  if (step === 5 && d.serviceOrders.some((s) => s.vehicleId === b.vehicleId && s.status !== "done"))
    return "Service Order ของรถยังไม่เสร็จ";
  if (step === 6 && !b.docs.some((doc) => doc.type === "ใบส่งมอบรถ"))
    return "ยังไม่ได้ออกใบส่งมอบรถ";
  if (step === 6 && !d.plates.some((p) => p.bookingId === b.id && p.status === "matched"))
    return "ยังไม่ได้จับคู่ป้ายแดง";
  return null;
}

function FlowTab({ b, upd }: { b: Booking; upd: Upd }) {
  const { state, can, salesName } = useStore();
  const tasks = state.tasks.filter((t) => t.bookingId === b.id);
  const block = checkStep(b, state);
  const [enforce, setEnforce] = useState(true);
  const advance = (): void => {
    if (enforce && block) return void toast.error(`ยังไม่สามารถไปขั้นตอนถัดไป: ${block}`);
    const saved = upd(
      (bk, d) => {
        if (bk.status !== "active" || bk.step !== b.step)
          throw new Error("ขั้นตอนเปลี่ยนแล้ว กรุณาตรวจสอบอีกครั้ง");
        if (enforce) {
          const blocked = checkStep(bk, d);
          if (blocked) throw new Error(blocked);
        }
        if (bk.step === 7) {
          if (!can("booking", "approve")) throw new Error("รอผู้จัดการอนุมัติปิดการขาย");
          bk.status = "closed";
          const veh = d.vehicles.find((x) => x.id === bk.vehicleId)!;
          veh.status = "sold";
          veh.ready = false;
          if (!d.commissions.some((c) => c.bookingId === bk.id)) calculateCommission(d, bk.id);
          if (
            !d.loyaltyTx.some(
              (t) => t.bookingId === bk.id && t.type === "Earn" && t.status === "Success",
            )
          ) {
            const customer = d.customers.find((c) => c.id === bk.customerId)!;
            const points = simulateLoyalty(
              d.loyaltyConfig,
              bk.price,
              customer.tier,
              d.loyaltyConfig.campaignMult,
            ).result;
            customer.points += points;
            customer.extPoints += points;
            d.loyaltyTx.unshift({
              id: refId("LT"),
              customerId: customer.id,
              bookingId: bk.id,
              type: "Earn",
              points,
              value: 0,
              status: "Success",
              ref: refId("LYT-DEMO"),
              at: new Date().toISOString(),
              match: "matched",
              formulaVersion: d.loyaltyConfig.version,
            });
          }
          d.tasks
            .filter((t) => t.bookingId === bk.id && t.type !== "plate")
            .forEach((t) => {
              t.status = "done";
            });
          notify(d, `closed:${bk.id}`, {
            type: "Commission",
            title: "การขายพร้อมส่งเบิก Commission",
            detail: bk.id,
            link: "/sales/commission",
            branchId: bk.branchId,
            assignee: bk.salesId,
            priority: "medium",
          });
          return;
        }
        if (bk.step === 5) {
          const veh = d.vehicles.find((x) => x.id === bk.vehicleId)!;
          if (veh.status === "prep") veh.status = "reserved";
        }
        bk.step += 1;
      },
      b.step === 7 ? "ปิดการขาย" : `ผ่านขั้นตอน “${WORKFLOW_STEPS[b.step]}”`,
      { before: WORKFLOW_STEPS[b.step]!, after: WORKFLOW_STEPS[b.step + 1] ?? "ปิดการขาย" },
    );
    if (saved) toast.success("อัปเดตขั้นตอนแล้ว");
  };
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Panel title="ขั้นตอน Workflow การขาย" className="lg:col-span-2" bodyClass="p-0">
        <ul>
          {WORKFLOW_STEPS.map((s, i) => {
            const done = b.status === "closed" || i < b.step;
            const cur = b.status !== "closed" && i === b.step;
            return (
              <li
                key={s}
                className={cn("flex gap-4 border-b px-5 py-3 last:border-0", cur && "bg-accent/40")}
              >
                <div className="w-6 pt-0.5 text-sm font-semibold text-muted-foreground">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{s}</span>
                    <StatusBadge
                      tone={done ? "success" : cur ? (block ? "warning" : "info") : "neutral"}
                    >
                      {done
                        ? "เสร็จสิ้น"
                        : cur
                          ? block
                            ? "รอข้อมูล"
                            : "กำลังดำเนินการ"
                          : "ยังไม่เริ่ม"}
                    </StatusBadge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    ผู้รับผิดชอบ:{" "}
                    {i === 2 || i === 4
                      ? "Finance"
                      : i === 5
                        ? "Service Officer"
                        : i === 7
                          ? "Branch Manager"
                          : salesName(b.salesId)}{" "}
                    · เงื่อนไข: {STEP_REQUIREMENTS[i]!.join(", ")}
                  </div>
                  {cur && block && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-destructive">
                      <AlertTriangle className="size-3" /> ข้อมูลที่ยังขาด: {block}
                    </div>
                  )}
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
              <Button
                className="w-full"
                disabled={b.step === 7 ? !can("booking", "approve") : !can("booking", "edit")}
                onClick={advance}
              >
                {b.step === 7 ? "ปิดการขาย" : "ไปขั้นตอนถัดไป"} <ArrowRight className="size-4" />
              </Button>
              <label className="mt-3 flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={enforce}
                  onChange={(e) => setEnforce(e.target.checked)}
                />{" "}
                บังคับตรวจเงื่อนไขก่อนผ่านขั้นตอน (ปรับได้)
              </label>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">การจองไม่อยู่ในสถานะดำเนินการ</p>
          )}
        </Panel>
        <Panel title={`งานที่เกี่ยวข้อง (${tasks.length})`} bodyClass="p-0">
          {tasks.length ? (
            tasks.map((t) => (
              <div key={t.id} className="border-b px-4 py-2.5 last:border-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm">{t.title}</span>
                  <StatusBadge tone={TASK_STATUS[t.status][1]}>
                    {TASK_STATUS[t.status][0]}
                  </StatusBadge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {TASK_TYPE[t.type]} · {thDateTime(t.date)} · {salesName(t.assignee)}
                </div>
              </div>
            ))
          ) : (
            <EmptyState title="ไม่มีงาน" hint="" />
          )}
        </Panel>
      </div>
    </div>
  );
}

const DOC_TYPES = [
  "ใบจอง",
  "สัญญาซื้อขาย",
  "ใบรับเงิน",
  "ใบตรวจรับรถ",
  "ใบส่งมอบรถ",
  "แบบฟอร์มยืมป้ายแดง",
];

function ContractTab({ b, upd }: { b: Booking; upd: Upd }) {
  const { state, user, can, branchName, salesName } = useStore();
  const c = state.customers.find((x) => x.id === b.customerId)!;
  const v = state.vehicles.find((x) => x.id === b.vehicleId)!;
  const [signIdx, setSignIdx] = useState<number | null>(null);
  const [doc, setDoc] = useState<string | null>(null);
  const plate = state.plates.find((p) => p.bookingId === b.id);

  const docHtml = (
    t: string,
  ) => `<h1>${escapeHtml(t)}</h1><div class="muted">${escapeHtml(branchName(b.branchId))} · เลขที่ ${escapeHtml(b.id)}-${DOC_TYPES.indexOf(t) + 1} · วันที่ ${thDate(new Date().toISOString())}</div><div class="bar"></div>
<table><tr><th>ลูกค้า</th><td>${escapeHtml(c.name)}</td><th>เบอร์โทร</th><td>${maskPhone(c.phone)}</td></tr>
<tr><th>รถ</th><td>${escapeHtml(v.model)}</td><th>สี/ปี</th><td>${escapeHtml(v.color)} / ${v.year}</td></tr>
<tr><th>VIN</th><td colspan="3">${escapeHtml(v.vin)}</td></tr>
<tr><th>ราคา</th><td>${thb(b.price)}</td><th>เงินจอง</th><td>${thb(b.deposit)}</td></tr>
<tr><th>ชำระแล้ว</th><td>${thb(b.paid)}</td><th>ส่วนลด Point</th><td>${thb(b.pointsUsed * pointValueFor(b, state))}</td></tr>
<tr><th>Sales</th><td>${escapeHtml(salesName(b.salesId))}</td><th>นัดส่งมอบ</th><td>${thDate(b.deliveryAt)}</td></tr>
${t === "แบบฟอร์มยืมป้ายแดง" ? `<tr><th>ป้ายแดง</th><td colspan="3">${escapeHtml(plate?.number ?? "-")}</td></tr>` : ""}</table>
<p style="margin-top:40px;display:flex;justify-content:space-between"><span>ลงชื่อ ................................ ผู้ซื้อ</span><span>ลงชื่อ ................................ ผู้ขาย</span></p>`;

  const issue = (t: string, mode: "print" | "pdf") => {
    if (!can("booking", "export")) {
      toast.error("ไม่มีสิทธิ์ออกเอกสาร");
      return;
    }
    if (!printHtml(`${t} ${b.id}`, docHtml(t))) {
      toast.error("กรุณาอนุญาตหน้าต่าง Pop-up เพื่อพิมพ์เอกสาร");
      return;
    }
    upd((bk) => {
      const prev = bk.docs.filter((x) => x.type === t).length;
      bk.docs.unshift({ type: t, version: prev + 1, at: new Date().toISOString(), by: user.name });
    }, `ออกเอกสาร ${t}`);
    toast.success(
      mode === "pdf"
        ? "เปิดหน้าพิมพ์แล้ว — เลือก “Save as PDF” เพื่อดาวน์โหลด"
        : "ส่งเอกสารไปพิมพ์แล้ว",
    );
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel
        title={
          <span className="flex items-center gap-2">
            <PenLine className="size-4" /> E-Signature · สัญญาซื้อขาย
          </span>
        }
        actions={<DemoTag />}
      >
        <div className="mb-3 flex items-center gap-2">
          <StatusBadge tone={ESIGN_STATUS[b.esign.status][1]}>
            {ESIGN_STATUS[b.esign.status][0]}
          </StatusBadge>
        </div>
        <ol className="space-y-2">
          {b.esign.signers.map((s, i) => {
            const canSign =
              !s.signedAt &&
              b.esign.signers.slice(0, i).every((x) => x.signedAt) &&
              b.esign.status !== "draft";
            return (
              <li key={i} className="flex items-center gap-3 rounded-sm border p-3">
                <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <div className="text-sm font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.role}
                    {s.signedAt && ` · ลงนาม ${thDateTime(s.signedAt)}`}
                  </div>
                </div>
                {s.signedAt ? (
                  <StatusBadge tone="success">ลงนามแล้ว</StatusBadge>
                ) : canSign ? (
                  <Button
                    size="sm"
                    disabled={!can("booking", "edit")}
                    onClick={() => setSignIdx(i)}
                  >
                    ลงนาม
                  </Button>
                ) : (
                  <StatusBadge>รอคิว</StatusBadge>
                )}
              </li>
            );
          })}
        </ol>
        <div className="mt-4 flex gap-2">
          {b.esign.status === "draft" && (
            <Button
              disabled={!can("booking", "edit")}
              onClick={() => {
                upd((bk) => {
                  bk.esign.status = "pending";
                }, "ส่งสัญญาให้ลงนาม (E-Signature)");
                toast.success("ส่งเอกสารลงนามแล้ว");
              }}
            >
              ส่งให้ลงนาม
            </Button>
          )}
          {b.esign.status === "done" && (
            <Button
              disabled={!can("booking", "export")}
              variant="outline"
              onClick={() => issue("สัญญาซื้อขาย", "pdf")}
            >
              <Download className="size-4" /> ดาวน์โหลดสัญญาที่ลงนามแล้ว
            </Button>
          )}
        </div>
      </Panel>

      <Panel
        title={
          <span className="flex items-center gap-2">
            <FileText className="size-4" /> Document Center
          </span>
        }
      >
        <div className="grid grid-cols-2 gap-2">
          {DOC_TYPES.map((t) => {
            const issued = b.docs.filter((x) => x.type === t);
            return (
              <button
                key={t}
                onClick={() => setDoc(t)}
                className="rounded-sm border p-3 text-left hover:border-primary"
              >
                <div className="text-sm font-medium">{t}</div>
                <div className="mt-1">
                  {issued.length ? (
                    <StatusBadge tone="success">ออกแล้ว v{issued[0]!.version}</StatusBadge>
                  ) : (
                    <StatusBadge>ยังไม่ออก</StatusBadge>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        <div className="mt-4">
          <div className="mb-2 text-xs font-medium text-muted-foreground">ประวัติการออกเอกสาร</div>
          {b.docs.length ? (
            <ul className="space-y-1 text-xs">
              {b.docs.map((x, i) => (
                <li key={i}>
                  {x.type} v{x.version} · {thDateTime(x.at)} · {x.by}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">ยังไม่มี</p>
          )}
        </div>
      </Panel>

      <Panel title="การส่งมอบ & ป้ายแดง" className="lg:col-span-2">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="นัดส่งมอบ">{thDateTime(b.deliveryAt)}</Field>
          <Field label="ป้ายแดง">
            {plate ? (
              plate.number
            ) : (
              <span className="text-muted-foreground">
                ยังไม่จับคู่ — จัดการได้ที่{" "}
                <Link to="/stock/red-plates" className="text-primary">
                  Red Plate Management
                </Link>
              </span>
            )}
          </Field>
          <Field label="สถานะรถ">{v.ready ? "พร้อมส่งมอบ" : (v.readyNote ?? "-")}</Field>
        </div>
      </Panel>

      <Dialog open={!!doc} onOpenChange={(o) => !o && setDoc(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Preview: {doc}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto rounded-sm border bg-card p-6 text-sm">
            <DemoTag label="เอกสารตัวอย่างสำหรับ" />
            {doc && (
              <div
                className="prose-sm mt-3 [&_table]:mt-3 [&_table]:w-full [&_td]:border [&_td]:p-1.5 [&_th]:border [&_th]:bg-muted [&_th]:p-1.5 [&_th]:text-left [&_h1]:text-lg [&_h1]:font-semibold [&_.bar]:my-3 [&_.bar]:h-1 [&_.bar]:m-stripe [&_.muted]:text-xs [&_.muted]:text-muted-foreground"
                dangerouslySetInnerHTML={{ __html: docHtml(doc) }}
              />
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              disabled={!can("booking", "export")}
              variant="outline"
              onClick={() => doc && issue(doc, "pdf")}
            >
              <Download className="size-4" /> Download PDF
            </Button>
            <Button disabled={!can("booking", "export")} onClick={() => doc && issue(doc, "print")}>
              <Printer className="size-4" /> Print
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <SignaturePad
        open={signIdx !== null}
        name={signIdx !== null ? b.esign.signers[signIdx]!.name : ""}
        onClose={() => setSignIdx(null)}
        onSign={() => {
          const i = signIdx!;
          upd((bk) => {
            bk.esign.signers[i]!.signedAt = new Date().toISOString();
            const all = bk.esign.signers.every((s) => s.signedAt);
            bk.esign.status = all ? "done" : "partial";
          }, `ลงนามเอกสาร: ${b.esign.signers[i]!.name}`);
          setSignIdx(null);
          toast.success("ลงนามสำเร็จ");
        }}
      />
    </div>
  );
}

function SignaturePad({
  open,
  name,
  onClose,
  onSign,
}: {
  open: boolean;
  name: string;
  onClose: () => void;
  onSign: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [drawn, setDrawn] = useState(false);
  const drawing = useRef(false);
  useEffect(() => {
    if (open) setDrawn(false);
  }, [open]);
  const pos = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ลงนาม: {name}</DialogTitle>
        </DialogHeader>
        <canvas
          ref={ref}
          width={440}
          height={180}
          className="w-full touch-none rounded-sm border bg-muted"
          onPointerDown={(e) => {
            drawing.current = true;
            const ctx = ref.current!.getContext("2d")!;
            const [x, y] = pos(e);
            ctx.beginPath();
            ctx.moveTo(x, y);
          }}
          onPointerMove={(e) => {
            if (!drawing.current) return;
            const ctx = ref.current!.getContext("2d")!;
            ctx.lineWidth = 2;
            ctx.strokeStyle = "#1c3a8c";
            const [x, y] = pos(e);
            ctx.lineTo(x, y);
            ctx.stroke();
            setDrawn(true);
          }}
          onPointerUp={() => (drawing.current = false)}
        />
        <p className="text-xs text-muted-foreground">วาดลายเซ็นในกรอบ (จำลอง E-Signature)</p>
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              ref.current!.getContext("2d")!.clearRect(0, 0, 440, 180);
              setDrawn(false);
            }}
          >
            ล้าง
          </Button>
          <Button disabled={!drawn} onClick={onSign}>
            ยืนยันลายเซ็น
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RefundTab({ b }: { b: Booking; upd: Upd }) {
  return <RefundWorkflow bookingId={b.id} />;
}
