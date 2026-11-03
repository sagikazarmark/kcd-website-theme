/**
 * One Zod schema per data concept in a site's src/_data/. A key is required
 * when a template renders it unconditionally, optional when it is guarded.
 * Every object is strict (a misspelt key is an error, not a missing
 * section). Shared scalars are in ./shared.ts. A new concept is an
 * `export const <name>Schema` here, listed in `concepts` at the bottom.
 */

import { z } from "npm:zod@4.6.7";
import {
  email,
  href,
  icon,
  isoDate,
  isoDateTime,
  link,
  linkMap,
  localDateTime,
  markdownString,
  pageId,
  sitePath,
  url,
} from "./shared.ts";

// ---------------------------------------------------------------------------
// Shapes shared by more than one concept

/** One logo in a sponsor tier, rendered by `ui.logo`. */
const logoItem = z.strictObject({
  name: z.string(),
  logo: sitePath,
  url: link.optional(),
});

/** An icon beside a line of text (venue highlights). */
const iconText = z.strictObject({
  icon,
  text: z.string(),
});

/** One question (plain text) and its answer (Markdown), as `faq.item` renders them. */
const faqItem = z.strictObject({
  question: z.string(),
  answer: markdownString,
});

/** The questions of one FAQ, in order; `cfp.faq`, or any concept with questions. */
export const faqList = z.array(faqItem);

// ---------------------------------------------------------------------------
// Concepts

/** An IANA time zone this runtime knows (`Intl.DateTimeFormat` throws otherwise; aliases like "UTC" pass). */
function isTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** event.yaml: the event; read by every layout, the hero and the imprint. */
export const eventSchema = z.strictObject({
  name: z.string(),
  city: z.string(),
  year: z.number().int(),
  date: z.strictObject({
    iso: isoDate,
    label: z.string(),
  }),
  timezone: z.string().refine(isTimeZone, "not an IANA time zone"),
});

/** share.yaml: the link preview card, rendered in <head> by layouts/base.vto. */
export const shareSchema = z.strictObject({
  image: sitePath,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  alt: z.string(),
  description: z.string(),
  twitter: z.string().regex(/^@/, 'must be a handle starting with "@"')
    .optional(),
});

/**
 * logo.yaml: the event's logo files by orientation and colour. The menu
 * (white over the hero, colour on inner pages) and the attending badge read
 * `horizontal`; the footer reads `footer.logo`, or `vertical.white` without
 * it. `vertical` is optional, and `vertical.color` is there for the shape's
 * sake (no theme file reads it).
 */
export const logoSchema = z.strictObject({
  horizontal: z.strictObject({
    color: sitePath,
    white: sitePath,
  }),
  vertical: z.strictObject({
    white: sitePath,
    color: sitePath.optional(),
  }).optional(),
});

/** social.yaml: network -> URL, for the footer and the pages. */
export const socialSchema = linkMap;

/**
 * A link in the data: to a page of the site by its `id` (`page: "agenda"`,
 * the `id` in that page's front matter), or to a `url` (a site path, an
 * absolute URL, a mailto:). With `page`, the `label` may be left out and
 * the page's `title` is used, and the link is dropped while the page is a
 * draft (`draft: true` keeps the page out of the build; ui.navLinks sees
 * no such page, or one marked draft under `deno task serve`). The build
 * checks that a `page` names an id some page declares (./mod.ts).
 */
const linkTarget = {
  page: pageId.optional(),
  url: href.optional(),
  label: z.string().optional(),
};

/** `page` or `url`, not both; a `url` needs a `label`. */
function oneTarget(
  link: { page?: string; url?: string; label?: string },
  ctx: z.RefinementCtx,
) {
  if ((link.page === undefined) === (link.url === undefined)) {
    ctx.addIssue({
      code: "custom",
      path: [link.page === undefined ? "page" : "url"],
      message:
        "a link is either a `page` (an id from a page's front matter) or a `url`, not both or neither",
    });
  }
  if (link.url !== undefined && link.label === undefined) {
    ctx.addIssue({
      code: "custom",
      path: ["label"],
      message: "missing: a `url` link has no page title to fall back on",
    });
  }
}

