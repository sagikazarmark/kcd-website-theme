/**
 * Component tests: each renders one component in-process with the data it
 * reads and asserts on the resulting DOM. A test here states what a
 * component promises a page that calls it (an attribute, an initial state,
 * what disappears when), not how it is styled.
 *
 *     deno task test
 */

import { assert, assertEquals, assertExists, assertFalse } from "@std/assert";
import { z } from "npm:zod@4.6.7";
import { build, render } from "./helpers.ts";
import { agenda, cfp, event, footer, hero, nav, programData, social, venue } from "./fixtures.ts";

const past = "2020-01-01T00:00:00+01:00";
const future = "2099-01-01T00:00:00+01:00";

/**
 * A `venue` with just a name, for the hero intro's venue line: the real
 * concept is the whole venue page's data, far more than one line reads.
 */
const venueName = z.object({ name: z.string() });

// ---------------------------------------------------------------------------
// Timed content

Deno.test("ui.until / ui.after: initial state follows the build clock", async () => {
    const doc = await render(`
        {{ comp ui.until { time: "${past}" } }}before-past{{ /comp }}
        {{ comp ui.after { time: "${past}" } }}after-past{{ /comp }}
        {{ comp ui.until { time: "${future}" } }}before-future{{ /comp }}
        {{ comp ui.after { time: "${future}" } }}after-future{{ /comp }}
    `);
    const state = (selector: string) => {
        const el = doc.querySelector(selector);
        assertExists(el, `${selector} must render`);
        return el.hasAttribute("hidden");
    };
    assert(state(`[data-until="${past}"]`), "a passed deadline hides the until half");
    assertFalse(state(`[data-after="${past}"]`), "a passed deadline shows the after half");
    assertFalse(state(`[data-until="${future}"]`), "a future deadline shows the until half");
    assert(state(`[data-after="${future}"]`), "a future deadline hides the after half");
});

Deno.test("ui.text: a string renders as-is, a timed object renders both halves", async () => {
    const plain = await render(`{{ comp.ui.text({ value: "Tickets available" }) }}`);
    assertEquals(plain.body.textContent.trim(), "Tickets available");
    assertEquals(plain.querySelectorAll("[data-until], [data-after]").length, 0);

    const timed = await render(
        `{{ comp.ui.text({ value: { html: "CFP open", until: "${future}", after: "CFP closed" } }) }}`,
    );
    assertEquals(timed.querySelector("[data-until]")?.textContent, "CFP open");
    assertEquals(timed.querySelector("[data-after]")?.textContent, "CFP closed");
    assert(timed.querySelector("[data-after]")?.hasAttribute("hidden"), "the after half waits for the deadline");
});

// ---------------------------------------------------------------------------
// Countdown

Deno.test("ui.countdown: the timer carries its deadline and the deadline is shown in the event's time zone", async () => {
    const deadline = "2030-01-31T23:59:59+01:00";
    const doc = await render(
        `{{ comp.ui.countdown({
            deadline: "${deadline}",
            heading: "Time left to submit",
            statusPrefix: "CFP closes",
            expiredHeading: "CFP closed",
            expiredStatus: "Thanks",
            ariaSuffix: "left to submit",
        }) }}`,
        { data: { event } },
    );
    const timer = doc.querySelector("[data-countdown]");
    assertExists(timer);
    assertEquals(timer.getAttribute("data-deadline"), deadline);
    assertEquals(doc.querySelector("[data-countdown-heading]")?.textContent.trim(), "Time left to submit");
    assertEquals(doc.querySelector("time")?.getAttribute("datetime"), deadline);
    assertEquals(doc.querySelector("time")?.textContent.trim(), "31 January at 23:59 CET");
    for (const unit of ["days", "hours", "minutes", "seconds"]) {
        assertExists(doc.querySelector(`[data-countdown-${unit}]`), `a ${unit} digit`);
    }
});

// ---------------------------------------------------------------------------
// FAQ

Deno.test("faq.list: one closed <details> per item, the answer as rendered Markdown, nothing without items", async () => {
    const list = (props: string) => `{{ comp.faq.list({ ${props} }) }}`;

    const doc = await render(list(`items: ${JSON.stringify(cfp.faq)}, id: "cfp-faq"`));
    const card = doc.querySelector("#cfp-faq");
    assertExists(card, "the id prop lands on the card");
    const items = [...card.querySelectorAll("details")];
    assertEquals(items.length, cfp.faq.length, "one <details> per question");
    assertEquals(
        items.map((d) => d.querySelector("summary")?.textContent.trim()),
        cfp.faq.map((q) => q.question),
        "the question is the <summary>, in order",
    );
    assertFalse(items.some((d) => d.hasAttribute("open")), "every item starts closed");

    const answer = items[1].querySelector(".markdown-body");
    assertExists(answer, "the answer sits in a markdown-body container");
    assertExists(answer.querySelector("strong"), "Markdown emphasis is rendered");
    assertEquals(answer.querySelector("a")?.getAttribute("href"), "/agenda/", "Markdown links are rendered");
    assertEquals(answer.querySelectorAll("li").length, 2, "Markdown lists are rendered");
    assertFalse(answer.textContent.includes("**"), "no Markdown syntax leaks into the text");

    // The list reads no global: `cfp` in the data is not picked up by itself.
    const none = await render(list(``), { data: { cfp } });
    assertEquals(none.querySelectorAll("details").length, 0, "no items prop, nothing");
    const empty = await render(list(`items: []`));
    assertEquals(empty.querySelectorAll("details, div").length, 0, "an empty list renders nothing, not an empty card");
});

Deno.test("faq.item: a single question on its own; `open` renders it expanded", async () => {
    const doc = await render(
        `{{ comp.faq.item({ question: "Is there parking?", answer: "Yes, see [the venue](/venue/).", open: true }) }}`,
    );
    const item = doc.querySelector("details");
    assertExists(item);
    assert(item.hasAttribute("open"), "open: true renders the item expanded");
    assertEquals(item.querySelector("summary")?.textContent.trim(), "Is there parking?");
    assertEquals(item.querySelector(".markdown-body a")?.getAttribute("href"), "/venue/");
});

// ---------------------------------------------------------------------------
// Heading

Deno.test("ui.heading: pill and lede take plain or timed text", async () => {
    const plain = await render(`{{ comp.ui.heading({ pill: "Keynotes", title: "Speakers", lede: "Our <em>guests</em>." }) }}`);
    assertEquals(plain.querySelector("span")?.textContent.trim(), "Keynotes");
    assertEquals(plain.querySelector("h2")?.textContent.trim(), "Speakers");
    assertExists(plain.querySelector("p em"), "the lede may carry inline HTML");
    assertEquals(plain.querySelectorAll("[data-until], [data-after]").length, 0, "plain text is not wrapped");

    const timed = await render(
        `{{ comp.ui.heading({
            level: 1,
            pill: { html: "Open", until: "${future}", after: "Closed" },
            title: "CFP",
            lede: { html: "Submit by the deadline.", until: "${future}", after: "Thank you." },
        }) }}`,
    );
    assertEquals(timed.querySelector("h1")?.textContent.trim(), "CFP");
    assertEquals(timed.querySelector("span [data-until]")?.textContent, "Open");
    assertEquals(timed.querySelector("span [data-after]")?.textContent, "Closed");
    assert(timed.querySelector("span [data-after]")?.hasAttribute("hidden"), "the closed pill waits for the deadline");
    assertEquals(timed.querySelector("p [data-until]")?.textContent, "Submit by the deadline.");
    assertEquals(timed.querySelector("p [data-after]")?.textContent, "Thank you.");
});

