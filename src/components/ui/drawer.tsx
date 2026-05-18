"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Drawer — side panel sliding in from the right (or left). Built on the
 * already-installed @radix-ui/react-dialog so we inherit focus trap, ESC
 * handling, and ARIA semantics for free.
 *
 * Use for: detail panels that supplement a list view (interview detail
 * preview, response inspection, filter sidebars). NOT for primary forms —
 * use Dialog for those.
 *
 * <Drawer open={open} onOpenChange={setOpen} side="right">
 *   <DrawerHeader title="Edit interview" />
 *   <DrawerBody>...</DrawerBody>
 *   <DrawerFooter>
 *     <Button>Save</Button>
 *   </DrawerFooter>
 * </Drawer>
 */
const Drawer = DialogPrimitive.Root;
const DrawerTrigger = DialogPrimitive.Trigger;
const DrawerClose = DialogPrimitive.Close;

interface DrawerContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  side?: "right" | "left";
  /** Width preset. `default` = 400px, `wide` = 560px, `full` = 90vw. */
  size?: "default" | "wide" | "full";
}

const SIDE_CLASSES: Record<"right" | "left", string> = {
  right:
    "right-0 inset-y-0 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
  left: "left-0 inset-y-0 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
};

const SIZE_CLASSES: Record<"default" | "wide" | "full", string> = {
  default: "w-full sm:max-w-md",
  wide: "w-full sm:max-w-xl",
  full: "w-full sm:max-w-[90vw]",
};

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DrawerContentProps
>(({ className, children, side = "right", size = "default", ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-black/50",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "duration-[var(--ds-motion-duration-medium)]",
      )}
    />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed z-50 flex flex-col gap-4 border bg-background p-6",
        "shadow-[var(--ds-shadow-overlay)]",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "duration-[var(--ds-motion-duration-medium)]",
        SIDE_CLASSES[side],
        SIZE_CLASSES[size],
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-brand-bold)] focus-visible:ring-offset-2">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DrawerContent.displayName = "DrawerContent";

function DrawerHeader({
  title,
  description,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1 pr-6", className)}>
      <DialogPrimitive.Title className="text-lg font-semibold leading-none tracking-tight">
        {title}
      </DialogPrimitive.Title>
      {description ? (
        <DialogPrimitive.Description className="text-sm text-muted-foreground">
          {description}
        </DialogPrimitive.Description>
      ) : null}
    </div>
  );
}

function DrawerBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex-1 overflow-y-auto -mx-6 px-6", className)}
      {...props}
    />
  );
}

function DrawerFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

export {
  Drawer,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
};
