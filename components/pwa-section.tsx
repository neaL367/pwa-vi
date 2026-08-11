"use client";

import { useState, useEffect, useCallback, useSyncExternalStore, createContext, use } from "react";
import { subscribeUser, unsubscribeUser } from "@/app/actions";
import { cn } from "@/lib/cn";
import { toast } from "sonner";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface NavigatorIOS extends Navigator {
  standalone?: boolean;
}

const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const SW_PATH = "/sw.js";

const BTN_CLASS =
  "px-4 py-2 rounded-full font-medium transition-all duration-200 bg-white text-black hover:bg-white/90 hover:scale-105 active:scale-95 hover:cursor-pointer";

const NOOP_SUBSCRIBE = () => () => {};

const IOS_REGEX = /iPad|iPhone|iPod/i;

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function checkPushSupport() {
  if (typeof window === "undefined" || typeof navigator === "undefined")
    return false;
  return "serviceWorker" in navigator && "PushManager" in window;
}

function getClientTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function getSubscriptionPayload(sub: PushSubscription) {
  const json = sub.toJSON();
  if (!json.keys?.p256dh || !json.keys.auth) return null;

  return {
    endpoint: sub.endpoint,
    keys: {
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
    timeZone: getClientTimeZone(),
  };
}

async function registerServiceWorker() {
  const registration = await navigator.serviceWorker.register(SW_PATH, {
    scope: "/",
    updateViaCache: "none",
  });
  return registration;
}

async function getExistingSubscription() {
  const registration = await navigator.serviceWorker.ready;
  return await registration.pushManager.getSubscription();
}

async function createNewSubscription() {
  const registration = await navigator.serviceWorker.ready;
  return await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_KEY),
  });
}

function usePushNotifications() {
  const [subscription, setSubscription] = useState<PushSubscription | null>(
    null
  );
  const [loading, setLoading] = useState(false);

  const isSupported = useSyncExternalStore(
    NOOP_SUBSCRIBE,
    checkPushSupport,
    () => false
  );

  const sync = useCallback(async () => {
    if (!isSupported) return;
    try {
      await registerServiceWorker();
      const sub = await getExistingSubscription();
      setSubscription(sub);

      // Refresh the stored timezone for existing browser subscriptions too.
      // This upgrades subscriptions created before timezone support was added.
      if (sub) {
        const payload = getSubscriptionPayload(sub);
        if (payload) await subscribeUser(payload);
      }
    } catch (error) {
      console.error("Sync failed:", error);
    }
  }, [isSupported]);

  useEffect(() => {
    sync();
  }, [sync]);

  const subscribe = useCallback(async () => {
    if (!isSupported) return;
    setLoading(true);
    try {
      const sub = await createNewSubscription();
      setSubscription(sub);
      const payload = getSubscriptionPayload(sub);
      if (!payload) throw new Error("Push subscription keys are missing");
      const result = await subscribeUser(payload);
      if (result.success) {
        toast.success("Subscribed to GTA VI release alerts!");
      } else {
        toast.error(result.error || "Failed to save subscription.");
      }
    } catch (error) {
      console.error("Subscription failed:", error);
      toast.error("Notification permission denied or subscription failed.");
    } finally {
      setLoading(false);
    }
  }, [isSupported]);

  const unsubscribe = useCallback(async () => {
    if (!subscription) return;
    setLoading(true);
    try {
      const result = await unsubscribeUser({ endpoint: subscription.endpoint, keys: { p256dh: "", auth: "" } });
      if (result.success) {
        await subscription.unsubscribe();
        setSubscription(null);
        toast.success("Unsubscribed from alerts.");
      } else {
        toast.error(result.error || "Failed to unsubscribe.");
      }
    } catch (error) {
      console.error("Unsubscription failed:", error);
      toast.error("Failed to unsubscribe. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [subscription]);

  return { isSupported, subscription, subscribe, unsubscribe, loading };
}

function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  const isIOS = useSyncExternalStore(
    NOOP_SUBSCRIBE,
    () => {
      const ua = window.navigator.userAgent;
      return (
        IOS_REGEX.test(ua) ||
        (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 0)
      );
    },
    () => false
  );

  const isStandalone = useSyncExternalStore(
    NOOP_SUBSCRIBE,
    () =>
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as NavigatorIOS).standalone === true,
    () => false
  );

  useEffect(() => {
    const handlePrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handlePrompt);
    return () =>
      window.removeEventListener("beforeinstallprompt", handlePrompt);
  }, []);

  const triggerInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setDeferredPrompt(null);
  };

  return { isIOS, isStandalone, deferredPrompt, triggerInstall };
}