// ---------------------------------------------------------------------------
// Social links

const links = { github: "https://example.com/gh", discord: "https://example.com/dc", x: "https://example.com/x" };

/**
 * A per-link render function as the two link components take it: one <a>
 * carrying every value it is handed, plus `owner` from the page's own scope,
 * which is what a function (unlike a template string) can see.
 */
const linkFunction = `
    {{ set owner = "Ada" }}
    {{ async function link({ key, label, icon, link }) }}
        <a href="{{ link }}" data-key="{{ key }}" aria-label="{{ owner }} on {{ label }}">{{ comp.ui.icon({ name: icon }) }}</a>
    {{ /function }}`;

Deno.test("ui.socialLinks: calls render once per network in the map, in canonical order, filterable, nothing without a map", async () => {
    const all = await render(`${linkFunction}{{ comp.ui.socialLinks({ links: ${JSON.stringify(links)}, render: link }) }}`);
    const anchors = [...all.querySelectorAll("a")];
    assertEquals(anchors.map((a) => a.getAttribute("href")), [links.discord, links.x, links.github], "canonical order, not map order");
    assertEquals(anchors.map((a) => a.getAttribute("data-key")), ["discord", "x", "github"]);
    assertEquals(anchors.map((a) => a.getAttribute("aria-label")), ["Ada on Discord", "Ada on X", "Ada on GitHub"], "the caller's scope is visible");
    assertEquals(
        anchors.map((a) => a.querySelector("i")?.getAttribute("class")),
        ["fa-brands fa-discord", "fa-brands fa-x-twitter", "fa-brands fa-github"],
        "the icon as ui.icon takes it",
    );
    assertFalse(all.body.textContent.includes("undefined"));

    const some = await render(
        `${linkFunction}{{ comp.ui.socialLinks({ links: ${JSON.stringify(links)}, networks: ["x", "github", "mastodon"], render: link }) }}`,
    );
    assertEquals(
        [...some.querySelectorAll("a")].map((a) => a.getAttribute("href")),
        [links.x, links.github],
        "filtered to the list; networks not in the map are skipped",
    );

    // The event's own networks are the same call with the `social` concept
    // as the map: no global is read.
    const event = await render(`${linkFunction}{{ comp.ui.socialLinks({ links: social, render: link }) }}`, { data: { social } });
    assertEquals([...event.querySelectorAll("a")].map((a) => a.getAttribute("href")), [social.discord, social.x, social.linkedin]);

    const none = await render(`${linkFunction}{{ comp.ui.socialLinks({ render: link }) }}`, { data: { social } });
    assertEquals(none.querySelectorAll("a").length, 0, "no links prop, nothing: `social` is not read implicitly");
});

// ---------------------------------------------------------------------------
// Navigation links

/**
 * A per-link render function as ui.navLinks takes it: one <a> carrying every
 * value it is handed. `index` counts the shown links, so a separator before
 * all but the first is right even when an earlier link is gated out.
 */
const navFunction = `
    {{ async function link({ url, label, icon, active, index, draft }) }}
        {{ if index > 0 }}<span class="sep"></span>{{ /if }}
        <a href="{{ url }}" data-active="{{ active }}" data-index="{{ index }}"{{ if draft }} data-draft="true"{{ /if }}>{{ if icon }}{{ comp.ui.icon({ name: icon }) }}{{ /if }}{{ label }}</a>
    {{ /function }}`;

Deno.test("ui.navLinks: calls render once per link, drops enabled: false, active from current, index over the shown links", async () => {
    // Agenda and Speakers carry `enabled: false`: left out, and the index does
    // not count them.
    const off = await render(`${navFunction}{{ comp.ui.navLinks({ links: nav.main, current: "/venue/", render: link }) }}`, {
        data: { nav },
    });
    const anchors = [...off.querySelectorAll("a")];
    assertEquals(anchors.map((a) => a.getAttribute("href")), ["/", "/venue/", "/tickets/"], "disabled links are skipped");
    assertEquals(anchors.map((a) => a.getAttribute("data-index")), ["0", "1", "2"], "index counts the shown links");
    assertEquals(anchors.map((a) => a.getAttribute("data-active")), ["false", "true", "false"], "active is current == url");
    assertEquals(off.querySelectorAll(".sep").length, 2, "one separator between each pair");
    assertEquals(anchors[0].querySelector("i")?.getAttribute("class"), "fas fa-house", "the icon as ui.icon takes it");
    assertFalse(off.body.textContent.includes("undefined"));

    // Agenda re-enabled (the key dropped, as when the page is published): shown; an explicit `enabled: true` too.
    const main = nav.main.map((item) => item.url === "/agenda/" ? { ...item, enabled: true } : item);
    const agendaOn = await render(`${navFunction}{{ comp.ui.navLinks({ links: nav.main, render: link }) }}`, {
        data: { nav: { ...nav, main } },
    });
    assertEquals(
        [...agendaOn.querySelectorAll("a")].map((a) => a.getAttribute("href")),
        ["/", "/agenda/", "/venue/", "/tickets/"],
    );
    assertEquals([...agendaOn.querySelectorAll("a[data-active=true]")].length, 0, "no current, nothing active");

    // nav.secondary entries have no icon and no gate.
    const secondary = await render(`${navFunction}{{ comp.ui.navLinks({ links: nav.secondary, render: link }) }}`, { data: { nav } });
    assertEquals([...secondary.querySelectorAll("a")].map((a) => a.textContent), ["Imprint", "Terms"]);
    assertEquals(secondary.querySelectorAll("i").length, 0, "no icon, no glyph");

    // No list: nothing, not an error.
    const none = await render(`${navFunction}{{ comp.ui.navLinks({ render: link }) }}`);
    assertEquals(none.querySelectorAll("a").length, 0);
});

Deno.test("menu: every enabled nav.main entry is a panel link, a link out opens in a new tab, no entry is special", async () => {
    const main = [
        ...nav.main,
        { label: "Submit a talk", url: "https://example.com/cfp", icon: "fa-microphone-lines" },
        { label: "Closed call", url: "https://example.com/old-cfp", icon: "fa-microphone-lines", enabled: false },
    ];
    const doc = await render(`{{ comp.menu({ current: "/venue/" }) }}`, { data: { event, nav: { ...nav, main } } });
    const links = [...doc.querySelector("#site-menu ul")!.querySelectorAll("a")];
    assertEquals(links.map((a) => a.textContent.trim()), ["Home", "Venue", "Tickets", "Submit a talk"], "enabled entries in data order; nothing added");
    const out = links.find((a) => a.textContent.includes("Submit a talk"))!;
    assertEquals(out.getAttribute("target"), "_blank", "an absolute URL opens in a new tab");
    assertEquals(out.getAttribute("rel"), "noopener noreferrer");
    assertEquals(links[1].getAttribute("target"), null, "a site path does not");
    assertEquals(links[1].getAttribute("aria-current"), "page");
    assertFalse(doc.body.textContent.includes("undefined"));
});

