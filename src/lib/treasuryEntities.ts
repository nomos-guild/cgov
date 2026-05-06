/**
 * Curated entity mapping for Cardano Treasury Withdrawal proposals, indexed
 * by calendar year.
 *
 * Scope: Treasury Withdrawal governance actions inside a given year's epoch
 * window. Both resolved (Enacted/Ratified/Expired/Closed) and Active proposals
 * may be mapped — the chart and entity pages classify them by current
 * `status` at render time, so an Active mapping promotes itself to Approved
 * automatically once the action is enacted on chain.
 *
 * Date field used: `submissionEpoch` (buffered ±2 epochs around each year's
 * boundary). The backend does not currently expose an enactment/ratification
 * epoch in proposal detail (confirmed via raw response inspection on
 * 2026-04-24); only `submissionEpoch`, `expiryEpoch`, `status`, and
 * `votingStatus`.
 *
 * Each mapping was produced by reading the proposal's on-chain title,
 * description, and rationale (including the "Vendor Profile" section and
 * `references[]`). Evidence is recorded inline for auditability.
 */

export interface TreasuryEntity {
  entityId: string;
  label: string;
  /** Optional curated metadata. The entity profile page falls back to a
   *  label-only header when these are absent, so adding/removing them is
   *  always safe. */
  website?: string;
  description?: string;
  iconUrl?: string;
}

export interface TreasuryProposalMapping {
  entityId: string;
  /** What in the proposal metadata identified this entity. Keep for auditability. */
  evidence: string;
  /** True when the assignment is uncertain and a human should double-check. */
  needsReview?: boolean;
  reviewNote?: string;
}

export type TreasuryYear = 2025 | 2026;

export const SUPPORTED_YEARS: readonly TreasuryYear[] = [2025, 2026] as const;

/**
 * Shared entity registry across all years — same org appearing in multiple
 * years should keep the same entityId (e.g. "input-output" in both 2025 and
 * 2026). New entities introduced by later years are appended here.
 */
export const TREASURY_ENTITIES: Record<string, TreasuryEntity> = {
  intersect: { entityId: "intersect", label: "Intersect" },
  "input-output": { entityId: "input-output", label: "Input Output" },
  "cardano-foundation": {
    entityId: "cardano-foundation",
    label: "Cardano Foundation",
  },
  emurgo: { entityId: "emurgo", label: "EMURGO" },
  mlabs: { entityId: "mlabs", label: "MLabs" },
  txpipe: { entityId: "txpipe", label: "TxPipe" },
  "anastasia-labs": { entityId: "anastasia-labs", label: "Anastasia Labs" },
  vacuumlabs: { entityId: "vacuumlabs", label: "Vacuumlabs" },
  tweag: { entityId: "tweag", label: "Tweag" },
  "harmonic-labs": { entityId: "harmonic-labs", label: "Harmonic Labs" },
  "snek-foundation": { entityId: "snek-foundation", label: "Snek Foundation" },
  pragma: { entityId: "pragma", label: "PRAGMA (Amaru)" },
  eryx: { entityId: "eryx", label: "Eryx Coop" },
  socious: { entityId: "socious", label: "Socious" },
  maestro: { entityId: "maestro", label: "Maestro" },
  flowdesk: { entityId: "flowdesk", label: "Flowdesk" },
  nftcdn: { entityId: "nftcdn", label: "NFTCDN" },
  eternl: { entityId: "eternl", label: "Eternl" },
  adastat: { entityId: "adastat", label: "AdaStat" },
  cexplorer: { entityId: "cexplorer", label: "Cexplorer" },
  bloxbean: { entityId: "bloxbean", label: "BloxBean" },
  scalus: { entityId: "scalus", label: "Scalus" },
  opshin: { entityId: "opshin", label: "OpShin" },
  pycardano: { entityId: "pycardano", label: "PyCardano" },
  zkfold: { entityId: "zkfold", label: "zkFold" },
  anzens: { entityId: "anzens", label: "Anzens / USDA" },
  supplyoneers: { entityId: "supplyoneers", label: "Supplyoneers FZ-LLC" },
  haus: { entityId: "haus", label: "Haus" },
  "cardano-builder-dao": {
    entityId: "cardano-builder-dao",
    label: "Cardano Builder DAO (Clarity)",
  },
  "draper-dragon": { entityId: "draper-dragon", label: "Draper Dragon (Orion Fund)" },
  "blink-labs": { entityId: "blink-labs", label: "Blink Labs" },
  "defi-liquidity-committee": {
    entityId: "defi-liquidity-committee",
    label: "Stablecoin DeFi Liquidity Interim Committee",
  },
  unknown: { entityId: "unknown", label: "Unclassified" },
};

/**
 * proposalId → entity + evidence, indexed by year. proposalId format matches
 * GovernanceAction.proposalId (bech32 `gov_action1…`).
 */
export const PROPOSAL_ENTITY_MAP: Record<
  TreasuryYear,
  Record<string, TreasuryProposalMapping>
