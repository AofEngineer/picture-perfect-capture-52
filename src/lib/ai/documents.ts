import type { Booking, DemoState } from "@/lib/mock/types";
import { refId } from "@/lib/format";
import type {
  DocumentAnalysis,
  DocumentAnalysisRequest,
  DocumentField,
  DocumentIssue,
  DocumentKind,
  DocumentSubject,
} from "./types";

export const DOCUMENT_LABEL: Record<DocumentKind, string> = {
  "id-card": "บัตรประชาชน",
  "house-registration": "ทะเบียนบ้าน",
  "payment-slip": "หลักฐานชำระเงิน",
};
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const normalizeId = (v: string) => v.replace(/[-\s]/g, "");
export function validateDocumentFile(file: Pick<File, "name" | "size" | "type">): string | null {
  const expected: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    pdf: "application/pdf",
  };
  const ext = file.name.split(".").at(-1)?.toLowerCase() ?? "";
  if (!expected[ext] || (file.type && file.type !== expected[ext]))
    return "รองรับ JPG, PNG, WebP และ PDF เท่านั้น";
  if (!file.size) return "ไฟล์ว่าง กรุณาเลือกไฟล์ใหม่";
  if (file.size > MAX_DOCUMENT_BYTES) return "ไฟล์ต้องมีขนาดไม่เกิน 10 MB";
  return null;
}
const normalizeName = (v: string) =>
  v
    .replace(/^คุณ\s*/, "")
    .replace(/\s+/g, "")
    .trim();
