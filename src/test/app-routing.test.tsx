import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentType, ReactNode } from "react";

import { routeTree } from "@/routeTree.gen";
import { createSeed } from "@/lib/mock/seed";

function renderAt(path: string) {
  const queryClient = new QueryClient();
  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  return render(<RouterProvider router={router} />);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// Exercise routing and the real app shell inside jsdom. The document-level
// html/head/scripts wrapper is verified separately in the browser.
const shellOptions = routeTree.options as typeof routeTree.options & {
  shellComponent?: ComponentType<{ children: ReactNode }> | undefined;
};
const documentShell = shellOptions.shellComponent;
beforeAll(() => {
  shellOptions.shellComponent = ({ children }) => <>{children}</>;
});
afterAll(() => {
  shellOptions.shellComponent = documentShell;
});
beforeEach(() => {
  localStorage.clear();
});
describe("App routing", () => {
  it("opens scoped chat, reports a demo failure and retries without duplicate user messages", async () => {
    renderAt("/");
    const page = within(document.documentElement);
    fireEvent.click(await page.findByRole("button", { name: "เปิด AI Chat Assistant" }));
    fireEvent.click(await page.findByRole("checkbox", { name: "จำลอง Chat Error ครั้งถัดไป" }));
    fireEvent.change(page.getByRole("textbox", { name: "คำถามถึง AI Assistant" }), {
      target: { value: "งานวันนี้มีอะไรบ้าง" },
    });
    fireEvent.click(page.getByRole("button", { name: "ส่งคำถาม" }));
    expect(await page.findByText(/บริการ Chat จำลองขัดข้อง/)).toBeVisible();
    fireEvent.click(page.getByRole("button", { name: "ลองคำถามเดิมอีกครั้ง" }));
    expect(await page.findByText(/พบงานวันนี้ .* รายการที่คุณมีสิทธิ์ดู/)).toBeVisible();
    expect(page.getAllByText("คุณ", { exact: true })).toHaveLength(1);
  });

  it("confirms an OCR sample through human review and persists identity verification", async () => {
    const data = createSeed();
    const b = data.bookings[0]!;
    b.ocr.confirmed = false;
    localStorage.setItem(
      "autodrive-dms-demo-v1",
      JSON.stringify({ state: data, roleId: "admin", branch: "all" }),
    );
    renderAt(`/bookings/${b.id}`);
    const page = within(document.documentElement);
    const docsTab = await page.findByRole("tab", { name: "Customer & Documents" });
    fireEvent.mouseDown(docsTab, { button: 0, ctrlKey: false });
    fireEvent.click(await page.findByRole("button", { name: "ใช้เอกสารตัวอย่าง" }));
    const confirm = await page.findByRole("button", { name: "ตรวจสอบแล้ว — ยืนยันเอกสาร" });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    fireEvent.click(await page.findByRole("button", { name: "ยืนยัน" }));
    expect(await page.findByText(/ยืนยันโดย ผู้ดูแลระบบ/)).toBeVisible();
    const saved = JSON.parse(localStorage.getItem("autodrive-dms-demo-v1")!);
    expect(
      saved.state.bookings.find((booking: { id: string }) => booking.id === b.id).ocr.confirmed,
    ).toBe(true);
  });
  it("renders the index route", async () => {
    renderAt("/");
    expect(
      await within(document.documentElement).findByRole("heading", { name: "สวัสดี, ผู้ดูแลระบบ" }),
    ).toBeVisible();
  });

  it("renders the not-found route", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    renderAt("/this-route-does-not-exist");
    expect(
      await within(document.documentElement).findByRole("heading", { name: "Page not found" }),
    ).toBeVisible();
  });

  it.each([
    ["/customers", "Customer"],
    ["/stock", "Vehicle Inventory"],
    ["/stock/check", "Sales Stock Check"],
    ["/stock/operations", "Stock Operations"],
    ["/stock/service-orders", "Service Orders"],
    ["/stock/red-plates", "Red Plate Management"],
    ["/stock/V01", "BMW 330e M Sport"],
    ["/customers/C01", "คุณกิตติพัฒน์ วงศ์ทอง"],
    ["/sales", "Sales"],
    ["/sales/S1", "สมชาย ใจดี"],
    ["/sales/commission", "Commission"],
    ["/bookings/refunds", "Refund"],
    ["/admin/integrations", "Integrations"],
    ["/admin/access", "Access Control"],
    ["/admin/loyalty", "Loyalty Configuration"],
    ["/admin/reports", "Reports"],
    ["/admin/audit", "Audit Log"],
    ["/admin/notifications", "Notification Settings"],
    ["/inbox", "Notification Center"],
  ])("renders the completed route %s", async (path, title) => {
    renderAt(path!);
    expect(
      await within(document.documentElement).findByRole("heading", { name: title! }),
    ).toBeVisible();
  });

  it("denies a Sales direct link to another branch's customer", async () => {
    localStorage.setItem(
      "autodrive-dms-demo-v1",
      JSON.stringify({ state: createSeed(), roleId: "sales", branch: "all" }),
    );
    renderAt("/customers/C03");
    expect(
      await within(document.documentElement).findByText("ไม่พบลูกค้าหรือไม่มีสิทธิ์ดูข้อมูล"),
    ).toBeVisible();
    expect(
      within(document.documentElement).queryByRole("heading", { name: "คุณธีรวัฒน์ แสงอรุณ" }),
    ).toBeNull();
  });
});
