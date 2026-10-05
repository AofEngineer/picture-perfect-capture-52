import type { Tone } from "@/components/app/ui-kit";
import type {
  StockStatus,
  BookingStatus,
  TaskStatus,
  Task,
  AmloStatus,
  EsignStatus,
  Refund,
  PlateStatus,
  CommissionStatus,
  ServiceOrder,
  LoyaltyTx,
  Integration,
} from "./mock/types";

type L<K extends string> = Record<K, [string, Tone]>;

export const STOCK_STATUS: L<StockStatus> = {
  available: ["พร้อมขาย", "success"],
  reserved: ["จองแล้ว", "info"],
  incoming: ["รอรับเข้า", "neutral"],
  transfer: ["อยู่ระหว่างโอนสาขา", "warning"],
  prep: ["อยู่ระหว่างเตรียมรถ/ดูแลรถ", "warning"],
  sold: ["ขายแล้ว/ส่งมอบแล้ว", "dark"],
};
export const BOOKING_STATUS: L<BookingStatus> = {
  active: ["กำลังดำเนินการ", "info"],
  expired: ["หลุดจอง", "danger"],
  closed: ["ปิดการขาย", "success"],
  cancelled: ["ยกเลิก", "neutral"],
};
export const TASK_STATUS: L<TaskStatus> = {
  todo: ["ยังไม่เริ่ม", "neutral"],
  doing: ["กำลังดำเนินการ", "info"],
  waiting: ["รอข้อมูล", "warning"],
  done: ["เสร็จสิ้น", "success"],
  overdue: ["เกินกำหนด", "danger"],
};
export const TASK_TYPE: Record<Task["type"], string> = {
  testdrive: "นัด Test Drive",
  delivery: "นัดส่งมอบรถ",
  docs: "ติดตามเอกสาร",
  payment: "ติดตามชำระเงิน",
  plate: "คืนป้ายแดง",
  prep: "ดูแลรถก่อนส่งมอบ",
};
export const AMLO_STATUS: L<AmloStatus> = {
  none: ["ยังไม่ตรวจ", "neutral"],
  checking: ["กำลังตรวจ", "info"],
  clear: ["ไม่พบรายการตรงกัน", "success"],
  review: ["ต้องตรวจสอบเพิ่มเติม", "warning"],
  error: ["ระบบภายนอกขัดข้อง", "danger"],
};
export const ESIGN_STATUS: L<EsignStatus> = {
  draft: ["ร่าง", "neutral"],
  pending: ["รอลงนาม", "warning"],
  partial: ["ลงนามบางส่วน", "info"],
  done: ["ครบแล้ว", "success"],
  expired: ["หมดอายุ", "danger"],
};
export const REFUND_STATUS: L<Refund["status"]> = {
  pending: ["รอดำเนินการ", "warning"],
  approved: ["อนุมัติแล้ว", "info"],
  rejected: ["ไม่เข้าเงื่อนไข", "danger"],
  paid: ["คืนเงินแล้ว", "success"],
  closed: ["ปิดคำขอ", "dark"],
};
export const PLATE_STATUS: L<PlateStatus> = {
  available: ["พร้อมใช้", "success"],
  matched: ["จับคู่แล้ว/ยืมอยู่", "info"],
  lost: ["สูญหาย", "danger"],
  transfer: ["อยู่ระหว่างโอน", "warning"],
  checking: ["รอตรวจสภาพ", "neutral"],
};
export const COMM_STATUS: L<CommissionStatus> = {
  draft: ["ร่าง", "neutral"],
  submitted: ["ส่งเบิก", "info"],
  mgr_review: ["ผู้จัดการตรวจสอบ", "warning"],
  fin_review: ["ฝ่ายการเงินตรวจสอบ", "warning"],
  approved: ["อนุมัติ", "info"],
  paid: ["จ่ายแล้ว", "success"],
  rejected: ["ตีกลับ", "danger"],
};
export const SO_STATUS: L<ServiceOrder["status"]> = {
  todo: ["ยังไม่เริ่ม", "neutral"],
  doing: ["กำลังดำเนินการ", "info"],
  done: ["เสร็จสิ้น", "success"],
  overdue: ["เกินกำหนด", "danger"],
};
export const LTX_STATUS: L<LoyaltyTx["status"]> = {
  Pending: ["Pending", "warning"],
  Success: ["Success", "success"],
  Failed: ["Failed", "danger"],
  Reversed: ["Reversed", "neutral"],
};
export const MATCH_STATUS: L<LoyaltyTx["match"]> = {
  matched: ["ตรงกัน", "success"],
  mismatch: ["คลาดเคลื่อน", "danger"],
  pending: ["รอเทียบยอด", "warning"],
};
export const INTEG_STATUS: L<Integration["status"]> = {
  connected: ["Connected", "success"],
  disconnected: ["Disconnected", "neutral"],
  error: ["Error", "danger"],
};
