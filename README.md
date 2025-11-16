<div align="center">
  <hr />
    <h2 align="center" style="border-bottom: none">cgov - Cardano Governance Platform</h2>

<!-- [![Licence](https://img.shields.io/github/license/sidan-lab/whisky)](https://github.com/sidan-lab/whisky/blob/master/LICENSE)
[![Test](https://github.com/sidan-lab/whisky/actions/workflows/rust-build-test.yml/badge.svg)](https://github.com/sidan-lab/whisky/actions/workflows/rust-build-test.yml)
[![Publish](https://github.com/sidan-lab/whisky/actions/workflows/publish-packages.yml/badge.svg)](https://github.com/sidan-lab/whisky/actions/workflows/publish-packages.yml)
[![Docs](https://github.com/sidan-lab/whisky/actions/workflows/static.yml/badge.svg?branch=master)](https://github.com/sidan-lab/whisky/actions/workflows/static.yml)

[![Twitter/X](https://img.shields.io/badge/Follow%20us-@sidan__lab-blue?logo=x&style=for-the-badge)](https://x.com/sidan_lab)
[![Crates.io](https://img.shields.io/crates/v/whisky?style=for-the-badge)](https://crates.io/crates/whisky)
[![NPM](https://img.shields.io/npm/v/%40sidan-lab%2Fwhisky-js-nodejs?style=for-the-badge)](https://www.npmjs.com/package/@sidan-lab/whisky-js-nodejs) -->

<h3 align="center" style="border-bottom: none"> powered by SIDAN Lab & MeshJS <img style="position: relative; top: 0.25rem;" src="https://raw.githubusercontent.com/sidan-lab/brand_assets/main/sidan.png" alt="sidan" height="30" /><img style="position: relative; top: 0.25rem;" src="https://meshjs.dev/logo-mesh/white/logo-mesh-white-256x256.png" alt="sidan" height="30" /></h2>

  <hr/>
</div>

cgov is an open-source Cardano governance platform, it is interacting with below components:

- `api` - Core API server as backend supporting the application
- `discord` - The discord bot component of the cgov platform

With cgov, you can

- Consume relevant information in efficient way to support your understanding on different governance actions
- Participate in Cardano governance with both your wallet and multisig wallet
- Interacting with your delegators at ease - with both discord and platform integration.

## For Dev / Maintainers

### Quick Start

```bash
npm install
npm run dev
```

Application runs on `http://localhost:3001` with **mock data by default**.

### Switching Mock / Real API

By default uses **mock data** (no API server needed).

**Option 1: Use pre-configured files**

```bash
# Production API (https://api.cgov.io)
cp config/env.production .env.local
npm run dev

# Mock data (default)
cp config/env.mock .env.local
npm run dev

# Local development API
cp config/env.local .env.local
npm run dev
```

**Option 2: Manual configuration**

Create `.env.local`:

```bash
# For mock data
NEXT_PUBLIC_API_MODE=mock

# For real API
NEXT_PUBLIC_API_MODE=real
NEXT_PUBLIC_API_BASE_URL=https://api.cgov.io
```

![Alt](https://repobeats.axiom.co/api/embed/783bce112387ee6ab70e24a8b31532de60d40f06.svg "Repobeats analytics image")
