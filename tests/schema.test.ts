/**
 * Schema tests: what an organiser sees in the terminal when the data is
 * wrong. The messages are the contract (file, key path, what to fix), so
 * they are asserted as text. Most cases call the validator directly on the
 * demo data with one thing changed; the single-definition rule needs Lume's
 * view of the source tree, so those two build a fixture in-process.
 *
 *     deno task test
 */

import { assert, assertEquals } from "@std/assert";
import { DataError, type Locator, validate } from "../schema/mod.ts";
import { buildError } from "./helpers.ts";
import { type DemoData, demoData, event } from "./fixtures.ts";

/**
 * Files as an instance has them: one per concept under src/_data/, and for
* the terms and the patches a folder of one file per key (`terms/hu.md`,
 * `patches/agenda.yaml`).
 */
const folders: Record<string, Record<string, string>> = {
    terms: { en: "src/_data/terms/en.md", hu: "src/_data/terms/hu.md" },
    patches: { agenda: "src/_data/patches/agenda.yaml", speakers: "src/_data/patches/speakers.yaml" },
};
const files: Locator = {
    locate: (concept) =>
        concept in folders
            ? { file: `src/_data/${concept}/`, prefix: [], files: folders[concept] }
            : { file: `src/_data/${concept}.yaml`, prefix: [] },
    expected: (name) => `src/_data/${name}`,
};

/** The report for `root`, as the build prints it; "" when the data is fine. */
function report(root: Record<string, unknown>): string {
    const issues = validate(root, files);
    return issues.length ? new DataError(issues).message : "";
}

/** Mutate the demo data, validate, and assert every `needle` is in the report. */
async function expectRejected(mutate: (root: DemoData) => void, ...needles: string[]): Promise<string> {
    const root = await demoData();
    mutate(root);
    const output = report(root);
    assert(output !== "", "the data must be rejected");
    for (const needle of needles) {
        assert(output.includes(needle), `the report must mention ${JSON.stringify(needle)}; got:\n${output}`);
    }
    return output;
}

Deno.test("the demo data passes validation", async () => {
    assertEquals(report(await demoData()), "");
});

Deno.test("an unknown key is reported with the file and the key", async () => {
    await expectRejected(
        (d) => { d.cfp.deadlne = d.cfp.deadline; },
        "src/_data/cfp.yaml: deadlne: Unrecognized key",
    );
});

Deno.test("a value of the wrong type names the expected type", async () => {
    await expectRejected((d) => { d.cfp.open = "yes"; }, "src/_data/cfp.yaml: open:", "boolean");
});

Deno.test("the legacy show flag is rejected", async () => {
    await expectRejected((d) => { d.keynotes.show = true; }, "src/_data/keynotes.yaml: show: Unrecognized key");
});

Deno.test("section and footer data reject the removed enabled flag", async () => {
    for (const concept of ["venue", "keynotes", "organizers", "sponsors", "footer"]) {
        await expectRejected(
            (d) => { d[concept].enabled = false; },
            `src/_data/${concept}.yaml: enabled: Unrecognized key`,
        );
    }
});

Deno.test("an unquoted timestamp (a Date after YAML parsing) gets a hint to quote it", async () => {
    await expectRejected((d) => { d.cfp.deadline = new Date("2030-02-28T22:59:59Z"); }, "src/_data/cfp.yaml: deadline:", "quoted ISO 8601");
});

Deno.test("the CFP holds facts and a FAQ; its old copy keys and a malformed question are rejected, no FAQ is fine", async () => {
    await expectRejected((d) => { d.cfp.section = { heading: "x" }; }, "src/_data/cfp.yaml: section: Unrecognized key");
    await expectRejected((d) => { d.cfp.countdown = { enabled: true }; }, "src/_data/cfp.yaml: countdown: Unrecognized key");
    await expectRejected((d) => { delete d.cfp.faq[0].answer; }, "src/_data/cfp.yaml: faq[0].answer: missing (expected string)");
    await expectRejected((d) => { d.cfp.faq[1].q = d.cfp.faq[1].question; }, "src/_data/cfp.yaml: faq[1].q: Unrecognized key");

    const root = await demoData();
    delete root.cfp.faq;
    assertEquals(report(root), "", "faq is optional: a site without a FAQ page leaves it out");
});

