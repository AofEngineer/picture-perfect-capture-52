import type { Action, DemoState, MenuKey } from "@/lib/mock/types";
import type { AssistantContext } from "./types";
import { daysFromToday, thb } from "@/lib/format";
import { BOOKING_STATUS, COMM_STATUS, TASK_STATUS } from "@/lib/labels";
import { WORKFLOW_STEPS } from "@/lib/mock/seed";
import { remainingPayment } from "@/lib/mock/service";
interface ContextAccess {
  can: (menu: MenuKey, action?: Action) => boolean;
  inScope: (r: { branchId: string; salesId?: string }) => boolean;
  roleName: string;
  branchLabel: string;
  path: string;
}
// Only this allow-listed, scope-filtered projection may be given to a provider.
// It intentionally omits identity numbers, phone numbers, costs and document fields.
export function buildAssistantContext(state: DemoState, access: ContextAccess): AssistantContext {
  const { can, inScope } = access;
  const bookings = can("booking") ? state.bookings.filter(inScope) : [];
  const visibleIds = new Set(bookings.map((b) => b.id));
  const currentBookingId = bookings.find((b) => access.path === `/bookings/${b.id}`)?.id;
  return {
    roleName: access.roleName,
    branchLabel: access.branchLabel,
    currentPath: access.path,
    currentBookingId,
    bookings: bookings.map((b) => ({
      id: b.id,
      title: b.id,
      href: `/bookings/${b.id}`,
      status: b.status,
      step: WORKFLOW_STEPS[b.step] ?? "ปิดการขาย",
      remaining: remainingPayment(b, state),
      expiresIn: daysFromToday(b.expiresAt),
      detail: `${BOOKING_STATUS[b.status][0]} · ${WORKFLOW_STEPS[b.step] ?? "ปิดการขาย"} · ค้างชำระ ${thb(remainingPayment(b, state))}`,
    })),
    tasks: state.tasks
      .filter(
        (t) =>
          can(t.serviceOrderId ? "stock" : t.bookingId ? "booking" : "customer") &&
          inScope({ branchId: t.branchId, salesId: t.assignee }) &&
          (!t.bookingId || visibleIds.has(t.bookingId)),
      )
      .map((t) => ({
        id: t.id,
        title: t.title,
        detail: TASK_STATUS[t.status][0],
        days: daysFromToday(t.date),
        status: t.status,
        href: t.bookingId
          ? `/bookings/${t.bookingId}`
          : t.serviceOrderId
            ? "/stock/service-orders"
            : "/",
      })),
    vehicles: can("stock")
      ? state.vehicles.filter(inScope).map((v) => ({
          id: v.id,
          title: v.model,
          detail: `${v.code} · ${thb(v.price)} · ${v.ready && v.status === "available" ? "พร้อมขาย" : "ยังไม่พร้อมจอง"}`,
          href: `/stock/${v.id}`,
          ready: v.ready && v.status === "available",
          bonus: v.bonus && daysFromToday(v.bonus.until) >= 0 ? v.bonus.amount : 0,
        }))
      : [],
    commissions: can("sales")
      ? state.commissions
          .filter((c) => {
            const b = state.bookings.find((b) => b.id === c.bookingId);
            return b && inScope(b);
          })
          .map((c) => ({
            id: c.id,
            title: c.claimNo ?? c.id,
            detail: `${c.bookingId} · ${COMM_STATUS[c.status][0]}`,
            href: "/sales/commission",
          }))
      : [],
    refunds: bookings
      .filter((b) => b.refund && inScope({ branchId: b.refund.branchId, salesId: b.salesId }))
      .map((b) => ({
        id: b.refund!.id,
        title: b.id,
        detail: `คืนเงิน ${thb(b.refund!.amount)} · ${b.refund!.status}`,
        href: `/bookings/${b.id}`,
      })),
    loyalty: can("customer")
      ? state.customers.filter(inScope).map((c) => ({
          id: c.id,
          title: c.id,
          detail: `${c.tier} · ${c.points.toLocaleString("th-TH")} Point${c.points !== c.extPoints ? " · ยอดคลาดเคลื่อน รอตรวจสอบ" : ""}`,
          href: `/customers/${c.id}`,
        }))
      : [],
    documents: bookings.map((b) => ({
      id: b.id,
      title: b.id,
      detail: `${b.ocr.confirmed ? "ยืนยันบัตรประชาชนแล้ว" : "รอตรวจ OCR บัตรประชาชน"} · AMLO ${b.amlo.status} (จำลอง) · E-Signature ${b.esign.status}${b.ocr.analysis ? ` · เอกสารล่าสุด ${b.ocr.analysis.confirmedAt ? "ตรวจแล้ว" : "รอยืนยัน"}` : ""}`,
      href: `/bookings/${b.id}`,
    })),
  };
}