// ---------------------------------------------------------------------------
// Footer (a partial in _includes/partials, not a component)

Deno.test("partials/footer.vto: copyright from event, links from social and nav.secondary, logo from footer.logo or logo.vertical.white", async () => {
    // The theme ships a default footer.yaml, a remote file that wins over a
    // `data` global, so a footer of the test's own is a file under _data/.
    const footerYaml = `logo: "${footer.logo}"\ntext: "${footer.text}"\n`;
    const partial = `{{ include "partials/footer.vto" }}\n<!-- render -->\n`;
    const own = await build({ files: { "index.vto": partial, "_data/footer.yaml": footerYaml }, data: { event, social, nav } });
    const doc = own.dom("/");
    const el = doc.querySelector("footer");
    assertExists(el);
    assert(el.textContent.includes(`© ${event.year} ${event.name}.`), "the copyright line names the event");
    assertEquals(
        [...el.querySelectorAll("a[target=_blank]")].map((a) => a.getAttribute("href")),
        [social.discord, social.x, social.linkedin],
    );
    assertEquals(
        [...el.querySelectorAll("a:not([target])")].map((a) => a.getAttribute("href")),
        nav.secondary.map((item) => item.url),
        "nav.secondary, in order",
    );
    assertEquals(el.querySelectorAll("[aria-hidden=true]:not(i)").length, nav.secondary.length - 1, "a middle dot between each pair");
    const logo = el.querySelector("img");
    assertExists(logo, "footer.logo renders as the footer's image");
    assertEquals(logo.getAttribute("src"), footer.logo, "footer.logo wins over logo.vertical.white");
    assertEquals(logo.getAttribute("alt"), event.name);

    // Without footer.logo (the theme's default footer.yaml) the footer shows
    // the stacked white lockup from `logo` (the theme's default too).
    const fallback = await render(`{{ include "partials/footer.vto" }}`, { data: { event, social, nav } });
    assertEquals(fallback.querySelector("footer img")?.getAttribute("src"), "/assets/logo-vertical-white.svg", "logo.vertical.white stands in");
    assert(fallback.querySelector("footer")!.textContent.includes("Part of the global Kubernetes Community Days program."), "the default text");

    // With neither (a logo.yaml without `vertical`) there is no image, and
    // the social links take the centre of the row by themselves.
    const plain = await build({
        files: {
            "index.vto": partial,
            "_data/logo.yaml": 'horizontal:\n  color: "/assets/img/h-color.svg"\n  white: "/assets/img/h-white.svg"\n',
        },
        data: { event, social, nav },
    });
    assertEquals(plain.dom("/").querySelector("footer img"), null, "no footer.logo, no logo.vertical: no image");
    assertEquals(plain.dom("/").querySelectorAll("footer a[target=_blank]").length, 3, "the social links still render");

});

// ---------------------------------------------------------------------------
// Hero

Deno.test("hero.frame: content in the centre, the menu only when asked, the scroll hint only at size screen", async () => {
    const withMenu = await render(
        `{{ comp hero.frame { menu: true, current: "/" } }}<p id="c">Hi</p>{{ /comp }}`,
        { data: { event, nav, hero } },
    );
    const section = withMenu.querySelector("section");
    assertExists(section);
    assertExists(section.querySelector("#c"), "the content is inside the band");
    assertEquals(section.querySelectorAll("[data-menu]").length, 1, "menu: true renders the menu inside the band");
    assertExists(section.querySelector(".animate-bounce"), "the default size is screen, with the scroll hint");
    assertEquals(section.querySelector("[data-menu] a[aria-current=page]")?.getAttribute("href"), "/", "current marks the link");

    const band = await render(`{{ comp hero.frame { size: "md" } }}<p>Hi</p>{{ /comp }}`, { data: { event, hero } });
    assertEquals(band.querySelectorAll("[data-menu]").length, 0, "no menu unless asked");
    assertEquals(band.querySelector(".animate-bounce"), null, "no scroll hint on a band");
    assertFalse(band.querySelector("section")?.className.includes("min-h-screen"), "a band is as tall as its content");
});

Deno.test("hero.frame: the picture defaults to hero.image; small and src2x are optional", async () => {
    // The site's hero.yaml (the fixture): one SVG, no small variant, no retina files.
    const fallback = await render(`{{ comp hero.frame { size: "md" } }}x{{ /comp }}`, { data: { event, hero } });
    const sources = [...fallback.querySelectorAll("source")].map((s) => s.getAttribute("srcset")?.trim());
    assertEquals(sources.length, 2, "a source per breakpoint even when both serve the same file");
    for (const srcset of sources) {
        assertEquals(srcset?.split(",").length, 1, "no retina candidate without a src2x");
        assert(srcset?.startsWith("/assets/hero.svg"), "without `small` the large file serves every width");
    }
    assertEquals(fallback.querySelector("img")?.getAttribute("width"), "1920");
    assertEquals(fallback.querySelector("[transform-images]"), null, "an SVG is never handed to the picture plugin");

    const full = await render(
        `{{ comp hero.frame { size: "md", image: {
            alt: "City", large: { src: "/l.jpg", src2x: "/l@2x.jpg", width: 1920, height: 1080 },
            small: { src: "/s.jpg", src2x: "/s@2x.jpg", width: 1000 },
        } } }}x{{ /comp }}`,
        { data: { event } },
    );
    const [small, large] = [...full.querySelectorAll("source")].map((s) => s.getAttribute("srcset")?.replace(/\s+/g, " ").trim());
    assertEquals(small, "/s.jpg 1000w, /s@2x.jpg 2000w");
    assertEquals(large, "/l.jpg 1920w, /l@2x.jpg 3840w");
    assertEquals(full.querySelector("img")?.getAttribute("alt"), "City");
    assertEquals(full.querySelector("[transform-images]"), null, "hand-made retina files are served as given");

    // A raster crop without a src2x is the picture plugin's: a bare srcset
    // (the plugin reads it as a path) and the two widths to derive from the
    // declared one. Inert without the plugin. The large crop keeps its src2x
    // here, so each <source> decides for itself.
    const derived = await render(
        `{{ comp hero.frame { size: "md", image: {
            alt: "", large: { src: "/l.jpg", src2x: "/l@2x.jpg", width: 1920, height: 1080 },
            small: { src: "/s@2x.jpg", width: 2359 },
        } } }}x{{ /comp }}`,
        { data: { event } },
    );
    const [dSmall, dLarge] = [...derived.querySelectorAll("source")];
    assertEquals(dSmall.getAttribute("srcset")?.trim(), "/s@2x.jpg");
    assertEquals(dSmall.getAttribute("transform-images"), "avif webp 1180 2359", "half (rounded) and full width");
    assertEquals(dLarge.getAttribute("srcset")?.replace(/\s+/g, " ").trim(), "/l.jpg 1920w, /l@2x.jpg 3840w");
    assertEquals(dLarge.getAttribute("transform-images"), null);
    assertEquals(derived.querySelector("img")?.getAttribute("transform-images"), null, "the fallback img is not marked");
});

