// Pins that the declared `ideas` output schema in cinatra/oas.json is valid
// under the LLM provider's strict structured-output mode: every JSON-schema
// object node must set `additionalProperties: false` and list EVERY one of
// its `properties` keys in `required` (strict mode has no concept of an
// "optional" property — an optional field is modeled as a nullable type
// instead, e.g. `{"type": ["string", "null"]}`).
//
// This test exists because a real run against the real provider on this
// agent's own head failed before the model was ever asked a question, with:
//
//   400 Invalid schema for response_format 'response': In context=
//   ('properties', 'ideas', 'items'), 'additionalProperties' is required to
//   be supplied and to be false.
//
// The declared `ideas` array item was `{"type": "object"}` with no
// `properties` and no `additionalProperties` at all — not just missing one
// field, but carrying no declared shape whatsoever. This test checks the
// three places that stub is declared (the flow's own top-level `outputs`,
// the `generate` bridge node's `outputs` — the one actually sent to the
// provider as the structured-output contract — and the `end` node's
// `outputs`) and fails loudly if any of them regress.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const oasPath = join(__dirname, "..", "cinatra", "oas.json");
const oas = JSON.parse(readFileSync(oasPath, "utf8"));

/**
 * Walk a JSON-schema fragment and collect every node declaring
 * `type: "object"`, regardless of whether it has a `properties` key yet.
 * (A `type: "object"` schema with no `properties` at all is itself the
 * defect this test exists to catch — strict mode still requires
 * `additionalProperties: false` on it.)
 */
function collectObjectSchemas(node, path, out) {
  if (node === null || typeof node !== "object") return;
  if (Array.isArray(node)) {
    node.forEach((child, i) => collectObjectSchemas(child, `${path}[${i}]`, out));
    return;
  }
  if (node.type === "object") {
    out.push({ path, node });
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === "type") continue;
    collectObjectSchemas(value, `${path}.${key}`, out);
  }
}

/** Strict-mode violations for every object-typed node reachable from `schemaRoot`. */
function strictModeViolations(schemaRoot, label) {
  const objects = [];
  collectObjectSchemas(schemaRoot, label, objects);
  const violations = [];
  for (const { path, node } of objects) {
    if (node.additionalProperties !== false) {
      violations.push(
        `${path}: additionalProperties must be exactly false (got ${JSON.stringify(node.additionalProperties)})`,
      );
    }
    const propKeys = Object.keys(node.properties || {});
    const required = Array.isArray(node.required) ? node.required : [];
    const missing = propKeys.filter((k) => !required.includes(k));
    if (missing.length) {
      violations.push(`${path}: required must list every property key; missing ${JSON.stringify(missing)}`);
    }
  }
  return violations;
}

function findOutput(outputs, title) {
  const found = outputs.find((o) => o.title === title);
  assert.ok(found, `expected an output named ${JSON.stringify(title)}`);
  return found;
}

// The three places the `ideas` output's item schema is declared.
const ideasSchemaLocations = [
  ["outputs[] (top-level flow outputs)", findOutput(oas.outputs, "ideas")],
  ["generate node outputs[]", findOutput(oas.$referenced_components.generate.outputs, "ideas")],
  ["end node outputs[]", findOutput(oas.$referenced_components.end.outputs, "ideas")],
];

for (const [label, output] of ideasSchemaLocations) {
  test(`declared 'ideas' item schema at ${label} is strict-mode valid`, () => {
    assert.ok(output.json_schema && output.json_schema.items, `${label}: expected json_schema.items to be present`);
    const violations = strictModeViolations(output.json_schema.items, `${label}.json_schema.items`);
    assert.deepEqual(violations, [], violations.join("\n"));
  });

  test(`declared 'ideas' item schema at ${label} is a plain string member`, () => {
    // The ideas are plain text — one piece per idea, its first line the title.
    // No object member, no sub-fields for the host or the draft writer to
    // dissect, and no level of the bound list left undeclared.
    const items = output.json_schema.items;
    assert.equal(items.type, "string");
    assert.equal(items.properties, undefined);
  });
}
