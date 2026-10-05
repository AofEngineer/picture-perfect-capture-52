import { describe, expect, it } from "vitest";
import { createSeed } from "@/lib/mock/seed";
import { recordInScope, visibleNotice } from "@/lib/access";
import {
  receivePayment,
  reverseBurn,
  releaseBookingVehicle,
  evaluateNotificationRules,
  pointValueFor,
  importStockDemo,
} from "@/lib/mock/service";
import {
  addVehicle,
  advanceCommission,
  advanceRefund,
  advanceTransfer,
  calculateCommission,
  commissionTotal,
  finishService,
  matchPlate,
  notify,
  requestRefund,
  requestTransfer,
  returnPlate,
  settleBurn,
  simulateLoyalty,
  syncCustomer,
  unmatchPlate,
} from "@/lib/mock/service";

describe("Connected demo workflows", () => {
  it("imports one stock source record and skips the same VIN on subsequent syncs", () => {
    const d = createSeed();
    const count = d.vehicles.length;
    expect(() => importStockDemo(d, "B1")).toThrow("เชื่อมต่อ");
    d.integrations.find((i) => i.id === "stocksrc")!.status = "connected";
    importStockDemo(d, "B1");
    expect(d.vehicles).toHaveLength(count + 1);
    const imported = d.vehicles.at(-1)!;
    expect(imported.status).toBe("incoming");
    expect(imported.ready).toBe(false);
    imported.color = "User edited";
    importStockDemo(d, "B1");
    expect(d.vehicles).toHaveLength(count + 1);
    expect(imported.color).toBe("User edited");
    expect(d.integrations.find((i) => i.id === "stocksrc")!.log[0]!.text).toContain("VIN ซ้ำ");
  });
  it("enforces branch selection, own records, and notification recipients", () => {
    const d = createSeed();
    const role = d.roles.find((r) => r.id === "sales")!;
    expect(recordInScope(role, ["B1"], "all", "S1", { branchId: "B2", salesId: "S1" })).toBe(false);
    expect(recordInScope(role, ["B1"], "B2", "S1", { branchId: "B1", salesId: "S1" })).toBe(false);
    expect(recordInScope(role, ["B1"], "all", "S1", { branchId: "B1", salesId: "S2" })).toBe(false);
    expect(recordInScope(role, ["B1"], "all", "S1", { branchId: "B1", salesId: "S1" })).toBe(true);
    expect(
      visibleNotice({ branchId: "B1", assignee: "S1", recipientRoles: ["manager"] }, "sales", "S1"),
    ).toBe(false);
  });

  it("blocks payments while a burn is pending, overpayments, and payments after cancellation", () => {
    const d = createSeed();
    const tx = d.loyaltyTx.find((t) => t.status === "Pending")!;
    const b = d.bookings.find((b) => b.id === tx.bookingId)!;
    const before = b.paid;
    expect(() => receivePayment(d, b.id, 1000)).toThrow("รอผล");
    expect(b.paid).toBe(before);
    tx.status = "Failed";
    receivePayment(d, b.id, 1000);
    expect(b.paid).toBe(before + 1000);
    expect(() => receivePayment(d, b.id, b.price)).toThrow("ยอดรับชำระ");
    b.status = "cancelled";
    expect(() => receivePayment(d, b.id, 1)).toThrow("รับชำระเพิ่ม");
  });

  it("reverses a successful burn once without revaluing earlier points", () => {
    const d = createSeed();
    d.integrations.find((i) => i.id === "loyalty")!.status = "connected";
    const tx = d.loyaltyTx.find((t) => t.status === "Pending")!;
    const c = d.customers.find((c) => c.id === tx.customerId)!;
    const before = c.points;
    settleBurn(d, tx.id);
    reverseBurn(d, tx.id);
    expect(c.points).toBe(before);
    expect(() => reverseBurn(d, tx.id)).toThrow("Reverse");
    const b = d.bookings.find((b) => b.id === tx.bookingId)!;
    const value = pointValueFor(b, d);
    d.loyaltyConfig.pointValue = 3;
    expect(pointValueFor(b, d)).toBe(value);
  });

  it("does not release an expired car with unfinished preparation as ready", () => {
    const d = createSeed();
    const b = d.bookings.find((b) => b.vehicleId === d.serviceOrders[0]!.vehicleId)!;
    b.status = "expired";
    b.releaseState = "awaiting";
    releaseBookingVehicle(d, b.id);
    const v = d.vehicles.find((v) => v.id === b.vehicleId)!;
    expect(v.status).toBe("prep");
    expect(v.ready).toBe(false);
    expect(() => releaseBookingVehicle(d, b.id)).toThrow("รออนุมัติ");
  });

  it("evaluates all enabled notification rules and deduplicates within their frequency", () => {
    const d = createSeed();
    const at = new Date();
    d.rules.forEach((r) => {
      r.enabled = true;
    });
    const c = d.commissions[0]!;
    c.status = "submitted";
    c.history = [
      { at: new Date(at.getTime() - 3 * 86400000).toISOString(), by: "Sales", text: "ส่งเบิก" },
    ];
    evaluateNotificationRules(d, at);
    const generated = d.notices.filter((n) => n.eventKey?.startsWith("rule:"));
    expect(new Set(generated.map((n) => n.eventKey?.split(":")[1])).size).toBe(6);
    evaluateNotificationRules(d, at);
    expect(d.notices.filter((n) => n.eventKey?.startsWith("rule:"))).toHaveLength(generated.length);
    expect(generated.find((n) => n.type === "Loyalty")?.recipientRoles).toContain("loyalty");
  });
  it("keeps cross-module seed references valid", () => {
    const d = createSeed();
    expect([
      d.branches.length,
      d.vehicles.length,
      d.customers.length,
      d.bookings.length,
      d.sales.length,
      d.plates.length,
      d.serviceOrders.length,
    ]).toEqual([4, 24, 15, 13, 6, 12, 8]);
    for (const b of d.bookings) {
      expect(d.customers.some((c) => c.id === b.customerId)).toBe(true);
      expect(d.vehicles.some((v) => v.id === b.vehicleId)).toBe(true);
      expect(d.sales.some((s) => s.id === b.salesId)).toBe(true);
    }
  });

  it("rejects duplicate VINs and invalid amounts", () => {
    const d = createSeed();
    const v = d.vehicles[0]!;
    expect(() => addVehicle(d, { ...v, vin: v.vin })).toThrow("VIN ซ้ำ");
    expect(() => addVehicle(d, { ...v, vin: "WBA12345678901234", price: NaN })).toThrow("ราคาขาย");
  });

  it("changes a vehicle's branch only when the destination receives it", () => {
    const d = createSeed();
    const v = d.vehicles.find((v) => v.status === "available")!;
    const from = v.branchId;
    const to = from === "B2" ? "B1" : "B2";
    requestTransfer(d, v.id, to, "ลูกค้าปลายทางต้องการรถ", "Stock");
    const t = d.transfers[0]!;
    expect(() => requestTransfer(d, v.id, to, "คำขอซ้ำ", "Stock")).toThrow();
    advanceTransfer(d, t.id, "Manager", [from]);
    expect(v.branchId).toBe(from);
    advanceTransfer(d, t.id, "Stock", [from]);
    expect(v.branchId).toBe(from);
    expect(v.status).toBe("transfer");
    expect(() => advanceTransfer(d, t.id, "Stock", [from])).toThrow("ไม่มีสิทธิ์");
    advanceTransfer(d, t.id, "Destination", [to]);
    expect(v.branchId).toBe(to);
    expect(v.ready).toBe(true);
    expect(() => advanceTransfer(d, t.id, "Destination", [to])).toThrow("สิ้นสุด");
  });

  it("blocks service completion until all checklist items are done", () => {
    const d = createSeed();
    const order = d.serviceOrders[0]!;
    expect(() => finishService(d, order.id, "Service")).toThrow("Checklist");
    order.items.forEach((i) => {
      i.done = true;
    });
    finishService(d, order.id, "Service");
    expect(order.status).toBe("done");
    expect(order.items.every((i) => i.checker === "Service")).toBe(true);
    expect(d.tasks.find((t) => t.serviceOrderId === order.id)?.status).toBe("done");
  });

  it("keeps an unmatched plate unavailable until physically inspected and returned", () => {
    const d = createSeed();
    const plate = d.plates[0]!;
    const b = d.bookings[0]!;
    matchPlate(d, plate.id, b.id, "Stock");
    expect(() => matchPlate(d, plate.id, d.bookings[1]!.id, "Stock")).toThrow("พร้อมใช้");
    unmatchPlate(d, plate.id, "เปลี่ยนป้ายตามคำขอลูกค้า", "Stock");
    expect(plate.status).toBe("checking");
    expect(() => matchPlate(d, plate.id, b.id, "Stock")).toThrow("พร้อมใช้");
    returnPlate(d, plate.id, "Stock");
    expect(plate.status).toBe("available");
    expect(plate.bookingId).toBeUndefined();
    expect(() => returnPlate(d, plate.id, "Stock")).toThrow();
  });

  it("rejects commission for undelivered sales and enforces approval roles", () => {
    const d = createSeed();
    expect(() => calculateCommission(d, d.bookings[0]!.id)).toThrow("ส่งมอบ");
    const c = d.commissions.find(
      (c) =>
        c.status === "draft" && d.bookings.find((b) => b.id === c.bookingId)?.status === "closed",
    )!;
    advanceCommission(d, c.id, "sales", "Sales");
    expect(c.status).toBe("submitted");
    expect(() => advanceCommission(d, c.id, "sales", "Sales")).toThrow("ผู้จัดการ");
    advanceCommission(d, c.id, "manager", "Manager");
    expect(c.status).toBe("fin_review");
    expect(() => advanceCommission(d, c.id, "manager", "Manager")).toThrow("ฝ่ายการเงิน");
    advanceCommission(d, c.id, "finance", "Finance");
    advanceCommission(d, c.id, "finance", "Finance");
    expect(c.status).toBe("paid");
    expect(c.paidAt).toBeTruthy();
    expect(commissionTotal(c)).toBe(Math.round(c.base * c.rate + c.bonus + c.adjust));
    expect(() => advanceCommission(d, c.id, "finance", "Finance")).toThrow("จ่ายแล้ว");
  });

  it("settles a pending burn exactly once and stores the transaction's value", () => {
    const d = createSeed();
    d.integrations.find((i) => i.id === "loyalty")!.status = "connected";
    const tx = d.loyaltyTx.find((t) => t.status === "Pending")!;
    const c = d.customers.find((c) => c.id === tx.customerId)!;
    const before = c.points;
    expect(settleBurn(d, tx.id)).toBe(true);
    expect(c.points).toBe(before - tx.points);
    const b = d.bookings.find((b) => b.id === tx.bookingId)!;
    expect(b.pointValue).toBe(tx.value / tx.points);
    expect(() => settleBurn(d, tx.id)).toThrow("ดำเนินการแล้ว");
    expect(c.points).toBe(before - tx.points);
  });

  it("leaves point balances unchanged when the simulated API fails", () => {
    const d = createSeed();
    const tx = d.loyaltyTx.find((t) => t.status === "Pending")!;
    const c = d.customers.find((c) => c.id === tx.customerId)!;
    const before = c.points;
    expect(settleBurn(d, tx.id)).toBe(false);
    expect(tx.status).toBe("Failed");
    expect(c.points).toBe(before);
  });

  it("refunds cash and points once, records evidence, and waits for vehicle release", () => {
    const d = createSeed();
    const b = d.bookings[0]!;
    b.pointsUsed = 1000;
    b.pointValue = 2;
    const c = d.customers.find((c) => c.id === b.customerId)!;
    const pointsBefore = c.points;
    requestRefund(
      d,
      b.id,
      {
        branch: "D",
        deduction: 0,
        deductionNote: "",
        reason: "ลูกค้าขอยกเลิกการซื้อ",
        branchId: b.branchId,
      },
      "Sales",
    );
    expect(() =>
      requestRefund(
        d,
        b.id,
        {
          branch: "D",
          deduction: 0,
          deductionNote: "",
          reason: "ขอซ้ำอีกครั้ง",
          branchId: b.branchId,
        },
        "Sales",
      ),
    ).toThrow("มีคำขอ");
    advanceRefund(d, b.id, "Stock");
    advanceRefund(d, b.id, "Manager");
    advanceRefund(d, b.id, "Finance", false, "โอนธนาคาร Demo");
    expect(b.paid).toBe(0);
    expect(b.pointsUsed).toBe(0);
    expect(c.points).toBe(pointsBefore + 1000);
    expect(() => advanceRefund(d, b.id, "Finance", false, "โอนธนาคาร Demo")).toThrow("หลักฐาน");
    advanceRefund(d, b.id, "Finance", false, "", "SLIP-DEMO-001");
    advanceRefund(d, b.id, "Finance");
    expect(b.status).toBe("cancelled");
    expect(b.releaseState).toBe("awaiting");
    expect(c.points).toBe(pointsBefore + 1000);
    expect(() => advanceRefund(d, b.id, "Finance")).toThrow("ปิดแล้ว");
  });

  it("validates partial refund deductions and supports a responsible destination branch", () => {
    const d = createSeed();
    const b = d.bookings[0]!;
    expect(() =>
      requestRefund(
        d,
        b.id,
        {
          branch: "B",
          deduction: -1,
          deductionNote: "หักเงิน",
          reason: "ลูกค้าขอยกเลิก",
          branchId: b.branchId,
        },
        "Sales",
      ),
    ).toThrow("จำนวนหัก");
    requestRefund(
      d,
      b.id,
      {
        branch: "E",
        deduction: 0,
        deductionNote: "",
        reason: "ส่งสำนักงานใหญ่คืนเงิน",
        branchId: "B2",
      },
      "Sales",
    );
    expect(b.refund?.branchId).toBe("B2");
  });

  it("creates only one notice and one follow-up for repeated mismatch syncs", () => {
    const d = createSeed();
    d.integrations.find((i) => i.id === "loyalty")!.status = "connected";
    const c = d.customers.find((c) => c.points !== c.extPoints)!;
    const points = c.points;
    syncCustomer(d, c.id);
    syncCustomer(d, c.id);
    expect(
      d.tasks.filter((t) => t.customerId === c.id && t.title === "ตรวจสอบยอด Loyalty คลาดเคลื่อน"),
    ).toHaveLength(1);
    expect(
      d.notices.filter((n) => n.eventKey?.startsWith(`loyalty-mismatch:${c.id}:`)),
    ).toHaveLength(1);
    expect(c.points).toBe(points);
  });

  it("applies tier multipliers, rounding and caps without mutating old formula versions", () => {
    const d = createSeed();
    const old = structuredClone(d.loyaltyConfig);
    const cfg = {
      ...old,
      bahtPerPoint: 100,
      cap: 50,
      tierMult: { Silver: 1, Gold: 1.25, Platinum: 1.5 },
    };
    expect(simulateLoyalty(cfg, 10000, "Platinum", 2).result).toBe(50);
    expect(simulateLoyalty({ ...cfg, cap: 10000, rounding: "ceil" }, 101, "Silver", 1).result).toBe(
      2,
    );
    expect(d.loyaltyConfig).toEqual(old);
    expect(() => simulateLoyalty(cfg, -1, "Silver", 1)).toThrow();
  });
});
