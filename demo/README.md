# Live demo: a KCD website from announcement to recap

**[Visit the demo](https://kcd-website-demo.cloudnativehu.workers.dev/)** ·
[Feature showcase](https://kcd-website-showcase.cloudnativehu.workers.dev/) ·
[Create your website](https://github.com/sagikazarmark/kcd-website-template/generate) ·
[Organizer handbook](https://github.com/sagikazarmark/kcd-website-template)

The site of the fictional **KCD Your City 2099** at every stage of an
edition, one ordinary Lume site per stage, each a copy of the one before it
edited to that moment. The `announced/` example is the first stage, the
event announced; the other eleven folders show later milestones, through to the
post-conference recap. Built together they are a tour: every milestone under one host
at `/<slug>/`, a bar at the bottom of every page to move between them on the
same page, a landing page listing them. Served alone, each example is an ordinary
event website. For what to edit in your own site, follow the
[event update roadmap](https://github.com/sagikazarmark/kcd-website-template/blob/main/docs/event-updates.md).

This source lives at `demo/` in the theme repository. The
[website template](https://github.com/sagikazarmark/kcd-website-template) is
maintained separately; every demo example builds from local source.

```
phases.ts        the phases in order (slug, label, summary, folder), the showcase, and the host
build.ts         builds every phase and the showcase into _site/<slug>/, adds the bar, writes the landing page and the 404
deno.json        the `build` task and its permissions
wrangler.jsonc   Cloudflare Workers configuration for _site/
<name>/          one Lume site per phase: _config.ts, deno.json, src/
```

The showcase (`../showcase/`: every component over sample data, the
timetable, the three home page shapes) is built under `/showcase/` beside
the phases. It is not a stage, so the bar lists it after the phases and on
its own pages says "Showcase" with a way back to the tour.

| # | slug (folder) | the site at |
|---|---|---|
| 1 | `01-announced` (`announced/`) | the announcement: date, venue and team; everything else a draft |
| 2 | `02-cfp-open` (`cfp-open/`) | the call for papers open, with its FAQ page and countdown |
| 3 | `03-sponsorship` (`sponsorship/`) | the sponsorship packages published, the home page inviting partners |
| 4 | `04-sponsors` (`sponsors/`) | the first sponsor logos on the home page |
| 5 | `05-keynotes` (`keynotes/`) | the opening keynote announced, the second "to be announced" |
| 6 | `06-early-bird` (`early-bird/`) | tickets on sale at the early-bird price; the call for papers closed |
| 7 | `07-speakers` (`speakers/`) | the speakers announced (Sessionize's sample event, as `deno task sessionize` writes it before the timetable is out), the closing keynote with them |
| 8 | `08-tickets` (`tickets/`) | early-bird pricing over, regular tickets |
| 9 | `09-agenda` (`agenda/`) | the timetable out (the sample event's, moved onto the event day by `patches/agenda.yaml`), the agenda page and the home page's teaser live |
| 10 | `10-wrap` (`wrap/`) | thank-you homepage, disabled recap controls, resources pending, sales pages retired; agenda, speakers and venue retained |
| 11 | `11-photos` (`photos/`) | gallery previews and album published, recordings and slides still pending |
| 12 | `12-recap` (`recap/`) | recordings, slides, film and transparency report published too |

The post-conference pages compose the theme's `gallery` and `recap.resource`
modules. Their `recap.yaml` is instance-owned data, not a theme schema.
Gallery images are labelled sample SVG illustrations, including a portrait.
The complete recap uses labelled sample media and resource links;
the transparency report has fictional figures. Each phase can be built independently.

## Previewing a milestone

```sh
cd early-bird
deno task serve          # http://localhost:3000/, no bar: one site, at the root
```

A phase is a complete site: its `_config.ts` is the template's (the
`location` included, so it serves at the root locally), its `deno.json` the
template's with the same theme alias (`../../`). Every task
an instance has works in a phase folder. The folders carry the plain name;
the URL slugs are numbered (`/06-early-bird/`), which keeps them in order
and keeps any of them from being a page's path: Lume leaves a URL that
already starts with the base path alone, so a phase at `/agenda/` would
leave the agenda page's own links unprefixed.

What one phase changes over the one before it is the diff of the two
folders:

```sh
diff -r keynotes/src early-bird/src
```

That is the step an organiser takes to get from one stage to the next,
written out: which data file fills up, which page loses its `draft: true`,
what the hero and the tickets page say. The examples describe a fictional event;
their order is illustrative, not a required
organizing schedule.

## Building the tour

```sh
deno task build          # _site/: index.html, 404.html, <slug>/ per phase
```

`build.ts` runs, for each phase in `phases.ts`, that site's own
`deno task lume` with one override, `--location https://<host>/<slug>/`:
the template's `basePath()` turns it into the `/<slug>/` prefix on every
root-relative URL, and the canonical and preview URLs follow. The site's
`_site/` is moved here under its slug. Then the bar is inserted before
`</body>` in every built page (plain HTML with its own styles, no script:
previous and next, and the list of phases, each link to the same path in
that phase), and `_site/index.html` (the landing page) and `_site/404.html`
are written. The 404 is what Cloudflare serves for a path no phase has, the
agenda before it is out, say: it says so and links every phase's home.

Nothing of this is in a phase's source. The bar exists only in `_site/`, so
a phase served alone has none and a real site made from the template
cannot inherit it. The root `deno task build` builds the showcase on its own
first, then this tour, starting with `announced/`.

Deploy with Cloudflare Workers static assets over `_site/` (`wrangler.jsonc`).
Set the root directory to `demo`, the
build command to `npm run build` and the deploy command
to `npx wrangler deploy`. Before publishing, set `host` in `phases.ts` to
`kcd-website-demo.cloudnativehu.workers.dev`. See the
[deployment guide](https://github.com/sagikazarmark/kcd-website-template/blob/main/docs/deployment.md) for branch previews.

For a local deployment build, run `npm ci` first. The npm build script sets
`DENO_NO_PACKAGE_JSON=1` before starting Deno so its task runner does not
interpret the npm-installed Deno binary as JavaScript. The setting is inherited
by the phase and showcase builds; their dependencies come from `deno.json`.

## Adding a phase

Copy the phase before it (`rsync -a --exclude _site --exclude _cache
tickets/ afterparty/`), edit `src/` to the new stage, add an entry to
`phases.ts` in order, and add a row to `expected` in
`../tests/phases.test.ts`, which builds every phase and checks what each
shows (the pages in the build, the hero's badge, the menu). A change that
every phase should carry, a fix to a shared page, is applied to every folder;
update the external template separately when relevant. `diff -r` between neighbours shows whether it landed
everywhere.