Deno.test("hero.intro: title from event, badge and copy only when given, venue line only with a venue", async () => {
    const bare = await render(`{{ comp.hero.intro() }}`, { data: { event } });
    assertEquals(bare.querySelector("h1")?.textContent.trim(), `${event.name} ${event.year}`);
    assertEquals(bare.querySelector("time")?.getAttribute("datetime"), event.date.iso);
    assertEquals(bare.querySelector(".bg-accent"), null, "no badge pill without a badge");
    assertEquals(bare.querySelectorAll("p").length, 1, "the date line only: no venue, no tagline, no lede");
    assertFalse(bare.body.textContent.includes("undefined"));

    const full = await render(
        `{{ comp.hero.intro({
            title: "Hello",
            badge: "Early bird",
            tagline: "Coming to Testville.",
            lede: { html: "Before", until: "${future}", after: "After" },
        }) }}`,
        { data: { event, venue: { name: "Test Hall" } }, theme: { schema: { required: [], concepts: { venue: venueName } } } },
    );
    assertEquals(full.querySelector("h1")?.textContent.trim(), "Hello");
    assertEquals(full.querySelector(".bg-accent")?.textContent.trim(), "Early bird");
    assert(full.body.textContent.includes("Test Hall"), "the venue line names the venue");
    assert(full.body.textContent.includes("Coming to Testville."), "the tagline");
    assertExists(full.querySelector(`[data-until="${future}"]`), "a timed lede renders both halves");
    assertExists(full.querySelector(`[data-after="${future}"]`));
});

Deno.test("ui.actions: wraps the buttons it is given", async () => {
    const doc = await render(
        `{{ comp ui.actions }}
            {{ comp.ui.button({ label: "One", href: "/one/", style: "primary" }) }}
            {{ comp.ui.button({ label: "Two", href: "/two/", style: "secondary" }) }}
        {{ /comp }}`,
    );
    assertEquals([...doc.querySelectorAll("a")].map((a) => a.textContent.trim()), ["One", "Two"]);
    assertEquals(doc.querySelectorAll("a").length, doc.querySelector("div")?.querySelectorAll("a").length, "all inside the row");
});

// ---------------------------------------------------------------------------
// Sessions and speakers (over the `schedule` global the plugin builds from
// the `agenda` and `speakers` concepts)

/** The fixture programme with one talk cancelled. */
const cancelledProgram = {
    ...programData,
    agenda: { ...agenda, sessions: agenda.sessions.map((s) => s.id === "k8s" ? { ...s, cancelled: true } : s) },
};

Deno.test("session.card: opens its dialog by id; a cancelled talk keeps its card, marked", async () => {
    const doc = await render(
        `{{ for session of schedule.sessions }}{{ comp.session.card({ session }) }}{{ /for }}`,
        { data: cancelledProgram },
    );
    const cards = [...doc.querySelectorAll("article")];
    assertEquals(cards.length, 4, "one card per talk, cancelled included");
    assertEquals(
        cards.map((c) => c.querySelector("[data-dialog-open]")?.getAttribute("data-dialog-open")),
        ["session-keynote", "session-k8s", "session-o11y", "session-tba"],
    );
    const k8s = cards.find((c) => c.hasAttribute("data-cancelled"))!;
    assertEquals(k8s.querySelector("[data-dialog-open]")?.getAttribute("data-dialog-open"), "session-k8s", "the cancelled one is k8s");
    assert(k8s.textContent.includes("Cancelled"), "the pill");
    assertEquals(doc.querySelectorAll("[data-cancelled]").length, 1, "only the cancelled one is marked");
    assert(cards[0].textContent.includes("Keynote"), "the format pill");
    assert(cards[0].textContent.includes("Ada Example"), "the speaker");
    assertFalse(doc.body.textContent.includes("undefined"));
});

Deno.test("session.dialog: the dialog carries its id and title; a cancelled talk says so and keeps its abstract", async () => {
    const doc = await render(
        `{{ for session of schedule.sessions }}{{ comp.session.dialog({ session }) }}{{ /for }}`,
        { data: cancelledProgram },
    );
    const keynote = doc.querySelector("#session-keynote")!;
    assertExists(keynote);
    assertEquals(keynote.getAttribute("aria-labelledby"), "session-keynote-title");
    assertEquals(keynote.querySelector("#session-keynote-title")?.textContent.trim(), "Why community days matter");
    assertEquals(keynote.querySelectorAll("[data-cancelled]").length, 0);
    assertEquals([...keynote.querySelectorAll("p")].filter((p) => ["One.", "Two."].includes(p.textContent.trim())).length, 2, "the abstract's paragraphs");

    const k8s = doc.querySelector("#session-k8s")!;
    assertExists(k8s.querySelector("[data-cancelled]"), "the notice");
    assert(k8s.textContent.includes("This talk has been cancelled."));
    assertEquals(k8s.querySelector("#session-k8s-title")?.textContent.trim(), "Kubernetes for the rest of us");
});

Deno.test("session.break: title, icon and time; wide hides the room", async () => {
    const doc = await render(
        `{{ for placed of schedule.days[0].rows[0].sessions }}{{ comp.session.break({ session: placed.session, wide: placed.track == null }) }}{{ /for }}
         {{ comp.session.break({ session: schedule.days[0].rows[2].sessions[0].session, wide: false }) }}`,
        { data: programData },
    );
    const [registration, coffee] = [...doc.querySelectorAll("div.rounded-2xl")];
    assert(registration.textContent.includes("Registration"));
    assertEquals(registration.querySelector("i")?.getAttribute("class"), "fas fa-id-badge w-6 shrink-0 text-center text-xl text-gray-400");
    assertEquals([...registration.querySelectorAll("time")].map((t) => t.textContent), ["08:00", "09:00"]);
    assertFalse(registration.textContent.includes("Hall B"), "wide: the room is not shown");
    assert(coffee.textContent.includes("Hall B"), "narrow: the room is shown");
    assertEquals(coffee.querySelector("i")?.getAttribute("class")?.split(" ")[1], "fa-mug-hot");
});

