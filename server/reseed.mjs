// ⚠️ DESTRUCTIVE — wipes ALL rows in the PetVibe tables and re-seeds fresh
// demo data from server/seed.js. For demo/lab databases only. To run:
//
//   npm run reseed
//
// This is the recovery path when a database is missing data (e.g. tables were
// emptied or the schema changed underneath). The normal startup path never
// deletes anything — it only adds missing demo rows via syncDemoData().
import { pool } from './db.js'
import { migrate } from './migrations.js'
import { seed } from './seed.js'

const TABLES = [
  'notifications',
  'reschedule_requests',
  'booking_status_log',
  'medical_records',
  'sessions',
  'bookings',
  'pets',
  'owners',
  'staff_schedules',
  'bundle_services',
  'bundles',
  'staff',
  'services',
]

console.log('[reseed] Wiping all PetVibe tables…')
await pool.query(`TRUNCATE TABLE ${TABLES.join(', ')} CASCADE RESTART IDENTITY`)

await migrate()
await seed()

await pool.end()
console.log('[reseed] Done — fresh demo data is in the database.')
