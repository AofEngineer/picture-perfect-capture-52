import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { useStore } from "@/lib/store";
import { downloadCsv, num, thb, thDateTime } from "@/lib/format";
import { notify, settleBurn, importStockDemo, syncCustomer } from "@/lib/mock/service";
import { INTEG_STATUS, LTX_STATUS, MATCH_STATUS } from "@/lib/labels";
import {
  DataTable,
  DetailDrawer,
  DemoTag,
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
import { printHtml } from "@/lib/print";

export function Integrations() {
  const { state, allowedBranches, can } = useStore();
  const run = useDemoAction();
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const integration = state.integrations.find((i) => i.id === selected);
  const record = (id: string) => ({ id, branchId: allowedBranches[0] ?? "B1" });
  const test = (id: string, fail = false) => {
    setBusy(id);
    setTimeout(() => {
      run(
        "integrations",
        "edit",
        "Integration",
        record(id),
        fail ? "จำลองการเชื่อมต่อขัดข้องแล้ว" : "ทดสอบการเชื่อมต่อจำลองสำเร็จ",
        (d) => {
          const i = d.integrations.find((i) => i.id === id)!;
          i.status = fail ? "error" : "connected";
          i.lastSync = new Date().toISOString();
          if (fail) i.fail += 1;
          else i.ok += 1;
          i.log.unshift({
            at: i.lastSync,
            level: fail ? "error" : "info",
            text: fail ? "HTTP 503" : "Test Connection สำเร็จ",
          });
        },
      );
      setBusy(null);
    }, 700);
  };
  return (
    <>
      <PageHeader
        title="Integrations"
        subtitle="การเชื่อมต่อทั้งหมดเป็นข้อมูลจำลอง ไม่มีการเรียกบริการภายนอกจริง"
        demo
      />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {state.integrations.map((i) => (
          <Panel key={i.id} title={i.name} actions={<DemoTag />}>
            <div className="space-y-3">
              <StatusBadge tone={INTEG_STATUS[i.status][1]}>
                {INTEG_STATUS[i.status][0]}
              </StatusBadge>
              <div className="grid grid-cols-2 gap-3">
                <Field label="สำเร็จ">{num(i.ok)}</Field>
                <Field label="ผิดพลาด">{num(i.fail)}</Field>
              </div>
              <div className="text-xs text-muted-foreground">
                Sync ล่าสุด {thDateTime(i.lastSync)}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setSelected(i.id)}>
                  Log / Mapping
                </Button>
                <Button
                  size="sm"
                  disabled={!can("integrations", "edit") || busy === i.id}
                  onClick={() => test(i.id)}
                >
                  <RefreshCw className={`size-3 ${busy === i.id ? "animate-spin" : ""}`} />
                  {i.status === "error" ? "Retry" : "Test Connection"}
                </Button>
              </div>
            </div>
          </Panel>
        ))}
      </div>
      <DetailDrawer
        open={!!integration}
        onOpenChange={(o) => !o && setSelected(null)}
        title={integration?.name ?? "Integration"}
        description="Mapping และ Log จำลอง"
      >
        {integration && (
          <>
            <DemoTag />
            <Panel title="Mapping Field">
              <div className="space-y-2">
                {integration.mapping.map(([source, target], index) => (
                  <div key={source} className="grid grid-cols-2 gap-2">
                    <Input aria-label={`Source ${source}`} value={source} readOnly />
                    <Input
                      aria-label={`Mapping ${source}`}
                      defaultValue={target}
                      disabled={!can("integrations", "edit")}
                      onBlur={(e) => {
                        if (e.target.value.trim() && e.target.value !== target)
                          run(
                            "integrations",
                            "edit",
                            "Integration",
                            record(integration.id),
                            "แก้ไข Mapping แล้ว",
                            (d) => {
                              d.integrations.find((x) => x.id === integration.id)!.mapping[
                                index
                              ]![1] = e.target.value.trim();
                            },
                          );
                      }}
                    />
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="Auto Import / Sync ตัวอย่าง">
              <p className="mb-3 text-sm text-muted-foreground">
                ระบบตัวอย่างตรวจข้อมูลซ้ำและข้อมูลขัดแย้งก่อนนำเข้า
                โดยไม่เขียนทับข้อมูลที่ผู้ใช้แก้ไข
              </p>
              <Button
                variant="outline"
                disabled={!can("integrations", "edit") || integration.status !== "connected"}
                onClick={() =>
                  run(
                    "integrations",
                    "edit",
                    "Integration",
                    record(integration.id),
                    "ตรวจสอบ Sync / Import จำลองแล้ว",
                    (d) => {
                      if (integration.id === "stocksrc") {
                        importStockDemo(d, record(integration.id).branchId);
                        return;
                      }
                      if (integration.id === "loyalty")
                        d.customers
                          .filter((c) => allowedBranches.includes(c.branchId))
                          .forEach((c) => syncCustomer(d, c.id));
                      const i = d.integrations.find((x) => x.id === integration.id)!;
                      i.lastSync = new Date().toISOString();
                      i.log.unshift({
                        at: i.lastSync,
                        level: "info",
                        text:
                          i.id === "stocksrc"
                            ? `ตรวจพบ VIN ซ้ำ ${d.vehicles[0]?.vin} — ข้ามข้อมูลซ้ำ ไม่เพิ่มรถซ้ำ`
                            : i.id === "loyalty"
                              ? "ตรวจสอบยอดสมาชิก — รายการยอดคลาดเคลื่อนต้องตรวจสอบก่อนปรับ"
                              : "ตรวจสอบข้อมูลตัวอย่างแล้ว ไม่พบรายการใหม่ที่ต้องนำเข้า",
                      });
                    },
                  )
                }
              >
                ตรวจสอบ Import / Sync
              </Button>
              <Button
                className="ml-2"
                variant="outline"
                disabled={!can("integrations", "edit")}
                onClick={() => test(integration.id, true)}
              >
                จำลอง Error
              </Button>
            </Panel>
            {integration.id === "loyalty" && (
              <Panel title="ธุรกรรม Pending / Failed">
                {state.loyaltyTx
                  .filter((t) => ["Pending", "Failed"].includes(t.status))
                  .map((t) => (
                    <div key={t.id} className="mb-3 text-sm">
                      <div>
                        {t.ref} · {num(t.points)} Point
                      </div>
                      <ConfirmAction
                        disabled={
                          !can("integrations", "edit") || integration.status !== "connected"
                        }
                        description={`Retry ธุรกรรม ${t.ref} ด้วย Reference เดิม ป้องกัน Burn ซ้ำ`}
                        onConfirm={() =>
                          run(
                            "integrations",
                            "edit",
                            "Loyalty",
                            record(t.id),
                            "Retry ธุรกรรม Loyalty แล้ว",
                            (d) => {
                              const success = settleBurn(d, t.id);
                              if (!success) throw new Error("Loyalty ขัดข้อง");
                            },
                          )
                        }
                      >
                        Retry ธุรกรรม
                      </ConfirmAction>
                    </div>
                  ))}
              </Panel>
            )}
            <Panel title="Integration Log">
              <Timeline
                items={integration.log.map((l) => ({
                  at: l.at,
                  title: l.text,
                  sub: `${l.level} · ${thDateTime(l.at)}`,
                }))}
              />
            </Panel>
          </>
        )}
      </DetailDrawer>
    </>
  );
}

export function AuditLog() {
  const { state, inScope, can, branchName } = useStore();
  const [actor, setActor] = useState("all");
  const [branch, setBranch] = useState("all");
  const [activity, setActivity] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const scoped = state.audit.filter((a) => {
    const b = a.entity === "Booking" ? state.bookings.find((b) => b.id === a.entityId) : undefined;
    return inScope({ branchId: a.branchId, ...(b ? { salesId: b.salesId } : {}) });
  });
  const rows = scoped.filter(
    (a) =>
      (actor === "all" || a.actor === actor) &&
      (branch === "all" || a.branchId === branch) &&
      (activity === "all" || a.action === activity) &&
      (!from || a.at.slice(0, 10) >= from) &&
      (!to || a.at.slice(0, 10) <= to),
  );
  const a = rows.find((a) => a.id === selected);
  const csv = [
    ["เวลา", "ผู้ดำเนินการ", "บทบาท", "สาขา", "กิจกรรม", "ประเภท", "รหัส", "Reference"],
    ...rows.map((a) => [
      a.at,
      a.actor,
      a.role,
      branchName(a.branchId),
      a.action,
      a.entity,
      a.entityId,
      a.ref,
    ]),
  ];
  return (
    <>
      <PageHeader
        title="Audit Log"
        subtitle="ประวัติกิจกรรมแบบอ่านอย่างเดียว ใช้ข้อมูลสมมติและหลีกเลี่ยงข้อมูลส่วนบุคคลเต็ม"
        demo
        actions={
          can("audit", "export") && (
            <Button variant="outline" onClick={() => downloadCsv("audit.csv", csv)}>
              <Download className="size-4" /> Export CSV
            </Button>
          )
        }
      />
      <DataTable
        rows={rows}
        searchText={(a) => `${a.actor} ${a.role} ${a.action} ${a.entityId} ${a.ref}`}
        onRowClick={(a) => setSelected(a.id)}
        toolbar={
          <>
            <FilterSelect
              value={actor}
              onChange={setActor}
              placeholder="ผู้ใช้"
              options={[...new Set(scoped.map((a) => a.actor))].map((value) => ({
                value,
                label: value,
              }))}
            />
            <FilterSelect
              value={branch}
              onChange={setBranch}
              placeholder="สาขา"
              options={state.branches.map((b) => ({ value: b.id, label: b.short }))}
            />
            <FilterSelect
              value={activity}
              onChange={setActivity}
              placeholder="กิจกรรม"
              options={[...new Set(scoped.map((a) => a.action))].map((value) => ({
                value,
                label: value,
              }))}
            />
            <Input
              type="date"
              aria-label="Audit จากวันที่"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-36"
            />
            <Input
              type="date"
              aria-label="Audit ถึงวันที่"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-36"
            />
          </>
        }
        columns={[
          { key: "at", header: "วันเวลา", cell: (a) => thDateTime(a.at), sort: (a) => a.at },
          {
            key: "actor",
            header: "ผู้ดำเนินการ / บทบาท",
            cell: (a) => (
              <div>
                {a.actor}
                <div className="text-xs text-muted-foreground">{a.role}</div>
              </div>
            ),
          },
          { key: "branch", header: "สาขา", cell: (a) => branchName(a.branchId) },
          { key: "action", header: "กิจกรรม", cell: (a) => a.action },
          { key: "entity", header: "รายการ", cell: (a) => `${a.entity}: ${a.entityId}` },
          { key: "ref", header: "Reference ID", cell: (a) => a.ref },
        ]}
      />
      <DetailDrawer
        open={!!a}
        onOpenChange={(o) => !o && setSelected(null)}
        title={a?.action ?? "Audit"}
        description="รายละเอียดการเปลี่ยนแปลง"
      >
        {a && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="ผู้ดำเนินการ">
              {a.actor} · {a.role}
            </Field>
            <Field label="วันเวลา">{thDateTime(a.at)}</Field>
            <Field label="ก่อน">{a.before ?? "—"}</Field>
            <Field label="หลัง">{a.after ?? "—"}</Field>
            <Field label="เหตุผล">{a.reason ?? "—"}</Field>
            <Field label="Reference">{a.ref}</Field>
          </div>
        )}
      </DetailDrawer>
    </>
  );
}

export function Reports() {
  const { state, inScope, branchName, can } = useStore();
  const [branch, setBranch] = useState("all");
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const txs = state.loyaltyTx.filter((t) => {
    const c = state.customers.find((c) => c.id === t.customerId);
    const b = state.bookings.find((b) => b.id === t.bookingId);
    return (
      c &&
      inScope(b ?? c) &&
      (branch === "all" || (b?.branchId ?? c.branchId) === branch) &&
      (status === "all" || t.status === status) &&
      (!from || t.at.slice(0, 10) >= from) &&
      (!to || t.at.slice(0, 10) <= to)
    );
  });
  const bookings = state.bookings
    .filter(inScope)
    .filter(
      (b) =>
        (branch === "all" || b.branchId === branch) &&
        (!from || (b.deliveryAt ?? b.createdAt).slice(0, 10) >= from) &&
        (!to || (b.deliveryAt ?? b.createdAt).slice(0, 10) <= to),
    );
  const csv = [
    ["Booking", "ลูกค้า", "ประเภท", "Point", "มูลค่า", "Reference", "สถานะ", "เทียบยอด"],
    ...txs.map((t) => [
      t.bookingId ?? "",
      state.customers.find((c) => c.id === t.customerId)?.name ?? "",
      t.type,
      t.points,
      t.value,
      t.ref,
      t.status,
      t.match,
    ]),
  ];
  const billable = txs.filter(
    (t) => t.type === "Burn" && t.status === "Success" && t.match === "matched",
  );
  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="ภาพรวมยอดขาย รายงาน Loyalty และ Billing Summary ตามช่วงเวลา"
        demo
        actions={
          can("reports", "export") && (
            <>
              <Button variant="outline" onClick={() => downloadCsv("loyalty-report.csv", csv)}>
                <Download className="size-4" /> Export CSV
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  printHtml(
                    "รายงาน Loyalty",
                    `<h1>รายงาน Loyalty / Billing Summary</h1><p>รายการ Burn สำเร็จที่ตรงกัน ${billable.length} รายการ รวม ${thb(billable.reduce((s, t) => s + t.value, 0))}</p><table><tr><th>Reference</th><th>Point</th><th>มูลค่า</th></tr>${billable.map((t) => `<tr><td>${t.ref}</td><td>${t.points}</td><td>${thb(t.value)}</td></tr>`).join("")}</table>`,
                  )
                }
              >
                Print / Save as PDF
              </Button>
            </>
          )
        }
      />
      <div className="mb-5 grid gap-5 lg:grid-cols-3">
        <Panel title="ยอดขายปิดการขาย">
          <div className="text-2xl font-semibold">
            {thb(bookings.filter((b) => b.status === "closed").reduce((s, b) => s + b.price, 0))}
          </div>
          <p className="text-xs text-muted-foreground">
            {bookings.filter((b) => b.status === "closed").length} คัน
          </p>
        </Panel>
        <Panel title="การเทียบยอด Loyalty">
          <div className="text-sm">
            ตรงกัน {txs.filter((t) => t.match === "matched").length} · คลาดเคลื่อน{" "}
            {txs.filter((t) => t.match === "mismatch").length} · รอตรวจ{" "}
            {txs.filter((t) => t.match === "pending").length}
          </div>
        </Panel>
        <Panel title="Billing Summary">
          <div className="text-2xl font-semibold">
            {thb(billable.reduce((s, t) => s + t.value, 0))}
          </div>
          <p className="text-xs text-muted-foreground">
            เฉพาะ Burn สำเร็จและยอดตรงกัน {billable.length} รายการ
          </p>
        </Panel>
      </div>
      <DataTable
        rows={txs}
        searchText={(t) => `${t.ref} ${t.bookingId ?? ""}`}
        toolbar={
          <>
            <FilterSelect
              value={branch}
              onChange={setBranch}
              placeholder="สาขา"
              options={state.branches.map((b) => ({ value: b.id, label: b.short }))}
            />
            <FilterSelect
              value={status}
              onChange={setStatus}
              placeholder="สถานะ"
              options={Object.keys(LTX_STATUS).map((value) => ({ value, label: value }))}
            />
            <Input
              type="date"
              aria-label="Reports จากวันที่"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-36"
            />
            <Input
              type="date"
              aria-label="Reports ถึงวันที่"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-36"
            />
          </>
        }
        columns={[
          {
            key: "booking",
            header: "Booking / ลูกค้า",
            cell: (t) => (
              <div>
                {t.bookingId ? (
                  <Link to="/bookings/$id" params={{ id: t.bookingId }} className="text-primary">
                    {t.bookingId}
                  </Link>
                ) : (
                  "—"
                )}
                <div className="text-xs text-muted-foreground">
                  {state.customers.find((c) => c.id === t.customerId)?.name}
                </div>
              </div>
            ),
          },
          { key: "type", header: "ประเภท", cell: (t) => t.type },
          {
            key: "points",
            header: "Point / มูลค่า",
            cell: (t) => `${num(t.points)} / ${thb(t.value)}`,
            sort: (t) => t.value,
          },
          { key: "ref", header: "Reference / สูตร", cell: (t) => `${t.ref} · ${t.formulaVersion}` },
          {
            key: "status",
            header: "สถานะ",
            cell: (t) => <StatusBadge tone={LTX_STATUS[t.status][1]}>{t.status}</StatusBadge>,
          },
          {
            key: "match",
            header: "เทียบยอด",
            cell: (t) => (
              <StatusBadge tone={MATCH_STATUS[t.match][1]}>{MATCH_STATUS[t.match][0]}</StatusBadge>
            ),
          },
        ]}
      />
      <Panel className="mt-5" title="ยอดขายตามสาขา">
        {state.branches
          .filter((b) => inScope({ branchId: b.id }))
          .map((b) => (
            <div key={b.id} className="flex justify-between border-b py-2 text-sm">
              <span>{branchName(b.id)}</span>
              <span>
                {thb(
                  bookings
                    .filter((x) => x.branchId === b.id && x.status === "closed")
                    .reduce((s, x) => s + x.price, 0),
                )}
              </span>
            </div>
          ))}
      </Panel>
    </>
  );
}
