import { Toaster as Sonner } from "sonner";

/**
 * Bottom-right stack. Success/info self-dismiss; errors are given
 * `duration: Infinity` at the call site so they wait to be read.
 */
export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      closeButton
      offset={16}
      gap={10}
      visibleToasts={5}
      toastOptions={{
        duration: 3000,
        classNames: {
          toast:
            "group !rounded-lg !border !border-border !bg-surface !text-fg !shadow-xl !shadow-black/40 !font-sans",
          title: "!text-[13px] !font-semibold",
          description: "!text-[12px] !text-fg-muted !leading-relaxed",
          actionButton: "!bg-accent !text-accent-fg !rounded-md",
          cancelButton: "!bg-surface-2 !text-fg-muted !rounded-md",
          closeButton:
            "!bg-surface-2 !border-border !text-fg-muted hover:!text-fg hover:!bg-surface-3",
          success: "[&_[data-icon]]:!text-success",
          error: "!border-danger/40 [&_[data-icon]]:!text-danger",
          warning: "[&_[data-icon]]:!text-warning",
          info: "[&_[data-icon]]:!text-accent",
        },
      }}
    />
  );
}
