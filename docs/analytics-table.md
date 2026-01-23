Collecting relevant data/info to display at cgov gov dashboard to provide onchain gov analytics.
Can draw a lot from https://gov-health.intersectmbo.org/

# KPI Catalogue by Category

---

## 5.1 Category 1 – Ada Holder Participation
| KPI | Context | Pimary | API endpoint | Logic |
| - | - | - | - | - | 
| | | | | |
|5.1a Voting Turnout (% ada)| How much of the network's stake is actively participating in the governance process? | Legitimacy / Security| GET /drep_epoch_summary?_epoch_no=<E> and GET /pool_voting_power_history?_epoch_no=<E> |Measure total vote power vs total casted votes across all submitted onchain proposals  |
|5.1b Active Stake Address Participation |How many unique stake addresses are delegated, mitigating whale-bias? |Participation | GET /drep_list and GET /drep_delegators?_drep_id=<drepId> (collect stake_address)|Measure total staked Ada across all delegations to active DReps vs % of delegations to DReps with more than ~5M Ada |
|5.1c Delegation Rate (% ada)| What % of ada in circulation has been delegated to DReps?|Participation | GET /drep_epoch_summary?_epoch_no=<E> (delegated) and GET /totals?_epoch_no=<E> (circulation) |Measure total amounted of minted Ada delegated across all DReps |
|5.1d Delegation Distribution by Wallet Size |Is governance dominated by whales or is it inclusive of smaller holders? |Distribution of Power | GET /drep_list and GET /drep_delegators?_drep_id=<drepId> (uses delegator amount) |same as 5.1b |
|5.1e New Wallet Delegation Rate |Are we successfully onboarding new participants? |Growth | GET /drep_list and GET /drep_delegators?_drep_id=<drepId> (use epoch_no to infer first delegation) | Measure amount of new wallets vs % of new wallets delegation to DReps|
|5.1f Inactive Delegated Ada |Is delegated stake "dead" (stuck with inactive or retired DReps)? |Efficiency | GET /drep_list and POST /drep_info (identify inactive/expired/registered state and sum delegated amount) |Measure amount of total delegated Ada vs Ada delegated to retired DReps |

Considered Chart Choice:
5.1a : **Gauge Chart** (current %) + **Area Chart** (trend over epochs) - Shows real-time participation level with historical context
5.1b : **Stacked Bar Chart** (whale vs small holder breakdown) + **Pie Chart** (proportion snapshot) - Visualizes concentration vs distribution
5.1c : **Gauge Chart** (current delegation %) + **Line Chart** (epoch-over-epoch trend) - Clear single metric with progression
5.1d : **Histogram** (wallet size buckets) or **Treemap** (proportional blocks by size category) - Shows distribution shape effectively
5.1e : **Line Chart** (new delegations over time) + **Bar Chart** (epoch comparison) - Tracks growth trajectory
5.1f : **Donut Chart** (active vs inactive proportion) + **Stacked Area Chart** (trend) - Clear inactive stake visibility

---

## 5.2 Category 2 – DRep Insights & Activity
| KPI | Context | Pimary | API endpoint | Logic |
| - | - | - | - | - | 
|5.2a Delegation Decentralization (Gini) |Is voting power overly concentrated in a few "Super DReps"? |Distribution of Power | GET /drep_list + POST /drep_info (bulk) to update Drep.votingPower. |same as 5.1b |
|5.2b DRep Activity Rate |Are registered DReps actually doing the job (voting)? |Performance | GET /vote_list (bulk window) and GET /proposal_votes?_proposal_id=<proposalId> (per proposal) |amount of active dreps vs numbers of votes on submitted onchain proposals |
|5.2c DRep Rationale Rate |Are representatives including a rationale with their votes (transparency)? |Performance / Quality| GET /vote_list meta fields (meta_url, meta_hash, optionally meta_json). |same as 5.2b + number of submitted rationales |
|5.2d DRep Voting Correlation |Are DReps voting in herds or thinking independently? |Decentralization | GET /vote_list |Calculate pairwise voting agreement between DReps across proposals. Use correlation coefficient or Jaccard similarity on vote choices (Yes/No/Abstain) per proposal to identify voting blocs vs independent voters |
|5.2e DRep Lifecycle Rate |Is the DRep ecosystem growing or shrinking (registrations vs. de-registrations)? |Health / Churn |  GET /drep_updates (registrations / deregistrations) | registrations vs. de-registrations of DReps|

