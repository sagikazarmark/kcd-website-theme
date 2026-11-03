import { assert, assertEquals } from "@std/assert";
import { render } from "./helpers.ts";

const images = [
    { src: "/preview.webp", full: "/full.webp", alt: "A speaker on stage", width: 1200, height: 800 },
    { src: "/portrait.webp", alt: "A hallway conversation", width: 800, height: 1200 },
];

Deno.test("gallery: independent instances, labelled dialogs, original sources and no-JS links", async () => {
    const doc = await render('{{ comp.gallery({ id: "first", images }) }}{{ comp.gallery({ id: "second", images }) }}', { data: { images } });
    const ids = [...doc.querySelectorAll("[id]")].map((el) => el.id);
    assertEquals(new Set(ids).size, ids.length);
    for (const id of ["first", "second"]) {
        assertEquals(doc.querySelectorAll(`#${id} [data-dialog-open]`).length, 2);
        for (const [index, image] of images.entries()) {
            const dialogId = `${id}-photo-${index}`;
            assert(doc.querySelector(`[data-dialog-open="${dialogId}"]`));
            const dialog = doc.querySelector(`dialog#${dialogId}`)!;
            assertEquals(dialog.getAttribute("aria-labelledby"), `${dialogId}-title`);
            assertEquals(doc.querySelector(`#${dialogId}-title`)?.textContent, image.alt);
            assertEquals(dialog.querySelector("img")?.getAttribute("src"), image.full || image.src);
            assert(dialog.querySelector("[data-dialog-close]"));
        }
        assertEquals(doc.querySelectorAll(`#${id} noscript`).length, 2);
    }
});

Deno.test("gallery: empty images render no grid or dialogs; the caller controls the preview count", async () => {
    const empty = await render('{{ comp.gallery({ id: "empty", images: [] }) }}');
    assert(!empty.querySelector(".kcd-gallery, dialog"));
    const doc = await render('{{ comp.gallery({ id: "all", images }) }}', { data: { images: Array(8).fill(images[0]) } });
    assertEquals(doc.querySelectorAll("#all [data-dialog-open]").length, 8);
});