Deno.test("speaker.card and speaker.dialog: keynote marker, byline, LinkedIn, the talks with their marker; agenda links only when that page is in the build", async () => {
    const doc = await render(
        `{{ for speaker of schedule.speakers }}{{ comp.speaker.card({ speaker }) }}{{ comp.speaker.dialog({ speaker }) }}{{ /for }}`,
        { data: cancelledProgram },
    );
    const cards = [...doc.querySelectorAll("article")];
    assertEquals(cards.length, 2, "bram's only talk is cancelled: not listed");
    assert(cards[0].textContent.includes("Keynote"), "ada is a keynote speaker");
    assertFalse(cards[1].textContent.includes("Keynote"));
    assertEquals(cards[0].querySelector("a")?.getAttribute("href"), "https://example.com/ada", "the profile link from the links map");
    assertEquals(cards[0].querySelector("a")?.getAttribute("aria-label"), "Ada Example on LinkedIn");
    assertEquals(cards[1].querySelectorAll("a").length, 0, "no links, no row");
    assertEquals(cards[0].querySelector("[data-dialog-open]")?.getAttribute("data-dialog-open"), "speaker-ada");

    const chloe = doc.querySelector("#speaker-chloe")!;
    assertExists(chloe);
    assertEquals(chloe.getAttribute("aria-labelledby"), "speaker-chloe-title");
    assertEquals([...chloe.querySelectorAll("li")].map((li) => li.querySelector("span.block")?.textContent.trim()), [
        "Observability on a budget",
        "A talk without a slot yet",
    ], "scheduled talk first, the one without a slot after it");
    assertEquals(chloe.querySelectorAll("a[href^='/agenda/']").length, 0, "no agenda page in this build: plain cards");
    assertFalse(doc.body.textContent.includes("undefined"));

    // With an agenda page in the build, the scheduled talk links into it; the unscheduled one does not.
    const site = await build({
        files: {
            "index.vto": `{{ comp.speaker.dialog({ speaker: schedule.speakers.find((s) => s.id == "chloe") }) }}`,
            "agenda.vto": "---\nid: agenda\n---\n<p>agenda</p>",
        },
        data: cancelledProgram,
    });
    const links = [...site.dom("/").querySelectorAll("a[href^='/agenda/']")].map((a) => a.getAttribute("href"));
    assertEquals(links, ["/agenda/#session-o11y"]);
});

Deno.test("the speaker dialog marks a cancelled talk among a speaker's talks", async () => {
    const both = {
        ...programData,
        agenda: { ...agenda, sessions: agenda.sessions.map((s) => s.id === "tba" ? { ...s, cancelled: true } : s) },
    };
    const doc = await render(`{{ comp.speaker.dialog({ speaker: schedule.speakers[2] }) }}`, { data: both });
    const items = [...doc.querySelectorAll("li")];
    assertEquals(items.length, 2, "chloe keeps her other talk and is listed; the cancelled one is shown too");
    assert(items[1].textContent.includes("Cancelled"));
    assertFalse(items[0].textContent.includes("Cancelled"));
});

// ---------------------------------------------------------------------------
// Venue: the photo row, the routes list, and the cards, notes and
// call-to-action panels the venue page is written with


Deno.test("venue.photos: one captioned figure per photo from venue.photos or the prop; nothing without photos", async () => {
    const doc = await render(`{{ comp.venue.photos() }}`, { data: { venue } });
    const figures = [...doc.querySelectorAll("figure")];
    assertEquals(figures.map((f) => f.querySelector("figcaption")?.textContent.trim()), ["The front", "The hall"]);
    assertEquals(figures[0].querySelector("img")?.getAttribute("srcset"), "/assets/img/a.svg 800w, /assets/img/a@2x.svg 1600w");
    assertEquals(figures[0].querySelector("img")?.getAttribute("alt"), "Front");

    const given = await render(`{{ comp.venue.photos({ photos: [{ src: "/x.svg", src2x: "/x.svg", alt: "X", caption: "Only" }] }) }}`, { data: { venue } });
    assertEquals(given.querySelectorAll("figure").length, 1);

    const none = await render(`{{ comp.venue.photos() }}`, { data: { venue: { ...venue, photos: undefined } } });
    assertEquals(none.querySelectorAll("figure").length, 0);
});

Deno.test("venue.routes: one row per route with from, how (HTML) and time; the note as content; nothing without routes", async () => {
    const doc = await render(
        `{{ comp venue.routes { routes: [
            { from: "Station", how: "<strong>Tram 1</strong> to <em>Square</em>", time: "~5 min" },
            { from: "Airport", how: "Bus 12", time: "~35 min" },
        ] } }}Times are approximate; use <a href="https://example.com/planner">the planner</a>.{{ /comp }}`,
    );
    assertEquals(doc.querySelector("h3")?.textContent.trim(), "Quick routes");
    const rows = [...doc.querySelectorAll("li")];
    assertEquals(rows.length, 2);
    assertEquals(rows[0].querySelector("strong")?.textContent, "Tram 1", "how is rendered as HTML");
    assert(rows[0].textContent.includes("Station") && rows[0].textContent.includes("~5 min"));
    assertEquals(doc.querySelector("a")?.getAttribute("href"), "https://example.com/planner", "the note's link");

    const titled = await render(`{{ comp venue.routes { title: "From the airport", routes: [{ from: "A", how: "B", time: "C" }] } }}{{ /comp }}`);
    assertEquals(titled.querySelector("h3")?.textContent.trim(), "From the airport");
    assertEquals(titled.querySelectorAll("div.border-t").length, 0, "no note box without content");

    const none = await render(`{{ comp venue.routes { routes: [] } }}note{{ /comp }}`);
    assertEquals(none.querySelectorAll("ul").length, 0);
});

Deno.test("ui.card: icon and title, badges and details as a list or a paragraph, the footnote; tone", async () => {
    const doc = await render(`
        {{ comp.ui.card({ icon: "fa-bus", title: "By bus", badges: { label: "Lines", items: ["9", "29"] }, details: [{ label: "Stop", text: "<em>Tímár utca</em>" }], footnote: "<strong>Walk:</strong> 5 min" }) }}
        {{ comp.ui.card({ icon: "fa-car", title: "Parking", text: "Scarce.", tone: "gray" }) }}
    `);
    const [bus, parking] = [...doc.querySelectorAll("div.rounded-lg")];
    assertEquals(bus.querySelector("h3")?.textContent, "By bus");
    assertEquals(bus.querySelector("i")?.getAttribute("class")?.split(" ")[1], "fa-bus");
    assertEquals([...bus.querySelectorAll("dt")].map((d) => d.textContent), ["Lines", "Stop"]);
    assertEquals([...bus.querySelectorAll("dd span")].map((s) => s.textContent), ["9", "29"], "badges as pills");
    assertEquals(bus.querySelector("dd em")?.textContent, "Tímár utca", "detail text as HTML");
    assertEquals(bus.querySelector("p strong")?.textContent, "Walk:", "the footnote");
    assertEquals(parking.querySelectorAll("dl").length, 0);
    assertEquals(parking.querySelector("p")?.textContent.trim(), "Scarce.");
    assert(parking.getAttribute("class")?.includes("bg-gray-50"), "gray tone");
    assert(bus.getAttribute("class")?.includes("bg-white"), "white by default");
});