Considered Chart Choice:
5.2a : **Lorenz Curve** (with Gini coefficient display) + **Bar Chart** (top 10 DReps by voting power) - Classic inequality visualization
5.2b : **Heatmap** (DRep × Proposal voting activity) + **Horizontal Bar Chart** (ranked by votes cast) - Shows engagement patterns
5.2c : **Stacked Bar Chart** (votes with vs without rationale) + **Donut Chart** (overall rate) - Clear transparency metric
5.2d : **Correlation Matrix Heatmap** (pairwise DRep agreement) + **Network Graph** (voting bloc clusters) - Reveals voting patterns and independence
5.2e : **Line Chart** (cumulative registrations vs de-registrations) + **Stacked Area Chart** (net growth over time) - Shows ecosystem health trend

---

## 5.3 Category 3 – SPO Governance Participation
| KPI | Context | Pimary | API endpoint | Logic |
| - | - | - | - | - | 
|5.3a SPO Voting Turnout |Are operators voting on Governance Actions where their approval is required (e.g., hard forks, parameters, update committee, no-confidence)? |Participation / Security | GET /pool_voting_power_history?_epoch_no=<E> to populate totals. |number of registered SPOs vs amount of voting SPOs on eligible gov actions |
|5.3b SPO Silent Stake Rate |How much potential voting power is left uncast? |Efficiency | GET /pool_voting_power_history?_epoch_no=<E> to populate totals. |amount of delegated ada to SPOs vs amount of delegated Ada to DReps |
|5.3c Default Stance Adoption |Are SPOs relying on "Abstain" or "No-Confidence" default voting option by delegating their rewards account? |Engagement | GET /proposal_voting_summary?_proposal_id=<proposalId> fields: pool_passive_always_abstain_votes_assigned, pool_passive_always_abstain_vote_power, pool_passive_always_no_confidence_votes_assigned, pool_passive_always_no_confidence_vote_power |Sum passive abstain and no-confidence vote power from proposal voting summaries. Compare to total active SPO votes to measure reliance on default stances |
|5.3d Entity Voting Power Concentration |Do multi-pool entities control a disproportionate share of the vote? |Distribution of Power | GET /pool_groups (pool -> entity/group mapping) and GET /pool_voting_power_history?_epoch_no=<E> |Group pools by entity/operator using pool_groups mapping. Sum voting power per entity and calculate Herfindahl-Hirschman Index (HHI) or top-N concentration ratio |
|5.3e SPO-DRep Vote Divergence |How often do SPOs vote differently than the DReps on shared actions? |Alignment | GET /proposal_voting_summary?_proposal_id=<proposalId> |Compare SPO aggregate vote (Yes/No/Abstain majority) vs DRep aggregate vote on shared eligible proposals. Calculate divergence rate as % of proposals where outcomes differ |

Considered Chart Choice:
5.3a : **Gauge Chart** (turnout %) + **Grouped Bar Chart** (turnout per action type) - Shows overall and per-category engagement
5.3b : **Donut Chart** (voting vs silent stake) + **Gauge Chart** (silent %) - Clear efficiency metric
5.3c : **Stacked Bar Chart** (active vs abstain vs no-confidence default) + **Pie Chart** (default stance breakdown) - Shows reliance on passive options
5.3d : **Treemap** (entities sized by voting power) + **Bar Chart** (top 10 entities) - Concentration visualization
5.3e : **Diverging Bar Chart** (SPO vs DRep vote direction per proposal) + **Grouped Bar Chart** (agreement rate) - Clear alignment/divergence view

---

