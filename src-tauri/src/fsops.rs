use std::collections::BTreeMap;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};

use crate::error::{Ctx, Error, Result};
use crate::models::ModKind;

/// Copy a file or a whole directory tree to `dst`.
pub fn copy_any(src: &Path, dst: &Path) -> Result<()> {
    let meta = fs::symlink_metadata(src).ctx_path("Cannot read source", src)?;
    if meta.is_dir() {
        fs::create_dir_all(dst).ctx_path("Cannot create folder", dst)?;
        copy_dir_contents(src, dst)
    } else {
        if let Some(parent) = dst.parent() {
            fs::create_dir_all(parent).ctx_path("Cannot create folder", parent)?;
        }
        fs::copy(src, dst).ctx_pair("Copy failed", src, dst)?;
        Ok(())
    }
}

/// Copy everything *inside* `src` into `dst` (merging into whatever is there).
pub fn copy_dir_contents(src: &Path, dst: &Path) -> Result<()> {
    fs::create_dir_all(dst).ctx_path("Cannot create folder", dst)?;
    for entry in fs::read_dir(src).ctx_path("Cannot read folder", src)? {
        let entry = entry.ctx_path("Cannot read folder entry in", src)?;
        let from = entry.path();
        let to = dst.join(entry.file_name());
        if entry
            .file_type()
            .ctx_path("Cannot inspect", &from)?
            .is_dir()
        {
            copy_dir_contents(&from, &to)?;
        } else {
            if let Some(parent) = to.parent() {
                fs::create_dir_all(parent).ctx_path("Cannot create folder", parent)?;
            }
            fs::copy(&from, &to).ctx_pair("Copy failed", &from, &to)?;
        }
    }
    Ok(())
}

/// Delete a file or a directory tree. Missing paths are not an error.
pub fn remove_any(p: &Path) -> Result<()> {
    match fs::symlink_metadata(p) {
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(Error(format!("Cannot inspect ({}): {e}", p.display()))),
        Ok(meta) => {
            if meta.is_dir() {
                fs::remove_dir_all(p).ctx_path("Delete failed", p)?;
            } else {
                fs::remove_file(p).ctx_path("Delete failed", p)?;
            }
            Ok(())
        }
    }
}

/// Rename, falling back to copy+delete when the paths live on different mounts.
pub fn move_any(src: &Path, dst: &Path) -> Result<()> {
    if let Some(parent) = dst.parent() {
        fs::create_dir_all(parent).ctx_path("Cannot create folder", parent)?;
    }
    if fs::rename(src, dst).is_ok() {
        return Ok(());
    }
    copy_any(src, dst)?;
    remove_any(src)
}

/// Every file under `root`, as `/`-separated paths relative to it.
/// A `root` that is itself a file yields a single entry: its file name.
pub fn walk_files(root: &Path) -> Result<BTreeMap<String, PathBuf>> {
    let mut out = BTreeMap::new();
    let meta = match fs::symlink_metadata(root) {
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(out),
        Err(e) => return Err(Error(format!("Cannot inspect ({}): {e}", root.display()))),
        Ok(m) => m,
    };
    if meta.is_dir() {
        walk_into(root, "", &mut out)?;
    } else {
        let name = root
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "file".to_string());
        out.insert(name, root.to_path_buf());
    }
    Ok(out)
}

fn walk_into(dir: &Path, prefix: &str, out: &mut BTreeMap<String, PathBuf>) -> Result<()> {
    for entry in fs::read_dir(dir).ctx_path("Cannot read folder", dir)? {
        let entry = entry.ctx_path("Cannot read folder entry in", dir)?;
        let name = entry.file_name().to_string_lossy().to_string();
        let rel = if prefix.is_empty() {
            name
        } else {
            format!("{prefix}/{name}")
        };
        let path = entry.path();
        if entry.file_type().ctx_path("Cannot inspect", &path)?.is_dir() {
            walk_into(&path, &rel, out)?;
        } else {
            out.insert(rel, path);
        }
    }
    Ok(())
}

/// Remove directories that became empty after a deployment was pulled out,
/// stopping before `stop_at` so we never touch the game's own mods folder.
pub fn prune_empty_dirs(start: &Path, stop_at: &Path) {
    let mut cur = start.to_path_buf();
    while cur.starts_with(stop_at) && cur != stop_at {
        let is_empty = fs::read_dir(&cur)
            .map(|mut it| it.next().is_none())
            .unwrap_or(false);
        if !is_empty {
            return;
        }
        if fs::remove_dir(&cur).is_err() {
            return;
        }
        match cur.parent() {
            Some(p) => cur = p.to_path_buf(),
            None => return,
        }
    }
}

