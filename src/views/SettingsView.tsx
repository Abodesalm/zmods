import * as React from "react";
import { Check, FolderOpen, Monitor, Moon, Palette, Pipette, Sun, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip } from "@/components/ui/tooltip";
import { ConfirmDialog, useConfirm } from "@/components/app/ConfirmDialog";
import { actions } from "@/lib/actions";
import { revealFolder } from "@/lib/external";
import { pick } from "@/lib/pickers";
import { applyAccent, applyFont, applyTheme, fontStack } from "@/lib/theme";
import { FONT_OPTIONS, ACCENT_PRESETS, type AppSettings, type Theme } from "@/lib/types";
import { cn, isValidHex, normalizeHex } from "@/lib/utils";
import { useStore } from "@/store/useStore";

const THEMES: { value: Theme; label: string; icon: React.ReactNode }[] = [
  { value: "light", label: "Light", icon: <Sun className="size-3.5" /> },
  { value: "dark", label: "Dark", icon: <Moon className="size-3.5" /> },
  { value: "system", label: "System", icon: <Monitor className="size-3.5" /> },
];

export function SettingsView({ settings }: { settings: AppSettings }) {
  const navigate = useStore((s) => s.navigate);
  const { options, confirm, close } = useConfirm();

  const [hexDraft, setHexDraft] = React.useState(settings.accent_color);
  React.useEffect(() => setHexDraft(settings.accent_color), [settings.accent_color]);

  // The colour input streams values while dragging; paint every frame but
  // only write to db.json once the user settles.
  const saveTimer = React.useRef<number | null>(null);
  React.useEffect(
    () => () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    },
    [],
  );

  const patch = (next: Partial<AppSettings>) =>
    actions.saveSettings({ ...settings, ...next });

  const setTheme = (theme: Theme) => {
    applyTheme(theme);
    applyAccent(settings.accent_color);
    patch({ theme });
  };

  const setFont = (font: string) => {
    applyFont(font);
    patch({ font });
  };

  const setAccent = (hex: string, immediate = false) => {
    setHexDraft(hex);
    if (!isValidHex(hex)) return;
    const color = normalizeHex(hex);
    applyAccent(color);
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    if (immediate) {
      patch({ accent_color: color });
    } else {
      saveTimer.current = window.setTimeout(() => patch({ accent_color: color }), 400);
    }
  };

  const changePool = async () => {
    const picked = await pick.folder("Select the pool folder", settings.pool_path);
    if (!picked || picked === settings.pool_path) return;
    confirm({
      title: "Move the mod pool?",
      confirmLabel: "Move pool",
      description: (
        <>
          <p>Everything in the current pool is moved to the new folder.</p>
          <p className="font-mono text-[11.5px] text-fg-subtle">{settings.pool_path}</p>
          <p className="font-mono text-[11.5px] text-fg">{picked}</p>
        </>
      ),
      onConfirm: () => actions.setPoolPath(picked),
    });
  };

  return (
    <div className="mx-auto w-full max-w-[720px] px-6 py-7">
      <div className="mb-6">
        <h1 className="text-lg font-semibold tracking-tight text-fg">Settings</h1>
        <p className="mt-0.5 text-[13px] text-fg-muted">
          Changes are saved as soon as you make them.
        </p>
      </div>

      <div className="space-y-4">
        <Section title="Appearance" icon={<Palette className="size-3.5" />}>
          <Field label="Theme">
            <div className="inline-flex self-start rounded-md border border-border bg-surface-2 p-0.5">
              {THEMES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTheme(t.value)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-[5px] px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                    settings.theme === t.value
                      ? "bg-accent text-accent-fg"
                      : "text-fg-muted hover:text-fg",
                  )}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Accent color">
            <div className="flex flex-wrap items-center gap-1.5">
              {ACCENT_PRESETS.map((color) => {
                const selected = settings.accent_color.toLowerCase() === color.toLowerCase();
                return (
                  <Tooltip key={color} content={color}>
                    <button
                      type="button"
                      onClick={() => setAccent(color, true)}
                      aria-label={`Accent ${color}`}
                      className={cn(
                        "flex size-7 items-center justify-center rounded-full border transition-transform hover:scale-110",
                        selected ? "border-fg" : "border-border-strong",
                      )}
                      style={{ backgroundColor: color }}
                    >
                      {selected && <Check className="size-3.5 text-white drop-shadow" />}
                    </button>
                  </Tooltip>
                );
              })}

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="secondary" size="sm" className="ml-1">
                    <Pipette />
                    Custom
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-60 space-y-3" align="end">
                  <div className="space-y-1.5">
                    <Label htmlFor="accent-picker">Pick a color</Label>
                    <input
                      id="accent-picker"
                      type="color"
                      value={isValidHex(hexDraft) ? normalizeHex(hexDraft) : "#7c5cff"}
                      onChange={(e) => setAccent(e.target.value)}
                      className="h-10 w-full cursor-pointer rounded-md border border-border bg-surface-2 p-1"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="accent-hex">Hex</Label>
                    <Input
                      id="accent-hex"
                      value={hexDraft}
                      onChange={(e) => setAccent(e.target.value)}
                      onBlur={() => setHexDraft(settings.accent_color)}
                      placeholder="#7c5cff"
                      spellCheck={false}
                      className={cn(
                        "font-mono text-[12.5px]",
                        !isValidHex(hexDraft) && "border-danger focus:border-danger",
                      )}
                    />
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </Field>
        </Section>

        <Section title="Typography" icon={<Type className="size-3.5" />}>
          <Field label="Font" hint="Bundled with the app — no internet needed.">
            <Select value={settings.font} onValueChange={setFont}>
              <SelectTrigger className="max-w-[260px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_OPTIONS.map((f) => (
                  <SelectItem key={f.label} value={f.label}>
                    <span style={{ fontFamily: fontStack(f.label) }}>{f.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </Section>

        <Section title="Storage" icon={<FolderOpen className="size-3.5" />}>
          <Field
            label="Pool path"
            hint="Where every game's mod files are kept. db.json stays in the app data folder."
          >
            <div className="flex gap-2">
              <div className="flex h-9 min-w-0 flex-1 items-center rounded-md border border-border bg-surface-2 px-3">
                <span
                  className="truncate font-mono text-[12.5px] text-fg-muted"
                  title={settings.pool_path}
                >
                  {settings.pool_path}
                </span>
              </div>
              <Button variant="secondary" onClick={changePool} className="shrink-0">
                Change
              </Button>
              <Tooltip content="Open pool folder">
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label="Open pool folder"
                  onClick={() => revealFolder(settings.pool_path)}
                >
                  <FolderOpen />
                </Button>
              </Tooltip>
            </div>
          </Field>
        </Section>
      </div>

      <div className="mt-6">
        <Button variant="ghost" onClick={() => navigate({ kind: "home" })}>
          Back to library
        </Button>
      </div>

      <ConfirmDialog options={options} onOpenChange={close} />
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="mb-4 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
        {icon}
        {title}
      </h2>
      <div className="space-y-5">{children}</div>
    </section>
  );
}
