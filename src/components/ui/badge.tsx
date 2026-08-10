import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { ModStatus } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/types";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-tight whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "border-border-strong/60 bg-neutral-bg text-neutral",
        success: "border-success/30 bg-success-bg text-success",
        warning: "border-warning/30 bg-warning-bg text-warning",
        danger: "border-danger/30 bg-danger-bg text-danger",
        accent: "border-accent/35 bg-accent/12 text-accent",
        outline: "border-border bg-transparent text-fg-muted",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

const STATUS_TONE: Record<ModStatus, NonNullable<VariantProps<typeof badgeVariants>["tone"]>> = {
  active: "success",
  none: "neutral",
  disabled: "warning",
  broken: "danger",
};

export function StatusBadge({ status, className }: { status: ModStatus; className?: string }) {
  return (
    <Badge tone={STATUS_TONE[status]} className={className}>
      <span
        className="size-1.5 rounded-full bg-current"
        style={{ boxShadow: "0 0 6px currentColor" }}
        aria-hidden
      />
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export { badgeVariants };
