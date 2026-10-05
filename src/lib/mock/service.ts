import type {
  Booking,
  Commission,
  DemoState,
  LoyaltyConfig,
  Notice,
  Refund,
  RoleId,
  Tier,
  Vehicle,
} from "./types";
import { refId } from "../format";

export function requireRecord<T>(rows: T[], test: (row: T) => boolean, label: string): T {
  const row = rows.find(test);
  if (!row) throw new Error(`ไม่พบ${label}`);
  return row;
}
const now = () => new Date().toISOString();
export const pointValueFor = (booking: Booking, state: DemoState) =>
  booking.pointValue ?? state.loyaltyConfig.pointValue;
export const remainingPayment = (booking: Booking, state: DemoState) =>
  Math.max(0, booking.price - booking.paid - booking.pointsUsed * pointValueFor(booking, state));
export const commissionTotal = (c: Commission) => Math.round(c.base * c.rate + c.bonus + c.adjust);

export function notify(
  state: DemoState,
  eventKey: string,
  notice: Omit<Notice, "id" | "at" | "read" | "eventKey">,
) {
  if (state.notices.some((n) => n.eventKey === eventKey)) return;
  state.notices.unshift({ ...notice, id: refId("N"), at: now(), read: false, eventKey });
}

export function receiveVehicle(state: DemoState, id: string) {
  const vehicle = requireRecord(state.vehicles, (v) => v.id === id, "รถ");
  if (vehicle.status !== "incoming") throw new Error("รับเข้าได้เฉพาะรถที่รอรับเข้า");
  vehicle.status = "available";
  vehicle.ready = true;
  vehicle.receivedAt = now();
  vehicle.branchSince = vehicle.receivedAt;
  vehicle.history.unshift({ at: now(), text: "ตรวจ Checklist รับรถและยืนยันรับเข้า" });
}

export function addVehicle(
  state: DemoState,
  input: Pick<Vehicle, "model" | "vin" | "color" | "branchId" | "price" | "cost" | "year">,
) {
  if (!input.model.trim() || !input.color.trim()) throw new Error("กรุณาระบุรุ่นและสีรถ");
  if (state.vehicles.some((v) => v.vin.toUpperCase() === input.vin.trim().toUpperCase()))
    throw new Error("VIN ซ้ำกับรถในระบบ");
  if (!/^[A-HJ-NPR-Z0-9]{17}$/i.test(input.vin.trim()))
    throw new Error("VIN ต้องมี 17 ตัวอักษร ไม่ใช้ I, O หรือ Q");
  if (
    ![input.price, input.cost].every(Number.isFinite) ||
    input.price <= 0 ||
    input.cost < 0 ||
    input.cost > input.price
  )
    throw new Error("ราคาขายและต้นทุนไม่ถูกต้อง");
  if (
    !Number.isInteger(input.year) ||
    input.year < 2000 ||
    input.year > new Date().getFullYear() + 1
  )
    throw new Error("ปีรถไม่ถูกต้อง");
  requireRecord(state.branches, (b) => b.id === input.branchId, "สาขา");
  const id = refId("V");
  state.vehicles.push({
    ...input,
    vin: input.vin.trim().toUpperCase(),
    id,
    code: id,
    body: "sedan",
    status: "available",
    ready: true,
    receivedAt: now(),
    branchSince: now(),
    history: [{ at: now(), text: "ตรวจ Checklist และรับรถเข้าสต็อก" }],
  });
  return id;
}

export function requestTransfer(
  state: DemoState,
  id: string,
  to: string,
  reason: string,
  actor: string,
) {
  const v = requireRecord(state.vehicles, (x) => x.id === id, "รถ");
  if (
    v.status !== "available" ||
    !v.ready ||
    state.bookings.some((b) => b.vehicleId === id && b.status === "active")
  )
    throw new Error("โอนได้เฉพาะรถพร้อมขายที่ยังไม่มีการจอง");
  if (v.branchId === to) throw new Error("สาขาปลายทางต้องต่างจากสาขาต้นทาง");
  requireRecord(state.branches, (b) => b.id === to, "สาขาปลายทาง");
  if (reason.trim().length < 5) throw new Error("กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร");
  if (
    state.transfers.some((t) => t.vehicleId === id && !["received", "cancelled"].includes(t.status))
  )
    throw new Error("มีคำขอโอนรถคันนี้อยู่แล้ว");
  state.transfers.unshift({
    id: refId("TR"),
    vehicleId: id,
    from: v.branchId,
    to,
    reason,
    by: actor,
    at: now(),
    status: "request",
  });
  v.ready = false;
  v.history.unshift({ at: now(), text: `ขอโอนรถไป ${to}: ${reason}` });
  notify(state, `transfer-request:${id}`, {
    type: "Stock",
    title: "คำขอโอนรถรออนุมัติ",
    detail: v.model,
    link: "/stock/operations",
    branchId: v.branchId,
    assignee: "manager",
    priority: "medium",
  });
}

