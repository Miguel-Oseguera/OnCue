import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { db } from './db.js'
import { env } from './env.js'

const app = new Hono()

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.get('/health/db', async (c) => {
  try {
    await db.query('SELECT 1')
    return c.json({ status: 'ok', database: 'connected' })
  } catch {
    return c.json({ status: 'error', database: 'unavailable' }, 503)
  }
})

const server = serve({
  fetch: app.fetch,
  port: env.port
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.close(() => {
      void db.end().catch(() => {
        process.exitCode = 1
      })
    })
  })
}
