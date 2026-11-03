/**
 * Build-time validation of the site data: on `beforeRender`, the merged
 * root data is checked against the Zod schemas in ./concepts.ts and the
 * build fails with one line per problem, naming the file and the key:
 *
 *     Data validation failed (2 issues):
 *       src/_data/cfp.yaml: open: Invalid input: expected boolean, received string
 *       src/_data/cfp.yaml: deadlne: Unrecognized key
 *
 * Installed by the theme plugin (../mod.ts). The schema is the contract
 * between the theme and a site; a change here is a theme API change.
 *
 * Rules: only known top-level keys are checked (a site may add its own
 * concepts), unknown keys inside a known concept are errors, and the
 * concepts in `required` must exist (`defaultRequired`: what the layouts,
 * menu and footer read; the site adds what its pages read). Every
 * top-level key is defined in exactly one file (a root `_data.*` key that
 * also has a `_data/<key>.*` file, or two such files, is an error; a theme
 * default and a local file of the same name are not, Lume registers the
 * remote only when no local exists). A nav `page` must be an id some page
 * declares, drafts included, and no two pages may share an id. The
 * programme's relational checks (../program.ts) run on `agenda` and
 * `speakers` with their `patches` applied.
 *
 * Options, through the theme plugin's `schema` option: `concepts` adds to
 * (or overrides) the built-in schemas, `required` replaces
 * `defaultRequired`. `validate()` is the check as a pure function, for
 * tests.
 *
 * Adding a concept: an `export const <key>Schema` in ./concepts.ts
 * listed in `concepts` there; in
 * `defaultRequired` only if a layout, the menu or the footer reads it.
 */

import { posix } from "lume/deps/path.ts";
import type { Entry } from "lume/core/fs.ts";
import type { z } from "npm:zod@4.6.7";
import {
  type Agenda,
  concepts as builtinConcepts,
  type Patches,
  type Speakers,
} from "./concepts.ts";
import { applyPatches, checkProgram, type ProgramIssue } from "../program.ts";

/** The built-in schemas by top-level key; see ./concepts.ts. */
export const concepts: Readonly<Record<string, z.ZodType>> = builtinConcepts;

/**
 * What the theme's layouts, menu and footer read; a site adds what its
 * pages read (`[...defaultRequired, "venue", ...]` as `required`).
 */
export const defaultRequired: readonly string[] = [
  "event",
  "share",
  "logo",
  "social",
  "nav",
  "footer",
];

/** The theme plugin's `schema` option. */
export interface Options {
  /** Replaces `defaultRequired`: the concepts that must be present. */
  required?: string[];
  /** Added to the built-in `concepts`; a key already there is overridden. */
  concepts?: Record<string, z.ZodType>;
}

/** One problem: where (both optional) and what. */
export interface Issue {
  /** The data file, relative to the working directory; "" when not about one file. */
  file: string;
  /** The key path inside the file, `speakers[1].talk`; "" for the whole file. */
  path: string;
  message: string;
}

/** Where a concept's data lives, for the messages; `DataFiles` below, or a test's convention. */
export interface Locator {
  /**
   * The file a concept came from and the key prefix inside it (`["event"]`
   * in a root data file, `[]` in its own); for a folder concept, `files`
   * maps each top-level key to its file (`terms.hu` -> `terms/hu.md`).
   */
  locate(
    concept: string,
  ): { file: string; prefix: PropertyKey[]; files?: Record<string, string> };
  /** The path a missing data file would be created at, from its name under `_data/` (`event.yaml`, `terms/<lang>.md`). */
  expected(name: string): string;
}

/** Thrown from the `beforeRender` listener; `message` is the full report. */
export class DataError extends Error {
  issues: Issue[];

  constructor(issues: Issue[]) {
    const lines = issues.map(({ file, path, message }) =>
      "  " + [file, path, message].filter(Boolean).join(": ")
    );
    super(
      `Data validation failed (${issues.length} issue${
        issues.length === 1 ? "" : "s"
      }):\n${lines.join("\n")}`,
    );
    this.name = "DataError";
    this.issues = issues;
  }
}