export function advanceTransfer(
  state: DemoState,
  id: string,
  actor: string,
  allowedBranches: string[],
  cancel = false,
) {
  const t = requireRecord(state.transfers, (x) => x.id === id, "คำขอโอน");
  const v = requireRecord(state.vehicles, (x) => x.id === t.vehicleId, "รถ");
  if (["received", "cancelled"].includes(t.status)) throw new Error("คำขอโอนนี้สิ้นสุดแล้ว");
  if (!allowedBranches.includes(t.status === "moving" && !cancel ? t.to : t.from))
    throw new Error("ไม่มีสิทธิ์ดำเนินการในสาขานี้");
  if (cancel) {
    if (t.status === "moving") throw new Error("รถอยู่ระหว่างโอน ต้องให้ปลายทางยืนยันรับก่อน");
    t.status = "cancelled";
    v.status = "available";
    v.ready = true;
  } else if (t.status === "request") {
    t.status = "approved";
    t.approver = actor;
  } else if (t.status === "approved") {
    t.status = "moving";
    v.status = "transfer";
  } else {
    t.status = "received";
    v.branchId = t.to;
    v.branchSince = now();
    v.status = "available";
    v.ready = true;
  }
  v.history.unshift({ at: now(), text: `${t.id}: ${t.status} โดย ${actor}` });
}

export function finishService(state: DemoState, id: string, actor: string) {
  const order = requireRecord(state.serviceOrders, (o) => o.id === id, "Service Order");
  if (order.status === "done") throw new Error("งานนี้ตรวจรับแล้ว");
  if (!order.items.length || order.items.some((i) => !i.done))
    throw new Error("กรุณาตรวจ Checklist ให้ครบก่อนตรวจรับ");
  order.status = "done";
  for (const item of order.items) {
    item.doneAt ??= now();
    item.checker = actor;
  }
  const v = requireRecord(state.vehicles, (x) => x.id === order.vehicleId, "รถ");
  if (!state.serviceOrders.some((o) => o.vehicleId === v.id && o.status !== "done")) {
    v.ready = true;
    v.readyNote = "ตรวจความพร้อมครบแล้ว";
    if (v.status === "prep") v.status = "reserved";
  }
  state.tasks
    .filter((t) => t.serviceOrderId === id)
    .forEach((t) => {
      t.status = "done";
    });
  v.history.unshift({ at: now(), text: `${id} ตรวจรับโดย ${actor}` });
}

function plateHistory(state: DemoState, id: string, actor: string, text: string) {
  const p = requireRecord(state.plates, (x) => x.id === id, "ป้ายแดง");
  p.history ??= [];
  p.history.unshift({ at: now(), by: actor, text });
  return p;
}

export function matchPlate(state: DemoState, id: string, bookingId: string, actor: string) {
  const p = requireRecord(state.plates, (x) => x.id === id, "ป้ายแดง");
  const b = requireRecord(state.bookings, (x) => x.id === bookingId, "Booking");
  if (p.status !== "available" || p.bookingId) throw new Error("ป้ายต้องพร้อมใช้และยังไม่จับคู่");
  if (b.status !== "active" || b.refund)
    throw new Error("เลือก Booking ที่กำลังดำเนินการและไม่มีคำขอคืนเงิน");
  if (p.branchId !== b.branchId) throw new Error("โอนป้ายมาสาขาของ Booking ก่อนจับคู่");
  if (state.plates.some((x) => x.bookingId === bookingId))
    throw new Error("Booking นี้จับคู่ป้ายแล้ว");
  p.status = "matched";
  p.bookingId = bookingId;
  p.borrowedAt = now();
  delete p.previousBookingId;
  delete p.registeredAt;
  delete p.appointment;
  delete p.follow;
  plateHistory(state, id, actor, `จับคู่กับ ${bookingId}`);
}

