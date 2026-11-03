/**
 * Layout tests: what a page gets from layouts/page.vto, layouts/home.vto,
 * layouts/site.vto and layouts/base.vto by opening with Vento's layout tag,
 * rendered in-process with the theme's defaults and the identity data in
 * ./fixtures.ts. The layouts are remote fallbacks here, as they are for a
 * site, so this also proves `{{ layout "layouts/..." }}` resolves through
 * the theme.
 *
 *     deno task test
 */

import { assert, assertEquals, assertExists, assertFalse } from "@std/assert";
import type { HTMLDocument } from "lume/deps/dom.ts";
import { build, buildError } from "./helpers.ts";
import { event, pageData } from "./fixtures.ts";

/** A page file: front matter, the layout tag, then the body. */
function page(frontMatter: Record<string, unknown>, layout: string, body = "<p>Body</p>"): string {
    const lines = Object.entries(frontMatter).map(([key, value]) => `${key}: ${JSON.stringify(value)}`);
    return ["---", ...lines, "---", `{{ layout "layouts/${layout}.vto" }}`, body, ""].join("\n");
}

/** Tag names of the matches in document order: what comes before <main>. */
function order(doc: HTMLDocument, selector: string): string[] {
    return [...doc.querySelectorAll(selector)].map((el) => el.tagName.toLowerCase());
}

Deno.test("layouts/page.vto: title and description, one menu bar before main, one main, one footer", async () => {
    const site = await build({
        files: { "about.vto": page({ title: "About", description: "Who we are" }, "page") },
        data: pageData,
    });
    const doc = site.dom("/about/");
    assertEquals(doc.querySelector("title")?.textContent, `About - ${event.name} ${event.year}`);
    assertEquals(doc.querySelector("meta[name=description]")?.getAttribute("content"), "Who we are");
    assertEquals(doc.querySelector("meta[property='og:description']")?.getAttribute("content"), "Who we are");
    assertEquals(doc.querySelectorAll("[data-menu]").length, 1, "the bar is the one menu");
    assertEquals(doc.querySelectorAll("main").length, 1);
    assertEquals(doc.querySelectorAll("footer").length, 1);
    assertEquals(order(doc, "body > header, body > main, body > footer"), ["header", "main", "footer"]);
    assertEquals(doc.querySelector("main")?.textContent.trim(), "Body");
});

Deno.test("layouts/base.vto: without a title or description the site title and share text are used", async () => {
    const site = await build({ files: { "index.vto": page({}, "page") }, data: pageData });
    const doc = site.dom("/");
    assertEquals(doc.querySelector("title")?.textContent, `${event.name} ${event.year}`);
    assertEquals(doc.querySelector("meta[name=description]"), null);
    assertEquals(doc.querySelector("meta[property='og:description']")?.getAttribute("content"), pageData.share.description);
});

Deno.test("the stylesheet is the site's: base.vto links /style.css, and a site without src/style.css fails the build naming it", async () => {
    const site = await build({ files: { "index.vto": page({}, "page") }, data: pageData });
    assertExists(site.dom("/").querySelector('link[rel=stylesheet][href="/style.css"]'));
    const output = await buildError({ files: { "index.vto": page({}, "page") }, data: pageData, stylesheet: false });
    assert(output.includes("src/style.css (missing)"), output);
    assert(output.includes("https://github.com/sagikazarmark/kcd-website-template/blob/main/src/style.css"), output);
});

Deno.test("the head slot reaches <head> through the whole layout chain, and is empty by default", async () => {
    const site = await build({
        files: {
            "with.vto": page({ title: "With" }, "page", `{{ slot head }}<meta name="x-test" content="slotted">{{ /slot }}<p>Body</p>`),
            "home.vto": page({ title: "Home" }, "home", `{{ slot head }}<meta name="x-test" content="home">{{ /slot }}{{ slot hero }}<p>Hero</p>{{ /slot }}<p>Body</p>`),
            "without.vto": page({ title: "Without" }, "page"),
        },
        data: pageData,
    });
    const slotted = site.dom("/with/");
    assertEquals(slotted.querySelector("head meta[name=x-test]")?.getAttribute("content"), "slotted");
    assertEquals(slotted.querySelectorAll("body meta[name=x-test]").length, 0, "the slot's content is not also in the body");
    assertEquals(slotted.querySelector("main")?.textContent.trim(), "Body", "the unslotted content is the body");
    assertEquals(site.dom("/home/").querySelector("head meta[name=x-test]")?.getAttribute("content"), "home", "three layouts deep as well");
    assertEquals(site.dom("/without/").querySelector("meta[name=x-test]"), null);
    assertFalse(site.html("/without/").includes("undefined"), "an unfilled slot renders nothing");
});

Deno.test("layouts/home.vto: the hero slot lands in a full-screen hero.frame before main, with the menu inside it", async () => {
    const site = await build({
        files: { "index.vto": page({}, "home", `{{ slot hero }}<p id="hero-content">Hero</p>{{ /slot }}<p>Body</p>`) },
        data: pageData,
    });
    const doc = site.dom("/");
    const hero = doc.querySelector("body > section");
    assertExists(hero, "the hero is the page header, outside main");
    assert(hero.className.includes("min-h-screen"), "full-screen");
    assertExists(hero.querySelector("#hero-content"), "the hero slot is the frame's content");
    assertEquals(hero.querySelectorAll("[data-menu]").length, 1, "the transparent menu is inside the hero");
    assertEquals(doc.querySelectorAll("[data-menu]").length, 1, "and there is no second one");
    assertEquals(hero.querySelector("[data-menu] img")?.getAttribute("src"), "/assets/logo-horizontal-white.svg", "white logo over the picture");
    assertEquals(order(doc, "body > section, body > main, body > footer"), ["section", "main", "footer"]);
    assertEquals(doc.querySelector("main")?.textContent.trim(), "Body", "the hero slot is not also in main");
    assertEquals(doc.querySelectorAll("footer").length, 1);
    assertFalse(site.html("/").includes("undefined"));
});

Deno.test("layouts/site.vto: a page writes its own header; without one there is none", async () => {
    const site = await build({
        files: {
            "banner.vto": page(
                { title: "Banner" },
                "site",
                `{{ slot header }}{{ comp.menu({ current: url }) }}{{ comp hero.frame { size: "md" } }}<p id="band">Band</p>{{ /comp }}{{ /slot }}<p>Body</p>`,
            ),
            "bare.vto": page({ title: "Bare" }, "site"),
        },
        data: pageData,
    });
    const banner = site.dom("/banner/");
    assertEquals(
        order(banner, "body > header, body > section, body > main, body > footer"),
        ["header", "section", "main", "footer"],
        "the bar, then the band, then main and the footer",
    );
    assertEquals(banner.querySelectorAll("[data-menu]").length, 1, "the bar is the one menu: the band was asked for none");
    assertEquals(banner.querySelector("[data-menu] img")?.getAttribute("src"), "/assets/logo-horizontal-color.svg", "the bar skin");
    assertExists(banner.querySelector("body > section #band"));
    assertEquals(banner.querySelector("main")?.textContent.trim(), "Body");

    const bare = site.dom("/bare/");
    assertEquals(bare.querySelectorAll("[data-menu]").length, 0, "no default header: site.vto renders what it is given");
    assertEquals(bare.querySelectorAll("footer").length, 1, "the footer is not optional");
    assertFalse(site.html("/bare/").includes("undefined"));
});
