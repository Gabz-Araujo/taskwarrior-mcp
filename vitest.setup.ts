import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "tw-taskrc-"));
const rc = join(dir, "taskrc");
writeFileSync(rc, "");
process.env["TASKRC"] = rc;
