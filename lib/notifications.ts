import webpush from "web-push";
import { after } from "next/server";
import { Prisma } from "@prisma/client";
import * as v from "valibot";
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

const subscriptionSchema = v.object({
  endpoint: v.pipe(v.string(), v.minLength(1)),
  keys: v.object({
    p256dh: v.string(),
    auth: v.string(),
  }),
});

export function isValidSubscription(sub: unknown): sub is PushSubscriptionJSON {
  return v.safeParse(subscriptionSchema, sub).success;
}

export async function saveSubscription(sub: PushSubscriptionJSON) {
  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    update: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    create: { endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
  });
}

export async function deleteSubscription(endpoint: string) {
  // deleteMany instead of delete: no-ops silently if the record is already gone.
  // Prevents a P2025 crash when two concurrent broadcast threads both try to
  // clean up the same expired subscription.
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
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
    await deleteSubscription(endpoint);
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
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      // Unique-constraint violation — milestone already sent, skip gracefully.
      return { success: false, error: "Milestone already sent recently" };
    }
    // Anything else is a real DB problem (connection failure, schema mismatch, etc.).
    console.error("Database error while locking milestone:", error);
    return { success: false, error: "Internal database error" };
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
