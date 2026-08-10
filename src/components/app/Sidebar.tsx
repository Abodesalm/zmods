import { Home, Library } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGames, useStore } from "@/store/useStore";
import { GameArt } from "./GameArt";

export function Sidebar() {
  const games = useGames();
  const view = useStore((s) => s.view);
  const navigate = useStore((s) => s.navigate);

  return (
    <aside className="flex w-[248px] shrink-0 flex-col border-r border-border bg-surface/60">
      <nav className="p-2.5">
        <button
          type="button"
          onClick={() => navigate({ kind: "home" })}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors",
            view.kind === "home"
              ? "bg-accent/12 text-accent"
              : "text-fg-muted hover:bg-surface-2 hover:text-fg",
          )}
        >
          <Home className="size-4" />
          Home
        </button>
      </nav>

      <div className="flex items-center gap-2 px-4 pb-2 pt-1">
        <Library className="size-3 text-fg-subtle" />
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-fg-subtle">
          Games
        </span>
        <span className="ml-auto text-[10.5px] tabular-nums text-fg-subtle">{games.length}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-3">
        {games.length === 0 ? (
          <p className="px-2.5 py-6 text-center text-[12px] leading-relaxed text-fg-subtle">
            No games yet.
            <br />
            Add one to start building a pool.
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {games.map((game) => {
              const selected = view.kind === "game" && view.gameId === game.id;
              return (
                <li key={game.id}>
                  <button
                    type="button"
                    onClick={() => navigate({ kind: "game", gameId: game.id })}
                    className={cn(
                      "group flex w-full items-center gap-2.5 rounded-md py-1.5 pl-1.5 pr-2 text-left transition-colors",
                      selected
                        ? "bg-accent/12 text-accent"
                        : "text-fg-muted hover:bg-surface-2 hover:text-fg",
                    )}
                  >
                    <GameArt
                      gameId={game.id}
                      fileName={game.icon}
                      name={game.name}
                      rounded="rounded-md"
                      className="size-7 shrink-0 ring-1 ring-border"
                      fallbackClassName="text-[10px]"
                    />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                      {game.name}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums transition-colors",
                        selected
                          ? "bg-accent/20 text-accent"
                          : "bg-surface-3 text-fg-subtle group-hover:text-fg-muted",
                      )}
                      title={`${game.mods.length} mod${game.mods.length === 1 ? "" : "s"} in pool`}
                    >
                      {game.mods.length}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
