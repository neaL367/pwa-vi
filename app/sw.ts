import { Serwist } from "serwist";
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  precacheOptions: {
    cleanupOutdatedCaches: true,
    concurrency: 10,
    ignoreURLParametersMatching: [],
  },
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(serwist.handleInstall(event));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await serwist.handleActivate(event);
      self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // If client is requesting server time, forward to network (avoid cache)
  if (url.pathname.startsWith("/api/time")) {
    event.respondWith(
      (async () => {
        try {
          // attempt network fetch without cache to return current time
          const resp = await fetch(event.request);
          return resp;
        } catch {
          // fallback to network error response
          return Response.error();
        }
      })()
    );
    return;
  }

  // Otherwise let Serwist handle runtime caching as configured.
  // (serwist already installed listeners via addEventListeners())
});

// support message-based dynamic caching / prefetching
self.addEventListener("message", (event) => {
  // allow app to pass { type: 'CACHE_URLS', urls: [...] }
  try {
    serwist.handleCache(event);
  } catch {
    // ignore
  }
});

// push handler (server-sent)
self.addEventListener("push", (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: data.icon || "/apple-touch-icon.png",
      badge: data.badge || "/apple-touch-icon.png",
      data: data.data || {},
    };
    event.waitUntil(
      self.registration.showNotification(data.title || "Notification", options)
    );
  } catch {
    // malformed payload
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || "/";
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // focus if exists or open
      for (const client of allClients) {
        if ("url" in client && client.url === urlToOpen) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })()
  );
});
