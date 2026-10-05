import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Download, Calculator } from "lucide-react";
import { useStore } from "@/lib/store";
import { downloadCsv, thb, thDateTime } from "@/lib/format";
import {
  advanceCommission,
  calculateCommission,
  commissionEligible,
  commissionTotal,
} from "@/lib/mock/service";
import { COMM_STATUS, BOOKING_STATUS, TASK_STATUS } from "@/lib/labels";
import { printHtml, escapeHtml } from "@/lib/print";
import {
  DataTable,
  DetailDrawer,
  EmptyState,
  Field,
  FilterSelect,
  PageHeader,
  Panel,
  StatusBadge,
  Timeline,
} from "./ui-kit";
import { ConfirmAction, useDemoAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function SalesList() {
  const { state, inScope, branchName } = useStore();
  const navigate = useNavigate();
  const rows = state.sales.filter((s) => inScope({ branchId: s.branchId, salesId: s.id }));
  return (
    <>
      <PageHeader title="Sales" subtitle="ทีมขาย เป้าหมาย ยอดขาย และ Commission" demo />
      <DataTable
        rows={rows}
        searchText={(s) => `${s.id} ${s.code} ${s.name} ${branchName(s.branchId)}`}
        onRowClick={(s) => navigate({ to: "/sales/$id", params: { id: s.id } })}
        columns={[
          {
            key: "name",
            header: "Sales",
            cell: (s) => (
              <div className="font-medium text-primary">
                {s.name}
                <div className="text-xs text-muted-foreground">{s.code}</div>
              </div>
            ),
            sort: (s) => s.name,
          },
          { key: "branch", header: "สาขา", cell: (s) => branchName(s.branchId) },
          {
            key: "units",
            header: "รถที่ขาย / เป้าหมาย",
            cell: (s) =>
              `${state.bookings.filter((b) => b.salesId === s.id && b.status === "closed" && inScope(b)).length} / ${s.target} คัน`,
          },
          {
            key: "sales",
            header: "ยอดขาย",
            cell: (s) =>
              thb(
                state.bookings
                  .filter((b) => b.salesId === s.id && b.status === "closed" && inScope(b))
                  .reduce((sum, b) => sum + b.price, 0),
              ),
          },
          {
            key: "commission",
            header: "Commission รวม",
            cell: (s) =>
              thb(
                state.commissions
                  .filter(
                    (c) =>
                      c.salesId === s.id &&
                      state.bookings.some((b) => b.id === c.bookingId && inScope(b)),
                  )
                  .reduce((sum, c) => sum + commissionTotal(c), 0),
              ),
          },
        ]}
      />
    </>
  );
}

export function SalesDetail({ id }: { id: string }) {
  const { state, inScope, branchName } = useStore();
  const s = state.sales.find((x) => x.id === id);
  if (!s || !inScope({ branchId: s.branchId, salesId: s.id }))
    return <EmptyState title="ไม่พบ Sales หรือไม่มีสิทธิ์ดูข้อมูล" />;
  const bookings = state.bookings.filter((b) => b.salesId === id && inScope(b));
  return (
    <>
      <PageHeader
        title={s.name}
        subtitle={`${s.code} · ${branchName(s.branchId)} · เป้าหมาย ${s.target} คัน`}
        demo
      />
      <Tabs defaultValue="Profile">
        <TabsList className="mb-4 flex h-auto flex-wrap justify-start">
          {["Profile", "Bookings & Sales", "Tasks", "Commission", "Bonus", "Claim History"].map(
            (label) => (
              <TabsTrigger key={label} value={label}>
                {label}
              </TabsTrigger>
            ),
          )}
        </TabsList>
        <TabsContent value="Profile">
          <Panel title="ข้อมูล Sales">
            <div className="grid grid-cols-3 gap-4">
              <Field label="ชื่อ">{s.name}</Field>
              <Field label="รหัสพนักงาน">{s.code}</Field>
              <Field label="เบอร์โทร">{s.phone}</Field>
            </div>
          </Panel>
        </TabsContent>
        <TabsContent value="Bookings & Sales">
          <DataTable
            rows={bookings}
            columns={[
              {
                key: "id",
                header: "Booking",
                cell: (b) => (
                  <Link to="/bookings/$id" params={{ id: b.id }} className="text-primary">
                    {b.id}
                  </Link>
                ),
              },
              { key: "price", header: "ราคา", cell: (b) => thb(b.price) },
              {
                key: "status",
                header: "สถานะ",
                cell: (b) => (
                  <StatusBadge tone={BOOKING_STATUS[b.status][1]}>
                    {BOOKING_STATUS[b.status][0]}
                  </StatusBadge>
                ),
              },
            ]}
          />
        </TabsContent>
        <TabsContent value="Tasks">
          <DataTable
            rows={state.tasks.filter(
              (t) => t.assignee === id && inScope({ branchId: t.branchId, salesId: t.assignee }),
            )}
            columns={[
              { key: "title", header: "งาน", cell: (t) => t.title },
              {
                key: "date",
                header: "วันเวลา",
                cell: (t) => thDateTime(t.date),
                sort: (t) => t.date,
              },
              {
                key: "status",
                header: "สถานะ",
                cell: (t) => (
                  <StatusBadge tone={TASK_STATUS[t.status][1]}>
                    {TASK_STATUS[t.status][0]}
                  </StatusBadge>
                ),
              },
            ]}
          />
        </TabsContent>
        <TabsContent value="Commission">
          <Commissions salesId={id} embedded />
        </TabsContent>
        <TabsContent value="Bonus">
          <Panel title="Bonus จากรายการขาย">
            {bookings.map((b) => {
              const v = state.vehicles.find((v) => v.id === b.vehicleId);
              return (
                v?.bonus && (
                  <div key={b.id} className="border-b py-3 text-sm">
                    {b.id} · {v.model} · {thb(v.bonus.amount)}
                    <p className="text-xs text-muted-foreground">{v.bonus.condition}</p>
                  </div>
                )
              );
            })}
          </Panel>
        </TabsContent>
        <TabsContent value="Claim History">
          <Commissions salesId={id} embedded claimsOnly />
        </TabsContent>
      </Tabs>
    </>
  );
}

export function Commissions({
  salesId,
  embedded = false,
  claimsOnly = false,
}: {
  salesId?: string;
  embedded?: boolean;
  claimsOnly?: boolean;
}) {
  const { state, inScope, salesName, branchName, can, roleId, user } = useStore();
  const run = useDemoAction();
  const [sales, setSales] = useState(salesId ?? "all");
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const c = state.commissions.find((c) => c.id === selected);
  const booking = (id: string) => state.bookings.find((b) => b.id === id);
  const rows = state.commissions.filter((c) => {
    const b = booking(c.bookingId);
    return (
      b &&
      inScope(b) &&
      (sales === "all" || c.salesId === sales) &&
      (status === "all" || c.status === status) &&
      (!claimsOnly || !!c.claimNo) &&
      (!from || (b.deliveryAt ?? b.createdAt).slice(0, 10) >= from) &&
      (!to || (b.deliveryAt ?? b.createdAt).slice(0, 10) <= to)
    );
  });
  const eligible = state.bookings
    .filter(inScope)
    .filter(
      (b) =>
        commissionEligible(state, b) &&
        !state.commissions.some((c) => c.bookingId === b.id) &&
        (sales === "all" || b.salesId === sales),
    );
  const selectedBooking = c && booking(c.bookingId);
  const permission = c && ["draft", "rejected"].includes(c.status) ? "create" : "approve";
  const roleAllowed =
    c &&
    (["draft", "rejected"].includes(c.status)
      ? ["sales", "manager", "admin"].includes(roleId)
      : ["submitted", "mgr_review"].includes(c.status)
        ? ["manager", "admin"].includes(roleId)
        : ["finance", "admin"].includes(roleId));
  const print = () => {
    if (c && selectedBooking && can("sales", "export"))
      printHtml(
        `ใบเบิก ${c.claimNo ?? c.id}`,
        `<h1>ใบเบิก Commission</h1><p>${escapeHtml(c.claimNo ?? c.id)} · ${escapeHtml(salesName(c.salesId))} · ${escapeHtml(branchName(selectedBooking.branchId))}</p><table><tr><th>Booking</th><td>${escapeHtml(c.bookingId)}</td></tr><tr><th>ฐาน × อัตรา</th><td>${thb(c.base)} × ${(c.rate * 100).toFixed(2)}%</td></tr><tr><th>Bonus</th><td>${thb(c.bonus)}</td></tr><tr><th>รายการปรับ</th><td>${thb(c.adjust)}</td></tr><tr><th>ยอดสุทธิ</th><td>${thb(commissionTotal(c))}</td></tr></table>`,
      );
  };
  return (
    <>
      {!embedded && (
        <PageHeader
          title="Commission"
          subtitle="คำนวณ ส่งเบิก ผู้จัดการตรวจสอบ และฝ่ายการเงินอนุมัติ"
          demo
          actions={
            can("sales", "export") && (
              <Button
                variant="outline"
                onClick={() =>
                  downloadCsv("commission.csv", [
                    [
                      "เลขที่",
                      "Booking",
                      "Sales",
                      "ฐาน",
                      "อัตรา",
                      "Bonus",
                      "ปรับ",
                      "สุทธิ",
                      "สถานะ",
                    ],
                    ...rows.map((c) => [
                      c.id,
                      c.bookingId,
                      salesName(c.salesId),
                      c.base,
                      c.rate,
                      c.bonus,
                      c.adjust,
                      commissionTotal(c),
                      COMM_STATUS[c.status][0],
                    ]),
                  ])
                }
              >
                <Download className="size-4" /> Export CSV
              </Button>
            )
          }
        />
      )}
      {eligible.length > 0 && can("sales", "create") && (
        <Panel className="mb-5" title="รายการขายพร้อมคำนวณ">
          {eligible.map((b) => (
            <div key={b.id} className="flex items-center justify-between border-b py-2 text-sm">
              <span>
                {b.id} · {salesName(b.salesId)} · {thb(b.price)}
              </span>
              <Button
                size="sm"
                onClick={() =>
                  run("sales", "create", "Commission", b, "คำนวณ Commission แล้ว", (d) =>
                    calculateCommission(d, b.id),
                  )
                }
              >
                <Calculator className="size-4" /> คำนวณ
              </Button>
            </div>
          ))}
        </Panel>
      )}
      <DataTable
        rows={rows}
        searchText={(c) => `${c.id} ${c.bookingId} ${c.claimNo} ${salesName(c.salesId)}`}
        onRowClick={(c) => {
          setSelected(c.id);
          setReason("");
        }}
        toolbar={
          <>
            <FilterSelect
              value={sales}
              onChange={setSales}
              placeholder="Sales"
              options={state.sales
                .filter((s) => inScope({ branchId: s.branchId, salesId: s.id }))
                .map((s) => ({ value: s.id, label: s.name }))}
            />
            <FilterSelect
              value={status}
              onChange={setStatus}
              placeholder="สถานะ"
              options={Object.entries(COMM_STATUS).map(([value, [label]]) => ({ value, label }))}
            />
            <Input
              type="date"
              aria-label="Commission จากวันที่"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-36"
            />
            <Input
              type="date"
              aria-label="Commission ถึงวันที่"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-36"
            />
          </>
        }
        columns={[
          {
            key: "id",
            header: "เลขที่ / ใบเบิก",
            cell: (c) => (
              <div className="text-primary">
                {c.id}
                <div className="text-xs text-muted-foreground">{c.claimNo ?? "ยังไม่ส่งเบิก"}</div>
              </div>
            ),
          },
          {
            key: "booking",
            header: "Booking / Sales",
            cell: (c) => (
              <div>
                {c.bookingId}
                <div className="text-xs text-muted-foreground">{salesName(c.salesId)}</div>
              </div>
            ),
          },
          {
            key: "base",
            header: "ฐาน / อัตรา",
            cell: (c) => `${thb(c.base)} × ${(c.rate * 100).toFixed(2)}%`,
          },
          {
            key: "bonus",
            header: "Bonus / ปรับ",
            cell: (c) => `${thb(c.bonus)} / ${thb(c.adjust)}`,
          },
          {
            key: "total",
            header: "ยอดสุทธิ",
            cell: (c) => thb(commissionTotal(c)),
            sort: commissionTotal,
          },
          {
            key: "status",
            header: "สถานะ",
            cell: (c) => (
              <StatusBadge tone={COMM_STATUS[c.status][1]}>{COMM_STATUS[c.status][0]}</StatusBadge>
            ),
          },
        ]}
      />
      <DetailDrawer
        open={!!c}
        onOpenChange={(o) => !o && setSelected(null)}
        title={c?.claimNo ?? c?.id ?? "Commission"}
        description="Calculation Breakdown และประวัติการส่งเบิก"
      >
        {c && selectedBooking && (
          <>
            <Link to="/bookings/$id" params={{ id: c.bookingId }} className="text-primary">
              เปิด {c.bookingId}
            </Link>
            <Panel title="Calculation Breakdown">
              <div className="space-y-3">
                <Field label="ฐานคำนวณ">
                  ราคาขาย {thb(c.base)} × {(c.rate * 100).toFixed(2)}% = {thb(c.base * c.rate)}
                </Field>
                <Field label="Bonus / เงื่อนไขที่ใช้">
                  {thb(c.bonus)} · {c.bonusCondition ?? "ไม่มี Bonus ในรายการเดิม"}
                </Field>
                <Field label="รายการปรับ">{thb(c.adjust)}</Field>
                <Field label="ยอดสุทธิ">{thb(commissionTotal(c))}</Field>
                <Field label="สิทธิ์รับ Commission">
                  <StatusBadge
                    tone={commissionEligible(state, selectedBooking) ? "success" : "warning"}
                  >
                    {commissionEligible(state, selectedBooking)
                      ? "ส่งมอบและชำระครบแล้ว"
                      : "รอส่งมอบ ปิดการขาย และชำระครบ"}
                  </StatusBadge>
                </Field>
                <Field label="หมายเหตุ / เหตุผลตีกลับ">{c.note ?? "—"}</Field>
                <Field label="วันที่จ่าย">{thDateTime(c.paidAt)}</Field>
              </div>
            </Panel>
            {c.status !== "paid" && (
              <ConfirmAction
                disabled={
                  !can("sales", permission) ||
                  !roleAllowed ||
                  !commissionEligible(state, selectedBooking)
                }
                description="ดำเนินการ Commission ตามขั้นตอนและสิทธิ์ของบทบาทปัจจุบัน"
                onConfirm={() =>
                  run(
                    "sales",
                    permission,
                    "Commission",
                    selectedBooking,
                    "อัปเดตสถานะ Commission แล้ว",
                    (d) => advanceCommission(d, c.id, roleId, user.name, undefined, c.status),
                  )
                }
              >
                {["draft", "rejected"].includes(c.status)
                  ? "ส่งเบิก"
                  : ["submitted", "mgr_review"].includes(c.status)
                    ? "ผู้จัดการตรวจสอบผ่าน"
                    : c.status === "fin_review"
                      ? "ฝ่ายการเงินอนุมัติ"
                      : "บันทึกจ่ายแล้ว"}
              </ConfirmAction>
            )}
            {["submitted", "mgr_review", "fin_review"].includes(c.status) &&
              can("sales", "approve") &&
              roleAllowed && (
                <>
                  <Input
                    aria-label="เหตุผลตีกลับ Commission"
                    placeholder="เหตุผลตีกลับ"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <ConfirmAction
                    description="ตีกลับ Commission พร้อมเหตุผล"
                    onConfirm={() =>
                      run(
                        "sales",
                        "approve",
                        "Commission",
                        selectedBooking,
                        "ตีกลับ Commission แล้ว",
                        (d) => advanceCommission(d, c.id, roleId, user.name, reason, c.status),
                      )
                    }
                  >
                    ตีกลับ
                  </ConfirmAction>
                </>
              )}
            {can("sales", "export") && (
              <Button variant="outline" onClick={print}>
                Preview / Print / Save as PDF ใบเบิก
              </Button>
            )}
            <Panel title="ประวัติผู้ตรวจ / ผู้อนุมัติ">
              <Timeline
                items={(c.history ?? []).map((h) => ({
                  at: h.at,
                  title: h.text,
                  sub: `${h.by} · ${thDateTime(h.at)}`,
                }))}
              />
            </Panel>
          </>
        )}
      </DetailDrawer>
    </>
  );
}
