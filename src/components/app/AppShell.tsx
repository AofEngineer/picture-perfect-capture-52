import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  CalendarCheck,
  Users,
  Car,
  BadgeDollarSign,
  BarChart3,
  Plug,
  Gift,
  ShieldCheck,
  ScrollText,
  BellRing,
  Bell,
  Search,
  ChevronRight,
  RotateCcw,
  PanelLeftClose,
  PanelLeft,
  Lock,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import type { MenuKey, RoleId } from "@/lib/mock/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { StatusBadge } from "./ui-kit";
import { thDateTime } from "@/lib/format";
import { toast } from "sonner";
import { visibleNotice } from "@/lib/access";
import { AIChatAssistant } from "./AIChatAssistant";

type Item = {
  key: MenuKey;
  label: string;
  to: string;
  icon: typeof Car;
  children?: { label: string; to: string }[];
};

const MAIN: Item[] = [
  { key: "dashboard", label: "Dashboard", to: "/", icon: LayoutDashboard },
  {
    key: "booking",
    label: "Booking",
    to: "/bookings",
    icon: CalendarCheck,
    children: [
      { label: "รายการจอง", to: "/bookings" },
      { label: "คืนเงินจอง", to: "/bookings/refunds" },
    ],
  },
  { key: "customer", label: "Customer", to: "/customers", icon: Users },
  {
    key: "stock",
    label: "Stock",
    to: "/stock",
    icon: Car,
    children: [
      { label: "Vehicle Inventory", to: "/stock" },
      { label: "Sales Stock Check", to: "/stock/check" },
      { label: "Stock Operations", to: "/stock/operations" },
      { label: "Service Orders", to: "/stock/service-orders" },
      { label: "Red Plate Management", to: "/stock/red-plates" },
    ],
  },
  {
    key: "sales",
    label: "Sales",
    to: "/sales",
    icon: BadgeDollarSign,
    children: [
      { label: "รายชื่อ Sales", to: "/sales" },
      { label: "Commission", to: "/sales/commission" },
    ],
  },
];
const ADMIN: Item[] = [
  { key: "reports", label: "Reports", to: "/admin/reports", icon: BarChart3 },
  { key: "integrations", label: "Integrations", to: "/admin/integrations", icon: Plug },
  { key: "loyalty", label: "Loyalty Configuration", to: "/admin/loyalty", icon: Gift },
  { key: "access", label: "Access Control", to: "/admin/access", icon: ShieldCheck },
  { key: "audit", label: "Audit Log", to: "/admin/audit", icon: ScrollText },
  {
    key: "notifications",
    label: "Notification Settings",
    to: "/admin/notifications",
    icon: BellRing,
  },
];

const CRUMB: Record<string, string> = {
  bookings: "Booking",
  refunds: "คืนเงินจอง",
  customers: "Customer",
  stock: "Stock",
  check: "Sales Stock Check",
  operations: "Stock Operations",
  "service-orders": "Service Orders",
  "red-plates": "Red Plate Management",
  sales: "Sales",
  commission: "Commission",
  admin: "Administration",
  reports: "Reports",
  integrations: "Integrations",
  loyalty: "Loyalty Configuration",
  access: "Access Control",
  audit: "Audit Log",
  notifications: "Notification Settings",
  inbox: "Notification Center",
  new: "สร้างใหม่",
};

