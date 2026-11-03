# Theme reference

[Home](../README.md) · [Organizer guides](https://github.com/sagikazarmark/kcd-website-template) · [Maintaining the repository](maintaining.md)

This reference covers the plugin, components and data contract. To launch an
event website, start with the [website setup guide](https://github.com/sagikazarmark/kcd-website-template/blob/main/docs/setup.md).

A [Lume](https://lume.land/) plugin with the layouts, components, styles,
data schema and Sessionize schedule of a Kubernetes Community Day website.
Version `0.1.0` (`version` in `mod.ts`).

An instance is a Lume site whose `_config.ts` reads:

```ts
import lume from "lume/mod.ts";
import tailwindcss from "lume/plugins/tailwindcss.ts";
import basePath from "lume/plugins/base_path.ts";
import favicon from "lume/plugins/favicon.ts";
import kcd from "kcd-theme/mod.ts"; // the alias in deno.json: a tagged URL, or ../../ in this repository
import { defaultRequired } from "kcd-theme/schema/mod.ts";

const site = lume({ src: "src", location: new URL("https://kcd-mycity.example") });
site.use(kcd({
  // What the theme's layouts, menu and footer read, plus what this site's pages read.
  schema: { required: [...defaultRequired, "venue", "tickets", "pretix", "terms"] },
}));
site.use(tailwindcss()); // required: the theme is written in Tailwind
site.use(basePath());    // deployment concerns; the site's call
site.use(favicon());
export default site;
```

and whose `src/` holds its pages (`*.vto`, each a layout tag and its
sections over the theme's components), its data (`_data/<concept>.yaml`), the assets that data
points at, `favicon.svg`, `style.css` (the Tailwind entry with the colour
roles, see "Colours"), and nothing else unless it wants to override
something. The build pipeline is the site's: the theme installs no Lume
plugins. Tailwind is the one it cannot do without (every component uses
its utilities; without the plugin the site builds unstyled); base path and
favicon are what the template ships with. The standalone
[website template](https://github.com/sagikazarmark/kcd-website-template)
documents the data side; the demo under `demo/`
shows it at every later stage of an edition and is the theme's integration
fixture ([its README](../demo/README.md)); the showcase under
`showcase/` renders every component and the home page shapes
over sample data ([its README](../showcase/README.md)); this file
documents the theme side.

## This repository

The theme is the repository root, so an instance imports `mod.ts` from here
(or from a tagged URL once it is published). Next to the theme live the
things that are not the theme but develop with it:

```
mod.ts                  the plugin: remote fallbacks, schema, schedule, filters, the theme watcher
schedule.ts             the agenda and speaker view model (the `schedule` global) from the programme concepts
program.ts              the programme as data: patch merging and the checks across records
sessionize.ts           Sessionize as a source: the two API views -> the `agenda` and `speakers` concepts
venue.ts                the venue's map links, derived from its coordinates and address (`mapLinks`)
schema/                 one Zod schema per concept, the theme/instance contract
scripts/                the CLIs an instance runs: sessionize.ts (converter), overrides.ts (forks)
src/                    everything registered as a remote fallback: layouts, components, CSS, script, default data
tests/                  the theme's tests, run from here (deno task test)
demo/                   the demo: a fictional event from announcement to recap, built as a tour under one host (the showcase too)
showcase/               the showcase: every component over sample data, the timetable, the three home page shapes
docs/                   theme reference and maintainer guides
```

Each instance is a complete Lume site with its own `deno.json` and
`_config.ts`. The theme's location is written once, as the `kcd-theme/`
import-map alias in `deno.json` (a relative path to the root for local sites; a
tagged jsDelivr URL once published): `_config.ts` imports
`kcd-theme/mod.ts`, and the `sessionize` and `overrides` tasks run
`kcd-theme/scripts/...`, which Deno resolves through the same alias and
runs from the URL, the scripts' own imports resolving against it.
`deno task build` at the root builds the showcase on its own and then the
demo (which builds its announcement example first and the showcase again
under its host), and `deno task serve` serves `demo/announced/`, for
convenience; `deno task test`, `check` and `lint` are the theme's own.

## What it ships

Everything under `src/` is registered as a remote fallback for the same path
in the instance (`site.remote("/", <this folder>/src, ["/**"])`):

- **Layouts** (`_includes/layouts/`), a chain of three: `base.vto`, the
  `<html>` shell with the page meta and link preview from the page's front
  matter (`title`, `description`, `shareImage`) and a `head` slot;
  `site.vto`, the page shell on top of it (a `header` slot, `<main>` with
  the content, the footer); and on top of that the two a page normally
  picks: `page.vto`, which fills the header with the menu bar, and
  `home.vto`, which fills it with a full-screen `hero.frame` around the
  page's `hero` slot. A page that wants another header (the bar and then a
  smaller hero, say) uses `site.vto` and writes `{{ slot header }}` itself.
  A page picks its layout with Vento's layout tag,
  `{{ layout "layouts/page.vto" }}`, right after its front matter; see the
   [customization guide](https://github.com/sagikazarmark/kcd-website-template/blob/main/docs/customization.md#pages-and-navigation).
- **Footer** (`_includes/partials/footer.vto`): a partial, not a component. One
  footer, no props, included once by `site.vto`; it reads `footer`, `logo`
  (`footer.logo`, or `logo.vertical.white` without it), `social`,
  `nav.secondary` (through `ui.navLinks`) and `event`.
- **Hero** (`_components/hero/`): `frame`, the band over the picture (size
  `screen`, `lg` or `md`; the transparent menu when `menu: true`; the
  caller's content centred on it; the picture from `hero.image` unless an
  `image` is passed) and `intro` (badge, heading, date and venue lines,
  tagline and lede, all props); the button row under it is `ui.actions`.
  What the hero says is written in the page, not in data.
- **UI primitives** (`_components/ui/`): `band` (the toned, full-width
  shell of a home-page section), `section` (the untoned, narrow shell an
  inner page opens with), `heading` (pill, title, lede; what goes under them
  is its content; `inverse` for the dark band; every section a page writes
  opens with it, the venue section's left-aligned intro excepted), `actions` (the button row), `button`, `icon` (one Font
  Awesome glyph, `aria-hidden`; the only place that knows the style
  prefix), `logo`, `socialLinks` (a render function called once
  per network in a link map, `social` or a person's `links`, canonical
  order; the one place the network -> icon/label mapping lives), `navLinks`
  (a render function called once per link in `nav.main`, `nav.secondary` or
  `[nav.cta]`; the one place a `page` link is resolved, a draft or disabled
  link is left out and the current page is marked, see "Pages by id"),
  `draftMark` (the "Draft" pill a menu link to a draft page carries under
  `serve`), `card`, `cta`, `note`, `countdown` (the hero's deadline card; reads no global, the page passes
  the deadline and the words), `text`,
  `until`/`after` (timed content).
- **No blocks.** Every section of a page is the page's, written as a
  `ui.band` or `ui.section` over the primitives and the card components
  (`keynote`, `organizer`, `ui.card`, `ui.logo`, `pretix.widget`), reading
  its concept from the global of the same name (`sponsors.tiers`,
  `keynotes.speakers`, `venue`) and checking collection lengths where the
  section may be empty. Required content such as the venue and footer renders
  directly. The call for papers, the "What is KCD <City>?"
  section, the sponsors, the keynote speakers, the agenda teaser, the venue,
  "What to expect", the video, the media partners, the "catch up" cards,
  the organizers, the "Stay tuned" band, the ticket shop, the venue page's
  map: all of them. (The theme shipped a `_components/blocks/` folder at
  first, one component per concept-driven section, each a band, a heading
  whose lede was the concept's `intro` or built from `event.name`, and a
  loop over the items. They were dissolved one by one, `about` and `cfp`
  first, then keynotes, organizers, sponsors, the ticket shop, and last the
  two venue ones: a section the page cannot read without opening a second
  file bought little over the loop itself, and the copy around it is the
  edition's. A section that turns out to be identical across sites can
  become a component again.)
- **FAQ** (`_components/faq/`): `list` (a card of questions, one native
  `<details>` per item, from an `items` prop: `[{ question, answer }]`) and
  `item` (one question; the answer is Markdown, rendered through the `md`
  filter inside a `markdown-body`). Neither reads a global, so one list
  serves any FAQ a site has (`cfp.faq` on the template's `/cfp-faq/`; a tickets
  or venue FAQ would pass its own list). The shape is `faqList` in
  `schema/concepts.ts`.
- **Gallery** (`_components/gallery.vto`): `comp.gallery({ id, images })`
  renders a preview grid and larger-image dialogs, reusing `dialog.frame`
  and the theme's dialog script. `id` must be unique on the page; each image
  supplies `src`, descriptive `alt`, `width`, `height`, and optional `full`
  (the larger image, defaulting to `src`). Empty images render nothing.
  The caller chooses its preview count, heading, credit and album link.
  The CSS is in `theme.css`; no-JavaScript full-size links are included.
- **Recap resource** (`_components/recap/resource.vto`): `comp.recap.resource`
  takes `id` (optional), `title`, `label` (eyebrow), `icon`, `text`, `action`
  (link text), and `resource: { url?, note?, enabled? }`. No URL gives a
  non-clickable “Coming soon” state; a URL publishes the link; a note can
  explain partial availability; `enabled: false` hides the card. It reads no
  global recap data. There is no theme recap schema: the instance owns its
  content, publication decisions and page composition.
- **Disabled menu CTA**: `nav.cta.disabled: true` keeps the label visible
  but removes the link and adds `aria-disabled`. `menu` also accepts a `cta`
  override for an individual rendering. Ordinary buttons use
  `comp.ui.button({ ..., disabled: true })`.
- **Cards and dialogs**: `ui.card` (icon, title, a fact list or a blurb, a
  footnote; a link when given `href`), `sponsorship.package` (one
  sponsorship tier with its accent, price, includes and enquiry button),
  `keynote`, `organizer`, `avatar`, `session/card`, `session/break`,
  `session/dialog`, `speaker/card`, `speaker/dialog`, `dialog/frame`,
  `pretix/*`, `venue/photos`, `venue/routes`. A person's profile links (`keynote`, `organizer`, the
  speaker card and dialogs, the session dialog) all go through
  `ui.socialLinks` over the person's `links` map.
- **Tools over the view model and the theme's scripts**: components a page
  cannot write itself without copying logic or a contract with theme code,
  so a theme change reaches every site. `schedule.timetable` (the agenda's
  CSS grid over `schedule.days`: one row per start time, one column per
  track, plenary items spanning), `session.teaser` (the home page's one
  random talk out of many, with the inline script that picks it) and
  `attending.tool` (the "I'm attending" image generator, whose ids and data
  attributes are what `assets/attending-badge.js` drives). A page renders
  each with one call and writes the heading, the words and the buttons
  around it.
- **`_includes/theme.css`** (the CSS the components need beyond utilities:
  preflight fixes, rich-text links, the `markdown-body` look for rendered
  Markdown, the pretix widget; the site's
  `style.css` imports it) and **`assets/theme.js`** (menu, dialogs,
  countdown, timed content, smooth scrolling, terms tabs), plus
  `assets/attending-badge.{js,css}` behind `attending.tool`. Not
  `style.css`: the Tailwind entry is the site's, see "Colours".
- **Markdown data** (`mod.ts`): a `_data/<concept>/` folder of `.md` files
  loads as one object keyed by file name, each file its front matter plus
  the body as `content`; a page renders an entry with Lume's `md` filter
  inside a `markdown-body` container. The file's headings continue the
  page's outline (`###` for sections under the page's h1 and the entry's
  h2). The terms are the one such concept (`_data/terms/<lang>.md`, one
  file per language); a privacy policy would be the next. Shorter prose
  stays in YAML as a Markdown string (`markdownString` in
  `schema/shared.ts`): a FAQ answer of a few paragraphs, a list and a link,
  written as a `>-` or `|` block and rendered the same way by `faq.item`.
- **Default data** (`_data/`): `logo` and `footer`. `logo` is a convention
  rather than files: `horizontal.color` and `horizontal.white` (the menu,
  the attending badge) at `/assets/logo-horizontal-{color,white}.svg`,
  `vertical.white` (the footer) and `vertical.color` at
  `/assets/logo-vertical-{color,white}.svg`; a site that puts its lockups
  there needs no `logo.yaml`, one with files elsewhere writes it. `footer`
  is the line under the copyright, "Part of the global Kubernetes Community
  Days program." Only concepts whose defaults are safe on any KCD site; each
  file starts with "Theme default. Copy to src/_data/<name>.yaml to change
  it." There is deliberately no default for the identity concepts (`event`,
  `share`, `social`, `nav`, `hero`, `venue`, `tickets`, `pretix`, `terms`,
  `sessionize`, `cfp`, `keynotes`, `organizers`, `sponsors`): the schema's
  "missing" message is the onboarding, and a leaked placeholder on a live
  site (a menu linking to pages the site does not have) would be worse than
  a build error.
- **Default assets**: `favicon.svg` alone, the KCD wheel, the fallback Lume's
  favicon plugin reads when the instance has none. The placeholder lockups
  and the gradient hero picture live in the [template's assets](https://github.com/sagikazarmark/kcd-website-template/tree/main/src/assets),
  not the theme's.

Not pages. The theme has no page templates: a site writes its own under
`src/`, each a layout tag and its sections over the components, and owns
them. The [website template](https://github.com/sagikazarmark/kcd-website-template)
ships a complete set to start from (home, tickets,
agenda, speakers, venue, sponsors, CFP FAQ, terms, imprint, attending, 404).

Outside `src/`: the plugin (`mod.ts`), the data schema (`schema/`), the Sessionize schedule
builder (`schedule.ts`, with `sessionize.ts` for the constants it shares
with the downloader) and two CLIs (`scripts/`).

## The data contract

`schema/concepts.ts` has one Zod schema per concept; `schema/mod.ts` runs
them on every build against the merged root data and fails with the file and
key of each problem. Unknown top-level keys are allowed (an instance can add
data for a block of its own); unknown keys inside a known concept are not.
`defaultRequired` in `schema/mod.ts` lists the concepts the theme's own
templates (layouts, menu, footer) read unconditionally; what a site's pages
read, the site adds through the `required` plugin option, since the pages
are its own. The schema is the contract between theme and instance: a
change to it is a theme API change and belongs in the release notes.

## Overrides

A local file at a theme path replaces the theme file; that is the whole
customisation story, and its cost is that the local file is a fork which no
longer receives theme updates. `scripts/overrides.ts` lists an instance's
overrides, grouped by kind (data, components/layouts, assets, other), so an
upgrade knows what to re-check and a maintainer can see how much of the
theme an instance still uses:

```sh
deno run --allow-read <theme>/scripts/overrides.ts [--src src]
```

Instances have it as `deno task overrides`, with read permission on their
own `src/` and on the theme's `src/` (via a relative path for local sites).
Data overrides are expected (they are how an instance replaces
a default); anything else is worth a second look before upgrading.

## Colours

The components are written in colour roles, never colours: `bg-primary`,
`text-accent`, `decoration-secondary/30`, `hover:bg-accent-strong`, and
Tailwind's `gray-*` for neutrals. The roles are `primary` (headings, links,
outline buttons, the hero band), `secondary` (tints, underline decoration),
`accent` (calls to action, pills, link hover) and a `-strong` hover step for
`primary` and `accent`.

Their values live in the site's `src/style.css`, the Tailwind v4 entry,
which the template ships with the CNCF palette and a site edits freely. In
Tailwind v4 the CSS entry is the configuration, and the pipeline is the
site's, so the entry is too; the theme ships none, and a site without one
fails the build naming the file. What the theme does ship is
`_includes/theme.css`, the CSS its components need beyond utilities, which
`style.css` imports as `@import "theme.css"`: Lume's Tailwind plugin
resolves a bare import from `_includes/`, through the remote fallback, so a
theme release can change it without the site touching anything.

A component that needs a new shade adds a role (in the template's
`src/style.css`, a theme API change for the release notes) rather than
reaching for a Tailwind palette colour or a hex value, so that a site's
`style.css` keeps covering the whole theme. `assets/attending-badge.js`
reads the roles from `:root` to paint the badge, which is why the template
declares them `@theme static`.

## Plugin options

```ts
site.use(kcd({
  schema: {
    // Added to the built-in concepts; a key already there is overridden.
    concepts: { myBlock: z.strictObject({ title: z.string() }) },
    // Replaces defaultRequired when given: the theme's list plus what this
    // site's pages read. A missing one fails the build naming the file.
    required: [...defaultRequired, "venue", "tickets", "myBlock"],
  },
}));
```

`concepts` and `defaultRequired` are exported from `schema/mod.ts`, Zod is
imported by the theme directly (`npm:zod@4.6.7`), so an instance needs no
import-map entry for it.

## Responsive images

The portraits (`organizer`, `keynote`, `avatar`) and, under a condition, the
hero (`hero.frame`) carry a `transform-images` attribute for Lume's
[picture plugin](https://lume.land/plugins/picture/). Without the plugin
the attribute is inert: browsers ignore it and the file is served as given.
A site opts in by adding two plugins to its `_config.ts`, `picture` directly
above `transform_images` and both **before `basePath`** (both rewrite the
HTML; `picture` has to see the un-prefixed `src` to find the file):

```ts
import picture from "lume/plugins/picture.ts";
import transformImages from "lume/plugins/transform_images.ts";

site.use(tailwindcss());
site.use(picture());
site.use(transformImages());
site.use(basePath());
```

`transform_images` runs Sharp and caches its output in `_cache/`
(gitignored), so it costs a native dependency in CI and a slower first
build (a few seconds for the hero, well under that for the portraits).

**Portraits.** Each becomes a `<picture>` with an AVIF source and a WebP
`<img>`, at the CSS size it is shown and a 2x candidate (a 64px organizer
portrait is 64 and 128px files), 5 to 7 times smaller than the 400px
original. The output keeps every other attribute (`alt`, `width`, `height`,
`loading`, `class`).

**Hero.** The plugin works from one file per crop, so it and the hand-made
retina file are alternatives, and `src2x` (optional in the schema) is the
switch. A crop with a `src2x` is served as given, two candidates, plugin
not involved. A crop without one, if it is a raster file, gets a bare
`srcset` and `transform-images="avif webp <width/2> <width>"`: point `src`
at the largest file you have (the 2x export) and set `width` to its real
width, and the plugin derives the 1x. Without the plugin that one file
serves every density, which is what a crop without `src2x` did before. An
SVG crop (the theme's default gradient) is never marked: the plugin cannot
process SVG and would rewrite the `srcset` to a file that never gets made.
Measured on a 3840x2160 hero, AVIF at Sharp's defaults is 256 KB against
591 KB for the hand-exported WebP, and it is the LCP resource.

Only `avif webp` are requested, not the source format: the originals are a
mix of JPEG, PNG and WebP (Sessionize serves either), and naming one output
format works for all of them, where asking for `jpg` would flatten a PNG's
transparency. WebP is supported by every current browser, so there is no
third fallback.

Not covered, on purpose:

- The sponsor and media logos (`ui.logo`): SVG, which `transform_images`
  does not handle, and which needs no help, a vector is resolution-independent
  and a few KB.
- The venue photos (the home page's venue section, `venue.photos`): responsive by hand
  through `src2x`, always present in practice. The hero's `src2x` switch
  would fit them too if the need comes up.

Rules for a new component: put `transform-images` on an `<img>` or
`<source>` whose file is always local and raster; never on a wrapper (the
plugin applies to every image inside, SVGs included); never on an image that
can be a remote URL (the plugin rewrites `src` before it checks that the
file exists, so a remote image would become a broken link); and with a bare
URL in `srcset`, since the plugin reads it as a path.

## The programme: agenda, speakers, patches

The agenda and speaker pages are built from three concepts in the
instance's data (see the [Sessionize guide](https://github.com/sagikazarmark/kcd-website-template/blob/main/docs/sessionize.md)):

- `agenda` (`src/_data/agenda.yaml`): `rooms`, `sessions` (talks, with
  `speakers` ids, `room`, `start`/`end`, and the `keynote`, `plenary` and
  `cancelled` flags) and `breaks` (registration, coffee, lunch, closing).
- `speakers` (`src/_data/speakers.yaml`): a list of people, each with `id`,
  `name`, `title`, `company`, `tagline`, `photo`, `links` and `bio`.
- `patches` (`src/_data/patches/agenda.yaml`, `patches/speakers.yaml`):
  hand corrections, the same shape as the two above, partial records
  matched on `id` and merged over them at build time. How a talk is
  cancelled on the day, a portrait swapped or a title fixed without waiting
  for the platform; an unknown id or a misspelt key fails the build.

The shapes are in `schema/concepts.ts`; the checks that span records
(speakers and rooms that exist, unique ids, `start` before `end`) are in
`program.ts`, run by the schema on the patched data so an issue is reported
in the file it should be fixed in. The two files can be written by hand (the
demo does) or by a converter from a platform.

`schedule.ts` exports `buildSchedule(program, io)`: the view model
(`rooms`, `days`, `sessions`, `speakers`) from the concepts, pure except for
asking `io` whether a photo exists. The plugin calls it on Lume's
`beforeRender`, after the schema has validated the data, and attaches the
result to the root data and every page as the `schedule` global.

`scripts/sessionize.ts` is the Sessionize converter an instance runs as
`deno task sessionize`: it fetches the event named by `endpoint` in
`src/_data/sessionize.yaml`, turns the two API views into the two concepts
(`fromSessionize()` in the theme's `sessionize.ts`; the "Keynote" and
"Cancelled" checkbox questions become the flags), writes them with a
deterministic order so a re-sync diffs as the change, and mirrors the
speakers' photos into `src/assets/speakers/`. It works relative to
the working directory (`--src <dir>`, default `src`), so the same script
serves a local and a published theme. Its permission set must allow reading
`./src` and writing `./src/_data/agenda.yaml`, `./src/_data/speakers.yaml`
and `./src/assets/speakers`; the theme itself is only imported, which
needs no read permission. A second platform is a second converter producing
the same two files.

Whether the agenda and speakers pages exist is the site's: `draft: true`
in a page's front matter keeps it out of `build` (not out of `serve`) until
its data is ready, and every link to it waits with it, see "Pages by id".

## Pages by id

A page the data or another page links to declares an `id` in its front
matter (Lume's own `id` data key: `id: agenda`), and the link names the
page, not its URL. In `nav`, an entry is `page: agenda` (plus its icon;
the label defaults to the page's `title`) or, for a link out, `url` and
`label`; `ui.button` and `ui.cta` take `page` as an alternative to
`href` (which stays for links out, mailto: and hashes, with `external`
for a new tab); a template reads `search.page("id=agenda")` for the
page's `url` or `title`. The theme's own components resolve the agenda page the same way
(`speaker.dialog`, `session.teaser`), so no URL of the site is written
anywhere in the theme.

A page that is a draft is not in the build, so `search` does not find it
and every link to it is left out: the menu entry, the CTA, the cross-link
panel, the button. Under `deno task serve`, where drafts are built, the
page is found with `draft: true`, the links work (the page is there to be
worked on) and the menu and footer mark theirs with a "Draft" pill
(`ui.draftMark`). An id no page declares is a build error naming the nav
key (the schema reads the ids from every page source, drafts included),
and so is an id two pages share; a typo cannot hide a link quietly.

## Developing the theme

The demo's agenda example (`demo/agenda/`, the full site) is the
integration fixture, and the announcement demo (`demo/announced/`, the sparse
one) is built alongside it; `tests/phases.test.ts` builds every phase in
between. From the repository root:

```sh
deno task serve            # the announcement demo; theme files are watched too
deno task test             # schema, components, layouts, every phase of the demo
deno task check && deno task lint
```

The tests (`tests/`) render components and layouts in-process with a tiny
fixture site, so a component's contract (an attribute, an initial state,
what disappears when) is stated next to the component rather than inferred
from a page. The harness fails a build on any error Lume logs, which Lume
alone does not: a Vento error inside a component renders as the string
`undefined` and the build goes on. Run `deno task build` (the showcase
through its own `deno.json`, then the demo: every phase and the showcase
under one `_site/`) to see the real pipeline.

With the theme imported as a local folder, Lume reads its files directly
(no cache), so a rebuild always reflects an edit; in serve mode the plugin
adds the theme folder to Lume's watcher, so an edit to a page, component,
layout or `theme.js` reloads like an instance edit (a *new* theme file needs
a restart: the fallback list is built once per start). `LUME_NOCACHE=true`
only matters for a theme imported from a URL, whose files Lume caches after
the first fetch.

Conventions: every file starts with a comment saying what it is and why;
a component rendering a concept takes one object prop rather than spreading
its keys (`shop` for `pretix.widget`,
since a bare `event` prop would be shadowed by the `event` concept); no city, date or URL anywhere in `src/`,
copy that names the event is built from `event` or lives in the instance's
data.

## Releasing

1. Make sure `deno task test`, `deno task check`, `deno task lint` and
   `deno task build` pass at the repository root.
2. Bump `version` in `mod.ts`; note schema changes (new keys, renamed keys,
   new required concepts) in the release notes, since instances will hit
   them as build errors.
3. Tag the repository (`v0.2.0`). Instances upgrade by changing the tag
   in the `kcd-theme/` alias in `deno.json`, then running `deno task overrides` and
   `deno task build`.
