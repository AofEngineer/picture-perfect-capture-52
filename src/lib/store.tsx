import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createSeed, DEMO_USERS } from "./mock/seed";
import type { Action, AuditEntry, DemoState, MenuKey, RoleId } from "./mock/types";

const KEY = "autodrive-dms-demo-v1";

interface Ctx {
  state: DemoState;
  roleId: RoleId;
  setRole: (r: RoleId) => void;
  branch: string; // "all" | branchId
  setBranch: (b: string) => void;
  user: { name: string; salesId?: string; roleName: string };
  can: (menu: MenuKey, action?: Action) => boolean;
  sensitive: boolean;
  allowedBranches: string[];
  inScope: (r: { branchId: string; salesId?: string }) => boolean;
  mutate: (fn: (draft: DemoState) => void, audit?: Omit<AuditEntry, "id" | "at" | "actor" | "role" | "ref"> & { ref?: string }) => void;
  reset: () => void;
  branchName: (id: string) => string;
  salesName: (id: string) => string;
}

const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState>(() => createSeed());
  const [roleId, setRoleId] = useState<RoleId>("admin");
  const [branch, setBranch] = useState("all");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p.state) setState(p.state);
        if (p.roleId) setRoleId(p.roleId);
        if (p.branch) setBranch(p.branch);
      }
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(KEY, JSON.stringify({ state, roleId, branch }));
  }, [state, roleId, branch, loaded]);

  const role = state.roles.find((r) => r.id === roleId)!;
  const demoUser = DEMO_USERS[roleId];
  const user = { ...demoUser, roleName: role.name };
  const allowedBranches = role.scope === "all" ? state.branches.map((b) => b.id) : role.branches;

  const can = useCallback((menu: MenuKey, action: Action = "view") => !!role.menus[menu]?.includes(action), [role]);

  const inScope = useCallback(
    (r: { branchId: string; salesId?: string }) => {
      if (!allowedBranches.includes(r.branchId)) return false;
      if (branch !== "all" && r.branchId !== branch) return false;
      if (role.scope === "own" && r.salesId && demoUser.salesId && r.salesId !== demoUser.salesId) return false;
      return true;
    },
    [allowedBranches, branch, role.scope, demoUser.salesId],
  );

  const mutate: Ctx["mutate"] = useCallback(
    (fn, audit) => {
      setState((prev) => {
        const draft = structuredClone(prev);
        fn(draft);
        if (audit) {
          draft.audit.unshift({
            id: `A-${String(draft.audit.length + 1).padStart(4, "0")}`,
            at: new Date().toISOString(),
            actor: demoUser.name,
            role: role.name,
            ref: audit.ref ?? `AUD-DEMO-${Date.now().toString(36).toUpperCase()}`,
            ...audit,
          });
        }
        return draft;
      });
    },
    [demoUser.name, role.name],
  );

  const setRole = (r: RoleId) => {
    const prevName = role.name;
    setRoleId(r);
    setBranch("all");
    const next = state.roles.find((x) => x.id === r)!;
    setState((prev) => ({
      ...prev,
      audit: [
        { id: `A-${String(prev.audit.length + 1).padStart(4, "0")}`, at: new Date().toISOString(), actor: "Demo", role: "Demo Role Switcher", branchId: "B1", action: "สลับบทบาท (Demo)", entity: "Role", entityId: r, before: prevName, after: next.name, ref: `AUD-DEMO-${Date.now().toString(36).toUpperCase()}` },
        ...prev.audit,
      ],
    }));
  };

  const value = useMemo<Ctx>(
    () => ({
      state, roleId, setRole, branch, setBranch, user, can, sensitive: role.sensitive, allowedBranches, inScope, mutate,
      reset: () => { setState(createSeed()); setRoleId("admin"); setBranch("all"); },
      branchName: (id) => state.branches.find((b) => b.id === id)?.name ?? id,
      salesName: (id) => state.sales.find((s) => s.id === id)?.name ?? id,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, roleId, branch, can, inScope, mutate],
  );

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error("useStore outside provider");
  return c;
}
