import * as React from "react";
import { File, Folder } from "lucide-react";
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
import { Field, Input, Textarea } from "@/components/ui/field";
import { RadioCard, RadioGroup } from "@/components/ui/radio-group";
import { actions } from "@/lib/actions";
import { notify } from "@/lib/toast";
import type { Game, ModInput, ModKind } from "@/lib/types";
import { baseName, parseTags } from "@/lib/utils";
import { SourcePicker } from "./SourcePicker";

const emptyForm = (kind: ModKind) => ({
  display_name: "",
  file_name: "",
  version: "",
  notes: "",
  tags: "",
  url: "",
  type: kind,
});

/** Games locked to one kind never show the radio and never let it drift. */
function defaultKind(game: Game): ModKind {
  return game.mod_type === "file" ? "file" : "folder";
}

export function AddModDialog({
  open,
  onOpenChange,
  game,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  game: Game;
}) {
  const [form, setForm] = React.useState(() => emptyForm(defaultKind(game)));
  const [sources, setSources] = React.useState<string[]>([]);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  // Once the user edits the file name by hand, stop overwriting it.
  const fileNameTouched = React.useRef(false);

  React.useEffect(() => {
    if (open) {
      setForm(emptyForm(defaultKind(game)));
      setSources([]);
      setErrors({});
      fileNameTouched.current = false;
    }
  }, [open, game]);

  const kind: ModKind = game.mod_type === "both" ? form.type : defaultKind(game);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSources = (next: string[]) => {
    setSources(next);
    // Derive sensible defaults from the first pick, without stomping edits.
    if (next.length > 0) {
      const name = baseName(next[0]);
      if (!fileNameTouched.current && (kind === "file" || next.length === 1)) {
        setForm((f) => ({
          ...f,
          file_name: name,
          display_name: f.display_name || name.replace(/\.[^.]+$/, ""),
        }));
      }
    }
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!form.display_name.trim()) next.display_name = "Give the mod a display name.";
    const fileName = form.file_name.trim();
    if (!fileName) next.file_name = "The on-disk name is required.";
    else if (/[\\/]/.test(fileName)) next.file_name = "The name cannot contain slashes.";
    else if (game.mods.some((m) => m.file_name.toLowerCase() === fileName.toLowerCase()))
      next.file_name = "Another mod already uses this file name.";
    if (sources.length === 0) next.sources = "Select the mod's files first.";
    else if (kind === "file" && sources.length > 1)
      next.sources = "A file mod takes exactly one file.";

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

    const input: ModInput = {
      display_name: form.display_name.trim(),
      file_name: form.file_name.trim(),
      version: form.version.trim(),
      notes: form.notes.trim(),
      tags: parseTags(form.tags),
      url: form.url.trim(),
      type: kind,
    };

    setBusy(true);
    const ok = await actions.addMod(game.id, input, sources);
    setBusy(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Add mod</DialogTitle>
          <DialogDescription>
            Files are copied into this game's pool. Nothing touches {game.name} until you apply it.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="space-y-4">
            {game.mod_type === "both" && (
              <Field label="Type" hint="Whether this mod is a folder or a single file.">
                <RadioGroup
                  value={form.type}
                  onValueChange={(v) => set("type", v as ModKind)}
                >
                  <RadioCard
                    value="folder"
                    label="Folder"
                    icon={<Folder className="size-3.5" />}
                  />
                  <RadioCard value="file" label="File" icon={<File className="size-3.5" />} />
                </RadioGroup>
              </Field>
            )}

            <Field label="Files" required error={errors.sources}>
              <SourcePicker
                kind={kind}
                sources={sources}
                onChange={handleSources}
                invalid={Boolean(errors.sources)}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Display name"
                required
                htmlFor="mod-display-name"
                error={errors.display_name}
              >
                <Input
                  id="mod-display-name"
                  value={form.display_name}
                  onChange={(e) => set("display_name", e.target.value)}
                  placeholder="Unofficial Patch"
                />
              </Field>
              <Field
                label="File name"
                required
                htmlFor="mod-file-name"
                error={errors.file_name}
                hint={
                  errors.file_name
                    ? undefined
                    : kind === "folder"
                      ? "Folder name in the pool and the game."
                      : "File name in the pool and the game."
                }
              >
                <Input
                  id="mod-file-name"
                  value={form.file_name}
                  onChange={(e) => {
                    fileNameTouched.current = true;
                    set("file_name", e.target.value);
                  }}
                  placeholder={kind === "folder" ? "UnofficialPatch" : "UnofficialPatch.esp"}
                  spellCheck={false}
                  className="font-mono text-[12.5px]"
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Version" htmlFor="mod-version">
                <Input
                  id="mod-version"
                  value={form.version}
                  onChange={(e) => set("version", e.target.value)}
                  placeholder="1.2.0"
                />
              </Field>
              <Field label="Tags" htmlFor="mod-tags" hint="Comma separated.">
                <Input
                  id="mod-tags"
                  value={form.tags}
                  onChange={(e) => set("tags", e.target.value)}
                  placeholder="patch, gameplay"
                />
              </Field>
            </div>

            <Field label="URL" htmlFor="mod-url">
              <Input
                id="mod-url"
                value={form.url}
                onChange={(e) => set("url", e.target.value)}
                placeholder="https://www.nexusmods.com/..."
                spellCheck={false}
              />
            </Field>

            <Field label="Notes" htmlFor="mod-notes">
              <Textarea
                id="mod-notes"
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Install order, conflicts, requirements…"
              />
            </Field>
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" variant="accent" loading={busy}>
              Add to pool
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
