import { NextRequest, NextResponse } from "next/server";
import { resolveUser } from "@/lib/auth";
import { ensureInviteCode, getVouchInfo, upsertUser } from "@/lib/repo";

// The caller's own profile: tier, invite code (minted on first call) and the
// web-of-trust facts other traders see about them.
export async function GET(request: NextRequest) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  await upsertUser(user);
  const [inviteCode, vouch] = await Promise.all([ensureInviteCode(user.id), getVouchInfo(user.id)]);
  return NextResponse.json(
    {
      id: user.id,
      provider: user.provider,
      tier: user.tier,
      username: user.username ?? null,
      inviteCode,
      vouchedBy: vouch.vouchedBy,
      vouchCount: vouch.vouchCount,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