/**
 * nav: the main links, the legal links and the CTA (menu.vto, and the
 * footer for `secondary`), through ui.navLinks. `enabled: false` leaves a
 * main link out for a reason other than a draft page (the CFP once closed).
 */
export const navSchema = z.strictObject({
  main: z.array(
    z.strictObject({
      ...linkTarget,
      icon,
      enabled: z.boolean().optional(),
    }).superRefine(oneTarget),
  ),
  secondary: z.array(z.strictObject(linkTarget).superRefine(oneTarget))
    .optional(),
  cta: z.strictObject({
    ...linkTarget,
    label: z.string(),
    icon,
    disabled: z.boolean().optional(),
  }).superRefine(oneTarget),
});

/** hero.yaml: the hero picture, the default `image` of hero/frame.vto; the copy is the page's. */
export const heroSchema = z.strictObject({
  image: z.strictObject({
    alt: z.string(),
    large: z.strictObject({
      src: sitePath,
      src2x: sitePath.optional(),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    }),
    // Optional: without it the large file serves every width.
    small: z.strictObject({
      src: sitePath,
      src2x: sitePath.optional(),
      width: z.number().int().positive(),
      height: z.number().int().positive().optional(),
    }).optional(),
  }),
});

/**
 * venue.yaml: the venue as facts, shared by the home page's venue section
 * (index.vto: name, address, `summary`, `highlights`, `image`; it links to
 * the venue page by id, `search.page("id=venue")`, not by a URL in the
 * data), the venue page's map section (venue.vto: name, `building`, address,
 * `coordinates`, `website`, `map`), the photo row (venue/photos.vto) and
 * the hero's venue line. What the venue page says about them (its lede,
 * how to get there, parking, what to know) is the page's own copy, written
 * in venue.vto with ui.card, venue.routes and ui.note.
 *
 * `map`: the local transport operator's journey planner (`transitUrl`, and
 * `transitLabel` as the text of the button that opens it), and optionally
 * any of the four URLs the theme otherwise derives from `coordinates` and
 * `address` (venue.ts, `mapLinks()`): `embedUrl` to embed another map
 * (a maps.google.com URL with `&output=embed`), `osmUrl`, `googleUrl`,
 * `appleUrl`.
 */
