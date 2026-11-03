/**
 * Smoke tests: the demo's last phase (demo/agenda/, the full site)
 * and announcement demo (demo/announced/, the sparse one) build from the
 * theme's remote fallbacks. The tests that exercise the plugin's file-level
 * mechanics (remote registration, the schema with its full required list,
 * the schedule) end to end; what the pages say is not asserted here beyond
 * the sections the full site writes, the pages belong to the site. The real
 * pipeline (Tailwind, base path, favicon) is covered by `deno task build`
 * in CI.
 *
 *     deno task test
 */

import { assert } from "@std/assert";
import { announced, buildSite } from "./helpers.ts";

Deno.test("the full site builds", async () => {
    const site = await buildSite();
    assert(site.has("/"), "the home page");
    assert(site.has("/404.html"), "the not-found page");
});

Deno.test("the announcement demo builds", async () => {
    const site = await buildSite(announced);
    assert(site.has("/"), "the home page");
    assert(site.has("/404.html"), "the not-found page");
});

Deno.test("the full site's pages carry the sections they write over the concepts", async () => {
    const site = await buildSite();
    const home = site.dom("/");
    for (const id of ["sponsors", "keynotes", "venue", "organizers"]) {
        assert(home.querySelector(`#${id}`), `the home page has a #${id} section`);
    }
    assert(home.querySelector("#venue a[href='/venue/'] img"), "the venue section's picture links to the venue page");
    assert(home.querySelector("#sponsors ul li a img"), "a sponsor logo in a tier row");

    const venue = site.dom("/venue/");
    assert(venue.querySelector("#map iframe[src^='https://www.openstreetmap.org/export/embed.html?bbox=']"), "the map embed is derived from the coordinates");
    assert(venue.querySelector("#map a[href^='https://www.google.com/maps/dir/']"), "Google directions");
    assert(venue.querySelector("#map a[href^='https://maps.apple.com/']"), "Apple directions");
    assert(venue.querySelector("#map address"), "the address card");

    const tickets = site.dom("/tickets/");
    assert(tickets.querySelector("pretix-widget[event]"), "the ticket shop widget");
    assert(tickets.querySelector("head link[href$='/widget/v2.css']"), "the widget's stylesheet in <head>");
});
