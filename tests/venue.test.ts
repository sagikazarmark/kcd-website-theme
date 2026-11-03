/**
 * The venue's derived map links (../venue.ts): the OpenStreetMap embed and
 * link and the two directions URLs from coordinates and address, and the
 * overrides `venue.map` may name. No Lume.
 *
 *     deno task test
 */

import { assertEquals } from "@std/assert";
import { mapLinks } from "../venue.ts";

const venue = {
    name: "Community Centre",
    address: { street: "Café Lane 96/B", city: "Demo City" },
    coordinates: { lat: 52.12345, lon: 5.12345 },
};

Deno.test("mapLinks: the four URLs from coordinates and address", () => {
    assertEquals(mapLinks(venue), {
        embedUrl: "https://www.openstreetmap.org/export/embed.html?bbox=5.11645%2C52.12045%2C5.13045%2C52.12645&layer=mapnik&marker=52.12345%2C5.12345",
        osmUrl: "https://www.openstreetmap.org/?mlat=52.12345&mlon=5.12345#map=17/52.12345/5.12345",
        googleUrl: "https://www.google.com/maps/dir/?api=1&destination=Community%20Centre%2C%20Caf%C3%A9%20Lane%2096%2FB%2C%20Demo%20City",
        appleUrl: "https://maps.apple.com/?daddr=Caf%C3%A9%20Lane%2096%2FB%2C%20Demo%20City&dirflg=r",
    });
});

Deno.test("mapLinks: round coordinates stay short and floating-point noise is rounded away", () => {
    const links = mapLinks({ ...venue, coordinates: { lat: 52, lon: 5 } });
    assertEquals(links.embedUrl, "https://www.openstreetmap.org/export/embed.html?bbox=4.993%2C51.997%2C5.007%2C52.003&layer=mapnik&marker=52%2C5");
    assertEquals(links.osmUrl, "https://www.openstreetmap.org/?mlat=52&mlon=5#map=17/52/5");
});

Deno.test("mapLinks: a URL named in venue.map wins over the derived one, the others are still derived", () => {
    const embed = "https://maps.google.com/maps?q=x&output=embed";
    const links = mapLinks({ ...venue, map: { embedUrl: embed } });
    assertEquals(links.embedUrl, embed);
    assertEquals(links.osmUrl, mapLinks(venue).osmUrl);
    assertEquals(links.googleUrl, mapLinks(venue).googleUrl);
});
