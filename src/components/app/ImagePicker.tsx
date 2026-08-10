import * as React from "react";
import { ImagePlus, Replace, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/field";
import { api } from "@/lib/api";
import { pick } from "@/lib/pickers";
import type { ImageInput } from "@/lib/types";
import { baseName, cn } from "@/lib/utils";
import { useGameAsset } from "./GameArt";

export function ImagePicker({
  label,
  hint,
  aspect,
  gameId,
  existing,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  aspect: string;
  /** Absent while adding a game — nothing is stored in the pool yet. */
  gameId?: string;
  existing: string;
  value: ImageInput;
  onChange: (next: ImageInput) => void;
}) {
  const stored = useGameAsset(gameId ?? "", gameId && !value.clear && !value.source ? existing : "");
  const [preview, setPreview] = React.useState<string | null>(null);

  // Freshly picked files live outside the pool, so they need their own read.
  React.useEffect(() => {
    let cancelled = false;
    if (!value.source) {
      setPreview(null);
      return;
    }
    api
      .readImagePreview(value.source)
      .then((url) => !cancelled && setPreview(url))
      .catch(() => !cancelled && setPreview(null));
    return () => {
      cancelled = true;
    };
  }, [value.source]);

  const src = value.source ? preview : value.clear ? null : stored;
  const hasImage = Boolean(value.source || (existing && !value.clear));

  const choose = async () => {
    const picked = await pick.image(`Select ${label.toLowerCase()}`);
    if (picked) onChange({ source: picked, clear: false });
  };

  const remove = () => onChange({ source: null, clear: true });

  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <button
        type="button"
        onClick={choose}
        className={cn(
          "group relative w-full overflow-hidden rounded-lg border border-dashed border-border bg-surface-2 transition-colors",
          "hover:border-accent/60 hover:bg-surface-3",
          aspect,
        )}
      >
        {src ? (
          <>
            <img
              src={src}
              alt=""
              draggable={false}
              className="fade-in-img size-full object-cover"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-[12px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
              <Replace className="mr-1.5 size-3.5" />
              Replace
            </span>
          </>
        ) : (
          <span className="flex size-full flex-col items-center justify-center gap-1 text-fg-subtle">
            <ImagePlus className="size-5" />
            <span className="text-[11px]">Choose image</span>
          </span>
        )}
      </button>

      <div className="flex min-h-5 items-center justify-between gap-2">
        <span className="truncate text-[11px] text-fg-subtle" title={value.source ?? existing}>
          {value.source ? baseName(value.source) : value.clear ? "Will be removed" : existing || hint}
        </span>
        {hasImage && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={remove}
            aria-label={`Remove ${label.toLowerCase()}`}
            className="shrink-0 hover:text-danger"
          >
            <Trash2 />
          </Button>
        )}
      </div>
    </div>
  );
}