function useOnlineStatus() {
  return useSyncExternalStore(
    (callback) => {
      window.addEventListener("online", callback);
      window.addEventListener("offline", callback);
      return () => {
        window.removeEventListener("online", callback);
        window.removeEventListener("offline", callback);
      };
    },
    () => navigator.onLine,
    () => true
  );
}

type PWAContextType = {
  push: ReturnType<typeof usePushNotifications>;
  install: ReturnType<typeof usePwaInstall>;
  isOnline: boolean;
};

const PWAContext = createContext<PWAContextType | null>(null);

function usePWA() {
  const context = use(PWAContext);
  if (!context) throw new Error("usePWA must be used within PWAProvider");
  return context;
}

function PWAProvider({ children }: { children: React.ReactNode }) {
  const push = usePushNotifications();
  const install = usePwaInstall();
  const isOnline = useOnlineStatus();

  return (
    <PWAContext value={{ push, install, isOnline }}>
      {children}
    </PWAContext>
  );
}

function PWASection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 p-6 max-w-md mx-auto font-deco-regular">
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      {children}
    </div>
  );
}

function PushButton({
  loading,
  subscribed,
  onToggle,
}: {
  loading: boolean;
  subscribed: boolean;
  onToggle: () => void;
}) {
  const label = loading
    ? subscribed
      ? "Unsubscribing..."
      : "Subscribing..."
    : subscribed
      ? "Unsubscribe"
      : "Subscribe";

  const [currentLabel, setCurrentLabel] = useState(label);
  const [prevLabel, setPrevLabel] = useState<string | null>(null);
  const [direction, setDirection] = useState<"up" | "down">("down");

  useEffect(() => {
    if (label !== currentLabel) {
      // Determine sliding direction:
      // When subscribing (entering loading or subscribed), slide down
      // When unsubscribing (entering loading or unsubscribed), slide up
      const isSubscribing = label === "Subscribing..." || label === "Unsubscribe";
      // Intentional: synchronize the animation state when the label changes.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDirection(isSubscribing ? "down" : "up");
      setPrevLabel(currentLabel);
      setCurrentLabel(label);
    }
  }, [label, currentLabel]);

  const handleAnimationEnd = () => {
    setPrevLabel(null);
  };

  return (
    <button
      onClick={onToggle}
      disabled={loading}
      className={cn(
        BTN_CLASS,
        "w-40 h-10 relative overflow-hidden flex items-center justify-center",
        loading && "opacity-75 cursor-not-allowed",
      )}
    >
      <span className="relative w-full h-full flex items-center justify-center font-medium">
        {prevLabel && (
          <span
            onAnimationEnd={handleAnimationEnd}
            className={cn(
              "absolute inset-0 flex items-center justify-center pointer-events-none select-none",
              direction === "down"
                ? "animate-[slide-out-down_0.35s_cubic-bezier(0.16,1,0.3,1)_forwards]"
                : "animate-[slide-out-up_0.35s_cubic-bezier(0.16,1,0.3,1)_forwards]"
            )}
          >
            {prevLabel}
          </span>
        )}
        <span
          className={cn(
            "flex items-center justify-center",
            prevLabel
              ? direction === "down"
                ? "animate-[slide-in-down_0.35s_cubic-bezier(0.16,1,0.3,1)_forwards]"
                : "animate-[slide-in-up_0.35s_cubic-bezier(0.16,1,0.3,1)_forwards]"
              : ""
          )}
        >
          {currentLabel}
        </span>
      </span>
    </button>
  );
}

