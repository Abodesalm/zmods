import { openPath, openUrl } from "@tauri-apps/plugin-opener";
import { notify } from "./toast";
import { errorMessage } from "./utils";

export async function openExternal(url: string) {
  if (!url.trim()) return;
  try {
    await openUrl(url.trim());
  } catch (e) {
    notify.error("Could not open link", errorMessage(e));
  }
}

export async function revealFolder(path: string) {
  if (!path.trim()) return;
  try {
    await openPath(path.trim());
  } catch (e) {
    notify.error("Could not open folder", errorMessage(e));
  }
}
