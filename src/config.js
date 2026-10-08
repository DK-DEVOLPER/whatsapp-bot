import "dotenv/config";

export const config = {
  phoneNumber: process.env.PHONE_NUMBER || "",
  sessionDir: process.env.SESSION_DIR || "./auth",
  prefix: process.env.PREFIX || "!",
  reconnect: {
    maxRetries: parseInt(process.env.MAX_RETRIES || "10", 10),
    baseDelay: parseInt(process.env.RECONNECT_DELAY || "2000", 10),
    maxDelay: parseInt(process.env.MAX_RECONNECT_DELAY || "60000", 10),
  },
  pluginsDir: process.env.PLUGINS_DIR || "./plugins",
};
