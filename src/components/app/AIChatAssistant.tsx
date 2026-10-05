import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Bot, Send, Loader2, RotateCcw, ArrowUpRight, MessageCircle } from "lucide-react";
import { useStore } from "@/lib/store";
import { buildAssistantContext } from "@/lib/ai/context";
import { chatProvider } from "@/lib/ai/providers";
import type { AssistantMessage } from "@/lib/ai/types";
import { refId } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DemoTag } from "./ui-kit";

const QUICK = [
  "สรุปภาพรวม",
  "งานวันนี้มีอะไรบ้าง",
  "รถพร้อมขายที่มี Bonus",
  "ตรวจเอกสาร OCR อย่างไร",
];
export function AIChatAssistant({ path }: { path: string }) {
  const { state, can, inScope, user, branch, branchName } = useStore();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const [simulateError, setSimulateError] = useState(false);
  const request = useRef<AbortController | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const sending = useRef(false);
  const context = buildAssistantContext(state, {
    can,
    inScope,
    roleName: user.roleName,
    branchLabel: branch === "all" ? "ทุกสาขาที่มีสิทธิ์" : branchName(branch),
    path,
  });
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (open && list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [open, messages, busy, error]);
  const send = async (text: string, retry = false) => {
    const q = text.trim();
    if (sending.current) return;
    if (!q || q.length > 2000) {
      setError("กรอกคำถาม 1–2,000 ตัวอักษร");
      return;
    }
    sending.current = true;
    setBusy(true);
    setError("");
    setLastQuestion(q);
    setQuestion("");
    const controller = new AbortController();
    request.current = controller;
    if (!retry)
      setMessages((m) => [...m, { id: refId("MSG"), role: "user" as const, text: q }].slice(-20));
    try {
      if (simulateError) {
        setSimulateError(false);
        throw new Error("บริการ Chat จำลองขัดข้อง ลองส่งคำถามเดิมอีกครั้งได้");
      }
      const reply = await chatProvider.reply(
        {
          question: q,
          context,
          history: messages.slice(-12).map(({ role, text }) => ({ role, text })),
        },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setMessages((m) =>
        [...m, { id: refId("MSG"), role: "assistant" as const, ...reply }].slice(-20),
      );
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : "ตอบคำถามไม่สำเร็จ");
    } finally {
      if (!controller.signal.aborted) {
        setBusy(false);
        sending.current = false;
      }
    }
  };
  const clear = () => {
    request.current?.abort();
    sending.current = false;
    setBusy(false);
    setMessages([]);
    setError("");
    setQuestion("");
    setLastQuestion("");
    setSimulateError(false);
  };
  return (
    <>
      <Button
        className="no-print fixed bottom-5 right-5 z-30 shadow-card"
        aria-label="เปิด AI Chat Assistant"
        onClick={() => setOpen(true)}
      >
        <MessageCircle className="size-4" />
        <span>AI Assistant</span>
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
          <SheetHeader className="border-b p-5 pr-12">
            <SheetTitle className="flex items-center gap-2">
              <Bot className="size-5 text-primary" /> AI Chat Assistant <DemoTag />
            </SheetTitle>
            <SheetDescription>ช่วยค้นหารายการ สรุปงาน และแนะนำขั้นตอนในระบบ</SheetDescription>
          </SheetHeader>
          <div className="border-b bg-muted/40 px-5 py-3 text-xs">
            <p className="font-medium">
              {context.roleName} · {context.branchLabel}
            </p>
            <p className="mt-1 text-muted-foreground">
              {context.currentBookingId
                ? `บริบท: ${context.currentBookingId}`
                : "ข้อมูลตามสิทธิ์ของคุณ"}{" "}
              ใช้คำตอบที่เตรียมไว้ ไม่เรียก AI ภายนอก
            </p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <label className="flex items-center gap-1.5 text-muted-foreground">
                <input
                  type="checkbox"
                  checked={simulateError}
                  disabled={busy}
                  onChange={(e) => setSimulateError(e.target.checked)}
                />{" "}
                จำลอง Chat Error ครั้งถัดไป
              </label>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                disabled={!messages.length && !error}
                onClick={clear}
              >
                <RotateCcw className="size-3" /> เริ่มแชตใหม่
              </Button>
            </div>
          </div>
          <div
            ref={list}
            className="min-h-0 flex-1 overflow-y-auto px-5 py-4"
            aria-label="ประวัติการสนทนา"
          >
            {!messages.length && (
              <div>
                <div className="mb-4 rounded-md border bg-card p-4">
                  <p className="text-sm font-medium">สวัสดีครับ ให้ช่วยเรื่องไหน?</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    ถามงานวันนี้ รถพร้อม Bonus หรือเลข Booking ได้
                    ผู้ช่วยไม่แก้ไขหรืออนุมัติรายการให้
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[...(context.currentBookingId ? ["สรุปการจองนี้"] : []), ...QUICK].map((q) => (
                    <Button
                      key={q}
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void send(q)}
                    >
                      {q}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-4" role="log" aria-live="polite">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={
                    m.role === "user"
                      ? "ml-8 rounded-md bg-primary px-4 py-3 text-primary-foreground"
                      : "mr-2 rounded-md border bg-card px-4 py-3"
                  }
                >
                  <p className="mb-1 text-xs font-medium">
                    {m.role === "user" ? "คุณ" : "AI Assistant"}
                  </p>
                  <p className="whitespace-pre-wrap break-words text-sm">{m.text}</p>
                  {!!m.references?.length && (
                    <ul className="mt-3 space-y-2">
                      {m.references.map((r, index) => (
                        <li key={`${r.id}-${index}`}>
                          <Link
                            to={r.href}
                            onClick={() => setOpen(false)}
                            className="block rounded-sm border bg-muted/30 p-2 text-xs hover:border-primary"
                          >
                            <span className="flex items-center gap-1 font-medium text-primary">
                              {r.title}
                              <ArrowUpRight className="size-3" />
                            </span>
                            <span className="mt-1 block text-muted-foreground">{r.detail}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                  {m.role === "assistant" && m.id === messages.at(-1)?.id && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {m.suggestions?.map((q) => (
                        <Button
                          key={q}
                          size="sm"
                          variant="outline"
                          className="h-auto whitespace-normal py-1 text-xs"
                          disabled={busy}
                          onClick={() => void send(q)}
                        >
                          {q}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {busy && (
              <p
                role="status"
                className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"
              >
                <Loader2 className="size-4 animate-spin" /> กำลังตอบจากข้อมูล...
              </p>
            )}
            {error && (
              <div
                role="alert"
                className="mt-4 rounded-sm border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
              >
                <p>{error}</p>
                {lastQuestion && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    disabled={busy}
                    onClick={() => void send(lastQuestion, true)}
                  >
                    ลองคำถามเดิมอีกครั้ง
                  </Button>
                )}
              </div>
            )}
          </div>
          <form
            className="border-t bg-card p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void send(question);
            }}
          >
            <div className="flex gap-2">
              <Textarea
                aria-label="คำถามถึง AI Assistant"
                placeholder="ถามงาน การจอง เอกสาร หรือรถที่พร้อมขาย..."
                value={question}
                maxLength={2000}
                rows={2}
                disabled={busy}
                className="max-h-32 min-h-16 resize-none"
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void send(question);
                  }
                }}
              />
              <Button
                type="submit"
                size="icon"
                className="self-end"
                disabled={busy || !question.trim()}
                aria-label="ส่งคำถาม"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Enter ส่ง · Shift+Enter ขึ้นบรรทัดใหม่ · บทสนทนาอยู่ในหน้านี้
              เมื่อเปลี่ยนบทบาทหรือขอบเขตสิทธิ์จะเริ่มใหม่
            </p>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
