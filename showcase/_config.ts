// The showcase: the theme's components and the shapes a home page can take,
// each on a page, over the sample data in src/_data/ (the demo's last
// phase's). An ordinary Lume site, served alone for theme work (`deno task
// serve`) and built under the demo's host by demo/build.ts. The
// pipeline matches https://github.com/sagikazarmark/kcd-website-template; `required`
// lists what these pages read.
import lume from "lume/mod.ts";
import basePath from "lume/plugins/base_path.ts";
import favicon from "lume/plugins/favicon.ts";
import tailwindcss from "lume/plugins/tailwindcss.ts";
import kcd from "kcd-theme/mod.ts";
import { defaultRequired } from "kcd-theme/schema/mod.ts";

const site = lume({
  src: "src",
  location: new URL("https://kcd-website-showcase.mark-sagikazar.workers.dev/"),
});

site.use(kcd({
  schema: {
    required: [
      ...defaultRequired,
      "hero", // home/*.vto, components.vto
      "venue", // components.vto (hero.intro, venue.photos)
      "cfp", // components.vto (faq.list)
      "pretix", // components.vto (pretix.widget)
      "keynotes", // components.vto
      "organizers", // components.vto
      "sponsors", // components.vto
      "terms", // terms.vto
    ],
  },
}));

site.use(tailwindcss());
site.use(basePath());
site.use(favicon());

export default site;
