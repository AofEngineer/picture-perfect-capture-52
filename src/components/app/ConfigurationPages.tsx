import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { visibleNotice } from "@/lib/access";
import type { Action, LoyaltyConfig, MenuKey, RoleId, RolePerm, Tier } from "@/lib/mock/types";
import { num, thDateTime, refId } from "@/lib/format";
import { evaluateNotificationRules, simulateLoyalty } from "@/lib/mock/service";
import {
  DataTable,
  DemoTag,
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function LoyaltyConfiguration() {
  const { state, can, user, allowedBranches } = useStore();
  const run = useDemoAction();
  const [draft, setDraft] = useState<LoyaltyConfig>(() =>
    structuredClone(state.loyaltyDraft ?? state.loyaltyConfig),
  );
  const [amount, setAmount] = useState("3000000");
  const [excluded, setExcluded] = useState("0");
  const [tier, setTier] = useState<Tier>("Platinum");
  const record = { id: state.loyaltyConfig.version, branchId: allowedBranches[0] ?? "B1" };
  const compute = (cfg: LoyaltyConfig) => {
    try {
      const eligible = Number(amount) - Number(excluded);
      const result = simulateLoyalty(cfg, eligible, tier, cfg.campaignMult);
      return `${num(eligible)} ÷ ${cfg.bahtPerPoint} × ${cfg.tierMult[tier]} × ${cfg.campaignMult} = ${num(result.raw)} → ปัดเศษ ${cfg.rounding} → จำกัด ${num(cfg.cap)} = ${num(result.result)} Point`;
    } catch (e) {
      return e instanceof Error ? e.message : "สูตรไม่ถูกต้อง";
    }
  };
  const validate = (cfg: LoyaltyConfig) => {
    simulateLoyalty(cfg, 100, "Silver", cfg.campaignMult);
    if (
      !Number.isFinite(cfg.pointValue) ||
      cfg.pointValue <= 0 ||
      !Number.isFinite(cfg.maxBurnPct) ||
      cfg.maxBurnPct <= 0 ||
      cfg.maxBurnPct > 100 ||
      Object.values(cfg.tierMult).some((v) => !Number.isFinite(v) || v <= 0)
    )
      throw new Error("อัตรา Point ตัวคูณ และเพดานใช้ Point ต้องถูกต้อง");
    if (!cfg.start || !cfg.end || cfg.start > cfg.end)
      throw new Error("วันเริ่มใช้ต้องไม่เกินวันสิ้นสุด");
  };
  return (
    <>
      <PageHeader
        title="Loyalty Configuration"
        subtitle="เปรียบเทียบสูตรเดิมกับสูตรใหม่ก่อนบันทึกและอนุมัติ"
        demo
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel
          title={`สูตรใช้งาน ${state.loyaltyConfig.version}`}
          actions={<StatusBadge tone="success">อนุมัติแล้ว</StatusBadge>}
        >
          <p className="text-sm">{compute(state.loyaltyConfig)}</p>
          <p className="mt-3 text-xs text-muted-foreground">
            แก้ไขโดย {state.loyaltyConfig.editor} · {thDateTime(state.loyaltyConfig.at)}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            รายการเดิมใช้เวอร์ชันและอัตรา Point ของวันทำรายการ ไม่คำนวณย้อนหลังด้วยสูตรใหม่
          </p>
        </Panel>
        <Panel title="Formula Simulator">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="sim-amount">ยอดซื้อ</Label>
              <Input
                id="sim-amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="sim-excluded">ยอดที่ไม่รวมคำนวณ</Label>
              <Input
                id="sim-excluded"
                type="number"
                value={excluded}
                onChange={(e) => setExcluded(e.target.value)}
              />
            </div>
            <Select value={tier} onValueChange={(v) => setTier(v as Tier)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["Silver", "Gold", "Platinum"].map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="mt-4 rounded-sm bg-accent p-3 text-sm">สูตรใหม่: {compute(draft)}</div>
        </Panel>
        <Panel title="ปรับสูตรใหม่" className="lg:col-span-2">
          <div className="grid gap-4 md:grid-cols-3">
            {(
              [
                { key: "bahtPerPoint", label: "ยอดบาทต่อ 1 Point" },
                { key: "campaignMult", label: "ตัวคูณแคมเปญ" },
                { key: "cap", label: "เพดาน Point" },
                { key: "pointValue", label: "มูลค่าต่อ Point (บาท)" },
                { key: "maxBurnPct", label: "เพดานใช้ Point (% ราคาขาย)" },
              ] as const
            ).map(({ key, label }) => (
              <div key={key}>
                <Label htmlFor={`cfg-${key}`}>{label}</Label>
                <Input
                  id={`cfg-${key}`}
                  type="number"
                  disabled={!can("loyalty", "edit")}
                  value={draft[key]}
                  onChange={(e) => setDraft({ ...draft, [key]: Number(e.target.value) })}
                />
              </div>
            ))}
            {(["Silver", "Gold", "Platinum"] as Tier[]).map((t) => (
              <div key={t}>
                <Label htmlFor={`tier-${t}`}>ตัวคูณ {t}</Label>
                <Input
                  id={`tier-${t}`}
                  type="number"
                  disabled={!can("loyalty", "edit")}
                  value={draft.tierMult[t]}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      tierMult: { ...draft.tierMult, [t]: Number(e.target.value) },
                    })
                  }
                />
              </div>
            ))}
            <div>
              <Label>วิธีปัดเศษ</Label>
              <Select
                value={draft.rounding}
                disabled={!can("loyalty", "edit")}
                onValueChange={(v) =>
                  setDraft({ ...draft, rounding: v as LoyaltyConfig["rounding"] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["floor", "round", "ceil"].map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="formula-start">วันเริ่มใช้</Label>
              <Input
                id="formula-start"
                type="date"
                disabled={!can("loyalty", "edit")}
                value={draft.start.slice(0, 10)}
                onChange={(e) => setDraft({ ...draft, start: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="formula-end">วันสิ้นสุด</Label>
              <Input
                id="formula-end"
                type="date"
                disabled={!can("loyalty", "edit")}
                value={draft.end.slice(0, 10)}
                onChange={(e) => setDraft({ ...draft, end: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="formula-exclusions">รายการไม่รวม</Label>
              <Input
                id="formula-exclusions"
                value={draft.excludeItems}
                disabled={!can("loyalty", "edit")}
                onChange={(e) => setDraft({ ...draft, excludeItems: e.target.value })}
              />
            </div>
          </div>
          <div className="mt-5 flex gap-3">
            <ConfirmAction
              disabled={!can("loyalty", "edit")}
              description="บันทึกสูตรใหม่เป็นรออนุมัติ สูตรเดิมยังคงใช้งานจนอนุมัติ"
              onConfirm={() =>
                run(
                  "loyalty",
                  "edit",
                  "LoyaltyConfig",
                  record,
                  "บันทึกสูตร Loyalty รออนุมัติแล้ว",
                  (d) => {
                    validate(draft);
                    d.loyaltyDraft = {
                      ...structuredClone(draft),
                      version: `v1.${d.loyaltyConfig.history.length}`,
                      status: "pending",
                      editor: user.name,
                      at: new Date().toISOString(),
                    };
                  },
                )
              }
            >
              บันทึกสูตรใหม่
            </ConfirmAction>
            {state.loyaltyDraft && (
              <ConfirmAction
                disabled={!can("loyalty", "approve")}
                description={`อนุมัติสูตร ${state.loyaltyDraft.version} ตามผลเปรียบเทียบที่บันทึกไว้`}
                onConfirm={() =>
                  run(
                    "loyalty",
                    "approve",
                    "LoyaltyConfig",
                    record,
                    "อนุมัติสูตร Loyalty แล้ว",
                    (d) => {
                      const cfg = d.loyaltyDraft!;
                      validate(cfg);
                      d.loyaltyConfig = {
                        ...cfg,
                        status: "approved",
                        at: new Date().toISOString(),
                        history: [
                          ...d.loyaltyConfig.history,
                          {
                            version: cfg.version,
                            editor: user.name,
                            at: new Date().toISOString(),
                            note: "อนุมัติสูตรหลังเปรียบเทียบ Simulator",
                          },
                        ],
                      };
                      delete d.loyaltyDraft;
                    },
                  )
                }
              >
                อนุมัติ {state.loyaltyDraft.version}
              </ConfirmAction>
            )}
          </div>
          {state.loyaltyDraft && (
            <p className="mt-3 text-sm text-warning-foreground">
              สูตรรออนุมัติ {state.loyaltyDraft.version}: {compute(state.loyaltyDraft)}
            </p>
          )}
        </Panel>
        <Panel title="ประวัติเวอร์ชัน" className="lg:col-span-2">
          <Timeline
            items={state.loyaltyConfig.history.map((h) => ({
              at: h.at,
              title: `${h.version} · ${h.note}`,
              sub: `${h.editor} · ${thDateTime(h.at)}`,
            }))}
          />
        </Panel>
      </div>
    </>
  );
}

const MENU_LABELS: Record<MenuKey, string> = {
  dashboard: "Dashboard",
  booking: "Booking",
  customer: "Customer",
  stock: "Stock",
  sales: "Sales",
  reports: "Reports",
  integrations: "Integrations",
  loyalty: "Loyalty Configuration",
  access: "Access Control",
  audit: "Audit Log",
  notifications: "Notification Settings",
};
const ACTIONS: Action[] = ["view", "create", "edit", "approve", "export"];
export function AccessControl() {
  const { state, can, allowedBranches } = useStore();
  const run = useDemoAction();
  const [roleId, setRole] = useState<RoleId>("sales");
  const [draft, setDraft] = useState<RolePerm>(() =>
    structuredClone(state.roles.find((r) => r.id === "sales")!),
  );
  const record = { id: roleId, branchId: allowedBranches[0] ?? "B1" };
  return (
    <>
      <PageHeader
        title="Access Control"
        subtitle="กำหนดเมนู การกระทำ ขอบเขตสาขา และข้อมูลสำคัญของแต่ละบทบาท"
        demo
      />
      <Panel className="mb-5" title="บทบาทและ Branch Scope">
        <div className="grid gap-4 md:grid-cols-3">
          <Select
            value={roleId}
            onValueChange={(v) => {
              setRole(v as RoleId);
              setDraft(structuredClone(state.roles.find((r) => r.id === v)!));
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {state.roles.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={draft.scope}
            disabled={!can("access", "edit")}
            onValueChange={(v) => setDraft({ ...draft, scope: v as RolePerm["scope"] })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="own">ข้อมูลของตนเอง</SelectItem>
              <SelectItem value="branch">สาขาที่กำหนด</SelectItem>
              <SelectItem value="all">ทุกสาขา</SelectItem>
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={!can("access", "edit")}
              checked={draft.sensitive}
              onChange={(e) => setDraft({ ...draft, sensitive: e.target.checked })}
            />{" "}
            ต้นทุน Margin และข้อมูลส่วนบุคคล
          </label>
        </div>
        <div className="mt-4 flex gap-5">
          {state.branches.map((b) => (
            <label key={b.id} className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.branches.includes(b.id)}
                disabled={!can("access", "edit") || draft.scope === "all"}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    branches: e.target.checked
                      ? [...draft.branches, b.id]
                      : draft.branches.filter((id) => id !== b.id),
                  })
                }
              />
              {b.name}
            </label>
          ))}
        </div>
      </Panel>
      <Panel title="Permission Matrix" bodyClass="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/60">
                <th className="p-3 text-left">เมนู</th>
                {ACTIONS.map((a) => (
                  <th key={a} className="p-3 capitalize">
                    {a}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(Object.entries(MENU_LABELS) as [MenuKey, string][]).map(([key, label]) => (
                <tr key={key} className="border-b">
                  <td className="p-3">{label}</td>
                  {ACTIONS.map((a) => (
                    <td key={a} className="p-3 text-center">
                      <input
                        type="checkbox"
                        aria-label={`${label} ${a}`}
                        disabled={!can("access", "edit")}
                        checked={draft.menus[key]?.includes(a) ?? false}
                        onChange={(e) => {
                          const current = draft.menus[key] ?? [];
                          const next = e.target.checked
                            ? [...new Set([...current, a, "view" as Action])]
                            : a === "view"
                              ? []
                              : current.filter((x) => x !== a);
                          setDraft({ ...draft, menus: { ...draft.menus, [key]: next } });
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel className="mt-5" title="รายละเอียดก่อนบันทึก">
        <p className="mb-4 text-sm">
          {draft.name} · ขอบเขต {draft.scope} · สาขา{" "}
          {draft.scope === "all" ? "ทุกสาขา" : draft.branches.join(", ")} · มองเห็น{" "}
          {Object.values(draft.menus).filter((v) => v?.includes("view")).length} เมนู · ข้อมูลสำคัญ{" "}
          {draft.sensitive ? "แสดง" : "ซ่อน"}
        </p>
        <ConfirmAction
          disabled={!can("access", "edit")}
          description="บันทึกสิทธิ์ที่แสดงใน Matrix และใช้กับเมนู ตาราง ปุ่ม และลิงก์"
          onConfirm={() =>
            run(
              "access",
              "edit",
              "Role",
              record,
              "บันทึก Permission และ Branch Scope แล้ว",
              (d) => {
                if (draft.scope !== "all" && draft.branches.length === 0)
                  throw new Error("เลือกอย่างน้อย 1 สาขา");
                if (
                  draft.id === "admin" &&
                  (!draft.menus.access?.includes("edit") || draft.scope !== "all")
                )
                  throw new Error(
                    "System Administrator ต้องคงสิทธิ์บริหาร Access Control และทุกสาขาเพื่อจัดการระบบ",
                  );
                const index = d.roles.findIndex((r) => r.id === roleId);
                d.roles[index] = structuredClone(draft);
              },
            )
          }
        >
          บันทึกสิทธิ์
        </ConfirmAction>
        <p className="mt-4 text-xs text-muted-foreground">
          จำลองสิทธิ์ใน UI เท่านั้น ระบบจริงต้องบังคับสิทธิ์ที่ backend ด้วย
        </p>
      </Panel>
    </>
  );
}

export function NotificationCenter() {
  const { state, inScope, roleId, user, mutate, branchName } = useStore();
  const [type, setType] = useState("all");
  const [read, setRead] = useState("all");
  const scoped = state.notices.filter(
    (n) => inScope({ branchId: n.branchId }) && visibleNotice(n, roleId, user.salesId),
  );
  const rows = scoped.filter(
    (n) => (type === "all" || n.type === type) && (read === "all" || n.read === (read === "read")),
  );
  return (
    <>
      <PageHeader
        title="Notification Center"
        subtitle="แจ้งเตือนตามสาขาและบทบาท พร้อมลิงก์ไปยังรายการที่เกี่ยวข้อง"
        demo
        actions={
          <Button
            variant="outline"
            onClick={() =>
              mutate((d) => {
                d.notices
                  .filter((n) => rows.some((r) => r.id === n.id))
                  .forEach((n) => {
                    n.read = true;
                  });
              })
            }
          >
            อ่านรายการที่แสดงทั้งหมด
          </Button>
        }
      />
      <DataTable
        rows={rows}
        searchText={(n) => `${n.title} ${n.detail} ${n.assignee}`}
        toolbar={
          <>
            <FilterSelect
              value={type}
              onChange={setType}
              placeholder="ประเภท"
              options={[...new Set(scoped.map((n) => n.type))].map((value) => ({
                value,
                label: value,
              }))}
            />
            <FilterSelect
              value={read}
              onChange={setRead}
              placeholder="การอ่าน"
              options={[
                { value: "read", label: "อ่านแล้ว" },
                { value: "unread", label: "ยังไม่อ่าน" },
              ]}
            />
          </>
        }
        columns={[
          {
            key: "title",
            header: "แจ้งเตือน",
            cell: (n) => (
              <div className={n.read ? "" : "font-semibold"}>
                {n.title}
                <div className="text-xs font-normal text-muted-foreground">{n.detail}</div>
              </div>
            ),
          },
          {
            key: "branch",
            header: "สาขา / ผู้รับผิดชอบ",
            cell: (n) => `${branchName(n.branchId)} / ${n.assignee}`,
          },
          { key: "at", header: "เวลา", cell: (n) => thDateTime(n.at), sort: (n) => n.at },
          {
            key: "priority",
            header: "ความสำคัญ",
            cell: (n) => (
              <StatusBadge
                tone={
                  n.priority === "high" ? "danger" : n.priority === "medium" ? "warning" : "neutral"
                }
              >
                {n.priority === "high" ? "สูง" : n.priority === "medium" ? "กลาง" : "ต่ำ"}
              </StatusBadge>
            ),
          },
          {
            key: "read",
            header: "สถานะ",
            cell: (n) =>
              n.read ? (
                "อ่านแล้ว"
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    mutate((d) => {
                      d.notices.find((x) => x.id === n.id)!.read = true;
                    })
                  }
                >
                  ทำเครื่องหมายอ่าน
                </Button>
              ),
          },
          {
            key: "link",
            header: "รายการ",
            cell: (n) => (
              <Link
                to={n.link}
                className="text-primary"
                onClick={() =>
                  mutate((d) => {
                    d.notices.find((x) => x.id === n.id)!.read = true;
                  })
                }
              >
                เปิดรายการ
              </Link>
            ),
          },
        ]}
      />
    </>
  );
}

export function NotificationSettings() {
  const { state, can, allowedBranches } = useStore();
  const run = useDemoAction();
  const record = { id: "notification-rules", branchId: allowedBranches[0] ?? "B1" };
  const [follow, setFollow] = useState(String(state.plateFollowDays));
  return (
    <>
      <PageHeader
        title="Notification Settings"
        subtitle="กำหนดเหตุการณ์ ระยะเวลา ผู้รับ ความถี่ และดูตัวอย่างข้อความ"
        demo
      />
      <Panel className="mb-5" title="ติดตามคืนป้ายแดง">
        <div className="flex gap-3">
          <Input
            aria-label="จำนวนวันติดตามป้ายแดง"
            type="number"
            min="1"
            max="365"
            value={follow}
            onChange={(e) => setFollow(e.target.value)}
            className="w-36"
          />
          <Button
            disabled={!can("notifications", "edit")}
            onClick={() =>
              run(
                "notifications",
                "edit",
                "NotifyRule",
                record,
                "ปรับวันติดตามป้ายแดงแล้ว",
                (d) => {
                  const n = Number(follow);
                  if (!Number.isInteger(n) || n < 1 || n > 365) throw new Error("ระบุ 1–365 วัน");
                  d.plateFollowDays = n;
                  const r = d.rules.find((r) => r.id === "R4");
                  if (r) r.offsetDays = n;
                },
              )
            }
          >
            บันทึกจำนวนวัน
          </Button>
        </div>
      </Panel>
      <div className="grid gap-5 lg:grid-cols-2">
        {state.rules.map((rule) => (
          <Panel
            key={rule.id}
            title={rule.event}
            actions={
              <label className="flex gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  disabled={!can("notifications", "edit")}
                  onChange={(e) =>
                    run(
                      "notifications",
                      "edit",
                      "NotifyRule",
                      { ...record, id: rule.id },
                      "ปรับสถานะ Rule แล้ว",
                      (d) => {
                        d.rules.find((r) => r.id === rule.id)!.enabled = e.target.checked;
                      },
                    )
                  }
                />
                เปิดใช้งาน
              </label>
            }
          >
            <div className="space-y-3">
              <Label htmlFor={`rule-${rule.id}-days`}>จำนวนวันก่อน (-) / หลัง (+) ครบกำหนด</Label>
              <Input
                id={`rule-${rule.id}-days`}
                type="number"
                defaultValue={rule.offsetDays}
                disabled={!can("notifications", "edit")}
                onBlur={(e) => {
                  const n = Number(e.target.value);
                  if (n !== rule.offsetDays)
                    run(
                      "notifications",
                      "edit",
                      "NotifyRule",
                      { ...record, id: rule.id },
                      "แก้ไขระยะเวลาแจ้งเตือนแล้ว",
                      (d) => {
                        if (!Number.isInteger(n) || Math.abs(n) > 365)
                          throw new Error("ระบุจำนวนวันระหว่าง -365 ถึง 365");
                        d.rules.find((r) => r.id === rule.id)!.offsetDays = n;
                      },
                    );
                }}
              />
              <Label htmlFor={`rule-${rule.id}-recipients`}>บทบาท / ผู้ใช้ / สาขาที่รับแจ้ง</Label>
              <Input
                id={`rule-${rule.id}-recipients`}
                defaultValue={rule.recipients}
                disabled={!can("notifications", "edit")}
                onBlur={(e) => {
                  if (e.target.value && e.target.value !== rule.recipients)
                    run(
                      "notifications",
                      "edit",
                      "NotifyRule",
                      { ...record, id: rule.id },
                      "แก้ไขผู้รับแจ้งแล้ว",
                      (d) => {
                        if (
                          !d.roles.some((r) =>
                            e.target.value.toLowerCase().includes(r.name.toLowerCase()),
                          )
                        )
                          throw new Error(
                            "ระบุชื่อบทบาทตาม Role Switcher คั่นด้วยเครื่องหมายจุลภาค",
                          );
                        d.rules.find((r) => r.id === rule.id)!.recipients = e.target.value;
                      },
                    );
                }}
              />
              <Label htmlFor={`rule-${rule.id}-frequency`}>ความถี่</Label>
              <Input
                id={`rule-${rule.id}-frequency`}
                defaultValue={rule.frequency}
                disabled={!can("notifications", "edit")}
                onBlur={(e) => {
                  if (e.target.value && e.target.value !== rule.frequency)
                    run(
                      "notifications",
                      "edit",
                      "NotifyRule",
                      { ...record, id: rule.id },
                      "แก้ไขความถี่แล้ว",
                      (d) => {
                        if (
                          !/^(ทันที|ครั้งเดียว|วันละครั้ง|ทุก [1-9]\d* วัน)$/.test(e.target.value)
                        )
                          throw new Error("ใช้ ทันที, ครั้งเดียว, วันละครั้ง หรือ ทุก N วัน");
                        d.rules.find((r) => r.id === rule.id)!.frequency = e.target.value;
                      },
                    );
                }}
              />
              <div className="rounded-sm bg-muted p-3 text-xs">
                <DemoTag label="Preview" />
                <p className="mt-2">
                  {rule.event} ·{" "}
                  {rule.offsetDays < 0 ? `ก่อน ${-rule.offsetDays}` : `หลัง ${rule.offsetDays}`} วัน
                  · ผู้รับ: {rule.recipients} · ความถี่ {rule.frequency}
                </p>
              </div>
            </div>
          </Panel>
        ))}
      </div>
      <Button
        className="mt-5"
        disabled={!can("notifications", "edit")}
        onClick={() =>
          run(
            "notifications",
            "edit",
            "NotifyRule",
            record,
            "ประเมิน Rule และสร้างแจ้งเตือนที่ยังไม่มีแล้ว",
            (d) => evaluateNotificationRules(d),
          )
        }
      >
        ประเมิน Rule จำลอง (ป้องกันแจ้งเตือนซ้ำ)
      </Button>
    </>
  );
}
