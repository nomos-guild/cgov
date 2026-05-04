import { useCallback, useEffect, useRef, useState } from "react";
import { useWallet } from "@meshsdk/react";
import { BrowserWallet } from "@meshsdk/core";
import {
  assertMainnet,
  clearOwnership,
  isOwnershipFresh,
  loadOwnership,
  proveOwnership,
  saveOwnership,
  WalletNetworkError,
  WalletOwnershipError,
  type WalletOwnershipProof,
} from "@/lib/walletAuth";

export type WalletAuthStatus =
  | "idle"
  | "verifying-network"
  | "awaiting-signature"
  | "verified"
  | "error";

interface UseWalletAuthResult {
  status: WalletAuthStatus;
  proof: WalletOwnershipProof | null;
  error: string | null;
  /**
   * Enable a CIP-30 wallet, enforce mainnet + sign-data ownership, and only
   * then commit it to the Mesh context. Throws (and never connects Mesh) if
   * any check fails.
   */
  connectAndVerify: (walletId: string) => Promise<WalletOwnershipProof>;
  /** Disconnect, clear cached proof, reset status. */
  signOut: () => void;
  isVerified: boolean;
}

/**
 * Central wallet auth flow:
 *   - Calls Mesh `setPersist(true)` so the wallet auto-reconnects on refresh.
 *   - Restores a cached ownership proof from localStorage if still fresh and
 *     matching the reconnected wallet.
 *   - Provides `verify()` to enforce mainnet + sign-data ownership after a
 *     user-initiated connect.
 *
 * Connect flow used by the wallet modal:
 *   await connectAndVerify(walletId);   // network + sign checks before Mesh commits
 */
export function useWalletAuth(): UseWalletAuthResult {
  const { connected, wallet, name, disconnect, setPersist, setWallet } =
    useWallet();

  const [status, setStatus] = useState<WalletAuthStatus>("idle");
  const [proof, setProof] = useState<WalletOwnershipProof | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Track which wallet id we last verified for, so we don't loop on rerenders
  // and so we re-verify if the user switches wallet.
  const verifiedForRef = useRef<string | null>(null);

  // Enable Mesh's built-in wallet persistence (auto-reconnect on refresh).
  useEffect(() => {
    setPersist(true);
  }, [setPersist]);

  // On mount and whenever the connected wallet changes, attempt to restore a
  // cached ownership proof. If the proof is missing/stale/mismatched, we leave
  // status as "idle" and let the next user action trigger `verify()`.
  useEffect(() => {
    if (!connected || !wallet || !name) {
      verifiedForRef.current = null;
      if (status !== "idle") setStatus("idle");
      setProof(null);
      setError(null);
      return;
    }

    if (verifiedForRef.current === name) return;

    // Always re-check the network when Mesh has resolved a connection — covers
    // both the auto-reconnect path and any code that bypasses connectAndVerify.
    // A testnet wallet must be ejected even if no cached proof exists.
    let cancelled = false;
    assertMainnet(wallet)
      .then(() => {
        if (cancelled) return;
        const cached = loadOwnership();
        if (
          cached &&
          cached.walletId === name &&
          isOwnershipFresh(cached)
        ) {
          verifiedForRef.current = name;
          setProof(cached);
          setStatus("verified");
          setError(null);
        } else {
          // Stale or missing cache — leave status idle; user re-signs on next action.
          if (cached) clearOwnership();
          setProof(null);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        clearOwnership();
        disconnect();
        setProof(null);
        setStatus("error");
        setError(err instanceof Error ? err.message : "Network check failed.");
      });

    return () => {
      cancelled = true;
    };
  }, [connected, wallet, name, disconnect, status]);

  const connectAndVerify = useCallback(
    async (walletId: string): Promise<WalletOwnershipProof> => {
      setError(null);
      setStatus("verifying-network");

      // 1. Enable the CIP-30 wallet ourselves so we hold a wallet instance
      //    BEFORE Mesh commits it to the React context. This avoids the
      //    stale-closure problem where Mesh's `connect()` updates state
      //    asynchronously and any follow-up check sees the previous render.
      let browserWallet: BrowserWallet;
      try {
        browserWallet = await BrowserWallet.enable(walletId);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Failed to enable wallet.";
        setStatus("error");
        setError(message);
        throw err instanceof Error ? err : new Error(message);
      }

      // 2. Mainnet enforcement — testnet wallets are rejected before Mesh
      //    ever sees them, so the app never enters a connected-on-testnet state.
      try {
        await assertMainnet(browserWallet);
      } catch (err) {
        const message =
          err instanceof WalletNetworkError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Network check failed.";
        setStatus("error");
        setError(message);
        throw err;
      }

      // 3. Sign-data ownership proof.
      setStatus("awaiting-signature");
      let nextProof: WalletOwnershipProof;
      try {
        nextProof = await proveOwnership(browserWallet, walletId);
      } catch (err) {
        const message =
          err instanceof WalletOwnershipError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Ownership verification failed.";
        setStatus("error");
        setError(message);
        throw err;
      }

      // 4. Commit to Mesh context with persistence so refresh auto-reconnects.
      saveOwnership(nextProof);
      verifiedForRef.current = walletId;
      setWallet(browserWallet, walletId, {});
      setProof(nextProof);
      setStatus("verified");
      return nextProof;
    },
    [setWallet]
  );

  const signOut = useCallback(() => {
    clearOwnership();
    verifiedForRef.current = null;
    setProof(null);
    setStatus("idle");
    setError(null);
    disconnect();
  }, [disconnect]);

  return {
    status,
    proof,
    error,
    connectAndVerify,
    signOut,
    isVerified: status === "verified",
  };
}
