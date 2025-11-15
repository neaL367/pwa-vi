# PWA-VI

A Progressive Web App Vibecode for tracking the countdown to the release of *Grand Theft Auto VI* (GTA VI), with install-to-home-screen support and push notifications.

## Getting Started

### Install & Run

```bash
# clone the repo  
git clone https://github.com/neaL367/pwa-vi.git  
cd pwa-vi  

# install dependencies  
npm install  
# OR  
yarn install  
# OR  
pnpm install  

# run in development 
# Use next dev --experimental-https for testing
bun dev:https
```

Open your browser at [https://localhost:3000](http://localhost:3000) to view the app.
Make sure to register the service worker and test installability on mobile/desktop.

### Build & Production

```bash
npm run build  
```

Configure your hosting environment (e.g., Vercel, Netlify) to serve the built app and ensure HTTPS (for push notifications and PWA installation to work).
