"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";
import { subscribeUser, unsubscribeUser } from "@/server/actions";
import type { PushSubscriptionJSON } from "@/server/webpush";
import {
  isPushSupported as _isPushSupported,
  getNotificationPermission,
  urlBase64ToUint8Array,
} from "@/lib/pwa";

interface PWAContextType {
  isPushSupported: boolean;
  permission: NotificationPermission;
  subscription: PushSubscription | null;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
  loading: boolean;
}

const PWAContext = createContext<PWAContextType | null>(null);

export function PWAProvider({ children }: { children: React.ReactNode }) {
  const [permission, setPermission] = useState<NotificationPermission>(
    getNotificationPermission()
  );
  const [subscription, setSubscription] = useState<PushSubscription | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const isPushSupported = typeof window !== "undefined" && _isPushSupported();

  useEffect(() => {
    if (!isPushSupported) return;

    let mounted = true;
    (async () => {
      try {
        // Register SW safely if not already
        if ("serviceWorker" in navigator) {
          await navigator.serviceWorker.register("/sw.js");
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.getSubscription();
          if (mounted) setSubscription(sub);
        }
      } catch (err) {
        console.error("SW registration / subscription check failed", err);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [isPushSupported]);

  const subscribe = useCallback(async () => {
    if (!isPushSupported || loading) return;
    setLoading(true);

    try {
      const perm = await Notification.requestPermission();
      if (mountedRef.current) setPermission(perm);
      if (perm !== "granted") {
        throw new Error("Notification permission not granted");
      }

      const reg = await navigator.serviceWorker.ready;
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) throw new Error("VAPID key not configured");

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      if (mountedRef.current) setSubscription(sub);
      // Persist to server
      await subscribeUser(sub.toJSON() as PushSubscriptionJSON);
    } catch (err) {
      console.error("subscribe failed", err);
      // do not rethrow to let caller handle UI state
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [isPushSupported, loading]);

  const unsubscribe = useCallback(async () => {
    if (!subscription || loading) return;
    setLoading(true);
    try {
      await (subscription as PushSubscription).unsubscribe();
      // inform server
      await unsubscribeUser(subscription.endpoint);
      if (mountedRef.current) setSubscription(null);
    } catch (err) {
      console.error("unsubscribe failed", err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [subscription, loading]);

  const value = useMemo(
    () => ({
      isPushSupported,
      permission,
      subscription,
      subscribe,
      unsubscribe,
      loading,
    }),
    [isPushSupported, permission, subscription, subscribe, unsubscribe, loading]
  );

  return <PWAContext.Provider value={value}>{children}</PWAContext.Provider>;
}

export const usePWA = () => {
  const ctx = useContext(PWAContext);
  if (!ctx) throw new Error("usePWA must be used within PWAProvider");
  return ctx;
};