export function unmatchPlate(state: DemoState, id: string, reason: string, actor: string) {
  const p = requireRecord(state.plates, (x) => x.id === id, "ป้ายแดง");
  if (p.status !== "matched" || !p.bookingId) throw new Error("ป้ายนี้ไม่ได้จับคู่");
  if (reason.trim().length < 5) throw new Error("กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร");
  p.previousBookingId = p.bookingId;
  delete p.bookingId;
  p.status = "checking";
  plateHistory(state, id, actor, `Un-Matching รอตรวจรับคืน: ${reason}`);
}

export function returnPlate(state: DemoState, id: string, actor: string) {
  const p = requireRecord(state.plates, (x) => x.id === id, "ป้ายแดง");
  if (!["matched", "checking"].includes(p.status))
    throw new Error("ตรวจรับคืนได้เฉพาะป้ายที่ยืมหรือรอตรวจรับ");
  const bId = p.bookingId ?? p.previousBookingId;
  if (p.bookingId) p.previousBookingId = p.bookingId;
  delete p.bookingId;
  delete p.borrowedAt;
  delete p.registeredAt;
  delete p.appointment;
  p.status = "available";
  state.tasks
    .filter((t) => t.bookingId === bId && t.type === "plate")
    .forEach((t) => {
      t.status = "done";
    });
  plateHistory(state, id, actor, "ยืนยันได้รับป้ายจริงและตรวจรับเรียบร้อย");
}

export function transferPlate(state: DemoState, id: string, to: string, actor: string) {
  const p = requireRecord(state.plates, (x) => x.id === id, "ป้ายแดง");
  if (p.status !== "available" || p.branchId === to)
    throw new Error("โอนได้เฉพาะป้ายพร้อมใช้ ไปยังอีกสาขาหนึ่ง");
  requireRecord(state.branches, (b) => b.id === to, "สาขาปลายทาง");
  p.ownerBranchId ??= p.branchId;
  p.transferTo = to;
  p.status = "transfer";
  plateHistory(state, id, actor, `ส่งป้ายไป ${to}`);
}

export function receivePlateTransfer(
  state: DemoState,
  id: string,
  actor: string,
  branches: string[],
) {
  const p = requireRecord(state.plates, (x) => x.id === id, "ป้ายแดง");
  if (p.status !== "transfer" || !p.transferTo)
    throw new Error("ป้ายนี้ยังไม่ได้ระบุปลายทางการโอน");
  if (!branches.includes(p.transferTo)) throw new Error("ไม่มีสิทธิ์ตรวจรับในสาขาปลายทาง");
  p.branchId = p.transferTo;
  delete p.transferTo;
  p.status = "available";
  plateHistory(state, id, actor, "ปลายทางตรวจรับป้ายที่โอนแล้ว");
}

