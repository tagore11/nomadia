import "server-only";
import postgres from "postgres";
import { getDb, logEvent as sqliteLogEvent, type OfferRow, type FunnelEvent } from "./db";
import type { Reputation } from "./offer-types";

export type { OfferRow } from "./db";

// Data-access layer with two interchangeable backends, chosen by DATABASE_URL:
//   - Postgres (Supabase) when DATABASE_URL is set  -> shared, persistent, so
//     offers sync across every device and serverless instance.
//   - SQLite otherwise (local dev / no DB configured) -> single-instance only.
// Every function is async so the two backends look identical to the routes.

const OFFER_EXPIRY_HOURS = 24;
const usePg = !!process.env.DATABASE_URL;

// --- Postgres client (lazy singleton) ------------------------------------
let _sql: ReturnType<typeof postgres> | null = null;
function pg() {
  if (!_sql) {
    // prepare:false is required for Supabase's transaction pooler (pgbouncer).
    _sql = postgres(process.env.DATABASE_URL as string, { prepare: false });
  }
  return _sql;
}

// Postgres returns Date/NUMERIC; normalise a row to the OfferRow shape the
// client contract expects (ISO strings, JS numbers).
function mapPgOffer(r: Record<string, unknown>): OfferRow {
  const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));
  return {
    id: Number(r.id),
    chain_offer_id: r.chain_offer_id == null ? null : Number(r.chain_offer_id),
    direction: r.direction as OfferRow["direction"],
    crypto_amount: Number(r.crypto_amount),
    crypto_token: r.crypto_token as string,
    fiat_amount: Number(r.fiat_amount),
    fiat_currency: r.fiat_currency as string,
    city: r.city as string,
    depositor_telegram_id: r.depositor_telegram_id as string,
    depositor_username: (r.depositor_username as string) ?? null,
    depositor_wallet: (r.depositor_wallet as string) ?? null,
    counterparty_telegram_id: (r.counterparty_telegram_id as string) ?? null,
    counterparty_username: (r.counterparty_username as string) ?? null,
    counterparty_wallet: (r.counterparty_wallet as string) ?? null,
    depositor_contact: (r.depositor_contact as string) ?? null,
    counterparty_contact: (r.counterparty_contact as string) ?? null,
    safe_zone: (r.safe_zone as string) ?? null,
    status: r.status as OfferRow["status"],
    created_at: iso(r.created_at),
    expires_at: iso(r.expires_at),
  };
}

// --- open offers list -----------------------------------------------------
export async function listOpenOffers(opts: { direction?: string | null; city?: string | null }): Promise<OfferRow[]> {
  const dir = opts.direction === "crypto_to_fiat" || opts.direction === "fiat_to_crypto" ? opts.direction : null;
  const city = opts.city || null;

  if (usePg) {
    const sql = pg();
    const rows = await sql`
      SELECT * FROM offers
      WHERE status = 'open' AND expires_at > now()
        AND (${dir}::text IS NULL OR direction = ${dir})
        AND (${city}::text IS NULL OR city = ${city})
      ORDER BY created_at DESC LIMIT 100`;
    return rows.map(mapPgOffer);
  }

  const clauses = ["status = 'open'", "expires_at > datetime('now')"];
  const params: (string | number)[] = [];
  if (dir) { clauses.push("direction = ?"); params.push(dir); }
  if (city) { clauses.push("city = ?"); params.push(city); }
  return getDb()
    .prepare(`SELECT * FROM offers WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC LIMIT 100`)
    .all(...params) as OfferRow[];
}

// --- single offer ---------------------------------------------------------
export async function getOffer(id: string | number): Promise<OfferRow | null> {
  if (usePg) {
    const rows = await pg()`SELECT * FROM offers WHERE id = ${Number(id)}`;
    return rows[0] ? mapPgOffer(rows[0]) : null;
  }
  return (getDb().prepare("SELECT * FROM offers WHERE id = ?").get(id) as OfferRow) ?? null;
}

