# Environment Configurations

Pre-configured environment files for different API modes.

## Quick Setup

Copy the desired config to `.env.local`:

```bash
# Test with production API (https://api.cgov.io)
cp config/env.production .env.local
npm run dev
```

```bash
# Use mock data (no API server)
cp config/env.mock .env.local
npm run dev
```

```bash
# Use local development API
cp config/env.local .env.local
npm run dev
```

**Note:** Always restart `npm run dev` after changing `.env.local`

## Current API Endpoints

- **Production:** https://api.cgov.io
- **Local:** http://localhost:3000
- **Mock:** No server needed (local data)

