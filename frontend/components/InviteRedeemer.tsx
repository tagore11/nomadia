"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { useIdentityStatus } from "@/lib/use-identity-status";

const PENDING_KEY = "nomadia.pendingInvite";

/**
 * Captures `?invite=CODE` from a shared link, keeps it until the visitor signs
 * in, then redeems it once so the inviter shows up as their voucher. Silent by
 * design: a failed redemption (already vouched, bad code) must never block the
 * page the person actually came for.
 */
export function InviteRedeemer() {
  const params = useSearchParams();
  const status = useIdentityStatus();
  const fromUrl = params.get("invite");

  useEffect(() => {
    if (!fromUrl) return;
    try {
      localStorage.setItem(PENDING_KEY, fromUrl.trim().toUpperCase());
    } catch {
      /* storage unavailable */
    }
  }, [fromUrl]);

  useEffect(() => {
    if (status === "anonymous") return;
    let code: string | null = null;
    try {
      code = localStorage.getItem(PENDING_KEY);
    } catch {
      return;
    }
    if (!code) return;
    apiFetch("/api/invite/redeem", { method: "POST", body: JSON.stringify({ code }) })
      .catch(() => undefined)
      .finally(() => {
        try {
          localStorage.removeItem(PENDING_KEY);
        } catch {
          /* ignore */
        }
      });
  }, [status]);

  return null;
}
