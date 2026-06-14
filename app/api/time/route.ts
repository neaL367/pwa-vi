import { NextResponse } from "next/server";
import { sendNotification } from "@/lib/notifications";
import { MILLISECONDS, RELEASE_DATE } from "@/lib/constants";

// GTA VI launches at LOCAL midnight Nov 19 in each timezone.
// UTC-12: Nov 19 00:00 local = Nov 18 12:00 UTC  (earliest)
// UTC+14: Nov 19 00:00 local = Nov 19 14:00 UTC  (latest)
const EARLIEST_RELEASE_UTC =
  new Date(`${RELEASE_DATE}T12:00:00Z`).getTime() - MILLISECONDS.DAY;
const LATEST_RELEASE_UTC = new Date(
  `${RELEASE_DATE}T14:00:00Z`
).getTime();

const TOLERANCE = 10 * MILLISECONDS.MINUTE;

// Convert a release-relative UTC timestamp to a calendar-adjusted one.
// Month milestones use calendar date math (e.g. "5 months before Nov 19" = Jun 19),
// so the API fires at the same time the client shows.
function getMilestoneUTC(releaseUtc: number, ms: number): number {
  if (ms >= 28 * MILLISECONDS.DAY) {
    const months = Math.round(ms / MILLISECONDS.MONTH);
    const d = new Date(releaseUtc);
    d.setUTCMonth(d.getUTCMonth() - months);
    return d.getTime();
  }
  return releaseUtc - ms;
}

function createRange(
  start: number,
  end: number,
  unitMs: number,
  unitLabel: string
) {
  return Array.from({ length: start - end + 1 }, (_, i) => {
    const value = start - i;
    return {
      label: `${value} ${unitLabel}${value > 1 ? "s" : ""} to go!`,
      ms: value * unitMs,
    };
  });
}

const MILESTONES = [
  ...createRange(10, 2, MILLISECONDS.MONTH, "Month"),
  ...createRange(4, 2, MILLISECONDS.WEEK, "Week"),
  ...createRange(7, 2, MILLISECONDS.DAY, "Day"),
  { label: "24 Hours left!", ms: 24 * MILLISECONDS.HOUR },
  { label: "12 Hours left!", ms: 12 * MILLISECONDS.HOUR },
  { label: "6 Hours left!", ms: 6 * MILLISECONDS.HOUR },
  { label: "3 Hours left!", ms: 3 * MILLISECONDS.HOUR },
  { label: "60 Minutes left!", ms: 60 * MILLISECONDS.MINUTE },
  { label: "30 Minutes left!", ms: 30 * MILLISECONDS.MINUTE },
  { label: "15 Minutes left!", ms: 15 * MILLISECONDS.MINUTE },
  { label: "5 Minutes left!", ms: 5 * MILLISECONDS.MINUTE },
  { label: "1 Minute left!", ms: 1 * MILLISECONDS.MINUTE },
  { label: "GTA VI RELEASED NOW!", ms: 0 },
];

// Check if ANY timezone is currently at this milestone.
function isMilestoneActive(milestoneMs: number, now: number): boolean {
  const earliestFire = getMilestoneUTC(EARLIEST_RELEASE_UTC, milestoneMs);
  const latestFire = getMilestoneUTC(LATEST_RELEASE_UTC, milestoneMs);
  return now >= earliestFire && now <= latestFire + TOLERANCE;
}

// Find the next milestone that hasn't fired yet.
function getNextMilestone(now: number) {
  for (const m of MILESTONES) {
    const earliestFire = getMilestoneUTC(EARLIEST_RELEASE_UTC, m.ms);
    const latestFire = getMilestoneUTC(LATEST_RELEASE_UTC, m.ms);
    const firesAt = earliestFire + (latestFire - earliestFire) / 2;
    if (firesAt > now) {
      return { label: m.label, firesAt };
    }
  }
  return null;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const active = MILESTONES.find((m) => isMilestoneActive(m.ms, now));

  if (active) {
    const result = await sendNotification(active.label, null);
    return NextResponse.json({
      triggered: true,
      milestone: active.label,
      result,
    });
  }

  return NextResponse.json({
    triggered: false,
    timeLeft: LATEST_RELEASE_UTC - now,
    nextMilestone: getNextMilestone(now),
  });
}