export function commissionEligible(state: DemoState, booking: Booking) {
  return booking.status === "closed" && !booking.refund && remainingPayment(booking, state) === 0;
}
export function calculateCommission(state: DemoState, bookingId: string) {
  const b = requireRecord(state.bookings, (x) => x.id === bookingId, "Booking");
  if (!commissionEligible(state, b))
    throw new Error("ต้องส่งมอบ ปิดการขาย และชำระครบก่อนคำนวณ Commission");
  if (state.commissions.some((c) => c.bookingId === bookingId))
    throw new Error("คำนวณ Commission ของการขายนี้แล้ว");
  const v = requireRecord(state.vehicles, (x) => x.id === b.vehicleId, "รถ");
  const applicableBonus = v.bonus && (b.deliveryAt ?? now()) <= v.bonus.until ? v.bonus : undefined;
  state.commissions.unshift({
    id: refId("CM"),
    bookingId,
    salesId: b.salesId,
    base: b.price,
    rate: 0.008,
    bonus: applicableBonus?.amount ?? 0,
    bonusCondition: applicableBonus?.condition ?? "ไม่มี Bonus ที่เข้าเงื่อนไขในวันส่งมอบ",
    adjust: 0,
    status: "draft",
    history: [{ at: now(), by: "ระบบ", text: "คำนวณจากราคาขาย × 0.8% + Bonus" }],
  });
}
export function advanceCommission(
  state: DemoState,
  id: string,
  role: RoleId,
  actor: string,
  rejectReason?: string,
  expectedStatus?: Commission["status"],
) {
  const c = requireRecord(state.commissions, (x) => x.id === id, "Commission");
  if (expectedStatus && c.status !== expectedStatus)
    throw new Error("สถานะเปลี่ยนแล้ว กรุณาตรวจสอบรายการก่อนดำเนินการอีกครั้ง");
  const b = requireRecord(state.bookings, (x) => x.id === c.bookingId, "Booking");
  if (!commissionEligible(state, b))
    throw new Error("รายการยังไม่เข้าเงื่อนไขสิทธิ์รับ Commission");
  if (rejectReason !== undefined) {
    if (
      !["submitted", "mgr_review", "fin_review"].includes(c.status) ||
      !["manager", "finance", "admin"].includes(role)
    )
      throw new Error("ไม่มีสิทธิ์ตีกลับในขั้นตอนนี้");
    if (rejectReason.trim().length < 5)
      throw new Error("กรุณาระบุเหตุผลตีกลับอย่างน้อย 5 ตัวอักษร");
    c.status = "rejected";
    c.note = rejectReason;
  } else if (["draft", "rejected"].includes(c.status)) {
    if (!["sales", "manager", "admin"].includes(role))
      throw new Error("บทบาทนี้ไม่มีสิทธิ์ส่งเบิก");
    c.status = "submitted";
    c.claimNo ??= refId("CL");
  } else if (c.status === "submitted" || c.status === "mgr_review") {
    if (!["manager", "admin"].includes(role)) throw new Error("รอผู้จัดการสาขาตรวจสอบ");
    c.status = "fin_review";
  } else if (c.status === "fin_review") {
    if (!["finance", "admin"].includes(role)) throw new Error("รอฝ่ายการเงินอนุมัติ");
    c.status = "approved";
  } else if (c.status === "approved") {
    if (!["finance", "admin"].includes(role)) throw new Error("รอฝ่ายการเงินบันทึกการจ่าย");
    c.status = "paid";
    c.paidAt = now();
  } else throw new Error("รายการนี้จ่ายแล้ว");
  c.history ??= [];
  c.history.unshift({
    at: now(),
    by: actor,
    text: `${c.status}${rejectReason ? `: ${rejectReason}` : ""}`,
  });
  notify(state, `commission:${id}:${c.status}:${c.history.length}`, {
    type: "Commission",
    title: `Commission: ${c.status}`,
    detail: `${c.claimNo ?? c.id} · ${b.id}`,
    link: "/sales/commission",
    branchId: b.branchId,
    assignee:
      c.status === "submitted" ? "manager" : c.status === "fin_review" ? "finance" : c.salesId,
    priority: "medium",
  });
}

export function simulateLoyalty(
  config: LoyaltyConfig,
  amount: number,
  tier: Tier,
  campaign: number,
) {
  if (
    ![amount, campaign, config.bahtPerPoint, config.cap, config.tierMult[tier]].every(
      Number.isFinite,
    ) ||
    amount < 0 ||
    campaign <= 0 ||
    config.bahtPerPoint <= 0 ||
    config.cap < 0
  )
    throw new Error("ยอดซื้อและค่าของสูตรต้องเป็นตัวเลขที่ถูกต้อง");
  const base = amount / config.bahtPerPoint;
  const raw = base * config.tierMult[tier] * campaign;
  const rounded = Math[config.rounding](raw);
  return { base, raw, rounded, result: Math.min(config.cap, rounded) };
}

