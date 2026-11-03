{ pkgs, lib, ... }:

{
  env = {
    # package.json installs Cloudflare tooling; site dependencies belong to Deno.
    DENO_NO_PACKAGE_JSON = "1";
  } // lib.optionalAttrs pkgs.stdenv.hostPlatform.isLinux {
    # Sharp's prebuilt npm addon needs the C++ runtime when loaded by Nix's Deno.
    LD_LIBRARY_PATH = lib.makeLibraryPath [ pkgs.stdenv.cc.cc.lib ];
  };

  languages = {
    deno = {
      enable = true;
    };

    typescript = {
      enable = true;
    };
  };
}
