"use client";

import { ReactNode } from "react";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type ModalSize = "sm" | "md" | "lg" | "xl" | "2xl";

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: "sm:max-w-sm", // ~384px — confirmation dialogs, theme picker
  md: "sm:max-w-md", // ~448px — share popup, simple forms (default)
  lg: "sm:max-w-lg", // ~512px — the Radix Dialog default
  xl: "sm:max-w-xl", // ~576px — interviewer details
  "2xl": "sm:max-w-3xl", // ~768px — multi-step interview creation, upgrade modal
};

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /**
   * Width preset for the dialog content. Defaults to "md" (448px). Use "2xl"
   * for the create-interview wizard which has wide fixed-width inner content.
   * Map of tokens to Tailwind:
   *   sm  → sm:max-w-sm  (~384px)
   *   md  → sm:max-w-md  (~448px) [default]
   *   lg  → sm:max-w-lg  (~512px) [old Radix default]
   *   xl  → sm:max-w-xl  (~576px)
   *   2xl → sm:max-w-3xl (~768px) — for wide forms
   */
  size?: ModalSize;
  /**
   * When `false`, blocks outside-click AND escape-key dismissal. Default `true`
   * lets Radix Dialog handle both natively (focus trap, ARIA, restore focus).
   */
  closeOnOutsideClick?: boolean;
}

/**
 * Modal — thin wrapper around Radix Dialog preserving the legacy
 * `<Modal open onClose>` API. Adds focus trap, ESC handling, ARIA aria-modal,
 * proper backdrop semantics, and (change #4 wave 6) width-presets so wide
 * content like the create-interview wizard no longer escapes the dialog.
 */
export default function Modal({
  open,
  onClose,
  closeOnOutsideClick = true,
  size = "md",
  children,
}: ModalProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        onInteractOutside={
          closeOnOutsideClick ? undefined : (e) => e.preventDefault()
        }
        onEscapeKeyDown={
          closeOnOutsideClick ? undefined : (e) => e.preventDefault()
        }
        className={cn(
          "max-h-[90vh] w-full overflow-y-auto p-6",
          SIZE_CLASSES[size],
        )}
      >
        {children}
      </DialogContent>
    </Dialog>
  );
}
