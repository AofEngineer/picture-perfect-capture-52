import type {
  Booking,
  Branch,
  Commission,
  Customer,
  DemoState,
  Integration,
  LoyaltyTx,
  Notice,
  RedPlate,
  RolePerm,
  SalesPerson,
  ServiceOrder,
  Task,
  Vehicle,
  AuditEntry,
  MenuKey,
  Action,
} from "./types";

export const WORKFLOW_STEPS = [
  "สร้างการจอง",
  "ตรวจสอบข้อมูลและเอกสาร",
  "ตรวจสอบ AMLO",
  "ทำสัญญาและลงนาม",
  "ชำระเงิน/ใช้ Point",
  "เตรียมรถและ Checklist",
  "ส่งมอบ",
  "ปิดการขาย",
];

export const STEP_REQUIREMENTS: string[][] = [
  ["ข้อมูลลูกค้า", "รถที่จอง", "เงินจอง"],
  ["ยืนยันข้อมูล OCR บัตรประชาชน"],
  ["ผล AMLO: ไม่พบรายการตรงกัน"],
  ["ลงนามครบทุกฝ่าย (E-Signature)"],
  ["ชำระยอดคงเหลือครบ"],
  ["Service Order ก่อนส่งมอบเสร็จสิ้น"],
  ["ใบส่งมอบรถ", "จับคู่ป้ายแดง"],
  ["ปิดงานโดยผู้จัดการสาขา"],
];

function d(offset: number, hour = 10, min = 0) {
  const x = new Date();
  x.setHours(hour, min, 0, 0);
  x.setDate(x.getDate() + offset);
  return x.toISOString();
}

const ALL_MENUS: MenuKey[] = [
  "dashboard",
  "booking",
  "customer",
  "stock",
  "sales",
  "reports",
  "integrations",
  "loyalty",
  "access",
  "audit",
  "notifications",
];
const FULL: Action[] = ["view", "create", "edit", "approve", "export"];
const allMenus = (a: Action[]) =>
  Object.fromEntries(ALL_MENUS.map((m) => [m, a])) as Record<MenuKey, Action[]>;

export const seedRoles = (): RolePerm[] => [
  {
    id: "sales",
    name: "Sales",
    scope: "own",
    branches: ["B1"],
    sensitive: false,
    menus: {
      dashboard: ["view"],
      booking: ["view", "create", "edit"],
      customer: ["view", "create", "edit"],
      stock: ["view"],
      sales: ["view", "create"],
    },
  },
  {
    id: "manager",
    name: "Branch Manager",
    scope: "branch",
    branches: ["B1"],
    sensitive: true,
    menus: {
      dashboard: ["view", "export"],
      booking: FULL,
      customer: FULL,
      stock: FULL,
      sales: FULL,
      reports: ["view", "export"],
      notifications: ["view", "edit"],
    },
  },
  {
    id: "stock",
    name: "Stock Officer",
    scope: "all",
    branches: ["B1", "B2", "B3", "B4"],
    sensitive: true,
    menus: { dashboard: ["view"], stock: FULL, booking: ["view"], reports: ["view", "export"] },
  },
  {
    id: "service",
    name: "Service Officer",
    scope: "branch",
    branches: ["B1", "B2"],
    sensitive: false,
    menus: { dashboard: ["view"], stock: ["view", "edit"] },
  },
  {
    id: "finance",
    name: "Finance",
    scope: "all",
    branches: ["B1", "B2", "B3", "B4"],
    sensitive: true,
    menus: {
      dashboard: ["view"],
      booking: ["view", "approve", "export"],
      customer: ["view"],
      sales: ["view", "approve", "export"],
      reports: ["view", "export"],
      integrations: ["view"],
    },
  },
  {
    id: "loyalty",
    name: "Loyalty Administrator",
    scope: "all",
    branches: ["B1", "B2", "B3", "B4"],
    sensitive: false,
    menus: {
      dashboard: ["view"],
      customer: ["view"],
      loyalty: FULL,
      reports: ["view", "export"],
      integrations: ["view", "edit"],
    },
  },
  {
    id: "admin",
    name: "System Administrator",
    scope: "all",
    branches: ["B1", "B2", "B3", "B4"],
    sensitive: true,
    menus: allMenus(FULL),
  },
  {
    id: "auditor",
    name: "Auditor",
    scope: "all",
    branches: ["B1", "B2", "B3", "B4"],
    sensitive: true,
    menus: { ...allMenus(["view", "export"]), access: ["view"] },
  },
];

export const DEMO_USERS: Record<string, { name: string; salesId?: string }> = {
  sales: { name: "สมชาย ใจดี", salesId: "S1" },
  manager: { name: "ณัฐพล รุ่งเรือง" },
  stock: { name: "ประเสริฐ คลังดี" },
  service: { name: "วีระ ช่างฝีมือ" },
  finance: { name: "อรุณี บัญชีกิจ" },
  loyalty: { name: "พิมพ์ชนก สะสมแต้ม" },
  admin: { name: "ผู้ดูแลระบบ" },
  auditor: { name: "ศักดิ์ชัย ตรวจสอบ" },
};

