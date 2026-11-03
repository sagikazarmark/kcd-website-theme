/**
 * Minimal valid data for the concepts the layouts and the shared components
 * read unconditionally. The theme's own defaults (logo, footer) arrive as
 * remote fallbacks; these are the identity concepts the theme refuses to
 * default. Spread into a fixture's `data`.
 */

import { parse } from "lume/deps/yaml.ts";
import textLoader from "lume/core/loaders/text.ts";

export const event = {
    name: "KCD Testville",
    city: "Testville",
    year: 2030,
    date: { iso: "2030-05-15", label: "15 May 2030" },
    timezone: "Europe/Amsterdam",
};

export const share = {
    image: "/assets/img/og.png",
    width: 1200,
    height: 630,
    alt: "KCD Testville",
    description: "A test site.",
};

export const social = {
    discord: "https://example.com/discord",
    x: "https://example.com/x",
    linkedin: "https://example.com/linkedin",
};

/** A footer with its own logo (over `logo.vertical.white`): the logo left, the social links right. */
export const footer = {
    logo: "/assets/img/footer-mark.svg",
    text: "Part of the global Kubernetes Community Days program.",
};

/** The hero picture (hero.frame's default `image`): one SVG, no small variant, no retina files. The theme ships no default. */
export const hero = {
    image: { alt: "", large: { src: "/assets/hero.svg", width: 1920, height: 1080 } },
};

/** A closed CFP: a page reads `open`, `url`, `deadline` and `faq`; no theme file reads it. */
export const cfp = {
    open: false,
    url: "https://example.com/cfp",
    deadline: "2030-02-28T23:59:59+01:00",
    faq: [
        { question: "Who can submit?", answer: "Anyone." },
        { question: "What formats?", answer: "Talks of **30 minutes**, or [lightning talks](/agenda/).\n\n- one\n- two" },
    ],
};

/**
 * The menu and the footer's secondary links. Agenda and Speakers are switched
 * off with `enabled: false` (their pages would be drafts), so with this
 * fixture only Home, Venue and Tickets render.
 */
export const nav = {
    main: [
        { label: "Home", url: "/", icon: "fa-house" },
        { label: "Agenda", url: "/agenda/", icon: "fa-calendar-days", enabled: false },
        { label: "Speakers", url: "/speakers/", icon: "fa-users", enabled: false },
        { label: "Venue", url: "/venue/", icon: "fa-location-dot" },
        { label: "Tickets", url: "/tickets/", icon: "fa-ticket" },
    ],
    secondary: [
        { label: "Imprint", url: "/imprint/" },
        { label: "Terms", url: "/terms/" },
    ],
    cta: { label: "Get tickets", url: "/tickets/", icon: "fa-ticket" },
};

/** What a page using layouts/page.vto needs to render: the layouts, the menu and the footer. */
export const pageData = { event, share, social, nav, footer, hero };

// ---------------------------------------------------------------------------
// The programme (agenda.yaml, speakers.yaml, patches/), for schedule.ts and
// the session and speaker components. Small and valid; a test spreads and
// bends it.

export const speakers = [
    { id: "ada", name: "Ada Example", title: "Platform Engineer", company: "Example Corp", links: { linkedin: "https://example.com/ada" }, bio: "Para one.\n\nPara two." },
    { id: "bram", name: "Bram Placeholder", tagline: "SRE at Demo Cloud" },
    { id: "chloe", name: "Chloé Sample", title: "Developer Advocate" },
];