export function syncCustomer(state: DemoState, id: string) {
  const c = requireRecord(state.customers, (x) => x.id === id, "ลูกค้า");
  const integration = requireRecord(
    state.integrations,
    (x) => x.id === "loyalty",
    "Loyalty integration",
  );
  if (integration.status !== "connected")
    throw new Error("Loyalty จำลองขัดข้อง — Retry ที่ Integrations ก่อน Sync");
  c.lastSync = now();
  if (c.points !== c.extPoints) {
    if (
      !state.tasks.some(
        (t) =>
          t.customerId === id &&
          t.title === "ตรวจสอบยอด Loyalty คลาดเคลื่อน" &&
          t.status !== "done",
      )
    )
      state.tasks.push({
        id: refId("T"),
        type: "payment",
        title: "ตรวจสอบยอด Loyalty คลาดเคลื่อน",
        date: now(),
        customerId: id,
        assignee: c.salesId,
        branchId: c.branchId,
        status: "waiting",
      });
    notify(state, `loyalty-mismatch:${id}:${c.extPoints}`, {
      type: "Loyalty",
      title: "ยอด Loyalty คลาดเคลื่อน",
      detail: c.loyaltyId,
      link: `/customers/${id}`,
      branchId: c.branchId,
      assignee: c.salesId,
      priority: "high",
    });
  }
}

export function settleBurn(state: DemoState, id: string) {
  const t = requireRecord(state.loyaltyTx, (x) => x.id === id, "ธุรกรรม");
  if (t.type !== "Burn" || !["Pending", "Failed"].includes(t.status))
    throw new Error("ธุรกรรมนี้ดำเนินการแล้วหรือไม่ใช่ Burn");
  const integration = requireRecord(
    state.integrations,
    (x) => x.id === "loyalty",
    "Loyalty integration",
  );
  if (integration.status !== "connected") {
    t.status = "Failed";
    t.match = "mismatch";
    return false;
  }
  const b = requireRecord(state.bookings, (x) => x.id === t.bookingId, "Booking");
  const c = requireRecord(state.customers, (x) => x.id === t.customerId, "ลูกค้า");
  if (
    b.status !== "active" ||
    b.refund ||
    t.points > c.points ||
    t.value > remainingPayment(b, state) ||
    !Number.isInteger(t.points) ||
    t.points <= 0
  )
    throw new Error("ยอด Point / ยอดคงเหลือ หรือสถานะ Booking ไม่ถูกต้อง");
  if (
    t.value + b.pointsUsed * pointValueFor(b, state) >
    (b.price * state.loyaltyConfig.maxBurnPct) / 100
  )
    throw new Error("เกินเพดานการใช้ Point");
  b.pointValue ??= t.value / t.points;
  b.formulaVersion ??= t.formulaVersion;
  b.pointsUsed += t.points;
  c.points -= t.points;
  c.extPoints -= t.points;
  t.status = "Success";
  t.match = "matched";
  return true;
}

export function receivePayment(state: DemoState, id: string, amount: number) {
  const b = requireRecord(state.bookings, (x) => x.id === id, "Booking");
  if (b.status !== "active" || b.refund) throw new Error("การจองนี้ไม่สามารถรับชำระเพิ่มได้");
  if (!Number.isFinite(amount) || amount <= 0 || amount > remainingPayment(b, state))
    throw new Error("ยอดรับชำระเกินยอดคงเหลือหรือไม่ถูกต้อง");
  if (
    state.loyaltyTx.some((t) => t.bookingId === id && t.type === "Burn" && t.status === "Pending")
  )
    throw new Error("รอผลคำขอ Burn ก่อนรับชำระ");
  b.paid += amount;
}

export function reverseBurn(state: DemoState, id: string) {
  const t = requireRecord(state.loyaltyTx, (x) => x.id === id, "ธุรกรรม");
  const b = requireRecord(state.bookings, (x) => x.id === t.bookingId, "Booking");
  if (t.type !== "Burn" || t.status !== "Success" || b.status !== "active" || b.refund)
    throw new Error("ไม่สามารถ Reverse รายการนี้ได้");
  const c = requireRecord(state.customers, (x) => x.id === b.customerId, "ลูกค้า");
  t.status = "Reversed";
  b.pointsUsed -= t.points;
  c.points += t.points;
  c.extPoints += t.points;
  state.loyaltyTx.unshift({
    ...t,
    id: refId("LT"),
    type: "Reverse",
    status: "Success",
    ref: refId("LYT-DEMO"),
    at: now(),
  });
}

