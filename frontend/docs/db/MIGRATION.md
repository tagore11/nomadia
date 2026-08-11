# Storage migration: SQLite (/tmp) → Postgres / Supabase

**Why this is a launch blocker.** `lib/db.ts` uses `better-sqlite3` at a path
that is `/tmp` on Vercel. `/tmp` is wiped between cold starts and is *not shared*
across serverless instances, so:

- offers/ratings vanish unpredictably,
- two users can see different state,
- funnel analytics (the `events` table) can't accumulate for investor proof.

The escrow amounts are always authoritative on-chain, but every off-chain field
(match state, contact handles, reputation, funnel events) lives here and must
persist. This is item #1 in the launch-plan engineering order and a precondition
for analytics.

## What is already prepared

- **`docs/db/schema.postgres.sql`** — the full Postgres schema (offers, ratings,
  events), a 1:1 port of the SQLite schema in `lib/db.ts`, with RLS enabled.
- **`events` table + `logEvent()`** — already wired into the API routes
  (`offer_created`, `offer_matched`, `offer_locked`, `offer_released`,
  `offer_refunded`, `rating_submitted`). No new call sites needed after the
  swap — only the driver underneath `logEvent`/`getDb` changes.

## Steps (do these when you have a Supabase project)

1. **Create the project** at supabase.com → copy the connection string
   (Project Settings → Database → Connection string → "URI", the pooled
   `...pooler.supabase.com:6543` one for serverless).

2. **Run the schema**: paste `docs/db/schema.postgres.sql` into the Supabase SQL
   editor and run it once.

3. **Set env vars** (Vercel + `.env.local`) — use `printf`, never `echo`, when
   piping to `vercel env add` (a trailing `\n` silently corrupted the WalletConnect
   ID and bot token before — see nomadia.md):

   ```
   DATABASE_URL=postgres://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
   ```

4. **Swap the driver.** Install `postgres` (postgres.js — small, works well on
   serverless):

   ```
   npm install postgres
   ```

   Then rewrite `lib/db.ts` to expose an **async** query API backed by a pooled
   client, keeping the same row shapes (`OfferRow`, `Reputation`) and the same
   `getReputation` / `logEvent` signatures — but `async`. Example shape:

   ```ts
   import postgres from "postgres";
   const sql = postgres(process.env.DATABASE_URL!, { prepare: false }); // pgbouncer transaction mode
   export async function getReputation(telegramId: string): Promise<Reputation> {
     const [row] = await sql`
       SELECT AVG(stars)::float AS avg, COUNT(*)::int AS count
       FROM ratings WHERE rated_telegram_id = ${telegramId}`;
     return { avgStars: row.count > 0 ? Math.round((row.avg ?? 0) * 10) / 10 : null, ratingCount: row.count };
   }
   ```

5. **Make the call sites async.** better-sqlite3 is synchronous; Postgres is not.
   The API routes are already `async` functions, so this is mechanical — add
   `await` and turn the prepared-statement calls into tagged-template queries.
   Call sites to convert (all of `lib/db.ts`'s consumers):

   - `app/api/offers/route.ts` — GET (list, with the `status='open' AND expires_at > now()` filter + `direction`/`city`), POST (insert + `logEvent`)
   - `app/api/offers/[id]/route.ts` — GET (single), PATCH (the **conditional claim** `UPDATE ... WHERE id = ? AND status = 'open'`; keep this atomic — it's the anti-race guard, `sql`...`.count` gives rows affected), plus the participant update + the three `logEvent` transitions
   - `app/api/offers/mine/route.ts` — GET (participant list)
   - `app/api/offers/[id]/rate/route.ts` — POST (insert; the `uniq_rating_per_offer` unique-violation → `ALREADY_RATED` still applies, catch Postgres error code `23505`)
   - `lib/offer-view.ts` — `toPublicOffer` calls `getReputation`, so it (and its callers) become `async`

6. **Datetime formatting.** SQLite stored ISO-ish strings; Postgres returns
   `Date`/timestamptz. `PublicOffer.created_at/expires_at` are typed `string` and
   the client does `new Date(offer.created_at)` — serialize timestamps to ISO
   strings in `toPublicOffer` (`.toISOString()`) so the client contract is unchanged.

7. **Remove the SQLite stopgap.** Drop `better-sqlite3` and the `/tmp` path note
   from `lib/db.ts` once the Postgres path is verified.

## Verification

- `npx tsc --noEmit && npx eslint . && npx next build` clean.
- Create an offer as user A, claim as user B from a *different* serverless
  instance (or after a redeploy) — it must still be there and matched.
- Confirm rows land in `events` for each funnel step.

## Notes

- Keep the service-role connection server-only. RLS is enabled with no public
  policies as defence-in-depth; the API layer remains the sole access path and
  keeps enforcing `lib/auth.ts` + `lib/offer-view.ts` redaction.
- `crypto_amount NUMERIC(38,6)` / `fiat_amount NUMERIC(38,2)` — postgres.js
  returns numerics as strings by default; cast with `::float` in the query or
  `Number(...)` in the mapper to keep `OfferRow` numeric.
