import { expect, test } from "vitest";
import { FakeTaskwarrior } from "../testing/fake-taskwarrior.js";
import { nextAction } from "./next-action.js";

test("picks the ready task over a higher-urgency blocked one", async () => {
  const tw = new FakeTaskwarrior();
  const blocker = await tw.add("blocker");
  const blocked = await tw.add("blocked high urgency");
  await tw.addDependencies(blocked.uuid, [blocker.uuid]);

  const { action } = await nextAction(tw, {});
  expect(action?.uuid).toBe(blocker.uuid);
});

test("counts how many tasks the action unblocks", async () => {
  const tw = new FakeTaskwarrior();
  const blocker = await tw.add("blocker");
  const a = await tw.add("a");
  const b = await tw.add("b");
  await tw.addDependencies(a.uuid, [blocker.uuid]);
  await tw.addDependencies(b.uuid, [blocker.uuid]);

  const { action, why } = await nextAction(tw, {});
  expect(action?.uuid).toBe(blocker.uuid);
  expect(why?.unblocks).toBe(2);
});

test("scopes by project", async () => {
  const tw = new FakeTaskwarrior();
  await tw.add("home thing", { project: "home" });
  await tw.add("work thing", { project: "work" });

  const { action } = await nextAction(tw, { project: "work" });
  expect(action?.description).toBe("work thing");
});

test("returns nulls when nothing is ready", async () => {
  const tw = new FakeTaskwarrior();
  const blocker = await tw.add("blocker");
  const blocked = await tw.add("blocked");
  await tw.addDependencies(blocked.uuid, [blocker.uuid]);
  await tw.done(blocker.uuid);
  await tw.done(blocked.uuid);

  const result = await nextAction(tw, {});
  expect(result).toEqual({ action: null, why: null });
});
