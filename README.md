<<<<<<< HEAD
# PetVibe Care 🐾

Pet care web portal for a veterinary clinic — public marketing site, client portal, and admin/staff dashboard. Built from the PetVibe Care master prompt (ERD, roles, business rules).

## Tech stack

- **Frontend:** React 19 + Vite, React Router 7, Tailwind CSS v4 (brand palette: deep teal `#0A4D52`, sage `#E8F3EE`, amber `#FF8C42`, charcoal `#1F2937`)
- **Backend:** Node.js + Express, SQLite via the built-in `node:sqlite` driver (no native deps — Node 24+ required)
- **Demo mode:** the frontend ships with an in-browser mock of the API, so the whole site works even with the server stopped

## Quick start

```bash
npm install

# terminal 1 — API server (http://localhost:3001)
npm run dev:server

# terminal 2 — frontend (http://localhost:5173)
npm run dev
```

The Vite dev server proxies `/api` → `localhost:3001`. The SQLite database lives at `server/data/petvibe.db` and is auto-created + seeded on first run (69 services across all 22 catalog categories, 4 bundles, staff, demo owner/pets, sample bookings & medical records).

### Demo accounts

| Role | Email | Password |
|---|---|---|
| Admin | `admin@petvibe.ph` | `password123` |
| Staff (Vet) | `vet@petvibe.ph` | `password123` |
| Staff (Groomer) | `liza@petvibe.ph` | `password123` |

Both are one-click fillable on the login page.

### Demo mode (no backend needed)

If the API server isn't running, the frontend automatically switches to a built-in mock (same data model, in-browser). You can also force it with `?mock=1` on any URL, or `VITE_API_MODE=mock`.

## Email notifications (Gmail)

Booking emails (confirmation, reschedule, rebooking, staff alerts) are sent through **Gmail SMTP via Nodemailer**. Until Gmail is configured the app stays in *simulated* mode — the notification row is still recorded in the app (client portal / admin inbox) and the email is logged to the server console, but nothing is actually sent.

Add these to your `.env` to turn on real delivery:

```
GMAIL_USER=petvibe.clinic@gmail.com          # the Gmail address that sends
GMAIL_APP_PASSWORD=abcd efgh ijkl mnop        # Google app password (spaces optional)
EMAIL_FROM_NAME=PetVibe Care                  # optional: display name in the inbox
EMAIL_TEST_TO=you@gmail.com                   # optional: redirect ALL emails here (dev)
```

To get an app password:

1. Turn on **2-Step Verification** for the Gmail account: https://myaccount.google.com/security
2. Create an app password: https://myaccount.google.com/apppasswords (choose *Mail* → *Other* → name it `petvibe`)
3. Paste the 16-character password into `GMAIL_APP_PASSWORD` and restart the server.

Notes:

- The sending Gmail must have SMTP enabled; app passwords don't work with plain account passwords.
- Staff alerts only reach staff members who have a real email address in the `staff` table (seed data uses placeholders like `vet@petvibe.ph` — update them in the admin Staff page or DB).
- Free Gmail accounts are limited to ~500 messages/day; Workspace accounts get ~2,000. For higher volume, swap the transport in `server/mailer.js` for a dedicated provider (Resend, SendGrid, SES) — `sendEmail()` / `notifyStaff()` in `server/index.js` don't change.

## What's built

**Public site** — Landing (hero, services teaser, features, meet the team), Services catalog with category filters + per-service detail incl. pre-visit instructions, Pricing list, Bundles.

**Client portal** (`/portal`) — Overview, My Pets (+ add/edit/remove, per-pet medical history timeline), My Bookings (status + reference codes), Profile.

**Booking flow** (`/book`) — Multi-step: date calendar (past/Sunday disabled) → time slots (booked slots blocked) → service (client-bookable only; Surgery/Confinement hidden per business rule #6) → pet (or add new inline) → review with conditional pre-visit instructions (fasting/anesthesia/weight/recovery) → confirmation with `PV-####` reference, late-policy reminder, and simulated confirmation email.

**Admin dashboard** (`/admin`) — Stats cards + today's timeline + approval queue; appointments table with filters, confirm/complete/cancel/no-show/rebook actions, staff assignment, rescheduling, and a detail view that logs medical records directly; customer pets (search + per-pet medical history + bookings); staff schedule grid (weekly availability per staff member); analytics (bookings over time, revenue by service, staff performance, status breakdown); and a walk-in/ER flow that creates owner + pet + booking inline with no account.

## Business rules enforced

- Only registered clients can book online; `Owner.account_type = walk_in` covers counter-created profiles (ERD decision).
- `Service.client_bookable` gates booking both in the UI (hidden) and in the API (403).
- Late arrival → admin marks `no_show` → automatic rebooking email (notification row + Gmail send when configured).
- Medical records are write-only for staff, always tied to a booking or visit.
- Slot conflicts return 409; past dates rejected.

## Project structure

```
server/
  schema.sql        # ERD schema (portable to PostgreSQL/MySQL)
  db.js             # node:sqlite connection + schema apply
  seed.js           # seed data (services, bundles, staff, demo users, bookings)
  index.js          # Express API (auth, bookings, records, schedule, analytics, walk-in)
  smoke.mjs         # API smoke test — node server/smoke.mjs (needs server running)
src/
  lib/api.js        # API client (auto-falls back to mock)
  lib/mockdb.js     # in-browser mock of the API
  lib/auth.jsx      # auth context
  components/       # UI primitives, calendar, public layout
  pages/            # public pages, booking flow, portal/, admin/
scripts/
  cdp-test.mjs      # headless-Chrome end-to-end check of portal/admin (needs Chrome on :9333)
```

## Swapping in your real database

The schema in `server/schema.sql` mirrors the ERD and ports to PostgreSQL/MySQL with minor syntax changes (drop `STRICT`/`CHECK` syntax you don't want, swap `INTEGER PRIMARY KEY AUTOINCREMENT` for `SERIAL PRIMARY KEY`). The Express routes in `server/index.js` use prepared statements via `server/db.js` — replace that one file with a `pg`/`mysql2` client and the rest of the API works unchanged. Email sending lives in `server/mailer.js` (Gmail SMTP by default, simulated until configured — see *Email notifications (Gmail)* above).

=======
>>>>>>> 7e3dbe5c5cde6071261aa572021c790c0e902f0e
## Scripts

- `npm run dev` — Vite dev server
- `npm run dev:server` — API server
- `npm run build` — production build
- `npm run lint` — oxlint
- `npm run preview` — preview the production build