const dayString = (at: Date, years: number) => {
  const d = new Date(at);
  d.setFullYear(d.getFullYear() + years);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export function analyzeDemoDocument(
  request: DocumentAnalysisRequest,
  at = new Date(),
): DocumentAnalysis {
  const field = (
    key: string,
    label: string,
    value: string,
    confidence = 98,
    input: DocumentField["input"] = "text",
  ): DocumentField => ({
    key,
    label,
    value,
    confidence: request.scenario === "blurred" ? Math.min(confidence, 62) : confidence,
    input,
    reviewed: false,
  });
  const { subject: s, kind, scenario } = request;
  const name = scenario === "mismatch" ? "ผู้ถือเอกสารตัวอย่างอื่น" : s.name.replace(/^คุณ\s*/, "");
  const fields =
    kind === "payment-slip"
      ? [
          field("bookingId", "เลขที่การจอง", scenario === "mismatch" ? "BK-OTHER" : s.bookingId),
          field("amount", "ยอดชำระ (บาท)", String(s.deposit), 95, "number"),
          field("paymentDate", "วันที่ชำระ", dayString(at, 0), 96, "date"),
          field("reference", "เลขอ้างอิง", `PAY-${s.bookingId}`, 94),
        ]
      : [
          field("name", "ชื่อ-นามสกุล", name),
          field("idNumber", "เลขประจำตัวประชาชน", normalizeId(s.idNumber), 95),
          field("address", "ที่อยู่", "99/9 ถนนสมมติ แขวงตัวอย่าง เขตทดสอบ กรุงเทพมหานคร", 92),
          ...(kind === "id-card"
            ? [
                field("dob", "วันเกิด", "1985-03-12", 96, "date"),
                field(
                  "expiry",
                  "วันหมดอายุบัตร",
                  dayString(at, scenario === "expired" ? -1 : 3),
                  96,
                  "date",
                ),
              ]
            : [field("houseNumber", "เลขรหัสประจำบ้าน", "12345678901", 94)]),
        ];
  return {
    id: refId("OCR-DEMO"),
    provider: "demo",
    kind,
    sourceName: request.sourceName,
    scenario,
    analyzedAt: at.toISOString(),
    fields,
  };
}
function validDate(v: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    Number.isFinite(new Date(v + "T00:00:00").getTime()) &&
    new Date(v + "T12:00:00Z").toISOString().slice(0, 10) === v
  );
}
export function documentIssues(
  analysis: DocumentAnalysis,
  subject: DocumentSubject,
  at = new Date(),
): DocumentIssue[] {
  const issues: DocumentIssue[] = [];
  const required =
    analysis.kind === "id-card"
      ? ["name", "idNumber", "address", "dob", "expiry"]
      : analysis.kind === "house-registration"
        ? ["name", "idNumber", "address", "houseNumber"]
        : ["bookingId", "amount", "paymentDate", "reference"];
  for (const key of required)
    if (!analysis.fields.find((f) => f.key === key)?.value.trim())
      issues.push({ key, level: "block", message: "กรอกข้อมูลที่จำเป็นให้ครบ" });
  for (const f of analysis.fields) {
    if (f.confidence < 80 && !f.reviewed)
      issues.push({
        key: f.key,
        level: "review",
        message: `${f.label}: ความมั่นใจต่ำ ต้องตรวจและทำเครื่องหมายยืนยัน`,
      });
    if (f.key === "name" && normalizeName(f.value) !== normalizeName(subject.name))
      issues.push({
        key: f.key,
        level: "block",
        message: "ชื่อไม่ตรงกับลูกค้าในการจอง กรุณาตรวจเอกสารและแก้ไขผลอ่าน",
      });
    if (
      f.key === "idNumber" &&
      (normalizeId(f.value) !== normalizeId(subject.idNumber) ||
        !/^\d{13}$/.test(normalizeId(f.value)))
    )
      issues.push({ key: f.key, level: "block", message: "เลขบัตรต้องมี 13 หลักและตรงกับลูกค้า" });
    if (f.input === "date" && !validDate(f.value))
      issues.push({ key: f.key, level: "block", message: `${f.label}: วันที่ไม่ถูกต้อง` });
    if (f.key === "expiry" && validDate(f.value) && f.value < dayString(at, 0))
      issues.push({ key: f.key, level: "block", message: "บัตรหมดอายุ กรุณาใช้เอกสารปัจจุบัน" });
    if (["dob", "paymentDate"].includes(f.key) && validDate(f.value) && f.value > dayString(at, 0))
      issues.push({ key: f.key, level: "block", message: `${f.label}ต้องไม่เป็นวันในอนาคต` });
    if (f.key === "bookingId" && f.value !== subject.bookingId)
      issues.push({ key: f.key, level: "block", message: "เลขที่การจองไม่ตรงกับรายการนี้" });
    if (
      f.key === "amount" &&
      (!Number.isFinite(Number(f.value)) ||
        Number(f.value) <= 0 ||
        Number(f.value) !== subject.deposit)
    )
      issues.push({
        key: f.key,
        level: "block",
        message: "ยอดหลักฐานต้องตรงกับเงินจอง การยืนยันเอกสารจะไม่บันทึกรับเงินอัตโนมัติ",
      });
  }
  return issues;
}
export function documentSubject(b: Booking, state: DemoState): DocumentSubject {
  const customer = state.customers.find((c) => c.id === b.customerId);
  if (!customer) throw new Error("ไม่พบข้อมูลลูกค้า");
  return { bookingId: b.id, name: customer.name, idNumber: customer.idCard, deposit: b.deposit };
}
export function saveDocumentReview(b: Booking, analysis: DocumentAnalysis, actor = "ระบบ") {
  b.ocr.analysis = structuredClone(analysis);
  if (analysis.kind === "id-card") b.ocr.confirmed = false;
  b.history.unshift({
    at: analysis.analyzedAt,
    by: actor,
    text: `ตรวจ OCR จำลอง: ${DOCUMENT_LABEL[analysis.kind]} (${analysis.id})`,
  });
}
export function confirmDocumentReview(
  b: Booking,
  state: DemoState,
  analysis: DocumentAnalysis,
  actor: string,
) {
  if (b.ocr.analysis?.id !== analysis.id)
    throw new Error("ผลตรวจเอกสารเปลี่ยนแล้ว กรุณาอ่านรายการล่าสุด");
  if (b.ocr.analysis.confirmedAt) throw new Error("เอกสารนี้ยืนยันแล้ว");
  const issues = documentIssues(analysis, documentSubject(b, state));
  if (issues.length) throw new Error(issues[0]!.message);
  const confirmed = {
    ...structuredClone(analysis),
    confirmedAt: new Date().toISOString(),
    confirmedBy: actor,
  };
  b.ocr.analysis = confirmed;
  b.ocr.documents = [...(b.ocr.documents ?? []), confirmed].slice(-20);
  b.history.unshift({
    at: confirmed.confirmedAt,
    by: actor,
    text: `ยืนยันเอกสาร: ${DOCUMENT_LABEL[analysis.kind]} (${analysis.id})`,
  });
  if (analysis.kind === "id-card") {
    b.ocr.confirmed = true;
    b.ocr.by = actor;
    b.ocr.at = confirmed.confirmedAt;
    b.ocr.fields = analysis.fields.map((f) => ({ k: f.label, v: f.value, conf: f.confidence }));
  }
}