Deno.test("ui.cta: heading, the copy as content, one secondary button; tone and padding", async () => {
    const doc = await render(
        `{{ comp ui.cta { title: "Questions?", label: "Ask", href: "https://example.com/discord", icon: "fa-brands fa-discord", external: true } }}Ask <em>us</em>.{{ /comp }}`,
    );
    const section = doc.querySelector("section")!;
    assertEquals(section.querySelector("h2")?.textContent, "Questions?");
    assertEquals(section.querySelector("p em")?.textContent, "us");
    const button = section.querySelector("a")!;
    assertEquals(button.getAttribute("href"), "https://example.com/discord");
    assertEquals(button.getAttribute("target"), "_blank");
    assert(button.textContent.includes("Ask"));
    assertFalse(section.getAttribute("class")?.includes("bg-white"));

    const white = await render(`{{ comp ui.cta { title: "T", label: "L", href: "/x/", tone: "white", padding: "bottom" } }}{{ /comp }}`);
    const s = white.querySelector("section")!;
    assert(s.getAttribute("class")?.includes("bg-white"));
    assert(s.getAttribute("class")?.includes("pb-16") && !s.getAttribute("class")?.includes("py-16"));
    assertEquals(s.querySelectorAll("p").length, 0, "no copy, no paragraph");
    assertEquals(s.querySelector("a")?.getAttribute("target"), null, "internal link");
});

Deno.test("ui.note: an icon beside the content; info by default, warning in amber, any icon", async () => {
    const doc = await render(`{{ comp ui.note }}Heads-up: <strong>zone B</strong>.{{ /comp }}`);
    const note = doc.querySelector("div")!;
    assertEquals(note.querySelector("i")?.getAttribute("class")?.split(" ")[1], "fa-circle-info");
    assertEquals(note.querySelector("p strong")?.textContent, "zone B");
    assert(note.getAttribute("class")?.includes("border-secondary"));

    const warning = await render(`{{ comp ui.note { tone: "warning", icon: "fa-triangle-exclamation" } }}Careful.{{ /comp }}`);
    const w = warning.querySelector("div")!;
    assert(w.getAttribute("class")?.includes("border-amber-300"));
    assertEquals(w.querySelector("i")?.getAttribute("class")?.split(" ")[1], "fa-triangle-exclamation");
});

Deno.test("speaker and session dialogs list every profile link in canonical order, not LinkedIn alone", async () => {
    const linked = {
        ...programData,
        speakers: [
            { ...programData.speakers[0], links: { github: "https://github.com/ada", website: "https://ada.example", linkedin: "https://example.com/ada" } },
            ...programData.speakers.slice(1),
        ],
    };
    const doc = await render(
        `{{ comp.speaker.dialog({ speaker: schedule.speakers[0] }) }}{{ comp.session.dialog({ session: schedule.sessions[0] }) }}`,
        { data: linked },
    );
    const profile = [...doc.querySelector("#speaker-ada")!.querySelectorAll("a[target=_blank]")];
    assertEquals(profile.map((a) => a.getAttribute("href")), ["https://ada.example", "https://example.com/ada", "https://github.com/ada"], "website, linkedin, github: the canonical order");
    assertEquals(profile.map((a) => a.textContent.trim()), ["website", "LinkedIn", "GitHub"]);
    const inSession = [...doc.querySelector("#session-keynote")!.querySelectorAll("li a[target=_blank]")];
    assertEquals(inSession.length, 3, "the session dialog shows the speaker's links too");
});

// ---------------------------------------------------------------------------
// Timetable, teaser, attending tool

Deno.test("schedule.timetable: one grid per day with the track header, a time per row and every item positioned; nothing without days", async () => {
    const doc = await render(`{{ comp.schedule.timetable() }}`, { data: programData });
    const grids = [...doc.querySelectorAll("[data-timetable]")];
    assertEquals(grids.map((g) => g.getAttribute("data-timetable")), ["2030-05-15"]);
    assertEquals(grids[0].getAttribute("style"), "--tracks: 2");
    assertEquals(doc.querySelectorAll("h2").length, 0, "one day: no day heading");
    const header = grids[0].querySelector("div.sticky")!;
    assertEquals([...header.querySelectorAll("div")].map((d) => d.textContent.trim()), ["Time", "Hall B", "Hall C"]);
    assertEquals([...grids[0].querySelectorAll("time.text-xl")].map((t) => t.textContent), ["08:00", "09:00", "09:45", "10:00"], "one time per distinct start");
    const cells = [...grids[0].querySelectorAll("div.relative.grid")];
    assertEquals(cells.length, 5, "registration, keynote, coffee, two parallel talks");
    const keynote = cells.find((c) => c.textContent.includes("Why community days matter"))!;
    assertEquals(keynote.getAttribute("style"), "--row: 2 / span 1; --col: 2 / -1", "plenary spans the tracks");
    const o11y = cells.find((c) => c.textContent.includes("Observability on a budget"))!;
    assertEquals(o11y.getAttribute("style"), "--row: 4 / span 1; --col: 3", "the second track");
    assertEquals(cells.filter((c) => c.querySelector("article")).length, 3, "talks are cards");
    assertEquals(cells.filter((c) => c.querySelector("div.border-dashed")).length, 2, "breaks are strips");
    assertEquals(grids[0].querySelectorAll("[aria-hidden=true].h-px").length, 3, "a rule before every row but the first");
    assertFalse(doc.body.textContent.includes("undefined"));

    const twoDays = {
        ...programData,
        agenda: { ...agenda, breaks: [...agenda.breaks, { title: "Day two registration", start: "2030-05-16T08:00:00", end: "2030-05-16T09:00:00" }] },
    };
    const two = await render(`{{ comp.schedule.timetable() }}`, { data: twoDays });
    assertEquals([...two.querySelectorAll("h2")].map((h) => h.textContent.trim()), ["Wednesday, 15 May 2030", "Thursday, 16 May 2030"], "a heading per day when there are several");

    const none = await render(`{{ comp.schedule.timetable() }}`, { data: { speakers: programData.speakers } });
    assertEquals(none.querySelectorAll("[data-timetable]").length, 0);
});

Deno.test("session.teaser: every talk as a card linking into the agenda page, all but the first hidden, the swap script after them; nothing without talks or without that page", async () => {
    const agendaPage = { "agenda.vto": "---\nid: agenda\n---\n<p>agenda</p>" };
    const teaser = `{{ comp.session.teaser({ talks: schedule.sessions }) }}\n<!-- render -->\n`;
    const doc = (await build({ files: { "index.vto": teaser, ...agendaPage }, data: programData })).dom("/");
    const cards = [...doc.querySelectorAll("[data-teaser] [data-talk]")];
    assertEquals(cards.length, 4);
    assertEquals(cards.map((c) => c.hasAttribute("hidden")), [false, true, true, true], "the first shows without JavaScript");
    assertEquals(cards.map((c) => c.querySelector("a")?.getAttribute("href")), ["/agenda/#session-keynote", "/agenda/#session-k8s", "/agenda/#session-o11y", "/agenda/#session-tba"]);
    assert(cards[0].textContent.includes("Why community days matter"));
    assert(cards[0].textContent.includes("Ada Example"), "the speaker");
    assert(cards[0].textContent.includes("Keynote"), "the format pill");
    assert(cards[0].textContent.includes("One."), "the first paragraph of the abstract");
    assertEquals(cards[3].querySelectorAll("time").length, 0, "no slot, no times");
    assert(doc.querySelector("script")?.textContent.includes("[data-teaser] [data-talk]"), "the inline script targets the cards");
    assertFalse(doc.body.textContent.includes("undefined"));

    const none = (await build({ files: { "index.vto": `{{ comp.session.teaser({ talks: [] }) }}\n<!-- render -->\n`, ...agendaPage }, data: programData })).dom("/");
    assertEquals(none.querySelectorAll("[data-teaser], script").length, 0);

    const noAgenda = await render(`{{ comp.session.teaser({ talks: schedule.sessions }) }}`, { data: programData });
    assertEquals(noAgenda.querySelectorAll("[data-teaser]").length, 0, "no agenda page in the build: nothing to link to, nothing rendered");

    const draft = (await build({ files: { "index.vto": teaser, "agenda.vto": "---\nid: agenda\ndraft: true\n---\n<p>agenda</p>" }, data: programData })).dom("/");
    assertEquals(draft.querySelectorAll("[data-teaser]").length, 0, "a draft agenda page: the same");
});

