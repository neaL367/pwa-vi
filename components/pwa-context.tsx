// components/pwa-context.tsx
"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useContext,
  useMemo,
  ReactNode,
} from "react";
import { subscribeUser, unsubscribeUser } from "@/server/actions";
import { PushSubscriptionJSON } from "@/server/webpush";
import {
  isPushSupported as _isPushSupported,
  getNotificationPermission,
  urlBase64ToUint8Array,
} from "@/lib/pwa";
import { useOnlineStatus } from "@/hooks/use-onlinestatus";

interface PWAContextType {
  isPushSupported: boolean;
  permission: NotificationPermission;
  subscription: PushSubscription | null;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
  isOnline: boolean;
  loading: boolean;
}

const PWAContext = React.createContext<PWAContextType | null>(null);

export function PWAProvider({ children }: { children: ReactNode }) {
  const [permission, setPermission] =
    useState<NotificationPermission>("default");
  const [subscription, setSubscription] = useState<PushSubscription | null>(
    null
  );
  const [loading, setLoading] = useState(false);

  const isOnline = useOnlineStatus(); 
  const isPushSupported = _isPushSupported();

  useEffect(() => {
    setPermission(getNotificationPermission());
    if (!isPushSupported) return;

    const initSW = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
        const existing = await reg.pushManager.getSubscription();
        if (existing) {
          setSubscription(existing);
        }
      } catch (err) {
        console.error("SW registration failed:", err);
      }
    };

    initSW();
  }, [isPushSupported]);

  const subscribe = useCallback(async () => {
    if (!isPushSupported || subscription || loading || !isOnline) {
      return;
    }

    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        throw new Error("Permission not granted");
      }

      const reg = await navigator.serviceWorker.ready;
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) throw new Error("VAPID key missing");

      const newSub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      setSubscription(newSub);
      await subscribeUser(newSub.toJSON() as PushSubscriptionJSON);
      console.log("Subscribed");
    } catch (err) {
      console.error("Subscribe error:", err);
    } finally {
      setLoading(false);
    }
  }, [isPushSupported, subscription, loading, isOnline]);

  const unsubscribe = useCallback(async () => {
    if (!subscription || loading) return;

    setLoading(true);
    try {
      await subscription.unsubscribe();
      await unsubscribeUser(subscription.endpoint);
      setSubscription(null);
      console.log("Unsubscribed");
    } catch (err) {
      console.error("Unsubscribe error:", err);
    } finally {
      setLoading(false);
    }
  }, [subscription, loading]);

  const value = useMemo(
    () => ({
      isPushSupported,
      permission,
      subscription,
      subscribe,
      unsubscribe,
      isOnline,
      loading,
    }),
    [
      isPushSupported,
      permission,
      subscription,
      subscribe,
      unsubscribe,
      isOnline,
      loading,
    ]
  );

  return <PWAContext.Provider value={value}>{children}</PWAContext.Provider>;
}

export function usePWA() {
  const ctx = useContext(PWAContext);
  if (!ctx) throw new Error("usePWA must be used inside PWAProvider");
  return ctx;
}
