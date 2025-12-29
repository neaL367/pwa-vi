# PWA-VI

A small Progressive Web App (PWA) that tracks the countdown to Grand Theft Auto VI (GTA VI) and demonstrates PWA + push notifications.

Features
--------
- Install-to-home-screen support (PWA) 
- Push notifications using VAPID keys (web-push) 
- Neon (serverless Postgres) + Prisma for subscription storage 
- Next.js 16 + React 19 + TypeScript + TailwindCSS

Quick start
-----------

Clone, install dependencies, configure environment, and run a dev server.

```bash
# clone the repo
git clone https://github.com/neaL367/pwa-vi.git
cd pwa-vi

# Install dependencies (npm, yarn, pnpm or bun are supported)
npm install
# or
yarn install
# or
pnpm install

# Setup environment (see below)
cp .env.template .env.local
# edit .env.local and add your keys

# Generate Prisma client and push schema
npx prisma generate
npx prisma db push
# OR with bun
# bunx prisma generate
# bunx prisma db push

# Generate VAPID keys (required for web-push)
npx web-push generate-vapid-keys
# copy the public / private keys into your .env.local

# Run dev server (HTTPS recommended for PWA and push testing)
npm run dev
# or
npm run dev:https

# Open: https://localhost:3000
```

Configuration & environment variables
------------------------------------

Environment variables are defined in `.env.template`. Copy that file to `.env.local` and fill in the values for your environment. Required variables:

- `DATABASE_URL` — Postgres connection string (Neon or other provider)
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — VAPID public key (visible to client)
- `VAPID_PRIVATE_KEY` — VAPID private key (server-side only)
- `CRON_SECRET` — CRON secret secure api route (openssl rand -hex 32)

You can generate VAPID keys using the `web-push` tool. Paste values into `.env.local` so the project can use them at runtime. The app validates that the `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is present before attempting a subscription.


Build & deploy
--------------

```bash
npm run build
npm run start
```
