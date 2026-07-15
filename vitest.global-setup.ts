import { execSync } from "node:child_process";

// The stdio integration test runs the compiled server (dist/index.js), so the
// build must exist before any test runs — in both `vitest run` and watch.
export default function setup() {
  execSync("npm run build", { stdio: "inherit" });
}
