/**
 * Markdown data: what the theme promises a page that keeps a concept as a
 * folder of Markdown files (the terms, src/_data/terms/<lang>.md; see
 * "Markdown data" in ../mod.ts). The folder loads as one object keyed by
 * file name, each file its front matter plus the body as `content`, which
 * Lume's `md` filter renders.
 *
 *     deno task test
 */

import { assertEquals } from "@std/assert";
import { build } from "./helpers.ts";

const terms = {
    "_data/terms/hu.md": "---\nlabel: Magyar\ntitle: ÁSZF\norder: 1\n---\n### Regisztráció\n\n- **Fontos** sor\n",
    "_data/terms/en.md": "---\nlabel: English\ntitle: Terms\norder: 2\n---\n### Registration\n\nA [link](https://example.com).\n",
};

Deno.test("a _data folder of Markdown files loads as one object: file name -> front matter plus content", async () => {
    const site = await build({
        files: {
            ...terms,
            "index.vto": [
                "{{ for lang of Object.keys(terms).sort() }}",
                '<p data-lang="{{ lang }}">{{ terms[lang].label }}|{{ terms[lang].title }}|{{ terms[lang].order }}</p>',
                "{{ /for }}",
                "<pre>{{ terms.en.content }}</pre>",
                "",
            ].join("\n"),
        },
    });
    const doc = site.dom("/");
    assertEquals(
        [...doc.querySelectorAll("p[data-lang]")].map((p) => [p.getAttribute("data-lang"), p.textContent]),
        [["en", "English|Terms|2"], ["hu", "Magyar|ÁSZF|1"]],
    );
    assertEquals(doc.querySelector("pre")?.textContent, "### Registration\n\nA [link](https://example.com).\n", "the body is left as written");
});

Deno.test("the content renders through Lume's md filter, headings as written", async () => {
    const site = await build({
        files: {
            ...terms,
            "index.vto": '<h2>Title</h2><div class="markdown-body">{{ terms.en.content |> md }}</div>\n',
        },
    });
    const body = site.dom("/").querySelector(".markdown-body");
    assertEquals(body?.querySelector("h3")?.textContent, "Registration", "### is the h3 under the page's h2");
    assertEquals(body?.querySelector("p a")?.getAttribute("href"), "https://example.com");
});