export const venueSchema = z.strictObject({
  name: z.string(),
  building: z.string().optional(),
  address: z.strictObject({
    street: z.string(),
    city: z.string(),
    country: z.string(),
  }),
  // WGS84; the map embed, its link and the directions are derived from it.
  coordinates: z.strictObject({
    lat: z.number(),
    lon: z.number(),
  }),
  website: link,
  summary: z.string(),
  highlights: z.array(iconText),
  image: z.strictObject({
    src: sitePath,
    src2x: sitePath,
    alt: z.string(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
  // Photos on /venue/, laid out 3:2 at 800x534 with `src2x` as the retina
  // version at twice that; both are site paths, like `image` above.
  photos: z.array(z.strictObject({
    src: sitePath,
    src2x: sitePath,
    alt: z.string(),
    caption: z.string(),
  })).optional(),
  map: z.strictObject({
    transitUrl: link,
    transitLabel: z.string(),
    embedUrl: url.optional(),
    osmUrl: url.optional(),
    googleUrl: url.optional(),
    appleUrl: url.optional(),
  }).optional(),
});

/**
 * cfp.yaml: the call for papers as facts: open or not, the submission link,
 * the deadline, and the questions a FAQ page renders. The copy around them
 * is the home page's. `open` is the one switch (no `enabled`).
 */
export const cfpSchema = z.strictObject({
  open: z.boolean(),
  url: link,
  deadline: isoDateTime,
  faq: faqList.optional(),
});

/** tickets: the facts /tickets/ reads, today the billing address; the copy is the page's. */
export const ticketsSchema = z.strictObject({
  billingEmail: email,
});

/** pretix.yaml: the ticket shop location for the pretix components. */
export const pretixSchema = z.strictObject({
  host: url,
  organizer: z.string(),
  // Empty lists every public event of the organizer.
  event: z.string(),
  locale: z.string().optional(),
});

/** One keynote card (keynote.vto): a placeholder until `announced`, then a name and a talk at least. */
const keynoteSpeaker = z.strictObject({
  announced: z.boolean(),
  name: z.string().optional(),
  role: z.string().optional(),
  company: z.string().optional(),
  talk: z.string().optional(),
  abstract: z.string().optional(),
  bio: z.string().optional(),
  photo: sitePath.optional(),
  links: linkMap.optional(),
  resources: z.array(z.strictObject({
    label: z.string(),
    url: link,
    // Default "fa-link" in keynote.vto.
    icon: icon.optional(),
  })).optional(),
}).superRefine((speaker, ctx) => {
  if (!speaker.announced) return;
  for (const key of ["name", "talk"] as const) {
    if (speaker[key] === undefined) {
      ctx.addIssue({
        code: "custom",
        path: [key],
        message:
          "required when announced is true (the card always shows the name and the talk)",
      });
    }
  }
});

/** keynotes.yaml: the keynote speakers, one keynote.vto card each in the home page's section. */
export const keynotesSchema = z.strictObject({
  speakers: z.array(keynoteSpeaker),
});

/** sessionize.yaml: the converter's settings (scripts/sessionize.ts); no theme file reads it. */
export const sessionizeSchema = z.strictObject({
  endpoint: z.string().regex(/^\w+$/, "must be a Sessionize endpoint id"),
});

// ---------------------------------------------------------------------------
// The programme: agenda, speakers and patches (docs/theme-reference.md)

/** The id of a session, break or speaker: the platform's or a slug; it becomes a dialog id and URL hash. */
const recordId = z.string().regex(
  /^[\w-]+$/,
  'must be letters, digits, "-" or "_" only',
);

/**
 * agenda.sessions[]: a talk, scheduled or not (`room`, `start`, `end`
 * absent until it has a slot); flags left out when false. The talk names
 * its speakers; the reverse is derived. Cross-field and cross-record checks
 * are in program.ts.
 */
const sessionShape = {
  id: recordId,
  title: z.string(),
  abstract: z.string().optional(),
  // Ids from speakers.yaml.
  speakers: z.array(recordId),
  // One of `agenda.rooms`.
  room: z.string().optional(),
  start: localDateTime.optional(),
  end: localDateTime.optional(),
  keynote: z.boolean().optional(),
  // Everyone attends: spans every track.
  plenary: z.boolean().optional(),
  // Keeps its slot, marked; its speaker is listed only with another talk.
  cancelled: z.boolean().optional(),
};

/** agenda.breaks[]: a timed slot that is not a talk; `id` only to patch it, `icon` overrides the one picked from the title. */
const breakShape = {
  id: recordId.optional(),
  title: z.string(),
  description: z.string().optional(),
  room: z.string().optional(),
  start: localDateTime,
  end: localDateTime,
  plenary: z.boolean().optional(),
  icon: icon.optional(),
};

/** speakers[]: a person; `title` and `company` make the byline, `tagline` stands in when both are missing. */
const speakerShape = {
  id: recordId,
  name: z.string(),
  // Job title.
  title: z.string().optional(),
  company: z.string().optional(),
  tagline: z.string().optional(),
  // Must exist under src/; schedule.ts checks.
  photo: sitePath.optional(),
  links: linkMap.optional(),
  bio: z.string().optional(),
};

/** agenda.yaml: the programme; `rooms` in display order (tracks are derived), `sessions`, `breaks`. */
export const agendaSchema = z.strictObject({
  rooms: z.array(z.string()).optional(),
  sessions: z.array(z.strictObject(sessionShape)),
  breaks: z.array(z.strictObject(breakShape)).optional(),
});

/** speakers.yaml: the people, a list at the root of the file. */
export const speakersSchema = z.array(z.strictObject(speakerShape));

/**
 * The patch form of a record: `id` plus at least one of its fields, each
 * optional and, where absence is allowed, nullable (`null` clears). A key
 * the record has not is reported once, as unrecognised.
 */
function patchOf(shape: Record<string, z.ZodType>, idKey: string) {
  const fields = Object.fromEntries(
    Object.entries(shape).map(([key, field]) => {
      if (key === idKey) return [key, recordId];
      const optional = field.safeParse(undefined).success;
      return [key, (optional ? field.nullable() : field).optional()];
    }),
  );
  return z.looseObject(fields).superRefine((patch, ctx) => {
    const unknown = Object.keys(patch).filter((key) => !(key in fields));
    if (unknown.length) {
      ctx.addIssue({ code: "unrecognized_keys", keys: unknown, input: patch });
    } else if (!Object.keys(patch).some((key) => key !== idKey)) {
      ctx.addIssue({
        code: "custom",
        message: "a patch needs at least one field besides the id",
        input: patch,
      });
    }
  });
}

/** patches/agenda.yaml, patches/speakers.yaml: hand corrections merged over the imported records by `id` (program.ts). */
export const patchesSchema = z.strictObject({
  agenda: z.strictObject({
    sessions: z.array(patchOf(sessionShape, "id")).optional(),
    breaks: z.array(patchOf(breakShape, "id")).optional(),
  }).optional(),
  speakers: z.array(patchOf(speakerShape, "id")).optional(),
}).meta({ file: "patches/agenda.yaml or patches/speakers.yaml" });

export type Agenda = z.infer<typeof agendaSchema>;
export type AgendaSession = Agenda["sessions"][number];
export type AgendaBreak = NonNullable<Agenda["breaks"]>[number];
export type Speakers = z.infer<typeof speakersSchema>;
export type SpeakerRecord = Speakers[number];
export type Patches = z.infer<typeof patchesSchema>;

/**
 * organizers.yaml: the team, one card (organizer.vto) each, in the home
 * page's "Meet the organizers" section, which the page writes itself
 * (index.vto, with the paragraph under the heading).
 */
export const organizersSchema = z.strictObject({
  people: z.array(z.strictObject({
    name: z.string(),
    // Optional: the card falls back to an icon avatar.
    photo: sitePath.optional(),
    role: z.string().optional(),
    company: z.string().optional(),
    bio: z.string().optional(),
    links: linkMap.optional(),
  })),
});

/** sponsors.yaml: logos by tier; a tier's `style` is the Tailwind classes of its row (`container`) and items (`item`). */
export const sponsorsSchema = z.strictObject({
  tiers: z.array(z.strictObject({
    name: z.string(),
    style: z.strictObject({
      container: z.string(),
      item: z.string(),
    }),
    logos: z.array(logoItem),
  })),
});

/**
 * footer.yaml: the footer partial; the theme ships a default `text`. Its logo
 * is `logo` here, or `logo.vertical.white` without it; with one the social
 * links sit right, without any they centre.
 */
export const footerSchema = z.strictObject({
  logo: sitePath.optional(),
  text: z.string(),
});

/** A BCP 47 language tag: a terms version's key, which is its file name. */
const languageTag = z.string().regex(
  /^[a-z]{2,3}(-[A-Za-z0-9]+)*$/,
  'must be a BCP 47 language tag like "en" or "pt-BR"',
);

/**
 * terms/<lang>.md: one Markdown file per language, loaded as an object
 * keyed by file name, each its front matter (`label`, `title`, `order`)
 * plus the body as `content`. Headings in the body start at `###`. The
 * "missing" message names `meta().file`.
 */
export const termsSchema = z.record(
  languageTag,
  z.strictObject({
    label: z.string(),
    title: z.string(),
    order: z.number().int().optional(),
    content: z.string(),
  }),
).refine(
  (versions) => Object.keys(versions).length > 0,
  "needs at least one version (one Markdown file per language)",
).meta({ file: "terms/<lang>.md" });

// ---------------------------------------------------------------------------

/** Every concept the build validates, by top-level key; unknown keys are a site's own and pass. */
export const concepts: Record<string, z.ZodType> = {
  event: eventSchema,
  share: shareSchema,
  logo: logoSchema,
  social: socialSchema,
  nav: navSchema,
  hero: heroSchema,
  venue: venueSchema,
  cfp: cfpSchema,
  tickets: ticketsSchema,
  pretix: pretixSchema,
  keynotes: keynotesSchema,
  sessionize: sessionizeSchema,
  agenda: agendaSchema,
  speakers: speakersSchema,
  patches: patchesSchema,
  organizers: organizersSchema,
  sponsors: sponsorsSchema,
  footer: footerSchema,
  terms: termsSchema,
};
