{
  description = "MCP server for Taskwarrior, with optional Timewarrior time reporting";

  # Pinned separately so the machine's nixos-unstable bumps don't shift this toolchain.
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = {
    self,
    nixpkgs,
  }: let
    forEachSystem = nixpkgs.lib.genAttrs ["x86_64-linux" "aarch64-darwin"];
    version = (builtins.fromJSON (builtins.readFile ./package.json)).version;
  in {
    packages = forEachSystem (system: let
      pkgs = nixpkgs.legacyPackages.${system};
    in {
      default = pkgs.buildNpmPackage {
        pname = "taskwarrior-mcp";
        inherit version;
        src = ./.;
        npmDepsHash = "sha256-QKYzFVDQmGobqknwkJ4i0ZE+HU2NEGt5M53Epm0hp8w=";
        nativeBuildInputs = [pkgs.makeWrapper];
        postInstall = ''
          wrapProgram $out/bin/taskwarrior-mcp \
            --prefix PATH : ${pkgs.lib.makeBinPath [pkgs.taskwarrior3 pkgs.timewarrior]}
        '';
      };
    });

    apps = forEachSystem (system: {
      default = {
        type = "app";
        program = "${self.packages.${system}.default}/bin/taskwarrior-mcp";
      };
    });

    devShells = forEachSystem (system: let
      pkgs = nixpkgs.legacyPackages.${system};
    in {
      default = pkgs.mkShell {
        name = "taskwarrior-mcp";

        packages = with pkgs; [
          # nixpkgs 24.14.0 vs .nvmrc's 24.13.0 — patch drift is harmless.
          nodejs_24
          taskwarrior3
          timewarrior
        ];
      };
    });
  };
}
