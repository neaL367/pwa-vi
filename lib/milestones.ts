import { MILLISECONDS, RELEASE_DATE } from "@/lib/constants";

export const CANONICAL_TIME_ZONE = "Pacific/Kiritimati";
export const MILESTONE_TOLERANCE = 90_000;

export type MilestoneKind = "months" | "days" | "fixed";

export type MilestoneDefinition = {
  key: string;
  label: string;
  value: number;
  kind: MilestoneKind;
};

export type ScheduledMilestone = MilestoneDefinition & {
  firesAt: number;
};

const MILESTONE_DEFINITIONS: MilestoneDefinition[] = [
  ...createRange(10, 2, "months", "Month"),
  ...createRange(4, 2, "days", "Week", 7),
  ...createRange(7, 2, "days", "Day"),
  { key: "24-hours", label: "24 Hours left!", value: 24 * MILLISECONDS.HOUR, kind: "fixed" },
  { key: "12-hours", label: "12 Hours left!", value: 12 * MILLISECONDS.HOUR, kind: "fixed" },
  { key: "6-hours", label: "6 Hours left!", value: 6 * MILLISECONDS.HOUR, kind: "fixed" },
  { key: "3-hours", label: "3 Hours left!", value: 3 * MILLISECONDS.HOUR, kind: "fixed" },
  { key: "60-minutes", label: "60 Minutes left!", value: 60 * MILLISECONDS.MINUTE, kind: "fixed" },
  { key: "30-minutes", label: "30 Minutes left!", value: 30 * MILLISECONDS.MINUTE, kind: "fixed" },
  { key: "15-minutes", label: "15 Minutes left!", value: 15 * MILLISECONDS.MINUTE, kind: "fixed" },
  { key: "5-minutes", label: "5 Minutes left!", value: 5 * MILLISECONDS.MINUTE, kind: "fixed" },
  { key: "1-minute", label: "1 Minute left!", value: 1 * MILLISECONDS.MINUTE, kind: "fixed" },
  { key: "release", label: "GTA VI RELEASED NOW!", value: 0, kind: "fixed" },
];

function createRange(
  start: number,
  end: number,
  kind: MilestoneKind,
  unitLabel: string,
  multiplier = 1,
): MilestoneDefinition[] {
  return Array.from({ length: start - end + 1 }, (_, index) => {
    const value = start - index;
    const plural = value === 1 ? "" : "s";
    return {
      key: `${value}-${unitLabel.toLowerCase()}${plural}`,
      label: `${value} ${unitLabel}${plural} to go!`,
      value: value * multiplier,
      kind,
    };
  });
}

type CalendarParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function parseReleaseDate(): CalendarParts {
  const [year, month, day] = RELEASE_DATE.split("-").map(Number);
  return { year, month, day, hour: 0, minute: 0, second: 0 };
}

function formatterFor(timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    calendar: "iso8601",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getCalendarParts(timestamp: number, timeZone: string): CalendarParts {
  const parts = formatterFor(timeZone).formatToParts(new Date(timestamp));
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<string, number>;

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

/** Return false instead of throwing for an invalid browser-provided timezone. */
export function isValidTimeZone(timeZone: unknown): timeZone is string {
  if (typeof timeZone !== "string" || timeZone.length === 0) return false;
  try {
    formatterFor(timeZone);
    return true;
  } catch {
    return false;
  }
}

export function normalizeTimeZone(timeZone: unknown): string {
  return isValidTimeZone(timeZone) ? timeZone : "UTC";
}

function wallClockTimestamp(parts: CalendarParts): number {
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
}

/** Convert a local wall-clock date in an IANA timezone into a UTC timestamp. */
function fromTimeZone(parts: CalendarParts, timeZone: string): number {
  const wallClock = wallClockTimestamp(parts);
  let candidate = wallClock;

  // Iteration accounts for the timezone offset and DST at the target date.
  for (let index = 0; index < 4; index++) {
    const actualWallClock = wallClockTimestamp(getCalendarParts(candidate, timeZone));
    candidate += wallClock - actualWallClock;
  }

  return candidate;
}

function addCalendarUnits(
  parts: CalendarParts,
  unit: "months" | "days",
  amount: number,
): CalendarParts {
  const date = new Date(wallClockTimestamp(parts));

  if (unit === "months") {
    // Set the day first so dates near the end of a month cannot overflow
    // while changing the month.
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + amount);
    date.setUTCDate(parts.day);
  } else {
    date.setUTCDate(date.getUTCDate() + amount);
  }

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

export function getReleaseAtTimeZone(timeZone: string): number {
  return fromTimeZone(parseReleaseDate(), normalizeTimeZone(timeZone));
}

export function getMilestonesForTimeZone(timeZone: string): ScheduledMilestone[] {
  const normalizedTimeZone = normalizeTimeZone(timeZone);
  const releaseAt = getReleaseAtTimeZone(normalizedTimeZone);
  const releaseLocal = parseReleaseDate();

  return MILESTONE_DEFINITIONS.map((milestone) => {
    let firesAt: number;

    if (milestone.kind === "months") {
      firesAt = fromTimeZone(
        addCalendarUnits(releaseLocal, "months", -milestone.value),
        normalizedTimeZone,
      );
    } else if (milestone.kind === "days") {
      firesAt = fromTimeZone(
        addCalendarUnits(releaseLocal, "days", -milestone.value),
        normalizedTimeZone,
      );
    } else {
      firesAt = releaseAt - milestone.value;
    }

    return { ...milestone, firesAt };
  });
}

export function getDueMilestones(
  timeZone: string,
  now = Date.now(),
): ScheduledMilestone[] {
  return getMilestonesForTimeZone(timeZone)
    .filter(
      (milestone) =>
        now >= milestone.firesAt &&
        now <= milestone.firesAt + MILESTONE_TOLERANCE,
    )
    .sort((a, b) => a.firesAt - b.firesAt);
}

export function getNextMilestone(
  timeZone = CANONICAL_TIME_ZONE,
  now = Date.now(),
): ScheduledMilestone | null {
  return (
    getMilestonesForTimeZone(timeZone).find((milestone) => milestone.firesAt > now) ??
    null
  );
}
