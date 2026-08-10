import { open } from "@tauri-apps/plugin-dialog";
import { notify } from "./toast";
import { errorMessage } from "./utils";

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "bmp", "avif", "svg"];

function asArray(result: string | string[] | null): string[] {
  if (result === null) return [];
  return Array.isArray(result) ? result : [result];
}

async function guard<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    notify.error("Could not open the file picker", errorMessage(e));
    return fallback;
  }
}

export const pick = {
  folder: (title: string, defaultPath?: string) =>
    guard(
      async () =>
        asArray(await open({ directory: true, multiple: false, title, defaultPath }))[0] ?? null,
      null as string | null,
    ),

  image: (title = "Select an image") =>
    guard(
      async () =>
        asArray(
          await open({
            multiple: false,
            title,
            filters: [{ name: "Images", extensions: IMAGE_EXTENSIONS }],
          }),
        )[0] ?? null,
      null as string | null,
    ),

  /** Single file — used for `file` mods, which map one source to one file. */
  file: (title = "Select the mod file") =>
    guard(
      async () => asArray(await open({ multiple: false, title }))[0] ?? null,
      null as string | null,
    ),

  /** One or more files that will sit side by side inside a folder mod. */
  files: (title = "Select the mod files") =>
    guard(async () => asArray(await open({ multiple: true, title })), [] as string[]),
};
