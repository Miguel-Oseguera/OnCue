import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

// Process values win, then backend-local files, then Neon's workspace defaults.
for (const filename of [
  "../.env.local",
  "../.env",
  "../../../.env.local",
  "../../../.env",
]) {
  const path = fileURLToPath(new URL(filename, import.meta.url));
  if (existsSync(path)) loadEnvFile(path);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is required. Run neon deploy from the workspace root.",
  );
}

const port = Number(process.env.PORT ?? 3002);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

const databaseTarget = new URL(databaseUrl);
databaseTarget.hostname = databaseTarget.hostname.replace("-pooler.", ".");
const configuredDirectUrl = process.env.DATABASE_URL_UNPOOLED;
const directTarget = configuredDirectUrl
  ? new URL(configuredDirectUrl)
  : databaseTarget;
// A backend-local database must never inherit another branch's migration URL.
const databaseUrlUnpooled =
  directTarget.hostname === databaseTarget.hostname &&
  directTarget.pathname === databaseTarget.pathname
    ? directTarget.toString()
    : databaseTarget.toString();

export const env = { databaseUrl, databaseUrlUnpooled, port };
