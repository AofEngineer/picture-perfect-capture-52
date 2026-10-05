import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Download, RefreshCw, Pencil } from "lucide-react";
import { useStore } from "@/lib/store";
import { refId, downloadCsv, maskPhone, num, thb, thDateTime } from "@/lib/format";
import { syncCustomer } from "@/lib/mock/service";
import type { Customer, Tier } from "@/lib/mock/types";
import { BOOKING_STATUS, LTX_STATUS, MATCH_STATUS } from "@/lib/labels";
import {
  DataTable,
  DemoTag,
  EmptyState,
  Field,
  FilterSelect,
  PageHeader,
  Panel,
  StatusBadge,
  Timeline,
  type Column,
} from "./ui-kit";
import { useDemoAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function CustomerList() {
  const { state, inScope, branchName, salesName, can, sensitive } = useStore();
  const navigate = useNavigate();
  const [tier, setTier] = useState("all");
  const [branch, setBranch] = useState("all");
  const [sales, setSales] = useState("all");
  const [open, setOpen] = useState(false);
  const rows = state.customers
    .filter(inScope)
    .filter(
      (c) =>
        (tier === "all" || c.tier === tier) &&
        (branch === "all" || c.branchId === branch) &&
        (sales === "all" || c.salesId === sales),
    );
  const columns: Column<Customer>[] = [
    {
      key: "id",
      header: "รหัสลูกค้า",
      cell: (c) => <span className="font-medium text-primary">{c.id}</span>,
      sort: (c) => c.id,
    },
    {
      key: "name",
      header: "ลูกค้า / ข้อมูลติดต่อ",
      cell: (c) => (
        <div>
          {c.name}
          <div className="text-xs text-muted-foreground">
            {sensitive ? c.phone : maskPhone(c.phone)}
          </div>
        </div>
      ),
      sort: (c) => c.name,
    },
    { key: "branch", header: "สาขา", cell: (c) => branchName(c.branchId) },
    {
      key: "sales",
      header: "Sales ผู้ดูแล",
      cell: (c) => salesName(c.salesId),
      sort: (c) => salesName(c.salesId),
    },
    {
      key: "tier",
      header: "สมาชิก",
      cell: (c) => <StatusBadge tone="info">{c.tier}</StatusBadge>,
      sort: (c) => c.tier,
    },
    { key: "points", header: "Point คงเหลือ", cell: (c) => num(c.points), sort: (c) => c.points },
    {
      key: "last",
      header: "กิจกรรมล่าสุด",
      cell: (c) => thDateTime(c.contacts[0]?.at ?? c.lastSync),
      sort: (c) => c.contacts[0]?.at ?? c.lastSync,
    },
  ];
  return (
    <>
      <PageHeader
        title="Customer"
        subtitle="ข้อมูลลูกค้า ประวัติการซื้อ และสมาชิก Loyalty"
        demo
        actions={
          <>
            {can("customer", "export") && (
              <Button
                variant="outline"
                onClick={() =>
                  downloadCsv("customers.csv", [
                    ["รหัส", "ชื่อ", "เบอร์", "สมาชิก", "Point"],
                    ...rows.map((c) => [
                      c.id,
                      c.name,
                      sensitive ? c.phone : maskPhone(c.phone),
                      c.loyaltyId,
                      c.points,
                    ]),
                  ])
                }
              >
                <Download className="size-4" /> Export CSV
              </Button>
            )}
            {can("customer", "create") && (
              <Button onClick={() => setOpen(true)}>
                <Plus className="size-4" /> เพิ่มลูกค้า
              </Button>
            )}
          </>
        }
      />
      <DataTable
        rows={rows}
        columns={columns}
        placeholder="ค้นหารหัส ชื่อ เบอร์โทร เลขสมาชิก"
        searchText={(c) => `${c.id} ${c.name} ${c.phone} ${c.loyaltyId}`}
        onRowClick={(c) => navigate({ to: "/customers/$id", params: { id: c.id } })}
        toolbar={
          <>
            <FilterSelect
              value={branch}
              onChange={setBranch}
              placeholder="สาขา"
              options={state.branches.map((b) => ({ value: b.id, label: b.short }))}
            />
            <FilterSelect
              value={sales}
              onChange={setSales}
              placeholder="Sales"
              options={state.sales
                .filter((s) => inScope({ branchId: s.branchId, salesId: s.id }))
                .map((s) => ({ value: s.id, label: s.name }))}
            />
            <FilterSelect
              value={tier}
              onChange={setTier}
              placeholder="สมาชิก"
              options={["Silver", "Gold", "Platinum"].map((t) => ({ value: t, label: t }))}
            />
          </>
        }
      />
      {open && <CustomerEditor onClose={() => setOpen(false)} />}
    </>
  );
}

function CustomerEditor({ customer, onClose }: { customer?: Customer; onClose: () => void }) {
  const { state, allowedBranches, user } = useStore();
  const run = useDemoAction();
  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [email, setEmail] = useState(customer?.email ?? "");
  const [salesId, setSales] = useState(
    customer?.salesId ??
      user.salesId ??
      state.sales.find((s) => allowedBranches.includes(s.branchId))?.id ??
      "",
  );
  const [error, setError] = useState("");
  const submit = () => {
    if (
      name.trim().length < 3 ||
      !/^0\d{9}$/.test(phone) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      setError("กรุณาระบุชื่อ เบอร์โทร 10 หลัก และอีเมลให้ถูกต้อง");
      return;
    }
    const sales = state.sales.find((s) => s.id === salesId);
    if (!sales || !allowedBranches.includes(sales.branchId)) {
      setError("กรุณาเลือก Sales ในสาขาที่มีสิทธิ์");
      return;
    }
    const record = { id: customer?.id ?? refId("C"), branchId: sales.branchId, salesId };
    if (
      run(
        "customer",
        customer ? "edit" : "create",
        "Customer",
        record,
        customer ? "แก้ไขข้อมูลลูกค้าแล้ว" : "เพิ่มลูกค้าแล้ว",
        (d) => {
          if (d.customers.some((c) => c.phone === phone && c.id !== record.id))
            throw new Error("เบอร์โทรนี้มีในระบบแล้ว");
          if (customer)
            Object.assign(
              d.customers.find((c) => c.id === customer.id)!,
              { name: name.trim(), phone, email, salesId, branchId: sales.branchId },
            );
          else
            d.customers.push({
              ...record,
              name: name.trim(),
              phone,
              email,
              idCard: "ข้อมูลสมมติ",
              tier: "Silver",
              loyaltyId: refId("LM-DEMO"),
              points: 0,
              extPoints: 0,
              pointsExpiring: 0,
              lastSync: new Date().toISOString(),
              visits: [],
              contacts: [],
            });
        },
      )
    )
      onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{customer ? "แก้ไขลูกค้า" : "เพิ่มลูกค้า"}</DialogTitle>
          <DialogDescription>ใช้ข้อมูลตัวอย่างในการกรอกแบบฟอร์ม</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {[
            ["customer-name", "ชื่อ", name, setName],
            ["customer-phone", "เบอร์โทร", phone, setPhone],
            ["customer-email", "อีเมล", email, setEmail],
          ].map(([id, label, value, setter]) => (
            <div key={id as string}>
              <Label htmlFor={id as string}>{label as string}</Label>
              <Input
                id={id as string}
                value={value as string}
                onChange={(e) => (setter as (v: string) => void)(e.target.value)}
              />
            </div>
          ))}
          <Label>Sales ผู้ดูแล</Label>
          <Select value={salesId} onValueChange={setSales}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {state.sales
                .filter(
                  (s) =>
                    allowedBranches.includes(s.branchId) &&
                    (!user.salesId || s.id === user.salesId),
                )
                .map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button onClick={submit}>บันทึกข้อมูลลูกค้า</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CustomerDetail({ id }: { id: string }) {
  const { state, inScope, branchName, salesName, sensitive, can, user } = useStore();
  const run = useDemoAction();
  const [edit, setEdit] = useState(false);
  const [contact, setContact] = useState("");
  const c = state.customers.find((x) => x.id === id);
  if (!c || !inScope(c)) return <EmptyState title="ไม่พบลูกค้าหรือไม่มีสิทธิ์ดูข้อมูล" />;
  const bookings = state.bookings.filter((b) => b.customerId === id && inScope(b));
  const txs = state.loyaltyTx.filter(
    (t) => t.customerId === id && (!t.bookingId || bookings.some((b) => b.id === t.bookingId)),
  );
  const tasks = state.tasks.filter(
    (t) => t.customerId === id && inScope({ branchId: t.branchId, salesId: t.assignee }),
  );
  const bookingTable = (history: boolean) => (
    <DataTable
      rows={history ? bookings.filter((b) => b.status === "closed") : bookings}
      columns={[
        {
          key: "id",
          header: "Booking",
          cell: (b) => (
            <Link to="/bookings/$id" params={{ id: b.id }} className="text-primary">
              {b.id}
            </Link>
          ),
          sort: (b) => b.id,
        },
        {
          key: "car",
          header: "รถ",
          cell: (b) => (
            <Link to="/stock/$id" params={{ id: b.vehicleId }} className="text-primary">
              {state.vehicles.find((v) => v.id === b.vehicleId)?.model}
            </Link>
          ),
        },
        { key: "paid", header: "ยอดชำระ", cell: (b) => thb(b.paid) },
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
  );
  return (
    <>
      <PageHeader
        title={c.name}
        subtitle={`${c.id} · ${branchName(c.branchId)} · Sales: ${salesName(c.salesId)}`}
        demo
        actions={
          can("customer", "edit") && (
            <Button variant="outline" onClick={() => setEdit(true)}>
              <Pencil className="size-4" /> แก้ไขข้อมูล
            </Button>
          )
        }
      />
      <Tabs defaultValue="profile">
        <TabsList className="mb-4 flex h-auto flex-wrap justify-start">
          {[
            "Profile",
            "Purchase History",
            "Visit & Test Drive History",
            "Bookings",
            "Loyalty",
            "Documents",
            "Activity Timeline",
          ].map((label) => (
            <TabsTrigger key={label} value={label === "Profile" ? "profile" : label}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="profile">
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="ข้อมูลลูกค้า">
              <div className="grid grid-cols-2 gap-4">
                <Field label="เบอร์โทร">{sensitive ? c.phone : maskPhone(c.phone)}</Field>
                <Field label="อีเมล">{sensitive ? c.email : "••••@example.com"}</Field>
                <Field label="บัตรประชาชน (สมมติ)">{sensitive ? c.idCard : "•••••••••••••"}</Field>
                <Field label="สมาชิก">
                  {c.tier} · {c.loyaltyId}
                </Field>
                <Field label="Point คงเหลือ">{num(c.points)}</Field>
                <Field label="Point ใกล้หมดอายุ">{num(c.pointsExpiring)}</Field>
              </div>
            </Panel>
            <Panel title="นัดหมายและงานติดตาม">
              {tasks.length ? (
                <Timeline
                  items={tasks.map((t) => ({
                    at: t.date,
                    title: t.title,
                    sub: `${thDateTime(t.date)} · ${t.status}`,
                  }))}
                />
              ) : (
                <EmptyState title="ไม่มีนัดหมาย" />
              )}
              {can("customer", "edit") && (
                <div className="mt-4 flex gap-2">
                  <Input
                    aria-label="บันทึกการติดต่อ"
                    placeholder="บันทึกการติดต่อ"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                  />
                  <Button
                    onClick={() => {
                      if (
                        run("customer", "edit", "Customer", c, "บันทึกการติดต่อแล้ว", (d) => {
                          if (contact.trim().length < 5)
                            throw new Error("ระบุรายละเอียดอย่างน้อย 5 ตัวอักษร");
                          d.customers
                            .find((x) => x.id === id)!
                            .contacts.unshift({
                              at: new Date().toISOString(),
                              text: `${contact} · ${user.name}`,
                            });
                        })
                      )
                        setContact("");
                    }}
                  >
                    บันทึก
                  </Button>
                </div>
              )}
            </Panel>
          </div>
        </TabsContent>
        <TabsContent value="Purchase History">{bookingTable(true)}</TabsContent>
        <TabsContent value="Bookings">{bookingTable(false)}</TabsContent>
        <TabsContent value="Visit & Test Drive History">
          <Panel title="ประวัติเข้าชมและ Test Drive">
            <Timeline
              items={c.visits.map((v) => ({ at: v.at, title: v.text, sub: thDateTime(v.at) }))}
            />
          </Panel>
        </TabsContent>
        <TabsContent value="Loyalty">
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Loyalty Member" actions={<DemoTag />}>
              <div className="grid grid-cols-2 gap-4">
                <Field label="ระบบต้นทาง">Loyalty API</Field>
                <Field label="Member ID">{c.loyaltyId}</Field>
                <Field label="ยอดภายใน">{num(c.points)} Point</Field>
                <Field label="ยอดจากระบบภายนอก">{num(c.extPoints)} Point</Field>
                <Field label="Sync ล่าสุด">{thDateTime(c.lastSync)}</Field>
                <Field label="เทียบยอด">
                  <StatusBadge tone={c.points === c.extPoints ? "success" : "warning"}>
                    {c.points === c.extPoints ? "ตรงกัน" : "รอตรวจสอบ"}
                  </StatusBadge>
                </Field>
              </div>
              <Button
                className="mt-4"
                variant="outline"
                disabled={!can("customer", "edit") && !can("integrations", "edit")}
                onClick={() =>
                  run(
                    can("customer", "edit") ? "customer" : "integrations",
                    "edit",
                    "Customer",
                    c,
                    "Sync ข้อมูล Loyalty จำลองแล้ว",
                    (d) => syncCustomer(d, id),
                  )
                }
              >
                <RefreshCw className="size-4" /> Sync ข้อมูลจำลอง
              </Button>
            </Panel>
            <Panel title="การตรวจสอบยอด">
              <p className="text-sm text-muted-foreground">
                ยอดคลาดเคลื่อนจะสร้างงานติดตามโดยไม่เขียนทับยอดภายใน
                ธุรกรรมอ้างอิงสูตรเวอร์ชันที่ใช้ในวันทำรายการ
              </p>
            </Panel>
          </div>
          <div className="mt-5">
            <DataTable
              rows={txs}
              columns={[
                { key: "at", header: "วันเวลา", cell: (t) => thDateTime(t.at), sort: (t) => t.at },
                { key: "type", header: "ประเภท", cell: (t) => t.type },
                {
                  key: "points",
                  header: "Point",
                  cell: (t) => num(t.points),
                  sort: (t) => t.points,
                },
                {
                  key: "ref",
                  header: "Reference / Booking",
                  cell: (t) => (
                    <div>
                      {t.ref}
                      {t.bookingId && (
                        <div>
                          <Link
                            className="text-primary"
                            to="/bookings/$id"
                            params={{ id: t.bookingId }}
                          >
                            {t.bookingId}
                          </Link>
                        </div>
                      )}
                    </div>
                  ),
                },
                { key: "version", header: "สูตร", cell: (t) => t.formulaVersion },
                {
                  key: "status",
                  header: "สถานะ",
                  cell: (t) => <StatusBadge tone={LTX_STATUS[t.status][1]}>{t.status}</StatusBadge>,
                },
                {
                  key: "match",
                  header: "เทียบยอด",
                  cell: (t) => (
                    <StatusBadge tone={MATCH_STATUS[t.match][1]}>
                      {MATCH_STATUS[t.match][0]}
                    </StatusBadge>
                  ),
                },
              ]}
            />
          </div>
        </TabsContent>
        <TabsContent value="Documents">
          <Panel title="เอกสารจาก Booking">
            {bookings.flatMap((b) =>
              b.docs.map((doc) => (
                <div
                  key={`${b.id}-${doc.type}-${doc.version}`}
                  className="flex justify-between border-b py-2 text-sm"
                >
                  <span>
                    {doc.type} v{doc.version} · {thDateTime(doc.at)}
                  </span>
                  <Link to="/bookings/$id" params={{ id: b.id }} className="text-primary">
                    {b.id}
                  </Link>
                </div>
              )),
            )}
            {!bookings.some((b) => b.docs.length) && <EmptyState title="ไม่มีเอกสาร" />}
          </Panel>
        </TabsContent>
        <TabsContent value="Activity Timeline">
          <Panel title="ประวัติกิจกรรม">
            <Timeline
              items={[...c.contacts, ...c.visits]
                .sort((a, b) => b.at.localeCompare(a.at))
                .map((v) => ({ at: v.at, title: v.text, sub: thDateTime(v.at) }))}
            />
          </Panel>
        </TabsContent>
      </Tabs>
      {edit && <CustomerEditor customer={c} onClose={() => setEdit(false)} />}
    </>
  );
}
