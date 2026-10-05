import type { DocumentAnalysis } from "@/lib/ai/types";

export type RoleId =
  "sales" | "manager" | "stock" | "service" | "finance" | "loyalty" | "admin" | "auditor";

export type MenuKey =
  | "dashboard"
  | "booking"
  | "customer"
  | "stock"
  | "sales"
  | "reports"
  | "integrations"
  | "loyalty"
  | "access"
  | "audit"
  | "notifications";

export type Action = "view" | "create" | "edit" | "approve" | "export";
export type Scope = "own" | "branch" | "all";

export interface RolePerm {
  id: RoleId;
  name: string;
  scope: Scope;
  branches: string[];
  sensitive: boolean; // can see cost / margin / full PII
  menus: Partial<Record<MenuKey, Action[]>>;
}

export interface Branch {
  id: string;
  name: string;
  short: string;
}
export interface SalesPerson {
  id: string;
  code: string;
  name: string;
  branchId: string;
  target: number;
  phone: string;
}

export type StockStatus = "available" | "reserved" | "incoming" | "transfer" | "prep" | "sold";
export interface Vehicle {
  id: string;
  code: string;
  model: string;
  body: "sedan" | "suv" | "ev";
  color: string;
  year: number;
  vin: string;
  branchId: string;
  cost: number;
  price: number;
  receivedAt: string;
  branchSince: string;
  status: StockStatus;
  ready: boolean;
  readyNote?: string | undefined;
  expectedAt?: string | undefined;
  bonus?: { amount: number; condition: string; until: string } | undefined;
  releaseEvent?: { at: string; reason: string } | undefined;
  history: { at: string; text: string }[];
}

export type Tier = "Silver" | "Gold" | "Platinum";
export interface Customer {
  id: string;
  name: string;
  phone: string;
  idCard: string;
  email: string;
  salesId: string;
  branchId: string;
  tier: Tier;
  loyaltyId: string;
  points: number;
  extPoints: number;
  pointsExpiring: number;
  lastSync: string;
  visits: { at: string; text: string }[];
  contacts: { at: string; text: string }[];
}

export type AmloStatus = "none" | "checking" | "clear" | "review" | "error";
export type EsignStatus = "draft" | "pending" | "partial" | "done" | "expired";
export type BookingStatus = "active" | "expired" | "closed" | "cancelled";

export interface Refund {
  id: string;
  branch: "A" | "B" | "C" | "D" | "E";
  step: number; // 0..5
  requestedAt: string;
  amount: number;
  deduction: number;
  deductionNote?: string | undefined;
  pointsReturn: number;
  reason: string;
  status: "pending" | "approved" | "rejected" | "paid" | "closed";
  branchId: string;
  channel?: string;
  evidence?: string;
  approver?: string;
  history: { at: string; by: string; text: string }[];
}

export interface Booking {
  id: string;
  customerId: string;
  vehicleId: string;
  salesId: string;
  branchId: string;
  createdAt: string;
  deposit: number;
  price: number;
  expiresAt: string;
  deliveryAt?: string | undefined;
  step: number; // 0..7 index of workflow
  status: BookingStatus;
  expireReason?: string | undefined;
  releaseState?: "awaiting" | "released" | undefined;
  amlo: { status: AmloStatus; at?: string | undefined; ref?: string | undefined };
  ocr: {
    confirmed: boolean;
    by?: string | undefined;
    at?: string | undefined;
    fields?: { k: string; v: string; conf: number }[] | undefined;
    analysis?: DocumentAnalysis | undefined;
    documents?: DocumentAnalysis[] | undefined;
  };
  esign: {
    status: EsignStatus;
    signers: { name: string; role: string; signedAt?: string | undefined }[];
  };
  pointsUsed: number;
  pointValue?: number | undefined;
  formulaVersion?: string | undefined;
  paid: number;
  refund?: Refund | undefined;
  docs: { type: string; version: number; at: string; by: string }[];
  history: { at: string; by: string; text: string }[];
}

export type TaskStatus = "todo" | "doing" | "waiting" | "done" | "overdue";
export interface Task {
  id: string;
  type: "testdrive" | "delivery" | "docs" | "payment" | "plate" | "prep";
  title: string;
  date: string;
  customerId?: string | undefined;
  bookingId?: string | undefined;
  vehicleId?: string | undefined;
  serviceOrderId?: string | undefined;
  assignee: string;
  branchId: string;
  status: TaskStatus;
  step?: number | undefined;
}

