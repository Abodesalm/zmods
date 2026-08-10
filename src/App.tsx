import * as React from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/app/Navbar";
import { Sidebar } from "@/components/app/Sidebar";
import { GameFormDialog } from "@/components/app/GameFormDialog";
import { GameView } from "@/views/GameView";
import { HomeView } from "@/views/HomeView";
import { SettingsView } from "@/views/SettingsView";
import { applySettings, watchSystemTheme } from "@/lib/theme";
import { useStore } from "@/store/useStore";

export default function App() {
  const init = useStore((s) => s.init);
  const ready = useStore((s) => s.ready);
  const loadError = useStore((s) => s.loadError);
  const db = useStore((s) => s.db);
  const view = useStore((s) => s.view);

  const [addingGame, setAddingGame] = React.useState(false);

  React.useEffect(() => {
    void init();
  }, [init]);

  const settings = db?.settings;

  // Theme, accent and font all live in db.json — re-apply whenever they change.
  React.useEffect(() => {
    if (settings) applySettings(settings);
  }, [settings?.theme, settings?.accent_color, settings?.font, settings]);

  React.useEffect(
    () =>
      watchSystemTheme(
        () => useStore.getState().db?.settings.theme ?? "dark",
        () => useStore.getState().db?.settings.accent_color ?? "#7c5cff",
      ),
    [],
  );

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-5 animate-spin text-fg-subtle" />
      </div>
    );
  }

  if (loadError || !db || !settings) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <AlertTriangle className="size-8 text-danger" />
        <div className="space-y-1.5">
          <h1 className="text-base font-semibold text-fg">ZMods could not start</h1>
          <p className="max-w-md text-[13px] leading-relaxed text-fg-muted">
            {loadError ?? "The library could not be loaded."}
          </p>
        </div>
        <Button variant="secondary" onClick={() => void init()}>
          Try again
        </Button>
      </div>
    );
  }

  const game = view.kind === "game" ? db.games.find((g) => g.id === view.gameId) : undefined;

  return (
    <TooltipProvider delayDuration={350}>
      <div className="flex h-full flex-col">
        <Navbar onAddGame={() => setAddingGame(true)} />

        <div className="flex min-h-0 flex-1">
          <Sidebar />
          <main className="min-w-0 flex-1 overflow-y-auto">
            {view.kind === "settings" ? (
              <SettingsView settings={settings} />
            ) : game ? (
              <GameView key={game.id} game={game} />
            ) : (
              <HomeView onAddGame={() => setAddingGame(true)} />
            )}
          </main>
        </div>
      </div>

      <GameFormDialog open={addingGame} onOpenChange={setAddingGame} />
      <Toaster />
    </TooltipProvider>
  );
}
