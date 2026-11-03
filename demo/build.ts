/**
 * Build the demo: every phase in phases.ts as its own Lume site, under one
 * host, with a bar on every page to move between them.
 *
 *     deno task build          -> _site/<slug>/ per phase, _site/index.html, _site/404.html
 *
 * Each phase builds through its own `deno task lume` (its own deno.json,
 * `_config.ts` and permissions, exactly as the site builds on its own) with
 * one override, `--location https://<host>/<slug>/`, which each site's
 * `basePath()` turns into the `/<slug>/` prefix on every root-relative URL.
 * The site's `_site/` is then moved here. The switcher is inserted into the
 * built HTML afterwards, so no phase carries demo code. A phase served from
 * its own folder has no bar.
 *
 * The showcase (showcase/) is built the same way under /showcase/,
 * beside the phases: its bar names it and leads back to the tour.
 *
 * The pure parts (`switcher`, `insert`, `landing`, `notFound`) are exported
 * for the tests; running the file builds.
 */

import { walk } from "lume/deps/fs.ts";
import { fromFileUrl, posix } from "lume/deps/path.ts";
import { host, type Phase, phases, showcase } from "./phases.ts";

const here = fromFileUrl(new URL("./", import.meta.url));
const dest = posix.join(here, "_site");

/** The `index` the switcher takes for the showcase: not a phase, so no "phase n of", and its links go to the phases' home pages. */
export const SHOWCASE = -2;

const style = `
.kcd-phases{position:fixed;inset-inline:0;bottom:0;z-index:25;display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.6rem 1rem;background:#111827;color:#f9fafb;font:500 .875rem/1.4 system-ui,sans-serif;box-shadow:0 -2px 12px rgba(0,0,0,.25)}
.kcd-phases a{color:#f9fafb;text-decoration:none;white-space:nowrap}
.kcd-phases a:hover{text-decoration:underline}
.kcd-phases-end{flex:1 1 0}
.kcd-phases>a{flex:1 1 0}
.kcd-phases>a[rel=next]{text-align:right}
.kcd-phases details{position:relative;flex:0 0 auto}
.kcd-phases summary{cursor:pointer;list-style:none;white-space:nowrap}
.kcd-phases summary::-webkit-details-marker{display:none}
.kcd-phases ol{position:absolute;bottom:100%;left:50%;transform:translateX(-50%);margin:0 0 .75rem;padding:.5rem 0;list-style:none;background:#1f2937;border-radius:.5rem;min-width:15rem;box-shadow:0 4px 16px rgba(0,0,0,.3)}
.kcd-phases ol a{display:block;padding:.35rem 1rem}
.kcd-phases ol a[aria-current]{font-weight:700;background:#374151}
.kcd-phases-extra{margin-top:.5rem;padding-top:.5rem;border-top:1px solid #374151}
body{padding-bottom:3.25rem}
`.trim();

if (import.meta.main) {
  // Start clean: a phase dropped from the list must not linger.
  await Deno.remove(dest, { recursive: true }).catch(() => {});
  await Deno.mkdir(dest, { recursive: true });

  for (const [index, phase] of phases.entries()) {
    console.log(`\n== ${phase.slug} (${phase.folder})`);
    await buildPhase(phase);
    await addSwitcher(phase, index);
  }
  console.log(`\n== ${showcase.slug} (${showcase.folder})`);
  await buildPhase(showcase);
  await addSwitcher(showcase, SHOWCASE);

  await Deno.writeTextFile(posix.join(dest, "index.html"), landing(phases));
  await Deno.writeTextFile(posix.join(dest, "404.html"), notFound(phases));
  console.log(`\n${phases.length} phases and the showcase built into ${posix.relative(Deno.cwd(), dest) || "."}/`);
}

/** The site's own build with the hosted location, moved to _site/<slug>/. */
async function buildPhase(phase: Phase): Promise<void> {
  const cwd = posix.join(here, phase.folder);
  const command = new Deno.Command("deno", {
    cwd,
    args: ["task", "lume", "--location", `https://${host}/${phase.slug}/`],
    stdout: "inherit",
    stderr: "inherit",
  });
  const { success, code } = await command.output();
  if (!success) throw new Error(`${phase.slug}: the build in ${phase.folder} exited with ${code}`);
  await Deno.rename(posix.join(cwd, "_site"), posix.join(dest, phase.slug));
}

