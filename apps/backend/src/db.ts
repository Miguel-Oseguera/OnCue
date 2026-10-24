import { Pool } from '@neondatabase/serverless'
import { env } from './env.js'

// WebSockets work where outbound Postgres TCP is unavailable. Node 24 supplies WebSocket.
export const db = new Pool({
  connectionString: env.databaseUrl,
  max: 5,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
})

db.on('error', () => {
  console.error('An idle database connection failed.')
})
