"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-[var(--button-radius)] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[var(--accent-gradient)] text-white hover:opacity-90 focus-visible:ring-[var(--accent)]",
        secondary: "bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] focus-visible:ring-[var(--border-strong)]",
        outline: "border border-[var(--border-default)] bg-transparent text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] focus-visible:ring-[var(--border-strong)]",
        ghost: "text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] focus-visible:ring-[var(--border-strong)]",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        default: "h-10 px-4",
        lg: "h-12 px-6 text-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type, ...props }, ref) => (
    <button
      type={type ?? "button"}
      className={cn(buttonVariants({ variant, size, className }), "cursor-pointer")}
      ref={ref}
      {...props}
    />
  )
);
Button.displayName = "Button";

export { Button, buttonVariants };
