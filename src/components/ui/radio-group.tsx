import * as React from "react";
import * as Primitive from "@radix-ui/react-radio-group";
import { cn } from "@/lib/utils";

export function RadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof Primitive.Root>) {
  return <Primitive.Root className={cn("flex flex-wrap gap-2", className)} {...props} />;
}

/** Segmented card-style option — reads better than a bare radio dot here. */
export function RadioCard({
  value,
  label,
  hint,
  icon,
  className,
}: {
  value: string;
  label: string;
  hint?: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  const id = `radio-${React.useId()}`;
  return (
    <div className={cn("flex-1", className)}>
      <Primitive.Item id={id} value={value} className="peer sr-only" />
      <label
        htmlFor={id}
        className={cn(
          "flex cursor-pointer select-none flex-col gap-0.5 rounded-md border border-border bg-surface-2 px-3 py-2 transition-colors",
          "hover:border-border-strong hover:bg-surface-3",
          "peer-data-[state=checked]:border-accent peer-data-[state=checked]:bg-accent/10",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40",
        )}
      >
        <span className="flex items-center gap-1.5 text-[13px] font-medium text-fg">
          {icon}
          {label}
        </span>
        {hint && <span className="text-[11px] text-fg-subtle">{hint}</span>}
      </label>
    </div>
  );
}
