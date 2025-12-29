import { NextResponse } from "next/server";
import { sendNotification } from "../../actions";

const TARGET_DATE = new Date("2026-11-19T00:00:00Z");

const MILLISECONDS = {
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
  MONTH: 30.44 * 24 * 60 * 60 * 1000,
};

function createRange(
  start: number,
  end: number,
  unitMs: number,
  unitLabel: string
) {
  // Create an array of length (start - end + 1)
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

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const now = new Date().getTime();
  const target = TARGET_DATE.getTime();
  const timeLeft = target - now;

  const TOLERANCE = 60 * 1000; // 1 minute tolerance

  const activeMilestone = MILESTONES.find((m) => {
    const diff = Math.abs(timeLeft - m.ms);
    return diff < TOLERANCE;
  });

  if (activeMilestone) {
    console.log(`Triggering notification: ${activeMilestone.label}`);

    // passing 'null' as the subscription triggers the broadcast to all users
    const result = await sendNotification(activeMilestone.label, null);

    return NextResponse.json({
      triggered: true,
      milestone: activeMilestone.label,
      result,
    });
  }

  return NextResponse.json({ triggered: false, timeLeft });
}