export function createSeed(): DemoState {
  const branches: Branch[] = [
    { id: "B1", name: "สาขาพระราม 9", short: "พระราม 9" },
    { id: "B2", name: "สาขาบางนา", short: "บางนา" },
    { id: "B3", name: "สาขาเชียงใหม่", short: "เชียงใหม่" },
    { id: "B4", name: "สาขาภูเก็ต", short: "ภูเก็ต" },
  ];
  const sales: SalesPerson[] = [
    {
      id: "S1",
      code: "EMP-1021",
      name: "สมชาย ใจดี",
      branchId: "B1",
      target: 6,
      phone: "0811110001",
    },
    {
      id: "S2",
      code: "EMP-1034",
      name: "วิภาวรรณ ศรีสุข",
      branchId: "B1",
      target: 5,
      phone: "0811110002",
    },
    {
      id: "S3",
      code: "EMP-2011",
      name: "ธนกร พงษ์ไพร",
      branchId: "B2",
      target: 6,
      phone: "0811110003",
    },
    {
      id: "S4",
      code: "EMP-2018",
      name: "ปิยะนุช แก้วมณี",
      branchId: "B2",
      target: 4,
      phone: "0811110004",
    },
    {
      id: "S5",
      code: "EMP-3005",
      name: "อนุชา เชียงทอง",
      branchId: "B3",
      target: 4,
      phone: "0811110005",
    },
    {
      id: "S6",
      code: "EMP-4002",
      name: "กมลชนก ทะเลงาม",
      branchId: "B4",
      target: 4,
      phone: "0811110006",
    },
  ];

  type VSpec = [
    string,
    Vehicle["body"],
    string,
    string,
    Vehicle["status"],
    number,
    number,
    Partial<Vehicle>?,
  ];
  const specs: VSpec[] = [
    ["BMW 330e M Sport", "sedan", "Portimao Blue", "B1", "reserved", 42, 2990000],
    ["BMW X3 xDrive30e", "suv", "Alpine White", "B1", "reserved", 25, 3490000],
    [
      "BMW 320d M Sport",
      "sedan",
      "Black Sapphire",
      "B2",
      "reserved",
      70,
      2490000,
      { releaseEvent: { at: d(-1, 9), reason: "ลูกค้าไม่ชำระเงินตามกำหนด" } },
    ],
    ["BMW i4 eDrive40", "ev", "Brooklyn Grey", "B1", "reserved", 33, 3990000],
    ["BMW X1 sDrive20i", "suv", "Mineral White", "B2", "reserved", 18, 2190000],
    ["BMW iX3 M Sport", "ev", "Phytonic Blue", "B3", "reserved", 51, 3290000],
    [
      "BMW X5 xDrive50e",
      "suv",
      "Carbon Black",
      "B1",
      "prep",
      60,
      5990000,
      { ready: false, readyNote: "อยู่ระหว่างตรวจก่อนส่งมอบ" },
    ],
    ["BMW 520d M Sport", "sedan", "Sophisto Grey", "B2", "sold", 90, 3290000],
    ["BMW X3 xDrive30e", "suv", "Brooklyn Grey", "B4", "sold", 75, 3490000],
    ["BMW 330e M Sport", "sedan", "Alpine White", "B1", "reserved", 28, 2990000],
    [
      "BMW X1 sDrive20i",
      "suv",
      "Sparkling Copper",
      "B2",
      "prep",
      22,
      2190000,
      { ready: false, readyNote: "รอติดตั้งฟิล์ม" },
    ],
    ["BMW i4 eDrive40", "ev", "Skyscraper Grey", "B3", "reserved", 40, 3990000],
    ["BMW X5 xDrive50e", "suv", "Alpine White", "B4", "sold", 120, 5990000],
    [
      "BMW 330e M Sport",
      "sedan",
      "Black Sapphire",
      "B1",
      "available",
      95,
      2990000,
      { bonus: { amount: 30000, condition: "ส่งมอบภายในสิ้นเดือน", until: d(25) } },
    ],
    ["BMW X3 xDrive30e", "suv", "Carbon Black", "B1", "available", 12, 3490000],
    [
      "BMW i7 xDrive60",
      "ev",
      "Oxide Grey",
      "B1",
      "available",
      140,
      7290000,
      {
        bonus: { amount: 80000, condition: "รถอายุเกิน 120 วัน ส่งมอบภายใน 30 วัน", until: d(30) },
      },
    ],
    [
      "BMW 520d M Sport",
      "sedan",
      "Alpine White",
      "B2",
      "available",
      55,
      3290000,
      { bonus: { amount: 20000, condition: "แคมเปญ Q4", until: d(40) } },
    ],
    ["BMW X1 sDrive20i", "suv", "Alpine White", "B3", "available", 8, 2190000],
    ["BMW iX3 M Sport", "ev", "Mineral White", "B2", "available", 66, 3290000],
    ["BMW i4 eDrive40", "ev", "Portimao Blue", "B4", "available", 30, 3990000],
    [
      "BMW X5 xDrive50e",
      "suv",
      "Tanzanite Blue",
      "B1",
      "incoming",
      0,
      5990000,
      { expectedAt: d(6), ready: false },
    ],
    [
      "BMW i4 eDrive40",
      "ev",
      "Alpine White",
      "B1",
      "incoming",
      0,
      3990000,
      { expectedAt: d(12), ready: false },
    ],
    [
      "BMW 520d M Sport",
      "sedan",
      "Carbon Black",
      "B3",
      "transfer",
      48,
      3290000,
      { ready: false, readyNote: "โอนจากบางนา → เชียงใหม่" },
    ],
    [
      "BMW M340i xDrive",
      "sedan",
      "Fire Red",
      "B2",
      "available",
      102,
      4290000,
      { bonus: { amount: 50000, condition: "Sales ที่ปิดการขายได้รับเพิ่ม", until: d(14) } },
    ],
  ];
  const vehicles: Vehicle[] = specs.map(
    ([model, body, color, branchId, status, recv, price, extra], i) => {
      const n = i + 1;
      const id = `V${String(n).padStart(2, "0")}`;
      const receivedAt = status === "incoming" ? d(30) : d(-recv);
      return {
        id,
        code: `STK-${2600 + n}`,
        model,
        body,
        color,
        year: recv > 100 ? 2025 : 2026,
        vin: `WBA${(5000000 + n * 7919).toString().padStart(9, "0")}TH${String(n).padStart(4, "0")}`,
        branchId,
        cost: Math.round(price * 0.88),
        price,
        receivedAt,
        branchSince: status === "transfer" ? d(-3) : n === 18 ? d(-4) : receivedAt,
        status,
        ready: status === "available",
        history:
          status === "incoming"
            ? []
            : [
                {
                  at: receivedAt,
                  text: `รับรถเข้า ${branches.find((b) => b.id === branchId)!.name}`,
                },
              ],
        ...extra,
      } as Vehicle;
    },
  );

  const custNames = [
    "คุณกิตติพัฒน์ วงศ์ทอง",
    "คุณสุภาพร มณีรัตน์",
    "คุณธีรวัฒน์ แสงอรุณ",
    "คุณนภัสสร ปัญญาดี",
    "คุณวรเชษฐ์ ทองคำ",
    "คุณศิริพร ชัยมงคล",
    "คุณปกรณ์ ศักดิ์สิทธิ์",
    "คุณอัญชลี ธนากร",
    "คุณภูริ ทะเลใส",
    "คุณจิราพร รัตนกุล",
    "คุณเอกชัย บุญมา",
    "คุณมาลัย สุขเกษม",
    "คุณชยพล อินทร์แก้ว",
    "คุณรัชนี พรหมวงศ์",
    "คุณณัฐวุฒิ เจริญผล",
  ];
  const tiers: Customer["tier"][] = ["Platinum", "Gold", "Silver"];
  const custSales = [
    "S1",
    "S1",
    "S3",
    "S2",
    "S4",
    "S5",
    "S2",
    "S3",
    "S6",
    "S1",
    "S4",
    "S5",
    "S6",
    "S2",
    "S3",
  ];
  const customers: Customer[] = custNames.map((name, i) => {
    const s = sales.find((x) => x.id === custSales[i])!;
    const pts = i === 0 ? 120000 : 8000 + ((i * 7349) % 60000);
    return {
      id: `C${String(i + 1).padStart(2, "0")}`,
      name,
      phone: `08${(21000000 + i * 1234567).toString().slice(0, 8)}`,
      idCard: `1-1009-${String(10000 + i * 731).slice(0, 5)}-${String(10 + i).slice(-2)}-${i % 9}`,
      email: `demo${i + 1}@example.com`,
      salesId: s.id,
      branchId: s.branchId,
      tier: seedAt(tiers, i % 3),
      loyaltyId: `LM-${880000 + i * 17}`,
      points: pts,
      extPoints: i === 4 ? pts - 1500 : pts,
      pointsExpiring: i % 4 === 0 ? 3000 : 0,
      lastSync: d(-(i % 3), 8),
      visits: [
        { at: d(-30 + i), text: "เข้าชมโชว์รูม" },
        { at: d(-21 + i), text: "Test Drive" },
      ],
      contacts: [{ at: d(-3), text: "โทรติดตามความสนใจ" }],
    };
  });

  const esignDefault = (c: Customer, s: SalesPerson, st: Booking["esign"]["status"]) => ({
    status: st,
    signers: [
      {
        name: c.name,
        role: "ผู้ซื้อ",
        signedAt: st === "done" || st === "partial" ? d(-2, 14) : undefined,
      },
      {
        name: s.name,
        role: "Sales",
        signedAt: st === "done" || st === "partial" ? d(-2, 15) : undefined,
      },
      {
        name: "ณัฐพล รุ่งเรือง",
        role: "ผู้จัดการสาขา",
        signedAt: st === "done" ? d(-1, 9) : undefined,
      },
    ],
  });

  type BSpec = {
    c: number;
    v: number;
    s: string;
    step: number;
    status?: Booking["status"];
    created: number;
    exp: number;
    deliv?: number;
    amlo?: Booking["amlo"]["status"];
    esign?: Booking["esign"]["status"];
    extra?: Partial<Booking>;
  };
  const bspecs: BSpec[] = [
    {
      c: 1,
      v: 1,
      s: "S1",
      step: 3,
      created: -10,
      exp: 20,
      deliv: 12,
      amlo: "clear",
      esign: "pending",
    },
    { c: 2, v: 2, s: "S1", step: 1, created: -13, exp: 1, deliv: 15 },
    {
      c: 3,
      v: 3,
      s: "S3",
      step: 1,
      status: "expired",
      created: -16,
      exp: -1,
      extra: { expireReason: "ลูกค้าไม่ชำระเงินตามกำหนด", releaseState: "awaiting" },
    },
    { c: 4, v: 4, s: "S2", step: 2, created: -12, exp: 10, amlo: "clear" },
    { c: 5, v: 5, s: "S4", step: 2, created: -9, exp: 12, amlo: "clear" },
    {
      c: 6,
      v: 6,
      s: "S5",
      step: 4,
      created: -20,
      exp: 6,
      amlo: "clear",
      esign: "done",
      extra: { pointsUsed: 20000 },
    },
    { c: 7, v: 7, s: "S2", step: 6, created: -25, exp: 30, deliv: 1, amlo: "clear", esign: "done" },
    {
      c: 8,
      v: 8,
      s: "S3",
      step: 7,
      status: "closed",
      created: -45,
      exp: -15,
      deliv: -32,
      amlo: "clear",
      esign: "done",
    },
    {
      c: 9,
      v: 9,
      s: "S6",
      step: 7,
      status: "closed",
      created: -40,
      exp: -10,
      deliv: -20,
      amlo: "clear",
      esign: "done",
    },
    { c: 10, v: 10, s: "S1", step: 2, created: -5, exp: 9, deliv: 18, amlo: "error" },
    {
      c: 11,
      v: 11,
      s: "S4",
      step: 5,
      created: -18,
      exp: 14,
      deliv: 3,
      amlo: "clear",
      esign: "done",
    },
    { c: 12, v: 12, s: "S5", step: 2, created: -6, exp: 8, amlo: "review" },
    {
      c: 13,
      v: 13,
      s: "S6",
      step: 7,
      status: "closed",
      created: -70,
      exp: -40,
      deliv: -40,
      amlo: "clear",
      esign: "done",
    },
  ];
  const bookings: Booking[] = bspecs.map((b, i) => {
    const c = seedAt(customers, b.c - 1);
    const v = seedAt(vehicles, b.v - 1);
    const s = sales.find((x) => x.id === b.s)!;
    const id = `BK-2026-${String(101 + i).padStart(4, "0")}`;
    const closed = b.status === "closed";
    return {
      id,
      customerId: c.id,
      vehicleId: v.id,
      salesId: s.id,
      branchId: v.branchId,
      createdAt: d(b.created, 11),
      deposit: 50000,
      price: v.price,
      expiresAt: d(b.exp, 18),
      deliveryAt: b.deliv !== undefined ? d(b.deliv, 14) : undefined,
      step: b.step,
      status: b.status ?? "active",
      amlo: {
        status: b.amlo ?? "none",
        at: b.amlo && b.amlo !== "none" ? d(b.created + 2, 10) : undefined,
        ref: b.amlo && b.amlo !== "none" ? `AMLO-${4400 + i}` : undefined,
      },
      ocr:
        b.step >= 2 || closed
          ? { confirmed: true, by: s.name, at: d(b.created + 1) }
          : { confirmed: false },
      esign: esignDefault(c, s, b.esign ?? "draft"),
      pointsUsed: 0,
      pointValue: 1,
      formulaVersion: "v1.1",
      paid: closed ? v.price : 50000,
      docs: [{ type: "ใบจอง", version: 1, at: d(b.created, 11), by: s.name }],
      history: [{ at: d(b.created, 11), by: s.name, text: "สร้างการจอง" }],
      ...b.extra,
    };
  });

  // Refund demo cases
  const rb = (
    idx: number,
    branch: "A" | "B" | "C" | "D",
    step: number,
    deduction: number,
    pointsReturn: number,
    reason: string,
    note?: string,
  ) => {
    const b = seedAt(bookings, idx);
    b.refund = {
      id: `RF-${3001 + idx}`,
      branch,
      step,
      requestedAt: d(-2, 13),
      amount: b.deposit - deduction,
      deduction,
      deductionNote: note,
      pointsReturn,
      reason,
      status: "pending",
      branchId: b.branchId,
      history: [
        { at: d(-2, 13), by: sales.find((s) => s.id === b.salesId)!.name, text: "ยื่นคำขอคืนเงิน" },
      ],
    };
  };
  rb(3, "A", 1, 0, 0, "ลูกค้ายกเลิกเนื่องจากธนาคารไม่อนุมัติสินเชื่อ");
  rb(4, "B", 2, 5000, 0, "ลูกค้าเปลี่ยนใจ", "ค่าดำเนินการเอกสาร ฿5,000");
  rb(5, "D", 1, 0, 20000, "ลูกค้าย้ายต่างประเทศ");

  const tasks: Task[] = [];
  let t = 1;
  const addT = (x: Omit<Task, "id">) =>
    tasks.push({ id: `T${String(t++).padStart(3, "0")}`, ...x });
  addT({
    type: "testdrive",
    title: "นัด Test Drive BMW X3",
    date: d(0, 10),
    customerId: "C14",
    vehicleId: "V15",
    assignee: "S2",
    branchId: "B1",
    status: "todo",
  });
  addT({
    type: "testdrive",
    title: "นัด Test Drive BMW i7",
    date: d(0, 14),
    customerId: "C15",
    vehicleId: "V16",
    assignee: "S1",
    branchId: "B1",
    status: "doing",
  });
  addT({
    type: "delivery",
    title: "ส่งมอบรถ BMW X5",
    date: d(1, 14),
    customerId: "C07",
    bookingId: seedAt(bookings, 6).id,
    vehicleId: "V07",
    assignee: "S2",
    branchId: "B1",
    status: "todo",
    step: 6,
  });
  addT({
    type: "docs",
    title: "ติดตามสำเนาทะเบียนบ้าน",
    date: d(0, 11),
    customerId: "C02",
    bookingId: seedAt(bookings, 1).id,
    assignee: "S1",
    branchId: "B1",
    status: "waiting",
    step: 1,
  });
  addT({
    type: "payment",
    title: "ติดตามชำระยอดคงเหลือ",
    date: d(1, 10),
    customerId: "C06",
    bookingId: seedAt(bookings, 5).id,
    assignee: "S5",
    branchId: "B3",
    status: "todo",
    step: 4,
  });
  addT({
    type: "plate",
    title: "ติดตามคืนป้ายแดง (เกิน 30 วัน)",
    date: d(-1, 10),
    customerId: "C08",
    bookingId: seedAt(bookings, 7).id,
    assignee: "S3",
    branchId: "B2",
    status: "overdue",
  });
  addT({
    type: "plate",
    title: "ติดตามคืนป้ายแดง (จดทะเบียนแล้ว)",
    date: d(0, 15),
    customerId: "C09",
    bookingId: seedAt(bookings, 8).id,
    assignee: "S6",
    branchId: "B4",
    status: "todo",
  });
  addT({
    type: "prep",
    title: "ดูแลรถก่อนส่งมอบ BMW X5",
    date: d(0, 9),
    vehicleId: "V07",
    serviceOrderId: "SO-01",
    assignee: "S2",
    branchId: "B1",
    status: "doing",
    step: 5,
  });
  addT({
    type: "prep",
    title: "ติดฟิล์ม/ตรวจสภาพ BMW X1",
    date: d(1, 9),
    vehicleId: "V11",
    serviceOrderId: "SO-02",
    bookingId: seedAt(bookings, 10).id,
    assignee: "S4",
    branchId: "B2",
    status: "todo",
    step: 5,
  });
  addT({
    type: "docs",
    title: "ตรวจสอบ AMLO เพิ่มเติม",
    date: d(-2, 10),
    customerId: "C12",
    bookingId: seedAt(bookings, 11).id,
    assignee: "S5",
    branchId: "B3",
    status: "overdue",
    step: 2,
  });
  addT({
    type: "docs",
    title: "Retry AMLO (ระบบขัดข้อง)",
    date: d(0, 13),
    customerId: "C10",
    bookingId: seedAt(bookings, 9).id,
    assignee: "S1",
    branchId: "B1",
    status: "todo",
    step: 2,
  });
  addT({
    type: "payment",
    title: "ตรวจสอบเงินจอง (หลุดจอง)",
    date: d(0, 16),
    customerId: "C03",
    bookingId: seedAt(bookings, 2).id,
    assignee: "S3",
    branchId: "B2",
    status: "todo",
  });
  addT({
    type: "testdrive",
    title: "นัด Test Drive BMW 520d",
    date: d(2, 11),
    customerId: "C11",
    vehicleId: "V17",
    assignee: "S3",
    branchId: "B2",
    status: "todo",
  });
  addT({
    type: "delivery",
    title: "ส่งมอบรถ BMW X1",
    date: d(3, 14),
    customerId: "C11",
    bookingId: seedAt(bookings, 10).id,
    vehicleId: "V11",
    assignee: "S4",
    branchId: "B2",
    status: "todo",
    step: 6,
  });
  addT({
    type: "docs",
    title: "ลงนามสัญญาซื้อขาย",
    date: d(2, 15),
    customerId: "C01",
    bookingId: seedAt(bookings, 0).id,
    assignee: "S1",
    branchId: "B1",
    status: "doing",
    step: 3,
  });
  addT({
    type: "testdrive",
    title: "นัด Test Drive BMW i4",
    date: d(4, 10),
    customerId: "C13",
    vehicleId: "V20",
    assignee: "S6",
    branchId: "B4",
    status: "todo",
  });
  addT({
    type: "payment",
    title: "ติดตามโอนเงินจอง",
    date: d(-3, 10),
    customerId: "C05",
    bookingId: seedAt(bookings, 4).id,
    assignee: "S4",
    branchId: "B2",
    status: "done",
    step: 0,
  });

  const checklist = [
    "เปลี่ยนแบตเตอรี่",
    "ชาร์จแบตเตอรี่",
    "ถ่ายน้ำมันเครื่อง",
    "ตรวจสภาพรถ",
    "ตรวจยางและแรงดันลม",
    "ทำความสะอาด",
    "ตรวจความพร้อมก่อนส่งมอบ",
  ];
  const so = (
    n: number,
    vehicleId: string,
    branchId: string,
    type: string,
    assignee: string,
    due: number,
    status: ServiceOrder["status"],
    doneCount: number,
    pick?: number[],
  ): ServiceOrder => ({
    id: `SO-${String(n).padStart(2, "0")}`,
    vehicleId,
    branchId,
    type,
    assignee,
    due: d(due, 9),
    status,
    items: (pick ?? [3, 4, 5, 6]).map((k, i) => ({
      name: seedAt(checklist, k),
      done: i < doneCount,
      doneAt: i < doneCount ? d(Math.min(due, 0) - 1, 15) : undefined,
      checker: i < doneCount ? "วีระ ช่างฝีมือ" : undefined,
    })),
  });
  const serviceOrders: ServiceOrder[] = [
    so(1, "V07", "B1", "เตรียมรถก่อนส่งมอบ", "วีระ ช่างฝีมือ", 0, "doing", 2),
    so(2, "V11", "B2", "เตรียมรถก่อนส่งมอบ", "สมศักดิ์ ยนตรกิจ", 1, "todo", 0),
    so(3, "V14", "B1", "ดูแลรถในสต็อก", "วีระ ช่างฝีมือ", -2, "overdue", 0, [1, 4]),
    so(4, "V16", "B1", "ดูแลรถในสต็อก", "วีระ ช่างฝีมือ", 0, "todo", 0, [0, 1, 3]),
    so(5, "V24", "B2", "ดูแลรถในสต็อก", "สมศักดิ์ ยนตรกิจ", 1, "todo", 0, [1, 2, 4]),
    so(6, "V19", "B2", "ดูแลรถในสต็อก", "สมศักดิ์ ยนตรกิจ", 4, "todo", 0, [1, 5]),
    so(7, "V08", "B2", "เตรียมรถก่อนส่งมอบ", "สมศักดิ์ ยนตรกิจ", -33, "done", 4),
    so(8, "V20", "B4", "ดูแลรถในสต็อก", "ชาตรี ภูเก็ตยนต์", -1, "overdue", 1, [1, 4, 5]),
  ];

  const plates: RedPlate[] = Array.from({ length: 12 }, (_, i) => {
    const branchId = ["B1", "B2", "B3", "B4"][i % 4]!;
    return {
      id: `RP-${String(i + 1).padStart(2, "0")}`,
      number: `ป้ายแดง ${["1กข", "2กค", "3กง", "4กจ"][i % 4]} ${1200 + i * 37}`,
      branchId,
      status: "available" as const,
    };
  });
  Object.assign(seedAt(plates, 1), {
    status: "matched",
    bookingId: seedAt(bookings, 7).id,
    borrowedAt: d(-32),
    lastContact: d(-5),
    follow: "โทรแล้ว ลูกค้าแจ้งจะนำมาคืน",
  });
  Object.assign(seedAt(plates, 3), {
    status: "matched",
    bookingId: seedAt(bookings, 8).id,
    borrowedAt: d(-20),
    registeredAt: d(-5),
    follow: "ยังไม่ได้ติดต่อ",
  });
  Object.assign(seedAt(plates, 7), {
    status: "matched",
    bookingId: seedAt(bookings, 12).id,
    borrowedAt: d(-40),
    registeredAt: d(-10),
    lastContact: d(-2),
    follow: "นัดคืนแล้ว",
    appointment: d(2, 10),
  });
  Object.assign(seedAt(plates, 4), { status: "lost" });
  Object.assign(seedAt(plates, 9), { status: "transfer", transferTo: "B3" });
  Object.assign(seedAt(plates, 8), { status: "checking" });

  const commissions: Commission[] = [
    {
      id: "CM-01",
      bookingId: seedAt(bookings, 12).id,
      salesId: "S6",
      base: 5990000,
      rate: 0.008,
      bonus: 0,
      adjust: 0,
      status: "paid",
      claimNo: "CL-2026-0088",
      paidAt: d(-15),
    },
    {
      id: "CM-02",
      bookingId: seedAt(bookings, 7).id,
      salesId: "S3",
      base: 3290000,
      rate: 0.008,
      bonus: 0,
      adjust: 0,
      status: "draft",
    },
    {
      id: "CM-03",
      bookingId: seedAt(bookings, 8).id,
      salesId: "S6",
      base: 3490000,
      rate: 0.008,
      bonus: 0,
      adjust: -2000,
      status: "rejected",
      note: "เอกสารส่งมอบไม่ครบ — แนบใบส่งมอบรถฉบับลงนาม",
      claimNo: "CL-2026-0091",
    },
    {
      id: "CM-04",
      bookingId: seedAt(bookings, 6).id,
      salesId: "S2",
      base: 5990000,
      rate: 0.008,
      bonus: 0,
      adjust: 0,
      status: "draft",
    },
    {
      id: "CM-05",
      bookingId: seedAt(bookings, 10).id,
      salesId: "S4",
      base: 2190000,
      rate: 0.008,
      bonus: 0,
      adjust: 0,
      status: "draft",
    },
  ];

  const loyaltyTx: LoyaltyTx[] = [
    {
      id: "LT-01",
      customerId: "C08",
      bookingId: seedAt(bookings, 7).id,
      type: "Earn",
      points: 32900,
      value: 0,
      status: "Success",
      ref: "LYT-7781",
      at: d(-32),
      match: "matched",
      formulaVersion: "v1.0",
    },
    {
      id: "LT-02",
      customerId: "C09",
      bookingId: seedAt(bookings, 8).id,
      type: "Earn",
      points: 34900,
      value: 0,
      status: "Success",
      ref: "LYT-7790",
      at: d(-20),
      match: "matched",
      formulaVersion: "v1.0",
    },
    {
      id: "LT-03",
      customerId: "C13",
      bookingId: seedAt(bookings, 12).id,
      type: "Earn",
      points: 89850,
      value: 0,
      status: "Success",
      ref: "LYT-7702",
      at: d(-40),
      match: "matched",
      formulaVersion: "v1.0",
    },
    {
      id: "LT-04",
      customerId: "C06",
      bookingId: seedAt(bookings, 5).id,
      type: "Burn",
      points: 20000,
      value: 20000,
      status: "Success",
      ref: "LYT-7812",
      at: d(-4),
      match: "matched",
      formulaVersion: "v1.1",
    },
    {
      id: "LT-05",
      customerId: "C05",
      bookingId: seedAt(bookings, 4).id,
      type: "Burn",
      points: 1500,
      value: 1500,
      status: "Failed",
      ref: "LYT-7820",
      at: d(-1),
      match: "mismatch",
      formulaVersion: "v1.1",
    },
    {
      id: "LT-06",
      customerId: "C04",
      type: "Adjust",
      points: 500,
      value: 0,
      status: "Success",
      ref: "LYT-7801",
      at: d(-8),
      match: "matched",
      formulaVersion: "v1.1",
    },
    {
      id: "LT-07",
      customerId: "C02",
      type: "Burn",
      points: 3000,
      value: 3000,
      status: "Reversed",
      ref: "LYT-7760",
      at: d(-12),
      match: "matched",
      formulaVersion: "v1.0",
    },
    {
      id: "LT-08",
      customerId: "C11",
      bookingId: seedAt(bookings, 10).id,
      type: "Burn",
      points: 5000,
      value: 5000,
      status: "Pending",
      ref: "LYT-7830",
      at: d(0, 9),
      match: "pending",
      formulaVersion: "v1.1",
    },
  ];

  const audit: AuditEntry[] = [
    {
      id: "A-0001",
      at: d(-2, 13),
      actor: "วิภาวรรณ ศรีสุข",
      role: "Sales",
      branchId: "B1",
      action: "ขอคืนเงิน",
      entity: "Booking",
      entityId: seedAt(bookings, 3).id,
      reason: "สินเชื่อไม่อนุมัติ",
      ref: "AUD-0001",
    },
    {
      id: "A-0002",
      at: d(-1, 9),
      actor: "ระบบ",
      role: "System",
      branchId: "B2",
      action: "หลุดจอง",
      entity: "Booking",
      entityId: seedAt(bookings, 2).id,
      before: "active",
      after: "expired",
      reason: "ไม่ชำระเงินตามกำหนด",
      ref: "AUD-0002",
    },
    {
      id: "A-0003",
      at: d(-1, 11),
      actor: "ระบบ",
      role: "System",
      branchId: "B2",
      action: "Burn Point ไม่สำเร็จ",
      entity: "Loyalty",
      entityId: "LT-05",
      ref: "LYT-7820",
    },
  ];

  const notices: Notice[] = [
    {
      id: "N01",
      type: "Booking",
      title: "Booking ใกล้หมดอายุ",
      detail: `${seedAt(bookings, 1).id} หมดอายุพรุ่งนี้`,
      link: `/bookings/${seedAt(bookings, 1).id}`,
      branchId: "B1",
      assignee: "S1",
      at: d(0, 8),
      priority: "high",
      read: false,
    },
    {
      id: "N02",
      type: "Task",
      title: "นัด Test Drive วันนี้",
      detail: "BMW X3 xDrive30e 10:00 น.",
      link: "/",
      branchId: "B1",
      assignee: "S2",
      at: d(0, 7),
      priority: "medium",
      read: false,
    },
    {
      id: "N03",
      type: "Task",
      title: "นัดส่งมอบวันพรุ่งนี้",
      detail: `${seedAt(bookings, 6).id} BMW X5 xDrive50e`,
      link: `/bookings/${seedAt(bookings, 6).id}`,
      branchId: "B1",
      assignee: "S2",
      at: d(0, 7),
      priority: "medium",
      read: false,
    },
    {
      id: "N04",
      type: "Refund",
      title: "คำขอคืนเงินรออนุมัติ",
      detail: `${seedAt(bookings, 3).id} ฿50,000`,
      link: `/bookings/${seedAt(bookings, 3).id}`,
      branchId: "B1",
      assignee: "manager",
      at: d(-2, 13),
      priority: "high",
      read: false,
    },
    {
      id: "N05",
      type: "Loyalty",
      title: "Burn Point ไม่สำเร็จ",
      detail: "LYT-7820 ระบบ Loyalty ขัดข้อง (จำลอง)",
      link: "/admin/integrations",
      branchId: "B2",
      assignee: "loyalty",
      at: d(-1, 11),
      priority: "high",
      read: false,
    },
    {
      id: "N06",
      type: "Service",
      title: "Service Order วันนี้",
      detail: "SO-01 เตรียมรถก่อนส่งมอบ BMW X5",
      link: "/stock/service-orders",
      branchId: "B1",
      assignee: "service",
      at: d(0, 7),
      priority: "medium",
      read: true,
    },
    {
      id: "N07",
      type: "RedPlate",
      title: "ป้ายแดงครบ 30 วัน",
      detail: "ป้ายแดง 2กค 1237 — ยืมมา 32 วัน",
      link: "/stock/red-plates",
      branchId: "B2",
      assignee: "S3",
      at: d(0, 8),
      priority: "high",
      read: false,
    },
    {
      id: "N08",
      type: "RedPlate",
      title: "จดทะเบียนสำเร็จแต่ยังไม่คืนป้าย",
      detail: "ป้ายแดง 4กจ 1311",
      link: "/stock/red-plates",
      branchId: "B4",
      assignee: "S6",
      at: d(-1, 8),
      priority: "medium",
      read: false,
    },
    {
      id: "N09",
      type: "Commission",
      title: "Commission รอตรวจสอบ",
      detail: "CM-03 ถูกตีกลับ — แก้ไขและส่งใหม่",
      link: "/sales/commission",
      branchId: "B4",
      assignee: "S6",
      at: d(-1, 15),
      priority: "low",
      read: true,
    },
    {
      id: "N10",
      type: "Task",
      title: "งานค้างเกินกำหนด",
      detail: "ตรวจสอบ AMLO เพิ่มเติม (เกิน 2 วัน)",
      link: `/bookings/${seedAt(bookings, 11).id}`,
      branchId: "B3",
      assignee: "S5",
      at: d(0, 8),
      priority: "high",
      read: false,
    },
  ];

  const integrations: Integration[] = [
    {
      id: "ocr",
      name: "OCR",
      status: "connected",
      lastSync: d(0, 9, 12),
      ok: 214,
      fail: 3,
      log: [
        { at: d(0, 9, 12), level: "info", text: "อ่านบัตรประชาชน 1 รายการ ความมั่นใจเฉลี่ย 94%" },
      ],
      mapping: [
        ["first_name", "customer.name"],
        ["id_number", "customer.idCard"],
        ["address", "customer.address"],
      ],
    },
    {
      id: "esign",
      name: "E-Signature",
      status: "connected",
      lastSync: d(0, 8, 40),
      ok: 88,
      fail: 0,
      log: [{ at: d(0, 8, 40), level: "info", text: "ส่งเอกสารลงนาม 2 ฉบับ" }],
      mapping: [
        ["envelope_id", "booking.esign.ref"],
        ["signer_email", "customer.email"],
      ],
    },
    {
      id: "loyalty",
      name: "Loyalty",
      status: "error",
      lastSync: d(-1, 11),
      ok: 1520,
      fail: 12,
      log: [
        { at: d(-1, 11), level: "error", text: "HTTP 503 Service Unavailable (จำลอง)" },
        { at: d(-1, 10), level: "info", text: "Sync ยอด Point 15 ราย" },
      ],
      mapping: [
        ["member_id", "customer.loyaltyId"],
        ["balance", "customer.extPoints"],
      ],
    },
    {
      id: "amlo",
      name: "AMLO",
      status: "error",
      lastSync: d(0, 10),
      ok: 302,
      fail: 4,
      log: [{ at: d(0, 10), level: "error", text: "Timeout 30s (จำลอง)" }],
      mapping: [
        ["citizen_id", "customer.idCard"],
        ["result_code", "booking.amlo.status"],
      ],
    },
    {
      id: "erp",
      name: "ระบบบัญชี / ERP",
      status: "connected",
      lastSync: d(0, 6),
      ok: 940,
      fail: 2,
      log: [{ at: d(0, 6), level: "info", text: "นำเข้าสถานะชำระเงิน 18 รายการ" }],
      mapping: [
        ["invoice_no", "booking.docs.receipt"],
        ["paid_amount", "booking.paid"],
      ],
    },
    {
      id: "stocksrc",
      name: "แหล่งข้อมูลสต็อกภายนอก",
      status: "disconnected",
      lastSync: d(-3, 6),
      ok: 410,
      fail: 0,
      log: [{ at: d(-3, 6), level: "info", text: "นำเข้ารถ 6 คัน (ข้อมูลซ้ำ 1 รายการ)" }],
      mapping: [
        ["vin", "vehicle.vin"],
        ["model_desc", "vehicle.model"],
        ["dealer_code", "vehicle.branchId"],
      ],
    },
  ];

  return {
    branches,
    sales,
    vehicles,
    customers,
    bookings,
    tasks,
    serviceOrders,
    plates,
    commissions,
    loyaltyTx,
    audit,
    notices,
    integrations,
    loyaltyConfig: {
      version: "v1.1",
      status: "approved",
      editor: "พิมพ์ชนก สะสมแต้ม",
      at: d(-30),
      bahtPerPoint: 100,
      excludeItems: "ค่าจดทะเบียน, ประกันภัย, อุปกรณ์เสริม",
      tierMult: { Silver: 1, Gold: 1.25, Platinum: 1.5 },
      campaignMult: 1,
      rounding: "floor",
      cap: 100000,
      pointValue: 1,
      maxBurnPct: 10,
      start: d(-30),
      end: d(335),
      history: [
        { version: "v1.0", editor: "พิมพ์ชนก สะสมแต้ม", at: d(-120), note: "สูตรเริ่มต้น" },
        {
          version: "v1.1",
          editor: "พิมพ์ชนก สะสมแต้ม",
          at: d(-30),
          note: "เพิ่มตัวคูณ Platinum เป็น 1.5",
        },
      ],
    },
    roles: seedRoles(),
    rules: [
      {
        id: "R1",
        event: "Booking ใกล้หมดอายุ",
        offsetDays: -2,
        recipients: "Sales ผู้ดูแล, Branch Manager",
        frequency: "วันละครั้ง",
        enabled: true,
      },
      {
        id: "R2",
        event: "นัด Test Drive",
        offsetDays: 0,
        recipients: "Sales ผู้ดูแล",
        frequency: "ครั้งเดียว",
        enabled: true,
      },
      {
        id: "R3",
        event: "นัดส่งมอบรถ",
        offsetDays: -1,
        recipients: "Sales, Service Officer",
        frequency: "ครั้งเดียว",
        enabled: true,
      },
      {
        id: "R4",
        event: "ป้ายแดงครบกำหนด",
        offsetDays: 30,
        recipients: "Sales ผู้ดูแล, Stock Officer",
        frequency: "ทุก 3 วัน",
        enabled: true,
      },
      {
        id: "R5",
        event: "Loyalty Sync ล้มเหลว",
        offsetDays: 0,
        recipients: "Loyalty Administrator",
        frequency: "ทันที",
        enabled: true,
      },
      {
        id: "R6",
        event: "Commission รอตรวจสอบ",
        offsetDays: 2,
        recipients: "Branch Manager, Finance",
        frequency: "วันละครั้ง",
        enabled: false,
      },
    ],
    transfers: [
      {
        id: "TR-01",
        vehicleId: "V23",
        from: "B2",
        to: "B3",
        reason: "ลูกค้าเชียงใหม่ต้องการรุ่นนี้",
        by: "ประเสริฐ คลังดี",
        approver: "ณัฐพล รุ่งเรือง",
        at: d(-3),
        status: "moving",
      },
    ],
    plateFollowDays: 30,
  };
}

function seedAt<T>(rows: T[], index: number): T {
  const row = rows[index];
  if (row === undefined) throw new Error(`Missing demo seed record at ${index}`);
  return row;
}