export function releaseBookingVehicle(state: DemoState, id: string) {
  const b = requireRecord(state.bookings, (x) => x.id === id, "Booking");
  if (!["expired", "cancelled"].includes(b.status) || b.releaseState !== "awaiting")
    throw new Error("การจองนี้ไม่ได้รออนุมัติปล่อยรถ");
  if (b.refund && !["paid", "rejected"].includes(b.refund.status))
    throw new Error("ต้องดำเนินการคืนเงินให้เสร็จก่อนปล่อยรถ");
  const v = requireRecord(state.vehicles, (x) => x.id === b.vehicleId, "รถ");
  if (state.bookings.some((x) => x.id !== id && x.vehicleId === v.id && x.status === "active"))
    throw new Error("รถมีการจองอื่นที่กำลังดำเนินการ");
  b.releaseState = "released";
  const unfinished = state.serviceOrders.some((s) => s.vehicleId === v.id && s.status !== "done");
  v.status = unfinished ? "prep" : "available";
  v.ready = !unfinished;
  v.readyNote = unfinished ? "รอ Service Order" : "พร้อมขาย";
  v.history.unshift({ at: now(), text: `ปล่อยรถจากการจอง ${id}` });
}

export function evaluateNotificationRules(state: DemoState, at = new Date()) {
  const today = new Date(at);
  today.setHours(0, 0, 0, 0);
  const days = (date: string) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return Math.round((d.getTime() - today.getTime()) / 86400000);
  };
  for (const rule of state.rules.filter((r) => r.enabled)) {
    const recipientRoles = state.roles
      .filter(
        (r) =>
          rule.recipients.toLowerCase().includes(r.name.toLowerCase()) ||
          (r.id === "sales" && /Sales/i.test(rule.recipients)),
      )
      .map((r) => r.id);
    const period =
      rule.frequency === "วันละครั้ง"
        ? 1
        : Number(rule.frequency.match(/^ทุก (\d+) วัน$/)?.[1] ?? 0);
    const bucket = period > 0 ? `:${Math.floor(today.getTime() / (86400000 * period))}` : "";
    const send = (key: string, notice: Omit<Notice, "id" | "at" | "read" | "eventKey">) =>
      notify(state, `rule:${rule.id}:${key}${bucket}`, { ...notice, recipientRoles });
    if (rule.id === "R1")
      for (const b of state.bookings.filter(
        (b) =>
          b.status === "active" && days(b.expiresAt) <= -rule.offsetDays && days(b.expiresAt) >= 0,
      ))
        send(`${b.id}:${b.expiresAt}`, {
          type: "Booking",
          title: rule.event,
          detail: b.id,
          link: `/bookings/${b.id}`,
          branchId: b.branchId,
          assignee: b.salesId,
          priority: "high",
        });
    if (["R2", "R3"].includes(rule.id))
      for (const t of state.tasks.filter(
        (t) =>
          t.type === (rule.id === "R2" ? "testdrive" : "delivery") &&
          t.status !== "done" &&
          days(t.date) >= 0 &&
          days(t.date) <= -rule.offsetDays,
      ))
        send(`${t.id}:${t.date}`, {
          type: "Task",
          title: rule.event,
          detail: t.title,
          link: t.bookingId ? `/bookings/${t.bookingId}` : "/",
          branchId: t.branchId,
          assignee: t.assignee,
          priority: "medium",
        });
    if (rule.id === "R4")
      for (const p of state.plates.filter(
        (p) => p.status === "matched" && p.borrowedAt && -days(p.borrowedAt) >= rule.offsetDays,
      )) {
        const b = state.bookings.find((b) => b.id === p.bookingId);
        if (b)
          send(`${p.id}:${p.borrowedAt}`, {
            type: "RedPlate",
            title: rule.event,
            detail: p.number,
            link: "/stock/red-plates",
            branchId: b.branchId,
            assignee: b.salesId,
            priority: "high",
          });
      }
    if (rule.id === "R5")
      for (const t of state.loyaltyTx.filter((t) => t.status === "Failed")) {
        const c = state.customers.find((c) => c.id === t.customerId);
        if (c)
          send(`${t.id}:${t.ref}`, {
            type: "Loyalty",
            title: rule.event,
            detail: t.ref,
            link: "/admin/integrations",
            branchId: c.branchId,
            assignee: c.salesId,
            priority: "high",
          });
      }
    if (rule.id === "R6")
      for (const c of state.commissions.filter((c) =>
        ["submitted", "mgr_review", "fin_review"].includes(c.status),
      )) {
        const b = state.bookings.find((b) => b.id === c.bookingId);
        if (b && -days(c.history?.[0]?.at ?? b.deliveryAt ?? b.createdAt) >= rule.offsetDays)
          send(`${c.id}:${c.status}`, {
            type: "Commission",
            title: rule.event,
            detail: c.id,
            link: "/sales/commission",
            branchId: b.branchId,
            assignee: c.salesId,
            priority: "medium",
          });
      }
  }
}

