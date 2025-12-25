"use server";

import webpush from "web-push";
import { sql } from "@/lib/neon";

webpush.setVapidDetails(
  "mailto:your-email@example.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

type PushSubscriptionJSON = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

type WebPushError = {
  statusCode: number;
  headers?: Record<string, string>;
  body?: string;
};

type ServiceResponse = {
  success: boolean;
  message?: string;
  error?: string;
};


async function saveSubscriptionToDb(sub: PushSubscriptionJSON) {
  await sql`
    INSERT INTO "pushsubscription" (endpoint, p256dh, auth)
    VALUES (${sub.endpoint}, ${sub.keys.p256dh}, ${sub.keys.auth})
    ON CONFLICT (endpoint)
    DO UPDATE SET
      p256dh = ${sub.keys.p256dh},
      auth = ${sub.keys.auth}
  `;
}

async function deleteSubscriptionFromDb(endpoint: string) {
  await sql`
    DELETE FROM "pushsubscription"
    WHERE endpoint = ${endpoint}
  `;
}

async function getAllSubscriptions() {
  const rows = await sql`SELECT endpoint, p256dh, auth FROM "pushsubscription"`;
  return rows.map((row) => ({
    endpoint: row.endpoint,
    keys: { p256dh: row.p256dh, auth: row.auth },
  })) as PushSubscriptionJSON[];
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
  if (typeof error === "object" && error !== null && "statusCode" in error) {
    const err = error as WebPushError;
    if (err.statusCode === 410 || err.statusCode === 404) {
      console.log("Cleaning up expired:", endpoint);
      await deleteSubscriptionFromDb(endpoint);
      return { success: false, error: "Expired" };
    }
  }
  console.error("Push failed:", error);
  return { success: false, error: "Failed" };
}


export async function subscribeUser(sub: PushSubscriptionJSON) {
  await saveSubscriptionToDb(sub);
  return { success: true };
}

export async function unsubscribeUser(sub: PushSubscriptionJSON) {
  if (!sub?.endpoint) return { success: false, error: "No endpoint" };
  await deleteSubscriptionFromDb(sub.endpoint);
  return { success: true };
}

export async function sendNotification(
  message: string,
  targetSub: PushSubscriptionJSON | null
): Promise<ServiceResponse> {
  const payload = createPayload(message);

  // 1. Send to Single User for test
  if (targetSub) {
    return await triggerWebPush(targetSub, payload);
  }

  // 2. Broadcast to All
  try {
    const subscriptions = await getAllSubscriptions();

    if (subscriptions.length === 0) {
      return { success: false, error: "No subscribers" };
    }

    const results = await Promise.allSettled(
      subscriptions.map((s) => triggerWebPush(s, payload))
    );

    const successCount = results.filter(
      (r) => r.status === "fulfilled" && r.value.success
    ).length;

    return {
      success: true,
      message: `Sent to ${successCount} of ${subscriptions.length}`,
    };
  } catch (error) {
    console.error("Broadcast failed:", error);
    return { success: false, error: "Broadcast failed" };
  }
}
