import { useState, useEffect, useCallback, useMemo } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

interface NavigatorStandalone extends Navigator {
  standalone?: boolean;
}

type Platform = "ios" | "android" | "desktop";

export const usePWAInstall = () => {
  const [mounted, setMounted] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);

    // Detect Platform
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafariMac =
      navigator.userAgent.includes("Mac") && navigator.maxTouchPoints > 1;
    const isAndroid = /Android/i.test(navigator.userAgent);

    if (isIOSDevice || isSafariMac) setPlatform("ios");
    else if (isAndroid) setPlatform("android");

    // Detect Standalone Mode
    const isStandaloneDisplay = window.matchMedia(
      "(display-mode: standalone)"
    ).matches;
    const isIOSStandalone =
      (navigator as NavigatorStandalone).standalone === true;
    setIsStandalone(isStandaloneDisplay || isIOSStandalone);

    // Set up Install Prompt listener
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
    };
  }, []);

  const triggerInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      setDeferredPrompt(null);
    } catch (error) {
      console.error("Error showing install prompt:", error);
    }
  }, [deferredPrompt]);

  const canInstall = useMemo(() => !!deferredPrompt, [deferredPrompt]);
  const isMobile = useMemo(
    () => platform === "ios" || platform === "android",
    [platform]
  );
  
  const showInstallGuidance = useMemo(
    () => !isStandalone && isMobile && !canInstall,
    [isStandalone, isMobile, canInstall]
  );

  return {
    mounted,
    platform,
    isStandalone,
    isMobile,
    canInstall,
    showInstallGuidance,
    triggerInstall,
  };
};