export function importStockDemo(state: DemoState, branchId: string) {
  const integration = requireRecord(
    state.integrations,
    (i) => i.id === "stocksrc",
    "Stock integration",
  );
  if (integration.status !== "connected") throw new Error("แหล่งข้อมูลสต็อกยังไม่ได้เชื่อมต่อ");
  const vin = "WBA" + String(990001).padStart(14, "0");
  integration.lastSync = now();
  if (state.vehicles.some((v) => v.vin === vin)) {
    integration.log.unshift({
      at: integration.lastSync,
      level: "info",
      text: `Import: ข้าม VIN ซ้ำ ${vin} — คงข้อมูลเดิม`,
    });
    return;
  }
  const id = addVehicle(state, {
    model: "BMW 320d M Sport (Import)",
    vin,
    color: "Alpine White",
    year: new Date().getFullYear(),
    price: 2490000,
    cost: 2190000,
    branchId,
  });
  const v = requireRecord(state.vehicles, (v) => v.id === id, "รถนำเข้า");
  v.status = "incoming";
  v.ready = false;
  v.readyNote = "รอตรวจรับรถจากข้อมูล Import";
  v.expectedAt = new Date(Date.now() + 2 * 86400000).toISOString();
  v.history.unshift({
    at: integration.lastSync,
    text: "แหล่งข้อมูล: Stock Source — นำเข้าข้อมูลรถและสาขา",
  });
  integration.ok += 1;
  integration.log.unshift({
    at: integration.lastSync,
    level: "info",
    text: `Import: เพิ่ม VIN ${vin} ในสาขา ${branchId}; ข้าม VIN เดิม ${state.vehicles[0]?.vin}`,
  });
  notify(state, `stock-import:${vin}`, {
    type: "Stock",
    title: "นำเข้ารถรอตรวจรับ",
    detail: `${v.model} · ${vin}`,
    link: "/stock/operations",
    branchId,
    assignee: "stock",
    priority: "medium",
  });
}

export function requestRefund(
  state: DemoState,
  id: string,
  input: {
    branch: Refund["branch"];
    deduction: number;
    deductionNote: string;
    reason: string;
    branchId: string;
  },
  actor: string,
) {
  const b = requireRecord(state.bookings, (x) => x.id === id, "Booking");
  if (b.refund) throw new Error("Booking นี้มีคำขอคืนเงินอยู่แล้ว");
  if (
    !["active", "expired"].includes(b.status) ||
    state.loyaltyTx.some((t) => t.bookingId === id && t.status === "Pending")
  )
    throw new Error("สถานะ Booking ไม่รองรับคืนเงิน หรือมีธุรกรรม Point ค้างอยู่");
  if (input.reason.trim().length < 5) throw new Error("ระบุเหตุผลอย่างน้อย 5 ตัวอักษร");
  requireRecord(state.branches, (r) => r.id === input.branchId, "สาขาคืนเงิน");
  const deduction = input.branch === "B" ? input.deduction : 0;
  if (
    !Number.isFinite(deduction) ||
    deduction < 0 ||
    deduction >= b.deposit ||
    (input.branch === "B" && (deduction <= 0 || !input.deductionNote.trim()))
  )
    throw new Error("จำนวนหักต้องเป็นบวกและน้อยกว่าเงินจอง พร้อมเหตุผลหัก");
  b.refund = {
    id: refId("RF"),
    branch: input.branch,
    step: 1,
    requestedAt: now(),
    amount: input.branch === "C" ? 0 : Math.min(b.deposit, b.paid) - deduction,
    deduction,
    deductionNote: input.deductionNote,
    pointsReturn: input.branch === "C" ? 0 : b.pointsUsed,
    reason: input.reason,
    status: "pending",
    branchId: input.branchId,
    history: [{ at: now(), by: actor, text: "ขอคืนเงินจอง" }],
  };
  notify(state, `refund-request:${id}`, {
    type: "Refund",
    title: "คำขอคืนเงินรออนุมัติ",
    detail: b.refund.id,
    link: `/bookings/${id}`,
    branchId: input.branchId,
    assignee: "finance",
    priority: "high",
  });
}

