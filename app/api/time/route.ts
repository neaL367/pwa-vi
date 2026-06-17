import { NextResponse } from "next/server";
import { sendNotification } from "@/lib/notifications";
import { MILLISECONDS, RELEASE_DATE } from "@/lib/constants";

// GTA VI launches at LOCAL midnight Nov 19 in each timezone.
// The global release window spans:
//   UTC+14 (earliest, e.g. Kiribati) : Nov 19 00:00 local = Nov 18 10:00 UTC
//   UTC-12 (latest,  e.g. Baker Is.) : Nov 19 00:00 local = Nov 19 12:00 UTC
//
// Nov 18 10:00 UTC = Nov 19 00:00 UTC+14  →  subtract 14 h from Nov 19 00:00 UTC
//                  = `${RELEASE_DATE}T00:00:00Z` - 14 h
//                  = `${RELEASE_DATE}T10:00:00Z` - 24 h  (equivalent, matches the literal below)
const EARLIEST_RELEASE_UTC =
  new Date(`${RELEASE_DATE}T10:00:00Z`).getTime() - MILLISECONDS.DAY;

// Nov 19 12:00 UTC = Nov 19 00:00 UTC-12
const LATEST_RELEASE_UTC = new Date(`${RELEASE_DATE}T12:00:00Z`).getTime();

const TOLERANCE = 90_000; // 90s — guarantees catch with 1-min cron + drift margin

// Convert a release-relative UTC timestamp to a calendar-adjusted one.
// Month milestones use calendar date math (e.g. "5 months before Nov 19" = Jun 19),
// so the API fires at the same time the client shows.
function getMilestoneUTC(releaseUtc: number, ms: number): number {
  if (ms > 28 * MILLISECONDS.DAY) {
    const months = Math.round(ms / MILLISECONDS.MONTH_APPROX);
    const d = new Date(releaseUtc);
    d.setUTCMonth(d.getUTCMonth() - months);
    return d.getTime();
  }
  return releaseUtc - ms;
}

// Builds a list of { label, ms } milestone descriptors.
// `ms` is the time-before-release value; for month milestones this uses
// MONTH_APPROX as a rough input — getMilestoneUTC() corrects it to exact
// calendar math (e.g. "5 months before Nov 19" → Jun 19 00:00 UTC).
function createRange(
  start: number,
  end: number,
  unitMs: number,
  unitLabel: string,
) {
  return Array.from({ length: start - end + 1 }, (_, i) => {
    const value = start - i;
    return {
      label: `${value} ${unitLabel}${value > 1 ? "s" : ""} to go!`,
      ms: value * unitMs,
    };
  });
}

// Pre-computed at module init to avoid Date math on every cron hit.
// All milestones fire relative to EARLIEST_RELEASE_UTC (UTC+14 midnight) so
// the first person on Earth who can play gets each notification on time.
// firesAt is the authoritative fire time — getMilestoneUTC() applies exact
// calendar math for month milestones and simple subtraction for shorter ones.
const MILESTONES = [
  ...createRange(10, 2, MILLISECONDS.MONTH_APPROX, "Month"), // firesAt corrected by getMilestoneUTC
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
].map((m) => ({
  ...m,
  firesAt: getMilestoneUTC(EARLIEST_RELEASE_UTC, m.ms), // source of truth for scheduling
}));

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();

  // Iterate in reverse so the closest-to-release milestone wins when
  // adjacent tolerance windows overlap (e.g. "1 Minute" and "Released").
  // Already-sent milestones are skipped via the SentMilestone unique constraint.
  for (let i = MILESTONES.length - 1; i >= 0; i--) {
    const m = MILESTONES[i];
    if (now >= m.firesAt && now <= m.firesAt + TOLERANCE) {
      const result = await sendNotification(m.label, null);
      if (result.success) {
        return NextResponse.json({
          triggered: true,
          milestone: m.label,
          result,
        });
      }
      // Already sent — continue checking earlier milestones
    }
  }

  // Find next milestone that hasn't fired yet.
  const nextMilestone = MILESTONES.find((m) => m.firesAt > now) ?? null;

  return NextResponse.json({
    triggered: false,
    timeLeft: LATEST_RELEASE_UTC - now,
    nextMilestone: nextMilestone
      ? { label: nextMilestone.label, firesAt: nextMilestone.firesAt }
      : null,
  });
}