/** Two rooms; a plenary keynote, two parallel talks and one without a slot; registration and a coffee break. */
export const agenda = {
    rooms: ["Hall B", "Hall C"],
    sessions: [
        { id: "keynote", title: "Why community days matter", abstract: "One.\n\nTwo.", speakers: ["ada"], room: "Hall B", start: "2030-05-15T09:00:00", end: "2030-05-15T09:45:00", keynote: true, plenary: true },
        { id: "k8s", title: "Kubernetes for the rest of us", speakers: ["bram"], room: "Hall B", start: "2030-05-15T10:00:00", end: "2030-05-15T10:40:00" },
        { id: "o11y", title: "Observability on a budget", speakers: ["chloe"], room: "Hall C", start: "2030-05-15T10:00:00", end: "2030-05-15T10:40:00" },
        { id: "tba", title: "A talk without a slot yet", speakers: ["chloe"] },
    ],
    breaks: [
        { id: "registration", title: "Registration", room: "Hall B", start: "2030-05-15T08:00:00", end: "2030-05-15T09:00:00", plenary: true },
        { id: "coffee", title: "Coffee break", room: "Hall B", start: "2030-05-15T09:45:00", end: "2030-05-15T10:00:00", plenary: true },
    ],
};

/** The programme as root data: spread into a fixture's `data` to get a `schedule`. */
export const programData = { agenda, speakers };

/**
 * The demo's data as a test sees it: free-form, so a test can reach into
 * any concept and break it.
 */
// deno-lint-ignore no-explicit-any
export type DemoData = Record<string, any>;

/**
 * The full site's data (the demo's last phase, demo/agenda/src/_data/*.yaml,
 * and the folders such as _data/terms/<lang>.md and _data/patches/agenda.yaml,
 * loaded the way Lume loads them: keyed by file name, a Markdown file as front
 * matter plus `content`) over the
 * theme's defaults (src/_data/, which a build reaches as remote fallbacks:
 * `logo`, `footer`), as one root object: a complete, valid instance to
 * mutate in schema tests. Parsed fresh on every call so a test can edit it
 * freely.
 */
export async function demoData(): Promise<DemoData> {
    const root: DemoData = {};
    for (const dir of [new URL("../src/_data/", import.meta.url), new URL("../demo/agenda/src/_data/", import.meta.url)]) {
        await readData(dir, root);
    }
    return root;
}

/** Every `<name>.yaml` and `<name>/*.md` folder under `dir` into `root`, a later call overriding an earlier. */
async function readData(dir: URL, root: DemoData): Promise<void> {
    for await (const entry of Deno.readDir(dir)) {
        if (entry.isFile && entry.name.endsWith(".yaml")) {
            root[entry.name.slice(0, -".yaml".length)] = parse(await Deno.readTextFile(new URL(entry.name, dir)));
        } else if (entry.isDirectory) {
            const folder = new URL(`${entry.name}/`, dir);
            const concept: DemoData = {};
            for await (const file of Deno.readDir(folder)) {
                if (!file.isFile) continue;
                if (file.name.endsWith(".md")) {
                    concept[file.name.slice(0, -".md".length)] = await textLoader(new URL(file.name, folder).pathname);
                } else if (file.name.endsWith(".yaml")) {
                    concept[file.name.slice(0, -".yaml".length)] = parse(await Deno.readTextFile(new URL(file.name, folder)));
                }
            }
            root[entry.name] = concept;
        }
    }
}

// ---------------------------------------------------------------------------
// The venue (venue.yaml): the facts the venue block, the map block and the
// photo row read. Small and valid.

export const venue = {
    name: "Test Hall",
    building: "West Wing",
    address: { street: "1 Test Street", city: "1000 Testville", country: "Testland" },
    coordinates: { lat: 47.5, lon: 19.0 },
    website: "https://example.com/test-hall",
    summary: "A hall for testing.",
    highlights: [{ icon: "fa-train", text: "Next to the station" }],
    image: { src: "/assets/img/venue.svg", src2x: "/assets/img/venue.svg", alt: "The hall", width: 800, height: 534 },
    photos: [
        { src: "/assets/img/a.svg", src2x: "/assets/img/a@2x.svg", alt: "Front", caption: "The front" },
        { src: "/assets/img/b.svg", src2x: "/assets/img/b@2x.svg", alt: "Hall", caption: "The hall" },
    ],
    map: { transitUrl: "https://example.com/planner", transitLabel: "Plan your trip" },
};