Deno.test("a time zone that is not IANA is rejected", async () => {
    await expectRejected((d) => { d.event.timezone = "Europe/Nowhere"; }, "src/_data/event.yaml: timezone:", "IANA");
});

Deno.test("a nested problem is reported with an indexed key path", async () => {
    await expectRejected((d) => { d.keynotes.speakers[1].talk = 123; }, "src/_data/keynotes.yaml: speakers[1].talk:");
});

Deno.test("a missing required key is reported as missing, not as a type mismatch", async () => {
    await expectRejected((d) => { delete d.event.date; }, "src/_data/event.yaml: date: missing (expected object)");
});

Deno.test("a missing required concept names the file to create and the way out", async () => {
    await expectRejected(
        (d) => { delete d.event; },
        "event (missing)",
        "add src/_data/event.yaml",
        'drop "event" from the required list in _config.ts',
    );
});

Deno.test("what the pages read is not required unless the site says so", async () => {
    const root = await demoData();
    delete root.venue;
    assertEquals(validate(root, files), [], "venue is a page's concept; the theme alone does not require it");
    assertEquals(validate(root, files, { required: new Set(["venue"]) }).length, 1, "a site that lists it gets the error");
});

Deno.test("an unknown top-level concept is allowed", async () => {
    const root = await demoData();
    root.myBlock = { heading: "Hello", items: ["one", "two"] };
    assertEquals(report(root), "");
});

// ---------------------------------------------------------------------------
// The terms: a folder of Markdown files, one per language.

Deno.test("the demo's terms are read as Markdown files and pass", async () => {
    const root = await demoData();
    assertEquals(Object.keys(root.terms), ["en"], "one file, keyed by its name");
    assertEquals(root.terms.en.label, "English");
    assert(root.terms.en.content.includes("### Registration and payment"), "the body is the Markdown after the front matter");
    assertEquals(report(root), "");
});

Deno.test("a problem inside a terms version names that version's file, with the key path inside it", async () => {
    await expectRejected((d) => { delete d.terms.en.title; }, "src/_data/terms/en.md: title: missing (expected string)");
    await expectRejected((d) => { d.terms.en.lang = "en"; }, "src/_data/terms/en.md: lang: Unrecognized key");
    await expectRejected((d) => { d.terms.en.order = "first"; }, "src/_data/terms/en.md: order:", "number");
});

Deno.test("a terms file not named by a language tag is rejected", async () => {
    await expectRejected(
        (d) => { d.terms.EN = d.terms.en; delete d.terms.en; },
        "src/_data/terms/: EN:",
        "BCP 47 language tag",
    );
});

Deno.test("a terms folder with no files is rejected", async () => {
    await expectRejected((d) => { d.terms = {}; }, "src/_data/terms/:", "at least one version");
});

Deno.test("the missing terms concept names the Markdown folder, not a YAML file", async () => {
    const root = await demoData();
    delete root.terms;
    const output = new DataError(validate(root, files, { required: new Set(["terms"]) })).message;
    assert(output.includes("terms (missing)"), output);
    assert(output.includes("add src/_data/terms/<lang>.md"), output);
    assert(!output.includes("terms.yaml"), output);
});

// ---------------------------------------------------------------------------
// The single-definition rule needs the source tree.

const eventYaml = [
    `name: ${JSON.stringify(event.name)}`,
    `city: ${JSON.stringify(event.city)}`,
    `year: ${event.year}`,
    `date:`,
    `  iso: ${JSON.stringify(event.date.iso)}`,
    `  label: ${JSON.stringify(event.date.label)}`,
    `timezone: ${JSON.stringify(event.timezone)}`,
    "",
].join("\n");

Deno.test("a key defined in the root data file and in its own file fails the build", async () => {
    const output = await buildError({
        files: { "_data.yaml": "event:\n  name: X\n", "_data/event.yaml": eventYaml, "index.vto": "<p>x</p>\n" },
    });
    assert(output.includes("src/_data.yaml"), output);
    assert(output.includes("src/_data/event.yaml"), output);
    assert(output.includes('"event"'), output);
    assert(!output.includes("src/_data/event.yaml: "), `no shape errors for a duplicated key; got:\n${output}`);
});

Deno.test("a concept defined in two files with different extensions fails the build", async () => {
    const output = await buildError({
        files: { "_data/event.json": "{}\n", "_data/event.yaml": eventYaml, "index.vto": "<p>x</p>\n" },
    });
    assert(output.includes("src/_data/event.json"), output);
    assert(output.includes("src/_data/event.yaml"), output);
    assert(output.includes('"event"'), output);
});

