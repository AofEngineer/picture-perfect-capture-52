import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Inbox, Search, Check, FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/* ---------- Status badge: always text + icon dot, never color alone ---------- */
export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "dark";
const toneCls: Record<Tone, string> = {
  neutral: "bg-secondary text-secondary-foreground border-border",
  info: "bg-accent text-accent-foreground border-primary/20",
  success: "bg-success/10 text-success border-success/25",
  warning: "bg-warning/15 text-warning-foreground border-warning/40",
  danger: "bg-destructive/10 text-destructive border-destructive/25",
  dark: "bg-foreground text-background border-foreground",
};
const toneDot: Record<Tone, string> = {
  neutral: "bg-muted-foreground", info: "bg-primary", success: "bg-success", warning: "bg-warning", danger: "bg-destructive", dark: "bg-background",
};
export function StatusBadge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm border px-2 py-0.5 text-xs font-medium", toneCls[tone], className)}>
      <span className={cn("size-1.5 rounded-full", toneDot[tone])} aria-hidden />
      {children}
    </span>
  );
}

export function DemoTag({ label = "ข้อมูลจำลอง / Demo", className }: { label?: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-sm border border-demo-foreground/20 bg-demo px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-demo-foreground", className)}>
      <FlaskConical className="size-3" /> {label}
    </span>
  );
}

export function PageHeader({ title, subtitle, actions, demo }: { title: string; subtitle?: string; actions?: ReactNode; demo?: boolean }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {demo && <DemoTag />}
        </div>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, actions, children, className, bodyClass }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={cn("rounded-md border bg-card shadow-card", className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b px-5 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          {actions}
        </header>
      )}
      <div className={cn("p-5", bodyClass)}>{children}</div>
    </section>
  );
}

export function Kpi({ label, value, hint, icon, tone = "neutral", onClick }: { label: string; value: ReactNode; hint?: string; icon?: ReactNode; tone?: Tone; onClick?: () => void }) {
  return (
    <button onClick={onClick} className={cn("group relative overflow-hidden rounded-md border bg-card p-4 text-left shadow-card transition hover:border-primary/50", onClick && "cursor-pointer")}>
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className={cn("rounded-sm p-1.5", tone === "danger" ? "bg-destructive/10 text-destructive" : tone === "warning" ? "bg-warning/15 text-warning-foreground" : "bg-accent text-accent-foreground")}>{icon}</span>
      </div>
      <div className="mt-2 text-3xl font-semibold tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      <span className="absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 bg-primary transition group-hover:scale-x-100" />
    </button>
  );
}

export function EmptyState({ title = "ไม่พบข้อมูล", hint = "ลองปรับเงื่อนไขการค้นหาหรือตัวกรอง" }: { title?: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Inbox className="size-10 text-muted-foreground/50" />
      <p className="mt-3 text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

/* ---------- Data table with search / sort / pagination ---------- */
export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  sort?: (row: T) => string | number;
  className?: string;
}
export function DataTable<T>({
  rows, columns, searchText, onRowClick, pageSize = 10, toolbar, placeholder = "ค้นหา...", emptyTitle,
}: {
  rows: T[];
  columns: Column<T>[];
  searchText?: (row: T) => string;
  onRowClick?: (row: T) => void;
  pageSize?: number;
  toolbar?: ReactNode;
  placeholder?: string;
  emptyTitle?: string;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    let r = rows;
    if (q && searchText) {
      const s = q.toLowerCase();
      r = r.filter((x) => searchText(x).toLowerCase().includes(s));
    }
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col?.sort) r = [...r].sort((a, b) => (col.sort!(a) > col.sort!(b) ? 1 : col.sort!(a) < col.sort!(b) ? -1 : 0) * sort.dir);
    }
    return r;
  }, [rows, q, sort, columns, searchText]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const cur = Math.min(page, pages - 1);
  const slice = filtered.slice(cur * pageSize, cur * pageSize + pageSize);

  return (
    <div className="rounded-md border bg-card shadow-card">
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        {searchText && (
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder={placeholder} className="h-9 pl-8" />
          </div>
        )}
        {toolbar}
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} รายการ</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/60 text-left text-xs text-muted-foreground">
              {columns.map((c) => (
                <th key={c.key} className={cn("whitespace-nowrap px-3 py-2.5 font-medium", c.className)}>
                  {c.sort ? (
                    <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === 1 ? -1 : 1 } : { key: c.key, dir: 1 }))}>
                      {c.header}
                      {sort?.key === c.key ? sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : <ArrowUpDown className="size-3 opacity-40" />}
                    </button>
                  ) : c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((r, i) => (
              <tr key={i} onClick={() => onRowClick?.(r)} className={cn("border-b last:border-0 transition-colors hover:bg-accent/50", onRowClick && "cursor-pointer")}>
                {columns.map((c) => <td key={c.key} className={cn("px-3 py-2.5 align-middle", c.className)}>{c.cell(r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        {slice.length === 0 && <EmptyState title={emptyTitle} />}
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 border-t p-2 text-xs">
          <span className="text-muted-foreground">หน้า {cur + 1} / {pages}</span>
          <Button size="icon" variant="ghost" className="size-7" disabled={cur === 0} onClick={() => setPage(cur - 1)}><ChevronLeft className="size-4" /></Button>
          <Button size="icon" variant="ghost" className="size-7" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}><ChevronRight className="size-4" /></Button>
        </div>
      )}
    </div>
  );
}

export function FilterSelect({ value, onChange, options, placeholder, className }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder: string; className?: string }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn("h-9 w-40", className)}><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{placeholder}: ทั้งหมด</SelectItem>
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

/* ---------- Workflow stepper ---------- */
export function WorkflowStepper({ steps, current, blocked, compact }: { steps: string[]; current: number; blocked?: boolean; compact?: boolean }) {
  return (
    <ol className="flex w-full items-start">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s} className="relative flex flex-1 flex-col items-center text-center">
            {i > 0 && <span className={cn("absolute right-1/2 top-3.5 h-0.5 w-full -translate-y-1/2", done || active ? "bg-primary" : "bg-border")} />}
            <span className={cn("relative z-10 flex size-7 items-center justify-center rounded-full border-2 text-xs font-semibold",
              done ? "border-primary bg-primary text-primary-foreground" : active ? blocked ? "border-destructive bg-card text-destructive" : "border-primary bg-card text-primary" : "border-border bg-card text-muted-foreground")}>
              {done ? <Check className="size-3.5" /> : i + 1}
            </span>
            {!compact && <span className={cn("mt-2 px-1 text-[11px] leading-tight", active ? "font-semibold text-foreground" : "text-muted-foreground")}>{s}</span>}
          </li>
        );
      })}
    </ol>
  );
}

/* ---------- Detail drawer ---------- */
export function DetailDrawer({ open, onOpenChange, title, description, children }: { open: boolean; onOpenChange: (o: boolean) => void; title: ReactNode; description?: ReactNode; children: ReactNode }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="mt-4 space-y-4 px-4 pb-6">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-medium">{children}</div>
    </div>
  );
}

export function Timeline({ items }: { items: { at: string; title: string; sub?: string }[] }) {
  if (!items.length) return <EmptyState title="ยังไม่มีประวัติ" hint="" />;
  return (
    <ol className="space-y-3 border-l pl-4">
      {items.map((it, i) => (
        <li key={i} className="relative">
          <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full border-2 border-primary bg-card" />
          <div className="text-sm">{it.title}</div>
          <div className="text-xs text-muted-foreground">{it.sub}</div>
        </li>
      ))}
    </ol>
  );
}
