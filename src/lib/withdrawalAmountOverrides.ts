/**
 * Frontend overrides for the backend's `withdrawalAmount` field.
 *
 * Some treasury withdrawal proposals come back from the backend with an
 * incorrect amount (off by orders of magnitude vs the proposal's stated
 * ask). Until the backend is corrected, we override the value here so
 * downstream UI (chart, totals, stats, profile pages) shows the right
 * number everywhere.
 *
 * Keys are CIP-129 governance action IDs (`gov_action1...` bech32). All
 * values are in lovelace, matching the backend's expected unit.
 */

const WITHDRAWAL_AMOUNT_OVERRIDES: Record<string, string> = {
  // Cardano Global Listing Expansion - Powered by Snek (Expired). Backend
  // returns "5000000" lovelace = 5 ADA but the proposal rationale and the
  // actual ask is 5,000,000 ADA = 5e12 lovelace.
  "gov_action1fl6r784t2ffw7q96du2znhprw90r3xvrfugvqelgqewgxex42kdqq9tgrd5":
    "5000000000000",
};

export function correctedWithdrawalAmount(
  proposalId: string | null | undefined,
  raw: string | null | undefined
): string | null {
  if (proposalId && WITHDRAWAL_AMOUNT_OVERRIDES[proposalId]) {
    return WITHDRAWAL_AMOUNT_OVERRIDES[proposalId];
  }
  return raw ?? null;
}