> = {
  2025: {
  // ₳70M Cardano Critical Integrations Budget — submitted by Intersect as
  // Administrator with Cardano Foundation, IOG, EMURGO, Midnight Foundation
  // as co-proposers. Steering Committee draws from all five orgs.
  "gov_action1lqun78lcznfa2gek49m3ydslakfnm8heargfp8sax9fk54yl6ghsqp042zv": {
    entityId: "intersect",
    evidence:
      "Description: 'driven through close collaboration between Input | Output Global, the Cardano Foundation, and EMURGO, together with Midnight Foundation and Intersect'. Rationale: 'This treasury withdrawal is submitted by Intersect in its role as the Administrator'. Human review: steering committee rolled up under Intersect.",
  },

  // Snek Foundation — ₳5M loan proposal (Enacted).
  "gov_action1q0m8z7glm9cprucwf44hdjdfra8khnakpm3hu5ueh929hvljw4aqqzuxfxz": {
    entityId: "snek-foundation",
    evidence:
      "Description: 'strategic initiative led by the Snek Foundation'. References include snek.com and Snek Foundation CEO LinkedIn.",
  },

  // GovTool 12mo maintenance — IntersectMBO's governance tooling.
  "gov_action16tdkp3fs0j6303e4utgp8rftdug0ckezr4sslgv8wxdaeq40ngpsq5sr06h": {
    entityId: "intersect",
    evidence:
      "Title: 'GovTool 12 months active maintenance'. References point to github.com/IntersectMBO/govtool* repositories and gov.tools (run by Intersect).",
  },

  // Snek Foundation — Expired ₳5M listing proposal (early version).
  "gov_action1fl6r784t2ffw7q96du2znhprw90r3xvrfugvqelgqewgxex42kdqq9tgrd5": {
    entityId: "snek-foundation",
    evidence:
      "Rationale + description: 'strategic proposal by the Snek Foundation to list SNEK'. References: snek.com.",
  },

  // Snek Foundation — Expired ₳5M listing proposal (companion).
  "gov_action1r44w54hx553mz0sr4cc07f8tlxzj2sa57l2pt3l9pa2ldw42fc7sq5q3rtn": {
    entityId: "snek-foundation",
    evidence:
      "Title: 'Withdraw ₳5M for Cardano's Global Listing Expansion - Powered by Snek'. Description: 'strategic proposal by the Snek Foundation'.",
  },

  // MLabs Cardano.nix.
  "gov_action18nefry4qacd80xzs2srjahxm2e4vz3c8wvrr03rrtk8mdqfuknysq66459t": {
    entityId: "mlabs",
    evidence:
      "Vendor Profile: 'MLabs LTD is the primary developer and maintainer of Cardano.nix'. References: github.com/mlabs-haskell/cardano.nix.",
  },

  // Blockfrost Platform — Blockfrost was acquired by Input Output, so the
  // vendor rolls up to IO for entity attribution.
  "gov_action13tfag48nf94rtjcdq7c06vhkslmxxw9h6c88sl7q5g5nnewcsvlqyxzxz7k": {
    entityId: "input-output",
    evidence:
      "Title/description name Blockfrost Platform. References: blockfrost.io, github.com/blockfrost/blockfrost-platform, Icebreakers Grafana dashboard. Human review: Blockfrost is now an Input Output subsidiary; attribution rolled up to IO.",
  },

  // IO Catalyst 2025.
  "gov_action13tfag48nf94rtjcdq7c06vhkslmxxw9h6c88sl7q5g5nnewcsvlpwywvhcq": {
    entityId: "input-output",
    evidence:
      "Title: 'Catalyst 2025 Proposal by Input Output'. Reference: 'Input Output Catalyst Innovation 2025 Budget Proposal'.",
  },

  // MLabs Grumpelstiltskin (elliptic curves research).
  "gov_action13tfag48nf94rtjcdq7c06vhkslmxxw9h6c88sl7q5g5nnewcsvlzgf074ea": {
    entityId: "mlabs",
    evidence:
      "Title: 'MLabs Research towards Tooling for Elliptical Curves'. References: mlabs-haskell/grumplestiltskin.",
  },

  // PyCardano — Jerry / Python-Cardano project team.
  "gov_action13tfag48nf94rtjcdq7c06vhkslmxxw9h6c88sl7q5g5nnewcsvlzyc3clg6": {
    entityId: "pycardano",
    evidence:
      "Vendor Profile: 'Jerry, the creator of PyCardano, will lead this project'. References: github.com/Python-Cardano/pycardano. Administered by Intersect but owner is the PyCardano maintainer team.",
  },

  // OpShin — Niels + contributors.
  "gov_action13tfag48nf94rtjcdq7c06vhkslmxxw9h6c88sl7q5g5nnewcsvlzzy7m65d": {
    entityId: "opshin",
    evidence:
      "Vendor Profile: 'The main proposer, Niels…' maintains OpShin. References: opshin.dev, github.com/OpShin/opshin.",
  },

  // IOR Cardano Vision Work Program 2025.
  "gov_action13tfag48nf94rtjcdq7c06vhkslmxxw9h6c88sl7q5g5nnewcsvlzqhm6e8q": {
    entityId: "input-output",
    evidence:
      "Title: 'Input Output Research (IOR): Cardano Vision - Work Program 2025'. Rationale identifies IOR as the vendor.",
  },

  // Stablecoin / USDA / Anzens / Encryptus — USDA stablecoin expansion.
  "gov_action13tfag48nf94rtjcdq7c06vhkslmxxw9h6c88sl7q5g5nnewcsvlp730y0dn": {
    entityId: "anzens",
    evidence:
      "Rationale names Anzens (USDA issuer) as the primary vendor driving USDA wallet/exchange/NEO-bank distribution, with Encryptus subcontracted for on/off-ramps. Human review: kept as Anzens.",
  },

  // Cardano Summit 2025.
  "gov_action13tfag48nf94rtjcdq7c06vhkslmxxw9h6c88sl7q5g5nnewcsvlpsn5rx0e": {
    entityId: "cardano-foundation",
    evidence:
      "Description: 'spearheaded by the Cardano Foundation and fortified by regional ecosystem partners (EMURGO, Rare Evo, Wada, Catalyst Africa Tour)'. Cardano Foundation is the lead organiser. Human review: kept as Cardano Foundation.",
  },

  // Intersect MBO — org budget.
  "gov_action13tfag48nf94rtjcdq7c06vhkslmxxw9h6c88sl7q5g5nnewcsvlp2tyw3h6": {
    entityId: "intersect",
    evidence:
      "Title: 'MBO for the Cardano ecosystem: Intersect'. Rationale: 'enables Intersect to continue providing essential infrastructure, coordination, and governance support'.",
  },

  // AdaStat.net.
  "gov_action13tfag48nf94rtjcdq7c06vhkslmxxw9h6c88sl7q5g5nnewcsvlpgcp0jyh": {
    entityId: "adastat",
    evidence:
      "Title: 'AdaStat.net Cardano blockchain explorer'. Vendor Profile: 'AdaStat.net has been actively developed and maintained since Shelley Incentivized Testnet in 2019'.",
  },

  // Scalus — Oleksandr Nemish / Scalus project.
  "gov_action13tfag48nf94rtjcdq7c06vhkslmxxw9h6c88sl7q5g5nnewcsvlpz4s2af8": {
    entityId: "scalus",
    evidence:
      "Title: 'Scalus - DApps Development Platform'. References: scalus.org. Vendor is the Scalus project led by Oleksandr Nemish.",
  },

  // Eternl Maintenance.
  "gov_action13tfag48nf94rtjcdq7c06vhkslmxxw9h6c88sl7q5g5nnewcsvlpqx4t762": {
    entityId: "eternl",
    evidence:
      "Title: 'Eternl Maintenance'. Description: 'Eternl has been a reliable and community-driven Cardano wallet since its launch in 2021'.",
  },

  // ZK Bridge — Eryx Coop.
  "gov_action13tfag48nf94rtjcdq7c06vhkslmxxw9h6c88sl7q5g5nnewcsvlq77jt4x4": {
    entityId: "eryx",
    evidence:
      "Vendor Profile: 'Eryx is a worker-owned labor cooperative'. References: Eryx Coop GitHub repositories.",
  },

  // Tweag core budget bundle.
  "gov_action13tfag48nf94rtjcdq7c06vhkslmxxw9h6c88sl7q5g5nnewcsvlqudh2k4c": {
    entityId: "tweag",
    evidence:
      "Title: 'TWEAG's Proposals for multiple core budget projects'. Vendor Profile: 'Tweag by Modus Create'.",
  },

  // MLabs Plutarch.
  "gov_action13tfag48nf94rtjcdq7c06vhkslmxxw9h6c88sl7q5g5nnewcsvlq63cfnf0": {
    entityId: "mlabs",
    evidence:
      "Title: 'MLabs Core Tool Maintenance & Enhancement: Plutarch'. Vendor Profile names MLabs LTD.",
  },

  // Gerolamo — Harmonic Labs.
  "gov_action13tfag48nf94rtjcdq7c06vhkslmxxw9h6c88sl7q5g5nnewcsvlqczags6z": {
    entityId: "harmonic-labs",
    evidence:
      "Vendor Profile: 'https://github.com/HarmonicLabs'. References: Harmonic Labs Gerolamo GitHub Repository.",
  },

  // OSC Budget Proposal — Intersect Open Source Committee / OSO.
  "gov_action13tfag48nf94rtjcdq7c06vhkslmxxw9h6c88sl7q5g5nnewcsvlqkqx0ecg": {
    entityId: "intersect",
    evidence:
      "Vendor Profile: 'Intersect is a non-profit member-based organization'. Description names 'Open Source Committee in conjunction with the Open Source Office (OSO)' — both Intersect bodies.",
  },

  // Maestro — Web3 developer stack for BTC smart contract layer.
  "gov_action13tfag48nf94rtjcdq7c06vhkslmxxw9h6c88sl7q5g5nnewcsvlq5nrw6t9": {
    entityId: "maestro",
    evidence:
      "Description: 'Maestro proposes a comprehensive infrastructure solution'. References: gomaestro.org.",
  },

  // Ledger App Rewrite — Vacuumlabs.
  "gov_action13tfag48nf94rtjcdq7c06vhkslmxxw9h6c88sl7q5g5nnewcsvlqj0vdlhj": {
    entityId: "vacuumlabs",
    evidence:
      "Vendor Profile: 'Vacuumlabs is a technology company founded in 2013… co-developing the AdaLite and Yoroi wallets, and contributing to Ledger and Trezor hardware wallet support for Cardano'.",
  },

  // Dolos — TxPipe.
  "gov_action13tfag48nf94rtjcdq7c06vhkslmxxw9h6c88sl7q5g5nnewcsvlqsufvuyl": {
    entityId: "txpipe",
    evidence:
      "Description: 'Dolos [https://dolos.txpipe.io/]'. Vendor Profile: 'TxPipe is an active member of the Cardano ecosystem'.",
  },

  // zkFold ZK Rollup.
  "gov_action13tfag48nf94rtjcdq7c06vhkslmxxw9h6c88sl7q5g5nnewcsvlqwtnrdnx": {
    entityId: "zkfold",
    evidence:
      "Title/Rationale: zkFold will develop and implement ZK rollups on Cardano. Project name is the entity.",
  },

  // Lucid Evolution — Anastasia Labs.
  "gov_action13tfag48nf94rtjcdq7c06vhkslmxxw9h6c88sl7q5g5nnewcsvlqvckzwqt": {
    entityId: "anastasia-labs",
    evidence:
      "Description: 'As the official maintainer of Lucid, Anastasia Labs…'. References: anastasia-labs.github.io/lucid-evolution.",
  },

  // UTxO RPC — TxPipe.
  "gov_action13tfag48nf94rtjcdq7c06vhkslmxxw9h6c88sl7q5g5nnewcsvlq2yeptuu": {
    entityId: "txpipe",
    evidence:
      "Vendor Profile: 'TxPipe is an active member of the Cardano ecosystem'. References: github.com/utxorpc (TxPipe-owned).",
  },

  // Pallas — TxPipe.
  "gov_action13tfag48nf94rtjcdq7c06vhkslmxxw9h6c88sl7q5g5nnewcsvlqghuqg03": {
    entityId: "txpipe",
    evidence:
      "Title/References: TxPipe Pallas GitHub Repository (github.com/txpipe/pallas).",
  },

  // Cardano Product Committee 2030 Vision — Intersect Product Committee.
  "gov_action13tfag48nf94rtjcdq7c06vhkslmxxw9h6c88sl7q5g5nnewcsvlzxt5eumh": {
    entityId: "intersect",
    evidence:
      "Vendor Profile: 'The Cardano Product Committee of Intersect…'. Rationale explicitly identifies this as an Intersect committee initiative.",
  },

  // Ecosystem Pavilions at Exhibitions — Supplyoneers FZ-LLC.
  "gov_action13tfag48nf94rtjcdq7c06vhkslmxxw9h6c88sl7q5g5nnewcsvlp679xfzf": {
    entityId: "supplyoneers",
    evidence:
      "Vendor Profile: 'Supplyoneers FZ-LLC's proposer has 15 years experience…'. References: discovercardano.com/marketing-budget-proposal.",
  },

  // Exchange Listing + MMAAS — Flowdesk.
  "gov_action13tfag48nf94rtjcdq7c06vhkslmxxw9h6c88sl7q5g5nnewcsvlpcdq823y": {
    entityId: "flowdesk",
    evidence:
      "Rationale: 'Flowdesk acts as a reference party that helps with engineering liquidity provision and listing of CNTs'. Flowdesk is the service provider (MMAAS + listing facilitation); funds flow through Intersect to exchanges and projects, but the vendor contract is with Flowdesk.",
  },

  // Cardano Builder DAO — operated by Clarity (Liqwid-Labs/Agora contracts).
  "gov_action13tfag48nf94rtjcdq7c06vhkslmxxw9h6c88sl7q5g5nnewcsvlp5u7pqqr": {
    entityId: "cardano-builder-dao",
    evidence:
      "Vendor Profile: 'Our team is responsible for building and maintaining Clarity, a governance platform…' + 'DAO Smart Contracts Github Repository: github.com/Liqwid-Labs/agora'. Entity is the CB DAO run by the Clarity team.",
  },

  // Unified Global Events Marketing — Cardano Foundation + EMURGO + Rare Network.
  "gov_action13tfag48nf94rtjcdq7c06vhkslmxxw9h6c88sl7q5g5nnewcsvlpjq3z9u5": {
    entityId: "cardano-foundation",
    evidence:
      "Vendor Profile lists Cardano Foundation, EMURGO, and Rare Network as co-delivering entities. Cardano Foundation is listed first and is the central brand steward named throughout. Human review: kept as Cardano Foundation.",
  },

  // Haus — tokenized real estate RWA.
  "gov_action13tfag48nf94rtjcdq7c06vhkslmxxw9h6c88sl7q5g5nnewcsvlpuz29v77": {
    entityId: "haus",
    evidence:
      "Rationale: 'Haus will move its existing liquidity protocol onto Cardano's mainnet' + 'Haus is led by a seasoned team'. References: haus.com, hauscoin.com.",
  },

  // Complement Catalyst QF — Socious.
  "gov_action13tfag48nf94rtjcdq7c06vhkslmxxw9h6c88sl7q5g5nnewcsvlpk0mqrnw": {
    entityId: "socious",
    evidence:
      "Vendor Profile: 'Socious is a fast-growing impact startup'. References: socious.org, socious.gitbook.io/fund.",
  },

  // Beyond MVG — IO Voltaire team.
  "gov_action13tfag48nf94rtjcdq7c06vhkslmxxw9h6c88sl7q5g5nnewcsvlpvhtd5td": {
    entityId: "input-output",
    evidence:
      "Vendor Profile: 'Input Output's Voltaire team will provide core leadership' — the Voltaire team is part of IO (Input Output Global). Human review: kept as Input Output.",
  },

  // NFTCDN — free native asset CDN.
  "gov_action13tfag48nf94rtjcdq7c06vhkslmxxw9h6c88sl7q5g5nnewcsvlpx66gmxa": {
    entityId: "nftcdn",
    evidence:
      "Title: 'A free Native Asset CDN for Cardano Developers'. Vendor Profile: 'About NFTCDN… Established in 2022'. References: nftcdn.io.",
  },

  // Hardware Wallets Maintenance — Vacuumlabs.
  "gov_action13tfag48nf94rtjcdq7c06vhkslmxxw9h6c88sl7q5g5nnewcsvlqx488pdm": {
    entityId: "vacuumlabs",
    evidence:
      "Vendor Profile: 'Vacuumlabs has been developing the Cardano HW wallets integrations (Ledger and Trezor) since 2018'. References: multiple github.com/vacuumlabs/* repositories.",
  },

  // 2025 Input Output Engineering Core Development.
  "gov_action13tfag48nf94rtjcdq7c06vhkslmxxw9h6c88sl7q5g5nnewcsvlqz6d98zp": {
    entityId: "input-output",
    evidence:
      "Title: '2025 Input Output Engineering Core Development Proposal'. Rationale names IOE and Input Output as the vendor.",
  },

  // Midgard — Anastasia Labs.
  "gov_action13tfag48nf94rtjcdq7c06vhkslmxxw9h6c88sl7q5g5nnewcsvlqqfgyy3v": {
    entityId: "anastasia-labs",
    evidence:
      "Vendor Profile begins 'Ana…' (Anastasia Labs) and rationale presents Midgard as an Anastasia Labs project.",
  },

  // Cexplorer.io.
  "gov_action13tfag48nf94rtjcdq7c06vhkslmxxw9h6c88sl7q5g5nnewcsvlpyflfc4s": {
    entityId: "cexplorer",
    evidence:
      "Title: 'Cexplorer.io -- Developer-Focused Blockchain Explorer for Cardano'. Vendor Profile: 'Cexplorer.io (formerly Adapools) has been live since 2020'.",
  },

  // BloxBean Java Tools.
  "gov_action193leqzml768nz7nmpepzx822a5mzyanqhtewaxjtul5gp6uhwvfsqgl2qg0": {
    entityId: "bloxbean",
    evidence:
      "Title: 'BloxBean Java Tools Maintenance and Enhancement'. References: github.com/bloxbean.",
  },

  // Amaru Treasury Withdrawal 2025 — PRAGMA.
  "gov_action1vrkk4dpuss8l3z9g4uc2rmf8ks0f7j534zvz9v4k85dlc54wa3zsqq68rx0": {
    entityId: "pragma",
    evidence:
      "Rationale: 'Amaru maintainer committee ensures direct administration of its budget… follow PRAGMA's Maintainer Committee Framework'. References: github.com/pragma-org/amaru, github.com/pragma-org/amaru-treasury.",
  },
  },

  2026: {
    // Orion Fund — Draper Dragon venture fund, Tranche One ₳50M (Enacted).
    "gov_action13qr78nhrhetywapvx2wpm63y9uxpc2dc45zsu9gkncasxqhuhltqqqfu32x": {
      entityId: "draper-dragon",
      evidence:
        "Title: 'Cardano x Draper Dragon: Orion Fund'. Description: 'The Draper Dragon Orion Fund, L.P. (\"Orion Fund\"), managed by Draper Dragon Orion GP, LLC (\"General Partner\" or \"GP\")'. References: forum.cardano.org Draper Dragon strategic partnership thread. Vendor is Draper Dragon via the Orion GP/LP structure.",
    },

    // Dingo — Blink Labs Go Cardano node, 6.9M ADA (Ratified).
    "gov_action17dfgtkeufcy945e3ssanqpmn09ft3gezhvepvvg7msmlmaz260dqqjtsmpe": {
      entityId: "blink-labs",
      evidence:
        "Title: 'Dingo: a Production-Grade Block Producer in Go by Blink Labs'. Description: 'Blink Labs is requesting 6,900,000 ADA… to fund twelve months of full-time engineering on Dingo, our Go Cardano node'. References: github.com/blinklabs-io/{treasury-proposal,dingo,gouroboros,plutigo,ouroboros-mock}.",
    },

    // Cardano DeFi Liquidity Budget — Withdrawal 1, 800k ADA (Ratified). Funds
    // held by Amaru 5-of-9 multisig operated by the 9-person Stablecoin DeFi
    // Liquidity Interim Committee (Linda Roland, Darren Camas, Nick Schaub,
    // Giorgio Zinetti, Massimo Morini, Darlington Wleh, Murasaki, Raphael
    // Christian-Roy, Ryan Davis). Sundae Labs / UTxO Company / Sidan Labs /
    // Invariant0 LLC are subcontracted service providers.
    "gov_action1uhzd06a26qavzflvrx3gvcz6rzxkl6su2ns8t3seef5e8dl6nlgsqcgtufg": {
      entityId: "defi-liquidity-committee",
      evidence:
        "Rationale: 'the prospective recipient of this withdrawal is the Stablecoin DeFi Liquidity Interim Committee, acting through an Amaru multisig contract requiring 5-of-9 signatures'. References point to github.com/theeldermillenial/2025-liquidity-budget (committee's repo). Human review: bucketed under the DeFi Liquidity Committee rather than any single subcontractor.",
    },

    // Amaru Treasury Withdrawal 2026 — second PRAGMA/Amaru withdrawal (Enacted).
    "gov_action19uhuy5uame2s60yrh6n8cyds8ps5q7tkh05dqlzmpcfy429p9w4qq5ll3g0": {
      entityId: "pragma",
      evidence:
        "Title: 'Amaru Treasury Withdrawal 2026'. Rationale: 'Amaru is a multi-entity effort that currently sits under PRAGMA… The Amaru maintainer committee will ensure direct budget administration'. References: github.com/pragma-org/amaru, github.com/pragma-org/amaru-treasury, PRAGMA Maintainer Committee Framework. Same entity as 2025 Amaru withdrawal.",
    },

    // Cardano DeFi Liquidity Budget — Withdrawal 1, 500k ADA (Expired). Earlier
    // version of the proposal that was later resubmitted at 800k ADA and
    // Ratified. Same Interim Committee + Amaru multisig structure.
    "gov_action1fvgw27fjpr9c7g582mszzyez0jgkqgjgatzdnyngrg8wwc9kcn3qqxtz8r7": {
      entityId: "defi-liquidity-committee",
      evidence:
        "Description: '500,000 ADA from the Cardano Treasury to establish the legal framework and smart contract infrastructure… All funds will be initially received by an Amaru contract administered by the 9-person Interim Committee with a 5-of-9 multisignature requirement'. References: same github.com/theeldermillenial/2025-liquidity-budget repo as the Ratified withdrawal.",
    },

    // Cardano Foundation 2026 — user-curated. Title was not auto-matched by
    // the heuristic (no "cardano foundation" substring in the proposal title).
    // app.cgov.io/governance/bd91fa7ea9b4e09f76cbde3abb0b564ffc60b27e18af464ccec9bef9c718d087:0
    "gov_action1hkgl5l4fknsf7aktmcatkz6kfl7xpvn7rzh5vnxwexl0n3cc6zrsqt5459v": {
      entityId: "cardano-foundation",
      evidence:
        "Curated by maintainer as a Cardano Foundation proposal — title did not include a CF-distinctive keyword so the heuristic missed it.",
    },

    // IO — Blockfrost-led proposals. Blockfrost has been an Input Output
    // subsidiary since the acquisition, so attribution rolls up to IO. The
    // "blockfrost" keyword in ENTITY_KEYWORDS would also catch these by
    // title; the explicit mapping is kept as a belt-and-suspenders so the
    // attribution survives any future title rename.
    "gov_action1w0shrfxqwv95kk0v4cn34wylz25a2cmqkq5jpc0e2yrahhqava3qsuae57l": {
      entityId: "input-output",
      evidence: "Blockfrost-led proposal — Blockfrost is an IO subsidiary post-acquisition. Curated by maintainer.",
    },
    "gov_action1w0shrfxqwv95kk0v4cn34wylz25a2cmqkq5jpc0e2yrahhqava3qwt8k9fx": {
      entityId: "input-output",
      evidence: "Blockfrost-led proposal — Blockfrost is an IO subsidiary post-acquisition. Curated by maintainer.",
    },

    // Revised Cardano Summit 2026 Singapore — Cardano Foundation. Original
    // combined "Cardano Summit 2026 and TOKEN2049 Singapore" proposal was
    // split after community pushback; the Summit half stayed with CF, the
    // TOKEN2049 sponsorship halves moved to EMURGO (mapped below).
    "gov_action10dp9wzmgt2nqshyrghufff4sfhcxedhmzluly5k0azguatnsthwqqs84cjf": {
      entityId: "cardano-foundation",
      evidence:
        "Description: 'Following extensive discussions with the community the Foundation has revised the proposal'. Decoupled from EMURGO's TOKEN2049 sponsorship. Successor to the combined Cardano Summit 2026 + TOKEN2049 proposal.",
    },

    // EMURGO TOKEN2049 Singapore 2026 — Baseline 'Platinum' Sponsorship.
    "gov_action18u8lpkzge2csxe3plynn9lh4agwtv3nrqkyfwalwj4ykjv7l68jqqzmul9z": {
      entityId: "emurgo",
      evidence:
        "Description: 'reflects EMURGO's direct response to community feedback… EMURGO, headquartered in Singapore and holding a multi-year partnership with TOKEN2049 spanning 2022 through 2025, is very well-positioned to execute this sponsorship'.",
    },

    // EMURGO TOKEN2049 Singapore 2026 — Top-Up 'Title' Sponsorship Upgrade.
    // Voted in conjunction with the Baseline 'Platinum' proposal above.
    "gov_action1kj6ghzuz9wcq88f3y72cyyeekdcemlq0dqk4zpjd4eck5assuypqq0pckkw": {
      entityId: "emurgo",
      evidence:
        "Description: 'EMURGO commits to returning 100% of the funds to the Cardano Treasury within 30 days of enactment'. Modular top-up paired with EMURGO's Baseline 'Platinum' Sponsorship proposal.",
    },

    // Harmonic Labs (HLabs) — curated by maintainer. Title did not include a
    // Harmonic-Labs-distinctive keyword (e.g. "harmonic labs", "hlabs",
    // "gerolamo"), so the heuristic missed it and the proposal landed in the
    // "unknown" bucket on the radial chart.
    "gov_action1guz68e8zkwphcdc8wnp40cclkv92qgnel7xnffmsmp2ljp09qtwqq596k4c": {
      entityId: "harmonic-labs",
      evidence: "Curated by maintainer as a Harmonic Labs (HLabs) proposal — title did not include an HLabs-distinctive keyword so the heuristic missed it.",
    },
    "gov_action1ggr2uz7prwn5l84cdn2krwngfez0p7wluy4u3u3ez9pz5ls2whesqnsjly8": {
      entityId: "harmonic-labs",
      evidence: "Curated by maintainer as a Harmonic Labs (HLabs) proposal — title did not include an HLabs-distinctive keyword so the heuristic missed it.",
    },
  },
};

