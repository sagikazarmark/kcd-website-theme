# Developing and publishing the theme

[Home](../README.md) · [Theme reference](theme-reference.md) · [Organizer handbook](https://github.com/sagikazarmark/kcd-website-template)

## Repository layout

| Path | Purpose |
| --- | --- |
| Repository root | Theme plugin, schemas, components and tests |
| `demo/` | Fictional event at each milestone, from `announced/` to `recap/` |
| `showcase/` | Components and layout gallery |

The starter website and organizer handbook live in the separate
[template repository](https://github.com/sagikazarmark/kcd-website-template).
The demo owns its announcement example so theme development and tests do not
depend on checking out or downloading that repository.

Public endpoints:

- [Demo](https://kcd-website-demo.cloudnativehu.workers.dev/)
- [Showcase](https://kcd-website-showcase.cloudnativehu.workers.dev/)
- [Starter preview](https://kcd-website-template.cloudnativehu.workers.dev/)

## Local development

From the theme repository root:

```sh
deno task serve   # Announcement demo with live reload
deno task build   # Standalone showcase, then the demo tour
deno task test    # Theme contracts and the demo milestone builds
deno task check   # Type-check theme, tests and site configs
deno task lint
```

Each demo site also has its own tasks. Run `deno task serve` in `showcase/`
to explore components or in `demo/agenda/` to preview a full event website.
See the [demo README](../demo/README.md) and [showcase README](../showcase/README.md).

## Publishing

1. **Publish the theme and a release tag.** Run the checks above, record
   schema/component changes and publish a tag before using it in a standalone site.
2. **Update the external template.** Follow its
   [theme pinning guide](https://github.com/sagikazarmark/kcd-website-template/blob/main/docs/customization.md#pinning-and-upgrading-the-theme).
   Verify its build and tooling from an independent clone. All template commands
   run from that repository's root.
3. **Configure separate Cloudflare Workers.** Use the
   [deployment guide](https://github.com/sagikazarmark/kcd-website-template/blob/main/docs/deployment.md)
   with the roots below. Set the demo host in `demo/phases.ts` to
   `kcd-website-demo.cloudnativehu.workers.dev`, and the showcase `location`
   to `https://kcd-website-showcase.cloudnativehu.workers.dev/`.
   The showcase still needs a `wrangler.jsonc` serving `./_site` with the
   same HTML/404 handling as the demo. Give each Worker its own name.
4. **Check the first-run journey.** Visit the public sites, create a repo from
   the external template, run its local preview and connect it to Cloudflare.
   Verify production and branch previews. Test the deploy button separately:
   it clones a new repo and needs the Deno build command entered.

| Deployment | Root | Build output |
| --- | --- | --- |
| Demo tour | `demo` | `_site/` |
| Feature showcase | `showcase` | `_site/` |
| Starter preview | External template repository root | `_site/` |

Build with `npx -y -p deno@2.8.3 -c 'deno task build'`; deploy with
`npx wrangler deploy`. The npm command places Deno on the child-process PATH
as well, which the demo's build subprocesses need.

## Releasing updates

Run `deno task test`, `deno task check`, `deno task lint` and `deno task build`.
Bump `version` in `mod.ts` and document data/schema changes, component changes
and required organizer edits in release notes. Tag the release.

Update the external template's theme pin and examples when needed. Existing
sites upgrade deliberately by changing the `kcd-theme/` alias, reviewing their
overrides and building on a branch. Keep the organizer handbook in the
[template repository](https://github.com/sagikazarmark/kcd-website-template);
keep plugin internals in the [theme reference](theme-reference.md).
