#!/usr/bin/env bash
#
# Install ZMods for the current user — no root, no package manager.
# Everything lands under ~/.local, which is already on most distros' PATH
# and XDG desktop-entry search path.
#
#   ./scripts/install-local.sh              install (builds first if needed)
#   ./scripts/install-local.sh --uninstall  remove
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN="$ROOT/src-tauri/target/release/zmods"
ICONS="$ROOT/src-tauri/icons"

PREFIX="${PREFIX:-$HOME/.local}"
BIN_DIR="$PREFIX/bin"
APP_DIR="$PREFIX/share/applications"
ICON_DIR="$PREFIX/share/icons/hicolor"
DESKTOP="$APP_DIR/zmods.desktop"

refresh_caches() {
  command -v update-desktop-database >/dev/null 2>&1 &&
    update-desktop-database "$APP_DIR" >/dev/null 2>&1 || true
  command -v gtk-update-icon-cache >/dev/null 2>&1 &&
    gtk-update-icon-cache -qtf "$ICON_DIR" >/dev/null 2>&1 || true
}

if [[ "${1:-}" == "--uninstall" ]]; then
  rm -f "$BIN_DIR/zmods" "$DESKTOP"
  for size in 32x32 128x128 256x256; do
    rm -f "$ICON_DIR/$size/apps/zmods.png"
  done
  refresh_caches
  echo "ZMods removed. Your library in ~/.local/share/zmods was left alone."
  exit 0
fi

if [[ ! -x "$BIN" ]]; then
  echo "No release build found — building it now…"
  ( cd "$ROOT" && NO_STRIP=1 npm run app:build )
fi

install -Dm755 "$BIN" "$BIN_DIR/zmods"
install -Dm644 "$ICONS/32x32.png"      "$ICON_DIR/32x32/apps/zmods.png"
install -Dm644 "$ICONS/128x128.png"    "$ICON_DIR/128x128/apps/zmods.png"
install -Dm644 "$ICONS/128x128@2x.png" "$ICON_DIR/256x256/apps/zmods.png"

install -d "$APP_DIR"

# Exec/TryExec are absolute on purpose. A bare `zmods` resolves only if
# ~/.local/bin is on PATH, and graphical sessions do not source ~/.zshrc —
# so app launchers (Caelestia, rofi, wofi, GNOME) would report
# "executable not found" while the same command worked in a terminal.
cat > "$DESKTOP" <<EOF
[Desktop Entry]
Type=Application
Name=ZMods
GenericName=Mod Manager
Comment=Keep a pool of mods per game and apply them on demand
Exec=$BIN_DIR/zmods
TryExec=$BIN_DIR/zmods
Icon=zmods
Terminal=false
Categories=Utility;
Keywords=mods;games;modding;
StartupWMClass=zmods
EOF

refresh_caches

echo "Installed:"
echo "  $BIN_DIR/zmods"
echo "  $DESKTOP"
echo
if ! command -v zmods >/dev/null 2>&1; then
  echo "Note: $BIN_DIR is not on your PATH. Add it with:"
  echo "  echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> ~/.zshrc"
fi
echo "Launch from your app menu, or run: zmods"
