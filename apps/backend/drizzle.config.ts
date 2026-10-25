import { defineConfig } from "drizzle-kit";
import { env } from "./src/env.js";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: env.databaseUrlUnpooled },
});
