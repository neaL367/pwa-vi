import webpush from "web-push";
import { Prisma } from "@prisma/client";
import * as v from "valibot";
import { prisma } from "@/lib/prisma";
import {
  getDueMilestones,
  getMilestonesForTimeZone,
  normalizeTimeZone,
  type ScheduledMilestone,
} from "@/lib/milestones";

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
if (!publicKey || !privateKey) {
  throw new Error("VAPID keys not configured");
}
webpush.setVapidDetails("https://pwa-vi.vercel.app", publicKey, privateKey);

export type PushSubscriptionJSON = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  timeZone?: string;
};

type StoredSubscription = PushSubscriptionJSON & {
  timeZone: string;
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
    p256dh: v.pipe(v.string(), v.minLength(1)),
    auth: v.pipe(v.string(), v.minLength(1)),
  }),
  timeZone: v.optional(v.string()),
});

export function isValidSubscription(sub: unknown): sub is PushSubscriptionJSON {
  return v.safeParse(subscriptionSchema, sub).success;
}

export async function saveSubscription(sub: PushSubscriptionJSON) {
  const timeZone = normalizeTimeZone(sub.timeZone);

  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    update: {
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      timeZone,
    },
    create: {
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      timeZone,
    },
  });
}

export async function deleteSubscription(endpoint: string) {
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
}

async function getAllSubscriptions(): Promise<StoredSubscription[]> {
  const rows = await prisma.pushSubscription.findMany({
    select: { endpoint: true, p256dh: true, auth: true, timeZone: true },
  });

  return rows.map((row) => ({
    endpoint: row.endpoint,
    keys: { p256dh: row.p256dh, auth: row.auth },
    timeZone: normalizeTimeZone(row.timeZone),
  }));
}

function createPayload(message: string) {
  return JSON.stringify({
    title: "GTA VI Countdown",
    body: message,
    icon: "/icon.png",
  });
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

  if (statusCode === 404 || statusCode === 410) {
    await deleteSubscription(endpoint);
    return { success: false, error: "Expired" };
  }

  if (statusCode === 400 || statusCode === 401 || statusCode === 403) {
    await deleteSubscription(endpoint);
    return { success: false, error: "Invalid subscription" };
  }

  // Retain the subscription for transient provider failures. The delivery
  // record will make a later cron invocation retry it.
  console.error("Push failed:", error);
  return { success: false, error: statusCode === 429 ? "Rate limited" : "Failed" };
}

async function triggerWebPush(
  sub: PushSubscriptionJSON,
  message: string,
) {
  try {
    await webpush.sendNotification(sub, createPayload(message));
    return { success: true, error: undefined };
  } catch (error) {
    return handleWebPushError(error, sub.endpoint);
  }
}

const DELIVERY_LEASE_MS = 2 * 60_000;
const RETRY_DELAY_MS = 60_000;

async function claimDelivery(
  milestone: ScheduledMilestone,
  endpoint: string,
  now: Date,
): Promise<boolean> {
  try {
    await prisma.milestoneDelivery.create({
      data: {
        milestone: milestone.key,
        endpoint,
        status: "processing",
        attempts: 1,
        lockedAt: now,
      },
    });
    return true;
  } catch (error) {
    if (
      !(
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
    ) {
      throw error;
    }
  }

  const staleLock = new Date(now.getTime() - DELIVERY_LEASE_MS);
  const claimed = await prisma.milestoneDelivery.updateMany({
    where: {
      milestone: milestone.key,
      endpoint,
      OR: [
        { status: "failed", nextAttemptAt: { lte: now } },
        { status: "processing", lockedAt: { lt: staleLock } },
      ],
    },
    data: {
      status: "processing",
      attempts: { increment: 1 },
      lockedAt: now,
      nextAttemptAt: null,
      lastError: null,
    },
  });

  return claimed.count === 1;
}

async function markDeliverySent(milestone: string, endpoint: string, now: Date) {
  await prisma.milestoneDelivery.updateMany({
    where: { milestone, endpoint, status: "processing" },
    data: { status: "sent", sentAt: now, lockedAt: null },
  });
}

async function markDeliveryFailed(
  milestone: string,
  endpoint: string,
  error: string,
  now: Date,
) {
  await prisma.milestoneDelivery.updateMany({
    where: { milestone, endpoint, status: "processing" },
    data: {
      status: "failed",
      nextAttemptAt: new Date(now.getTime() + RETRY_DELAY_MS),
      lastError: error,
      lockedAt: null,
    },
  });
}

async function markDeliveryDiscarded(milestone: string, endpoint: string, now: Date) {
  await prisma.milestoneDelivery.updateMany({
    where: { milestone, endpoint, status: "processing" },
    data: { status: "discarded", lockedAt: null, lastError: "Invalid subscription" },
  });

  // Keep the timestamp update separate from the status update so discarded
  // records remain auditable without being eligible for another claim.
  await prisma.milestoneDelivery.updateMany({
    where: { milestone, endpoint, status: "discarded", sentAt: null },
    data: { sentAt: now },
  });
}

export type NotificationRunResult = {
  due: number;
  claimed: number;
  sent: number;
  failed: number;
};

/**
 * Process local-time milestones for every subscription. Delivery rows are
 * claimed atomically, so overlapping cron invocations do not duplicate pushes.
 */
export async function processDueMilestones(
  nowTimestamp = Date.now(),
): Promise<NotificationRunResult> {
  const subscriptions = await getAllSubscriptions();
  const now = new Date(nowTimestamp);
  const retryRows = await prisma.milestoneDelivery.findMany({
    where: {
      status: "failed",
      nextAttemptAt: { lte: now },
    },
    select: {
      milestone: true,
      endpoint: true,
    },
  });
  const retryKeys = new Map<string, Set<string>>();
  for (const row of retryRows) {
    const keys = retryKeys.get(row.endpoint) ?? new Set<string>();
    keys.add(row.milestone);
    retryKeys.set(row.endpoint, keys);
  }
  const result: NotificationRunResult = {
    due: 0,
    claimed: 0,
    sent: 0,
    failed: 0,
  };

  for (const subscription of subscriptions) {
    const dueMilestones = getDueMilestones(subscription.timeZone, nowTimestamp);
    const retryMilestoneKeys = retryKeys.get(subscription.endpoint) ?? new Set<string>();
    const retryMilestones = getMilestonesForTimeZone(subscription.timeZone).filter(
      (milestone) => retryMilestoneKeys.has(milestone.key),
    );

    // A retry must not depend on the original 90-second scheduling window.
    // Reconstruct its definition from the subscriber's timezone instead.

    const candidates = [
      ...dueMilestones,
      ...retryMilestones.filter(
        (retry) => !dueMilestones.some((due) => due.key === retry.key),
      ),
    ].sort((a, b) => a.firesAt - b.firesAt);
    result.due += candidates.length;

    for (const milestone of candidates) {
      const claimed = await claimDelivery(milestone, subscription.endpoint, now);
      if (!claimed) continue;
      result.claimed++;

      const pushResult = await triggerWebPush(subscription, milestone.label);
      if (pushResult.success || pushResult.error === "Expired") {
        await markDeliverySent(milestone.key, subscription.endpoint, now);
        if (pushResult.success) result.sent++;
      } else if (pushResult.error === "Invalid subscription") {
        await markDeliveryDiscarded(milestone.key, subscription.endpoint, now);
      } else {
        await markDeliveryFailed(
          milestone.key,
          subscription.endpoint,
          pushResult.error ?? "Failed",
          now,
        );
        result.failed++;
      }
    }
  }

  return result;
}
