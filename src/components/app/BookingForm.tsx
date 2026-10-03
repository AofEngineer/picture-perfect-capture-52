import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useStore } from "@/lib/store";
import { thb } from "@/lib/format";
import { toast } from "sonner";

export function BookingForm({ open, onOpenChange, vehicleId }: { open: boolean; onOpenChange: (o: boolean) => void; vehicleId?: string }) {
  const { state, mutate, user, allowedBranches } = useStore();
  const navigate = useNavigate();
  const [customerId, setCustomer] = useState("");
  const [vId, setVId] = useState(vehicleId ?? "");
  const [deposit, setDeposit] = useState("50000");
  const [days, setDays] = useState("14");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const vehicleOptions = state.vehicles.filter((v) => (v.status === "available" || v.id === vehicleId) && allowedBranches.includes(v.branchId));
  const v = state.vehicles.find((x) => x.id === (vId || vehicleId));

  const submit = () => {
    const e: Record<string, string> = {};
    if (!customerId) e.customer = "กรุณาเลือกลูกค้า";
    if (!v) e.vehicle = "กรุณาเลือกรถ";
    else if (v.status !== "available") e.vehicle = "รถคันนี้ถูกจองหรือไม่พร้อมขาย ไม่สามารถจองซ้ำได้";
    else if (state.bookings.some((b) => b.vehicleId === v.id && b.status === "active")) e.vehicle = "รถคันนี้มีการจองที่ยังดำเนินการอยู่";
    const dep = Number(deposit);
    if (!dep || dep < 10000) e.deposit = "เงินจองต้องไม่น้อยกว่า ฿10,000";
    if (v && dep > v.price) e.deposit = "เงินจองต้องไม่เกินราคารถ";
    const dd = Number(days);
    if (!dd || dd < 1 || dd > 60) e.days = "ระยะเวลาการจองต้องอยู่ระหว่าง 1–60 วัน";
    setErrors(e);
    if (Object.keys(e).length || !v) return;
    const c = state.customers.find((x) => x.id === customerId)!;
    const id = `BK-2026-${String(101 + state.bookings.length).padStart(4, "0")}`;
    const now = new Date();
    const exp = new Date(now.getTime() + dd * 86400000);
    const salesId = user.salesId ?? c.salesId;
    const s = state.sales.find((x) => x.id === salesId)!;
    mutate((d) => {
      d.bookings.unshift({
        id, customerId, vehicleId: v.id, salesId, branchId: v.branchId, createdAt: now.toISOString(), deposit: dep, price: v.price, expiresAt: exp.toISOString(),
        step: 1, status: "active", amlo: { status: "none" }, ocr: { confirmed: false },
        esign: { status: "draft", signers: [{ name: c.name, role: "ผู้ซื้อ" }, { name: s.name, role: "Sales" }, { name: "ณัฐพล รุ่งเรือง", role: "ผู้จัดการสาขา" }] },
        pointsUsed: 0, paid: dep, docs: [], history: [{ at: now.toISOString(), by: user.name, text: "สร้างการจอง" }],
      });
      const veh = d.vehicles.find((x) => x.id === v.id)!;
      veh.status = "reserved";
      veh.history.unshift({ at: now.toISOString(), text: `จองโดย ${id}` });
      d.tasks.push({ id: `T${Date.now()}`, type: "docs", title: "ตรวจสอบข้อมูลและเอกสาร", date: new Date(now.getTime() + 86400000).toISOString(), customerId, bookingId: id, assignee: salesId, branchId: v.branchId, status: "todo", step: 1 });
    }, { branchId: v.branchId, action: "สร้าง Booking", entity: "Booking", entityId: id, after: `${c.name} / ${v.model} / มัดจำ ${thb(dep)}` });
    toast.success(`สร้างการจอง ${id} สำเร็จ`);
    onOpenChange(false);
    navigate({ to: "/bookings/$id", params: { id } });
  };

  const Err = ({ k }: { k: string }) => (errors[k] ? <p className="text-xs text-destructive">{errors[k]}</p> : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>สร้างการจองใหม่</DialogTitle>
          <DialogDescription>ระบบจะตรวจสอบความพร้อมของรถและป้องกันการจองซ้ำอัตโนมัติ</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>ลูกค้า *</Label>
            <Select value={customerId} onValueChange={setCustomer}>
              <SelectTrigger aria-invalid={!!errors.customer}><SelectValue placeholder="เลือกลูกค้า" /></SelectTrigger>
              <SelectContent>{state.customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} · {c.tier}</SelectItem>)}</SelectContent>
            </Select>
            <Err k="customer" />
          </div>
          <div className="space-y-1.5">
            <Label>รถ *</Label>
            <Select value={vId} onValueChange={setVId}>
              <SelectTrigger aria-invalid={!!errors.vehicle}><SelectValue placeholder="เลือกรถพร้อมขาย" /></SelectTrigger>
              <SelectContent>{vehicleOptions.map((x) => <SelectItem key={x.id} value={x.id}>{x.code} · {x.model} · {x.color} · {thb(x.price)}</SelectItem>)}</SelectContent>
            </Select>
            <Err k="vehicle" />
            {v && <p className="text-xs text-muted-foreground">VIN {v.vin} · {state.branches.find((b) => b.id === v.branchId)?.name}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>เงินจอง (บาท) *</Label><Input type="number" value={deposit} onChange={(e) => setDeposit(e.target.value)} aria-invalid={!!errors.deposit} /><Err k="deposit" /></div>
            <div className="space-y-1.5"><Label>อายุการจอง (วัน) *</Label><Input type="number" value={days} onChange={(e) => setDays(e.target.value)} aria-invalid={!!errors.days} /><Err k="days" /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
          <Button onClick={submit}>สร้างการจอง</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