/**
 * Convenience helper: look up the entity registry entry for a proposal.
 */
export function getTreasuryEntity(entityId: string): TreasuryEntity {
  return (
    TREASURY_ENTITIES[entityId] ?? { entityId, label: entityId }
  );
}

export const UNCLASSIFIED_ENTITY_ID = "unknown";

/**
 * Walk PROPOSAL_ENTITY_MAP across all years and return the set of entityIds
 * that have at least one mapped proposal. The "unknown" bucket is excluded —
 * it is a catch-all for un-curated proposals and not a real entity.
 *
 * Used by `getStaticPaths` for the entity profile route so new mappings
 * automatically generate a profile page on the next ISR rebuild.
 */
export function getFundedEntityIds(): string[] {
  const ids = new Set<string>();
  for (const year of SUPPORTED_YEARS) {
    for (const m of Object.values(PROPOSAL_ENTITY_MAP[year])) {
      if (m.entityId !== UNCLASSIFIED_ENTITY_ID) ids.add(m.entityId);
    }
  }
  return [...ids];
}

/**
 * Return every (proposalId, year) pair currently mapped to `entityId`.
 * Order is not guaranteed — callers should sort/group as needed.
 */
export function getEntityProposalIds(
  entityId: string
): Array<{ proposalId: string; year: TreasuryYear }> {
  const result: Array<{ proposalId: string; year: TreasuryYear }> = [];
  for (const year of SUPPORTED_YEARS) {
    for (const [proposalId, m] of Object.entries(PROPOSAL_ENTITY_MAP[year])) {
      if (m.entityId === entityId) result.push({ proposalId, year });
    }
  }
  return result;
}

