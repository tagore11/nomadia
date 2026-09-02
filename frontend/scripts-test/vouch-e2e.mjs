// End-to-end check for the web-of-trust + match-rate features against a
// running local server (dev identity headers, so NODE_ENV must not be
// production-locked: `next start` honours x-dev-telegram-id only when
// NODE_ENV !== "production"; run with `NODE_ENV=development next start`).
//
//   NOMADIA_DB_PATH=/tmp/e2e.db NODE_ENV=development npx next start -p 3123 &
//   node scripts-test/vouch-e2e.mjs http://localhost:3123
const base = process.argv[2] ?? "http://localhost:3123";
const A = { "x-dev-telegram-id": "111", "Content-Type": "application/json" };
const B = { "x-dev-telegram-id": "222", "Content-Type": "application/json" };

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

const me = await call("/api/me", A);
check("GET /api/me mints invite code", me.status === 200 && /^[A-Z2-9]{8}$/.test(me.body.inviteCode), me.body.inviteCode);
const code = me.body.inviteCode;

const again = await call("/api/me", A);
check("invite code is stable", again.body.inviteCode === code);

const self = await call("/api/invite/redeem", A, { method: "POST", body: JSON.stringify({ code }) });
check("self-redeem rejected", self.status === 400 && self.body.error === "INVITE_SELF", JSON.stringify(self.body));

const bad = await call("/api/invite/redeem", B, { method: "POST", body: JSON.stringify({ code: "nope" }) });
check("bad code rejected", bad.status === 400 && bad.body.error === "INVITE_INVALID");

const ok = await call("/api/invite/redeem", B, { method: "POST", body: JSON.stringify({ code: code.toLowerCase() }) });
check("B redeems A's code (case-insensitive)", ok.status === 200 && ok.body.ok === true, JSON.stringify(ok.body));

const dup = await call("/api/invite/redeem", B, { method: "POST", body: JSON.stringify({ code }) });
check("second redeem rejected", dup.status === 409 && dup.body.error === "ALREADY_VOUCHED");

// Loop guard: A tries to redeem B's code.
const meB = await call("/api/me", B);
const loop = await call("/api/invite/redeem", A, { method: "POST", body: JSON.stringify({ code: meB.body.inviteCode }) });
check("vouch loop (A<->B) rejected", loop.status === 400 && loop.body.error === "INVITE_INVALID", JSON.stringify(loop.body));

const post = await call("/api/offers", B, {
  method: "POST",
  body: JSON.stringify({ direction: "crypto_to_fiat", cryptoAmount: 100, cryptoToken: "USDC", fiatAmount: 4200, fiatCurrency: "TRY", city: "Kaş" }),
});
check("B posts offer", post.status === 201, JSON.stringify(post.body).slice(0, 120));
const offer = post.body.offer;
check("offer shows B is vouched (by A's handle)", typeof offer?.depositorVouchedBy === "string" && offer.depositorVouchedBy.length > 0, offer?.depositorVouchedBy);
check("offer has no match rate before claim", offer?.matchRate === null);

const list = await call("/api/offers", {});
const listed = list.body.offers?.find((o) => o.id === offer.id);
check("public list carries vouch fields", listed && "depositorVouchedBy" in listed && "depositorVouchCount" in listed);
check("public list hides participant fields", listed && !("depositor_contact" in listed));

const claim = await call(`/api/offers/${offer.id}`, A, { method: "PATCH", body: JSON.stringify({ status: "matched" }) });
check("A claims offer", claim.status === 200 && claim.body.offer?.status === "matched", JSON.stringify(claim.body).slice(0, 120));
const mr = claim.body.offer?.matchRate;
check("match rate snapshot frozen", mr && mr.fiatCurrency === "TRY" && mr.referencePerCrypto > 0 && typeof mr.deltaPct === "number", JSON.stringify(mr));

const detail = await call(`/api/offers/${offer.id}`, B);
check("snapshot persists on re-read", detail.body.offer?.matchRate?.referencePerCrypto === mr?.referencePerCrypto);

const meA = await call("/api/me", A);
check("A's vouchCount is 1", meA.body.vouchCount === 1, JSON.stringify(meA.body));

const stats = await call("/api/stats", {});
check("stats.vouchedUsers = 1", stats.body.vouchedUsers === 1);
check("invite_redeemed funnel event", stats.body.funnel?.invite_redeemed === 1, JSON.stringify(stats.body.funnel));

// Anonymous rate limit: 5/hour per IP.
let limited = false;
for (let i = 0; i < 6; i++) {
  const r = await call("/api/offers", { "Content-Type": "application/json" }, {
    method: "POST",
    body: JSON.stringify({ direction: "fiat_to_crypto", cryptoAmount: 10, cryptoToken: "USDC", fiatAmount: 420, fiatCurrency: "TRY", city: "Kaş", contact: "@anon" }),
  });
  if (r.status === 429 && r.body.error === "RATE_LIMITED") limited = true;
}
check("anonymous posts rate-limited after 5", limited);

for (const path of ["/", "/how-it-works", "/compliance"]) {
  const res = await fetch(base + path);
  const html = await res.text();
  check(`GET ${path} renders`, res.status === 200 && html.includes("Nomadia"));
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
