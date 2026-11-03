/**
 * The `schedule` global: the agenda and speaker pages' view model, built
 * from the `agenda` and `speakers` concepts with their `patches` applied
 * (./program.ts; shapes in ./schema/concepts.ts). The concepts hold the
 * facts; this derives what only a build can: the timetable grid, which
 * rooms are tracks, which speakers are listed, the back-links from a
 * speaker to their talks, bylines, initials, paragraphs. Where the facts
 * came from is not its concern.
 *
 * Called by the plugin (./mod.ts) on `beforeRender`, after the schema has
 * validated the concepts. The one thing it needs beyond the data is whether
 * a photo exists (`ScheduleIO`); a missing file fails the build.
 *
 * The timetable (`Row`, `Placed`) has one row per distinct start time and
 * one column per track; an item covers its own time range in its own track,
 * so tracks need not run in lockstep, and a `plenary` item spans them all.
 *
 * Times are event-local strings without an offset and are sliced as text,
 * never parsed into Dates: CI runs in UTC and would shift them.
 */

import type {
  Agenda,
  AgendaBreak,
  AgendaSession,
  Patches,
  SpeakerRecord,
  Speakers,
} from "./schema/concepts.ts";
import { applyPatches } from "./program.ts";

/** How `buildSchedule()` reaches the instance's source tree, for the photo check. */
export interface ScheduleIO {
  /** Whether a site path ("/assets/img/speakers/x.webp") is a file under `src/`. */
  exists(path: string): boolean;
}

// ---------------------------------------------------------------------------
// The view model

/** Just enough about a talk to link to it from a speaker profile. */
export interface SessionRef {
  id: string;
  title: string;
  /** "2025-04-24", or null until the talk is on the timetable. */
  date: string | null;
  /** "09:00", or null until scheduled. */
  start: string | null;
  end: string | null;
  room: string | null;
  /** "Keynote" | "Lightning talk", otherwise null; see `formatOf`. */
  format: string | null;
  /** The talk is off; it keeps its slot and is marked as such. */
  cancelled: boolean;
}

export interface Speaker {
  id: string;
  name: string;
  /** Two letters for the avatar fallback, e.g. "KN". */
  initials: string;
  /** Job title, or null. */
  title: string | null;
  company: string | null;
  /** Shown when title and company are both missing. */
  tagline: string | null;
  /** One-line "Title, Company" (or the tagline as a fallback), or null. */
  byline: string | null;
  /** Network -> URL, the concept's `links` map in the schema's canonical key order; empty when none. */
  links: Record<string, string>;
  /** Bio split into paragraphs; empty if none. */
  bio: string[];
  /** Photo URL, or null; see the `avatar` component. */
  avatar: string | null;
  /** True when at least one of the speaker's talks that is on is a keynote. */
  isKeynote: boolean;
  /** The speaker's talks, cancelled ones included (marked), by time. */
  sessions: SessionRef[];
}

export interface Session extends SessionRef {
  /** Abstract (or a break's description) split into paragraphs; empty if none. */
  paragraphs: string[];
  /** Event-local ISO timestamps for <time datetime>; null until scheduled. */
  startsAt: string | null;
  endsAt: string | null;
  minutes: number | null;
  /** Everyone attends: spans every track. */
  isPlenary: boolean;
  /** A break (registration, coffee, lunch, ...): no dialog, drawn as a strip. */
  isBreak: boolean;
  /** Font Awesome icon for breaks, else null. */
  icon: string | null;
  speakers: Speaker[];
}

/** An item on the day's grid: its track column, and the rows it covers (every later row that starts before it ends). */
export interface Placed {
  session: Session;
  /** 0-based index into `rooms`, or null when the item spans every track (`plenary`, or no room). */
  track: number | null;
  /** Number of rows the item covers; at least 1. */
  rowSpan: number;
}

export interface Row {
  /** 0-based position of the row in the day. */
  index: number;
  /** "12:10" */
  start: string;
  /** "2025-04-24T12:10:00" */
  startsAt: string;
  /** Items starting at this time, ordered by track (spanning ones first). */
  sessions: Placed[];
}

export interface Day {
  /** "2025-04-24" */
  date: string;
  /** "Thursday, 24 April 2025" */
  label: string;
  /** One row per distinct start time, in order. */
  rows: Row[];
}

/** The `schedule` global as the templates see it. */
export interface Schedule {
  /** Track names in column order; empty until something is on the timetable. */
  rooms: string[];
  days: Day[];
  /** Talks, scheduled or not, cancelled or not; the agenda renders a dialog for each. */
  sessions: Session[];
  /** Speakers with at least one talk that is on, sorted by name. */
  speakers: Speaker[];
}

