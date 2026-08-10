import * as React from "react";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type ConfirmOptions = {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<unknown>;
};

export function ConfirmDialog({
  options,
  onOpenChange,
}: {
  options: ConfirmOptions | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [busy, setBusy] = React.useState(false);

  // Keep the last options around so the text does not vanish mid-close.
  const [shown, setShown] = React.useState<ConfirmOptions | null>(null);
  React.useEffect(() => {
    if (options) setShown(options);
  }, [options]);

  const handleConfirm = async () => {
    if (!options) return;
    setBusy(true);
    try {
      await options.onConfirm();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  const data = options ?? shown;

  return (
    <Dialog open={options !== null} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {data?.destructive && <AlertTriangle className="size-4 text-danger" />}
            {data?.title}
          </DialogTitle>
        </DialogHeader>
        {data?.description && (
          <DialogBody>
            <DialogDescription asChild>
              <div className="space-y-2 text-[13px] leading-relaxed text-fg-muted">
                {data.description}
              </div>
            </DialogDescription>
          </DialogBody>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            {data?.cancelLabel ?? "Cancel"}
          </Button>
          <Button
            variant={data?.destructive ? "danger" : "accent"}
            onClick={handleConfirm}
            loading={busy}
          >
            {data?.confirmLabel ?? "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Small hook so any view can raise a confirmation without prop drilling. */
export function useConfirm() {
  const [options, setOptions] = React.useState<ConfirmOptions | null>(null);
  const confirm = React.useCallback((opts: ConfirmOptions) => setOptions(opts), []);
  const close = React.useCallback((open: boolean) => {
    if (!open) setOptions(null);
  }, []);
  return { options, confirm, close };
}