// --- create offer ---------------------------------------------------------
export type NewOffer = {
  direction: string; cryptoAmount: number; cryptoToken: string;
  fiatAmount: number; fiatCurrency: string; city: string;
  depositorId: string; depositorUsername: string | null;
  depositorWallet: string | null; depositorContact: string | null;
};

export async function insertOffer(o: NewOffer): Promise<OfferRow> {
  if (usePg) {
    const sql = pg();
    const rows = await sql`
      INSERT INTO offers (direction, crypto_amount, crypto_token, fiat_amount, fiat_currency, city,
        depositor_telegram_id, depositor_username, depositor_wallet, depositor_contact, expires_at)
      VALUES (${o.direction}, ${o.cryptoAmount}, ${o.cryptoToken}, ${o.fiatAmount}, ${o.fiatCurrency}, ${o.city},
        ${o.depositorId}, ${o.depositorUsername}, ${o.depositorWallet}, ${o.depositorContact},
        now() + interval '${sql.unsafe(String(OFFER_EXPIRY_HOURS))} hours')
      RETURNING *`;
    return mapPgOffer(rows[0]);
  }
  const db = getDb();
  const res = db
    .prepare(
      `INSERT INTO offers (direction, crypto_amount, crypto_token, fiat_amount, fiat_currency, city,
        depositor_telegram_id, depositor_username, depositor_wallet, depositor_contact, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+${OFFER_EXPIRY_HOURS} hours'))`
    )
    .run(o.direction, o.cryptoAmount, o.cryptoToken, o.fiatAmount, o.fiatCurrency, o.city,
      o.depositorId, o.depositorUsername, o.depositorWallet, o.depositorContact);
  return db.prepare("SELECT * FROM offers WHERE id = ?").get(res.lastInsertRowid) as OfferRow;
}

// --- claim (atomic conditional on status='open') --------------------------
export type ClaimFields = {
  userId: string; username: string | null; cpWallet: string | null;
  cpContact: string | null; chainId: number | null;
};

export async function claimOffer(id: string | number, f: ClaimFields): Promise<OfferRow | null> {
  if (usePg) {
    const sql = pg();
    const rows = await sql`
      UPDATE offers SET status = 'matched',
        counterparty_telegram_id = ${f.userId},
        counterparty_username = ${f.username},
        counterparty_wallet = COALESCE(${f.cpWallet}, counterparty_wallet),
        counterparty_contact = COALESCE(${f.cpContact}, counterparty_contact),
        chain_offer_id = COALESCE(${f.chainId}, chain_offer_id)
      WHERE id = ${Number(id)} AND status = 'open'
      RETURNING *`;
    return rows[0] ? mapPgOffer(rows[0]) : null;
  }
  const db = getDb();
  const info = db
    .prepare(
      `UPDATE offers SET status='matched', counterparty_telegram_id=?, counterparty_username=?,
        counterparty_wallet=COALESCE(?, counterparty_wallet),
        counterparty_contact=COALESCE(?, counterparty_contact),
        chain_offer_id=COALESCE(?, chain_offer_id)
       WHERE id = ? AND status = 'open'`
    )
    .run(f.userId, f.username, f.cpWallet, f.cpContact, f.chainId, id);
  if (info.changes === 0) return null;
  return db.prepare("SELECT * FROM offers WHERE id = ?").get(id) as OfferRow;
}

// --- participant update ---------------------------------------------------
export type ParticipantUpdate = {
  status?: string | null; cpWallet?: string | null; chainId?: number | null; safeZone?: string | null;
};

