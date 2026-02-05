"use client";

import { useState, useEffect, useCallback, useSyncExternalStore, createContext, use } from "react";
import { subscribeUser, unsubscribeUser } from "./actions";
import { Countdown } from "@/components/countdown";
import { cn } from "@/lib/cn";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface NavigatorIOS extends Navigator {
  standalone?: boolean;
}

const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const SW_PATH = "/sw.js";
const BG_GRADIENT =
  "bg-linear-[223.17deg,#1c1829,#1b1828_8.61%,#191724_17.21%,#161520_25.82%,#14131c_34.42%,#121218_43.03%,#111117_51.63%]";

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
    () => () => { },
    checkPushSupport,
    () => false
  );

  const sync = useCallback(async () => {
    if (!isSupported) return;
    try {
      await registerServiceWorker();
      const sub = await getExistingSubscription();
      setSubscription(sub);
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
      await subscribeUser(JSON.parse(JSON.stringify(sub)));
    } catch (error) {
      console.error("Subscription failed:", error);
    } finally {
      setLoading(false);
    }
  }, [isSupported]);

  const unsubscribe = useCallback(async () => {
    if (!subscription) return;
    setLoading(true);
    try {
      await unsubscribeUser(JSON.parse(JSON.stringify(subscription)));
      await subscription.unsubscribe();
      setSubscription(null);
    } catch (error) {
      console.error("Unsubscription failed:", error);
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
    () => () => { },
    () => {
      const ua = window.navigator.userAgent;
      return (
        /iPad|iPhone|iPod/i.test(ua) ||
        (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 0)
      );
    },
    () => false
  );

  const isStandalone = useSyncExternalStore(
    () => () => { },
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

  return (
    <button
      onClick={onToggle}
      disabled={loading}
      className={cn(
        "px-4 py-2 rounded-full font-medium transition-all duration-200 bg-white text-black",
        loading
          ? "opacity-50 cursor-not-allowed"
          : "hover:bg-white/90 hover:scale-105 active:scale-95 hover:cursor-pointer"
      )}
    >
      {label}
    </button>
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
      <p className="text-white/70 text-sm">
        {subscription
          ? "You are subscribed to push notifications."
          : "You are not subscribed to push notifications."}
      </p>
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
      {deferredPrompt ? (
        <button
          onClick={triggerInstall}
          className="px-4 py-2 bg-white text-black hover:bg-white/90 rounded-full transition-all duration-200 font-medium hover:scale-105 active:scale-95 hover:cursor-pointer"
        >
          Add to Home Screen
        </button>
      ) : null}

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

export default function Page() {
  return (
    <PWAProvider>
      <main
        className={cn(
          "flex min-h-screen flex-col items-center justify-center font-sans",
          "px-[12.8px] sm:px-[17px] md:px-[28.8px]",
          BG_GRADIENT
        )}
      >
        <div className="flex flex-col items-center text-center font-deco-bold px-[12.8px] sm:px-[17px] md:px-[28.8px]">
          <OfflineBadge />
          <Countdown />
          <InstallPrompt />
          <PushNotificationManager />
        </div>
      </main>
    </PWAProvider>
  );
}
