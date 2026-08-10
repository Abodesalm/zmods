import * as React from "react";
import { cn } from "@/lib/utils";
import { assetKey, useStore } from "@/store/useStore";

/** Reads a game asset out of the pool (cached, one fetch per file). */
export function useGameAsset(gameId: string, fileName: string): string | null {
  const loadAsset = useStore((s) => s.loadAsset);
  const src = useStore((s) => (fileName ? (s.assets[assetKey(gameId, fileName)] ?? null) : null));

  React.useEffect(() => {
    if (fileName) loadAsset(gameId, fileName);
  }, [gameId, fileName, loadAsset]);

  return src;
}

/** Deterministic accent-tinted fallback so art-less games still look placed. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function GameArt({
  gameId,
  fileName,
  name,
  className,
  imgClassName,
  fallbackClassName,
  rounded = "rounded-lg",
}: {
  gameId: string;
  fileName: string;
  name: string;
  className?: string;
  imgClassName?: string;
  fallbackClassName?: string;
  rounded?: string;
}) {
  const src = useGameAsset(gameId, fileName);

  return (
    <div className={cn("relative overflow-hidden bg-surface-2", rounded, className)}>
      {src ? (
        <img
          src={src}
          alt={name}
          draggable={false}
          className={cn("fade-in-img size-full object-cover", imgClassName)}
        />
      ) : (
        <div
          className={cn(
            "flex size-full items-center justify-center bg-gradient-to-br from-accent/22 via-surface-2 to-surface-3 font-semibold tracking-wide text-fg-muted",
            fallbackClassName,
          )}
        >
          {initials(name)}
        </div>
      )}
    </div>
  );
}
