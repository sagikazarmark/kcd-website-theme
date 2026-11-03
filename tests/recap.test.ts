/** Shared recap resources keep their publication behavior independent of any event site. */
import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { render } from "./helpers.ts";

Deno.test("recap.resource: pending, published and disabled resources coexist independently", async () => {
    const doc = await render(`
        {{ for item of resources }}
            {{ comp.recap.resource({ id: item.id, title: "Recordings", label: "Watch", icon: "fa-play", text: "Talks from the event.", action: "Watch talks", resource: item.resource }) }}
        {{ /for }}
    `, { data: { resources: [
        { id: "pending", resource: {} },
        { id: "published", resource: { url: "https://example.com/recordings", note: "More talks next week." } },
        { id: "local", resource: { url: "/slides/" } },
        { id: "disabled", resource: { url: "/hidden/", enabled: false } },
    ] } });
    assertStringIncludes(doc.querySelector("#pending")!.textContent, "Coming soon");
    assertEquals(doc.querySelector("#pending a"), null);
    const published = doc.querySelector("#published a")!;
    assertEquals(published.getAttribute("href"), "https://example.com/recordings");
    assertEquals(published.getAttribute("target"), "_blank");
    assertStringIncludes(doc.querySelector("#published")!.textContent, "More talks next week.");
    assertEquals(doc.querySelector("#local a")?.getAttribute("href"), "/slides/");
    assert(!doc.querySelector("#local a")?.hasAttribute("target"));
    assertEquals(doc.querySelector("#disabled"), null);
});
