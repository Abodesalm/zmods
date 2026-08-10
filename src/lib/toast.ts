import { toast } from "sonner";
import { errorMessage } from "./utils";

const AUTO_DISMISS = 3000;

export const notify = {
  success: (message: string, description?: string) =>
    toast.success(message, { description, duration: AUTO_DISMISS }),

  info: (message: string, description?: string) =>
    toast.info(message, { description, duration: AUTO_DISMISS }),

  warning: (message: string, description?: string) =>
    toast.warning(message, { description, duration: AUTO_DISMISS }),

  /** Errors stay put until dismissed — the exact backend message matters. */
  error: (message: string, cause?: unknown) =>
    toast.error(message, {
      description: cause === undefined ? undefined : errorMessage(cause),
      duration: Infinity,
      closeButton: true,
    }),
};