Deno.test("in a real build, a problem in a terms file is reported against that file", async () => {
    const output = await buildError({
        files: {
            "_data/terms/hu.md": "---\nlabel: Magyar\n---\n### Egy\n",
            "_data/terms/en.md": "---\nlabel: English\ntitle: Terms\n---\n### One\n",
            "_data/terms/EN-GB.md": "---\nlabel: British\ntitle: Terms\n---\n### One\n",
            "index.vto": "<p>x</p>\n",
        },
    });
    assert(output.includes("src/_data/terms/hu.md: title: missing (expected string)"), output);
    assert(output.includes("src/_data/terms/EN-GB.md: "), output);
    assert(output.includes("BCP 47"), output);
    assert(!output.includes("src/_data/terms/en.md"), `the valid file is not mentioned; got:\n${output}`);
});

// ---------------------------------------------------------------------------
// The programme: agenda, speakers and patches (docs/theme-reference.md).

Deno.test("the demo's agenda and speakers pass, and the agenda's flags are optional", async () => {
    const root = await demoData();
    assert(Array.isArray(root.speakers) && root.speakers.length === 10, "speakers.yaml is a list at the root (Sessionize's sample event)");
    assertEquals(root.agenda.sessions.filter((s: { keynote?: boolean }) => s.keynote).length, 0, "the sample event has no Keynote checkbox: the import marks none");
    assertEquals(root.patches.agenda.sessions.filter((s: { keynote?: boolean }) => s.keynote).length, 2, "the opening and the closing keynote are patches");
    assertEquals(report(root), "");
    delete root.patches;
    assertEquals(report(root), "", "the import alone is valid too");
});

Deno.test("a session naming a speaker or a room that does not exist is reported in agenda.yaml with the key path", async () => {
    await expectRejected(
        (d) => {
            d.agenda.sessions[1].speakers.push("nobody");
            d.agenda.sessions[2].room = "Hall Z";
        },
        'src/_data/agenda.yaml: sessions[1].speakers[1]: no speaker with id "nobody" in speakers',
        'src/_data/agenda.yaml: sessions[2].room: "Hall Z" is not in rooms',
    );
});

Deno.test("a duplicate id, a start without an end, an end before its start", async () => {
    await expectRejected(
        (d) => {
            delete d.patches; // the demo's patches set the times; the checks here are on the import
            d.agenda.sessions[1].id = d.agenda.sessions[0].id;
            delete d.agenda.sessions[2].end;
            d.agenda.breaks[0].end = "2023-09-16T07:00:00";
            d.speakers[1].id = d.speakers[0].id;
        },
        "src/_data/agenda.yaml: sessions[1].id: duplicate id",
        "src/_data/agenda.yaml: sessions[2].end: missing: start and end go together",
        "src/_data/agenda.yaml: breaks[0].end: must be after start",
        'src/_data/speakers.yaml: [1].id: duplicate id "00000000-0000-0000-0000-000000000004"',
    );
});

Deno.test("an unquoted time, a bad id, an unknown link network and a wrong flag type are shape errors", async () => {
    await expectRejected(
        (d) => {
            d.agenda.sessions[0].start = new Date("2030-05-15T09:00:00Z");
            d.agenda.sessions[1].id = "has spaces";
            d.agenda.sessions[2].cancelled = "yes";
            d.speakers[0].links.linkedIn = d.speakers[0].links.linkedin;
        },
        "src/_data/agenda.yaml: sessions[0].start: must be a quoted ISO 8601 string",
        "src/_data/agenda.yaml: sessions[1].id: must be letters, digits",
        "src/_data/agenda.yaml: sessions[2].cancelled:",
        "src/_data/speakers.yaml: [0].links.linkedIn: Unrecognized key",
    );
});

Deno.test("a break cannot carry speakers or a keynote flag, and needs its times", async () => {
    await expectRejected(
        (d) => {
            d.agenda.breaks[0].speakers = [];
            d.agenda.breaks[0].keynote = true;
            d.agenda.breaks.push({ title: "Coffee", end: "2023-09-16T15:00:00" });
        },
        "src/_data/agenda.yaml: breaks[0].speakers: Unrecognized key",
        "src/_data/agenda.yaml: breaks[0].keynote: Unrecognized key",
        "src/_data/agenda.yaml: breaks[1].start: missing",
    );
});

