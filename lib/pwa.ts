export const isNotificationSupported = (): boolean =>
  typeof window !== "undefined" && "Notification" in window;

export const isPushSupported = (): boolean =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window;

export const getNotificationPermission = (): NotificationPermission => {
  return isNotificationSupported() ? Notification.permission : "default";
};

export const urlBase64ToUint8Array = (base64String: string): BufferSource => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base);
  const outputArray = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    outputArray[i] = raw.charCodeAt(i);
  }
  return outputArray;
};