/** The bar into every page of the built site. */
async function addSwitcher(phase: Phase, index: number): Promise<void> {
  const root = posix.join(dest, phase.slug);
  for await (const entry of walk(root, { exts: [".html"], includeDirs: false })) {
    const html = await Deno.readTextFile(entry.path);
    const path = index === SHOWCASE ? "/" : pagePath(posix.relative(root, entry.path));
    await Deno.writeTextFile(entry.path, insert(html, switcher(phases, index, path)));
  }
}

/** "tickets/index.html" -> "/tickets/", "404.html" -> "/404.html": the path the same page has in every phase. */
export function pagePath(relative: string): string {
  const path = `/${relative}`;
  return path.endsWith("/index.html") ? path.slice(0, -"index.html".length) : path;
}

/** The bar before `</body>`; a document without one is returned as is. */
export function insert(html: string, bar: string): string {
  const at = html.lastIndexOf("</body>");
  return at === -1 ? html : `${html.slice(0, at)}${bar}\n${html.slice(at)}`;
}

/**
 * The bar: previous and next, the current phase opening a list of all of
 * them and of the showcase, every link to `path` in the target phase.
 * `index` -1 is the root (landing page, 404), which has no current phase;
 * `SHOWCASE` is the showcase, which is current without being a phase.
 */
export function switcher(all: Phase[], index: number, path: string): string {
  const onShowcase = index === SHOWCASE;
  const current = onShowcase ? showcase : all[index];
  const prev = onShowcase ? all[all.length - 1] : all[index - 1];
  const next = all[index + 1];
  const href = (phase: Phase) => `/${phase.slug}${path}`;
  const items = [
    ...all.map((phase, i) =>
      `<li><a href="${href(phase)}"${i === index ? ' aria-current="page"' : ""}>${i + 1}. ${escape(phase.label)}</a></li>`
    ),
    `<li class="kcd-phases-extra"><a href="/${showcase.slug}/"${onShowcase ? ' aria-current="page"' : ""}>${escape(showcase.label)}</a></li>`,
  ].join("");
  const title = onShowcase
    ? `<strong>${escape(showcase.label)}</strong> · components and shapes`
    : current
    ? `Phase ${index + 1} of ${all.length} · <strong>${escape(current.label)}</strong>`
    : "Pick a phase";
  return `<nav class="kcd-phases" aria-label="Demo phases">
<style>${style}</style>
${prev ? `<a rel="prev" href="${href(prev)}">&larr; ${escape(prev.label)}</a>` : `<span class="kcd-phases-end"></span>`}
<details><summary>${title} &#9652;</summary><ol>${items}</ol></details>
${next ? `<a rel="next" href="${href(next)}">${escape(next.label)} &rarr;</a>` : `<span class="kcd-phases-end"></span>`}
</nav>`;
}

/** _site/index.html: the phases in order, each a sentence and a link. */
export function landing(all: Phase[]): string {
  const items = all.map((phase, i) =>
    `<li><a href="/${phase.slug}/"><strong>${i + 1}. ${escape(phase.label)}</strong></a><br>${escape(phase.summary)}</li>`
  ).join("\n");
  return page(
    "The KCD website template, phase by phase",
    `<h1>The KCD website template, phase by phase</h1>
<p>The same site at each stage of an edition, from the announcement to the
post-conference recap. Every phase is a complete site; the bar at the bottom of
each page moves between them, staying on the same page.</p>
<ol>
${items}
</ol>
<h2>And the parts</h2>
<p><a href="/${showcase.slug}/"><strong>${escape(showcase.label)}</strong></a><br>${escape(showcase.summary)}</p>`,
    switcher(all, -1, "/"),
  );
}

/** _site/404.html, served for any path no phase has: this page is not in this phase. */
export function notFound(all: Phase[]): string {
  const items = all.map((phase, i) => `<li><a href="/${phase.slug}/">${i + 1}. ${escape(phase.label)}</a></li>`).join("\n");
  return page(
    "Not in this phase",
    `<h1>Not in this phase</h1>
<p>The site does not have this page at this phase: it is not published yet,
or it has been taken down. Pick a phase to continue from its home page.</p>
<ol>
${items}
</ol>`,
    switcher(all, -1, "/"),
  );
}

function page(title: string, main: string, bar: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<style>
body { margin: 0; font: 1rem/1.6 system-ui, sans-serif; color: #111827; background: #f9fafb; }
main { max-width: 42rem; margin: 0 auto; padding: 3rem 1.5rem 5rem; }
h1 { font-size: 2rem; line-height: 1.2; }
ol { padding-left: 1.5rem; }
li { margin: 0.75rem 0; }
a { color: #1d4ed8; }
</style>
</head>
<body>
<main>
${main}
</main>
${bar}
</body>
</html>
`;
}

function escape(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