## 5.4 Category 4 – Governance Action & Treasury Health
| KPI | Context | Pimary | API endpoint | Logic |
| - | - | - | - | - | 
|5.4a Governance Action Volume & Source |Who is submitting actions (Intersect or Founding Entities or Individuals or Projects)? |Participation | GET /proposal_list |Categorize proposals by submitter address/metadata. Count and track submissions per source category over time |
|5.4b Governance Action Contention Rate |Are we rubber-stamping or having healthy debates? |Legitimacy | GET /proposal_voting_summary?_proposal_id=<proposalId> |Calculate vote margin (|Yes% - No%|) per proposal. Low margins indicate contention. Track % of proposals with margins below threshold (e.g., <20%) |
|5.4c Treasury Balance Rate |Are we draining the treasury faster than we replenish it? |Financial Health | GET /totals?_epoch_no=<E> (treasury) optionally GET /treasury_withdrawals (events) |Compare treasury balance change per epoch. Calculate inflow (rewards/fees) vs outflow (withdrawals) ratio to determine sustainability |
|5.4d Time-to-Enactment |What is the amount of time between submission and successful ratification and enactment? |Efficiency | GET /epoch_info?_epoch_no=<E> to map epochs to timestamps |Calculate epochs between proposal submission (proposal block_time) and ratification/enactment. Convert to days using epoch_info timestamps |
|5.4e Constitutional Compliance Clarity |How often are actions rejected for constitutional reasons? |Effectiveness | GET /proposal_list |Track proposals rejected with CC "No" votes. Analyze CC vote rationales for constitutional violation mentions |

Considered Chart Choice:
5.4a : **Stacked Bar Chart** (submissions by source over time) + **Pie Chart** (overall source distribution) - Shows who is driving governance
5.4b : **Histogram** (vote margin distribution) + **Scatter Plot** (margin vs proposal type) - Reveals contention patterns
5.4c : **Area Chart** (treasury balance over epochs) + **Waterfall Chart** (inflows vs outflows) - Financial health visualization
5.4d : **Box Plot** (time distribution by action type) + **Histogram** (overall time-to-enactment) - Shows efficiency and variance
5.4e : **Donut Chart** (compliant vs rejected proportion) + **Bar Chart** (rejections by reason category) - Compliance overview

---

## 5.5 Category 5 – Constitutional Committee Activity
| KPI | Context | Pimary | API endpoint | Logic |
| - | - | - | - | - | 
|5.5a Time-to-Decision |Is the CC reviewing actions quickly enough not to block governance? |Efficiency | GET /proposal_list (proposal block_time) and GET /proposal_votes?_proposal_id=<proposalId> (CC votes + block_time) |Calculate time delta between proposal submission block_time and first/last CC vote block_time. Track average and distribution |
|5.5b CC Member Participation Rate |Are CC members, as determined by their CC hot credential, actually voting? |Accountability |  GET /committee_info for member count; GET /proposal_votes?_proposal_id=<proposalId> |Count CC members who voted on each proposal vs total active CC members. Calculate participation % per proposal and overall average |
|5.5c CC Abstain Rate |Is the CC unable to determine constitutionality? |Effectiveness | GET /proposal_votes?_proposal_id=<proposalId> |Count CC "Abstain" votes vs total CC votes cast. Track per proposal and aggregate rate |
|5.5d CC Vote Agreement Rate |Is there groupthink, or do CC members vote differ on the same action? |Independence | GET /proposal_votes?_proposal_id=<proposalId> |Calculate % of proposals where all voting CC members voted the same way. Track split votes to measure independence |
|5.5e CC Off-Chain Election Turnout |Does the community care about who sits on the CC? |Legitimacy | Off-chain data source required (e.g., Intersect election portal) |Compare eligible voters to actual voters in CC elections. Requires integration with off-chain election tracking systems |

Considered Chart Choice:
5.5a : **Box Plot** (decision time distribution) + **Line Chart** (average time trend over epochs) - Shows efficiency and consistency
5.5b : **Heatmap** (CC member × proposal voting) + **Bar Chart** (participation % per member) - Individual accountability view
5.5c : **Donut Chart** (vote type breakdown) + **Line Chart** (abstain rate trend) - Tracks constitutionality determination ability
5.5d : **Stacked Bar Chart** (unanimous vs split per proposal) + **Pie Chart** (overall agreement rate) - Independence measurement
5.5e : **Gauge Chart** (turnout %) + **Bar Chart** (turnout per election) - Legitimacy tracking

