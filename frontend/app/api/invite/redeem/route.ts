import { NextRequest, NextResponse } from "next/server";
import { resolveUser } from "@/lib/auth";
import { logEvent, redeemInvite, upsertUser } from "@/lib/repo";

// Redeems an invite code: records its owner as the caller's voucher. Not a
// gate (Nomadia stays open) — a trust signal shown on the caller's offers.
export async function POST(request: NextRequest) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  await upsertUser(user);

  const body = await request.json().catch(() => ({}));
  const code = typeof body?.code === "string" ? body.code : "";
  const result = await redeemInvite(user.id, code);
  if (!result.ok) {
    const status = result.error === "ALREADY_VOUCHED" ? 409 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  await logEvent("invite_redeemed", { telegramId: user.id, props: { voucherId: result.voucher.id } });
  return NextResponse.json({ ok: true, vouchedBy: result.voucher.username ? `@${result.voucher.username}` : null });
}
