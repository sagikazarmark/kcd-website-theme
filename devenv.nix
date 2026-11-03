{ ... }:

{
  # package.json installs Cloudflare tooling; site dependencies belong to Deno.
  env.DENO_NO_PACKAGE_JSON = "1";

  languages = {
    deno = {
      enable = true;
    };

    typescript = {
      enable = true;
    };
  };
}
