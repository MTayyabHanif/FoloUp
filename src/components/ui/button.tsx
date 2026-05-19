import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-[var(--radius-buttons)] text-sm font-medium tracking-[-0.04em] transition-all duration-[var(--ds-motion-duration-medium)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--background))] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--color-amber-seed)] text-[var(--color-canvas-ice)] shadow-[var(--shadow-subtle)] hover:bg-[var(--color-deep-earth)]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[var(--shadow-subtle)] hover:opacity-95",
        outline:
          "border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-[var(--shadow-subtle)] hover:border-[var(--color-valley-green)] hover:text-[var(--color-valley-green)]",
        secondary:
          "border border-[color:rgba(197,204,182,0.9)] bg-[var(--color-forest-dew)] text-[var(--color-valley-green)] shadow-[var(--shadow-subtle)] hover:bg-[color:rgba(215,232,181,0.78)]",
        ghost:
          "border border-transparent text-[var(--color-valley-green)] hover:border-[color:rgba(197,204,182,0.92)] hover:bg-[color:rgba(215,232,181,0.42)]",
        link:
          "rounded-none px-0 text-[var(--color-valley-green)] underline-offset-4 hover:text-[var(--color-adaline-ink)] hover:underline",
      },
      size: {
        default: "h-11 px-6 py-2.5",
        sm: "h-9 px-4 text-xs",
        lg: "h-12 px-8 text-sm",
        icon: "h-11 w-11 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
