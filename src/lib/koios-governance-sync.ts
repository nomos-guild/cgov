/**
 * Koios Governance Sync Library
 * 
 * Core business logic for syncing governance data from Koios API.
 * Can be used independently from API endpoints.
 */

// Types
export type CertificateInfo = {
  // Stake credentials
  credential?: {
    key_hash?: string;
    script_hash?: string;
  };
  stake_credential?: {
    key_hash?: string;
    script_hash?: string;
  };
  
  // Pool info
  pool_id?: string;
  pool_params?: {
    operator: string;
    vrf_key_hash: string;
    pledge: string;
    cost: string;
    margin: {
      numerator: string;
      denominator: string;
    };
    reward_account: string;
    pool_owners: string[];
    relays: unknown[];
    pool_metadata?: {
      url: string;
      hash: string;
    } | null;
  };
  epoch?: number;
  
  // DRep info
  drep_id?: string;
  drep_credential?: {
    key_hash?: string;
    script_hash?: string;
  };
  deposit?: string;
  anchor?: {
    url: string;
    data_hash: string;
  } | null;
  
  // Committee info
  cold_credential?: {
    key_hash?: string;
    script_hash?: string;
  };
  hot_credential?: {
    key_hash?: string;
    script_hash?: string;
  };
  
  // MIR/Treasury
  pot?: "reserves" | "treasury";
  amount?: string;
  
  [key: string]: unknown;
};

export type GovernanceCertificate = {
  type: string;
  index: number;
  info: CertificateInfo;
  
  // Transaction and block context
  tx_hash: string;
  block_hash: string;
  block_height: number;
  block_time: number;
  epoch_no: number;
  abs_slot: number;
  tx_timestamp: number;
};

export type VotingProcedure = {
  voter: {
    role: "ConstitutionalCommittee" | "DRep" | "SPO";
    credential: {
      key_hash?: string;
      script_hash?: string;
    };
  };
  vote: "VoteYes" | "VoteNo" | "Abstain";
  anchor?: {
    url: string;
    data_hash: string;
  } | null;
};

export type GovernanceVote = {
  // Conway era: votes come from tx.voting_procedures
  tx_hash: string;
  block_hash: string;
  block_height: number;
  block_time: number;
  epoch_no: number;
  abs_slot: number;
  tx_timestamp: number;
  
  // Voting procedure data
  voter: {
    role: "ConstitutionalCommittee" | "DRep" | "SPO";
    credential: {
      key_hash?: string;
      script_hash?: string;
    };
  };
  vote: "VoteYes" | "VoteNo" | "Abstain";
  anchor?: {
    url: string;
    data_hash: string;
  } | null;
  gov_action_proposal_id?: {
    tx_hash: string;
    index: number;
  };
};

export type GovernanceActionType =
  | "ParameterChange"
  | "HardForkInitiation"
  | "TreasuryWithdrawals"
  | "NoConfidence"
  | "UpdateCommittee"
  | "NewConstitution"
  | "InfoAction";

export type GovernanceActionDetails = {
  // Common fields
  prev_action_id?: {
    tx_hash: string;
    index: number;
  } | null;
  
  // ParameterChange specific
  policy_hash?: string | null;
  protocol_param_updates?: Record<string, unknown>;
  
  // HardForkInitiation specific
  protocol_version?: {
    major: number;
    minor: number;
  };
  
  // TreasuryWithdrawals specific
  withdrawals?: Array<{
    stake_credential: {
      key_hash?: string;
      script_hash?: string;
    };
    amount: string;
  }>;
  
  // UpdateCommittee specific
  members_to_remove?: Array<{
    key_hash?: string;
    script_hash?: string;
  }>;
  members_to_add?: Array<{
    credential: {
      key_hash?: string;
      script_hash?: string;
    };
    epoch: number;
  }>;
  quorum?: {
    numerator: string;
    denominator: string;
  };
  
  // NewConstitution specific
  constitution?: {
    anchor: {
      url: string;
      data_hash: string;
    };
    script_hash?: string | null;
  };
  
  [key: string]: unknown;
};

export type ProposalProcedure = {
  deposit: string;
  return_address: string;
  governance_action: {
    type: GovernanceActionType;
    details?: GovernanceActionDetails;
  };
  anchor?: {
    url: string;
    data_hash: string;
  } | null;
};

export type GovernanceProposal = {
  // Conway era: proposals come from tx.proposal_procedures
  tx_hash: string;
  block_hash: string;
  block_height: number;
  block_time: number;
  epoch_no: number;
  abs_slot: number;
  tx_timestamp: number;
  
  // Proposal procedure data
  index: number;
  deposit: string;
  return_address: string;
  governance_action: {
    type: GovernanceActionType;
    details?: GovernanceActionDetails;
  };
  anchor?: {
    url: string;
    data_hash: string;
  } | null;
};

export type GovernanceChanges = {
  from_slot: number;
  to_slot: number;
  certificates: GovernanceCertificate[];
  votes: GovernanceVote[];
  proposals: GovernanceProposal[];
  summary: {
    total_certificates: number;
    total_votes: number;
    total_proposals: number;
    blocks_scanned: number;
  };
};

