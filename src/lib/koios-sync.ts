/**
 * Koios Sync Utilities
 * 
 * Helper functions for syncing governance data from Koios API.
 * These functions wrap the internal API endpoints and provide
 * a convenient interface for fetching blocks, transactions, and certificates.
 */

export type Block = {
  hash: string;
  epoch_no: number;
  abs_slot: number;
  epoch_slot: number;
  block_height: number;
  block_size: number;
  block_time: number;
  tx_count: number;
  vrf_key: string;
  pool: string | null;
  op_cert_counter: number;
  proto_major: number;
  proto_minor: number;
};

export type Transaction = {
  tx_hash: string;
  block_hash: string;
  block_height: number;
  epoch_no: number;
  epoch_slot: number;
  abs_slot: number;
  tx_timestamp: number;
  tx_block_index: number;
  tx_size: number;
  total_output: string;
  fee: string;
  treasury_donation: string;
  deposit: string;
  invalid_before: string | null;
  invalid_after: string | null;
  certificates: Certificate[];
  [key: string]: unknown;
};

export type Certificate = {
  index: number;
  type: string;
  info: unknown;
  [key: string]: unknown;
};

export type CertificateWithContext = Certificate & {
  tx_hash: string;
  block_hash: string;
  block_height: number;
  epoch_no: number;
  abs_slot: number;
  tx_timestamp: number;
};

export type SyncResult = {
  from_slot: number;
  to_slot?: number;
  blocks_fetched: number;
  transactions_fetched: number;
  certificates_fetched: number;
  governance_certificates: number;
  blocks: Array<{
    hash: string;
    abs_slot: number;
    block_height: number;
    block_time: number;
    tx_count: number;
  }>;
  governance_updates: {
    pool_registrations: number;
    pool_retirements: number;
    drep_registrations: number;
    drep_deregistrations: number;
    vote_delegations: number;
    committee_updates: number;
    stake_delegations: number;
  };
  proposals?: unknown[];
  votes?: unknown[];
};

export type ApiResponse<T> = {
  total: number;
  count: number;
  offset: number;
  limit: number;
  data: T[];
};

/**
 * Fetch blocks starting from a specific slot
 */
export async function fetchBlocksFromSlot(
  fromSlot: number,
  options: {
    toSlot?: number;
    limit?: number;
    offset?: number;
  } = {}
): Promise<ApiResponse<Block>> {
  const params = new URLSearchParams({
    from_slot: String(fromSlot),
    limit: String(options.limit ?? 100),
    offset: String(options.offset ?? 0),
  });

  if (options.toSlot !== undefined) {
    params.set("to_slot", String(options.toSlot));
  }

  const response = await fetch(`/api/governance/blocks?${params}`);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `Failed to fetch blocks: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch transactions by block hash(es)
 */
export async function fetchTransactionsByBlocks(
  blockHashes: string[],
  options: {
    limit?: number;
    offset?: number;
  } = {}
): Promise<ApiResponse<Transaction>> {
  const params = new URLSearchParams({
    block_hashes: blockHashes.join(","),
    limit: String(options.limit ?? 50),
    offset: String(options.offset ?? 0),
  });

  const response = await fetch(`/api/governance/transactions?${params}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `Failed to fetch transactions: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch transactions by tx hashes
 */
export async function fetchTransactionsByHashes(
  txHashes: string[],
  options: {
    limit?: number;
    offset?: number;
  } = {}
): Promise<ApiResponse<Transaction>> {
  const response = await fetch(`/api/governance/transactions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      _tx_hashes: txHashes,
      limit: options.limit ?? 50,
      offset: options.offset ?? 0,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `Failed to fetch transactions: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch certificates from specific blocks
 */
export async function fetchCertificatesFromBlocks(
  blockHashes: string[],
  options: {
    governanceOnly?: boolean;
    certTypes?: string[];
    limit?: number;
    offset?: number;
  } = {}
): Promise<ApiResponse<CertificateWithContext>> {
  const params = new URLSearchParams({
    limit: String(options.limit ?? 100),
    offset: String(options.offset ?? 0),
  });

  if (options.governanceOnly) {
    params.set("governance_only", "true");
  }

  if (options.certTypes && options.certTypes.length > 0) {
    params.set("cert_type", options.certTypes.join(","));
  }

  const response = await fetch(`/api/governance/certificates?${params}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      _block_hashes: blockHashes,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `Failed to fetch certificates: ${response.status}`);
  }

  return response.json();
}

/**
 * Sync all governance data from a specific slot
 * This is a convenience method that fetches blocks, transactions, and certificates
 * in a single coordinated operation.
 */
export async function syncFromSlot(
  fromSlot: number,
  options: {
    toSlot?: number;
    maxBlocks?: number;
    includeProposals?: boolean;
    includeVotes?: boolean;
  } = {}
): Promise<SyncResult> {
  const params = new URLSearchParams({
    from_slot: String(fromSlot),
    max_blocks: String(options.maxBlocks ?? 100),
  });

  if (options.toSlot !== undefined) {
    params.set("to_slot", String(options.toSlot));
  }

  if (options.includeProposals) {
    params.set("include_proposals", "true");
  }

  if (options.includeVotes) {
    params.set("include_votes", "true");
  }

  const response = await fetch(`/api/governance/sync_from_slot?${params}`);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `Failed to sync from slot: ${response.status}`);
  }

  return response.json();
}

/**
 * Get current sync status
 */
export async function getSyncStatus(): Promise<{
  last_synced_slot: number;
  last_synced_block_hash: string;
  last_synced_block_height: number;
  last_synced_time: string;
  current_tip_slot?: number;
  current_tip_block_height?: number;
  blocks_behind?: number;
}> {
  const response = await fetch("/api/governance/sync_status");
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `Failed to get sync status: ${response.status}`);
  }

  return response.json();
}

/**
 * Update sync status (for internal use)
 */
export async function updateSyncStatus(data: {
  slot: number;
  block_hash: string;
  block_height: number;
}): Promise<void> {
  const response = await fetch("/api/governance/sync_status", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `Failed to update sync status: ${response.status}`);
  }
}

/**
 * Incremental sync helper
 * Fetches new data since the last sync and processes it in batches
 */
export async function* incrementalSync(options: {
  startSlot?: number;
  batchSize?: number;
  maxBlocks?: number;
} = {}): AsyncGenerator<SyncResult> {
  const batchSize = options.batchSize ?? 100;
  let currentSlot = options.startSlot;

  if (currentSlot === undefined) {
    const status = await getSyncStatus();
    currentSlot = status.last_synced_slot || 0;
  }

  let totalBlocksFetched = 0;
  const maxBlocks = options.maxBlocks ?? Infinity;

  while (totalBlocksFetched < maxBlocks) {
    const remainingBlocks = maxBlocks - totalBlocksFetched;
    const currentBatchSize = Math.min(batchSize, remainingBlocks);

    const result = await syncFromSlot(currentSlot, {
      maxBlocks: currentBatchSize,
    });

    if (result.blocks_fetched === 0) {
      // No more blocks to fetch
      break;
    }

    yield result;

    totalBlocksFetched += result.blocks_fetched;

    // Update current slot to the last block's slot + 1
    const lastBlock = result.blocks[result.blocks.length - 1];
    if (lastBlock) {
      currentSlot = lastBlock.abs_slot + 1;
    } else {
      break;
    }
  }
}


