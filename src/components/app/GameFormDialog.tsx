import * as React from "react";
import { File, Folder, Layers } from "lucide-react";
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
import type { Game, GameInput, GameModType, ImageInput } from "@/lib/types";
import { ImagePicker } from "./ImagePicker";
import { PathPicker } from "./PathPicker";

const NO_IMAGE: ImageInput = { source: null, clear: false };

type FormState = {
  name: string;
  description: string;
  notes: string;
  game_path: string;
  mods_path: string;
  mod_type: GameModType;
  cover_image: ImageInput;
  icon: ImageInput;
  hero_image: ImageInput;
};

const emptyForm = (): FormState => ({
  name: "",
  description: "",
  notes: "",
  game_path: "",
  mods_path: "",
  mod_type: "folder",
  cover_image: NO_IMAGE,
  icon: NO_IMAGE,
  hero_image: NO_IMAGE,
});

const fromGame = (game: Game): FormState => ({
  name: game.name,
  description: game.description,
  notes: game.notes,
  game_path: game.game_path,
  mods_path: game.mods_path,
  mod_type: game.mod_type,
  cover_image: NO_IMAGE,
  icon: NO_IMAGE,
  hero_image: NO_IMAGE,
});

export function GameFormDialog({
  open,
  onOpenChange,
  game,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present in edit mode. */
  game?: Game;
}) {
  const [form, setForm] = React.useState<FormState>(emptyForm);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);

  // Reset whenever the dialog is (re)opened so stale input never leaks across.
  React.useEffect(() => {
    if (open) {
      setForm(game ? fromGame(game) : emptyForm());
      setErrors({});
    }
  }, [open, game]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = "Give the game a name.";
    if (!form.game_path.trim()) next.game_path = "Pick the game's root folder.";
    if (!form.mods_path.trim()) next.mods_path = "Pick the folder mods get copied into.";
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

    const input: GameInput = {
      name: form.name.trim(),
      description: form.description.trim(),
      notes: form.notes.trim(),
      game_path: form.game_path.trim(),
      mods_path: form.mods_path.trim(),
      mod_type: form.mod_type,
      cover_image: form.cover_image,
      icon: form.icon,
      hero_image: form.hero_image,
    };

    setBusy(true);
    const ok = game
      ? await actions.updateGame(game.id, input)
      : await actions.addGame(input);
    setBusy(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{game ? "Edit game" : "Add game"}</DialogTitle>
          <DialogDescription>
            {game
              ? "Update the game's details, paths and artwork."
              : "Point ZMods at a game folder and the folder its mods get copied into."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="space-y-4">
            <Field label="Name" required htmlFor="game-name" error={errors.name}>
              <Input
                id="game-name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Skyrim Special Edition"
                autoFocus
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Description" htmlFor="game-description">
                <Textarea
                  id="game-description"
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="What this game is, or which install this entry points at."
                />
              </Field>
              <Field label="Notes" htmlFor="game-notes">
                <Textarea
                  id="game-notes"
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  placeholder="Load order quirks, patches to remember, anything else."
                />
              </Field>
            </div>

            <Field
              label="Game folder"
              required
              htmlFor="game-path"
              error={errors.game_path}
              hint="The game's root install directory."
            >
              <PathPicker
                id="game-path"
                value={form.game_path}
                onChange={(v) => set("game_path", v)}
                placeholder="/home/you/Games/Skyrim"
                title="Select the game folder"
                invalid={Boolean(errors.game_path)}
              />
            </Field>

            <Field
              label="Mods folder"
              required
              htmlFor="mods-path"
              error={errors.mods_path}
              hint="Where applied mods are copied to."
            >
              <PathPicker
                id="mods-path"
                value={form.mods_path}
                onChange={(v) => set("mods_path", v)}
                placeholder="/home/you/Games/Skyrim/Data"
                title="Select the mods folder"
                invalid={Boolean(errors.mods_path)}
              />
            </Field>

            <Field label="Mod type" hint="What a single mod looks like on disk for this game.">
              <RadioGroup
                value={form.mod_type}
                onValueChange={(v) => set("mod_type", v as GameModType)}
              >
                <RadioCard
                  value="folder"
                  label="Folder"
                  hint="Each mod is a directory"
                  icon={<Folder className="size-3.5" />}
                />
                <RadioCard
                  value="file"
                  label="File"
                  hint="Each mod is one file"
                  icon={<File className="size-3.5" />}
                />
                <RadioCard
                  value="both"
                  label="Both"
                  hint="Chosen per mod"
                  icon={<Layers className="size-3.5" />}
                />
              </RadioGroup>
            </Field>

            <div className="space-y-3 rounded-lg border border-border bg-surface-2/40 p-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
                Artwork
              </p>
              <ImagePicker
                label="Hero image"
                hint="Wide banner shown at the top of the game page"
                aspect="aspect-[16/6]"
                gameId={game?.id}
                existing={game?.hero_image ?? ""}
                value={form.hero_image}
                onChange={(v) => set("hero_image", v)}
              />
              <div className="grid grid-cols-2 gap-3">
                <ImagePicker
                  label="Cover"
                  hint="Shown on the home grid"
                  aspect="aspect-[3/4]"
                  gameId={game?.id}
                  existing={game?.cover_image ?? ""}
                  value={form.cover_image}
                  onChange={(v) => set("cover_image", v)}
                />
                <ImagePicker
                  label="Icon"
                  hint="Shown in the sidebar"
                  aspect="aspect-square"
                  gameId={game?.id}
                  existing={game?.icon ?? ""}
                  value={form.icon}
                  onChange={(v) => set("icon", v)}
                />
              </div>
            </div>
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
              {game ? "Save changes" : "Add game"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
