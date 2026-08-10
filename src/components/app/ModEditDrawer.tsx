import * as React from "react";
import { ExternalLink, HardDrive } from "lucide-react";
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
import { Field, Input, Textarea } from "@/components/ui/field";
import { StatusBadge } from "@/components/ui/badge";
import { actions } from "@/lib/actions";
import { api } from "@/lib/api";
import { notify } from "@/lib/toast";
import type { Game, Mod, ModMetaInput } from "@/lib/types";
import { formatBytes, formatDateTime, parseTags, tagsToInput } from "@/lib/utils";
import { openExternal } from "@/lib/external";

export function ModEditDrawer({
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
  const [form, setForm] = React.useState({
    display_name: "",
    file_name: "",
    version: "",
    notes: "",
    tags: "",
    url: "",
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  const [stats, setStats] = React.useState<[number, number] | null>(null);

  React.useEffect(() => {
    if (!open || !mod) return;
    setForm({
      display_name: mod.display_name,
      file_name: mod.file_name,
      version: mod.version,
      notes: mod.notes,
      tags: tagsToInput(mod.tags),
      url: mod.url,
    });
    setErrors({});
    setStats(null);

    let cancelled = false;
    api
      .modPoolStats(game.id, mod.id)
      .then((s) => !cancelled && setStats(s))
      .catch(() => !cancelled && setStats(null));
    return () => {
      cancelled = true;
    };
  }, [open, mod, game.id]);

  if (!mod) return null;

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!form.display_name.trim()) next.display_name = "Give the mod a display name.";
    const fileName = form.file_name.trim();
    if (!fileName) next.file_name = "The on-disk name is required.";
    else if (/[\\/]/.test(fileName)) next.file_name = "The name cannot contain slashes.";
    else if (
      game.mods.some(
        (m) => m.id !== mod.id && m.file_name.toLowerCase() === fileName.toLowerCase(),
      )
    )
      next.file_name = "Another mod already uses this file name.";

    setErrors(next);
    if (Object.keys(next).length > 0) {
      notify.error("Invalid form input", Object.values(next)[0]);
      return false;
    }
    return true;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const input: ModMetaInput = {
      display_name: form.display_name.trim(),
      file_name: form.file_name.trim(),
      version: form.version.trim(),
      notes: form.notes.trim(),
      tags: parseTags(form.tags),
      url: form.url.trim(),
    };

    setBusy(true);
    const ok = await actions.updateModMeta(game.id, mod.id, input);
    setBusy(false);
    if (ok) onOpenChange(false);
  };

  const renaming = form.file_name.trim() !== mod.file_name;

  return (
    <Sheet open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit mod</SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-2">
            <StatusBadge status={mod.status} />
            <span className="text-fg-subtle">Added {formatDateTime(mod.date_added)}</span>
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <SheetBody className="space-y-4">
            <Field label="Display name" required htmlFor="edit-display-name" error={errors.display_name}>
              <Input
                id="edit-display-name"
                value={form.display_name}
                onChange={(e) => set("display_name", e.target.value)}
                autoFocus
              />
            </Field>

            <Field
              label="File name"
              required
              htmlFor="edit-file-name"
              error={errors.file_name}
              hint={
                renaming
                  ? "Renames the entry in the pool, and in the game folder if applied."
                  : `${mod.type === "folder" ? "Folder" : "File"} name in the pool.`
              }
            >
              <Input
                id="edit-file-name"
                value={form.file_name}
                onChange={(e) => set("file_name", e.target.value)}
                spellCheck={false}
                className="font-mono text-[12.5px]"
              />
            </Field>

            <Field label="Version" htmlFor="edit-version">
              <Input
                id="edit-version"
                value={form.version}
                onChange={(e) => set("version", e.target.value)}
                placeholder="1.2.0"
              />
            </Field>

            <Field label="Tags" htmlFor="edit-tags" hint="Comma separated.">
              <Input
                id="edit-tags"
                value={form.tags}
                onChange={(e) => set("tags", e.target.value)}
                placeholder="patch, gameplay"
              />
            </Field>

            <Field label="URL" htmlFor="edit-url">
              <div className="flex gap-2">
                <Input
                  id="edit-url"
                  value={form.url}
                  onChange={(e) => set("url", e.target.value)}
                  placeholder="https://www.nexusmods.com/..."
                  spellCheck={false}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  disabled={!form.url.trim()}
                  onClick={() => openExternal(form.url.trim())}
                  aria-label="Open link"
                  className="shrink-0"
                >
                  <ExternalLink />
                </Button>
              </div>
            </Field>

            <Field label="Notes" htmlFor="edit-notes">
              <Textarea
                id="edit-notes"
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                rows={5}
              />
            </Field>

            <div className="rounded-lg border border-border bg-surface-2/40 p-3 text-[12px] text-fg-muted">
              <p className="mb-1.5 flex items-center gap-1.5 font-medium text-fg">
                <HardDrive className="size-3.5 text-fg-subtle" />
                In the pool
              </p>
              <p className="tabular-nums">
                {stats
                  ? `${stats[0]} file${stats[0] === 1 ? "" : "s"} · ${formatBytes(stats[1])}`
                  : "—"}
              </p>
              <p className="mt-1 text-fg-subtle">Last updated {formatDateTime(mod.last_updated)}</p>
            </div>
          </SheetBody>

          <SheetFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" variant="accent" loading={busy}>
              Save
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
