import { FileUp, FolderUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pick } from "@/lib/pickers";
import type { ModKind } from "@/lib/types";
import { baseName, cn } from "@/lib/utils";

/**
 * Picks the files a mod is built from.
 *
 * A `folder` mod accepts either one folder (its *contents* become the mod) or
 * a set of loose files placed side by side. A `file` mod accepts exactly one
 * file. This mirrors how the Rust side materialises sources into the pool.
 */
export function SourcePicker({
  kind,
  sources,
  onChange,
  invalid,
}: {
  kind: ModKind;
  sources: string[];
  onChange: (next: string[]) => void;
  invalid?: boolean;
}) {
  const chooseFolder = async () => {
    const picked = await pick.folder("Select the mod folder");
    if (picked) onChange([picked]);
  };

  const chooseFiles = async () => {
    if (kind === "file") {
      const picked = await pick.file();
      if (picked) onChange([picked]);
      return;
    }
    const picked = await pick.files();
    if (picked.length > 0) onChange(picked);
  };

  const removeAt = (index: number) => onChange(sources.filter((_, i) => i !== index));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        {kind === "folder" && (
          <Button type="button" variant="secondary" size="sm" onClick={chooseFolder}>
            <FolderUp />
            Choose folder
          </Button>
        )}
        <Button type="button" variant="secondary" size="sm" onClick={chooseFiles}>
          <FileUp />
          {kind === "file" ? "Choose file" : "Choose files"}
        </Button>
      </div>

      {sources.length === 0 ? (
        <p
          className={cn(
            "rounded-md border border-dashed px-3 py-2.5 text-[12px]",
            invalid
              ? "border-danger/50 bg-danger/5 text-danger"
              : "border-border bg-surface-2/50 text-fg-subtle",
          )}
        >
          {kind === "folder"
            ? "Nothing selected — pick the folder that holds the mod, or its individual files."
            : "Nothing selected — pick the mod file."}
        </p>
      ) : (
        <ul className="flex flex-col gap-1 rounded-md border border-border bg-surface-2/50 p-1.5">
          {sources.map((src, i) => (
            <li
              key={`${src}-${i}`}
              className="flex items-center gap-2 rounded px-2 py-1 hover:bg-surface-3"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] text-fg">{baseName(src)}</span>
                <span className="block truncate text-[11px] text-fg-subtle" title={src}>
                  {src}
                </span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => removeAt(i)}
                aria-label={`Remove ${baseName(src)}`}
                className="shrink-0 hover:text-danger"
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
