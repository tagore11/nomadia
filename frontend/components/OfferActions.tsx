"use client";

import { useEffect, useState } from "react";
import { useAccount, useChainId, useSignMessage, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { parseUnits } from "viem";
import { useTranslations } from "next-intl";
import { ESCROW_ABI, ERC20_ABI, ESCROW_ADDRESS, TOKEN_ADDRESS, CRYPTO_DECIMALS, ESCROW_TIMEOUT_SECONDS } from "@/lib/contracts";
import { extractOfferIdFromReceipt } from "@/lib/decode-offer-id";
import { cryptoLockerRole, myRole } from "@/lib/offer-roles";
import { apiFetch } from "@/lib/api-client";
import { useApiErrorMessage } from "@/lib/use-api-error-message";
import { appKitModal } from "@/lib/appkit";
import { buildSiweMessage, getStoredWalletAuth, setStoredWalletAuth } from "@/lib/wallet-auth";
import { getStoredLogin } from "@/lib/telegram-login";
import { getTelegramWebApp } from "@/lib/telegram";
import { wagmiConfig } from "@/lib/wagmi";
import { haptic } from "@/lib/telegram";
import { PrimaryAction } from "./PrimaryAction";
import type { PublicOffer } from "@/lib/offer-types";
import type { OnChainOfferView } from "@/lib/escrow-steps";

export function OfferActions({
  offer,
  myTelegramId,
  onChainOffer,
  onChainDataReady,
  refetchOnChainOffer,
  refreshOffer,
}: {
  offer: PublicOffer;
  myTelegramId: string;
  onChainOffer: OnChainOfferView | undefined;
  onChainDataReady: boolean;
  refetchOnChainOffer: () => Promise<unknown>;
  refreshOffer: () => Promise<unknown>;
}) {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const chainId = useChainId();
  const t = useTranslations("offerActions");
  const errorMessage = useApiErrorMessage();
  const [step, setStep] = useState<
    "idle" | "approving" | "locking" | "confirming" | "refunding" | "cancelling" | "disputing"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  // Wall-clock tick (set in an effect, not during render — Date.now() is impure)
  // so the refund/cancel buttons flip the moment the on-chain timeout elapses.
  const [nowSeconds, setNowSeconds] = useState(0);
  useEffect(() => {
    const update = () => setNowSeconds(Math.floor(Date.now() / 1000));
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, []);

  const escrowAddress = ESCROW_ADDRESS[chainId];
  const tokenAddress = TOKEN_ADDRESS[chainId];

  const { writeContractAsync } = useWriteContract();

  const role = myRole(offer, myTelegramId);
  const lockerRole = cryptoLockerRole(offer.direction);
  const iAmLocker = role === lockerRole;
  const counterpartyWallet =
    lockerRole === "depositor" ? offer.counterparty_wallet : offer.depositor_wallet;

  const bothConfirmedOnChain = Boolean(onChainOffer?.depositorConfirmed && onChainOffer?.counterpartyConfirmed);
  const counterpartyConfirmedOnChain = Boolean(onChainOffer?.counterpartyConfirmed);

  // Gate the refund button behind the real on-chain timeout. Refund is only a
  // valid, non-reverting action once the timeout has elapsed AND the counterparty
  // has not confirmed (the escrow now blocks refund after a counterparty confirm —
  // the closed half-confirm scam). Before both conditions hold, refund would revert.
  const timeoutElapsed =
    onChainOffer?.createdAt != null &&
    nowSeconds > 0 &&
    nowSeconds >= Number(onChainOffer.createdAt) + ESCROW_TIMEOUT_SECONDS;
  const canRefund = Boolean(offer.chain_offer_id) && !counterpartyConfirmedOnChain && timeoutElapsed;
  // Depositor can pull out early only before the counterparty confirms.
  const canCancel =
    iAmLocker && Boolean(offer.chain_offer_id) && !counterpartyConfirmedOnChain && !timeoutElapsed;
  // Stuck state: counterparty confirmed (delivered cash) but the trade hasn't
  // released. Either side can escalate to the arbiter instead of being stranded.
  const isStuck = counterpartyConfirmedOnChain && !bothConfirmedOnChain;

  async function waitForReceipt(hash: `0x${string}`) {
    // wagmi's useWaitForTransactionReceipt is a hook and can't be called
    // imperatively inside a click handler, so we use the vanilla action form.
    return waitForTransactionReceipt(wagmiConfig, { hash });
  }

  async function handleClaim() {
    // Auth happens AT the claim tap, not before it: an anonymous visitor can
    // browse freely, and the moment they commit we open the connect modal in
    // place instead of bouncing them to a sign-in page ("eşleşmeyi seçince
    // orada bağlat").
    if (!address) {
      setError(null);
      appKitModal.open();
      return;
    }
    try {
      // Connected but not yet a signed-in identity (no Telegram session, no
      // stored SIWE): collect the SIWE signature inline and continue.
      const hasTelegram = Boolean(getTelegramWebApp()?.initData) || Boolean(getStoredLogin());
      if (!hasTelegram && !getStoredWalletAuth()) {
        const message = buildSiweMessage(address);
        const signature = await signMessageAsync({ message });
        setStoredWalletAuth({ address, message, signature });
      }
      await apiFetch(`/api/offers/${offer.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "matched", counterpartyWallet: address }),
      });
      haptic().notify("success");
      await refreshOffer();
    } catch (err) {
      haptic().notify("error");
      setError(errorMessage(err));
    }
  }

  async function handleLockFunds() {
    if (!escrowAddress || !tokenAddress) {
      setError(t("contractNotConfigured"));
      return;
    }
    if (!counterpartyWallet) {
      setError(t("counterpartyWalletMissing"));
      return;
    }
    setError(null);
    const amount = parseUnits(String(offer.crypto_amount), CRYPTO_DECIMALS);

    try {
      setStep("approving");
      const approveHash = await writeContractAsync({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [escrowAddress, amount],
      });
      await waitForReceipt(approveHash);

      setStep("locking");
      const lockHash = await writeContractAsync({
        address: escrowAddress,
        abi: ESCROW_ABI,
        functionName: "createOffer",
        args: [tokenAddress, amount, counterpartyWallet as `0x${string}`],
      });
      const receipt = await waitForReceipt(lockHash);
      const chainOfferId = extractOfferIdFromReceipt(receipt.logs);

      await apiFetch(`/api/offers/${offer.id}`, {
        method: "PATCH",
        body: JSON.stringify({ chainOfferId: chainOfferId ? Number(chainOfferId) : null }),
      });
      haptic().notify("success");
      await refreshOffer();
      await refetchOnChainOffer();
    } catch (err) {
      haptic().notify("error");
      setError(errorMessage(err));
    } finally {
      setStep("idle");
    }
  }

  async function handleConfirm() {
    if (!escrowAddress || !offer.chain_offer_id) return;
    setError(null);
    try {
      setStep("confirming");
      const hash = await writeContractAsync({
        address: escrowAddress,
        abi: ESCROW_ABI,
        functionName: "confirm",
        args: [BigInt(offer.chain_offer_id)],
      });
      await waitForReceipt(hash);
      haptic().notify("success");
      // Confirming only flips *my* side on-chain — the offer only actually
      // releases once both confirms have landed, so there's no DB status
      // transition here. refetchOnChainOffer picks up the new confirm flags;
      // handleMarkReleased is what records the terminal "released" status.
      await refetchOnChainOffer();
    } catch (err) {
      haptic().notify("error");
      setError(errorMessage(err));
    } finally {
      setStep("idle");
    }
  }

  async function handleMarkReleased() {
    try {
      await apiFetch(`/api/offers/${offer.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "released" }),
      });
      await refreshOffer();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleRefund() {
    if (!escrowAddress || !offer.chain_offer_id) return;
    setError(null);
    try {
      setStep("refunding");
      const hash = await writeContractAsync({
        address: escrowAddress,
        abi: ESCROW_ABI,
        functionName: "refund",
        args: [BigInt(offer.chain_offer_id)],
      });
      await waitForReceipt(hash);
      await apiFetch(`/api/offers/${offer.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "refunded" }),
      });
      haptic().notify("warning");
      await refreshOffer();
    } catch (err) {
      haptic().notify("error");
      setError(errorMessage(err));
    } finally {
      setStep("idle");
    }
  }

  async function handleCancel() {
    if (!escrowAddress || !offer.chain_offer_id) return;
    setError(null);
    try {
      setStep("cancelling");
      const hash = await writeContractAsync({
        address: escrowAddress,
        abi: ESCROW_ABI,
        functionName: "cancel",
        args: [BigInt(offer.chain_offer_id)],
      });
      await waitForReceipt(hash);
      await apiFetch(`/api/offers/${offer.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "refunded" }),
      });
      haptic().notify("warning");
      await refreshOffer();
    } catch (err) {
      haptic().notify("error");
      setError(errorMessage(err));
    } finally {
      setStep("idle");
    }
  }

  async function handleRaiseDispute() {
    if (!escrowAddress || !offer.chain_offer_id) return;
    setError(null);
    try {
      setStep("disputing");
      const hash = await writeContractAsync({
        address: escrowAddress,
        abi: ESCROW_ABI,
        functionName: "raiseDispute",
        args: [BigInt(offer.chain_offer_id)],
      });
      await waitForReceipt(hash);
      haptic().notify("warning");
      await refetchOnChainOffer();
      await refreshOffer();
    } catch (err) {
      haptic().notify("error");
      setError(errorMessage(err));
    } finally {
      setStep("idle");
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-3">
      {error && <p className="text-sm text-danger">{error}</p>}

      {offer.status === "open" && role === "none" && <PrimaryAction label={t("claim")} onClick={handleClaim} />}

      {offer.status === "matched" && !offer.chain_offer_id && iAmLocker && (
        <PrimaryAction
          label={
            step === "approving"
              ? t("approving")
              : step === "locking"
                ? t("locking")
                : t("lockAmount", { amount: offer.crypto_amount, token: offer.crypto_token })
          }
          onClick={handleLockFunds}
          loading={step !== "idle"}
        />
      )}

      {offer.status === "matched" && !offer.chain_offer_id && !iAmLocker && (
        <p className="text-sm text-text-muted">{t("waitingForLock")}</p>
      )}

      {offer.status === "matched" &&
        offer.chain_offer_id &&
        onChainDataReady &&
        !bothConfirmedOnChain &&
        role !== "none" && (
          <PrimaryAction
            label={step === "confirming" ? t("confirming") : t("confirmTrade")}
            onClick={handleConfirm}
            loading={step === "confirming"}
          />
        )}

      {offer.status === "matched" && bothConfirmedOnChain && (
        <PrimaryAction label={t("markReleasedTitle")} onClick={handleMarkReleased} />
      )}

      {/* Stuck: counterparty confirmed but not released — offer the arbiter path
          instead of a refund that would (correctly) revert on-chain. */}
      {offer.status === "matched" && isStuck && role !== "none" && (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-text-muted">{t("stuckHint")}</p>
          <button
            onClick={handleRaiseDispute}
            disabled={step !== "idle"}
            className="self-start text-xs text-text-dim underline decoration-dotted hover:text-danger disabled:opacity-50"
          >
            {step === "disputing" ? t("disputing") : t("raiseDispute")}
          </button>
        </div>
      )}

      {/* Depositor pulls out before the counterparty confirms (no cash delivered yet). */}
      {offer.status === "matched" && canCancel && (
        <button
          onClick={handleCancel}
          disabled={step !== "idle"}
          className="self-start text-xs text-text-dim underline decoration-dotted hover:text-danger disabled:opacity-50"
        >
          {step === "cancelling" ? t("cancelling") : t("cancelOffer")}
        </button>
      )}

      {/* Timeout no-show refund — only shown once it will actually succeed. */}
      {offer.status === "matched" && canRefund && (
        <button
          onClick={handleRefund}
          disabled={step !== "idle"}
          className="self-start text-xs text-text-dim underline decoration-dotted hover:text-danger disabled:opacity-50"
        >
          {step === "refunding" ? t("refunding") : t("refundAfterTimeout")}
        </button>
      )}
    </div>
  );
}
