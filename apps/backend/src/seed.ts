import { db, pool } from "./db.js";
import { demoTeamId, seedDemo } from "./seed-data.js";

try {
  const created = await db.transaction(seedDemo);
  console.info(
    `${created ? "Demo data seeded" : "Demo team already exists; skipped"}. Team ID: ${demoTeamId}`,
  );
} finally {
  await pool.end();
}
