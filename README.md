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

TBC

![Alt](https://repobeats.axiom.co/api/embed/783bce112387ee6ab70e24a8b31532de60d40f06.svg "Repobeats analytics image")

## Database (Supabase + Prisma)

This project is ready to connect to a Supabase Postgres database via Prisma using `DATABASE_URL`.

Setup:

1. Create a Supabase project, then copy the Postgres Connection String (URI) from Project Settings → Database.

2. Create `.env` in the project root with:

```
DATABASE_URL="postgres://postgres:YOUR_PASSWORD@db.YOUR_SUPABASE_HOST.supabase.co:5432/postgres"
```

3. Install deps and generate Prisma client:

```
npm install
npm run prisma:generate
```

4. Create tables (first time) using migrations or push:

```
npm run prisma:migrate -- --name init
# or
npm run db:push
```

5. Verify connection locally:

```
npm run dev
# visit /api/db/health
```

Prisma schema lives in `prisma/schema.prisma`. A Prisma client singleton is provided at `src/lib/prisma.ts`.
