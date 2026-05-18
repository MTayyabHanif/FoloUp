"use client";

import { ReactNode } from "react";

import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /**
   * When `false`, blocks outside-click AND escape-key dismissal. Default `true`
   * lets Radix Dialog handle both natively (focus trap, ARIA, restore focus).
   */
  closeOnOutsideClick?: boolean;
}

/**
 * Modal — thin wrapper around Radix Dialog preserving the legacy
 * `<Modal open onClose>` API. Replaces the previous custom div-based Modal.
 * Adds focus trap, ESC handling, ARIA aria-modal, and proper backdrop semantics.
 *
 * Caller migration is zero-touch: same prop signature.
 *
 * When `closeOnOutsideClick={false}`, we prevent both onInteractOutside AND
 * onEscapeKeyDown. The two callers that opt in (ChromePicker modal, multi-step
 * interview creation) rely on this to avoid losing form state.
 */
export default function Modal({
  open,
  onClose,
  closeOnOutsideClick = true,
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
        className="p-6"
      >
        {children}
      </DialogContent>
    </Dialog>
  );
}