export async function updateOfferByParticipant(id: string | number, u: ParticipantUpdate): Promise<OfferRow> {
  if (usePg) {
    const sql = pg();
    const rows = await sql`
      UPDATE offers SET
        status = COALESCE(${u.status ?? null}, status),
        counterparty_wallet = COALESCE(${u.cpWallet ?? null}, counterparty_wallet),
        chain_offer_id = COALESCE(${u.chainId ?? null}, chain_offer_id),
        safe_zone = COALESCE(${u.safeZone ?? null}, safe_zone)
      WHERE id = ${Number(id)} RETURNING *`;
    return mapPgOffer(rows[0]);
  }
  const db = getDb();
  db.prepare(
    `UPDATE offers SET status=COALESCE(?, status), counterparty_wallet=COALESCE(?, counterparty_wallet),
      chain_offer_id=COALESCE(?, chain_offer_id), safe_zone=COALESCE(?, safe_zone) WHERE id = ?`
  ).run(u.status ?? null, u.cpWallet ?? null, u.chainId ?? null, u.safeZone ?? null, id);
  return db.prepare("SELECT * FROM offers WHERE id = ?").get(id) as OfferRow;
}

// --- user's offers --------------------------------------------------------
export async function listUserOffers(userId: string): Promise<OfferRow[]> {
  if (usePg) {
    const rows = await pg()`
      SELECT * FROM offers
      WHERE depositor_telegram_id = ${userId} OR counterparty_telegram_id = ${userId}
      ORDER BY created_at DESC LIMIT 100`;
    return rows.map(mapPgOffer);
  }
  return getDb()
    .prepare(
      `SELECT * FROM offers WHERE depositor_telegram_id = ? OR counterparty_telegram_id = ?
       ORDER BY created_at DESC LIMIT 100`
    )
    .all(userId, userId) as OfferRow[];
}

// --- reputation -----------------------------------------------------------
export async function getReputation(id: string): Promise<Reputation> {
  if (usePg) {
    const [row] = await pg()`
      SELECT AVG(stars)::float AS avg, COUNT(*)::int AS count FROM ratings WHERE rated_telegram_id = ${id}`;
    const count = Number(row.count);
    return { avgStars: count > 0 ? Math.round((Number(row.avg) ?? 0) * 10) / 10 : null, ratingCount: count };
  }
  const row = getDb()
    .prepare(`SELECT AVG(stars) AS avg, COUNT(*) AS count FROM ratings WHERE rated_telegram_id = ?`)
    .get(id) as { avg: number | null; count: number };
  return { avgStars: row.count > 0 ? Math.round((row.avg ?? 0) * 10) / 10 : null, ratingCount: row.count };
}

// --- rating (unique per rater+offer) --------------------------------------
export async function insertRating(f: {
  offerId: string | number; raterId: string; ratedId: string; stars: number;
}): Promise<"ok" | "already_rated"> {
  if (usePg) {
    try {
      await pg()`INSERT INTO ratings (offer_id, rater_telegram_id, rated_telegram_id, stars)
                 VALUES (${Number(f.offerId)}, ${f.raterId}, ${f.ratedId}, ${f.stars})`;
      return "ok";
    } catch (e) {
      if ((e as { code?: string }).code === "23505") return "already_rated"; // unique_violation
      throw e;
    }
  }
  try {
    getDb()
      .prepare("INSERT INTO ratings (offer_id, rater_telegram_id, rated_telegram_id, stars) VALUES (?, ?, ?, ?)")
      .run(f.offerId, f.raterId, f.ratedId, f.stars);
    return "ok";
  } catch (e) {
    if (e instanceof Error && /UNIQUE constraint/i.test(e.message)) return "already_rated";
    throw e;
  }
}

// --- funnel event ---------------------------------------------------------
export async function logEvent(
  name: FunnelEvent,
  opts?: { telegramId?: string | null; offerId?: string | number | null; props?: Record<string, unknown> }
): Promise<void> {
  if (usePg) {
    try {
      const offerId = opts?.offerId != null && Number.isFinite(Number(opts.offerId)) ? Number(opts.offerId) : null;
      await pg()`INSERT INTO events (name, telegram_id, offer_id, props)
                 VALUES (${name}, ${opts?.telegramId ?? null}, ${offerId}, ${opts?.props ? JSON.stringify(opts.props) : null})`;
    } catch {
      /* analytics is best-effort */
    }
    return;
  }
  sqliteLogEvent(name, opts);
}