export type SyncOptions = {
  fromSlot: number;
  toSlot?: number;
  maxBlocks?: number;
  koiosApiKey?: string;
  koiosBaseUrl?: string;
};

// All certificate types in Conway era
const ALL_CERT_TYPES = new Set([
  "committee_hot_auth",
  "committee_cold_resign",
  "drep_registration",
  "drep_retire",
  "drep_update",
  "pool_delegation",
  "pool_update",
  "stake_deregistration",
  "stake_registration",
  "treasury_MIR",
  "vote_delegation",
]);

function isGovernanceCertificate(cert: { type: string }): boolean {
  const certType = (cert.type || "").toLowerCase().trim();
  
  // If no cert type, skip
  if (!certType) {
    return false;
  }
  
  // Check exact matches first
  if (ALL_CERT_TYPES.has(certType)) {
    return true;
  }
  
  // Check if cert type contains any of our known types
  for (const knownType of ALL_CERT_TYPES) {
    if (certType.includes(knownType.toLowerCase())) {
      return true;
    }
  }
  
  // Include any cert that mentions governance-related keywords
  const governanceKeywords = [
    "stake",
    "pool",
    "drep",
    "vote",
    "deleg",
    "committee",
    "constitutional",
  ];
  
  for (const keyword of governanceKeywords) {
    if (certType.includes(keyword)) {
      return true;
    }
  }
  
  return false;
}

function getKoiosHeaders(apiKey?: string): HeadersInit {
  const headers: Record<string, string> = { accept: "application/json" };
  const key = apiKey || process.env.KOIOS_API_KEY;
  if (key && key.trim().length > 0) {
    headers["Authorization"] = `Bearer ${key}`;
    headers["X-API-Key"] = key;
  }
  return headers;
}

/**
 * Sync governance data from Koios starting from a specific slot
 */
