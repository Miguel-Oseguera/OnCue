import { db, pool } from "./db.js";
import { demoEventId, seedDemo } from "./seed-data.js";

try {
  const created = await db.transaction(seedDemo);
  console.info(
    `${created ? "Demo data seeded" : "Demo event already exists; skipped"}. Event ID: ${demoEventId}`,
  );
} finally {
  await pool.end();
}
