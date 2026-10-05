/** Normalize labels from previously saved records while preserving provider enums. */
export function cleanDisplayLabels<T>(value: T): T {
  const visit = (item: unknown, key = ""): unknown => {
    if (typeof item === "string") {
      if (key === "provider") return item;
      if (/^demo$/i.test(item)) return "ระบบ";
      return item
        .replace(/Demo Role Switcher/gi, "Role Switcher")
        .replace(/Reset Demo Data/gi, "Reset Data")
        .replace(/\s*\(Demo\)/gi, "")
        .replace(/\s*·\s*Demo/gi, "")
        .replace(/-DEMO(?=-|$)/gi, "")
        .replace(/\bdemo(?=\d)/gi, "customer")
        .replace(/\bDemo\s+/gi, "")
        .replace(/\s+Demo\b/gi, "");
    }
    if (Array.isArray(item)) return item.map((entry) => visit(entry));
    if (item && typeof item === "object")
      return Object.fromEntries(Object.entries(item).map(([k, v]) => [k, visit(v, k)]));
    return item;
  };
  return visit(value) as T;
}
