import "server-only";
import postgres from "postgres";
import { randomBytes } from "node:crypto";
import { getDb, logEvent as sqliteLogEvent, type OfferRow, type UserRow, type FunnelEvent } from "./db";
import type { Reputation } from "./offer-types";

export type { OfferRow, UserRow } from "./db";

// Data-access layer with two interchangeable backends, chosen by DATABASE_URL:
//   - Postgres (Supabase) when DATABASE_URL is set  -> shared, persistent, so
//     offers sync across every device and serverless instance.
//   - SQLite otherwise (local dev / no DB configured) -> single-instance only.
// Every function is async so the two backends look identical to the routes.

// 7 days: at launch traffic, 24h expiry left the list looking permanently
// empty — offers died before anyone browsed them. In-person cash meetups are
// planned days ahead anyway.
const OFFER_EXPIRY_HOURS = 7 * 24;
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

// Additive, idempotent migrations applied once per process so a deploy never
// depends on someone remembering to run docs/db/schema.postgres.sql by hand.
// Mirrors the ALTER ... IF NOT EXISTS lines in that file.
let _pgMigrated: Promise<void> | null = null;
function ensurePg() {
  if (!_pgMigrated) {
    _pgMigrated = (async () => {
      const sql = pg();
      await sql.unsafe(`
        ALTER TABLE offers ADD COLUMN IF NOT EXISTS match_rate_snapshot TEXT;
        ALTER TABLE users  ADD COLUMN IF NOT EXISTS invite_code TEXT;
        ALTER TABLE users  ADD COLUMN IF NOT EXISTS invited_by  TEXT;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_invite_code ON users (invite_code);
      `);
    })().catch((e) => {
      _pgMigrated = null; // retry on the next call
      throw e;
    });
  }
  return _pgMigrated;
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
    match_rate_snapshot: (r.match_rate_snapshot as string) ?? null,
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
        now() + (${OFFER_EXPIRY_HOURS} * interval '1 hour'))
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
  /** JSON-serialised reference rate at the moment of matching (see lib/rates.ts). */
  rateSnapshot: string | null;
};

export async function claimOffer(id: string | number, f: ClaimFields): Promise<OfferRow | null> {
  if (usePg) {
    await ensurePg();
    const sql = pg();
    const rows = await sql`
      UPDATE offers SET status = 'matched',
        counterparty_telegram_id = ${f.userId},
        counterparty_username = ${f.username},
        counterparty_wallet = COALESCE(${f.cpWallet}, counterparty_wallet),
        counterparty_contact = COALESCE(${f.cpContact}, counterparty_contact),
        chain_offer_id = COALESCE(${f.chainId}, chain_offer_id),
        match_rate_snapshot = ${f.rateSnapshot}
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
        chain_offer_id=COALESCE(?, chain_offer_id),
        match_rate_snapshot=?
       WHERE id = ? AND status = 'open'`
    )
    .run(f.userId, f.username, f.cpWallet, f.cpContact, f.chainId, f.rateSnapshot, id);
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
  /** Users who redeemed someone's invite (have a voucher). */
  vouchedUsers: number;
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
    await ensurePg();
    const [vouched] = await sql`SELECT count(*)::int n FROM users WHERE invited_by IS NOT NULL`;
    const rl = (r: unknown) => r as unknown as { k: string; n: number }[];
    return {
      users: { total: Number(uTotal.n), byProvider: tally(rl(byProvider)), byTier: tally(rl(byTier)) },
      offers: { total: Number(oTotal.n), byStatus: tally(rl(byStatus)) },
      funnel: tally(rl(funnel)),
      repeatPosters: Number(repeat.n),
      vouchedUsers: Number(vouched.n),
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
  const vouched = (db.prepare("SELECT count(*) n FROM users WHERE invited_by IS NOT NULL").get() as { n: number }).n;
  return {
    users: { total: uTotal, byProvider: tally(byProvider), byTier: tally(byTier) },
    offers: { total: oTotal, byStatus: tally(byStatus) },
    funnel: tally(funnel),
    repeatPosters: repeat,
    vouchedUsers: vouched,
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

// --- web of trust: invite codes + "vouched by" ----------------------------
// Nomadia stays open (anyone can post a small offer), so an invite is not a
// gate — it is a trust signal. Redeeming someone's code records them as your
// voucher, and strangers see "vouched by @them" next to your offers.

function newInviteCode(): string {
  // 8 chars, unambiguous alphabet (no 0/O/1/I).
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

function mapPgUser(r: Record<string, unknown>): UserRow {
  const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));
  return {
    id: String(r.id),
    provider: String(r.provider),
    tier: String(r.tier),
    username: (r.username as string) ?? null,
    wallet: (r.wallet as string) ?? null,
    invite_code: (r.invite_code as string) ?? null,
    invited_by: (r.invited_by as string) ?? null,
    first_seen: iso(r.first_seen),
    last_seen: iso(r.last_seen),
  };
}

export async function getUser(id: string): Promise<UserRow | null> {
  if (usePg) {
    await ensurePg();
    const rows = await pg()`SELECT * FROM users WHERE id = ${id} LIMIT 1`;
    return rows[0] ? mapPgUser(rows[0]) : null;
  }
  return (getDb().prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined) ?? null;
}

/** Returns the user's invite code, minting one on first request. */
export async function ensureInviteCode(id: string): Promise<string> {
  const existing = await getUser(id);
  if (existing?.invite_code) return existing.invite_code;
  // Retry on the (astronomically rare) unique collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newInviteCode();
    try {
      if (usePg) {
        await ensurePg();
        const rows = await pg()`
          UPDATE users SET invite_code = COALESCE(invite_code, ${code})
          WHERE id = ${id} RETURNING invite_code`;
        if (rows[0]?.invite_code) return String(rows[0].invite_code);
      } else {
        getDb().prepare("UPDATE users SET invite_code = COALESCE(invite_code, ?) WHERE id = ?").run(code, id);
        const row = getDb().prepare("SELECT invite_code FROM users WHERE id = ?").get(id) as
          | { invite_code: string | null }
          | undefined;
        if (row?.invite_code) return row.invite_code;
      }
      throw new Error("USER_NOT_FOUND");
    } catch (e) {
      if (e instanceof Error && e.message === "USER_NOT_FOUND") throw e;
      /* unique collision → try another code */
    }
  }
  throw new Error("INVITE_CODE_UNAVAILABLE");
}

export type RedeemResult =
  | { ok: true; voucher: UserRow }
  | { ok: false; error: "INVITE_INVALID" | "INVITE_SELF" | "ALREADY_VOUCHED" };

/** Records `code`'s owner as the voucher of `userId`. One voucher per user, ever. */
export async function redeemInvite(userId: string, code: string): Promise<RedeemResult> {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z2-9]{8}$/.test(normalized)) return { ok: false, error: "INVITE_INVALID" };

  let voucher: UserRow | null = null;
  if (usePg) {
    await ensurePg();
    const rows = await pg()`SELECT * FROM users WHERE invite_code = ${normalized} LIMIT 1`;
    voucher = rows[0] ? mapPgUser(rows[0]) : null;
  } else {
    voucher =
      (getDb().prepare("SELECT * FROM users WHERE invite_code = ?").get(normalized) as UserRow | undefined) ?? null;
  }
  if (!voucher) return { ok: false, error: "INVITE_INVALID" };
  if (voucher.id === userId) return { ok: false, error: "INVITE_SELF" };
  // A vouch chain must not loop back (A vouches B, B vouches A).
  if (voucher.invited_by === userId) return { ok: false, error: "INVITE_INVALID" };

  // Conditional update: only the first redemption sticks.
  let changed = 0;
  if (usePg) {
    const rows = await pg()`
      UPDATE users SET invited_by = ${voucher.id}
      WHERE id = ${userId} AND invited_by IS NULL RETURNING id`;
    changed = rows.length;
  } else {
    changed = getDb()
      .prepare("UPDATE users SET invited_by = ? WHERE id = ? AND invited_by IS NULL")
      .run(voucher.id, userId).changes;
  }
  if (changed === 0) return { ok: false, error: "ALREADY_VOUCHED" };
  return { ok: true, voucher };
}

