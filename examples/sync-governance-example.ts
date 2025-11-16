/**
 * Example: Using syncGovernanceFromSlot function independently
 * 
 * This shows how to use the core sync function without going through the API endpoint.
 */

import { syncGovernanceFromSlot } from "@/lib/koios-governance-sync";
import type { GovernanceChanges } from "@/lib/koios-governance-sync";

/**
 * Example 1: Simple sync from a slot
 */
async function simpleSync() {
  console.log("Example 1: Simple sync from slot 171000000\n");
  
  const result = await syncGovernanceFromSlot({
    fromSlot: 171000000,
    maxBlocks: 50,
  });

  console.log(`Scanned ${result.summary.blocks_scanned} blocks`);
  console.log(`Found ${result.summary.total_certificates} certificates`);
  console.log(`Found ${result.summary.total_votes} votes`);
  console.log(`Found ${result.summary.total_proposals} proposals`);
  
  return result;
}

/**
 * Example 2: Sync with API key and custom network
 */
async function syncWithApiKey() {
  console.log("Example 2: Sync with API key\n");
  
  const result = await syncGovernanceFromSlot({
    fromSlot: 171000000,
    toSlot: 171010000,
    maxBlocks: 100,
    koiosApiKey: process.env.KOIOS_API_KEY,
    koiosBaseUrl: "https://api.koios.rest/api/v1",
  });

  console.log(`Synced from slot ${result.from_slot} to ${result.to_slot}`);
  
  return result;
}

/**
 * Example 3: Process certificates
 */
