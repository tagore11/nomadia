import Database from "better-sqlite3";
import path from "node:path";
import type { Reputation } from "./offer-types";

export type { Reputation } from "./offer-types";

// V0 storage per docs/PROJECT.md: Next.js API routes + SQLite. Offer metadata
// (direction, city, chat handle) lives here; the escrow amount itself is only
// ever authoritative on-chain (see NomadiaEscrow.sol).
//
// ⚠️ On Vercel, process.cwd() is a read-only deployment filesystem — writing
// there throws, not just "doesn't persist." /tmp is writable but wiped
// between cold starts, so this is stopgap-only: it keeps the app from
// crashing on Vercel, not a real production data store. Swap for a hosted DB
// (Postgres/Supabase) before real trades depend on this data surviving.
const DB_PATH =
  process.env.NOMADIA_DB_PATH || path.join(process.env.VERCEL ? "/tmp" : process.cwd(), "nomadia.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS offers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chain_offer_id INTEGER,
      direction TEXT NOT NULL CHECK (direction IN ('crypto_to_fiat', 'fiat_to_crypto')),
      crypto_amount REAL NOT NULL,
      crypto_token TEXT NOT NULL,
      fiat_amount REAL NOT NULL,
      fiat_currency TEXT NOT NULL,
      city TEXT NOT NULL,
      depositor_telegram_id TEXT NOT NULL,
      depositor_username TEXT,
      depositor_wallet TEXT,
      counterparty_telegram_id TEXT,
      counterparty_username TEXT,
      counterparty_wallet TEXT,
      depositor_contact TEXT,
      counterparty_contact TEXT,
      safe_zone TEXT,
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'matched', 'released', 'refunded', 'expired')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      offer_id INTEGER NOT NULL REFERENCES offers(id),
      rater_telegram_id TEXT NOT NULL,
      rated_telegram_id TEXT NOT NULL,
      stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_ratings_rated ON ratings(rated_telegram_id);
    -- One rating per rater per offer (backs the ALREADY_RATED guard against races).
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_rating_per_offer ON ratings(offer_id, rater_telegram_id);

    -- Funnel analytics (launch-plan §6: investor proof needs conversion data).
    -- One row per tracked step; props is a JSON blob for step-specific context.
    -- NOTE: like the offers table, this only truly persists once storage moves
    -- off SQLite /tmp to Postgres/Supabase (see docs/db/MIGRATION.md).
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      telegram_id TEXT,
      offer_id INTEGER,
      props TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_events_name ON events(name);
    CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);

    -- Registration/user data (investor metric: who signs up, how, when).
    -- Keyed on the namespaced identity (tg:… / wallet:…).
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      tier TEXT NOT NULL,
      username TEXT,
      wallet TEXT,
      first_seen TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Additive migrations for DBs created before these columns existed. SQLite has
  // no "ADD COLUMN IF NOT EXISTS", so we tolerate the duplicate-column error.
  for (const col of [
    "depositor_username TEXT",
    "counterparty_username TEXT",
    "depositor_contact TEXT",
    "counterparty_contact TEXT",
  ]) {
    try {
      db.exec(`ALTER TABLE offers ADD COLUMN ${col};`);
    } catch {
      /* column already exists */
    }
  }

  return db;
}

export type OfferRow = {
  id: number;
  chain_offer_id: number | null;
  direction: "crypto_to_fiat" | "fiat_to_crypto";
  crypto_amount: number;
  crypto_token: string;
  fiat_amount: number;
  fiat_currency: string;
  city: string;
  depositor_telegram_id: string;
  depositor_username: string | null;
  depositor_wallet: string | null;
  counterparty_telegram_id: string | null;
  counterparty_username: string | null;
  counterparty_wallet: string | null;
  depositor_contact: string | null;
  counterparty_contact: string | null;
  safe_zone: string | null;
  status: "open" | "matched" | "released" | "refunded" | "expired";
  created_at: string;
  expires_at: string;
};

// The funnel steps we track for conversion/retention analysis. Kept as a closed
// union so call sites can't typo an event name.
export type FunnelEvent =
  | "offer_created"
  | "offer_matched"
  | "offer_locked"
  | "offer_released"
  | "offer_refunded"
  | "offer_cancelled"
  | "offer_disputed"
  | "rating_submitted";

/**
 * Record a funnel event. Analytics must never break a trade action, so any
 * write failure is swallowed — a lost metric row is acceptable, a failed trade
 * is not.
 */
export function logEvent(
  name: FunnelEvent,
  opts?: { telegramId?: string | null; offerId?: number | string | null; props?: Record<string, unknown> }
): void {
  try {
    const offerId =
      opts?.offerId != null && Number.isFinite(Number(opts.offerId)) ? Number(opts.offerId) : null;
    getDb()
      .prepare("INSERT INTO events (name, telegram_id, offer_id, props) VALUES (?, ?, ?, ?)")
      .run(name, opts?.telegramId ?? null, offerId, opts?.props ? JSON.stringify(opts.props) : null);
  } catch {
    /* analytics is best-effort — never throw into a request handler */
  }
}

/** Aggregate reputation for a Telegram user from ratings received (D-014). */
export function getReputation(telegramId: string): Reputation {
  const row = getDb()
    .prepare(
      `SELECT AVG(stars) AS avg, COUNT(*) AS count FROM ratings WHERE rated_telegram_id = ?`
    )
    .get(telegramId) as { avg: number | null; count: number };
  return {
    avgStars: row.count > 0 ? Math.round((row.avg ?? 0) * 10) / 10 : null,
    ratingCount: row.count,
  };
}
