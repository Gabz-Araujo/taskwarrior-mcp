{
  description = "Node environment  for the project";

  # Pinned separately so the machine's nixos-unstable bumps don't shift this toolchain.
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = {
    self,
    nixpkgs,
  }: let
    forEachSystem = nixpkgs.lib.genAttrs ["x86_64-linux" "aarch64-darwin"];
  in {
    devShells = forEachSystem (system: let
      pkgs = nixpkgs.legacyPackages.${system};
    in {
      default = pkgs.mkShell {
        name = "data2";

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
