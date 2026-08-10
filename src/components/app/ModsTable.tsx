import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  Ban,
  CheckCircle2,
  ChevronsUpDown,
  CircleSlash,
  ExternalLink,
  File,
  Folder,
  MoreHorizontal,
  Package,
  PackageMinus,
  Pencil,
  Play,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { actions } from "@/lib/actions";
import { openExternal } from "@/lib/external";
import type { Game, Mod, ModStatus } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";
import { allTags } from "@/store/useStore";
import { ConfirmDialog, useConfirm } from "./ConfirmDialog";
import { ModEditDrawer } from "./ModEditDrawer";
import { ModUpdateDrawer } from "./ModUpdateDrawer";

const ALL = "__all__";

type SortKey = "display_name" | "status" | "version" | "date_added";
type Sort = { key: SortKey; dir: "asc" | "desc" };

const STATUS_ORDER: Record<ModStatus, number> = { active: 0, none: 1, disabled: 2, broken: 3 };

export function ModsTable({ game }: { game: Game }) {
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<string>(ALL);
  const [tag, setTag] = React.useState<string>(ALL);
  const [sort, setSort] = React.useState<Sort>({ key: "date_added", dir: "desc" });

  const [editing, setEditing] = React.useState<Mod | null>(null);
  const [updating, setUpdating] = React.useState<Mod | null>(null);
  const { options, confirm, close } = useConfirm();

  const tags = React.useMemo(() => allTags(game.mods), [game.mods]);

  // Filters that no longer match anything would silently hide the whole table.
  React.useEffect(() => {
    if (tag !== ALL && !tags.some((t) => t.toLowerCase() === tag.toLowerCase())) setTag(ALL);
  }, [tags, tag]);

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = game.mods.filter((m) => {
      if (status !== ALL && m.status !== status) return false;
      if (tag !== ALL && !m.tags.some((t) => t.toLowerCase() === tag.toLowerCase())) return false;
      if (!q) return true;
      return (
        m.display_name.toLowerCase().includes(q) ||
        m.file_name.toLowerCase().includes(q) ||
        m.version.toLowerCase().includes(q) ||
        m.notes.toLowerCase().includes(q) ||
        m.tags.some((t) => t.toLowerCase().includes(q))
      );
    });

    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      switch (sort.key) {
        case "status":
          return (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) * dir;
        case "version":
          return a.version.localeCompare(b.version, undefined, { numeric: true }) * dir;
        case "date_added":
          return (Date.parse(a.date_added) - Date.parse(b.date_added)) * dir;
        default:
          return a.display_name.localeCompare(b.display_name) * dir;
      }
    });
  }, [game.mods, query, status, tag, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );

  const filtering = query.trim() !== "" || status !== ALL || tag !== ALL;
  const clearFilters = () => {
    setQuery("");
    setStatus(ALL);
    setTag(ALL);
  };

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-subtle" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search mods, tags, notes…"
            className="pl-8"
            aria-label="Search mods"
          />
        </div>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[150px]" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {(Object.keys(STATUS_LABELS) as ModStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={tag} onValueChange={setTag} disabled={tags.length === 0}>
          <SelectTrigger className="w-[150px]" aria-label="Filter by tag">
            <SelectValue placeholder="All tags" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All tags</SelectItem>
            {tags.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {filtering && (
          <Button variant="ghost" size="icon" onClick={clearFilters} aria-label="Clear filters">
            <X />
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="overflow-x-auto">
          {/* Fixed layout: every column but Name is pinned, Name takes the rest. */}
          <table className="w-full min-w-[820px] table-fixed border-collapse text-left">
            <thead>
              <tr className="border-b border-border bg-surface-2/50 text-[11px] uppercase tracking-wider text-fg-subtle">
                <SortableTh
                  label="Name"
                  active={sort.key === "display_name"}
                  dir={sort.dir}
                  onClick={() => toggleSort("display_name")}
                  className="pl-4"
                />
                <SortableTh
                  label="Status"
                  active={sort.key === "status"}
                  dir={sort.dir}
                  onClick={() => toggleSort("status")}
                  className="w-[136px] whitespace-nowrap"
                />
                <SortableTh
                  label="Version"
                  active={sort.key === "version"}
                  dir={sort.dir}
                  onClick={() => toggleSort("version")}
                  className="w-[104px] whitespace-nowrap"
                />
                <th className="w-[220px] px-3 py-2.5 font-semibold">Tags</th>
                <SortableTh
                  label="Date added"
                  active={sort.key === "date_added"}
                  dir={sort.dir}
                  onClick={() => toggleSort("date_added")}
                  className="w-[124px] whitespace-nowrap"
                />
                <th className="w-[56px] px-3 py-2.5 text-right font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((mod) => (
                <ModRow
                  key={mod.id}
                  game={game}
                  mod={mod}
                  onEdit={() => setEditing(mod)}
                  onUpdate={() => setUpdating(mod)}
                  confirm={confirm}
                />
              ))}
            </tbody>
          </table>
        </div>

        {visible.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <Package className="size-7 text-fg-subtle" />
            {game.mods.length === 0 ? (
              <>
                <p className="text-[13px] font-medium text-fg">This pool is empty</p>
                <p className="max-w-xs text-[12px] leading-relaxed text-fg-subtle">
                  Add a mod to copy its files into the pool. From there you can apply it to{" "}
                  {game.name} whenever you want.
                </p>
              </>
            ) : (
              <>
                <p className="text-[13px] font-medium text-fg">No mods match those filters</p>
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      <ModEditDrawer
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        game={game}
        mod={editing}
      />
      <ModUpdateDrawer
        open={updating !== null}
        onOpenChange={(o) => !o && setUpdating(null)}
        game={game}
        mod={updating}
      />
      <ConfirmDialog options={options} onOpenChange={close} />
    </>
  );
}

function SortableTh({
  label,
  active,
  dir,
  onClick,
  className,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  className?: string;
}) {
  const Icon = !active ? ChevronsUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className={cn("px-3 py-2.5 font-semibold", className)}>
      {/* Preflight resets `text-transform` on buttons, so re-state it here. */}
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "group inline-flex items-center gap-1 rounded uppercase tracking-wider transition-colors hover:text-fg",
          active && "text-fg",
        )}
      >
        {label}
        <Icon
          className={cn(
            "size-3 transition-opacity",
            active ? "opacity-100" : "opacity-0 group-hover:opacity-60",
          )}
        />
      </button>
    </th>
  );
}

