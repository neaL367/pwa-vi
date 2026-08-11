import { NextResponse } from "next/server";
import { processDueMilestones } from "@/lib/notifications";
import {
  CANONICAL_TIME_ZONE,
  getNextMilestone,
} from "@/lib/milestones";
import {
  RELEASE_AT_UTC,
  RELEASE_DATE,
} from "@/lib/constants";

// GTA VI is expected to launch at local midnight on November 19. The
// canonical status response uses UTC+14, the first timezone to reach that
// date. Individual push deliveries are scheduled in each subscription's
// stored IANA timezone.
const LATEST_RELEASE_UTC = new Date(`${RELEASE_DATE}T12:00:00Z`).getTime();

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // Fail closed if production is missing its secret. Without this guard,
  // `Bearer undefined` could become the accepted credential.
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();

  try {
    const result = await processDueMilestones(now);
    const nextMilestone = getNextMilestone(CANONICAL_TIME_ZONE, now);

    return NextResponse.json({
      triggered: result.claimed > 0,
      result,
      // This status countdown follows the canonical UTC+14 schedule. Push
      // notifications themselves use each subscription's local timezone.
      timeLeft: RELEASE_AT_UTC - now,
      latestReleaseAt: LATEST_RELEASE_UTC,
      nextMilestone: nextMilestone
        ? { label: nextMilestone.label, firesAt: nextMilestone.firesAt }
        : null,
    });
  } catch (error) {
    console.error("Milestone worker failed:", error);
    return NextResponse.json(
      { error: "Milestone worker failed" },
      { status: 500 },
    );
  }
}
