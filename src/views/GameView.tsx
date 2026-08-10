import * as React from "react";
import {
  Boxes,
  FolderOpen,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AddModDialog } from "@/components/app/AddModDialog";
import { ConfirmDialog, useConfirm } from "@/components/app/ConfirmDialog";
import { GameFormDialog } from "@/components/app/GameFormDialog";
import { GameArt, useGameAsset } from "@/components/app/GameArt";
import { ModsTable } from "@/components/app/ModsTable";
import { actions } from "@/lib/actions";
import { revealFolder } from "@/lib/external";
import { MOD_TYPE_LABELS, type Game } from "@/lib/types";
import { cn } from "@/lib/utils";
import { activeModCount } from "@/store/useStore";

export function GameView({ game }: { game: Game }) {
  const [addingMod, setAddingMod] = React.useState(false);
  const [editingGame, setEditingGame] = React.useState(false);
  const { options, confirm, close } = useConfirm();

  const hero = useGameAsset(game.id, game.hero_image);
  const active = activeModCount(game);
  const broken = game.mods.filter((m) => m.status === "broken").length;

  const deleteGame = () =>
    confirm({
      title: `Delete "${game.name}"?`,
      destructive: true,
      confirmLabel: "Delete game",
      description: (
        <>
          <p>
            Removes the game from ZMods and deletes its entire pool
            {active > 0 ? `, plus the ${active} mod${active === 1 ? "" : "s"} currently applied to the game folder` : ""}
            . This cannot be undone.
          </p>
          <p>Your game install itself is left alone.</p>
        </>
      ),
      onConfirm: () => actions.deleteGame(game.id, game.name),
    });

  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 pb-10 pt-6">
      {/* Steam-style hero with the icon anchored bottom-left */}
      <section className="relative overflow-hidden rounded-xl border border-border bg-surface">
        <div className="relative h-[240px] w-full">
          {hero ? (
            <img
              src={hero}
              alt=""
              draggable={false}
              className="fade-in-img size-full object-cover"
            />
          ) : (
            <div className="size-full bg-[radial-gradient(120%_120%_at_15%_0%,color-mix(in_oklab,var(--accent)_28%,transparent),transparent_60%)] bg-surface-2" />
          )}
          {/* Just enough scrim to keep the icon and buttons legible. */}
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/35 via-45% to-transparent" />

          <div className="absolute inset-x-0 bottom-0 flex items-end gap-4 p-5">
            {game.icon ? (
              <GameArt
                gameId={game.id}
                fileName={game.icon}
                name={game.name}
                rounded="rounded-lg"
                className="size-[84px] shrink-0 shadow-lg shadow-black/40 ring-1 ring-border-strong"
                fallbackClassName="text-xl"
              />
            ) : (
              <h1 className="text-3xl font-semibold tracking-tight text-fg drop-shadow-lg">
                {game.name}
              </h1>
            )}

            <div className="ml-auto flex items-center gap-2">
              <Tooltip content="Open mods folder">
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label="Open mods folder"
                  onClick={() => revealFolder(game.mods_path)}
                >
                  <FolderOpen />
                </Button>
              </Tooltip>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="icon" aria-label="Game actions">
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setEditingGame(true)}>
                    <Pencil />
                    Edit game
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => revealFolder(game.game_path)}>
                    <FolderOpen />
                    Open game folder
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem destructive onSelect={deleteGame}>
                    <Trash2 />
                    Delete game
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        <div className="space-y-3 px-5 pb-5">
          {game.icon && (
            <h1 className="text-2xl font-semibold tracking-tight text-fg">{game.name}</h1>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">
              <Boxes className="size-3" />
              {game.mods.length} in pool
            </Badge>
            {active > 0 && <Badge tone="success">{active} active</Badge>}
            {broken > 0 && <Badge tone="danger">{broken} broken</Badge>}
            <Badge tone="outline">{MOD_TYPE_LABELS[game.mod_type]}</Badge>
          </div>

          {game.description && (
            <p className="max-w-3xl whitespace-pre-wrap text-[13.5px] leading-relaxed text-fg-muted">
              {game.description}
            </p>
          )}

          {game.notes && (
            <div className="max-w-3xl rounded-lg border border-border bg-surface-2/50 px-3.5 py-2.5">
              <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-fg-subtle">
                Notes
              </p>
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-fg-muted">
                {game.notes}
              </p>
            </div>
          )}

          <dl className="grid gap-x-6 gap-y-1 pt-1 text-[11.5px] sm:grid-cols-2">
            <PathRow label="Game folder" value={game.game_path} />
            <PathRow label="Mods folder" value={game.mods_path} />
          </dl>
        </div>
      </section>

      <section className="mt-7">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold tracking-tight text-fg">Mods</h2>
          <Button variant="accent" onClick={() => setAddingMod(true)}>
            <Plus />
            Add Mod
          </Button>
        </div>
        <ModsTable game={game} />
      </section>

      <AddModDialog open={addingMod} onOpenChange={setAddingMod} game={game} />
      <GameFormDialog open={editingGame} onOpenChange={setEditingGame} game={game} />
      <ConfirmDialog options={options} onOpenChange={close} />
    </div>
  );
}

function PathRow({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn("flex min-w-0 items-baseline gap-2", className)}>
      <dt className="shrink-0 text-fg-subtle">{label}</dt>
      <dd className="min-w-0 flex-1 truncate font-mono text-fg-muted" title={value}>
        {value}
      </dd>
    </div>
  );
}
