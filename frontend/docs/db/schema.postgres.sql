-- Nomadia — Postgres / Supabase schema
-- ---------------------------------------------------------------------------
-- Target for the storage migration off SQLite (/tmp on Vercel is wiped between
-- cold starts and is inconsistent across serverless instances, so multi-user
-- state is impossible until this lands — see docs/db/MIGRATION.md).
--
-- Run this once against a fresh Supabase project (SQL editor or `psql`), then
-- point the app at it via DATABASE_URL. Mirrors lib/db.ts exactly so the
-- application code changes are limited to the driver + async call sites.
-- ---------------------------------------------------------------------------

-- offers -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS offers (
  id                       BIGSERIAL PRIMARY KEY,
  chain_offer_id           BIGINT,
  direction                TEXT NOT NULL CHECK (direction IN ('crypto_to_fiat', 'fiat_to_crypto')),
  crypto_amount            NUMERIC(38, 6) NOT NULL,
  crypto_token             TEXT NOT NULL,
  fiat_amount              NUMERIC(38, 2) NOT NULL,
  fiat_currency            TEXT NOT NULL,
  city                     TEXT NOT NULL,
  depositor_telegram_id    TEXT NOT NULL,
  depositor_username       TEXT,
  depositor_wallet         TEXT,
  counterparty_telegram_id TEXT,
  counterparty_username    TEXT,
  counterparty_wallet      TEXT,
  depositor_contact        TEXT,
  counterparty_contact     TEXT,
  safe_zone                TEXT,
  status                   TEXT NOT NULL DEFAULT 'open'
                             CHECK (status IN ('open', 'matched', 'released', 'refunded', 'expired')),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at               TIMESTAMPTZ NOT NULL
);

-- Self-healing for projects created before the contact columns existed.
ALTER TABLE offers ADD COLUMN IF NOT EXISTS depositor_contact    TEXT;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS counterparty_contact TEXT;
-- Reference FX rate frozen at match time (JSON) — dispute evidence.
ALTER TABLE offers ADD COLUMN IF NOT EXISTS match_rate_snapshot  TEXT;

CREATE INDEX IF NOT EXISTS idx_offers_status_expires ON offers (status, expires_at);
CREATE INDEX IF NOT EXISTS idx_offers_depositor      ON offers (depositor_telegram_id);
CREATE INDEX IF NOT EXISTS idx_offers_counterparty   ON offers (counterparty_telegram_id);
CREATE INDEX IF NOT EXISTS idx_offers_direction_city ON offers (direction, city);

-- ratings ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ratings (
  id                BIGSERIAL PRIMARY KEY,
  offer_id          BIGINT NOT NULL REFERENCES offers (id),
  rater_telegram_id TEXT NOT NULL,
  rated_telegram_id TEXT NOT NULL,
  stars             SMALLINT NOT NULL CHECK (stars BETWEEN 1 AND 5),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ratings_rated ON ratings (rated_telegram_id);
-- One rating per rater per offer — backs the ALREADY_RATED guard atomically.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_rating_per_offer ON ratings (offer_id, rater_telegram_id);

-- events (funnel analytics) ------------------------------------------------
-- One row per tracked funnel step (offer_created … rating_submitted).
-- props is step-specific context. Investor proof (launch-plan §6) reads from here.
CREATE TABLE IF NOT EXISTS events (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  telegram_id TEXT,
  offer_id    BIGINT,
  props       JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_name    ON events (name);
CREATE INDEX IF NOT EXISTS idx_events_created ON events (created_at);

-- users (registration data) -------------------------------------------------
-- Investor metric: who signed up, via which provider/tier, first & last seen.
-- Keyed on the namespaced identity (tg:… / wallet:…).
CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY,
  provider   TEXT NOT NULL,
  tier       TEXT NOT NULL,
  username   TEXT,
  wallet     TEXT,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Web of trust: shareable invite code + who vouched for this user.
ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_code TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_by  TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_invite_code ON users (invite_code);

-- Row Level Security ---------------------------------------------------------
-- The app connects with the service role (server-side API routes only), which
-- bypasses RLS. Enable RLS with NO public policies so that if the anon/public
-- key is ever exposed to a browser, these tables stay unreadable/unwritable
-- from the client. All access must go through the authenticated API layer,
-- which enforces the redaction in lib/offer-view.ts and the auth in lib/auth.ts.
ALTER TABLE offers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE users   ENABLE ROW LEVEL SECURITY;
