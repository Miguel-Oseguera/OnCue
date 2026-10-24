import { expo } from "@better-auth/expo";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { z } from "zod";
import { db } from "./db.js";
import { env } from "./env.js";

const authEnv = z
  .object({
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url().default(`http://localhost:${env.port}`),
    AUTH_TRUSTED_ORIGINS: z.string().default(""),
  })
  .parse(process.env);

const baseURL = authEnv.BETTER_AUTH_URL;
const additionalOrigins = authEnv.AUTH_TRUSTED_ORIGINS.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const trustedOrigins = [
  new URL(baseURL).origin,
  "mobile://",
  ...additionalOrigins,
  ...(process.env.NODE_ENV === "production"
    ? []
    : ["exp://**", "http://localhost:8081", "http://127.0.0.1:8081"]),
];

export const auth = betterAuth({
  appName: "OnCue",
  baseURL,
  secret: authEnv.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: { enabled: true },
  trustedOrigins,
  plugins: [expo()],
});
