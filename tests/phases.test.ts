/**
 * The demo's phases (demo/phases.ts): every phase builds, and
 * shows what its stage says it shows. The page matrix (which pages are in
 * the build), the hero's badge and the menu are asserted per phase, as a
 * table; the copy beyond that is the phase's own. The switcher that
 * build.ts puts on every page is tested as the pure functions it is made
 * of; the full build through Lume's CLI is CI's `deno task build`. The
 * showcase (showcase/) builds alongside: its pages, and every
 * component on its components page.
 */

import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { phases, showcase } from "../demo/phases.ts";
import { insert, landing, notFound, pagePath, SHOWCASE, switcher } from "../demo/build.ts";
import { buildSite, type Built } from "./helpers.ts";

const demo = new URL("../demo/", import.meta.url);

/** Every page a phase may have besides the home page, the showcase, terms, imprint and 404. */
const stagePages = ["/cfp-faq/", "/sponsors/", "/tickets/", "/attending/", "/speakers/", "/agenda/"];

/** Per phase: the stage pages in the build, the hero's badge, the menu's main links. */
const expected: Record<string, { pages: string[]; badge: string; menu: string[] }> = {
    "01-announced": { pages: [], badge: "Coming soon", menu: ["/", "/venue/"] },
    "02-cfp-open": { pages: ["/cfp-faq/"], badge: "Call for papers open", menu: ["/", "/venue/", "#"] },
    "03-sponsorship": { pages: ["/cfp-faq/", "/sponsors/"], badge: "Call for papers open", menu: ["/", "/venue/", "/sponsors/", "#"] },
    "04-sponsors": { pages: ["/cfp-faq/", "/sponsors/"], badge: "Call for papers open", menu: ["/", "/venue/", "/sponsors/", "#"] },
    "05-keynotes": { pages: ["/cfp-faq/", "/sponsors/"], badge: "Call for papers open", menu: ["/", "/venue/", "/sponsors/", "#"] },
    "06-early-bird": { pages: ["/sponsors/", "/tickets/", "/attending/"], badge: "Early-bird tickets available", menu: ["/", "/venue/", "/tickets/", "/sponsors/"] },
    "07-speakers": { pages: ["/sponsors/", "/tickets/", "/attending/", "/speakers/"], badge: "Early-bird tickets available", menu: ["/", "/speakers/", "/venue/", "/tickets/", "/sponsors/"] },
    "08-tickets": { pages: ["/sponsors/", "/tickets/", "/attending/", "/speakers/"], badge: "Tickets available", menu: ["/", "/speakers/", "/venue/", "/tickets/", "/sponsors/"] },
    "09-agenda": { pages: ["/sponsors/", "/tickets/", "/attending/", "/speakers/", "/agenda/"], badge: "Tickets available", menu: ["/", "/agenda/", "/speakers/", "/venue/", "/tickets/", "/sponsors/"] },
    "10-wrap": { pages: ["/speakers/", "/agenda/"], badge: "That's a wrap!", menu: ["/", "/agenda/", "/speakers/", "/venue/"] },
    "11-photos": { pages: ["/speakers/", "/agenda/"], badge: "That's a wrap!", menu: ["/", "/agenda/", "/speakers/", "/venue/"] },
    "12-recap": { pages: ["/speakers/", "/agenda/"], badge: "That's a wrap!", menu: ["/", "/agenda/", "/speakers/", "/venue/"] },
};