function ModRow({
  game,
  mod,
  onEdit,
  onUpdate,
  confirm,
}: {
  game: Game;
  mod: Mod;
  onEdit: () => void;
  onUpdate: () => void;
  confirm: ReturnType<typeof useConfirm>["confirm"];
}) {
  const KindIcon = mod.type === "folder" ? Folder : File;

  const removeFromPool = () =>
    confirm({
      title: `Remove "${mod.display_name}" from the pool?`,
      destructive: true,
      confirmLabel: "Remove from pool",
      description: (
        <>
          <p>
            Its files are deleted from the pool
            {mod.status === "active" ? " and from the game's mods folder" : ""}. This cannot be
            undone.
          </p>
          <p className="font-mono text-[11.5px] text-fg-subtle">{mod.file_name}</p>
        </>
      ),
      onConfirm: () => actions.removeModFromPool(game.id, mod.id, mod.display_name),
    });

  const removeFromGame = () =>
    confirm({
      title: `Remove "${mod.display_name}" from ${game.name}?`,
      confirmLabel: "Remove from game",
      description: (
        <>
          <p>
            Deletes the {mod.deployed_files.length} file
            {mod.deployed_files.length === 1 ? "" : "s"} this mod deployed. It stays in the pool, so
            you can apply it again later.
          </p>
          <p className="font-mono text-[11.5px] text-fg-subtle">{game.mods_path}</p>
        </>
      ),
      onConfirm: () => actions.removeModFromGame(game.id, mod.id, mod.display_name),
    });

  return (
    <tr className="group border-b border-border/70 transition-colors last:border-0 hover:bg-surface-2/50">
      <td className="py-2.5 pl-4 pr-3">
        <div className="flex items-center gap-2.5">
          <KindIcon className="size-3.5 shrink-0 text-fg-subtle" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[13px] font-medium text-fg">{mod.display_name}</span>
              {mod.url && (
                <Tooltip content="Open mod page">
                  <button
                    type="button"
                    onClick={() => openExternal(mod.url)}
                    className="shrink-0 text-fg-subtle opacity-0 transition-opacity hover:text-accent group-hover:opacity-100"
                    aria-label={`Open ${mod.display_name} page`}
                  >
                    <ExternalLink className="size-3" />
                  </button>
                </Tooltip>
              )}
            </div>
            <span
              className="block truncate font-mono text-[11px] text-fg-subtle"
              title={mod.file_name}
            >
              {mod.file_name}
            </span>
          </div>
        </div>
      </td>

      <td className="px-3 py-2.5">
        <StatusBadge status={mod.status} />
      </td>

      <td className="px-3 py-2.5 text-[12.5px] tabular-nums text-fg-muted">
        {mod.version || "—"}
      </td>

      <td className="px-3 py-2.5">
        {mod.tags.length === 0 ? (
          <span className="text-[12.5px] text-fg-subtle">—</span>
        ) : (
          // Capped at two so the row never grows to a second line.
          <div className="flex items-center gap-1 overflow-hidden">
            {mod.tags.slice(0, 2).map((t) => (
              <Badge key={t} tone="outline" className="max-w-[92px] truncate">
                {t}
              </Badge>
            ))}
            {mod.tags.length > 2 && (
              <Tooltip content={mod.tags.slice(2).join(", ")}>
                <Badge tone="outline">+{mod.tags.length - 2}</Badge>
              </Tooltip>
            )}
          </div>
        )}
      </td>

      <td className="px-3 py-2.5 text-[12.5px] text-fg-muted">{formatDate(mod.date_added)}</td>

      <td className="px-3 py-2.5 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Actions for ${mod.display_name}`}
              className="data-[state=open]:bg-surface-3 data-[state=open]:text-fg"
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Deployment</DropdownMenuLabel>
            <DropdownMenuItem
              disabled={mod.status === "disabled" || mod.status === "broken"}
              onSelect={() => actions.applyMod(game.id, mod.id, mod.display_name)}
            >
              <Play />
              {mod.status === "active" ? "Re-apply" : "Apply"}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={mod.deployed_files.length === 0}
              onSelect={removeFromGame}
            >
              <PackageMinus />
              Remove from game
            </DropdownMenuItem>
            {mod.status === "disabled" ? (
              <DropdownMenuItem onSelect={() => actions.enableMod(game.id, mod.id, mod.display_name)}>
                <CheckCircle2 />
                Enable
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                disabled={mod.status === "broken"}
                onSelect={() => actions.disableMod(game.id, mod.id, mod.display_name)}
              >
                <Ban />
                Disable
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />
            <DropdownMenuLabel>Mod</DropdownMenuLabel>
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onUpdate}>
              <RefreshCw />
              Update
            </DropdownMenuItem>
            {mod.status !== "broken" && (
              <DropdownMenuItem
                onSelect={() => actions.markModBroken(game.id, mod.id, mod.display_name)}
              >
                <CircleSlash />
                Mark as broken
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={removeFromPool}>
              <Trash2 />
              Remove from pool
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}