function PushNotificationStatus({ subscribed }: { subscribed: boolean }) {
  const label = subscribed
    ? "You are subscribed to push notifications."
    : "You are not subscribed to push notifications.";

  const [currentLabel, setCurrentLabel] = useState(label);
  const [prevLabel, setPrevLabel] = useState<string | null>(null);
  const [direction, setDirection] = useState<"up" | "down">("down");

  useEffect(() => {
    if (label !== currentLabel) {
      // Intentional: synchronize the animation state when the label changes.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDirection(subscribed ? "down" : "up");
      setPrevLabel(currentLabel);
      setCurrentLabel(label);
    }
  }, [label, currentLabel, subscribed]);

  const handleAnimationEnd = () => {
    setPrevLabel(null);
  };

  return (
    <div className="relative w-full h-6 overflow-hidden flex items-center justify-center">
      {prevLabel && (
        <p
          onAnimationEnd={handleAnimationEnd}
          className={cn(
            "absolute text-white/70 text-sm text-center select-none pointer-events-none whitespace-nowrap",
            direction === "down"
              ? "animate-[slide-out-down_0.35s_cubic-bezier(0.16,1,0.3,1)_forwards]"
              : "animate-[slide-out-up_0.35s_cubic-bezier(0.16,1,0.3,1)_forwards]"
          )}
        >
          {prevLabel}
        </p>
      )}
      <p
        className={cn(
          "text-white/70 text-sm text-center whitespace-nowrap",
          prevLabel
            ? direction === "down"
              ? "animate-[slide-in-down_0.35s_cubic-bezier(0.16,1,0.3,1)_forwards]"
              : "animate-[slide-in-up_0.35s_cubic-bezier(0.16,1,0.3,1)_forwards]"
            : ""
        )}
      >
        {currentLabel}
      </p>
    </div>
  );
}

function PushNotificationManager() {
  const { push } = usePWA();
  const { isSupported, subscription, subscribe, unsubscribe, loading } = push;

  if (!isSupported) {
    return (
      <PWASection title="Push Notifications">
        <p className="text-white text-xs text-center opacity-50">
          Push notifications not supported.
        </p>
      </PWASection>
    );
  }

  return (
    <PWASection title="Push Notifications">
      <PushNotificationStatus subscribed={!!subscription} />
      <PushButton
        loading={loading}
        subscribed={!!subscription}
        onToggle={subscription ? unsubscribe : subscribe}
      />
    </PWASection>
  );
}

function InstallPrompt() {
  const { install } = usePWA();
  const { isIOS, isStandalone, deferredPrompt, triggerInstall } = install;

  if (isStandalone) return null;
  if (!isIOS && !deferredPrompt) return null;

  return (
    <PWASection title="Install App">
      <button
        onClick={triggerInstall}
        className={BTN_CLASS}
      >
        Add to Home Screen
      </button>

      {isIOS ? (
        <p className="text-white/70 text-sm text-center leading-relaxed">
          To install this app on your iOS device, tap the share button
          <span className="mx-1">⎋</span>
          and then &quot;Add to Home Screen&quot;
          <span className="mx-1">➕</span>.
        </p>
      ) : null}
    </PWASection>
  );
}

function OfflineBadge() {
  const { isOnline } = usePWA();
  if (isOnline) return null;

  return (
    <div className="fixed top-4 right-4 animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="px-3 py-1 bg-red-500/20 border border-red-500/50 backdrop-blur-md rounded-full">
        <p className="text-[10px] text-red-400 uppercase tracking-widest font-deco-bold">
          Offline Mode
        </p>
      </div>
    </div>
  );
}

export function PWASectionShell({ children }: { children: React.ReactNode }) {
  return (
    <PWAProvider>
      <OfflineBadge />
      {children}
      <InstallPrompt />
      <PushNotificationManager />
    </PWAProvider>
  );
}
