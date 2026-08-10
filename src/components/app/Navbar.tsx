import { Plus, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { useStore } from "@/store/useStore";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";

export function Navbar({ onAddGame }: { onAddGame: () => void }) {
  const view = useStore((s) => s.view);
  const navigate = useStore((s) => s.navigate);
  const onSettings = view.kind === "settings";

  return (
    <header
      data-tauri-drag-region
      className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-surface/80 px-4 backdrop-blur"
    >
      <button
        type="button"
        onClick={() => navigate({ kind: "home" })}
        className="no-drag group flex items-center gap-2.5 rounded-md px-1 py-1 outline-none"
      >
        <Logo className="size-7 transition-transform group-hover:scale-105" />
        <span className="text-[15px] font-semibold tracking-tight text-fg">
          Z<span className="text-fg-muted">Mods</span>
        </span>
      </button>

      <div className="no-drag flex items-center gap-2">
        <Button variant="accent" size="md" onClick={onAddGame}>
          <Plus />
          Add Game
        </Button>
        <Tooltip content="Settings">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Settings"
            onClick={() => navigate({ kind: "settings" })}
            className={cn(onSettings && "bg-surface-2 text-fg")}
          >
            <Settings className={cn("transition-transform", onSettings && "rotate-45")} />
          </Button>
        </Tooltip>
      </div>
    </header>
  );
}