export async function syncGovernanceFromSlot(
  options: SyncOptions
): Promise<GovernanceChanges> {
  const {
    fromSlot,
    toSlot,
    maxBlocks = 500,
    koiosApiKey,
    koiosBaseUrl = "https://api.koios.rest/api/v1",
  } = options;

  const KOIOS_BLOCKS_ENDPOINT = `${koiosBaseUrl}/blocks`;
  const KOIOS_BLOCK_TXS_ENDPOINT = `${koiosBaseUrl}/block_txs`;
  const KOIOS_TX_INFO_ENDPOINT = `${koiosBaseUrl}/tx_info`;

  // 1. Fetch blocks in the slot range
  const blocksUrl = new URL(KOIOS_BLOCKS_ENDPOINT);
  blocksUrl.searchParams.set("abs_slot", `gte.${fromSlot}`);
  if (toSlot !== undefined) {
    blocksUrl.searchParams.set("abs_slot", `lte.${toSlot}`);
  }
  blocksUrl.searchParams.set("limit", String(maxBlocks));
  blocksUrl.searchParams.set("order", "abs_slot.asc");

  const blocksController = new AbortController();
  const blocksTimeout = setTimeout(() => blocksController.abort(), 30_000);

  const blocksResponse = await fetch(blocksUrl.toString(), {
    method: "GET",
    headers: getKoiosHeaders(koiosApiKey),
    signal: blocksController.signal,
  });
  clearTimeout(blocksTimeout);

  if (!blocksResponse.ok) {
    throw new Error(`Failed to fetch blocks: ${blocksResponse.status}`);
  }

  const blocks = (await blocksResponse.json()) as Array<{
    hash: string;
    abs_slot: number;
    block_height: number;
    block_time: number;
    epoch_no: number;
    tx_count: number;
    [key: string]: unknown;
  }>;

  if (blocks.length === 0) {
    return {
      from_slot: fromSlot,
      to_slot: toSlot || fromSlot,
      certificates: [],
      votes: [],
      proposals: [],
      summary: {
        total_certificates: 0,
        total_votes: 0,
        total_proposals: 0,
        blocks_scanned: 0,
      },
    };
  }

  const actualToSlot = blocks[blocks.length - 1].abs_slot;

  // 2. Get all tx hashes from blocks
  const blockHashes = blocks.map((b) => b.hash);
  
  const blockTxsController = new AbortController();
  const blockTxsTimeout = setTimeout(() => blockTxsController.abort(), 30_000);

  const blockTxsResponse = await fetch(KOIOS_BLOCK_TXS_ENDPOINT, {
    method: "POST",
    headers: {
      ...getKoiosHeaders(koiosApiKey),
      "content-type": "application/json",
    },
    body: JSON.stringify({ _block_hashes: blockHashes }),
    signal: blockTxsController.signal,
  });
  clearTimeout(blockTxsTimeout);

  if (!blockTxsResponse.ok) {
    throw new Error(`Failed to fetch block transactions: ${blockTxsResponse.status}`);
  }

  // Koios returns one object per transaction
  const blockTxs = (await blockTxsResponse.json()) as Array<{
    block_hash: string;
    tx_hash: string;
    [key: string]: unknown;
  }>;

  const allTxHashes: string[] = [];
  for (const bt of blockTxs) {
    if (bt.tx_hash) {
      allTxHashes.push(bt.tx_hash);
    }
  }

  // 3. Fetch transaction details with certificates, votes, and proposals
  const governanceCertificates: GovernanceCertificate[] = [];
  const governanceVotes: GovernanceVote[] = [];
  const governanceProposals: GovernanceProposal[] = [];

  if (allTxHashes.length > 0) {
    const batchSize = 50;
    for (let i = 0; i < allTxHashes.length; i += batchSize) {
      const batch = allTxHashes.slice(i, i + batchSize);
      
      const txInfoController = new AbortController();
      const txInfoTimeout = setTimeout(() => txInfoController.abort(), 60_000);

      const txInfoResponse = await fetch(KOIOS_TX_INFO_ENDPOINT, {
        method: "POST",
        headers: {
          ...getKoiosHeaders(koiosApiKey),
          "content-type": "application/json",
        },
        body: JSON.stringify({ 
          _tx_hashes: batch,
          _certs: true,           // Include certificates
          _governance: true        // Include voting_procedures and proposal_procedures
        }),
        signal: txInfoController.signal,
      });
      clearTimeout(txInfoTimeout);

      if (txInfoResponse.ok) {
        const transactions = (await txInfoResponse.json()) as Array<{
          tx_hash: string;
          block_hash: string;
          block_height: number;
          epoch_no: number;
          abs_slot: number;
          tx_timestamp: number;
          certificates?: Array<{
            type: string;
            index: number;
            info: CertificateInfo;
          }>;
          voting_procedures?: Array<VotingProcedure & {
            gov_action_proposal_id?: {
              tx_hash: string;
              index: number;
            };
          }>;
          proposal_procedures?: Array<ProposalProcedure & {
            index?: number;
          }>;
        }>;

        for (const tx of transactions) {
          // Find block_time for this transaction
          const block = blocks.find((b) => b.hash === tx.block_hash);
          const blockTime = block?.block_time || tx.tx_timestamp;
          
          // Extract certificates
          if (Array.isArray(tx.certificates) && tx.certificates.length > 0) {
            for (const cert of tx.certificates) {
              // Filter only governance certificates
              if (isGovernanceCertificate(cert)) {
                governanceCertificates.push({
                  type: cert.type,
                  index: cert.index,
                  info: cert.info,
                  tx_hash: tx.tx_hash,
                  block_hash: tx.block_hash,
                  block_height: tx.block_height,
                  block_time: blockTime,
                  epoch_no: tx.epoch_no,
                  abs_slot: tx.abs_slot,
                  tx_timestamp: tx.tx_timestamp,
                });
              }
            }
          }
          
          // Extract voting_procedures (Conway era votes)
          if (Array.isArray(tx.voting_procedures) && tx.voting_procedures.length > 0) {
            for (const voteProcedure of tx.voting_procedures) {
              governanceVotes.push({
                tx_hash: tx.tx_hash,
                block_hash: tx.block_hash,
                block_height: tx.block_height,
                block_time: blockTime,
                epoch_no: tx.epoch_no,
                abs_slot: tx.abs_slot,
                tx_timestamp: tx.tx_timestamp,
                voter: voteProcedure.voter,
                vote: voteProcedure.vote,
                anchor: voteProcedure.anchor,
                gov_action_proposal_id: voteProcedure.gov_action_proposal_id,
              });
            }
          }
          
          // Extract proposal_procedures (Conway era proposals)
          if (Array.isArray(tx.proposal_procedures) && tx.proposal_procedures.length > 0) {
            for (let idx = 0; idx < tx.proposal_procedures.length; idx++) {
              const proposalProcedure = tx.proposal_procedures[idx];
              governanceProposals.push({
                tx_hash: tx.tx_hash,
                block_hash: tx.block_hash,
                block_height: tx.block_height,
                block_time: blockTime,
                epoch_no: tx.epoch_no,
                abs_slot: tx.abs_slot,
                tx_timestamp: tx.tx_timestamp,
                index: proposalProcedure.index ?? idx,
                deposit: proposalProcedure.deposit,
                return_address: proposalProcedure.return_address,
                governance_action: proposalProcedure.governance_action,
                anchor: proposalProcedure.anchor,
              });
            }
          }
        }
      }
    }
  }

  // 4. Build result
  const result: GovernanceChanges = {
    from_slot: fromSlot,
    to_slot: actualToSlot,
    certificates: governanceCertificates.sort((a, b) => a.abs_slot - b.abs_slot),
    votes: governanceVotes.sort((a, b) => a.abs_slot - b.abs_slot),
    proposals: governanceProposals.sort((a, b) => a.abs_slot - b.abs_slot),
    summary: {
      total_certificates: governanceCertificates.length,
      total_votes: governanceVotes.length,
      total_proposals: governanceProposals.length,
      blocks_scanned: blocks.length,
    },
  };

  return result;
}