Deno.test("attending.tool: the generator's markup the theme's script drives, bound to the event; the caption defaults from the event or is the content", async () => {
    // `logo` comes from the theme's default (remote _data/ files win over a `data` global); `hero` is the site's.
    const data = { event, venue, hero };
    const doc = await render(`{{ comp.attending.tool() }}`, { data });
    const tool = doc.querySelector("#badge-tool")!;
    assertExists(tool);
    assertEquals(tool.getAttribute("data-event-name"), "KCD Testville 2030");
    assertEquals(tool.getAttribute("data-date"), "15 May 2030");
    assertEquals(tool.getAttribute("data-venue"), "Test Hall");
    assert(tool.getAttribute("data-logo")?.endsWith("/assets/logo-horizontal-white.svg"), "the white logo, for the image");
    assert(tool.getAttribute("data-background")?.endsWith("/assets/hero.svg"), "the site's hero picture");
    for (const id of ["badge-canvas", "badge-controls", "badge-photo", "badge-crop", "badge-zoom", "badge-zoom-value", "badge-horizontal", "badge-vertical", "badge-reset", "badge-details", "badge-name", "badge-title", "badge-download", "badge-status", "badge-caption", "badge-copy", "badge-copy-status", "badge-format-help"]) {
        assertExists(doc.getElementById(id), `#${id}, which attending-badge.js looks up`);
    }
    assertEquals(doc.querySelectorAll("input[name=badge-format]").length, 2, "the two formats");
    const caption = doc.getElementById("badge-caption")!.textContent;
    assert(caption.startsWith("I'm attending KCD Testville 2030!"), caption);
    assert(caption.includes("15 May 2030 at Test Hall"));
    assert(caption.includes("#KCDTestville #CloudNative #CNCF"), "the hashtag from the city");
    assertEquals(doc.querySelector("link[rel=stylesheet]")?.getAttribute("href"), "/assets/attending-badge.css");
    assertEquals(doc.querySelector("script[type=module]")?.getAttribute("src"), "/assets/attending-badge.js");
    assertFalse(doc.body.textContent.includes("undefined"));

    const own = await render(`{{ comp attending.tool }}See you there! #KCD{{ /comp }}`, { data });
    assertEquals(own.getElementById("badge-caption")!.textContent, "See you there! #KCD");
});

Deno.test("ui.card: as a link the whole card is an <a>, external opens a new tab; align center and iconClasses", async () => {
    const doc = await render(`
        {{ comp.ui.card({ icon: "fa-brands fa-youtube", iconClasses: "text-red-600", title: "Recordings", text: "Every talk.", align: "center", href: "https://example.com/yt", external: true }) }}
        {{ comp.ui.card({ icon: "fa-clock-rotate-left", title: "Recap", text: "Last year.", align: "center", href: "/2025/" }) }}
    `);
    const [yt, recap] = [...doc.querySelectorAll("a.rounded-lg")];
    assertEquals(yt.getAttribute("href"), "https://example.com/yt");
    assertEquals(yt.getAttribute("target"), "_blank");
    assert(yt.querySelector("i")?.getAttribute("class")?.endsWith("fa-youtube mb-4 text-4xl text-red-600"), "the icon colour");
    assert(yt.querySelector("p")?.getAttribute("class")?.includes("text-center"), "centred paragraph");
    assertEquals(recap.getAttribute("target"), null);
    assertEquals(recap.querySelector("i")?.getAttribute("class"), "fas fa-clock-rotate-left mb-4 text-4xl text-accent", "accent by default");
    assertEquals(doc.querySelectorAll("div.rounded-lg").length, 0, "links are not divs");
});

Deno.test("ui.heading: inverse for a dark band drops the primary colour and greys", async () => {
    const doc = await render(`{{ comp.ui.heading({ title: "Stay tuned", lede: "Follow us.", inverse: true }) }}`);
    const h2 = doc.querySelector("h2")!;
    assertFalse(h2.getAttribute("class")?.includes("text-primary"));
    assert(doc.querySelector("p")?.getAttribute("class")?.includes("opacity-90"));
    assertFalse(doc.querySelector("p")?.getAttribute("class")?.includes("text-gray"));
});

Deno.test("sponsorship.package: tier accent, featured chip, price, the includes with a tick each, the enquiry button", async () => {
    const pkg = { name: "Gold", price: "€6,000", accent: "gold", featured: true, summary: "The most visible.", includes: ["Logo everywhere", "A booth"] };
    const doc = await render(`<ul>{{ comp.sponsorship.package({ pkg: ${JSON.stringify(pkg)}, href: "mailto:s@example.com?subject=Gold" }) }}</ul>`);
    const li = doc.querySelector("li[data-package=gold]")!;
    assertExists(li);
    assert(li.getAttribute("class")?.includes("border-amber-300"), "the gold border");
    assertEquals(li.querySelector("h3")?.textContent.trim().replace(/\s+/g, " "), "Gold");
    assert(li.textContent.includes("Most visible"), "the featured chip");
    assert(li.textContent.includes("€6,000"));
    assertEquals([...li.querySelectorAll("ul li")].map((s) => s.querySelector("span")?.textContent), ["Logo everywhere", "A booth"]);
    assertEquals(li.querySelectorAll("ul li i.fa-check").length, 2, "a tick per item");
    const button = li.querySelector("a")!;
    assertEquals(button.getAttribute("href"), "mailto:s@example.com?subject=Gold");
    assert(button.textContent.includes("Enquire about Gold"));

    const plain = await render(`<ul>{{ comp.sponsorship.package({ pkg: ${JSON.stringify({ ...pkg, accent: "platinum", featured: false })}, href: "#", label: "Ask us" }) }}</ul>`);
    const other = plain.querySelector("li")!;
    assert(other.getAttribute("class")?.includes("border-primary/40"), "an unknown accent falls back to primary");
    assertFalse(other.textContent.includes("Most visible"));
    assert(other.querySelector("a")?.textContent.includes("Ask us"));
});

// ---------------------------------------------------------------------------
// Links to pages by id