/** How a user is shown to strangers: @username, else a masked wallet/id. */
export function publicHandle(u: Pick<UserRow, "id" | "username" | "wallet">): string {
  if (u.username) return `@${u.username.replace(/^@/, "")}`;
  const addr = u.wallet ?? (u.id.startsWith("wallet:") ? u.id.slice("wallet:".length) : null);
  if (addr && addr.length > 10) return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  return u.id.startsWith("tg:") ? "Telegram user" : "member";
}

export type VouchInfo = { vouchedBy: string | null; vouchCount: number };

/** Who vouched for `id` (public handle) and how many people they vouched for. */
export async function getVouchInfo(id: string): Promise<VouchInfo> {
  if (usePg) {
    await ensurePg();
    const sql = pg();
    const [me] = await sql`SELECT invited_by FROM users WHERE id = ${id} LIMIT 1`;
    const inviterId = (me?.invited_by as string | null) ?? null;
    const [inviter, count] = await Promise.all([
      inviterId ? sql`SELECT id, username, wallet FROM users WHERE id = ${inviterId} LIMIT 1` : Promise.resolve([]),
      sql`SELECT count(*)::int AS n FROM users WHERE invited_by = ${id}`,
    ]);
    const row = inviter[0] as Pick<UserRow, "id" | "username" | "wallet"> | undefined;
    return { vouchedBy: row ? publicHandle(row) : null, vouchCount: Number(count[0]?.n ?? 0) };
  }
  const db = getDb();
  const me = db.prepare("SELECT invited_by FROM users WHERE id = ?").get(id) as { invited_by: string | null } | undefined;
  const inviter = me?.invited_by
    ? (db.prepare("SELECT id, username, wallet FROM users WHERE id = ?").get(me.invited_by) as
        | Pick<UserRow, "id" | "username" | "wallet">
        | undefined)
    : undefined;
  const count = db.prepare("SELECT count(*) AS n FROM users WHERE invited_by = ?").get(id) as { n: number };
  return { vouchedBy: inviter ? publicHandle(inviter) : null, vouchCount: Number(count?.n ?? 0) };
}
