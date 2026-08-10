use std::fmt;
use std::path::Path;

/// Every command returns this. It serialises to a plain string so the frontend
/// can put the exact message straight into an error toast.
#[derive(Debug)]
pub struct Error(pub String);

pub type Result<T> = std::result::Result<T, Error>;

impl Error {
    pub fn msg(m: impl Into<String>) -> Self {
        Error(m.into())
    }
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

impl std::error::Error for Error {}

impl serde::Serialize for Error {
    fn serialize<S: serde::Serializer>(&self, s: S) -> std::result::Result<S::Ok, S::Error> {
        s.serialize_str(&self.0)
    }
}

impl From<std::io::Error> for Error {
    fn from(e: std::io::Error) -> Self {
        Error(e.to_string())
    }
}

impl From<serde_json::Error> for Error {
    fn from(e: serde_json::Error) -> Self {
        Error(format!("Invalid data in db.json: {e}"))
    }
}

/// Attaches "what we were doing" to an io error, so toasts read like
/// `Copy failed (/pool/x -> /game/mods/x): Permission denied`.
pub trait Ctx<T> {
    fn ctx_path(self, what: &str, p: &Path) -> Result<T>;
    fn ctx_pair(self, what: &str, from: &Path, to: &Path) -> Result<T>;
}

impl<T, E: fmt::Display> Ctx<T> for std::result::Result<T, E> {
    fn ctx_path(self, what: &str, p: &Path) -> Result<T> {
        self.map_err(|e| Error(format!("{what} ({}): {e}", p.display())))
    }

    fn ctx_pair(self, what: &str, from: &Path, to: &Path) -> Result<T> {
        self.map_err(|e| {
            Error(format!(
                "{what} ({} -> {}): {e}",
                from.display(),
                to.display()
            ))
        })
    }
}