/** What `buildSchedule()` returns with neither concept present. */
export const emptySchedule: Schedule = {
  rooms: [],
  days: [],
  sessions: [],
  speakers: [],
};

// ---------------------------------------------------------------------------
// Helpers

/** Normalise line endings, trim, and split on blank lines into paragraphs. */
function paragraphs(text: string | undefined): string[] {
  if (!text) return [];
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Code-unit order, for timestamps: "~" (no time yet) sorts after every digit, which a locale compare does not promise. */
const cmp = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

/** "2030-05-15T09:00" -> "2030-05-15T09:00:00", so every timestamp has the same shape. */
function timestamp(local: string): string {
  return local.length === 16 ? `${local}:00` : local;
}

/** "2025-04-24T09:00:00" -> "09:00" */
function clock(iso: string): string {
  return iso.slice(11, 16);
}

/** Minutes between two event-local timestamps on the same day. */
function minutesBetween(startsAt: string, endsAt: string): number {
  const [sh, sm] = clock(startsAt).split(":").map(Number);
  const [eh, em] = clock(endsAt).split(":").map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

const dayLabel = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** The first letters of the first two words: "Márk Sági-Kazár" -> "MS". */
function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n.charAt(0))
    .join("")
    .toUpperCase();
}

/** "Keynote" from the flag; "Lightning talk" for a plenary talk of ten minutes or less. */
function formatOf(
  item: { keynote?: boolean; plenary?: boolean },
  minutes: number | null,
): string | null {
  if (item.keynote) return "Keynote";
  if (item.plenary && minutes !== null && minutes <= 10) return "Lightning talk";
  return null;
}

/** Pick an icon for a break from its title, unless the data names one. */
function iconOf(item: AgendaBreak): string {
  if (item.icon) return item.icon;
  const t = item.title.toLowerCase();
  if (t.includes("registration") || t.includes("check-in")) {
    return "fa-id-badge";
  }
  if (t.includes("lunch")) return "fa-utensils";
  if (t.includes("break") || t.includes("coffee")) return "fa-mug-hot";
  if (t.includes("welcome") || t.includes("opening")) return "fa-bullhorn";
  if (t.includes("closing")) return "fa-flag-checkered";
  if (t.includes("party")) return "fa-champagne-glasses";
  return "fa-circle-info";
}

// ---------------------------------------------------------------------------

/** The concepts as `buildSchedule()` takes them; each may be absent. */
export interface Program {
  agenda?: Agenda;
  speakers?: Speakers;
  patches?: Patches;
}