Deno.test("patches: valid ones pass and the checks see the patched data", async () => {
    const root = await demoData();
    root.patches = {
        agenda: { sessions: [{ id: "14024", cancelled: true }], breaks: [{ id: "lunch", icon: "fa-utensils" }] },
        speakers: [{ id: "00000000-0000-0000-0000-000000000004", photo: "/assets/keynotes/aiden-test.jpg", links: null }],
    };
    root.agenda.breaks[0].id = "lunch";
    assertEquals(report(root), "");

    // A patched room must be in rooms like any other; the issue points at the patch.
    root.patches.agenda.sessions.push({ id: "14020", room: "Hall Z", speakers: ["nobody"] });
    const output = report(root);
    assert(output.includes('src/_data/patches/agenda.yaml: sessions[1].room: "Hall Z" is not in rooms'), output);
    assert(output.includes('src/_data/patches/agenda.yaml: sessions[1].speakers[0]: no speaker with id "nobody"'), output);
});

Deno.test("patches: an id no record has is reported in the patch file", async () => {
    const root = await demoData();
    root.patches = {
        agenda: { sessions: [{ id: "no-such-talk", cancelled: true }], breaks: [{ id: "lunch", icon: "fa-utensils" }] },
        speakers: [{ id: "zed", name: "Zed" }],
    };
    const output = report(root);
    for (const needle of [
        'src/_data/patches/agenda.yaml: sessions[0].id: no session with id "no-such-talk" to patch',
        'src/_data/patches/agenda.yaml: breaks[0].id: no break with id "lunch" to patch',
        'src/_data/patches/speakers.yaml: [0].id: no speaker with id "zed" to patch',
    ]) {
        assert(output.includes(needle), `the report must mention ${JSON.stringify(needle)}; got:\n${output}`);
    }
});

Deno.test("patches: a key the record has not (once, not also as an id alone), a null where the record needs a value, an id alone", async () => {
    const root = await demoData();
    root.patches = {
        agenda: { sessions: [{ id: "gitops-in-practice", canceled: true }, { id: "observability-on-a-budget" }] },
        speakers: [{ id: "ada-example", name: null }],
    };
    const output = report(root);
    assertEquals(
        output,
        [
            "Data validation failed (3 issues):",
            "  src/_data/patches/agenda.yaml: sessions[0].canceled: Unrecognized key",
            "  src/_data/patches/agenda.yaml: sessions[1]: a patch needs at least one field besides the id",
            "  src/_data/patches/speakers.yaml: [0].name: Invalid input: expected string, received null",
        ].join("\n"),
    );
});

Deno.test("the programme is optional: without agenda and speakers nothing is checked; speakers alone are fine", async () => {
    const root = await demoData();
    delete root.agenda;
    delete root.speakers;
    delete root.patches; // they name the agenda's ids
    assertEquals(report(root), "");
    root.speakers = [{ id: "solo", name: "Solo Speaker" }];
    assertEquals(report(root), "");
});

Deno.test("sessionize.yaml holds the endpoint only; the old switches are rejected", async () => {
    const root = await demoData();
    root.sessionize = { endpoint: "abc123", agenda: true };
    assert(report(root).includes("src/_data/sessionize.yaml: agenda: Unrecognized key"));
    root.sessionize = { endpoint: "abc123" };
    assertEquals(report(root), "");
});

Deno.test("a nav link takes enabled: false and no longer a sessionize switch", async () => {
    const root = await demoData();
    root.nav.main[1].enabled = false;
    assertEquals(report(root), "");
    root.nav.main[1].sessionize = "agenda";
    assert(report(root).includes("src/_data/nav.yaml: main[1].sessionize: Unrecognized key"));
});

// ---------------------------------------------------------------------------
// The venue: facts only; the page's copy is not data.

Deno.test("venue: the demo's facts pass; photos and map are optional; the old copy and card keys are rejected", async () => {
    const root = await demoData();
    assertEquals(Object.keys(root.venue).sort(), ["address", "building", "coordinates", "highlights", "image", "map", "name", "photos", "summary", "website"]);
    assertEquals(report(root), "");

    delete root.venue.photos;
    delete root.venue.map;
    assertEquals(report(root), "", "a venue without photos or a transit planner is fine");

    await expectRejected(
        (d) => {
            d.venue.intro = "Copy.";
            d.venue.transport = [];
            d.venue.helpUrl = "https://example.com";
            d.venue.map.embedUrl = "not a url";
        },
        "src/_data/venue.yaml: intro: Unrecognized key",
        "src/_data/venue.yaml: transport: Unrecognized key",
        "src/_data/venue.yaml: helpUrl: Unrecognized key",
        "src/_data/venue.yaml: map.embedUrl:",
    );
});

