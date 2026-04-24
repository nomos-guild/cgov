/**
 * Curated entity mapping for Cardano Treasury Withdrawal proposals, indexed
 * by calendar year.
 *
 * Scope: Treasury Withdrawal governance actions inside a given year's epoch
 * window with status Enacted, Ratified, Expired, or Closed. Active proposals
 * are excluded.
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
