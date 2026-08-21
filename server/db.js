import pg from 'pg'
import 'dotenv/config'

const { Pool } = pg

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Add it to your .env file (see README).')
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Supabase requires SSL
  // Without these, a bad/unreachable DATABASE_URL (paused Supabase project,
  // wrong password, no network) makes every query hang forever instead of
  // failing — and since server/index.js awaits seed() before app.listen(),
  // the whole API server would silently never start.
  connectionTimeoutMillis: 8000,
  statement_timeout: 15000,
  query_timeout: 15000,
})

pool.on('error', (err) => {
  // Idle client errors (e.g. connection dropped by Supabase) would otherwise
  // crash the process with an unhandled 'error' event.
  console.error('[db] unexpected pool error:', err.message)
})

// Thin helper layer so the rest of the app can stay close to the old
// db.prepare(sql).get/all/run(...params) shape, but async + Postgres-flavored.
// IMPORTANT: sql here must already use Postgres placeholders ($1, $2, ...),
// not SQLite's `?`.

export async function dbGet(sql, params = []) {
  const { rows } = await pool.query(sql, params)
  return rows[0] ?? null
}

export async function dbAll(sql, params = []) {
  const { rows } = await pool.query(sql, params)
  return rows
}

// For INSERT/UPDATE/DELETE. Pass a RETURNING clause in sql if you need the
// new row's id back (Postgres has no lastInsertRowid).
export async function dbRun(sql, params = []) {
  const result = await pool.query(sql, params)
  return { rowCount: result.rowCount, rows: result.rows }
}

// Run fn(client) inside a single transaction — commits on success, rolls
// everything back on error. Used for multi-statement deletes that must be
// all-or-nothing (e.g. deleting a client account and its dependent rows).
export async function withTransaction(fn) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}