---

## 5.6 Category 6 – Tooling & UX
| KPI | Context | Pimary | API endpoint | Logic |
| - | - | - | - | - | 
|5.6a Submission Path Share (CLI vs GUI) |Is governance action submission accessible to non-technical users? |Accessibility | Transaction metadata analysis or off-chain tool tracking |Identify submission tool from transaction metadata patterns or known wallet/tool addresses. Track % submissions via CLI vs GUI tools (GovTool, SanchoNet, etc.) |
|5.6b Proposer Onboarding Completion |Is the submission process too difficult (drop-off rate)? |UX / Friction | Off-chain UX analytics required |Track user journey from intent to submission via tool analytics. Measure drop-off rate at each step. Not available via on-chain APIs alone |
|5.6c Gov. Info Availability |Can community members easily find rationales and vote history? |Transparency | proposals: GET /proposal_list meta fields and votes: GET /vote_list meta fields |Check meta_url/meta_hash presence and validate URL accessibility. Calculate % of proposals/votes with accessible rationale documents |
|5.6d Governance Data Parity |Do different explorers show the same data (e.g. approval rates of live governance actions)? |Reliability | Cross-reference multiple explorer APIs |Query same proposal from multiple sources (cardanoscan, cexplorer, koios). Flag discrepancies in vote counts, approval rates, or status |
|5.6e Access Friction Index |(Composite) How difficult is it to participate in Cardano governance? |UX | Composite from multiple sources |Weighted score from: wallet governance support %, mobile access availability, avg clicks to vote, documentation quality, language accessibility. Requires off-chain surveys/analysis |

Considered Chart Choice:
5.6a : **Pie Chart** (CLI vs GUI share) + **Stacked Bar Chart** (tool usage over time) - Accessibility trend
5.6b : **Funnel Chart** (drop-off at each onboarding step) - Classic UX conversion visualization
5.6c : **Gauge Chart** (availability %) + **Stacked Bar Chart** (available vs missing metadata) - Transparency metric
5.6d : **Table with Status Indicators** (explorer comparison) + **Heatmap** (discrepancy severity by data type) - Reliability dashboard
5.6e : **Radar Chart** (multi-dimensional friction factors) + **Gauge Chart** (composite score) - Holistic UX overview

---

## Chart Type Summary

| Chart Type | Best For | Used In |
|------------|----------|---------|
| **Gauge Chart** | Single percentage metrics (turnout, rates) | 5.1a, 5.1c, 5.3a, 5.3b, 5.5e, 5.6c, 5.6e |
| **Line/Area Chart** | Trends over epochs/time | 5.1a, 5.1c, 5.1e, 5.2e, 5.4c, 5.5a, 5.5c |
| **Bar Chart** | Comparisons, rankings | 5.1e, 5.2a, 5.2b, 5.3d, 5.4e, 5.5b, 5.5e |
| **Stacked Bar** | Part-to-whole over categories | 5.1b, 5.2c, 5.3c, 5.4a, 5.5d, 5.6a, 5.6c |
| **Pie/Donut Chart** | Proportions snapshot | 5.1b, 5.1f, 5.2c, 5.3b, 5.3c, 5.4e, 5.5c, 5.5d, 5.6a |
| **Heatmap** | Matrices, patterns | 5.2b, 5.2d, 5.5b, 5.6d |
| **Histogram/Box Plot** | Distributions | 5.1d, 5.4b, 5.4d, 5.5a |
| **Treemap** | Hierarchical proportions | 5.1d, 5.3d |
| **Lorenz Curve** | Inequality (Gini) | 5.2a |
| **Network Graph** | Relationships/clusters | 5.2d |
| **Funnel Chart** | Drop-off/conversion | 5.6b |
| **Radar Chart** | Multi-dimensional scores | 5.6e |
| **Waterfall Chart** | Inflows vs outflows | 5.4c |
| **Diverging Bar** | Comparison of opposites | 5.3e |

---

