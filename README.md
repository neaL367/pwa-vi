# PWA-VI

A small Progressive Web App (PWA) that tracks the countdown to Grand Theft Auto VI (GTA VI) and demonstrates PWA + push notifications.

Features
--------
- Install-to-home-screen support (PWA) 
- Push notifications using VAPID keys (web-push) 
- Neon (serverless Postgres) + Prisma for subscription storage 
- Next.js + TypeScript + Tailwind CSS frontend 

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
npx web-push generate-vapid-keys --json > vapid.json
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

You can generate VAPID keys using the `web-push` tool. Paste values into `.env.local` so the project can use them at runtime. The app validates that the `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is present before attempting a subscription.

Prisma & database
------------------

This project uses Prisma for database access. The schema is in `prisma/schema.prisma` and defines a `PushSubscription` model. When you first set up the database, use one of these commands:

- `npx prisma db push` — applies schema directly to the DB (fast, good for development)
- `npx prisma migrate dev` — creates and applies a migration (records history)

If you use Neon for serverless Postgres, create a DB in Neon and add the returned connection string to `DATABASE_URL` in `.env.local`.

Push notifications
-------------------

Server-side push is handled by `server/webpush.ts` and uses `web-push`. It expects `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` to be set. The `server/actions.ts` uses the Neon client to store subscriptions and send notifications via the `sendNotification` helper.

Development tips
----------------

- Run `npm run dev:https` to enable a secure local HTTPS server for proper PWA testing.
- Use `components/pwa-manager.tsx` to test subscription registration and push flow.
- The server will remove invalid subscriptions (410 / 404) on send.
- For one-off DB changes you can use `npx prisma studio` to view the DB.

Build & deploy
--------------

```bash
npm run build
npm run start
```

When deploying, make sure to set the same environment variables in the host (Vercel/Netlify). HTTPS is required for push notifications to work and for the PWA install flow.

Where configuration is defined
-----------------------------

Key configuration locations in this repo:

- `package.json` — scripts, dependencies
- `next.config.ts` — Next.js configuration
- `tsconfig.json` — TypeScript config
- `eslint.config.mjs` — ESLint config
- `postcss.config.mjs` — postcss/Tailwind config
- `prisma/schema.prisma` — DB schema
- `prisma.config.ts` — optional Prisma helpers
- `.env.template` — required environment variables
- `app/manifest.ts` — PWA manifest settings
- `public/sw.js` — service worker implementation details