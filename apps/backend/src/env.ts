import { existsSync } from 'node:fs'
import { loadEnvFile } from 'node:process'
import { fileURLToPath } from 'node:url'

// Neon writes environment files at the workspace root, outside this app.
for (const filename of ['.env.local', '.env']) {
  const path = fileURLToPath(new URL(`../../../${filename}`, import.meta.url))
  if (existsSync(path)) loadEnvFile(path)
}

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required. Run neon deploy from the workspace root.')
}

const port = Number(process.env.PORT ?? 3002)
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.')
}

export const env = { databaseUrl, port }
