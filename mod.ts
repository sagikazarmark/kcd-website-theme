/**
 * The KCD theme: a Lume plugin with the parts of a Kubernetes Community
 * Days website a site should not have to write: the layouts
 * (src/_includes/layouts/), the components (src/_components/), the browser
 * script (src/assets/theme.js) and the components' CSS, the data schema
 * (./schema/), the schedule view model (./schedule.ts) and default data
 * where a default is safe on any KCD site (`logo`, by convention at
 * /assets/logo-*.svg, and `footer`). Not the pages: a site writes its own `src/*.vto` over the
 * components and owns them; https://github.com/sagikazarmark/kcd-website-template ships a full set.
 * Plugin and component reference: docs/theme-reference.md.
 *
 * A site's `_config.ts`:
 *
 *     import lume from "lume/mod.ts";
 *     import tailwindcss from "lume/plugins/tailwindcss.ts";
 *     import kcd from "kcd-theme/mod.ts";    // the alias in deno.json: ../../ here, a tagged URL once published
 *     import { defaultRequired } from "kcd-theme/schema/mod.ts";
 *     const site = lume({ src: "src", location: new URL("https://kcd-mycity.example") });
 *     site.use(kcd({ schema: { required: [...defaultRequired, "venue", "tickets", ...] } }));
 *     site.use(tailwindcss());               // required: the theme is written in Tailwind
 *     export default site;
 *
 * The build pipeline (Tailwind, base path, favicon, picture) is the site's.
 *
 * Override model: every file under the theme's src/ is registered as a
 * remote fallback for the same path under the site's src/, and a local
 * file wins. Overriding a theme file forks it (it stops receiving theme
 * updates); `deno task overrides` lists such files. Pages and `style.css`
 * are the site's to begin with.
 *
 * What a site must provide: the concepts the layouts, menu and footer read
 * (`defaultRequired` in ./schema/mod.ts), the concepts its pages read
 * (declared through `required`), `src/style.css` (the Tailwind entry with
 * the colour roles `primary`, `secondary`, `accent`; the theme's own CSS is
 * `_includes/theme.css`, which it imports), `src/favicon.svg` (the KCD
 * wheel stands in without one), the logo lockups at /assets/logo-*.svg
 * (or a `logo.yaml` naming other files), and the
 * assets its data points at. Identity concepts have no theme default on
 * purpose: a build error beats a leaked placeholder.
 *
 * Markdown data: a `_data/<concept>/` folder of `.md` files loads as one
 * object keyed by file name, each file its front matter plus the body as
 * `content` (the terms, one file per language). A page renders an entry
 * with Lume's `md` filter inside a `markdown-body` container.
 */

import type { ZodType } from "npm:zod@4.6.7";
import textLoader from "lume/core/loaders/text.ts";
import createSlugifier from "lume/core/slugifier.ts";
import { fromFileUrl, posix } from "lume/deps/path.ts";
import dataSchema from "./schema/mod.ts";
import { buildSchedule, type Program, type ScheduleIO } from "./schedule.ts";
import { mapLinks } from "./venue.ts";

/** The theme version; bump it (and tag the repo) to release. */
export const version = "0.1.0";

export interface Options {
  /** Forwarded to `dataSchema()`: extra concept schemas, and the required list. */
  schema?: { required?: string[]; concepts?: Record<string, ZodType> };
}

/** The theme files, as a `file:` or https URL. No trailing slash: Lume's walk needs it that way. */
const themeSource = import.meta.resolve("./src");

