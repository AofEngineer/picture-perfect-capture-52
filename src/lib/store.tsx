import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createSeed, DEMO_USERS } from "./mock/seed";
import type { Action, AuditEntry, DemoState, MenuKey, RoleId } from "./mock/types";
import { recordInScope } from "./access";
import { cleanDisplayLabels } from "./display-labels";

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
  mutate: (
    fn: (draft: DemoState) => void,
    audit?: Omit<AuditEntry, "id" | "at" | "actor" | "role" | "ref"> & { ref?: string | undefined },
  ) => void;
  reset: () => void;
  branchName: (id: string) => string;
  salesName: (id: string) => string;
}

const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState>(() => createSeed());
  const stateRef = useRef(state);
  const commit = useCallback((next: DemoState) => {
    stateRef.current = next;
    setState(next);
  }, []);
  const [roleId, setRoleId] = useState<RoleId>("admin");
  const [branch, setBranch] = useState("all");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p.state && Array.isArray(p.state.roles) && Array.isArray(p.state.bookings)) {
          const restored = cleanDisplayLabels({ ...createSeed(), ...p.state } as DemoState);
          for (const booking of restored.bookings) {
            const burn = restored.loyaltyTx.find(
              (t) =>
                t.bookingId === booking.id &&
                t.type === "Burn" &&
                t.status === "Success" &&
                t.points > 0,
            );
            booking.pointValue ??= burn
              ? burn.value / burn.points
              : restored.loyaltyConfig.pointValue;
            booking.formulaVersion ??= burn?.formulaVersion ?? restored.loyaltyConfig.version;
          }
          commit(restored);
        }
        if (p.roleId && DEMO_USERS[p.roleId]) {
          setRoleId(p.roleId);
          const savedRole = stateRef.current.roles.find((r) => r.id === p.roleId)!;
          const branches =
            savedRole.scope === "all"
              ? stateRef.current.branches.map((b) => b.id)
              : savedRole.branches;
          setBranch(
            branches.includes(p.branch) ? p.branch : branches.length === 1 ? branches[0]! : "all",
          );
        }
      }
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, [commit]);

  useEffect(() => {
    if (loaded) {
      try {
        localStorage.setItem(KEY, JSON.stringify({ state, roleId, branch }));
      } catch {
        /* Demo can continue in memory when storage is unavailable. */
      }
    }
  }, [state, roleId, branch, loaded]);

  const role =
    state.roles.find((r) => r.id === roleId) ?? state.roles.find((r) => r.id === "admin")!;
  const demoUser = DEMO_USERS[roleId]!;
  const user = { ...demoUser, roleName: role.name };
  const allowedBranches = role.scope === "all" ? state.branches.map((b) => b.id) : role.branches;

  const can = useCallback(
    (menu: MenuKey, action: Action = "view") => !!role.menus[menu]?.includes(action),
    [role],
  );

  const inScope = useCallback(
    (r: { branchId: string; salesId?: string }) => {
      return recordInScope(role, allowedBranches, branch, demoUser.salesId, r);
    },
    [allowedBranches, branch, role, demoUser.salesId],
  );

  const mutate: Ctx["mutate"] = useCallback(
    (fn, audit) => {
      const draft = structuredClone(stateRef.current);
      fn(draft);
      if (audit) {
        draft.audit.unshift({
          id: `A-${String(draft.audit.length + 1).padStart(4, "0")}`,
          at: new Date().toISOString(),
          actor: demoUser.name,
          role: role.name,
          ...audit,
          ref: audit.ref ?? `AUD-${Date.now().toString(36).toUpperCase()}`,
        });
      }
      commit(draft);
    },
    [demoUser.name, role.name, commit],
  );

  const setRole = (r: RoleId) => {
    const prevName = role.name;
    setRoleId(r);
    const next = state.roles.find((x) => x.id === r)!;
    setBranch(next.scope !== "all" && next.branches.length === 1 ? next.branches[0]! : "all");
    const prev = stateRef.current;
    commit({
      ...prev,
      audit: [
        {
          id: `A-${String(prev.audit.length + 1).padStart(4, "0")}`,
          at: new Date().toISOString(),
          actor: "ระบบ",
          role: "Role Switcher",
          branchId: "B1",
          action: "สลับบทบาท",
          entity: "Role",
          entityId: r,
          before: prevName,
          after: next.name,
          ref: `AUD-${Date.now().toString(36).toUpperCase()}`,
        },
        ...prev.audit,
      ],
    });
  };

  const value: Ctx = {
    state,
    roleId,
    setRole,
    branch,
    setBranch,
    user,
    can,
    sensitive: role.sensitive,
    allowedBranches,
    inScope,
    mutate,
    reset: () => {
      commit(createSeed());
      setRoleId("admin");
      setBranch("all");
    },
    branchName: (id) => state.branches.find((b) => b.id === id)?.name ?? id,
    salesName: (id) => state.sales.find((s) => s.id === id)?.name ?? id,
  };

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error("useStore outside provider");
  return c;
}
