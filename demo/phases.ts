/**
 * The phases of the demo, in order: the announcement example and
 * one site per later stage of an edition under this folder, each a copy of
 * the one before it edited to that moment (see this folder's README.md).
 * build.ts builds each into _site/<slug>/ under `host` and puts the switcher
 * on every page; a phase on its own is an ordinary Lume site (`cd` into it,
 * `deno task serve`).
 *
 * Adding a phase: copy the one before it, edit, add an entry here in order.
 * `diff -r <a>/src <b>/src` shows what one phase changes over another.
 *
 * The showcase (showcase/, the theme's components and the home
 * page shapes) is built beside the phases, not among them: it is a gallery,
 * not a stage, so the bar lists it after the phases and never as "phase n".
 */

export interface Phase {
  /**
   * The folder under _site/ and the URL segment: `https://<host>/<slug>/`.
   * Numbered, so that no slug is a page's path: Lume's `site.url()` leaves
   * a URL that already starts with the base path alone, so a phase at
   * `/agenda/` would leave the agenda page's own links unprefixed.
   */
  slug: string;
  /** Shown in the switcher. */
  label: string;
  /** One sentence for the landing page: what this phase shows. */
  summary: string;
  /** The site's folder, relative to this file. */
  folder: string;
}

/** The host the phases are built for; `location` is `https://<host>/<slug>/`. */
export const host = "kcd-demo.example";

/** The showcase, built under /showcase/ beside the phases. */
export const showcase: Phase = {
  slug: "showcase",
  label: "Showcase",
  summary: "The theme's components, every one on a page, the timetable, and the three shapes a home page can take.",
  folder: "../showcase",
};

export const phases: Phase[] = [
  {
    slug: "01-announced",
    label: "Announced",
    summary: "The event is announced: the date, the venue and the team are known, nothing else is.",
    folder: "announced",
  },
  {
    slug: "02-cfp-open",
    label: "Call for papers open",
    summary: "The call for papers is open: the hero counts down to the deadline, the CFP section and its FAQ page are up, the menu says \"Submit a talk\".",
    folder: "cfp-open",
  },
  {
    slug: "03-sponsorship",
    label: "Sponsorship offer",
    summary: "The sponsorship packages are published: the sponsors page with the prospectus is live, and the home page invites partners.",
    folder: "sponsorship",
  },
  {
    slug: "04-sponsors",
    label: "Sponsors added",
    summary: "The first sponsors have signed: their logos appear on the home page in two tiers, above the invitation that stays.",
    folder: "sponsors",
  },
  {
    slug: "05-keynotes",
    label: "Keynotes announced",
    summary: "The opening keynote is announced; the second card says \"to be announced\" until it is.",
    folder: "keynotes",
  },
  {
    slug: "06-early-bird",
    label: "Early-bird tickets",
    summary: "Tickets go on sale at the early-bird price: the tickets page and the attending badge are live, the hero counts down to the price change, the call for papers has closed.",
    folder: "early-bird",
  },
  {
    slug: "07-speakers",
    label: "Speakers announced",
    summary: "The talks are accepted: the speakers page lists everyone with a talk, the closing keynote is announced, the timetable is still to come.",
    folder: "speakers",
  },
  {
    slug: "08-tickets",
    label: "Regular tickets",
    summary: "Early-bird pricing is over: the hero and the tickets page speak of tickets being available, nothing more.",
    folder: "tickets",
  },
  {
    slug: "09-agenda",
    label: "Agenda public",
    summary: "The timetable is out: every talk has a room and a time, the agenda page is live, the home page teases it, and the media partners are on.",
    folder: "agenda",
  },
  {
    slug: "10-wrap",
    label: "That's a wrap",
    summary: "The event is over: a thank-you homepage, resources coming soon, sales pages retired and the programme still available.",
    folder: "wrap",
  },
  {
    slug: "11-photos",
    label: "Photos published",
    summary: "The gallery and full album are live while recordings and slides are still being prepared.",
    folder: "photos",
  },
  {
    slug: "12-recap",
    label: "Recap complete",
    summary: "Photos, recordings, slides, the recap film and the transparency report are all available.",
    folder: "recap",
  },
];
