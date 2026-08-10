import { Boxes, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GameArt } from "@/components/app/GameArt";
import { Logo } from "@/components/app/Logo";
import { activeModCount, useGames, useStore } from "@/store/useStore";

export function HomeView({ onAddGame }: { onAddGame: () => void }) {
  const games = useGames();
  const navigate = useStore((s) => s.navigate);

  const totalMods = games.reduce((sum, g) => sum + g.mods.length, 0);
  const totalActive = games.reduce((sum, g) => sum + activeModCount(g), 0);

  if (games.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5 px-6 text-center">
        <Logo className="size-16 opacity-90" />
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight text-fg">Welcome to ZMods</h1>
          <p className="max-w-sm text-[13px] leading-relaxed text-fg-muted">
            Add a game to build a pool of mods you can apply, disable and update without ever
            digging through the game folder by hand.
          </p>
        </div>
        <Button variant="accent" size="lg" onClick={onAddGame} className="accent-glow">
          <Plus />
          Add your first game
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 py-7">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-fg">Library</h1>
          <p className="mt-0.5 text-[13px] text-fg-muted">
            {games.length} game{games.length === 1 ? "" : "s"} · {totalMods} mod
            {totalMods === 1 ? "" : "s"} in the pool ·{" "}
            <span className="text-success">{totalActive} active</span>
          </p>
        </div>
        <Button variant="secondary" onClick={onAddGame}>
          <Plus />
          Add Game
        </Button>
      </div>

      <ul className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
        {games.map((game) => {
          const active = activeModCount(game);
          return (
            <li key={game.id}>
              <button
                type="button"
                onClick={() => navigate({ kind: "game", gameId: game.id })}
                className="group block w-full overflow-hidden rounded-xl border border-border bg-surface text-left transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-lg hover:shadow-black/25"
              >
                <div className="relative">
                  <GameArt
                    gameId={game.id}
                    fileName={game.cover_image}
                    name={game.name}
                    rounded="rounded-none"
                    className="aspect-[3/4] w-full"
                    imgClassName="transition-transform duration-300 group-hover:scale-[1.04]"
                    fallbackClassName="text-2xl"
                  />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                  {active > 0 && (
                    <span className="absolute right-2 top-2 rounded-full border border-success/30 bg-success-bg/90 px-1.5 py-0.5 text-[10.5px] font-semibold text-success backdrop-blur">
                      {active} active
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-fg">{game.name}</p>
                    <p className="flex items-center gap-1 text-[11.5px] text-fg-subtle">
                      <Boxes className="size-3" />
                      {game.mods.length} mod{game.mods.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
              </button>
            </li>
          );
        })}

        <li>
          <button
            type="button"
            onClick={onAddGame}
            className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface/40 text-fg-subtle transition-colors hover:border-accent/50 hover:bg-surface-2/60 hover:text-fg-muted"
          >
            <Plus className="size-6" />
            <span className="text-[12.5px] font-medium">Add game</span>
          </button>
        </li>
      </ul>
    </div>
  );
}