// ── Submission epoch → year ─────────────────────────────────────────────
// Cardano Shelley era started at epoch 208 on 2020-07-29 21:44:51 UTC with
// 5-day epochs. Lets us bucket a submissionEpoch into a calendar year without
// the backend exposing per-epoch start times.
const SHELLEY_EPOCH = 208;
const SHELLEY_EPOCH_START_MS = Date.UTC(2020, 6, 29, 21, 44, 51);
const EPOCH_LENGTH_MS = 5 * 24 * 60 * 60 * 1000;

export function epochToYear(epoch: number | null | undefined): TreasuryYear | null {
  if (epoch == null || !Number.isFinite(epoch) || epoch < SHELLEY_EPOCH) return null;
  const ms = SHELLEY_EPOCH_START_MS + (epoch - SHELLEY_EPOCH) * EPOCH_LENGTH_MS;
  const year = new Date(ms).getUTCFullYear();
  return (SUPPORTED_YEARS as readonly number[]).includes(year)
    ? (year as TreasuryYear)
    : null;
}

// ── Title-based heuristic ───────────────────────────────────────────────
/**
 * Distinctive title keywords used as a fallback when a proposalId isn't in
 * PROPOSAL_ENTITY_MAP — primarily for Active proposals before someone curates
 * them with evidence. Keywords must be specific (multi-word phrases or unique
 * brand names); failures fall through to "unknown", same as before.
 *
 * Curated map entries always take precedence in `resolveProposalEntity`.
 */
