import { useEffect, useRef, useState } from "react";
import { FileText, ScanLine, Upload, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import type { Booking } from "@/lib/mock/types";
import {
  DOCUMENT_LABEL,
  confirmDocumentReview,
  documentIssues,
  documentSubject,
  saveDocumentReview,
  validateDocumentFile,
} from "@/lib/ai/documents";
import { documentProvider } from "@/lib/ai/providers";
import type { DemoDocumentScenario, DocumentAnalysis, DocumentKind } from "@/lib/ai/types";
import { thDateTime } from "@/lib/format";
import { useDemoAction, ConfirmAction } from "./actions";
import { DemoTag, Panel, StatusBadge } from "./ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function DocumentReview({ booking }: { booking: Booking }) {
  const { state, can, user, sensitive } = useStore();
  const run = useDemoAction();
  const [kind, setKind] = useState<DocumentKind>(booking.ocr.analysis?.kind ?? "id-card");
  const [scenario, setScenario] = useState<DemoDocumentScenario>("clear");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<DocumentAnalysis | null>(booking.ocr.analysis ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const subject = documentSubject(booking, state);
  const editable = can("booking", "edit");
  const issues = analysis ? documentIssues(analysis, subject) : [];
  const confirmed = analysis?.confirmedAt;
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    setAnalysis(booking.ocr.analysis ?? null);
  }, [booking.ocr.analysis]);

  const analyze = async (sample = false) => {
    if (!editable || busy) return;
    if (!sample && !file) {
      setError("เลือกเอกสารก่อนเริ่มตรวจ");
      return;
    }
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setError("");
    setBusy(true);
    try {
      if (state.integrations.find((i) => i.id === "ocr")?.status !== "connected")
        throw new Error("OCR จำลองขัดข้อง — Retry ที่ Integrations แล้วลองอีกครั้ง");
      const result = await documentProvider.analyze(
        {
          kind,
          scenario,
          sourceName: sample ? `เอกสารตัวอย่าง: ${DOCUMENT_LABEL[kind]}` : file!.name,
          subject,
          file: sample ? undefined : (file ?? undefined),
        },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      if (
        run("booking", "edit", "Booking", booking, "บันทึกผลตรวจ OCR จำลองแล้ว", (d) =>
          saveDocumentReview(
            d.bookings.find((b) => b.id === booking.id)!,
            result,
            user.name,
          ),
        )
      ) {
        setAnalysis(result);
        if (sample) setFile(null);
      }
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : "ตรวจเอกสารไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  const change = (key: string, value: string) =>
    setAnalysis(
      (a) =>
        a && {
          ...a,
          fields: a.fields.map((f) =>
            f.key === key ? { ...f, value, edited: true, reviewed: true } : f,
          ),
        },
    );
  return (
    <Panel
      className="lg:col-span-2"
      title={
        <span className="flex items-center gap-2">
          <ScanLine className="size-4" /> OCR Document Review
        </span>
      }
      actions={<DemoTag />}
    >
      <p className="mb-4 rounded-sm bg-demo/50 p-3 text-xs text-demo-foreground">
        OCR ใช้ผลอ่านสมมติจากข้อมูลการจอง ไม่มีการอ่านเนื้อหาไฟล์จริงหรือส่งไฟล์ออกจากเครื่อง
        รูปที่เลือกใช้ดูตัวอย่างเท่านั้น ผู้ใช้ต้องตรวจและยืนยันผลเอง
      </p>
      {booking.ocr.confirmed && !booking.ocr.analysis && (
        <p className="mb-3 text-xs text-success">
          ข้อมูลบัตรได้รับการยืนยันก่อนหน้านี้แล้ว เริ่มตรวจเอกสารใหม่ได้ด้านล่าง
        </p>
      )}
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="ocr-kind">ประเภทเอกสาร</Label>
          <Select
            value={kind}
            disabled={busy || !editable}
            onValueChange={(v) => {
              setKind(v as DocumentKind);
              if (v !== "id-card" && scenario === "expired") setScenario("clear");
            }}
          >
            <SelectTrigger id="ocr-kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(DOCUMENT_LABEL).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="ocr-scenario">กรณีสาธิต</Label>
          <Select
            value={scenario}
            disabled={busy || !editable}
            onValueChange={(v) => setScenario(v as DemoDocumentScenario)}
          >
            <SelectTrigger id="ocr-scenario">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="clear">เอกสารถูกต้อง</SelectItem>
              <SelectItem value="blurred">อ่านไม่ชัด / ความมั่นใจต่ำ</SelectItem>
              <SelectItem value="expired" disabled={kind !== "id-card"}>
                บัตรหมดอายุ
              </SelectItem>
              <SelectItem value="mismatch">ข้อมูลไม่ตรงการจอง</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="mb-4 rounded-md border-2 border-dashed p-4">
        <input
          aria-label="เลือกเอกสารสำหรับ OCR"
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="sr-only"
          disabled={busy || !editable}
          onChange={(e) => {
            const selected = e.target.files?.[0];
            if (!selected) return;
            const invalid = validateDocumentFile(selected);
            setError(invalid ?? "");
            setFile(invalid ? null : selected);
            e.target.value = "";
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            disabled={!editable || busy}
            onClick={() => fileInput.current?.click()}
          >
            <Upload className="size-4" /> เลือกเอกสาร
          </Button>
          <Button disabled={!file || busy || !editable} onClick={() => void analyze()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ScanLine className="size-4" />}{" "}
            ตรวจเอกสารจำลอง
          </Button>
          <Button variant="outline" disabled={busy || !editable} onClick={() => void analyze(true)}>
            ใช้เอกสารตัวอย่าง
          </Button>
        </div>
        <p className="mt-2 break-all text-xs text-muted-foreground">
          {file
            ? `${file.name} · ${(file.size / 1024).toFixed(0)} KB`
            : "JPG, PNG, WebP หรือ PDF · สูงสุด 10 MB"}
        </p>
        {preview && (
          <img
            src={preview}
            alt="ตัวอย่างเอกสารที่เลือกในเครื่อง"
            className="mt-3 max-h-56 max-w-full rounded-sm border object-contain"
          />
        )}
        {file?.type === "application/pdf" && (
          <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <FileText className="size-4" /> เลือก PDF แล้ว ผล OCR ด้านล่างยังเป็นข้อมูลสมมติ
          </p>
        )}
      </div>
      {busy && (
        <p role="status" className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> กำลังประมวลผล OCR จำลอง...
        </p>
      )}
      {error && (
        <div
          role="alert"
          className="mb-3 rounded-sm border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {error}
          <Button
            size="sm"
            variant="outline"
            className="ml-2"
            disabled={busy || !editable}
            onClick={() => void analyze(!file)}
          >
            ลองใหม่
          </Button>
        </div>
      )}
      {analysis && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">ผลอ่าน: {DOCUMENT_LABEL[analysis.kind]}</h3>
              <p className="break-all text-xs text-muted-foreground">
                {analysis.sourceName} · {thDateTime(analysis.analyzedAt)} · {analysis.id}
              </p>
            </div>
            <StatusBadge tone={confirmed ? "success" : issues.length ? "warning" : "info"}>
              {confirmed
                ? "ผู้ใช้ยืนยันแล้ว"
                : issues.length
                  ? "ต้องตรวจเพิ่มเติม"
                  : "พร้อมให้ผู้ใช้ยืนยัน"}
            </StatusBadge>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {analysis.fields.map((f) => (
              <div key={f.key}>
                <div className="mb-1 flex flex-wrap items-center justify-between gap-1">
                  <Label htmlFor={`ocr-${f.key}`}>{f.label}</Label>
                  <StatusBadge tone={f.confidence < 80 ? "warning" : "success"}>
                    ความมั่นใจ {f.confidence}%
                  </StatusBadge>
                </div>
                <Input
                  id={`ocr-${f.key}`}
                  type={f.input}
                  value={
                    !editable && !sensitive && f.key === "idNumber"
                      ? `${f.value.slice(0, 3)}xxxxxxxxxx`
                      : f.value
                  }
                  disabled={!editable || !!confirmed || busy}
                  onChange={(e) => change(f.key, e.target.value)}
                  aria-invalid={issues.some((i) => i.key === f.key && i.level === "block")}
                />
                {f.confidence < 80 && (
                  <label className="mt-1 flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={f.reviewed}
                      disabled={!editable || !!confirmed || busy}
                      onChange={(e) =>
                        setAnalysis(
                          (a) =>
                            a && {
                              ...a,
                              fields: a.fields.map((x) =>
                                x.key === f.key ? { ...x, reviewed: e.target.checked } : x,
                              ),
                            },
                        )
                      }
                    />{" "}
                    ตรวจช่อง {f.label} แล้ว
                  </label>
                )}
                {f.edited && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    แก้ไขโดยผู้ใช้ · ความมั่นใจเดิมของผล OCR
                  </p>
                )}
              </div>
            ))}
          </div>
          {!confirmed && issues.length > 0 && (
            <div role="status" className="rounded-sm border border-warning/40 bg-warning/10 p-3">
              <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                <AlertTriangle className="size-4" /> จุดที่ต้องตรวจ ({issues.length})
              </p>
              <ul className="list-disc space-y-1 pl-4 text-xs">
                {issues.map((i, index) => (
                  <li key={`${i.key}-${index}`}>{i.message}</li>
                ))}
              </ul>
            </div>
          )}
          {confirmed ? (
            <p className="flex items-center gap-2 text-xs text-success">
              <CheckCircle2 className="size-4" /> ยืนยันโดย {analysis.confirmedBy} ·{" "}
              {thDateTime(confirmed)}
            </p>
          ) : (
            <ConfirmAction
              disabled={!editable || busy || issues.length > 0}
              description={`ยืนยันว่าได้ตรวจ ${DOCUMENT_LABEL[analysis.kind]} และข้อมูลถูกต้องแล้ว${analysis.kind === "payment-slip" ? " การยืนยันนี้ไม่บันทึกรับชำระเงิน" : ""}`}
              onConfirm={() => {
                if (
                  run("booking", "edit", "Booking", booking, "ยืนยันผลตรวจเอกสาร OCR แล้ว", (d) =>
                    confirmDocumentReview(
                      d.bookings.find((b) => b.id === booking.id)!,
                      d,
                      analysis,
                      user.name,
                    ),
                  )
                )
                  toast.success("บันทึกผู้ตรวจและผลยืนยันแล้ว");
              }}
            >
              ตรวจสอบแล้ว — ยืนยันเอกสาร
            </ConfirmAction>
          )}
        </div>
      )}
      {!!booking.ocr.documents?.length && (
        <div className="mt-5 border-t pt-3">
          <h3 className="mb-2 text-xs font-semibold">ประวัติเอกสารที่ยืนยัน</h3>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {booking.ocr.documents
              .slice()
              .reverse()
              .map((d) => (
                <li key={d.id}>
                  {DOCUMENT_LABEL[d.kind]} · {d.confirmedBy} · {thDateTime(d.confirmedAt)}
                </li>
              ))}
          </ul>
        </div>
      )}
      {!editable && (
        <p className="mt-3 text-xs text-muted-foreground">บทบาทปัจจุบันดูผลตรวจได้อย่างเดียว</p>
      )}
    </Panel>
  );
}