export interface ServiceOrder {
  id: string;
  vehicleId: string;
  branchId: string;
  type: string;
  assignee: string;
  due: string;
  status: "todo" | "doing" | "done" | "overdue";
  items: {
    name: string;
    done: boolean;
    doneAt?: string | undefined;
    note?: string | undefined;
    checker?: string | undefined;
  }[];
}

export type PlateStatus = "available" | "matched" | "lost" | "transfer" | "checking";
export interface RedPlate {
  id: string;
  number: string;
  branchId: string;
  status: PlateStatus;
  bookingId?: string | undefined;
  borrowedAt?: string | undefined;
  registeredAt?: string | undefined;
  lastContact?: string | undefined;
  follow?: string | undefined;
  appointment?: string | undefined;
  ownerBranchId?: string | undefined;
  province?: string | undefined;
  previousBookingId?: string | undefined;
  transferTo?: string | undefined;
  history?: { at: string; by: string; text: string }[] | undefined;
}

export type CommissionStatus =
  "draft" | "submitted" | "mgr_review" | "fin_review" | "approved" | "paid" | "rejected";
export interface Commission {
  id: string;
  bookingId: string;
  salesId: string;
  base: number;
  rate: number;
  bonus: number;
  adjust: number;
  status: CommissionStatus;
  note?: string | undefined;
  claimNo?: string | undefined;
  paidAt?: string | undefined;
  bonusCondition?: string | undefined;
  history?: { at: string; by: string; text: string }[] | undefined;
}

export interface LoyaltyTx {
  id: string;
  customerId: string;
  bookingId?: string | undefined;
  type: "Earn" | "Burn" | "Adjust" | "Reverse";
  points: number;
  value: number;
  status: "Pending" | "Success" | "Failed" | "Reversed";
  ref: string;
  at: string;
  match: "matched" | "mismatch" | "pending";
  formulaVersion: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  role: string;
  branchId: string;
  action: string;
  entity: string;
  entityId: string;
  before?: string | undefined;
  after?: string | undefined;
  reason?: string | undefined;
  ref: string;
}

export interface Notice {
  id: string;
  type: string;
  title: string;
  detail: string;
  link: string;
  branchId: string;
  assignee: string;
  at: string;
  priority: "high" | "medium" | "low";
  read: boolean;
  eventKey?: string | undefined;
  recipientRoles?: RoleId[] | undefined;
}

export interface Integration {
  id: string;
  name: string;
  status: "connected" | "disconnected" | "error";
  lastSync: string;
  ok: number;
  fail: number;
  log: { at: string; level: "info" | "error"; text: string }[];
  mapping: [string, string][];
}

export interface LoyaltyConfig {
  version: string;
  status: "approved" | "pending";
  editor: string;
  at: string;
  bahtPerPoint: number;
  excludeItems: string;
  tierMult: Record<Tier, number>;
  campaignMult: number;
  rounding: "floor" | "round" | "ceil";
  cap: number;
  pointValue: number; // baht per point when burning
  maxBurnPct: number;
  start: string;
  end: string;
  history: { version: string; editor: string; at: string; note: string }[];
}

export interface NotifyRule {
  id: string;
  event: string;
  offsetDays: number;
  recipients: string;
  frequency: string;
  enabled: boolean;
}

export interface DemoState {
  branches: Branch[];
  sales: SalesPerson[];
  vehicles: Vehicle[];
  customers: Customer[];
  bookings: Booking[];
  tasks: Task[];
  serviceOrders: ServiceOrder[];
  plates: RedPlate[];
  commissions: Commission[];
  loyaltyTx: LoyaltyTx[];
  audit: AuditEntry[];
  notices: Notice[];
  integrations: Integration[];
  loyaltyConfig: LoyaltyConfig;
  loyaltyDraft?: LoyaltyConfig | undefined;
  roles: RolePerm[];
  rules: NotifyRule[];
  transfers: {
    id: string;
    vehicleId: string;
    from: string;
    to: string;
    reason: string;
    by: string;
    approver?: string | undefined;
    at: string;
    status: "request" | "approved" | "moving" | "received" | "cancelled";
  }[];
  plateFollowDays: number;
}