export function menuForPath(path: string): MenuKey {
  const seg = path.split("/").filter(Boolean);
  if (!seg.length) return "dashboard";
  const map: Record<string, MenuKey> = {
    bookings: "booking",
    customers: "customer",
    stock: "stock",
    sales: "sales",
    inbox: "dashboard",
  };
  if (seg[0] === "admin") return (seg[1] as MenuKey) ?? "dashboard";
  return map[seg[0] ?? ""] ?? "dashboard";
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { can, roleId, setRole, state, branch, setBranch, allowedBranches, user, reset, inScope } =
    useStore();
  const [collapsed, setCollapsed] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  const menu = menuForPath(path);
  const allowed = can(menu);
  const myNotices = state.notices.filter(
    (n) => inScope({ branchId: n.branchId }) && visibleNotice(n, roleId, user.salesId),
  );
  const unread = myNotices.filter((n) => !n.read).length;

  const segs = path.split("/").filter(Boolean);

  const NavItem = ({ it }: { it: Item }) => {
    const active = it.to === "/" ? path === "/" : path.startsWith(it.to);
    return (
      <li>
        <Link
          to={it.to}
          className={cn(
            "group flex items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors",
            active
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
          )}
        >
          <span
            className={cn(
              "h-4 w-0.5 rounded-full",
              active ? "bg-sidebar-primary" : "bg-transparent",
            )}
          />
          <it.icon className="size-4 shrink-0" />
          {!collapsed && <span className="truncate">{it.label}</span>}
        </Link>
        {!collapsed && active && it.children && (
          <ul className="mb-1 ml-9 mt-1 space-y-0.5 border-l border-sidebar-border pl-3">
            {it.children.map((c) => (
              <li key={c.to}>
                <Link
                  to={c.to}
                  className={cn(
                    "block rounded-sm px-2 py-1.5 text-xs",
                    path === c.to
                      ? "text-sidebar-accent-foreground font-semibold"
                      : "text-sidebar-foreground/70 hover:text-sidebar-accent-foreground",
                  )}
                >
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </li>
    );
  };

  const search = (e: React.FormEvent): void => {
    e.preventDefault();
    const s = q.trim().toLowerCase();
    if (!s) return;
    const b =
      can("booking") && state.bookings.filter(inScope).find((x) => x.id.toLowerCase().includes(s));
    if (b) return void navigate({ to: "/bookings/$id", params: { id: b.id } });
    const c =
      can("customer") &&
      state.customers
        .filter(inScope)
        .find((x) => x.name.toLowerCase().includes(s) || x.phone.includes(s));
    if (c) return void navigate({ to: "/customers/$id", params: { id: c.id } });
    const v =
      can("stock") &&
      state.vehicles
        .filter(inScope)
        .find(
          (x) =>
            x.vin.toLowerCase().includes(s) ||
            x.code.toLowerCase().includes(s) ||
            x.model.toLowerCase().includes(s),
        );
    if (v) return void navigate({ to: "/stock/$id", params: { id: v.id } });
    toast.error("ไม่พบข้อมูลที่ตรงกับคำค้นหา");
  };

  return (
    <div className="flex min-h-screen w-full">
      <aside
        className={cn(
          "no-print sticky top-0 flex h-screen shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-all",
          collapsed ? "w-16" : "w-64",
        )}
      >
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-sidebar-foreground/60">
            <div className="size-4 rounded-full m-stripe" />
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-wide text-sidebar-accent-foreground">
                AUTODRIVE DMS
              </div>
              <div className="text-[10px] uppercase tracking-widest text-sidebar-foreground/60">
                Dealer Management
              </div>
            </div>
          )}
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-4">
          <ul className="space-y-0.5">
            {MAIN.filter((i) => can(i.key)).map((i) => (
              <NavItem key={i.key} it={i} />
            ))}
          </ul>
          {ADMIN.some((i) => can(i.key)) && (
            <>
              {!collapsed && (
                <div className="mb-2 mt-6 px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/50">
                  Administration
                </div>
              )}
              {collapsed && <div className="my-4 border-t border-sidebar-border" />}
              <ul className="space-y-0.5">
                {ADMIN.filter((i) => can(i.key)).map((i) => (
                  <NavItem key={i.key} it={i} />
                ))}
              </ul>
            </>
          )}
        </nav>
        <div className="border-t border-sidebar-border p-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex w-full items-center gap-3 rounded-sm px-3 py-2 text-xs text-sidebar-foreground/70 hover:bg-sidebar-accent"
          >
            {collapsed ? (
              <PanelLeft className="size-4" />
            ) : (
              <>
                <PanelLeftClose className="size-4" /> ย่อเมนู
              </>
            )}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 border-b bg-card">
          <div className="h-0.5 m-stripe" />
          <div className="flex h-14 items-center gap-3 px-6">
            <Select value={branch} onValueChange={setBranch}>
              <SelectTrigger className="h-9 w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allowedBranches.length > 1 && (
                  <SelectItem value="all">ทุกสาขาที่มีสิทธิ์</SelectItem>
                )}
                {state.branches
                  .filter((b) => allowedBranches.includes(b.id))
                  .map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <form onSubmit={search} className="relative mx-auto w-full max-w-md">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ค้นหาเลขจอง ลูกค้า เบอร์โทร VIN..."
                className="h-9 bg-muted pl-9"
              />
            </form>
            <div className="flex items-center gap-2 rounded-sm border border-dashed border-demo-foreground/40 bg-demo/40 px-2 py-1">
              <span className="text-[10px] font-semibold uppercase text-demo-foreground">
                Role Switcher
              </span>
              <Select
                value={roleId}
                onValueChange={(v) => {
                  setRole(v as RoleId);
                  toast.success(`สลับเป็นบทบาท ${state.roles.find((r) => r.id === v)?.name}`);
                }}
              >
                <SelectTrigger className="h-7 w-44 border-0 bg-card text-xs">
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
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" aria-label="การแจ้งเตือน">
                  <Bell className="size-5" />
                  {unread > 0 && (
                    <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                      {unread}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-96 p-0">
                <div className="flex items-center justify-between border-b px-4 py-2.5">
                  <span className="text-sm font-semibold">Notification Center</span>
                  <Link to="/inbox" className="text-xs text-primary hover:underline">
                    ดูทั้งหมด
                  </Link>
                </div>
                <ul className="max-h-96 overflow-y-auto">
                  {myNotices.slice(0, 6).map((n) => (
                    <li
                      key={n.id}
                      className={cn("border-b px-4 py-3 last:border-0", !n.read && "bg-accent/40")}
                    >
                      <Link to={n.link} className="block">
                        <div className="flex items-center gap-2">
                          {!n.read && <span className="size-1.5 rounded-full bg-primary" />}
                          <span className="text-sm font-medium">{n.title}</span>
                          <StatusBadge
                            tone={
                              n.priority === "high"
                                ? "danger"
                                : n.priority === "medium"
                                  ? "warning"
                                  : "neutral"
                            }
                            className="ml-auto"
                          >
                            {n.priority === "high"
                              ? "สูง"
                              : n.priority === "medium"
                                ? "กลาง"
                                : "ต่ำ"}
                          </StatusBadge>
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {n.detail} · {thDateTime(n.at)}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </PopoverContent>
            </Popover>
            <div className="flex items-center gap-2 border-l pl-3">
              <div className="flex size-8 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
                {user.name.slice(0, 2)}
              </div>
              <div className="hidden leading-tight xl:block">
                <div className="text-xs font-semibold">{user.name}</div>
                <div className="text-[11px] text-muted-foreground">{user.roleName}</div>
              </div>
            </div>
          </div>
        </header>

        <div className="no-print flex items-center gap-1 px-6 pt-4 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            หน้าหลัก
          </Link>
          {segs.map((s, i) => (
            <span key={i} className="flex items-center gap-1">
              <ChevronRight className="size-3" />
              <span className={i === segs.length - 1 ? "font-medium text-foreground" : ""}>
                {CRUMB[s] ?? decodeURIComponent(s)}
              </span>
            </span>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                reset();
                toast.success("รีเซ็ตข้อมูล แล้ว");
              }}
            >
              <RotateCcw className="size-3" /> Reset Data
            </Button>
          </div>
        </div>

        <main className="flex-1 px-6 py-5">
          {allowed ? (
            children
          ) : (
            <div className="mx-auto mt-20 max-w-md rounded-md border bg-card p-8 text-center shadow-card">
              <Lock className="mx-auto size-10 text-muted-foreground" />
              <h2 className="mt-4 text-lg font-semibold">ไม่มีสิทธิ์เข้าถึงหน้านี้</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                บทบาท “{user.roleName}” ไม่ได้รับสิทธิ์ดูเมนูนี้ ลองสลับบทบาทด้วย Role Switcher
              </p>
              <Button asChild className="mt-5">
                <Link to="/">กลับหน้า Dashboard</Link>
              </Button>
            </div>
          )}
        </main>
        <AIChatAssistant
          key={`${roleId}:${branch}:${JSON.stringify(state.roles.find((r) => r.id === roleId))}`}
          path={path}
        />
      </div>
    </div>
  );
}