/** The main menu's links on the home page, in order, from the nav's panel; the legal links (nav.secondary, the same in every phase) left out. */
function menuLinks(site: Built): string[] {
    const home = site.dom("/");
    const panel = home.querySelector("header[data-menu] [data-menu-panel]");
    assert(panel, "the menu panel");
    return [...panel.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")!).filter((href) => href !== "/imprint/" && href !== "/terms/");
}

Deno.test("the phase list is the folders: twelve phases, announcement first, each folder a site, no slug a page's path", async () => {
    assertEquals(phases.length, 12);
    assertEquals(phases[0].folder, "announced");
    assertEquals(phases.map((p) => p.slug), Object.keys(expected));
    for (const phase of phases) assert(/^\d\d-/.test(phase.slug), `${phase.slug}: numbered, so Lume's base path cannot mistake a page for it`);
    for (const phase of phases) {
        const config = new URL(`${phase.folder}/_config.ts`, demo);
        assert((await Deno.stat(config)).isFile, `${phase.slug}: ${phase.folder}/_config.ts`);
    }
});

for (const phase of phases) {
    const want = expected[phase.slug];
    Deno.test(`phase ${phase.slug} builds and shows its stage`, async () => {
        const site = await buildSite(new URL(`${phase.folder}/`, demo));
        assert(site.has("/") && site.has("/404.html") && site.has("/venue/") && site.has("/terms/") && site.has("/imprint/"), "the pages every phase has");
        for (const url of stagePages) {
            assertEquals(site.has(url), want.pages.includes(url), `${phase.slug}: ${url} ${want.pages.includes(url) ? "in" : "not in"} the build`);
        }
        const hero = site.dom("/").querySelector("h1")?.parentElement;
        assert(hero, "the hero");
        assertStringIncludes(hero.textContent, want.badge, `${phase.slug}: the hero's badge`);
        assertEquals(menuLinks(site), want.menu, `${phase.slug}: the menu`);
        if (["wrap", "photos", "recap"].includes(phase.folder)) {
            const home = site.dom("/");
            const hasPhotos = phase.folder !== "wrap";
            const complete = phase.folder === "recap";
            assertEquals(home.querySelectorAll("#event-gallery [data-dialog-open]").length, hasPhotos ? 3 : 0);
            assertEquals(site.has("/pictures/"), hasPhotos);
            assertEquals(home.querySelectorAll("#resources a").length, complete ? 2 : 0);
            assertEquals(!!home.querySelector("#film video[controls]"), complete);
            assertEquals(site.has("/transparency/"), complete);
            assertEquals(home.querySelectorAll('a[aria-disabled="true"]').length, hasPhotos ? 0 : 2);
        }
    });
}

Deno.test("the showcase builds: its pages, and every component on the components page", async () => {
    const site = await buildSite(new URL(`${showcase.folder}/`, demo));
    for (const url of ["/", "/components/", "/agenda/", "/terms/", "/home/big-hero/", "/home/banner/", "/home/plain/", "/home/recap/", "/home/pending/", "/pictures/", "/transparency/", "/404.html"]) {
        assert(site.has(url), `the showcase has ${url}`);
    }
    assertEquals(
        [...site.dom("/terms/").querySelectorAll("[data-language-tab]")].map((a) => a.getAttribute("data-language-tab")),
        ["en", "la"],
        "the terms page shows the language switch over two versions, English first",
    );
    const doc = site.dom("/components/");
    assert(!site.html("/components/").includes("undefined"), "no component rendered as undefined");
    for (const selector of [
        "[data-countdown]",
        "[data-until]",
        "[data-dialog-open^=speaker-]",
        "dialog[id^=speaker-]",
        "[data-dialog-open^=session-]",
        "dialog[id^=session-]",
        "[data-dialog-open^=keynote-]",
        "[data-dialog-open^=organizer-]",
        "[data-package]",
        "[data-teaser]",
        "pretix-widget",
        "#badge-tool",
        "details",
        "[data-draft]",
        "#showcase-dialog",
        "#sample-gallery [data-dialog-open]",
        "#pending-resource",
        "#published-resource a",
        "#partial-resource a",
    ]) {
        assert(doc.querySelector(selector), `components page renders ${selector}`);
    }
    assertStringIncludes(doc.querySelector("main")!.textContent, "Keynote to be announced", "the keynote placeholder");
    const menu = menuLinks(site);
    assertEquals(menu, ["/", "/components/", "/agenda/", "/home/big-hero/", "/home/banner/", "/home/plain/", "/home/recap/", "/home/pending/"], "the showcase's own menu");
    assertEquals(site.dom("/home/pending/").querySelectorAll('a[aria-disabled="true"]').length, 2);
});

Deno.test("the switcher: the same page in the phase before and after, the list with the current one marked", () => {
    const bar = switcher(phases, 4, "/sponsors/");
    assertStringIncludes(bar, `<a rel="prev" href="/04-sponsors/sponsors/">`);
    assertStringIncludes(bar, `<a rel="next" href="/06-early-bird/sponsors/">`);
    assertStringIncludes(bar, `Phase 5 of 12 · <strong>Keynotes announced</strong>`);
    assertStringIncludes(bar, `<a href="/05-keynotes/sponsors/" aria-current="page">5. Keynotes announced</a>`);
    assertEquals(bar.match(/<li>/g)?.length, 12, "a list entry per phase");

    const first = switcher(phases, 0, "/");
    assert(!first.includes('rel="prev"'), "no previous on the first phase");
    assertStringIncludes(first, `<a rel="next" href="/02-cfp-open/">`);
    const last = switcher(phases, phases.length - 1, "/agenda/");
    assert(!last.includes('rel="next"'), "no next on the last phase");

    const root = switcher(phases, -1, "/");
    assertStringIncludes(root, "Pick a phase");
    assert(!root.includes('aria-current="page"'), "no current phase at the root");

    // The showcase is listed after the phases, never as a phase; on its own
    // pages it is current, with the last phase's home as the way back.
    assertStringIncludes(bar, `<li class="kcd-phases-extra"><a href="/showcase/">Showcase</a></li>`);
    const gallery = switcher(phases, SHOWCASE, "/");
    assertStringIncludes(gallery, "<strong>Showcase</strong>");
    assert(!gallery.includes("Phase "), "not a phase");
    assertStringIncludes(gallery, `<a rel="prev" href="/12-recap/">`);
    assert(!gallery.includes('rel="next"'), "nothing after the showcase");
    assertStringIncludes(gallery, `<a href="/showcase/" aria-current="page">Showcase</a>`);
});

Deno.test("pagePath and insert: the path a page has in every phase, the bar before </body>", () => {
    assertEquals(pagePath("index.html"), "/");
    assertEquals(pagePath("tickets/index.html"), "/tickets/");
    assertEquals(pagePath("404.html"), "/404.html");
    assertEquals(insert("<html><body><p>x</p></body></html>", "<nav>bar</nav>"), "<html><body><p>x</p><nav>bar</nav>\n</body></html>");
    assertEquals(insert("<p>no body</p>", "<nav>bar</nav>"), "<p>no body</p>", "a document without </body> is left alone");
});

Deno.test("the landing page and the 404 list every phase and carry the bar", () => {
    for (const html of [landing(phases), notFound(phases)]) {
        for (const phase of phases) assertStringIncludes(html, `href="/${phase.slug}/"`);
        assertStringIncludes(html, `<nav class="kcd-phases"`);
    }
    assertStringIncludes(landing(phases), `href="/${showcase.slug}/"`, "the landing page leads to the showcase");
    assertStringIncludes(landing(phases), phases[0].summary.replaceAll('"', "&quot;"));
    assertStringIncludes(notFound(phases), "Not in this phase");
});
