import webpush from "web-push";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
if (!publicKey || !privateKey) {
  throw new Error("VAPID keys not configured");
}
webpush.setVapidDetails("https://pwa-vi.vercel.app", publicKey, privateKey);

export type PushSubscriptionJSON = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

type WebPushError = {
  statusCode: number;
  headers?: Record<string, string>;
  body?: string;
};

export type ServiceResponse = {
  success: boolean;
  message?: string;
  error?: string;
};

export function isValidSubscription(sub: unknown): sub is PushSubscriptionJSON {
  if (typeof sub !== "object" || sub === null) return false;
  const obj = sub as Record<string, unknown>;
  if (typeof obj.endpoint !== "string" || !obj.endpoint) return false;
  if (typeof obj.keys !== "object" || obj.keys === null) return false;
  const keys = obj.keys as Record<string, unknown>;
  return typeof keys.p256dh === "string" && typeof keys.auth === "string";
}

export async function saveSubscriptionToDb(sub: PushSubscriptionJSON) {
  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    update: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    create: { endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
  });
}

export async function deleteSubscriptionFromDb(endpoint: string) {
  await prisma.pushSubscription.delete({ where: { endpoint } });
}

async function getAllSubscriptions(): Promise<PushSubscriptionJSON[]> {
  const rows = await prisma.pushSubscription.findMany({
    select: { endpoint: true, p256dh: true, auth: true },
  });
  return rows.map((row) => ({
    endpoint: row.endpoint,
    keys: { p256dh: row.p256dh, auth: row.auth },
  }));
}

function createPayload(message: string) {
  return JSON.stringify({
    title: "GTA VI Countdown",
    body: message,
    icon: "/icon.png",
  });
}

async function triggerWebPush(sub: PushSubscriptionJSON, payload: string) {
  try {
    await webpush.sendNotification(sub, payload);
    return { success: true };
  } catch (error) {
    return handleWebPushError(error, sub.endpoint);
  }
}

async function handleWebPushError(error: unknown, endpoint: string) {
  if (
    !error ||
    typeof error !== "object" ||
    !("statusCode" in error)
  ) {
    console.error("Push failed:", error);
    return { success: false, error: "Failed" };
  }

  const { statusCode } = error as WebPushError;
  if (statusCode === 410 || statusCode === 404) {
    await deleteSubscriptionFromDb(endpoint);
    return { success: false, error: "Expired" };
  }

  console.error("Push failed:", error);
  return { success: false, error: "Failed" };
}

export async function sendNotification(
  message: string,
  targetSub: PushSubscriptionJSON | null
): Promise<ServiceResponse> {
  if (!message) return { success: false, error: "Invalid message" };

  const payload = createPayload(message);

  if (targetSub) {
    if (!isValidSubscription(targetSub)) {
      return { success: false, error: "Invalid subscription" };
    }
    return await triggerWebPush(targetSub, payload);
  }

  try {
    await prisma.sentMilestone.create({ data: { milestone: message } });
  } catch {
    return { success: false, error: "Milestone already sent recently" };
  }

  after(async () => {
    try {
      const subscriptions = await getAllSubscriptions();
      if (subscriptions.length === 0) return;

      const results = await Promise.allSettled(
        subscriptions.map((s) => triggerWebPush(s, payload))
      );

      const successCount = results.filter(
        (r) => r.status === "fulfilled" && r.value.success
      ).length;

      console.warn(`[BROADCAST] ${successCount}/${subscriptions.length} success for: ${message}`);
    } catch (error) {
      console.error("Background broadcast failed:", error);
    }
  });

  return {
    success: true,
    message: "Broadcast scheduled in background",
  };
}