/// Byte-for-byte comparison, short-circuiting on differing size.
pub fn files_equal(a: &Path, b: &Path) -> Result<bool> {
    let (ma, mb) = (
        fs::metadata(a).ctx_path("Cannot inspect", a)?,
        fs::metadata(b).ctx_path("Cannot inspect", b)?,
    );
    if ma.len() != mb.len() {
        return Ok(false);
    }

    let mut fa = std::io::BufReader::new(fs::File::open(a).ctx_path("Cannot open", a)?);
    let mut fb = std::io::BufReader::new(fs::File::open(b).ctx_path("Cannot open", b)?);
    let mut buf_a = [0u8; 64 * 1024];
    let mut buf_b = [0u8; 64 * 1024];
    loop {
        let na = read_full(&mut fa, &mut buf_a).ctx_path("Cannot read", a)?;
        let nb = read_full(&mut fb, &mut buf_b).ctx_path("Cannot read", b)?;
        if na != nb {
            return Ok(false);
        }
        if na == 0 {
            return Ok(true);
        }
        if buf_a[..na] != buf_b[..nb] {
            return Ok(false);
        }
    }
}

fn read_full<R: Read>(r: &mut R, buf: &mut [u8]) -> std::io::Result<usize> {
    let mut filled = 0;
    while filled < buf.len() {
        match r.read(&mut buf[filled..])? {
            0 => break,
            n => filled += n,
        }
    }
    Ok(filled)
}

// ---------------------------------------------------------------------------
// Source materialisation
// ---------------------------------------------------------------------------

/// Where each file picked by the user would land, keyed by its path relative to
/// the mod root. Mirrors [`materialize`] exactly so the update diff is truthful.
///
/// * `File` mods take exactly one source file, keyed by the mod's `file_name`
///   so that picking a differently named file still reads as a change rather
///   than an add + remove.
/// * `Folder` mods given a single directory take that directory's *contents*;
///   anything else is placed side by side under the mod root by base name.
pub fn plan_sources(
    sources: &[PathBuf],
    kind: ModKind,
    mod_file_name: &str,
) -> Result<BTreeMap<String, PathBuf>> {
    if sources.is_empty() {
        return Err(Error::msg("No files or folders were selected."));
    }

    let mut out = BTreeMap::new();
    match kind {
        ModKind::File => {
            if sources.len() != 1 {
                return Err(Error::msg(
                    "This is a file mod — select exactly one file.",
                ));
            }
            let src = &sources[0];
            if !src.is_file() {
                return Err(Error(format!(
                    "This is a file mod, but a folder was selected ({}).",
                    src.display()
                )));
            }
            out.insert(mod_file_name.to_string(), src.clone());
        }
        ModKind::Folder => {
            if sources.len() == 1 && sources[0].is_dir() {
                walk_into(&sources[0], "", &mut out)?;
            } else {
                for src in sources {
                    let name = src
                        .file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .ok_or_else(|| {
                            Error(format!("Invalid source path: {}", src.display()))
                        })?;
                    if src.is_dir() {
                        walk_into(src, &name, &mut out)?;
                    } else {
                        out.insert(name, src.clone());
                    }
                }
            }
        }
    }
    Ok(out)
}

/// Write the planned sources to `dest`, replacing whatever is there.
pub fn materialize(sources: &[PathBuf], dest: &Path, kind: ModKind) -> Result<()> {
    for src in sources {
        if !src.exists() {
            return Err(Error(format!("Source not found: {}", src.display())));
        }
    }

    remove_any(dest)?;

    match kind {
        ModKind::File => {
            let src = &sources[0];
            if let Some(parent) = dest.parent() {
                fs::create_dir_all(parent).ctx_path("Cannot create folder", parent)?;
            }
            fs::copy(src, dest).ctx_pair("Copy failed", src, dest)?;
        }
        ModKind::Folder => {
            fs::create_dir_all(dest).ctx_path("Cannot create folder", dest)?;
            if sources.len() == 1 && sources[0].is_dir() {
                copy_dir_contents(&sources[0], dest)?;
            } else {
                for src in sources {
                    let name = src.file_name().ok_or_else(|| {
                        Error(format!("Invalid source path: {}", src.display()))
                    })?;
                    copy_any(src, &dest.join(name))?;
                }
            }
        }
    }
    Ok(())
}
