import { cn } from "@/lib/utils";

/** The same Z mark as the app icon, tinted with the current accent. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1024 1024"
      className={cn("size-7", className)}
      role="img"
      aria-label="ZMods"
    >
      <defs>
        <linearGradient id="zmods-logo-grad" x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.85" />
          <stop offset="100%" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="1024" height="1024" rx="228" fill="var(--surface-2)" />
      <rect
        x="6"
        y="6"
        width="1012"
        height="1012"
        rx="222"
        fill="none"
        stroke="var(--border-strong)"
        strokeWidth="12"
      />
      <path
        d="M260,280 L764,280 L764,392 L452,632 L764,632 L764,744 L260,744 L260,632 L572,392 L260,392 Z"
        fill="url(#zmods-logo-grad)"
        stroke="url(#zmods-logo-grad)"
        strokeWidth="26"
        strokeLinejoin="round"
      />
    </svg>
  );
}
