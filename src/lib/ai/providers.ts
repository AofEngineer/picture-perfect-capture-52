import { analyzeDemoDocument } from "./documents";
import type {
  AssistantRecord,
  AssistantReply,
  ChatProvider,
  ChatRequest,
  DocumentProvider,
} from "./types";

function delay(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException("ยกเลิกคำขอ", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, ms);
    if (signal?.aborted) abort();
    else signal?.addEventListener("abort", abort, { once: true });
  });
}
export function answerDemoQuestion({ question, context: c }: ChatRequest): AssistantReply {
  const q = question.trim().toLowerCase();
  if (!q || q.length > 2000) throw new Error("กรอกคำถาม 1–2,000 ตัวอักษร");
  const reply = (
    text: string,
    records: AssistantRecord[] = [],
    suggestions = ["งานวันนี้มีอะไรบ้าง", "การจองใกล้หมดอายุ", "รถพร้อมขายที่มี Bonus"],
  ): AssistantReply => ({
    text,
    references: records
      .slice(0, 5)
      .map(({ id, title, detail, href }) => ({ id, title, detail, href })),
    suggestions,
  });
  if (/api.?key|password|รหัสผ่าน|เลขบัตร|เบอร์โทร|ต้นทุน|ignore|system prompt|ข้ามสิทธิ์/.test(q))
    return reply(
      "ผู้ช่วย ใช้ข้อมูลสรุปตามสิทธิ์เท่านั้น ไม่มีรหัสผ่าน เลขบัตร เบอร์โทร หรือต้นทุนในบริบท กรุณาเปิดหน้าข้อมูลผ่านสิทธิ์ของคุณ",
    );
  if (/^(อนุมัติ|จ่าย|โอนเงิน|ยกเลิกการจอง|เปลี่ยนสิทธิ์|ลบ|บันทึก|สร้าง)/.test(q))
    return reply(
      "ผู้ช่วยแนะนำและค้นหาข้อมูลได้ การสร้าง แก้ไข จ่ายเงิน หรืออนุมัติ ต้องดำเนินการผ่านหน้าระบบโดยผู้มีสิทธิ์ ผู้ช่วยไม่ได้เปลี่ยนข้อมูลให้",
      c.bookings.filter((b) => q.includes(b.id.toLowerCase())),
    );
  const id = q.match(/(?:bk-\d{4}-\d+|c\d{2}|v\d{2}|cm-\d{2}|so-\d{2})/i)?.[0]?.toLowerCase();
  if (id) {
    const records = [
      ...c.bookings,
      ...c.documents,
      ...c.vehicles,
      ...c.commissions,
      ...c.loyalty,
      ...c.tasks,
    ].filter((r) => r.id.toLowerCase() === id);
    return records.length
      ? reply(records.map((r) => `${r.title}: ${r.detail}`).join("\n"), records)
      : reply("ไม่พบรายการนี้ในข้อมูลที่คุณมีสิทธิ์ดู กรุณาตรวจรหัสหรือสาขาที่เลือก");
  }
  if (/เอกสาร|ocr|ตรวจบัตร/.test(q)) {
    const records = c.currentBookingId
      ? c.documents.filter((d) => d.id === c.currentBookingId)
      : c.documents;
    return reply(
      "OCR รองรับบัตรประชาชน ทะเบียนบ้าน และหลักฐานชำระเงิน เลือกไฟล์หรือเอกสารตัวอย่าง ตรวจข้อมูลที่อ่านได้และความมั่นใจ แก้ช่องที่ผิด แล้วกดยืนยันโดยผู้ใช้ ระบบจะบล็อกบัตรหมดอายุและข้อมูลไม่ตรงการจอง ผลอ่านเป็นข้อมูลจำลอง ไม่มีการอ่านเนื้อหาไฟล์จริง",
      records,
      ["สรุปการจองนี้", "ขั้นตอนการขายรถ", "งานวันนี้มีอะไรบ้าง"],
    );
  }
  if (/สรุปการจองนี้|ขั้นตอนถัดไป/.test(q) && c.currentBookingId) {
    const b = c.bookings.find((b) => b.id === c.currentBookingId)!;
    return reply(
      `${b.id}: ${b.detail}\nตรวจเงื่อนไขในแท็บ Workflow & Tasks ก่อนผ่านขั้นตอน ระบบจะตรวจ OCR, AMLO, ลายเซ็น, การชำระเงิน, Checklist และป้ายแดงตามลำดับ`,
      [b, ...c.documents.filter((d) => d.id === b.id)],
    );
  }
  if (/หมดอายุ|หลุดจอง/.test(q)) {
    const rows = c.bookings.filter(
      (b) => (b.status === "active" && b.expiresIn <= 2) || b.status === "expired",
    );
    return reply(
      `พบการจองใกล้หมดอายุหรือหลุดจอง ${rows.length} รายการในขอบเขตสิทธิ์ ติดตามการชำระและเงื่อนไขปล่อยรถผ่านหน้าการจอง`,
      rows,
    );
  }
  if (/bonus|รถพร้อม|สต๊อก|stock|ค้นหารถ/.test(q)) {
    const rows = c.vehicles.filter((v) => v.ready && (!q.includes("bonus") || v.bonus > 0));
    return reply(
      `พบรถพร้อมขาย${q.includes("bonus") ? "ที่มี Bonus ปัจจุบัน" : ""} ${rows.length} คันในสาขาที่มีสิทธิ์ ตรวจเงื่อนไข Bonus และวันส่งมอบในหน้ารถก่อนสร้าง Booking`,
      rows,
    );
  }
  if (/commission|คอมมิช/.test(q))
    return reply(
      `พบ Commission ${c.commissions.length} รายการตามสิทธิ์ ลำดับคือส่งเบิก → ผู้จัดการตรวจผ่าน → ฝ่ายการเงินอนุมัติ → บันทึกจ่าย รถต้องส่งมอบและชำระครบก่อนส่งเบิก`,
      c.commissions,
    );
  if (/คืนเงิน|refund/.test(q))
    return reply(
      `พบคำขอคืนเงิน ${c.refunds.length} รายการตามสิทธิ์ เปิด Refund ของ Booking ใส่เหตุผล ผู้จัดการอนุมัติ แล้วฝ่ายการเงินบันทึกช่องทางและหลักฐาน ระบบคืน Point เพียงครั้งเดียวและรออนุมัติปล่อยรถ`,
      c.refunds,
    );
  if (/loyalty|point|แต้ม/.test(q))
    return reply(
      `พบสมาชิก ${c.loyalty.length} รายตามสิทธิ์ การใช้ Point ต้องไม่เกินยอดคงเหลือและเพดาน หาก API จำลองล้มเหลวจะไม่หักยอด ให้ผู้ดูแล Retry ด้วย Reference เดิม รายการยอดคลาดเคลื่อนต้องตรวจสอบก่อนปรับ`,
      c.loyalty,
    );
  if (/งาน|นัด|today|วันนี้|พรุ่งนี้|เกินกำหนด/.test(q)) {
    const rows = c.tasks.filter(
      (t) =>
        t.status !== "done" &&
        (q.includes("พรุ่งนี้")
          ? t.days === 1
          : q.includes("เกินกำหนด")
            ? t.days < 0
            : t.days === 0),
    );
    return reply(
      `พบงาน${q.includes("พรุ่งนี้") ? "พรุ่งนี้" : q.includes("เกินกำหนด") ? "เกินกำหนด" : "วันนี้"} ${rows.length} รายการที่คุณมีสิทธิ์ดู ตรวจผู้รับผิดชอบและสถานะในหน้ารายการ`,
      rows,
    );
  }
  if (/ขั้นตอน|ขายรถ|workflow/.test(q))
    return reply(
      "ขั้นตอนขาย: ค้นหารถพร้อมขาย → สร้าง Booking → OCR → AMLO จำลอง → ลงนาม → รับชำระ/ใช้ Point → เตรียมรถและ Checklist → จับคู่ป้ายแดง/ออกใบส่งมอบ → ผู้จัดการปิดการขาย → ส่งเบิก Commission",
      c.currentBookingId ? c.bookings.filter((b) => b.id === c.currentBookingId) : [],
    );
  if (/สรุป|ช่วย|เริ่ม|overview/.test(q))
    return reply(
      `ขอบเขตปัจจุบัน: ${c.roleName} · ${c.branchLabel}\nการจอง ${c.bookings.length} รายการ · งาน ${c.tasks.filter((t) => t.status !== "done").length} งาน · รถพร้อมขาย ${c.vehicles.filter((v) => v.ready).length} คัน\nถามเกี่ยวกับงานวันนี้ รถ Bonus การจอง เอกสาร Loyalty คืนเงิน หรือ Commission ได้`,
      c.bookings.slice(0, 3),
    );
  return reply(
    "ผู้ช่วยนี้ตอบจากหัวข้อที่เตรียมไว้และข้อมูลสรุปในระบบ ยังไม่ใช่โมเดล AI จริง ลองถามงานวันนี้ การจองใกล้หมดอายุ รถพร้อม Bonus หรือระบุเลข Booking เพื่อค้นหา",
    [],
    ["สรุปภาพรวม", "ตรวจเอกสาร OCR อย่างไร", "ขั้นตอนการขายรถ"],
  );
}

// Implement these interfaces with server-backed adapters when enabling a real API.
// No file, context or question leaves the browser in demo mode.
export const documentProvider: DocumentProvider = {
  async analyze(request, signal) {
    await delay(700, signal);
    return analyzeDemoDocument(request);
  },
};
export const chatProvider: ChatProvider = {
  async reply(request, signal) {
    await delay(450, signal);
    return answerDemoQuestion(request);
  },
};
