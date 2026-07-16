import { TaskwarriorError } from "./client.js";

export type UdaType = "string" | "numeric" | "date" | "duration";

export type UdaDef = {
  name: string;
  type: UdaType;
  label?: string;
  values?: string[];
  default?: string;
};

function knownNamesMessage(registry: UdaDef[]): string {
  const names = registry.map((uda) => uda.name).join(", ");
  return names || "(none)";
}

export function assertKnownUdaNames(names: string[], registry: UdaDef[]): void {
  const known = new Set(registry.map((uda) => uda.name));
  for (const name of names) {
    if (!known.has(name)) {
      throw new TaskwarriorError(
        `Unknown custom field "${name}". Known fields: ${knownNamesMessage(registry)}`,
        { kind: "invalid-input" },
      );
    }
  }
}

export function serializeUdas(
  udas: Record<string, string | number> | undefined,
  registry: UdaDef[],
): string[] {
  if (!udas) return [];
  const byName = new Map(registry.map((uda) => [uda.name, uda]));
  const args: string[] = [];
  for (const [name, raw] of Object.entries(udas)) {
    const def = byName.get(name);
    if (!def) {
      throw new TaskwarriorError(
        `Unknown custom field "${name}". Known fields: ${knownNamesMessage(registry)}`,
        { kind: "invalid-input" },
      );
    }
    const value = String(raw);
    if (def.values && value !== "" && !def.values.includes(value)) {
      throw new TaskwarriorError(
        `"${value}" is not an allowed value for ${name}. Allowed: ${def.values.join(", ")}`,
        { kind: "invalid-input" },
      );
    }
    args.push(`${name}:${value}`);
  }
  return args;
}
