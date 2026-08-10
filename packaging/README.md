# Arch packaging

Two recipes live here:

| File | Package | Builds |
| --- | --- | --- |
| `PKGBUILD` | `zmods` | From source — needs Rust and Node, ~3 min |
| `PKGBUILD-bin` | `zmods-bin` | Repackages the release `.deb` — a few seconds |

Both install to `/usr` and are tracked by pacman, so `pacman -Rns zmods` removes
them cleanly. Your library in `~/.local/share/zmods` is never touched.

## Install it on your own machine

```bash
cd packaging
makepkg -si          # build, then install with pacman
```

That is all `pacman` needs — it installs any local `.pkg.tar.zst`. If you built
without `-i`, install it after the fact:

```bash
sudo pacman -U zmods-0.1.0-1-x86_64.pkg.tar.zst
```

> Running the `~/.local` installer earlier? Remove it first so the two copies do
> not shadow each other: `../scripts/install-local.sh --uninstall`

## Publish it so `yay -S zmods` works

`yay`, `paru` and friends are AUR helpers — they install from the
[AUR](https://aur.archlinux.org), which is a collection of git repos containing
PKGBUILDs. Publishing means pushing this PKGBUILD there.

**1.** Create an account at [aur.archlinux.org](https://aur.archlinux.org) and add
your SSH public key under *My Account*.

**2.** Check the name is free — search the AUR for `zmods` first. If it is taken,
rename the package.

**3.** Clone the (empty) AUR repo. It is created on your first push:

```bash
git clone ssh://aur@aur.archlinux.org/zmods.git aur-zmods
cd aur-zmods
cp ../packaging/PKGBUILD ../packaging/zmods.desktop .
```

**4.** Fill in the real checksums — `SKIP` is fine for local testing but the AUR
expects real ones:

```bash
updpkgsums                            # from pacman-contrib
makepkg --printsrcinfo > .SRCINFO     # required; the AUR rejects pushes without it
```

**5.** Verify it builds from a clean checkout, then push:

```bash
makepkg -f
git add PKGBUILD .SRCINFO zmods.desktop
git commit -m "Initial import: zmods 0.1.0"
git push
```

Anyone can now run `yay -S zmods`.

For `zmods-bin`, do the same with `PKGBUILD-bin` (rename it to `PKGBUILD` in that
repo) against `ssh://aur@aur.archlinux.org/zmods-bin.git`. Publishing both is
normal: `zmods` for people who want to build from source, `zmods-bin` for people
who do not want a Rust toolchain.

## Releasing a new version

1. Bump `version` in `package.json`, `src-tauri/Cargo.toml` and
   `src-tauri/tauri.conf.json`.
2. Tag and push — CI builds the release artifacts.
3. In each AUR repo: bump `pkgver`, reset `pkgrel=1`, then
   `updpkgsums && makepkg --printsrcinfo > .SRCINFO`, commit and push.

Bump `pkgrel` instead when only the PKGBUILD changed and the upstream version
did not.

## Notes on these recipes

- `options=('!lto')` — `Cargo.toml` already sets `lto`/`strip` in
  `[profile.release]`; letting makepkg add its own flags on top conflicts.
- `cargo fetch` pins `--target "$CARCH-unknown-linux-gnu"`. The default fetches
  every platform's dependencies, including Windows crates this build never uses.
- Do **not** set `CARGO_TARGET_DIR` to a relative path: tauri invokes cargo from
  `src-tauri/`, so it resolves to `src-tauri/src-tauri/target`.
- `StartupWMClass=zmods` is lowercase on purpose — that is the window class the
  app actually reports. Getting it wrong breaks taskbar icon grouping.