Deno.test("keynotes and organizers hold the people; the section's intro is the page's and is rejected as data", async () => {
    const root = await demoData();
    assertEquals(Object.keys(root.keynotes), ["speakers"]);
    assertEquals(Object.keys(root.organizers), ["people"]);
    await expectRejected(
        (d) => {
            d.keynotes.intro = "Two leaders.";
            d.organizers.intro = "Volunteers.";
        },
        "src/_data/keynotes.yaml: intro: Unrecognized key",
        "src/_data/organizers.yaml: intro: Unrecognized key",
    );
});

// ---------------------------------------------------------------------------
// Links to pages: `page: <id>` in nav, checked against the pages' ids.

Deno.test("nav: a link is a page or a url; a url needs a label; a page may leave the label to the page's title", async () => {
    const root = await demoData();
    assertEquals(root.nav.main[1], { page: "agenda", icon: "fa-calendar-days" }, "the demo's agenda entry names the page and has no label");
    assertEquals(report(root), "", "without page ids to check against, the shape alone passes");
    await expectRejected(
        (d) => {
            d.nav.main[0] = { page: "home", url: "/", label: "Home", icon: "fa-house" };
            d.nav.main[1] = { icon: "fa-calendar-days" };
            d.nav.secondary[0] = { url: "/imprint/" };
            d.nav.cta = { label: "Go", icon: "fa-ticket" };
        },
        "src/_data/nav.yaml: main[0].url: a link is either a `page`",
        "src/_data/nav.yaml: main[1].page: a link is either a `page`",
        "src/_data/nav.yaml: secondary[0].label: missing: a `url` link has no page title",
        "src/_data/nav.yaml: cta.page: a link is either a `page`",
    );
});

Deno.test("nav: with the pages' ids known, a page no page declares is reported with the key", async () => {
    const root = await demoData();
    const ids = new Set(["home", "agenda", "speakers", "venue", "tickets", "sponsors", "imprint", "terms"]);
    assertEquals(validate(root, files, { pageIds: ids }), []);
    root.nav.main[1].page = "agneda";
    root.nav.cta.page = "ticket";
    const output = new DataError(validate(root, files, { pageIds: ids })).message;
    assert(output.includes('src/_data/nav.yaml: main[1].page: no page declares `id: agneda` in its front matter'), output);
    assert(output.includes('src/_data/nav.yaml: cta.page: no page declares `id: ticket` in its front matter'), output);
});

Deno.test("in a real build, a nav page id is checked against every page source, drafts included, and two pages cannot share an id", async () => {
    const nav = `main:\n  - page: agenda\n    icon: "fa-calendar-days"\n  - page: nowhere\n    icon: "fa-house"\nsecondary: []\ncta:\n  label: "Tickets"\n  page: tickets\n  icon: "fa-ticket"\n`;
    const files = {
        "_data/event.yaml": eventYaml,
        "_data/nav.yaml": nav,
        "index.vto": "---\nid: home\n---\n<p>x</p>\n",
        "agenda.vto": "---\nid: agenda\ndraft: true\n---\n<p>agenda</p>\n",
        "tickets.vto": "---\nid: tickets\n---\n<p>tickets</p>\n",
    };
    const output = await buildError({ files, theme: { schema: { required: [] } } });
    assert(output.includes("src/_data/nav.yaml: main[1].page: no page declares `id: nowhere`"), output);
    assert(!output.includes("agenda"), `a draft page's id counts; got:\n${output}`);

    const twice = await buildError({
        files: { ...files, "_data/nav.yaml": nav.replace("  - page: nowhere\n    icon: \"fa-house\"\n", ""), "other.vto": "---\nid: tickets\n---\n<p>again</p>\n" },
        theme: { schema: { required: [] } },
    });
    assert(twice.includes('page id "tickets" is declared by'), twice);
    assert(twice.includes("other.vto") && twice.includes("tickets.vto"), twice);
});
