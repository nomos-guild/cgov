import {
  checkSignature,
  generateNonce,
  type DataSignature,
  type IWallet,
} from "@meshsdk/core";

export const MAINNET_ID = 1;
export const TESTNET_ID = 0;

const STORAGE_KEY = "cgov.walletOwnership";
const OWNERSHIP_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export interface WalletOwnershipProof {
  walletId: string;
  address: string;
  nonce: string;
  signature: DataSignature;
  timestamp: number;
}

export class WalletNetworkError extends Error {
  readonly networkId: number;
  constructor(networkId: number) {
    super(
      networkId === TESTNET_ID
        ? "Testnet wallets are not supported. Please switch your wallet to Mainnet and reconnect."
        : `Unsupported network (id=${networkId}). Please switch your wallet to Mainnet.`
    );
    this.name = "WalletNetworkError";
    this.networkId = networkId;
  }
}

export class WalletOwnershipError extends Error {
  constructor(message = "Failed to verify wallet ownership.") {
    super(message);
    this.name = "WalletOwnershipError";
  }
}

export async function assertMainnet(wallet: IWallet): Promise<void> {
  const networkId = await wallet.getNetworkId();
  if (networkId !== MAINNET_ID) {
    throw new WalletNetworkError(networkId);
  }
}

async function resolveSigningAddress(wallet: IWallet): Promise<string> {
  // Prefer the reward (stake) address: Ledger/Trezor firmware only supports
  // CIP-8 signing with the stake key, so signing against a base/payment
  // address fails verification when the wallet is connected via a hardware
  // device (even when forwarded through Eternl). The stake address commits
  // only to the stake key hash, which both hot and hardware wallets sign
  // with consistently.
  const reward = await wallet.getRewardAddresses();
  if (reward && reward.length > 0) return reward[0];
  const used = await wallet.getUsedAddresses();
  if (used && used.length > 0) return used[0];
  const unused = await wallet.getUnusedAddresses();
  if (unused && unused.length > 0) return unused[0];
  throw new WalletOwnershipError(
    "Unable to retrieve wallet address for signing."
  );
}

export async function proveOwnership(
  wallet: IWallet,
  walletId: string
): Promise<WalletOwnershipProof> {
  const address = await resolveSigningAddress(wallet);
  const timestamp = Date.now();
  const nonce = generateNonce(
    `Sign in to cgov to prove ownership of ${address}. Timestamp: ${timestamp}. `
  );

  let signature: DataSignature;
  try {
    signature = await wallet.signData(nonce, address);
  } catch (err) {
    throw new WalletOwnershipError(
      err instanceof Error
        ? `Signature was rejected: ${err.message}`
        : "Signature was rejected."
    );
  }

  const valid = await checkSignature(nonce, signature, address).catch(
    () => false
  );
  if (!valid) {
    throw new WalletOwnershipError(
      "Signature did not verify against the wallet address."
    );
  }

  return { walletId, address, nonce, signature, timestamp };
}

export function saveOwnership(proof: WalletOwnershipProof): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(proof));
  } catch {
    // storage unavailable (private mode / quota) — ignore
  }
}

export function loadOwnership(): WalletOwnershipProof | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WalletOwnershipProof;
    if (
      !parsed ||
      typeof parsed.walletId !== "string" ||
      typeof parsed.address !== "string" ||
      typeof parsed.nonce !== "string" ||
      typeof parsed.timestamp !== "number" ||
      !parsed.signature
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearOwnership(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function isOwnershipFresh(
  proof: WalletOwnershipProof | null,
  now: number = Date.now()
): boolean {
  if (!proof) return false;
  return now - proof.timestamp < OWNERSHIP_TTL_MS;
}
