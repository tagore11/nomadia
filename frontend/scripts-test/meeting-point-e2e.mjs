// Meeting-point (safe_zone) flow against a running local server. Run with a
// throwaway SQLite DB so nothing touches the hosted Postgres:
//
//   DATABASE_URL= NOMADIA_DB_PATH=/tmp/mp.db npx next dev -p 3124 &
//   node scripts-test/meeting-point-e2e.mjs http://localhost:3124
const base = process.argv[2] ?? "http://localhost:3124";
const A = { "x-dev-telegram-id": "311", "Content-Type": "application/json" };
const B = { "x-dev-telegram-id": "322", "Content-Type": "application/json" };
const C = { "x-dev-telegram-id": "333", "Content-Type": "application/json" };

let failures = 0;
function check(name, cond, extra = "") {
  console.log(`${cond ? "✅" : "❌"} ${name}${extra ? `  ${extra}` : ""}`);
  if (!cond) failures++;
}
async function call(path, headers, init = {}) {
  const res = await fetch(base + path, { headers, ...init });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

const post = await call("/api/offers", A, {
  method: "POST",
  body: JSON.stringify({ direction: "crypto_to_fiat", cryptoAmount: 50, cryptoToken: "USDC", fiatAmount: 2100, fiatCurrency: "TRY", city: "Kaş" }),
});
check("A posts offer in Kaş", post.status === 201, JSON.stringify(post.body).slice(0, 100));
const id = post.body.offer?.id;

// Poster may pre-set the meeting point while the offer is still open.
const pre = await call(`/api/offers/${id}`, A, { method: "PATCH", body: JSON.stringify({ safeZone: "Web3 Hub Kaş" }) });
check("depositor sets meeting point on open offer", pre.status === 200 && pre.body.offer?.safe_zone === "Web3 Hub Kaş", JSON.stringify(pre.body).slice(0, 100));

const list = await call("/api/offers", {});
const listed = list.body.offers?.find((o) => o.id === id);
check("public list exposes safe_zone (card shows 'Meets at')", listed?.safe_zone === "Web3 Hub Kaş");

// A stranger cannot change it.
const stranger = await call(`/api/offers/${id}`, C, { method: "PATCH", body: JSON.stringify({ safeZone: "Kaş Jandarma" }) });
check("non-participant rejected", stranger.status === 403 && stranger.body.error === "NOT_PARTICIPANT");

const claim = await call(`/api/offers/${id}`, B, { method: "PATCH", body: JSON.stringify({ status: "matched" }) });
check("B claims", claim.status === 200 && claim.body.offer?.status === "matched");

const change = await call(`/api/offers/${id}`, B, { method: "PATCH", body: JSON.stringify({ safeZone: "Garanti BBVA" }) });
check("counterparty changes meeting point", change.status === 200 && change.body.offer?.safe_zone === "Garanti BBVA");

const tooLong = await call(`/api/offers/${id}`, B, { method: "PATCH", body: JSON.stringify({ safeZone: "x".repeat(121) }) });
check("over-long zone ignored (kept previous)", tooLong.status === 200 && tooLong.body.offer?.safe_zone === "Garanti BBVA");

const seenByA = await call(`/api/offers/${id}`, A);
check("both parties read the same point", seenByA.body.offer?.safe_zone === "Garanti BBVA");

for (const path of ["/map", "/map?city=Dubai%20Marina", `/map?offer=${id}&city=Ka%C5%9F`, `/offers/${id}`]) {
  const res = await fetch(base + path);
  const html = await res.text();
  check(`GET ${path} renders`, res.status === 200 && html.includes("Nomadia"));
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
