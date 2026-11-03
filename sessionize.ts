/**
 * Sessionize as a source of the programme: `fromSessionize()` turns an
 * event's two "API / Embed" views into the `agenda` and `speakers` concepts
 * (./schema/concepts.ts), which ./scripts/sessionize.ts writes to the
 * site's data. Nothing else in the theme knows Sessionize.
 *
 *   All        talks and speaker profiles with the custom-question answers
 *              (job title, company, LinkedIn; Keynote and Cancelled, as
 *              checkboxes answering "true"), listed before the timetable
 *              is out
 *   GridSmart  the published timetable, whose service slots become
 *              `agenda.breaks`
 *
 * Questions are matched by label, their ids differ per event. Times are
 * copied as sent (event-local, no offset). The output is deterministic
 * (sorted, schema key order, flags only when true) so a re-run diffs as
 * the change in Sessionize.
 */

import type {
  Agenda,
  AgendaBreak,
  AgendaSession,
  SpeakerRecord,
  Speakers,
} from "./schema/concepts.ts";
import { networks } from "./schema/shared.ts";

/**
 * Where speaker photos live under `src/` (also their URL). The converter
 * mirrors Sessionize's portraits here and prunes the ones it mirrored that no
 * speaker references any more; portraits of the site's own in the same
 * folder (named by a patch) are left alone, told apart by the CDN's file
 * names (`isMirrored`).
 */
export const PHOTO_URL = "/assets/speakers/";

/** Whether a file name is one the CDN gives ("8db9-400o400o1-test4.jpg"), so the converter's to prune. */
export function isMirrored(name: string): boolean {
  return /^[0-9a-f]{4}-\d+o\d+o\d+-[\w-]+\.(jpe?g|png|webp|gif)$/i.test(name);
}

/** The file name of a cdn.sessionize.com photo URL; anything else is rejected rather than written to disk. */
export function photoName(url: string): string {
  const { hostname, pathname } = new URL(url);
  const name = pathname.split("/").pop() ?? "";
  if (
    hostname !== "cdn.sessionize.com" ||
    !/^[\w-]+(\.[\w-]+)*\.(jpe?g|png|webp|gif)$/i.test(name)
  ) {
    throw new Error(`Unexpected Sessionize photo URL: ${url}`);
  }
  return name;
}

// ---------------------------------------------------------------------------
// Sessionize API shapes (only the fields this module reads)

export interface ApiSpeaker {
  id: string;
  fullName: string;
  bio: string | null;
  tagLine: string | null;
  profilePicture: string | null;
  links: { title: string; url: string; linkType: string }[];
  questionAnswers: { questionId: number; answerValue: string | null }[];
}

export interface ApiQuestion {
  id: number;
  question: string;
}

/** A talk from the All view; times and room are null until scheduled. */
export interface ApiSession {
  id: string;
  title: string;
  description: string | null;
  startsAt: string | null;
  endsAt: string | null;
  isServiceSession: boolean;
  isPlenumSession: boolean;
  speakers: string[];
  roomId: number | null;
  questionAnswers: { questionId: number; answerValue: string | null }[];
}

export interface ApiAll {
  sessions: ApiSession[];
  speakers: ApiSpeaker[];
  questions: ApiQuestion[];
  rooms: { id: number; name: string; sort: number }[];
}

/** A session as placed on the GridSmart timetable; includes service slots. */
export interface ApiGridSession {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  isServiceSession: boolean;
  isPlenumSession: boolean;
  roomId: number;
  room: string;
}

export interface ApiGridDay {
  date: string;
  timeSlots: {
    slotStart: string;
    rooms: { id: number; name: string; session: ApiGridSession }[];
  }[];
}

// ---------------------------------------------------------------------------
// Helpers

/** Trim, normalise line endings, drop blank-line runs beyond one; undefined when empty. */
function text(value: string | null | undefined): string | undefined {
  const normalised = value?.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n")
    .trim();
  return normalised || undefined;
}

/** Speakers may paste a full URL or just their handle. */
function linkedinUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value)) return value;
  if (/linkedin\.com/i.test(value)) return `https://${value}`;
  return `https://www.linkedin.com/in/${value.replace(/^@/, "")}`;
}

type Network = typeof networks[number];

/** A Sessionize link's network, from its type or, when untyped, its host; undefined when `linkMap` has no key for it. */
function networkOf(link: { url: string; linkType: string }): Network | undefined {
  switch (link.linkType) {
    case "LinkedIn":
      return "linkedin";
    case "Twitter":
      return "x";
    case "Blog":
    case "Company_Website":
      return "website";
  }
  let host: string;
  try {
    host = new URL(link.url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
  if (host === "github.com") return "github";
  if (host === "bsky.app") return "bluesky";
  if (host === "youtube.com" || host === "youtu.be") return "youtube";
  if (host === "linkedin.com") return "linkedin";
  if (host === "x.com" || host === "twitter.com") return "x";
  return undefined;
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "en");

const cmp = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

/** Scheduled first, by time, room and title; the unscheduled after them, by title. */
function byTime(
  a: { start?: string; room?: string; title: string },
  b: { start?: string; room?: string; title: string },
): number {
  // Code-unit order: "~" (unscheduled) sorts after every digit.
  return cmp(a.start ?? "~", b.start ?? "~") ||
    (a.room ?? "").localeCompare(b.room ?? "", "en") ||
    a.title.localeCompare(b.title, "en");
}

/** `{ a: 1, b: undefined }` -> `{ a: 1 }`, so the YAML carries only what is set. */
function compact<T extends object>(record: T): T {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined),
  ) as T;
}

