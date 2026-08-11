// E2E: multi-provider identity + tier limits against the local dev server.
// Run from the frontend dir: node scripts-test/siwe-e2e.mjs (dev server on :3212).
import { createSiweMessage, generateSiweNonce } from "viem/siwe";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";

const BASE = "http://localhost:3212";
let pass = 0, fail = 0;
const ok = (name, cond) => { console.log(`  ${cond ? "✅" : "❌"} ${name}`); if (cond) pass++; else fail++; };

async function walletHeader() {
  const account = privateKeyToAccount(generatePrivateKey());
  const message = createSiweMessage({
    address: account.address, chainId: 84532, domain: "localhost:3212",
    uri: BASE, version: "1", nonce: generateSiweNonce(),
    statement: "Sign in to Nomadia.", issuedAt: new Date(),
    expirationTime: new Date(Date.now() + 3600 * 1000),
  });
  const signature = await account.signMessage({ message });
  return { header: Buffer.from(JSON.stringify({ message, signature })).toString("base64"), address: account.address };
}

async function post(body, headers) {
  const res = await fetch(`${BASE}/api/offers`, {
    method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

const under = { direction: "crypto_to_fiat", cryptoAmount: 50, cryptoToken: "USDC", fiatAmount: 2350, fiatCurrency: "TRY", city: "Kaş", contact: "@saitkas" };
const over = { ...under, cryptoAmount: 500, fiatAmount: 23500 };

console.log("[1] Cüzdan (SIWE) kimliği ile $50 teklif — geçmeli, provider=wallet");
{
  const { header, address } = await walletHeader();
  const r = await post(under, { "x-wallet-auth": header });
  ok("201 oluşturuldu", r.status === 201);
  ok("provider wallet (id wallet:0x..)", String(r.json?.offer?.depositor_telegram_id || "").startsWith("wallet:"));
  ok("kendi contact'ı kaydedildi", r.json?.offer?.depositor_contact === "@saitkas");
  console.log("     kimlik:", r.json?.offer?.depositor_telegram_id, "| beklenen wallet:" + address.toLowerCase());
}

console.log("[2] Cüzdan (light tier) ile $500 teklif — 403 TRADE_LIMIT_EXCEEDED");
{
  const { header } = await walletHeader();
  const r = await post(over, { "x-wallet-auth": header });
  ok("403 limit", r.status === 403);
  ok("kod TRADE_LIMIT_EXCEEDED", r.json?.error === "TRADE_LIMIT_EXCEEDED");
  ok("maxUsd 100", r.json?.maxUsd === 100);
}

console.log("[3] Telegram (dev, phone tier) ile $500 teklif — geçmeli (yüksek limit)");
{
  const r = await post(over, { "x-dev-telegram-id": "9100" });
  ok("201 oluşturuldu", r.status === 201);
  ok("provider telegram (id tg:..)", String(r.json?.offer?.depositor_telegram_id || "").startsWith("tg:"));
}

console.log("[4] Geçersiz imza ile x-wallet-auth — 401");
{
  const bad = Buffer.from(JSON.stringify({ message: "not a siwe message", signature: "0xdeadbeef" })).toString("base64");
  const r = await post(under, { "x-wallet-auth": bad });
  ok("401 reddedildi", r.status === 401);
}

console.log("[5] dev light tier override — $500 ile 403");
{
  const r = await post(over, { "x-dev-telegram-id": "9101", "x-dev-tier": "light" });
  ok("403 limit (dev light)", r.status === 403);
}

console.log(`\n=== SONUÇ: ${pass} geçti, ${fail} kaldı ===`);
process.exit(fail ? 1 : 0);
