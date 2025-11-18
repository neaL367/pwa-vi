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

  if (url.pathname.startsWith("/api/time")) {
    event.respondWith((async () => {
      try {
        return await fetch(event.request);
      } catch {
        return Response.error();
      }
    })());
    return; 
  }
});

// to support dynamic caching via messages
self.addEventListener("message", (event) => {
  serwist.handleCache(event);
});

self.addEventListener("push", (event: PushEvent) => {
  if (event.data) {
    const data = event.data.json();
    const options: NotificationOptions = {
      body: data.body,
      icon: data.icon ?? "/icon.png",
      badge: data.badge ?? "/badge.png",
      data: {
        url: data.data?.url ?? "/",
        primaryKey: data.data?.primaryKey ?? "1",
      },
    };

    event.waitUntil(self.registration.showNotification(data.title, options));
  }
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  if (event.action === "close") {
    return;
  }

  const urlToOpen = event.notification.data?.url ?? "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ("url" in client && client.url === urlToOpen) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      })
  );
});
