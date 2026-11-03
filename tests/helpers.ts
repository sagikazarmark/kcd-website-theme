/**
 * Test harness: render the theme in-process and look at what comes out.
 *
 * Nothing here spawns a build or copies the demo. A test describes a tiny
 * Lume site (a few files under src/, some global data), gets it built in the
 * test process by the same `lume()` + `kcd()` the real `_config.ts` uses,
 * and reads the rendered pages from memory. The theme's layouts, components
 * and default data arrive as remote fallbacks exactly as they do for a site;
 * the build pipeline plugins (Tailwind, base path, favicon) are left out,
 * being the site's and nothing a component test needs.
 *
 *     const doc = await render(`{{ comp ui.until { time: "2020-01-01T00:00:00Z" } }}Hi{{ /comp }}`);
 *     assert(doc.querySelector("[data-until]")?.hasAttribute("hidden"));
 *
 * `render()` is the component seam: one page holding the template, no
 * layout, parsed with deno-dom so assertions are selectors rather than
 * substrings. `build()` is for layouts and anything that needs more than one
 * file. `buildError()` is for the schema: the message a failing build prints.
 * `buildSite()` builds a real instance folder the same way: the demo's last
 * agenda (the full site) and announcement (the sparse one), the smoke tests
 * that exercise the theme end to end.
 *
 * The data schema runs on every build with `required` emptied, so a fixture
 * provides only what its component reads, but what it provides must still
 * have the right shape: a test fixture is held to the same contract as an
 * instance. Pass `theme` to change that. The theme also insists on the
 * site's `src/style.css` (the Tailwind entry; the theme ships none), so a
 * fixture gets an empty stub unless it writes its own or sets
 * `stylesheet: false` to test the refusal.
 *
 * A build fails loudly here on anything Lume logs as an error. Lume itself
 * does not: a Vento error inside a component is logged and the component
 * renders as the string "undefined" (plugins/vento.ts), and a build in CLI
 * mode prints the error after the fact and exits 0. In-process nobody even
 * flushes that log, so the harness collects it through Lume's debug-bar hook
 * and turns it into a thrown error with the template and line.
 */

import lume from "lume/mod.ts";
import type { Writer } from "lume/core/writer.ts";
import type { Collection } from "lume/core/debugbar.ts";
import { log } from "lume/core/utils/log.ts";
import { DOMParser, type HTMLDocument } from "lume/deps/dom.ts";
import kcd, { type Options as ThemeOptions } from "../mod.ts";

export interface Fixture {
    /** Files under src/, path -> content ("index.vto", "_data/event.yaml"). */
    files?: Record<string, string>;
    /** Global data, as if set by `site.data()`: what templates read as `event`, `social`, ... */
    data?: Record<string, unknown>;
    /** Theme plugin options. Default: the schema with no required concepts. */
    theme?: ThemeOptions;
    /** Write a stub src/style.css. Default true; false leaves the site without one. */
    stylesheet?: boolean;
}

export interface Built {
    /** URLs of every page rendered ("/", "/venue/", "/404.html"), sorted. */
    urls: string[];
    has(url: string): boolean;
    /** The page's HTML; throws when there is no such page. */
    html(url: string): string;
    /** The page parsed with deno-dom. */
    dom(url: string): HTMLDocument;
}

/** The repository root: the theme. */
const root = new URL("../", import.meta.url);
/** The announcement demo, the site at its first stage. */
export const announced = new URL("demo/announced/", root);
/** The demo's last phase, the fullest site: the fixture for component, layout and schema tests. */
export const fullSite = new URL("demo/agenda/", root);
const defaultTheme: ThemeOptions = { schema: { required: [] } };

/** Keeps every page in `site.pages` and writes nothing. */
const inMemory: Writer = {
    savePages: (pages) => Promise.resolve(pages),
    copyFiles: (files) => Promise.resolve(files),
    clear: () => Promise.resolve(),
    removeFiles: () => Promise.resolve(),
};

/** Parse an HTML string, a fragment included. */
export function parse(html: string): HTMLDocument {
    return new DOMParser().parseFromString(html, "text/html");
}

/** Build a fixture site in-process and return its pages. */
export async function build(fixture: Fixture = {}): Promise<Built> {
    const dir = await writeFixture(sourceFiles(fixture));
    try {
        const site = configure(dir.pathname, fixture);
        await run(site);
        return collect(site);
    } finally {
        await Deno.remove(dir, { recursive: true });
    }
}

