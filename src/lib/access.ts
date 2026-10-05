import type { RoleId, RolePerm } from "./mock/types";
export function visibleNotice(
  n: { branchId: string; assignee: string; recipientRoles?: RoleId[] | undefined },
  roleId: RoleId,
  salesId?: string,
) {
  if (n.recipientRoles && roleId !== "admin" && !n.recipientRoles.includes(roleId)) return false;
  return roleId !== "sales" || n.assignee === salesId;
}
export function recordInScope(
  role: RolePerm,
  allowedBranches: string[],
  branch: string,
  salesId: string | undefined,
  record: { branchId: string; salesId?: string },
) {
  if (!allowedBranches.includes(record.branchId)) return false;
  if (branch !== "all" && branch !== record.branchId) return false;
  if (role.scope === "own" && record.salesId && salesId && record.salesId !== salesId) return false;
  return true;
}
