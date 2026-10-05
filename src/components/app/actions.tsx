import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import type { Action, DemoState, MenuKey } from "@/lib/mock/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function useDemoAction() {
  const { can, inScope, mutate } = useStore();
  return (
    menu: MenuKey,
    permission: Action,
    entity: string,
    record: { id: string; branchId: string; salesId?: string },
    description: string,
    change: (draft: DemoState) => void,
  ) => {
    try {
      if (!can(menu, permission) || !inScope(record))
        throw new Error("ไม่มีสิทธิ์ดำเนินการกับรายการนี้");
      mutate(change, {
        branchId: record.branchId,
        action: description,
        entity,
        entityId: record.id,
      });
      toast.success(description);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ดำเนินการไม่สำเร็จ");
      return false;
    }
  };
}

export function ConfirmAction({
  children,
  description,
  onConfirm,
  disabled,
  variant = "outline",
}: {
  children: ReactNode;
  description: string;
  onConfirm: () => void;
  disabled?: boolean;
  variant?: "outline" | "default" | "destructive";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant={variant} disabled={disabled} onClick={() => setOpen(true)}>
        {children}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการดำเนินการ</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirm}>ยืนยัน</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
