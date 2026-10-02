const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export const thb = (n: number) =>
  "฿" + Math.round(n).toLocaleString("th-TH");

export const num = (n: number) => Math.round(n).toLocaleString("th-TH");

export function thDate(iso?: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

export function thDateTime(iso?: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${thDate(iso)} ${hh}:${mm} น.`;
}

export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function daysFromToday(iso: string) {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - startOfToday().getTime()) / 86400000);
}

export function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

export function relDay(iso: string) {
  const n = daysFromToday(iso);
  if (n === 0) return "วันนี้";
  if (n === 1) return "พรุ่งนี้";
  if (n === -1) return "เมื่อวาน";
  return n > 0 ? `อีก ${n} วัน` : `${-n} วันที่แล้ว`;
}

export function maskPhone(p: string) {
  return p.slice(0, 3) + "-xxx-" + p.slice(-4);
}

export function refId(prefix: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1000)}`;
}

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = "\uFEFF" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
