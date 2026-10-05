import { useState } from "react";
import { useStore } from "@/lib/store";
import type { Refund } from "@/lib/mock/types";
import { advanceRefund, requestRefund } from "@/lib/mock/service";
import { thb, num, thDateTime } from "@/lib/format";
import { REFUND_STATUS } from "@/lib/labels";
import { Field, Panel, StatusBadge, Timeline, WorkflowStepper } from "./ui-kit";
import { ConfirmAction, useDemoAction } from "./actions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
const CASES: Record<Refund["branch"], string> = {
  A: "คืนเต็มจำนวน",
  B: "คืนบางส่วน",
  C: "ไม่เข้าเงื่อนไขคืนเงิน",
  D: "คืนเงินและ Point แยกส่วน",
  E: "ส่งให้สำนักงานใหญ่ / อีกสาขาดำเนินการ",
};
export function RefundWorkflow({ bookingId }: { bookingId: string }) {
  const { state, user, can, branchName } = useStore();
  const run = useDemoAction();
  const b = state.bookings.find((b) => b.id === bookingId)!;
  const r = b.refund;
  const [caseId, setCase] = useState<Refund["branch"]>(b.pointsUsed ? "D" : "A");
  const [deduction, setDeduction] = useState("0");
  const [deductionNote, setDeductionNote] = useState("");
  const [reason, setReason] = useState("");
  const [branch, setBranch] = useState(b.branchId);
  const [channel, setChannel] = useState("");
  const [evidence, setEvidence] = useState("");
  const step = (reject = false) =>
    run(
      "booking",
      r?.step === 1 ? "edit" : "approve",
      "Refund",
      { id: r?.id ?? b.id, branchId: r?.branchId ?? b.branchId, salesId: b.salesId },
      "อัปเดตคำขอคืนเงินแล้ว",
      (d) => advanceRefund(d, b.id, user.name, reject, channel, evidence, r?.step),
    );
  return !r ? (
    <Panel title="ขอคืนเงินจอง">
      <div className="max-w-xl space-y-4">
        <Label>แขนงการคืนเงิน</Label>
        <Select value={caseId} onValueChange={(v) => setCase(v as Refund["branch"])}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(CASES).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {value} · {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {caseId === "B" && (
          <>
            <Input
              aria-label="จำนวนหักคืนเงิน"
              type="number"
              placeholder="จำนวนหัก"
              value={deduction}
              onChange={(e) => setDeduction(e.target.value)}
            />
            <Input
              aria-label="เหตุผลหักคืนเงิน"
              placeholder="รายการและเหตุผลหัก"
              value={deductionNote}
              onChange={(e) => setDeductionNote(e.target.value)}
            />
          </>
        )}
        {caseId === "E" && (
          <Select value={branch} onValueChange={setBranch}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {state.branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Textarea
          aria-label="เหตุผลขอคืนเงิน"
          placeholder="เหตุผลขอคืนเงิน (อย่างน้อย 5 ตัวอักษร)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <p className="text-sm">
          เงินจอง {thb(b.deposit)} · Point เกี่ยวข้อง {num(b.pointsUsed)} · เงื่อนไขตัวอย่างปรับได้
        </p>
        <ConfirmAction
          disabled={!can("booking", "edit") || !["active", "expired"].includes(b.status)}
          description="ยื่นคำขอคืนเงินตามจำนวน เหตุผล และสาขาที่เลือก"
          onConfirm={() =>
            run("booking", "edit", "Refund", b, "ยื่นคำขอคืนเงินแล้ว", (d) =>
              requestRefund(
                d,
                b.id,
                {
                  branch: caseId,
                  deduction: Number(deduction),
                  deductionNote,
                  reason,
                  branchId: caseId === "E" ? branch : b.branchId,
                },
                user.name,
              ),
            )
          }
        >
          ยื่นคำขอคืนเงิน
        </ConfirmAction>
      </div>
    </Panel>
  ) : (
    <div className="grid gap-5 lg:grid-cols-3">
      <Panel
        title={`Refund ${r.id}`}
        className="lg:col-span-2"
        actions={
          <StatusBadge tone={REFUND_STATUS[r.status][1]}>{REFUND_STATUS[r.status][0]}</StatusBadge>
        }
      >
        <WorkflowStepper
          steps={["ขอคืนเงิน", "ตรวจสอบ", "อนุมัติ", "คืนเงิน", "หลักฐาน", "ปิดคำขอ"]}
          current={r.step}
        />
        <div className="my-5 grid grid-cols-2 gap-4">
          <Field label="แขนง">{CASES[r.branch]}</Field>
          <Field label="สาขารับเงิน / คืนเงิน">
            {branchName(b.branchId)} / {branchName(r.branchId)}
          </Field>
          <Field label="เงินจองเดิม / ยอดขอคืน">
            {thb(b.deposit)} / {thb(r.amount + r.deduction)}
          </Field>
          <Field label="รายการหัก">
            {thb(r.deduction)} · {r.deductionNote ?? "—"}
          </Field>
          <Field label="เงินคืนสุทธิ">{thb(r.amount)}</Field>
          <Field label="Point คืนแยก">{num(r.pointsReturn)}</Field>
          <Field label="เหตุผล">{r.reason}</Field>
          <Field label="ผู้อนุมัติ">{r.approver ?? "รออนุมัติ"}</Field>
          <Field label="ช่องทาง / หลักฐาน">
            {r.channel ?? "—"} / {r.evidence ?? "—"}
          </Field>
        </div>
        {r.step === 3 && r.status === "approved" && (
          <Input
            aria-label="ช่องทางคืนเงิน"
            placeholder="ช่องทางคืนเงิน เช่น โอนธนาคาร"
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
          />
        )}
        {r.step === 4 && (
          <Input
            aria-label="หลักฐานคืนเงิน"
            placeholder="หลักฐานตัวอย่าง เช่น SLIP-001"
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
          />
        )}
        <div className="mt-4 flex gap-3">
          {r.status !== "closed" && (
            <ConfirmAction
              disabled={!can("booking", r.step === 1 ? "edit" : "approve")}
              description="ดำเนินการคำขอคืนเงินตามขั้นตอน ป้องกันการคืนเงินและ Point ซ้ำ"
              onConfirm={() => step()}
            >
              {r.step === 1
                ? "ยืนยันตรวจสอบเงื่อนไข"
                : r.step === 2
                  ? r.branch === "C"
                    ? "บันทึกผลไม่เข้าเงื่อนไข"
                    : "อนุมัติ"
                  : r.step === 3 && r.status === "approved"
                    ? "ดำเนินการคืนเงิน"
                    : r.step === 4
                      ? "บันทึกหลักฐาน"
                      : "ปิดคำขอ"}
            </ConfirmAction>
          )}
          {r.step === 2 && r.branch !== "C" && (
            <ConfirmAction
              disabled={!can("booking", "approve")}
              description="บันทึกผลไม่อนุมัติคืนเงิน"
              onConfirm={() => step(true)}
            >
              ไม่อนุมัติ
            </ConfirmAction>
          )}
        </div>
      </Panel>
      <Panel title="ประวัติคำขอ">
        <Timeline
          items={r.history.map((h) => ({
            at: h.at,
            title: h.text,
            sub: `${h.by} · ${thDateTime(h.at)}`,
          }))}
        />
      </Panel>
    </div>
  );
}
