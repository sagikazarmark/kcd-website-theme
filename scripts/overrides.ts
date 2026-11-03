/**
 * Lists the theme files an instance overrides:
 *
 *   deno task overrides              (deno run --allow-read overrides.ts [--src src])
 *
 * A local file at a theme file's path wins (../mod.ts) and stops receiving
 * theme updates; run this before an upgrade to see what to re-check. The
 * output is every path under the instance's src/ that the theme also has,
 * grouped: data (expected: a theme default replaced), components/layouts,
 * assets, other. Pages and style.css are the site's and not listed.
 * `--src <dir>` names the source folder (default `src`). Exit code 0 either
 * way.
 */

import { parseArgs } from "lume/deps/cli.ts";
import { walk } from "lume/deps/fs.ts";
import { getFiles } from "lume/core/utils/cdn.ts";

type Group = "data" | "components/layouts" | "assets" | "other";
const ORDER: Group[] = ["data", "components/layouts", "assets", "other"];

/** Which group a site path ("/_data/nav.yaml") belongs to. */
function groupOf(path: string): Group {
  if (path.startsWith("/_data/")) return "data";
  if (path.startsWith("/_components/") || path.startsWith("/_includes/")) {
    return "components/layouts";
  }
  if (path.startsWith("/assets/")) return "assets";
  return "other";
}

/** Every file under `dir`, as site paths starting with "/". */
async function localFiles(dir: string): Promise<Set<string>> {
  const files = new Set<string>();
  const base = dir.replace(/\/+$/, "");
  for await (const entry of walk(base, { includeDirs: false })) {
    files.add(entry.path.slice(base.length).replaceAll("\\", "/"));
  }
  return files;
}

async function main() {
  const args = parseArgs(Deno.args, {
    string: ["src"],
    boolean: ["help"],
    default: { src: "src" },
  });
  if (args.help) {
    console.log(
      "usage: overrides.ts [--src <dir>]\n\n" +
        "Lists every file under <dir> (default \"src\") that also exists in the\n" +
        "theme's src/, grouped by kind. Those files are forks of the theme's and\n" +
        "do not receive theme updates.",
    );
    return;
  }

  // No trailing slash on the theme URL: Lume's walk matches "/**" against
  // paths relative to it, which need their leading "/" (see ../mod.ts).
  const theme = await getFiles(import.meta.resolve("../src"), ["/**"]);
  const local = await localFiles(args.src);

  const groups = new Map<Group, string[]>();
  for (const path of [...local].sort()) {
    if (!theme.has(path)) continue;
    const group = groupOf(path);
    groups.set(group, [...groups.get(group) ?? [], path.slice(1)]);
  }

  const total = [...groups.values()].reduce((n, list) => n + list.length, 0);
  if (total === 0) {
    console.log(`No theme files are overridden by ${args.src}/.`);
    return;
  }

  console.log(
    `${total} theme file${total === 1 ? "" : "s"} overridden by ${args.src}/ ` +
      "(each is a fork of the theme's file and does not receive theme updates):",
  );
  for (const group of ORDER) {
    const list = groups.get(group);
    if (!list) continue;
    console.log(`\n${group}`);
    for (const path of list) console.log(`  ${path}`);
  }
}

if (import.meta.main) await main();