async function processCertificates() {
  console.log("Example 3: Process certificates\n");
  
  const result = await syncGovernanceFromSlot({
    fromSlot: 171000000,
    maxBlocks: 100,
  });

  // Group by certificate type
  const certsByType = result.certificates.reduce((acc, cert) => {
    acc[cert.type] = (acc[cert.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log("Certificates by type:");
  for (const [type, count] of Object.entries(certsByType)) {
    console.log(`  ${type}: ${count}`);
  }

  // Find DRep registrations
  const drepRegs = result.certificates.filter(c => 
    c.type.toLowerCase().includes('drep') && c.type.toLowerCase().includes('reg')
  );
  
  console.log(`\nFound ${drepRegs.length} DRep registrations:`);
  for (const drep of drepRegs) {
    const date = new Date(drep.block_time * 1000);
    console.log(`  - ${date.toISOString()} at slot ${drep.abs_slot}`);
    console.log(`    Tx: ${drep.tx_hash}`);
  }
}

/**
 * Example 4: Process votes
 */
async function processVotes() {
  console.log("Example 4: Process votes\n");
  
  const result = await syncGovernanceFromSlot({
    fromSlot: 171000000,
    maxBlocks: 100,
  });

  console.log(`Total votes: ${result.votes.length}`);

  // Group by voter role
  const votesByRole = result.votes.reduce((acc, vote) => {
    const role = vote.voter_role || 'Unknown';
    acc[role] = (acc[role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log("\nVotes by role:");
  for (const [role, count] of Object.entries(votesByRole)) {
    console.log(`  ${role}: ${count}`);
  }

  // Group by vote choice
  const votesByChoice = result.votes.reduce((acc, vote) => {
    const choice = vote.vote || 'Unknown';
    acc[choice] = (acc[choice] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log("\nVotes by choice:");
  for (const [choice, count] of Object.entries(votesByChoice)) {
    console.log(`  ${choice}: ${count}`);
  }
}

/**
 * Example 5: Process proposals
 */
async function processProposals() {
  console.log("Example 5: Process proposals\n");
  
  const result = await syncGovernanceFromSlot({
    fromSlot: 171000000,
    maxBlocks: 100,
  });

  console.log(`Total proposals: ${result.proposals.length}`);

  // Group by proposal type
  const proposalsByType = result.proposals.reduce((acc, proposal) => {
    const type = proposal.proposal_type || 'Unknown';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log("\nProposals by type:");
  for (const [type, count] of Object.entries(proposalsByType)) {
    console.log(`  ${type}: ${count}`);
  }

  // Show proposal details
  for (const proposal of result.proposals) {
    const date = new Date(proposal.block_time * 1000);
    console.log(`\n  ${proposal.proposal_type} at ${date.toISOString()}`);
    console.log(`    Slot: ${proposal.abs_slot}, Epoch: ${proposal.epoch_no}`);
    console.log(`    Tx: ${proposal.tx_hash}`);
  }
}

/**
 * Example 6: Incremental batch sync
 */
async function incrementalBatchSync() {
  console.log("Example 6: Incremental batch sync\n");
  
  let currentSlot = 171000000;
  const batchSize = 100;
  const totalBatches = 5;

  for (let i = 0; i < totalBatches; i++) {
    console.log(`\nBatch ${i + 1}/${totalBatches}: Starting from slot ${currentSlot}`);
    
    const result = await syncGovernanceFromSlot({
      fromSlot: currentSlot,
      maxBlocks: batchSize,
    });

    console.log(`  Blocks: ${result.summary.blocks_scanned}`);
    console.log(`  Certificates: ${result.summary.total_certificates}`);
    console.log(`  Votes: ${result.summary.total_votes}`);
    console.log(`  Proposals: ${result.summary.total_proposals}`);

    // Process the batch...
    // await saveToDatabasee(result);

    // Move to next batch
    if (result.summary.blocks_scanned < batchSize) {
      console.log("\nReached chain tip!");
      break;
    }

    currentSlot = result.to_slot + 1;
    
    // Optional: delay to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

/**
 * Example 7: Error handling
 */
async function syncWithErrorHandling() {
  console.log("Example 7: Sync with error handling\n");
  
  try {
    const result = await syncGovernanceFromSlot({
      fromSlot: 171000000,
      maxBlocks: 50,
    });

    console.log("✅ Sync successful");
    return result;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("timeout") || error.name === "AbortError") {
        console.error("⏱️  Request timed out. Try smaller batch size.");
      } else if (error.message.includes("502") || error.message.includes("Upstream")) {
        console.error("🔌 Koios API error. Try again later.");
      } else {
        console.error("❌ Unknown error:", error.message);
      }
    }
    throw error;
  }
}

/**
 * Example 8: Use in Next.js component or server action
 */
export async function getServerSideGovernanceData(slot: number): Promise<GovernanceChanges> {
  // Can be called from getServerSideProps, API route, or server component
  return syncGovernanceFromSlot({
    fromSlot: slot,
    maxBlocks: 100,
  });
}

/**
 * Example 9: Custom processing pipeline
 */
async function customPipeline() {
  console.log("Example 9: Custom processing pipeline\n");
  
  const result = await syncGovernanceFromSlot({
    fromSlot: 171000000,
    maxBlocks: 50,
  });

  // Step 1: Extract unique DRep IDs from certificates
  const drepIds = new Set<string>();
  for (const cert of result.certificates) {
    if (cert.type.toLowerCase().includes('drep')) {
      const info = cert.info as any;
      if (info?.drep_id) {
        drepIds.add(info.drep_id);
      }
    }
  }
  console.log(`Found ${drepIds.size} unique DReps`);

  // Step 2: Extract unique pool IDs
  const poolIds = new Set<string>();
  for (const cert of result.certificates) {
    if (cert.type.toLowerCase().includes('pool')) {
      const info = cert.info as any;
      if (info?.pool_id) {
        poolIds.add(info.pool_id);
      }
    }
  }
  console.log(`Found ${poolIds.size} unique pools`);

  // Step 3: Extract governance action IDs from votes
  const govActionIds = new Set<string>();
  for (const vote of result.votes) {
    if (vote.gov_action_proposal_id) {
      govActionIds.add(vote.gov_action_proposal_id);
    }
  }
  console.log(`Found ${govActionIds.size} unique governance actions with votes`);

  return {
    drepIds: Array.from(drepIds),
    poolIds: Array.from(poolIds),
    govActionIds: Array.from(govActionIds),
  };
}

// Run examples if called directly
if (require.main === module) {
  (async () => {
    try {
      await simpleSync();
    } catch (error) {
      console.error("Error:", error);
      process.exit(1);
    }
  })();
}

