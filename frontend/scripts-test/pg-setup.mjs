// Inspect the Supabase project, then set up the schema (idempotent).
import postgres from "postgres";
import { readFileSync } from "node:fs";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = env.split("\n").find((l) => l.startsWith("DATABASE_URL="))?.slice("DATABASE_URL=".length).trim();
if (!url) { console.error("DATABASE_URL yok"); process.exit(1); }

const sql = postgres(url, { prepare: false });

try {
  const before = await sql`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`;
  console.log("İnceleme — mevcut public tablolar:", before.map((r) => r.tablename).join(", ") || "(boş proje)");

  const schema = readFileSync(new URL("../docs/db/schema.postgres.sql", import.meta.url), "utf8");
  await sql.unsafe(schema);
  console.log("Şema uygulandı (IF NOT EXISTS — mevcutlara dokunmadı).");

  const after = await sql`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`;
  console.log("Kurulum sonrası tablolar:", after.map((r) => r.tablename).join(", "));
  for (const t of ["offers", "ratings", "events", "users"]) {
    const [c] = await sql.unsafe(`SELECT count(*)::int AS n FROM ${t}`);
    console.log(`  ${t}: ${c.n} satır`);
  }
  console.log("\n✅ Supabase hazır.");
} catch (e) {
  console.error("❌ Hata:", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