export default function kcd(options: Options = {}): Lume.Plugin {
  return (site) => {
    // The theme's static files come through `assets/` (theme.js, the attending
    // badge's script and stylesheet), as do the site's; the site's Tailwind
    // entry is `style.css` at the root (layouts/base.vto links it), and
    // `_includes/theme.css` is imported from it through the remote fallback.
    site.add("assets");
    site.add("style.css");

    // Every theme file is a fallback for the same path in the site's src/.
    site.remote("/", themeSource, ["/**"]);

    // Without src/style.css the site would build unstyled; fail like a missing concept.
    site.addEventListener("afterLoad", () => {
      const entry = site.fs.entries.get("/style.css");
      if (entry?.type === "file") return;
      throw new Error(
        "src/style.css (missing): the build cannot complete without it. " +
          "It is the site's stylesheet, the Tailwind entry that defines the colour roles " +
          "the theme's components use, and the theme ships none; copy it from https://github.com/sagikazarmark/kcd-website-template/blob/main/src/style.css.",
      );
    });

    // Theme development: with a local theme, watch its folder too and map a
    // changed theme file back to the site path it is a fallback for, so
    // `serve` picks the edit up. The watcher reports paths relative to the
    // site's src/, normalised, which turns "../../../src/x" into "/src/x".
    if (themeSource.startsWith("file:")) {
      const themeDir = fromFileUrl(themeSource);
      site.options.watcher.include.push(themeDir);
      const reported = posix.join("/", posix.relative(site.src(), themeDir));
      site.addEventListener("beforeUpdate", ({ files }) => {
        for (const file of [...files]) {
          if (!file.startsWith(`${reported}/`)) continue;
          const sitePath = file.slice(reported.length);
          if (!site.fs.remoteFiles.has(sitePath)) continue;
          files.delete(file);
          files.add(sitePath);
        }
      });
    }

    // Markdown as data under `_data/` (see the header); `.md` elsewhere stays a page.
    site.loadData([".md"], textLoader);

    site.use(dataSchema(options.schema));

    // Vento callable: `mapLinks(venue)`; `newTab(href)` below.
    site.data("mapLinks", mapLinks);

    // `{{ iso |> formatDate }}` -> "18 September"; `formatDate("datetime")`
    // -> "18 September at 23:59 CEST". Rendered in `event.timezone` so the
    // output is the same wherever the site is built (CI runs in UTC). The
    // zone is read lazily from the merged root data, after the schema has
    // had its say on `event`; without one, "UTC".
    const dateFormatOptions = {
      date: {
        day: "numeric",
        month: "long",
      },
      datetime: {
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
        timeZoneName: "short",
      },
    } satisfies Record<string, Intl.DateTimeFormatOptions>;
    type DateStyle = keyof typeof dateFormatOptions;

    const eventTimeZone = (): string => {
      const root = site.source.data.get("/") as
        | { event?: { timezone?: unknown } }
        | undefined;
      const zone = root?.event?.timezone;
      return typeof zone === "string" ? zone : "UTC";
    };

    let dateFormats:
      | {
        zone: string;
        formats: Partial<Record<DateStyle, Intl.DateTimeFormat>>;
      }
      | undefined;
    const dateFormat = (style: DateStyle): Intl.DateTimeFormat => {
      const zone = eventTimeZone();
      if (dateFormats?.zone !== zone) dateFormats = { zone, formats: {} };
      return dateFormats.formats[style] ??= new Intl.DateTimeFormat("en-GB", {
        ...dateFormatOptions[style],
        timeZone: zone,
      });
    };

    site.filter(
      "formatDate",
      (iso: string, style: DateStyle = "date") =>
        dateFormat(style).format(new Date(iso)),
    );

    // "Márk Sági-Kazár" -> "mark-sagi-kazar"; the keynote and organizer dialog ids.
    site.filter("slug", createSlugifier());

    // `{{ href |> newTab }}` (or `${newTab(href)}` inside a template literal)
    // -> the attributes that open a link out in a new tab, or nothing for a
    // "#" placeholder (a fragment opening a new tab of the same page is never
    // right). Every data-driven link out uses it.
    const newTab = (href: unknown) =>
      typeof href === "string" && href.startsWith("#") ? "" : 'target="_blank" rel="noopener noreferrer"';
    site.filter("newTab", newTab);
    site.data("newTab", newTab);

    // The `schedule` global (./schedule.ts), built on `beforeRender` after the
    // schema's own listener has validated `agenda`, `speakers` and `patches`
    // (a throwing listener stops the build). Set on the root data, which
    // components read, and on each page, whose data was merged earlier.
    const io: ScheduleIO = {
      exists: (path) => site.fs.entries.get(path)?.type === "file",
    };

    site.addEventListener("beforeRender", ({ pages }) => {
      const root = site.source.data.get("/") as Record<string, unknown> | undefined;
      if (!root) return;
      const schedule = buildSchedule(
        {
          agenda: root.agenda as Program["agenda"],
          speakers: root.speakers as Program["speakers"],
          patches: root.patches as Program["patches"],
        },
        io,
      );
      root.schedule = schedule;
      for (const page of pages) page.data.schedule = schedule;
    });
  };
}