const ENTITY_KEYWORDS: Record<string, readonly string[]> = {
  intersect: ["intersect"],
  "input-output": [
    "io",
    "input output",
    "input-output",
    "input | output",
    "iohk",
    "iog",
    "ior",
    "ioe",
    "input output global",
    "input output research",
    "input output engineering",
    // Blockfrost has been an IO subsidiary since the acquisition — any
    // Blockfrost-led proposal rolls up to IO for entity attribution.
    "blockfrost",
  ],
  "cardano-foundation": ["cardano foundation"],
  emurgo: ["emurgo"],
  mlabs: ["mlabs"],
  txpipe: ["txpipe"],
  "anastasia-labs": ["anastasia labs"],
  vacuumlabs: ["vacuumlabs", "vacuum labs"],
  tweag: ["tweag"],
  "harmonic-labs": ["harmonic labs", "hlabs", "gerolamo"],
  "snek-foundation": ["snek foundation"],
  pragma: ["pragma", "amaru treasury"],
  eryx: ["eryx"],
  socious: ["socious"],
  maestro: ["maestro"],
  flowdesk: ["flowdesk"],
  nftcdn: ["nftcdn"],
  eternl: ["eternl"],
  adastat: ["adastat"],
  cexplorer: ["cexplorer"],
  bloxbean: ["bloxbean"],
  scalus: ["scalus"],
  opshin: ["opshin"],
  pycardano: ["pycardano"],
  zkfold: ["zkfold"],
  anzens: ["anzens"],
  supplyoneers: ["supplyoneers"],
  "cardano-builder-dao": ["cardano builder dao"],
  "draper-dragon": ["draper dragon", "orion fund"],
  "blink-labs": ["blink labs"],
  "defi-liquidity-committee": ["defi liquidity", "stablecoin defi liquidity"],
  // "haus" omitted — too short and generic, prone to false positives.
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function inferEntityIdFromTitle(title: string | null | undefined): string {
  if (!title) return UNCLASSIFIED_ENTITY_ID;
  const lower = title.toLowerCase();
  for (const [entityId, keywords] of Object.entries(ENTITY_KEYWORDS)) {
    for (const k of keywords) {
      // Word-boundary match so short tokens like "iog" don't match inside
      // unrelated words. Multi-word phrases still match across spaces.
      const re = new RegExp(`\\b${escapeRegex(k)}\\b`);
      if (re.test(lower)) return entityId;
    }
  }
  return UNCLASSIFIED_ENTITY_ID;
}

export interface ResolvedProposalEntity {
  entityId: string;
  year: TreasuryYear | null;
  source: "curated" | "heuristic" | "fallback";
}

/**
 * Resolve a Treasury Withdrawal action to its entity. Curated PROPOSAL_ENTITY_MAP
 * wins; if the proposalId isn't in the map, fall back to title keyword heuristic;
 * otherwise return the "unknown" bucket. Returns null for non-Treasury-Withdrawal
 * actions so callers can pass any GovernanceAction.
 */
export function resolveProposalEntity(action: {
  proposalId?: string;
  title?: string;
  submissionEpoch?: number;
  type?: string;
}): ResolvedProposalEntity | null {
  if (action.type !== "Treasury Withdrawals") return null;
  const year = epochToYear(action.submissionEpoch);

  if (action.proposalId) {
    for (const y of SUPPORTED_YEARS) {
      const m = PROPOSAL_ENTITY_MAP[y][action.proposalId];
      if (m) return { entityId: m.entityId, year, source: "curated" };
    }
  }
  const inferred = inferEntityIdFromTitle(action.title);
  if (inferred !== UNCLASSIFIED_ENTITY_ID) {
    return { entityId: inferred, year, source: "heuristic" };
  }
  return { entityId: UNCLASSIFIED_ENTITY_ID, year, source: "fallback" };
}
