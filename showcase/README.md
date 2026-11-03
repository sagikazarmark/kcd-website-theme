# The showcase: the theme's components and shapes

**[Browse the showcase](https://kcd-website-showcase.cloudnativehu.workers.dev/)** ·
[Live event demo](https://kcd-website-demo.cloudnativehu.workers.dev/) ·
[Create your website](https://github.com/sagikazarmark/kcd-website-template/generate) ·
[Customization guide](https://github.com/sagikazarmark/kcd-website-template/blob/main/docs/customization.md)

Every component the KCD theme ships, rendered once over sample data, and the
three shapes a home page can take, each on a page. An ordinary Lume site:
serve it while working on a component, and the demo (`../demo/`) builds it
under its host at `/showcase/`, next to the phases, with the bar at the
bottom that leads back to the tour.

Use the showcase to choose a homepage layout or inspect a component before
adapting it. Use the demo for complete event websites. This source currently
lives at `showcase/`; it will also be
deployed as its own Cloudflare Worker. See the
[publishing checklist](../docs/maintaining.md#publishing)
for the standalone Worker config and URL changes still needed.

```
_config.ts        the template's pipeline; `required` is what these pages read
deno.json         the template's tasks (build, serve, ...)
src/
  index.vto       what is here and where
  components.vto  every component, one band each, an anchor list at the top
  agenda.vto      the timetable (schedule.timetable) over the sample programme; its id is
                  `agenda` so the components that link to the agenda page find it
  terms.vto       the terms page over two versions, _data/terms/en.md and la.md (lorem ipsum,
                  which is nearly Latin, so the tag is honest), for the language switch
  home/           the three home page shapes: big-hero (the template's index.vto shape),
                   banner, plain; a populated recap and disabled-control example too
  _data/          the sample data: the demo's last phase's, plus the showcase's own nav.yaml
  _includes/home/ body.vto, the home page's every section (the demo's last phase's), which the three shapes share
  assets/, style.css, 404.vto
```

```sh
deno task serve          # http://localhost:3000/
```

The sample data is a copy, not a link: it is what the components need to
have something to show (sponsors, keynotes, a programme, an offer), and it
drifts from the demo's phases without harm. A component added to the theme
gets a band on `components.vto`; a change to a component's props is checked
here by eye before the tests say what it promises.

Links on the home shapes are `href: "#"` placeholders where a site's would
name pages (`page: tickets`): the showcase has no tickets page, and a button
to a page that is not in the build renders nothing, which would defeat a
gallery.

## Post-conference examples

- `/components/#gallery-demo`: the shared gallery with landscape and portrait
  sample illustrations, larger-image dialogs, and an album link supplied by
  the page.
- `/components/#resources`: `recap.resource` pending, published and partially
  published, with each state independent of its neighbours.
- `/home/recap/`: the full composition, including the sample album, film,
  recordings, slides and transparency report.
- `/home/pending/`: a disabled menu CTA beside a disabled ordinary button.
  The menu takes a `cta` override here so the other showcase pages keep their
  normal navigation; a real site sets `nav.cta.disabled` in its data.

The illustrated gallery assets and resource links are examples, not material
from a real event. The film is labelled sample media. No recap data schema is
installed by the theme.
