<div align="center">
  <hr />
    <h2 align="center" style="border-bottom: none">cgov - Cardano Governance Platform</h2>

<h3 align="center" style="border-bottom: none"> powered by SIDAN Lab & MeshJS <img style="position: relative; top: 0.25rem;" src="https://raw.githubusercontent.com/sidan-lab/brand_assets/main/sidan.png" alt="sidan" height="30" /><img style="position: relative; top: 0.25rem;" src="https://meshjs.dev/logo-mesh/white/logo-mesh-white-256x256.png" alt="mesh" height="30" /></h3>

  <hr/>
</div>

cgov is an open-source Cardano governance platform for monitoring, tracking, and participating in on-chain governance actions. It integrates with the following component(s):

- `api` - Core API server as backend supporting the application

## Features

- **Dashboard Overview** - Track total, active, ratified, enacted, expired, and closed governance proposals
- **Net Change Limit (NCL)** - Monitor treasury spending limits by year with progress visualization
- **Live Voting Data** - Real-time vote percentages with donut chart visualizations
- **Vote Analysis** - Detailed breakdown of active, abstain, always-abstain, inactive, and pending votes
- **Bubble Map Visualization** - Interactive bubble visualization of voting distribution
- **Voting Trends** - Line charts showing cumulative voting power over time
- **Searchable Voting Records** - Filter and search all votes with export to JSON/CSV/Markdown
- **Theme System** - Light (Fancy), Dark (Nerd), and Game themes

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Backend API server running (see [api repository](https://github.com/nomos-guild/cgov-api))

### Installation

```bash
# Clone the repository
git clone https://github.com/nomos-guild/cgov.git
cd cgov

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
```

### Configuration

Create a `.env` file with the following variables:

```bash
BACKEND_API_URL=http://localhost:3005  # Backend API base URL
BACKEND_API_KEY="your-api-key"         # Authentication key
```

> Note: These environment variables are server-side only and not exposed to the browser.

### Development

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to view the application.

### Production Build

```bash
npm run build
npm run start
```

## Governance Action Types

The platform supports all Cardano governance action types:

- Motion of No-Confidence
- Update Committee / Terms
- Constitution Update (New Constitution)
- Hard Fork Initiation
- Protocol Parameter Change
- Treasury Withdrawal
- Info Action

## Voter Types

| Type | Description               | Voting Power |
| ---- | ------------------------- | ------------ |
| DRep | Delegated Representatives | ADA-based    |
| SPO  | Stake Pool Operators      | ADA-based    |
| CC   | Constitutional Committee  | Count-based  |

## Documentation

Additional documentation is available in the `docs/` folder:

- [Project Description](docs/01-project-description.md)
- [Database Schema](docs/02-database-schema.md)
- [Architecture Decisions](docs/03-architecture-decisions.md)
- [Theming Guide](docs/theming-guide.md)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

Apache-2.0

---

![Alt](https://repobeats.axiom.co/api/embed/783bce112387ee6ab70e24a8b31532de60d40f06.svg "Repobeats analytics image")