/** The `schedule` global for the given (validated) concepts: applies the patches, then builds. */
export function buildSchedule(program: Program, io: ScheduleIO): Schedule {
  if (program.agenda === undefined && program.speakers === undefined) {
    return emptySchedule;
  }
  const { agenda, speakers: people } = applyPatches(
    program.agenda ?? { sessions: [] },
    program.speakers ?? [],
    program.patches,
  );

  // -------------------------------------------------------------------------
  // Speakers

  function avatarUrl(speaker: SpeakerRecord): string | null {
    if (!speaker.photo) return null;
    if (!io.exists(speaker.photo)) {
      throw new Error(
        `Photo of ${speaker.name} (${speaker.id}) is not a file under src/: ${speaker.photo}`,
      );
    }
    return speaker.photo;
  }

  const speakersById = new Map<string, Speaker>();

  for (const s of people) {
    const title = s.title?.trim() || null;
    const company = s.company?.trim() || null;
    const tagline = s.tagline?.trim() || null;
    const links = Object.fromEntries(
      Object.entries(s.links ?? {}).filter((entry): entry is [string, string] =>
        typeof entry[1] === "string"
      ),
    );

    speakersById.set(s.id, {
      id: s.id,
      name: s.name.trim(),
      initials: initialsOf(s.name),
      title,
      company,
      tagline,
      byline: [title, company].filter(Boolean).join(", ") || tagline,
      links,
      bio: paragraphs(s.bio),
      avatar: avatarUrl(s),
      isKeynote: false,
      sessions: [],
    });
  }

  // -------------------------------------------------------------------------
  // Talks, scheduled or not

  function normaliseTalk(raw: AgendaSession): Session {
    const startsAt = raw.start === undefined ? null : timestamp(raw.start);
    const endsAt = raw.end === undefined ? null : timestamp(raw.end);
    const minutes = startsAt && endsAt ? minutesBetween(startsAt, endsAt) : null;
    return {
      id: raw.id,
      title: raw.title.trim(),
      paragraphs: paragraphs(raw.abstract),
      date: startsAt ? startsAt.slice(0, 10) : null,
      start: startsAt ? clock(startsAt) : null,
      end: endsAt ? clock(endsAt) : null,
      startsAt,
      endsAt,
      minutes,
      room: raw.room ?? null,
      isPlenary: raw.plenary === true,
      isBreak: false,
      format: formatOf(raw, minutes),
      cancelled: raw.cancelled === true,
      icon: null,
      speakers: raw.speakers
        .map((id) => speakersById.get(id))
        .filter((s): s is Speaker => Boolean(s)),
    };
  }

  const sessions = agenda.sessions
    .map(normaliseTalk)
    // Scheduled talks in timetable order, then the ones still without a slot.
    .sort((a, b) =>
      cmp(a.startsAt ?? "~", b.startsAt ?? "~") ||
      (a.room ?? "").localeCompare(b.room ?? "", "en") ||
      a.title.localeCompare(b.title, "en")
    );

  for (const session of sessions) {
    const ref: SessionRef = {
      id: session.id,
      title: session.title,
      date: session.date,
      start: session.start,
      end: session.end,
      room: session.room,
      format: session.format,
      cancelled: session.cancelled,
    };
    for (const speaker of session.speakers) {
      speaker.sessions.push(ref);
    }
  }

  // -------------------------------------------------------------------------
  // Breaks

  function normaliseBreak(raw: AgendaBreak, index: number): Session {
    const startsAt = timestamp(raw.start);
    const endsAt = timestamp(raw.end);
    return {
      id: raw.id ?? `break-${index}`,
      title: raw.title.trim(),
      paragraphs: paragraphs(raw.description),
      date: startsAt.slice(0, 10),
      start: clock(startsAt),
      end: clock(endsAt),
      startsAt,
      endsAt,
      minutes: minutesBetween(startsAt, endsAt),
      room: raw.room ?? null,
      isPlenary: raw.plenary === true,
      isBreak: true,
      format: null,
      cancelled: false,
      icon: iconOf(raw),
      speakers: [],
    };
  }

  // -------------------------------------------------------------------------
  // Timetable

  const scheduled: Session[] = [
    ...sessions.filter((s) => s.startsAt !== null),
    ...(agenda.breaks ?? []).map(normaliseBreak),
  ];

  // Tracks: the rooms hosting anything other than plenary items (a keynote
  // hall is not a column); if none qualifies, every room is a track.
  const allRooms = agenda.rooms ?? [];
  const busy = new Set(
    scheduled.filter((s) => !s.isPlenary && s.room).map((s) => s.room!),
  );
  let rooms = allRooms.filter((room) => busy.has(room));
  if (rooms.length === 0 && scheduled.length > 0) rooms = allRooms;
  const trackOf = new Map(rooms.map((room, index) => [room, index]));

  const days: Day[] = [];
  const dates = [...new Set(scheduled.map((s) => s.date!))].sort();

  for (const date of dates) {
    const today = scheduled.filter((s) => s.date === date);
    const starts = [...new Set(today.map((s) => s.start!))].sort();

    // A plenary item claims every track, unless another track is genuinely
    // busy at the same time (then the flag is a data slip and it stays put).
    const overlapsOtherTrack = (own: Session) =>
      today.some((other) =>
        other.room !== own.room &&
        other.start! < own.end! &&
        other.end! > own.start!
      );

    const rows: Row[] = starts.map((start, index) => ({
      index,
      start,
      startsAt: `${date}T${start}:00`,
      sessions: today
        .filter((session) => session.start === start)
        .map((session): Placed => {
          const track = session.room === null ? undefined : trackOf.get(session.room);
          const spansAll = track === undefined ||
            (session.isPlenary && !overlapsOtherTrack(session));

          // Cover every later row that starts before this item ends.
          let end = starts.findIndex((t, i) => i > index && t >= session.end!);
          if (end === -1) end = starts.length;

          return {
            session,
            track: spansAll ? null : track,
            rowSpan: Math.max(1, end - index),
          };
        })
        .sort((a, b) => (a.track ?? -1) - (b.track ?? -1)),
    }));

    days.push({
      date,
      label: dayLabel.format(new Date(`${date}T00:00:00Z`)),
      rows,
    });
  }

  // -------------------------------------------------------------------------
  // Speakers, finished

  // Only speakers with a talk that is on; sorted by name for the speakers page.
  const speakers = [...speakersById.values()]
    .filter((s) => s.sessions.some((talk) => !talk.cancelled))
    .sort((a, b) => a.name.localeCompare(b.name, "en"));

  for (const speaker of speakers) {
    speaker.sessions.sort((a, b) =>
      cmp(`${a.date ?? "~"}${a.start ?? ""}`, `${b.date ?? "~"}${b.start ?? ""}`)
    );
    speaker.isKeynote = speaker.sessions.some((s) => s.format === "Keynote" && !s.cancelled);
  }

  return { rooms, days, sessions, speakers };
}
