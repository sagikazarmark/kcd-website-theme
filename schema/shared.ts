/**
 * Scalars and shapes more than one concept in ./concepts.ts shares: date
 * formats, paths and URLs, the icon convention, the social link map, the
 * page ids.
 */

import { z } from "npm:zod@4.6.7";

// ---------------------------------------------------------------------------
// Dates

/** An unquoted YAML timestamp arrives as a Date; say so instead of "expected string, received Date". */
const quotedDate = (issue: { input?: unknown }) =>
  issue.input instanceof Date
    ? "must be a quoted ISO 8601 string (YAML parsed it as a date; put quotes around it)"
    : undefined;

/** A moment with an offset, "2030-01-31T23:59:59+01:00" or "...Z": deadlines, formatted where shown. */
export const isoDateTime = z.string({ error: quotedDate }).regex(
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}([+-]\d{2}:\d{2}|Z)$/,
  'must be an ISO 8601 date-time with offset, like "2030-01-31T23:59:59+01:00"',
);

/** A calendar date, "2030-01-31" (`event.date.iso`). */
export const isoDate = z.string({ error: quotedDate }).regex(
  /^\d{4}-\d{2}-\d{2}$/,
  'must be an ISO 8601 date, like "2030-01-31"',
);

/**
 * A moment in the event's local time, no offset: "2030-05-15T09:00:00"
 * (seconds optional). The agenda's `start`/`end`: a timetable is read in
 * the event's zone and never converted; schedule.ts slices the clock out as
 * text, so the output is the same wherever the site is built.
 */
export const localDateTime = z.string({ error: quotedDate }).regex(
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/,
  'must be an event-local ISO 8601 date-time without offset, like "2030-05-15T09:00:00"',
);

// ---------------------------------------------------------------------------
// Links and paths

export const url = z.url();

/**
 * A link out of the site (a profile, a sponsor's site, the CFP platform):
 * an absolute URL, or "#" while there is none yet, a placeholder that stays
 * on the page. Where the value is loaded rather than linked (the ticket
 * shop's host, a map embed), it is `url`.
 */
export const link = z.string().refine(
  (value) => value === "#" || (/^https?:\/\//.test(value) && URL.canParse(value)),
  'must be an absolute URL like "https://example.org/...", or "#" while there is none yet',
);

export const email = z.email();

/** A path inside this site, "/assets/img/x.svg" or "/tickets/". */
export const sitePath = z.string().regex(
  /^\//,
  'must be a site path starting with "/"',
);

/** A link target: a site path, an absolute URL, a fragment, mailto: or tel:. */
export const href = z.string().regex(
  /^(\/|https?:\/\/|#|mailto:|tel:)/,
  'must be a site path ("/..."), an absolute URL, "#fragment", "mailto:" or "tel:"',
);

// ---------------------------------------------------------------------------
// Presentation

/** A Font Awesome glyph as `ui.icon` takes it: bare ("fa-ticket", solid) or with its style ("fa-brands fa-discord"). */
export const icon = z.string().regex(
  /^((fas|fab|far|fa-solid|fa-brands|fa-regular) )?fa-[\w-]+$/,
  'must be a Font Awesome glyph like "fa-ticket" or "fa-brands fa-discord"',
);

/** Markdown rendered through Lume's `md` filter: a FAQ answer, a few paragraphs with a list or a link. */
export const markdownString = z.string();

// ---------------------------------------------------------------------------
// Social links

/** The networks `ui.socialLinks` knows, in its canonical order. */
export const networks = [
  "website",
  "discord",
  "x",
  "bluesky",
  "mastodon",
  "linkedin",
  "youtube",
  "github",
] as const;

export const network = z.enum(networks);

/** Network -> link (`social`, a person's `links`); every key optional, the set closed. */
export const linkMap = z.strictObject(
  Object.fromEntries(networks.map((key) => [key, link.optional()])) as Record<
    (typeof networks)[number],
    z.ZodOptional<typeof link>
  >,
);

// ---------------------------------------------------------------------------
// Pages

/** A page's `id` (its front matter) as a link names it, `page: "agenda"`; checked against the pages at build. */
export const pageId = z.string().regex(
  /^[a-z0-9][\w-]*$/i,
  'must be a page id like "agenda": letters, digits, "-" or "_"',
);