// --- investor stats (aggregate, no PII) -----------------------------------
export type Stats = {
  users: { total: number; byProvider: Record<string, number>; byTier: Record<string, number> };
  offers: { total: number; byStatus: Record<string, number> };
  funnel: Record<string, number>;
  repeatPosters: number;
};

function tally(rows: { k: string; n: number }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) out[r.k] = Number(r.n);
  return out;
}

export async function getStats(): Promise<Stats> {
  if (usePg) {
    const sql = pg();
    const [uTotal] = await sql`SELECT count(*)::int n FROM users`;
    const byProvider = await sql`SELECT provider k, count(*)::int n FROM users GROUP BY provider`;
    const byTier = await sql`SELECT tier k, count(*)::int n FROM users GROUP BY tier`;
    const [oTotal] = await sql`SELECT count(*)::int n FROM offers`;
    const byStatus = await sql`SELECT status k, count(*)::int n FROM offers GROUP BY status`;
    const funnel = await sql`SELECT name k, count(*)::int n FROM events GROUP BY name`;
    const [repeat] = await sql`
      SELECT count(*)::int n FROM (
        SELECT depositor_telegram_id FROM offers GROUP BY depositor_telegram_id HAVING count(*) >= 2
      ) t`;
    const rl = (r: unknown) => r as unknown as { k: string; n: number }[];
    return {
      users: { total: Number(uTotal.n), byProvider: tally(rl(byProvider)), byTier: tally(rl(byTier)) },
      offers: { total: Number(oTotal.n), byStatus: tally(rl(byStatus)) },
      funnel: tally(rl(funnel)),
      repeatPosters: Number(repeat.n),
    };
  }
  const db = getDb();
  const uTotal = (db.prepare("SELECT count(*) n FROM users").get() as { n: number }).n;
  const byProvider = db.prepare("SELECT provider k, count(*) n FROM users GROUP BY provider").all() as { k: string; n: number }[];
  const byTier = db.prepare("SELECT tier k, count(*) n FROM users GROUP BY tier").all() as { k: string; n: number }[];
  const oTotal = (db.prepare("SELECT count(*) n FROM offers").get() as { n: number }).n;
  const byStatus = db.prepare("SELECT status k, count(*) n FROM offers GROUP BY status").all() as { k: string; n: number }[];
  const funnel = db.prepare("SELECT name k, count(*) n FROM events GROUP BY name").all() as { k: string; n: number }[];
  const repeat = (db.prepare("SELECT count(*) n FROM (SELECT depositor_telegram_id FROM offers GROUP BY depositor_telegram_id HAVING count(*) >= 2)").get() as { n: number }).n;
  return {
    users: { total: uTotal, byProvider: tally(byProvider), byTier: tally(byTier) },
    offers: { total: oTotal, byStatus: tally(byStatus) },
    funnel: tally(funnel),
    repeatPosters: repeat,
  };
}

// --- registration / user upsert ------------------------------------------
export async function upsertUser(u: {
  id: string; provider: string; tier: string; username?: string; wallet?: string;
}): Promise<void> {
  if (usePg) {
    try {
      await pg()`
        INSERT INTO users (id, provider, tier, username, wallet)
        VALUES (${u.id}, ${u.provider}, ${u.tier}, ${u.username ?? null}, ${u.wallet ?? null})
        ON CONFLICT (id) DO UPDATE SET last_seen = now(), tier = EXCLUDED.tier,
          username = COALESCE(EXCLUDED.username, users.username),
          wallet = COALESCE(EXCLUDED.wallet, users.wallet)`;
    } catch {
      /* best-effort */
    }
    return;
  }
  try {
    getDb()
      .prepare(
        `INSERT INTO users (id, provider, tier, username, wallet) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET last_seen = datetime('now'), tier = excluded.tier,
           username = COALESCE(excluded.username, users.username),
           wallet = COALESCE(excluded.wallet, users.wallet)`
      )
      .run(u.id, u.provider, u.tier, u.username ?? null, u.wallet ?? null);
  } catch {
    /* best-effort */
  }
}