/**
 * Render one template as a page without a layout: the component seam.
 * `template` is the body of `index.vto`; `fixture.data` is what it reads.
 * A comment is appended so the page is never empty: Lume drops a page whose
 * rendered content is "", and a component that hides itself renders exactly
 * that.
 */
export async function render(template: string, fixture: Omit<Fixture, "files"> = {}): Promise<HTMLDocument> {
    const built = await build({ ...fixture, files: { "index.vto": `${template}\n<!-- render -->\n` } });
    return built.dom("/");
}

/** Build a fixture that must fail; returns the error message. */
export async function buildError(fixture: Fixture = {}): Promise<string> {
    const dir = await writeFixture(sourceFiles(fixture));
    try {
        const site = configure(dir.pathname, fixture);
        await run(site);
    } catch (error) {
        return error instanceof Error ? error.message : String(error);
    } finally {
        await Deno.remove(dir, { recursive: true });
    }
    throw new Error("Expected the build to fail, but it succeeded");
}

/**
 * Build an instance folder (its src/) in-process with the theme's default
 * required list, writing nothing: `fullSite` or `announced`. The pipeline
 * plugins are left out here too (favicon needs a native module the test
 * sandbox has no FFI for); `deno task build` in CI is the real thing.
 */
export async function buildSite(folder: URL = fullSite): Promise<Built> {
    const site = lume({ cwd: folder.pathname, src: "src" }, {}, false);
    site.writer = inMemory;
    site.use(kcd());
    await run(site);
    return collect(site);
}

function configure(cwd: string, fixture: Fixture): Lume.Site {
    const site = lume({ cwd, src: "src" }, {}, false);
    site.writer = inMemory;
    site.use(kcd(fixture.theme ?? defaultTheme));
    for (const [key, value] of Object.entries(fixture.data ?? {})) {
        site.data(key, value);
    }
    return site;
}

/** The fixture's files under src/, with the stylesheet stub unless declined or supplied. */
function sourceFiles(fixture: Fixture): Record<string, string> {
    const files = { ...fixture.files };
    if (fixture.stylesheet !== false && !("style.css" in files)) {
        files["style.css"] = "/* stub: the pipeline plugins are not in the harness */\n";
    }
    return files;
}

/**
 * Build with Lume's log watched: an error logged during the build (a
 * template that threw, which Lume otherwise swallows) fails the build like a
 * thrown one.
 */
async function run(site: Lume.Site): Promise<void> {
    const collection: Collection = { name: "test", items: [] };
    log.collection = collection;
    try {
        await site.build();
    } finally {
        // Prints what Lume buffered (visible under the test's output) and
        // clears its dedupe set, so the next build reports the same error
        // again rather than once per process.
        log.output();
    }
    const errors = collection.items.filter((item) => item.context === "error" || item.context === "fatal");
    if (errors.length > 0) {
        const report = errors
            .map((item) => [item.title, item.text, item.code].filter(Boolean).join("\n"))
            .join("\n\n");
        throw new Error(`Lume logged ${errors.length} error(s) during the build:\n${report}`);
    }
}

function collect(site: Lume.Site): Built {
    const pages = new Map<string, string>();
    for (const page of site.pages) {
        if (typeof page.content === "string" && page.outputPath.endsWith(".html")) {
            pages.set(page.data.url, page.content);
        }
    }
    const html = (url: string) => {
        const content = pages.get(url);
        if (content === undefined) {
            throw new Error(`No page at ${url}; pages: ${[...pages.keys()].sort().join(", ")}`);
        }
        return content;
    };
    return {
        urls: [...pages.keys()].sort(),
        has: (url) => pages.has(url),
        html,
        dom: (url) => parse(html(url)),
    };
}

async function writeFixture(files: Record<string, string>): Promise<URL> {
    const dir = new URL(`tests/.tmp/${crypto.randomUUID().slice(0, 8)}/`, root);
    const src = new URL("src/", dir);
    await Deno.mkdir(src, { recursive: true });
    for (const [path, content] of Object.entries(files)) {
        const file = new URL(path, src);
        await Deno.mkdir(new URL("./", file), { recursive: true });
        await Deno.writeTextFile(file, content);
    }
    return dir;
}
