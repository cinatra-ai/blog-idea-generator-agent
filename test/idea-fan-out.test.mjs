// Pins the fan-out declaration this pack was converted to: the ideas are plain
// text, filed ONE artifact per idea, each titled from its own first line behind
// the `Title:` marker. Before this conversion the pack bound one markdown batch
// document through `titleFrom: ideaBatchTitle`, and a real run failed at
// materialization because the model's own answer never carried that batch title.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const oas = JSON.parse(readFileSync(join(root, "cinatra", "oas.json"), "utf8"));
const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

const endOutputs = oas.$referenced_components.end.outputs;
const ideas = endOutputs.find((o) => o.title === "ideas");

test("exactly one end-node output carries an artifact binding, and it is `ideas`", () => {
  const bound = endOutputs.filter((o) => o.cinatra && o.cinatra.artifact).map((o) => o.title);
  assert.deepEqual(bound, ["ideas"]);
});

test("the binding fans out over the members as plain text, titled from the first line", () => {
  const binding = ideas.cinatra.artifact;
  assert.equal(binding.extension, "@cinatra-ai/blog-idea-artifact");
  assert.equal(binding.objectTypeId, "@cinatra-ai/blog-idea-artifact:blog-idea");
  assert.equal(binding.contentFrom, "ideas");
  assert.equal(binding.declaredMime, "text/plain");
  assert.deepEqual(binding.fanOut, {
    mode: "member",
    titleFrom: "first-line",
    titlePrefix: "Title:",
  });
  assert.equal(binding.titleFrom, undefined, "a fanned-out set has no single title");
});

test("the bound list declares its member level, and the members are plain strings", () => {
  assert.equal(ideas.type, "array");
  assert.equal(ideas.json_schema.items.type, "string");
});

test("the prompt asks for the exact text the binding reads", () => {
  const system = oas.$referenced_components.generate.data.system;
  assert.ok(
    system.includes("Title: "),
    "the prompt must ask for the `Title: ` first line the binding reads the title from",
  );
  assert.ok(
    /plain text/i.test(system),
    "the prompt must say the ideas are plain text",
  );
  assert.ok(
    !/ideaBatch/i.test(system),
    "the prompt must not still ask for the retired batch document",
  );
});

test("the produces entry is typed to the blog-idea type", () => {
  assert.deepEqual(manifest.cinatra.produces, [
    {
      extension: "@cinatra-ai/blog-idea-artifact",
      objectTypeId: "@cinatra-ai/blog-idea-artifact:blog-idea",
    },
  ]);
});