/** Validate the site data on every build; see the header comment. */
export default function dataSchema(options: Options = {}): Lume.Plugin {
  const schemas = { ...concepts, ...options.concepts };
  const required = new Set(options.required ?? defaultRequired);

  return (site) => {
    site.addEventListener("beforeRender", async () => {
      const files = new DataFiles(site);
      const duplicates = await files.duplicates();
      const pages = await pageIds(site);
      const issues = [
        ...duplicates.issues,
        ...pages.issues,
        ...validate(site.source.data.get("/") ?? {}, files, {
          schemas,
          required,
          skip: duplicates.keys,
          pageIds: pages.ids,
        }),
      ];
      if (issues.length) {
        issues.sort((a, b) =>
          a.file === b.file
            ? (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
            : (a.file < b.file ? -1 : 1)
        );
        throw new DataError(issues);
      }
    });
  };
}

// ---------------------------------------------------------------------------
// Page ids

/**
 * The `id` every page source declares, drafts included (a link may name a
 * draft page; only an id no page declares is a mistake), and an issue for
 * an id two pages share. Read through the loader Lume already used for the
 * page, whose result the entry caches, so no second parse.
 */
async function pageIds(
  site: Lume.Site,
): Promise<{ ids: Set<string>; issues: Issue[] }> {
  const where = new Map<string, string[]>();
  for (const [path, entry] of site.fs.entries) {
    if (entry.type !== "file") continue;
    // Lume skips `_` and `.` prefixed files and folders.
    if (path.split("/").some((part) => /^[_.]/.test(part))) continue;
    const format = site.formats.search(path);
    if (!format?.isPage || !format.loader) continue;
    const data = await entry.getContent(format.loader) as { id?: unknown };
    if (data.id === undefined) continue;
    const id = String(data.id);
    const label = entry.flags.has("remote")
      ? `${path.slice(1)} (theme)`
      : posix.relative(site.options.cwd, entry.src);
    where.set(id, [...(where.get(id) ?? []), label]);
  }
  const issues: Issue[] = [];
  for (const [id, paths] of where) {
    if (paths.length < 2) continue;
    issues.push({
      file: "",
      path: "",
      message: `page id "${id}" is declared by ${paths.sort().join(" and ")}; an id names one page`,
    });
  }
  return { ids: new Set(where.keys()), issues };
}

// ---------------------------------------------------------------------------
// Schema validation

/**
 * The shape check and the cross-concept checks over the merged root data,
 * as a list of issues (empty when the data is fine). Pure: the plugin above
 * runs it with Lume's `DataFiles` as the locator and the duplicates it found
 * as `skip`; a test runs it on a plain object.
 */
export function validate(
  root: Record<string, unknown>,
  files: Locator,
  { schemas = concepts, required = new Set(defaultRequired), skip = new Set(), pageIds }: {
    schemas?: Record<string, z.ZodType>;
    required?: Set<string>;
    /** Keys the single-definition rule flagged; their merged value is arbitrary. */
    skip?: Set<string>;
    /**
     * The ids the site's pages declare (drafts included), for the links in
     * the data that name a page. Left out, no link is checked (a test over
     * the data alone).
     */
    pageIds?: Set<string>;
  } = {},
): Issue[] {
  const issues: Issue[] = [];
  const passed = new Set<string>();

  for (const [concept, schema] of Object.entries(schemas)) {
    if (skip.has(concept)) continue;
    const value = root[concept];
    if (value === undefined) {
      if (required.has(concept)) {
        issues.push({
          file: `${concept} (missing)`,
          path: "",
          message: `the build cannot complete without it; add ${
            files.expected(fileName(concept, schema))
          }, or drop "${concept}" from the required list in _config.ts if no page reads it`,
        });
      }
      continue;
    }
    const result = schema.safeParse(value, { reportInput: true });
    if (result.success) {
      passed.add(concept);
      continue;
    }
    const { file, prefix, files: children } = files.locate(concept);
    for (const issue of result.error.issues) {
      for (const { path, message } of describe(issue)) {
        const child = children?.[String(path[0])];
        issues.push(
          child
            ? { file: child, path: formatPath(path.slice(1)), message }
            : { file, path: formatPath([...prefix, ...path]), message },
        );
      }
    }
  }

  // Cross-concept checks, only between concepts whose own shape is right.
  const ok = (concept: string) =>
    root[concept] === undefined || passed.has(concept);
  if (pageIds && passed.has("nav")) {
    issues.push(...pageLinkIssues(root.nav as Nav, pageIds, files.locate("nav")));
  }
  if (
    (root.agenda !== undefined || root.speakers !== undefined) &&
    ok("agenda") && ok("speakers") && ok("patches")
  ) {
    issues.push(...programIssues(root, files));
  }

  return issues;
}

interface Nav {
  main: { page?: string }[];
  secondary?: { page?: string }[];
  cta: { page?: string };
}

/** Every `page` a nav link names must be a page's id: a typo would hide the link quietly. */
function pageLinkIssues(
  nav: Nav,
  pageIds: Set<string>,
  { file, prefix }: { file: string; prefix: PropertyKey[] },
): Issue[] {
  const issues: Issue[] = [];
  const check = (page: string | undefined, path: PropertyKey[]) => {
    if (page === undefined || pageIds.has(page)) return;
    issues.push({
      file,
      path: formatPath([...prefix, ...path, "page"]),
      message: `no page declares \`id: ${page}\` in its front matter`,
    });
  };
  nav.main.forEach((item, index) => check(item.page, ["main", index]));
  nav.secondary?.forEach((item, index) => check(item.page, ["secondary", index]));
  check(nav.cta.page, ["cta"]);
  return issues;
}

/**
 * The programme's relational checks (../program.ts) on the patched data,
 * each issue placed in the file to fix: the patch file when the value came
 * from a patch, else the concept's own.
 */
function programIssues(root: Record<string, unknown>, files: Locator): Issue[] {
  const agenda = (root.agenda ?? { sessions: [] }) as Agenda;
  const speakers = (root.speakers ?? []) as Speakers;
  const patches = root.patches as Patches | undefined;
  const issues: Issue[] = [];

  const patched = applyPatches(agenda, speakers, patches);

  const patchFile = (concept: "agenda" | "speakers") => {
    const { file, prefix, files: children } = files.locate("patches");
    return children?.[concept]
      ? { file: children[concept], prefix: [] as PropertyKey[] }
      : { file, prefix: [...prefix, concept] };
  };

  for (const { concept, list, index, id } of patched.unknown) {
    const { file, prefix } = patchFile(concept);
    const inside: PropertyKey[] = list ? [list, index, "id"] : [index, "id"];
    issues.push({
      file,
      path: formatPath([...prefix, ...inside]),
      message: `no ${list ? list.slice(0, -1) : "speaker"} with id "${id}" to patch`,
    });
  }

  // The index of the patch that set `key` on the record with `id`, if any.
  const patchFor = (
    concept: "agenda" | "speakers",
    list: ProgramIssue["list"],
    id: string | undefined,
    key: PropertyKey | undefined,
  ): number | undefined => {
    if (id === undefined || key === undefined) return undefined;
    const entries = concept === "speakers"
      ? patches?.speakers
      : list === "sessions"
      ? patches?.agenda?.sessions
      : list === "breaks"
      ? patches?.agenda?.breaks
      : undefined;
    const at = entries?.findIndex((patch) =>
      patch.id === id && (patch as Record<string, unknown>)[String(key)] !== undefined
    );
    return at === undefined || at === -1 ? undefined : at;
  };

  for (const { concept, list, index, key, message } of checkProgram(patched.agenda, patched.speakers)) {
    const record = concept === "speakers"
      ? patched.speakers[index]
      : list === "sessions"
      ? patched.agenda.sessions[index]
      : list === "breaks"
      ? patched.agenda.breaks?.[index]
      : undefined;
    const viaPatch = patchFor(concept, list, record?.id, key[0]);
    if (viaPatch !== undefined) {
      const { file, prefix } = patchFile(concept);
      const inside: PropertyKey[] = list ? [list, viaPatch, ...key] : [viaPatch, ...key];
      issues.push({ file, path: formatPath([...prefix, ...inside]), message });
      continue;
    }
    const { file, prefix } = files.locate(concept);
    const inside: PropertyKey[] = list ? [list, index, ...key] : [index, ...key];
    issues.push({ file, path: formatPath([...prefix, ...inside]), message });
  }

  return issues;
}

/** The file a concept is expected in: `<key>.yaml`, unless the schema's `meta().file` says otherwise (`terms/<lang>.md`). */
function fileName(concept: string, schema: z.ZodType): string {
  const file = schema.meta()?.file;
  return typeof file === "string" ? file : `${concept}.yaml`;
}

/**
 * A Zod issue as report lines: one per unrecognized key, with the key on
 * the path; an absent required key as "missing" rather than a type
 * mismatch; a wrapping issue with its first nested message appended.
 */
function describe(
  issue: z.core.$ZodIssue,
): { path: PropertyKey[]; message: string }[] {
  if (issue.code === "unrecognized_keys") {
    return issue.keys.map((key) => ({
      path: [...issue.path, key],
      message: "Unrecognized key",
    }));
  }
  if (issue.code === "invalid_type" && isMissing(issue)) {
    return [{
      path: issue.path,
      message: `missing (expected ${issue.expected})`,
    }];
  }
  let { message } = issue;
  if ("issues" in issue && issue.issues.length > 0) {
    message += `: ${issue.issues[0].message}`;
  }
  return [{ path: issue.path, message }];
}

/** Whether an invalid-type issue is about an absent value (`reportInput` puts `input` on the issue). */
function isMissing(issue: z.core.$ZodIssueInvalidType): boolean {
  return "input" in issue
    ? issue.input === undefined
    : issue.message.endsWith("received undefined");
}

/** `["speakers", 1, "talk"]` -> `speakers[1].talk`. */
function formatPath(path: PropertyKey[]): string {
  return path
    .map((segment, index) =>
      typeof segment === "number"
        ? `[${segment}]`
        : index === 0
        ? String(segment)
        : `.${String(segment)}`
    )
    .join("");
}

// ---------------------------------------------------------------------------
// Data files: where a concept lives, and the single-definition rule

/** The build's data files, from `site.fs.entries`: `/_data/<key>.*` and the root `/_data.*`. */
class DataFiles implements Locator {
  #site: Lume.Site;
  #extensions: Set<string>;
  /** Top-level key -> the per-concept entries (files or folders) defining it. */
  #byKey = new Map<string, Entry[]>();
  #roots: Entry[] = [];
  /** Top-level key -> the root files defining it; filled by `duplicates()`. */
  #rootKeys = new Map<string, Entry[]>();

  constructor(site: Lume.Site) {
    this.#site = site;
    this.#extensions = new Set(
      [...site.formats.entries.values()]
        .filter((format) => format.dataLoader)
        .map((format) => format.ext),
    );

    for (const [path, entry] of site.fs.entries) {
      const root = path.match(/^\/_data(\.[^/]+)$/);
      if (root && this.#extensions.has(root[1])) {
        this.#roots.push(entry);
        continue;
      }
      const child = path.match(/^\/_data\/([^/]+)$/);
      if (!child) continue;
      const name = child[1];
      if (name.startsWith(".") || name.startsWith("_")) continue;
      let key = name;
      if (entry.type === "file") {
        const ext = posix.extname(name);
        if (!this.#extensions.has(ext)) continue;
        key = posix.basename(name, ext);
      }
      const entries = this.#byKey.get(key) ?? [];
      entries.push(entry);
      this.#byKey.set(key, entries);
    }
  }

  /**
   * The single-definition rule: every key defined in more than one file,
   * plus the flagged keys so the caller skips their (arbitrary) merged value.
   */
  async duplicates(): Promise<{ issues: Issue[]; keys: Set<string> }> {
    for (const entry of this.#roots) {
      const loader = this.#site.formats.search(entry.path)?.dataLoader;
      if (!loader) continue;
      const data = await entry.getContent(loader);
      for (const key of Object.keys(data)) {
        const entries = this.#rootKeys.get(key) ?? [];
        entries.push(entry);
        this.#rootKeys.set(key, entries);
      }
    }

    const issues: Issue[] = [];
    const flagged = new Set<string>();
    const keys = new Set([...this.#rootKeys.keys(), ...this.#byKey.keys()]);
    for (const key of [...keys].sort()) {
      const inRoot = this.#rootKeys.get(key) ?? [];
      const inFiles = this.#byKey.get(key) ?? [];
      if (inRoot.length + inFiles.length < 2) continue;
      flagged.add(key);
      // Sorted: the folder read order is not stable, the message should be.
      const names = [
        ...inRoot.map((entry) => this.#label(entry)).sort(),
        ...inFiles.map((entry) => this.#label(entry)).sort(),
      ];
      issues.push({
        file: "",
        path: "",
        message: inRoot.length > 0
          ? `"${key}" is defined in ${names.join(" and ")}; keep exactly one`
          : `"${key}" is defined twice: ${names.join(" and ")}`,
      });
    }
    return { issues, keys: flagged };
  }

  /** Its own file (a remote one marked as the theme's), else the root file with the key as prefix, else a plugin set it. */
  locate(
    concept: string,
  ): { file: string; prefix: PropertyKey[]; files?: Record<string, string> } {
    const own = this.#byKey.get(concept)?.[0];
    if (own?.type === "directory") {
      const files: Record<string, string> = {};
      for (const [name, child] of own.children) {
        const ext = posix.extname(name);
        if (child.type !== "file" || !this.#extensions.has(ext)) continue;
        files[posix.basename(name, ext)] = this.#label(child);
      }
      return { file: `${this.#label(own)}/`, prefix: [], files };
    }
    if (own) return { file: this.#label(own), prefix: [] };
    const root = this.#rootKeys.get(concept)?.[0];
    if (root) return { file: this.#label(root), prefix: [concept] };
    return { file: `${concept} (theme default)`, prefix: [] };
  }

  expected(name: string): string {
    return `${this.#relative(this.#site.src())}/_data/${name}`;
  }

  #label(entry: Entry): string {
    const remote = entry.flags.has("remote");
    const path = remote ? entry.path.slice(1) : this.#relative(entry.src);
    return remote ? `${path} (theme default)` : path;
  }

  #relative(path: string): string {
    return posix.relative(this.#site.options.cwd, path);
  }
}
