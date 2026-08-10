import * as React from "react";
import { FilePlus2, FileMinus2, FileDiff, Loader2, Minus } from "lucide-react";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { StatusBadge } from "@/components/ui/badge";
import { actions } from "@/lib/actions";
import { api } from "@/lib/api";
import type { Game, Mod, UpdateDiff } from "@/lib/types";
import { cn, errorMessage } from "@/lib/utils";
import { SourcePicker } from "./SourcePicker";

type DiffSection = {
  key: keyof UpdateDiff;
  label: string;
  icon: React.ReactNode;
  className: string;
};

const SECTIONS: DiffSection[] = [
  {
    key: "added",
    label: "Added",
    icon: <FilePlus2 className="size-3.5" />,
    className: "text-success",
  },
  {
    key: "changed",
    label: "Changed",
    icon: <FileDiff className="size-3.5" />,
    className: "text-warning",
  },
  {
    key: "removed",
    label: "Removed",
    icon: <FileMinus2 className="size-3.5" />,
    className: "text-danger",
  },
  {
    key: "unchanged",
    label: "Unchanged",
    icon: <Minus className="size-3.5" />,
    className: "text-fg-subtle",
  },
];

export function ModUpdateDrawer({
  open,
  onOpenChange,
  game,
  mod,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  game: Game;
  mod: Mod | null;
}) {
  const [sources, setSources] = React.useState<string[]>([]);
  const [diff, setDiff] = React.useState<UpdateDiff | null>(null);
  const [diffError, setDiffError] = React.useState<string | null>(null);
  const [diffing, setDiffing] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setSources([]);
      setDiff(null);
      setDiffError(null);
    }
  }, [open, mod]);

  // Recompute the preview whenever the selection changes.
  React.useEffect(() => {
    if (!open || !mod || sources.length === 0) {
      setDiff(null);
      setDiffError(null);
      return;
    }
    let cancelled = false;
    setDiffing(true);
    api
      .previewModUpdate(game.id, mod.id, sources)
      .then((d) => {
        if (cancelled) return;
        setDiff(d);
        setDiffError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setDiff(null);
        setDiffError(errorMessage(e));
      })
      .finally(() => !cancelled && setDiffing(false));
    return () => {
      cancelled = true;
    };
  }, [open, game.id, mod, sources]);

  if (!mod) return null;

  const confirm = async () => {
    setBusy(true);
    const ok = await actions.updateModFiles(game.id, mod.id, sources, mod.display_name);
    setBusy(false);
    if (ok) onOpenChange(false);
  };

  const hasChanges =
    diff !== null && (diff.added.length > 0 || diff.changed.length > 0 || diff.removed.length > 0);

  return (
    <Sheet open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <SheetContent className="max-w-[520px]">
        <SheetHeader>
          <SheetTitle>Update {mod.display_name}</SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-2">
            <StatusBadge status={mod.status} />
            <span className="font-mono text-[11.5px] text-fg-subtle">{mod.file_name}</span>
          </SheetDescription>
        </SheetHeader>

        <SheetBody className="space-y-4">
          <Field
            label="New files"
            hint={
              mod.type === "folder"
                ? "Pick the updated folder, or the individual files that make up the mod."
                : "Pick the updated file."
            }
          >
            <SourcePicker kind={mod.type} sources={sources} onChange={setSources} />
          </Field>

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
              Changes
            </p>

            {sources.length === 0 ? (
              <p className="rounded-md border border-dashed border-border bg-surface-2/50 px-3 py-4 text-center text-[12px] text-fg-subtle">
                Select the new files to see what would change.
              </p>
            ) : diffing ? (
              <p className="flex items-center justify-center gap-2 rounded-md border border-border bg-surface-2/50 px-3 py-4 text-[12px] text-fg-muted">
                <Loader2 className="size-3.5 animate-spin" />
                Comparing…
              </p>
            ) : diffError ? (
              <p className="rounded-md border border-danger/40 bg-danger/8 px-3 py-2.5 text-[12px] text-danger">
                {diffError}
              </p>
            ) : diff ? (
              <div className="space-y-2.5">
                <div className="grid grid-cols-4 gap-1.5">
                  {SECTIONS.map((s) => (
                    <div
                      key={s.key}
                      className="rounded-md border border-border bg-surface-2/50 px-2 py-1.5 text-center"
                    >
                      <p className={cn("text-[15px] font-semibold tabular-nums", s.className)}>
                        {diff[s.key].length}
                      </p>
                      <p className="text-[10.5px] text-fg-subtle">{s.label}</p>
                    </div>
                  ))}
                </div>

                {!hasChanges && (
                  <p className="rounded-md border border-border bg-surface-2/50 px-3 py-2.5 text-[12px] text-fg-muted">
                    These files are identical to what is already in the pool.
                  </p>
                )}

                {SECTIONS.filter((s) => s.key !== "unchanged" && diff[s.key].length > 0).map((s) => (
                  <div key={s.key} className="rounded-md border border-border bg-surface-2/40">
                    <p
                      className={cn(
                        "flex items-center gap-1.5 border-b border-border px-2.5 py-1.5 text-[11.5px] font-medium",
                        s.className,
                      )}
                    >
                      {s.icon}
                      {s.label}
                      <span className="ml-auto tabular-nums text-fg-subtle">
                        {diff[s.key].length}
                      </span>
                    </p>
                    <ul className="max-h-40 overflow-y-auto p-1.5">
                      {diff[s.key].map((file) => (
                        <li
                          key={file}
                          className="truncate rounded px-1.5 py-0.5 font-mono text-[11.5px] text-fg-muted"
                          title={file}
                        >
                          {file}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {mod.status === "active" && sources.length > 0 && (
            <p className="rounded-md border border-accent/30 bg-accent/8 px-3 py-2.5 text-[12px] text-fg-muted">
              This mod is applied — it will be re-copied into{" "}
              <span className="font-mono text-[11.5px] text-fg">{game.mods_path}</span> after the
              pool is updated.
            </p>
          )}
        </SheetBody>

        <SheetFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="accent"
            onClick={confirm}
            loading={busy}
            disabled={sources.length === 0 || Boolean(diffError)}
          >
            Apply update
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
