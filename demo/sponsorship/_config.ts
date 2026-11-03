// The site configuration: the canonical URL, the theme, which concepts the
// pages read, and the build pipeline. The theme comes through the
// `kcd-theme/` alias in deno.json, the one place its location and version
// are written (https://github.com/sagikazarmark/kcd-website-template); a file at the same path
// under src/ overrides a theme file. The pipeline is this file's: Tailwind
// is required (the components are written in it), base_path and favicon are
// conveniences; `picture` + `transformImages` above `basePath()` would
// serve the portraits resized (the theme's docs/theme-reference.md, "Responsive images").
import lume from "lume/mod.ts";
import basePath from "lume/plugins/base_path.ts";
import favicon from "lume/plugins/favicon.ts";
import tailwindcss from "lume/plugins/tailwindcss.ts";
import kcd from "kcd-theme/mod.ts";
import { defaultRequired } from "kcd-theme/schema/mod.ts";

const site = lume({
  src: "src",
  location: new URL("https://kcd-demo.example"),
});

site.use(kcd({
  schema: {
    // The theme requires what its layouts, menu and footer read
    // (`defaultRequired`); these are the concepts the pages in src/ read.
    // A missing one fails the build naming the file to create. Drop a
    // concept here when you drop the page that reads it.
    required: [
      ...defaultRequired,
      "hero", // index.vto
      "cfp", // index.vto, cfp-faq.vto
      "tickets", // tickets.vto
      "pretix", // tickets.vto
      "venue", // venue.vto, attending.vto
      "terms", // terms.vto, imprint.vto
    ],
  },
}));

site.use(tailwindcss());
site.use(basePath());
site.use(favicon());

export default site;
