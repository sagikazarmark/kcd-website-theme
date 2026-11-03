# KCD website theme

A website that grows with your **Kubernetes Community Day**, from the first
announcement to the final recap. Built with [Lume](https://lume.land/) and
[Deno](https://deno.com/), with your content and pages in your own repository.

## Take a look or get started

| Explore | What you'll find |
| --- | --- |
| **[🌍 Visit the live demo](https://kcd-website-demo.mark-sagikazar.workers.dev/)** | A working website for the fictional **KCD Your City 2099**. Follow it from announcement through tickets, the agenda and the post-event recap. |
| **[🎨 Browse the feature showcase](https://kcd-website-showcase.mark-sagikazar.workers.dev/)** | Home page layouts, components, timetable, galleries and more, side by side. |
| **[🚀 Create your website](https://github.com/sagikazarmark/kcd-website-template/generate)** | Create a repository from the [template](https://github.com/sagikazarmark/kcd-website-template), personalize it and deploy. |

Want to see exactly what you start with? [Preview the starter website](https://kcd-website-template.mark-sagikazar.workers.dev/).

## Highlights

- 🗓️ **Templates for every event milestone**: announcement, call for papers,
  sponsorship, ticket sales, speaker reveals, the full agenda and a lasting recap.
- 🎟️ **Pretix integration**: embed your ticket shop with a direct-shop fallback.
- 🎤 **Sessionize integration**: import speakers, talks, photos and the timetable;
  keep local corrections between imports.
- 🎨 **Tailwind CSS v4**: make the theme yours with a shared color palette and
  flexible page layouts.
- 🤖 **Easy to edit with coding agents**: readable YAML content, commented page
  templates and build-time validation help keep changes focused.
- ☁️ **Static hosting on Cloudflare**: deploy from your repository, review branch
  previews and publish updates by merging.

## Your first website

1. **[Use the template](https://github.com/sagikazarmark/kcd-website-template/generate)**
   and clone your new repository.
2. Install [Deno 2.8](https://docs.deno.com/runtime/getting_started/installation/)
   and run `deno task serve` in it. Open <http://localhost:3000/>.
3. Follow [Setting up a website](https://github.com/sagikazarmark/kcd-website-template/blob/main/docs/setup.md) to add your
   event details, branding and homepage copy.
4. [Deploy your repository to Cloudflare](https://github.com/sagikazarmark/kcd-website-template/blob/main/docs/deployment.md).

## Keep your site current

- **[Setting up a website](https://github.com/sagikazarmark/kcd-website-template/blob/main/docs/setup.md)**: first preview,
  content, branding and publishing checks.
- **[Deploying to Cloudflare](https://github.com/sagikazarmark/kcd-website-template/blob/main/docs/deployment.md)**: connect
  your repository, previews, custom domains and deploy buttons.
- **[Updating your event website](https://github.com/sagikazarmark/kcd-website-template/blob/main/docs/event-updates.md)**:
  what to change as plans become announcements.
  - [Call for papers](https://github.com/sagikazarmark/kcd-website-template/blob/main/docs/cfp.md)
  - [Ticket sales with Pretix](https://github.com/sagikazarmark/kcd-website-template/blob/main/docs/pretix.md)
  - [Speakers and agenda with Sessionize](https://github.com/sagikazarmark/kcd-website-template/blob/main/docs/sessionize.md)
- **[After the event and next year's archive](https://github.com/sagikazarmark/kcd-website-template/blob/main/docs/after-the-event.md)**:
  publish resources and preserve the finished edition at `/year/`.
- **[Customization and file reference](https://github.com/sagikazarmark/kcd-website-template/blob/main/docs/customization.md)**:
  pages, navigation, colors, theme updates and content locations.

## Working on the theme

This repository contains the shared theme. Organizers start from the separate
[website template](https://github.com/sagikazarmark/kcd-website-template).

[Theme reference](docs/theme-reference.md) ·
[Development and repository layout](docs/maintaining.md) ·
[Demo source](demo/README.md) ·
[Showcase source](showcase/README.md)