export function advanceRefund(
  state: DemoState,
  id: string,
  actor: string,
  reject = false,
  channel = "",
  evidence = "",
  expectedStep?: number,
) {
  const b = requireRecord(state.bookings, (x) => x.id === id, "Booking");
  const r = b.refund;
  if (!r || r.status === "closed") throw new Error("คำขอไม่มีหรือปิดแล้ว");
  if (expectedStep !== undefined && r.step !== expectedStep)
    throw new Error("ขั้นตอนเปลี่ยนแล้ว กรุณาตรวจสอบก่อนดำเนินการอีกครั้ง");
  let text: string;
  if (r.step === 1) {
    r.step = 2;
    text = "ตรวจสอบเงื่อนไขแล้ว";
  } else if (r.step === 2 && r.status === "pending") {
    r.step = 3;
    r.status = reject || r.branch === "C" ? "rejected" : "approved";
    r.approver = actor;
    if (r.status === "rejected") {
      r.amount = 0;
      r.pointsReturn = 0;
    }
    text = r.status === "approved" ? "อนุมัติคืนเงิน" : "ไม่เข้าเงื่อนไขคืนเงิน";
  } else if (r.step === 3 && r.status === "approved") {
    if (!channel.trim()) throw new Error("ระบุช่องทางคืนเงิน");
    if (r.amount < 0 || r.amount > b.paid || r.pointsReturn > b.pointsUsed)
      throw new Error("ยอดคืนเงินหรือ Point ไม่สอดคล้องกับยอดชำระ");
    b.paid -= r.amount;
    if (r.pointsReturn > 0) {
      const c = requireRecord(state.customers, (x) => x.id === b.customerId, "ลูกค้า");
      c.points += r.pointsReturn;
      c.extPoints += r.pointsReturn;
      b.pointsUsed -= r.pointsReturn;
      for (const tx of state.loyaltyTx.filter(
        (t) => t.bookingId === id && t.type === "Burn" && t.status === "Success",
      ))
        tx.status = "Reversed";
      state.loyaltyTx.unshift({
        id: refId("LT"),
        customerId: c.id,
        bookingId: id,
        type: "Reverse",
        points: r.pointsReturn,
        value: r.pointsReturn * pointValueFor(b, state),
        status: "Success",
        ref: refId("LYT-DEMO"),
        at: now(),
        match: "matched",
        formulaVersion: b.formulaVersion ?? state.loyaltyConfig.version,
      });
    }
    r.step = 4;
    r.status = "paid";
    r.channel = channel;
    text = "ดำเนินการคืนเงินและ Point แล้ว";
  } else if (r.step === 4 && r.status === "paid") {
    if (!evidence.trim()) throw new Error("ระบุหลักฐานการคืนเงินจำลอง");
    r.evidence = evidence;
    r.step = 5;
    text = "บันทึกหลักฐานคืนเงินแล้ว";
  } else if ((r.step === 5 && r.status === "paid") || (r.step === 3 && r.status === "rejected")) {
    r.status = "closed";
    r.step = 6;
    b.status = "cancelled";
    b.releaseState = "awaiting";
    const v = requireRecord(state.vehicles, (v) => v.id === b.vehicleId, "รถ");
    v.ready = false;
    v.readyNote = "รออนุมัติปล่อยรถหลังยกเลิก";
    text = "ปิดคำขอ รอผู้มีสิทธิ์อนุมัติปล่อยรถ";
  } else throw new Error("ขั้นตอนคำขอคืนเงินไม่ถูกต้อง");
  r.history.unshift({ at: now(), by: actor, text });
  b.history.unshift({ at: now(), by: actor, text });
}
