/**
 * Cardano epoch reference: Epoch 208 started on July 29, 2020 at 21:44:51 UTC (Shelley era start)
 * Each epoch is exactly 5 days (432,000 seconds)
 */
export const SHELLEY_START_EPOCH = 208;
export const SHELLEY_START_TIME = new Date("2020-07-29T21:44:51Z").getTime();
export const EPOCH_DURATION_MS = 5 * 24 * 60 * 60 * 1000; // 5 days in milliseconds

/**
 * Get current epoch number
 */
export function getCurrentEpoch(): number {
  const now = Date.now();
  const epochsSinceShelley = Math.floor((now - SHELLEY_START_TIME) / EPOCH_DURATION_MS);
  return SHELLEY_START_EPOCH + epochsSinceShelley;
}

/**
 * Convert epoch number to timestamp
 */
export function epochToTimestamp(epoch: number): number {
  const epochsSinceShelley = epoch - SHELLEY_START_EPOCH;
  return SHELLEY_START_TIME + (epochsSinceShelley * EPOCH_DURATION_MS);
}