// ---------------------------------------------------------------------------

export interface Converted {
  agenda: Agenda;
  speakers: Speakers;
  /** CDN file names of the photos the speakers reference, for the CLI to mirror. */
  photos: string[];
}

/** The `agenda` and `speakers` concepts for an event's two API views; see the header. */
/**
 * A Sessionize time as the event's local time. The API gives the event's
 * local time without an offset; its sample event appends "Z", which the
 * schema's `localDateTime` would reject, so a trailing "Z" is dropped (the
 * clock is the event's either way, see schema/shared.ts).
 */
function local(time: string | null | undefined): string | undefined {
  return time == null ? undefined : time.replace(/Z$/, "");
}

export function fromSessionize(all: ApiAll, grid: ApiGridDay[]): Converted {
  const questionId = (pattern: RegExp) =>
    all.questions.find((q) => pattern.test(q.question))?.id;
  const titleQuestion = questionId(/job\s*title|^title$/i);
  const companyQuestion = questionId(/company|organi[sz]ation/i);
  const linkedinQuestion = questionId(/linkedin/i);
  const keynoteQuestion = questionId(/keynote/i);
  const cancelledQuestion = questionId(/cancel/i);

  const answer = (
    item: { questionAnswers: { questionId: number; answerValue: string | null }[] },
    id: number | undefined,
  ): string | undefined => {
    if (id === undefined) return undefined;
    return text(item.questionAnswers.find((a) => a.questionId === id)?.answerValue);
  };
  const ticked = (item: ApiSession, id: number | undefined) =>
    answer(item, id) === "true" ? true : undefined;

  // Speakers

  const photos = new Set<string>();

  const speakers: Speakers = all.speakers.map((s): SpeakerRecord => {
    const links: Partial<Record<Network, string>> = {};
    const linkedin = linkedinUrl(answer(s, linkedinQuestion));
    if (linkedin) links.linkedin = linkedin;
    for (const link of s.links) {
      const network = networkOf(link);
      if (network && !links[network]) links[network] = link.url;
    }
    const ordered = Object.fromEntries(
      networks.filter((n) => links[n]).map((n) => [n, links[n]]),
    );

    let photo: string | undefined;
    if (s.profilePicture) {
      const name = photoName(s.profilePicture);
      photos.add(name);
      photo = PHOTO_URL + name;
    }

    return compact({
      id: s.id,
      name: s.fullName.trim(),
      title: answer(s, titleQuestion),
      company: answer(s, companyQuestion),
      tagline: text(s.tagLine),
      photo,
      links: Object.keys(ordered).length ? ordered : undefined,
      bio: text(s.bio),
    });
  }).sort(byName);

  // Rooms and talks

  const roomName = new Map(all.rooms.map((r) => [r.id, r.name]));
  const rooms = [...all.rooms].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, "en"))
    .map((r) => r.name);

  const sessions: AgendaSession[] = all.sessions
    .filter((raw) => !raw.isServiceSession)
    .map((raw): AgendaSession =>
      compact({
        id: raw.id,
        title: raw.title.trim(),
        abstract: text(raw.description),
        speakers: raw.speakers,
        room: raw.roomId === null ? undefined : roomName.get(raw.roomId),
        start: local(raw.startsAt),
        end: local(raw.endsAt),
        keynote: ticked(raw, keynoteQuestion),
        plenary: raw.isPlenumSession || undefined,
        cancelled: ticked(raw, cancelledQuestion),
      })
    )
    .sort(byTime);

  // Breaks, from the grid

  const seen = new Set<string>();
  const breaks: AgendaBreak[] = [];
  for (const day of grid) {
    for (const slot of day.timeSlots) {
      for (const { session } of slot.rooms) {
        if (!session.isServiceSession || seen.has(session.id)) continue;
        seen.add(session.id);
        breaks.push(compact({
          id: session.id,
          title: session.title.trim(),
          description: text(session.description),
          room: session.room || undefined,
          start: local(session.startsAt)!,
          end: local(session.endsAt)!,
          plenary: session.isPlenumSession || undefined,
        }));
      }
    }
  }
  breaks.sort(byTime);

  const agenda: Agenda = compact({
    rooms: rooms.length ? rooms : undefined,
    sessions,
    breaks: breaks.length ? breaks : undefined,
  });

  return { agenda, speakers, photos: [...photos].sort() };
}