Deno.test("ui.navLinks: a `page` entry resolves to the page's url and title, is dropped while the page is not in the build, and keeps a label it is given", async () => {
    const main = [
        { page: "home", label: "Home", icon: "fa-house" },
        { page: "agenda", icon: "fa-calendar-days" },
        { page: "speakers", icon: "fa-users" },
        { label: "Out", url: "https://example.com/out", icon: "fa-link" },
    ];
    const files = {
        "index.vto": `---\nid: home\ntitle: Start\n---\n${navFunction}{{ comp.ui.navLinks({ links: nav.main, current: url, render: link }) }}\n`,
        "agenda.vto": "---\nid: agenda\ntitle: Agenda\n---\n<p>agenda</p>\n",
        "speakers.vto": "---\nid: speakers\ntitle: Speakers\ndraft: true\n---\n<p>speakers</p>\n",
    };
    const site = await build({ files, data: { nav: { ...nav, main } } });
    const anchors = [...site.dom("/").querySelectorAll("a")];
    assertEquals(anchors.map((a) => a.textContent.trim()), ["Home", "Agenda", "Out"], "the draft speakers page is not built, so no link (an id no page declares fails the build, see schema.test.ts)");
    assertEquals(anchors.map((a) => a.getAttribute("href")), ["/", "/agenda/", "https://example.com/out"]);
    assertEquals(anchors[0].textContent.trim(), "Home", "a given label wins over the page title");
    assertEquals(anchors.map((a) => a.getAttribute("data-active")), ["true", "false", "false"], "active from the resolved url");
    assertEquals(anchors.map((a) => a.getAttribute("data-index")), ["0", "1", "2"]);

    // Under `serve`, drafts are built: the page is found with `draft: true`, the link renders and says so.
    Deno.env.set("LUME_DRAFTS", "true");
    try {
        const dev = await build({ files, data: { nav: { ...nav, main } } });
        assert(dev.has("/speakers/"), "the draft page is built");
        const links = [...dev.dom("/").querySelectorAll("a")];
        assertEquals(links.map((a) => a.textContent.trim()), ["Home", "Agenda", "Speakers", "Out"], "the link is there to reach the draft");
        assertEquals(links.map((a) => a.getAttribute("data-draft")), [null, null, "true", null], "and the render function is told which one is a draft");
    } finally {
        Deno.env.delete("LUME_DRAFTS");
    }
});

Deno.test("menu and footer: under serve, a link to a draft page carries a Draft pill; a build has none", async () => {
    const main = [{ page: "home", label: "Home", icon: "fa-house" }, { page: "agenda", icon: "fa-calendar-days" }];
    const secondary = [{ page: "imprint" }];
    const files = {
        "index.vto": "---\nid: home\n---\n{{ comp.menu({ current: url }) }}{{ include \"partials/footer.vto\" }}\n",
        "agenda.vto": "---\nid: agenda\ntitle: Agenda\ndraft: true\n---\n<p>a</p>\n",
        "imprint.vto": "---\nid: imprint\ntitle: Imprint\ndraft: true\n---\n<p>i</p>\n",
    };
    const data = { event, social, footer, nav: { ...nav, main, secondary, cta: { label: "Agenda", page: "agenda", icon: "fa-calendar-days" } } };
    const prod = (await build({ files, data })).dom("/");
    assertEquals(prod.querySelectorAll("[data-draft]").length, 0, "no draft page in a build, no pill");
    assertEquals([...prod.querySelectorAll("#site-menu a")].map((a) => a.textContent.trim()), ["Home"]);

    Deno.env.set("LUME_DRAFTS", "true");
    try {
        const dev = (await build({ files, data })).dom("/");
        const menu = [...dev.querySelectorAll("#site-menu a")];
        assertEquals(menu.map((a) => a.textContent.replace(/\s+/g, " ").trim()), ["Home", "Agenda Draft", "Imprint Draft"], "main and secondary entries marked");
        assertEquals(menu[1].querySelector("[data-draft]")?.textContent, "Draft");
        const cta = [...dev.querySelectorAll("header a")].find((a) => a.textContent.includes("Agenda") && !a.closest("#site-menu"))!;
        assertExists(cta.querySelector("[data-draft]"), "the CTA too");
        assertExists(dev.querySelector("footer [data-draft]"), "and the footer's legal link");
    } finally {
        Deno.env.delete("LUME_DRAFTS");
    }
});

Deno.test("menu: the CTA is a page link too, dropped with a draft target", async () => {
    const cta = { label: "Get tickets", page: "tickets", icon: "fa-ticket" };
    const files = {
        "index.vto": `{{ comp.menu({ current: url }) }}\n`,
        "tickets.vto": "---\nid: tickets\ntitle: Tickets\n---\n<p>t</p>\n",
    };
    const site = await build({ files, data: { event, nav: { ...nav, cta } } });
    const button = [...site.dom("/").querySelectorAll("header a")].find((a) => a.textContent.includes("Get tickets"));
    assertEquals(button?.getAttribute("href"), "/tickets/");

    const draft = await build({ files: { ...files, "tickets.vto": "---\nid: tickets\ndraft: true\n---\n<p>t</p>\n" }, data: { event, nav: { ...nav, cta } } });
    assertEquals([...draft.dom("/").querySelectorAll("header a")].filter((a) => a.textContent.includes("Get tickets")).length, 0);
});

Deno.test("ui.button and ui.cta: `page` resolves to the page's url and renders nothing while the page is not in the build; `href` links out as before", async () => {
    const files = {
        "index.vto": `{{ comp.ui.button({ label: "Tickets", page: "tickets", style: "primary" }) }}{{ comp.ui.button({ label: "Venue", page: "venue", style: "primary" }) }}{{ comp ui.cta { title: "Find their talks", label: "View the agenda", page: "agenda" } }}Soon.{{ /comp }}\n`,
        "tickets.vto": "---\nid: tickets\n---\n<p>t</p>\n",
        "venue.vto": "---\nid: venue\ndraft: true\n---\n<p>v</p>\n",
        "agenda.vto": "---\nid: agenda\ndraft: true\n---\n<p>a</p>\n",
    };
    const doc = (await build({ files })).dom("/");
    const buttons = [...doc.querySelectorAll("a")];
    assertEquals(buttons.map((a) => a.textContent.trim()), ["Tickets"], "a draft venue page, no venue button; a draft agenda, no cta");
    assertEquals(buttons[0].getAttribute("href"), "/tickets/");
    assertEquals(doc.querySelectorAll("section").length, 0);

    const out = await render(`{{ comp.ui.button({ label: "Discord", href: "https://example.com/d", external: true, style: "primary" }) }}{{ comp ui.cta { title: "Ask", label: "Join", href: "mailto:x@example.com" } }}Mail us.{{ /comp }}`);
    assertEquals([...out.querySelectorAll("a")].map((a) => [a.getAttribute("href"), a.getAttribute("target")]), [["https://example.com/d", "_blank"], ["mailto:x@example.com", null]]);

    Deno.env.set("LUME_DRAFTS", "true");
    try {
        const dev = (await build({ files })).dom("/");
        assertEquals([...dev.querySelectorAll("a")].map((a) => a.textContent.trim()), ["Tickets", "Venue", "View the agenda"], "under serve the draft pages are built and the buttons point at them");
    } finally {
        Deno.env.delete("LUME_DRAFTS");
    }
});
