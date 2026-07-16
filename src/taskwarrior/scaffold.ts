import { TaskwarriorError, type Taskwarrior } from "./index.js";
import type { AddOptions, Priority, Task } from "./types.js";

export type StepSpec = {
  ref: string;
  description: string;
  priority?: Priority;
  due?: string;
  tags?: string[];
  dependsOn?: string[];
  udas?: Record<string, string | number>;
};

export type CreateProjectSpec = {
  project: string;
  steps: StepSpec[];
};

export type StepResult =
  | { ref: string; status: "created"; task: Task }
  | { ref: string; status: "error"; reason: string };

export type CreateProjectResult = {
  project: string;
  results: StepResult[];
};

function verifyCycleFree(steps: StepSpec[]): void {
  const dependsOn = new Map(steps.map((s) => [s.ref, s.dependsOn ?? []]));
  const state = new Map<string, "visiting" | "done">();

  const visit = (ref: string): void => {
    state.set(ref, "visiting");
    for (const dep of dependsOn.get(ref) ?? []) {
      const depState = state.get(dep);
      if (depState === "visiting") {
        throw new TaskwarriorError(`Dependency cycle involving "${dep}"`, {
          kind: "invalid-input",
        });
      }
      if (depState !== "done") visit(dep);
    }
    state.set(ref, "done");
  };

  for (const step of steps) {
    if (state.get(step.ref) !== "done") visit(step.ref);
  }
}

export function validateSteps(steps: StepSpec[]): void {
  const refs = new Set<string>();
  for (const step of steps) {
    if (refs.has(step.ref)) {
      throw new TaskwarriorError(`Duplicate step ref "${step.ref}"`, {
        kind: "invalid-input",
      });
    }
    refs.add(step.ref);
  }

  for (const step of steps) {
    for (const dep of step.dependsOn ?? []) {
      if (!refs.has(dep)) {
        throw new TaskwarriorError(
          `Step "${step.ref}" depends on unknown ref "${dep}"`,
          { kind: "invalid-input" },
        );
      }
    }
  }

  verifyCycleFree(steps);
}

function buildAddOptions(project: string, step: StepSpec): AddOptions {
  return {
    ...(project ? { project } : {}),
    ...(step.priority ? { priority: step.priority } : {}),
    ...(step.due ? { due: step.due } : {}),
    ...(step.tags ? { tags: step.tags } : {}),
    ...(step.udas ? { udas: step.udas } : {}),
  };
}

export async function createProject(
  tw: Taskwarrior,
  spec: CreateProjectSpec,
): Promise<CreateProjectResult> {
  validateSteps(spec.steps);

  const created = new Map<string, Task>();
  const errors = new Map<string, string>();

  for (const step of spec.steps) {
    try {
      created.set(
        step.ref,
        await tw.add(step.description, buildAddOptions(spec.project, step)),
      );
    } catch (error) {
      errors.set(
        step.ref,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  const results: StepResult[] = [];
  for (const step of spec.steps) {
    const task = created.get(step.ref);
    if (task === undefined) {
      results.push({
        ref: step.ref,
        status: "error",
        reason: errors.get(step.ref) ?? "failed to create",
      });
      continue;
    }
    const depUuids = (step.dependsOn ?? [])
      .map((dep) => created.get(dep)?.uuid)
      .filter((uuid): uuid is string => uuid !== undefined);
    const finalTask =
      depUuids.length > 0
        ? await tw.addDependencies(task.uuid, depUuids)
        : task;
    results.push({ ref: step.ref, status: "created", task: finalTask });
  }

  return { project: spec.project, results };
}
