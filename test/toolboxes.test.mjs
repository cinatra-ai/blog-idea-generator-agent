// Pins that this pack's bridge node declares an EMPTY toolbox list, and that
// the `generate` node's prompt still names all four declared outputs.
//
// A real differential provider probe on the host side isolated the failure of
// this kind: with the platform's default toolbox attached to the bridge turn,
// the model's answer came back missing the declared keys entirely and the run
// refused downstream; with no toolbox attached, the same prompt answered with
// every declared key, well formed.
//
// The declaration that the host actually reads is `data.toolbox_ids` on the
// bridge-targeting ApiNode: an omitted `toolbox_ids` in the bridge request
// defaults to the platform toolbox, and the flow-level `metadata.cinatra`
// toolbox list only ever ADDS a non-empty list onto nodes that have not
// declared their own — an empty flow-level list is a no-op and would not
// remove anything. So a pack whose single bridge turn must answer with the
// bare two-key JSON contract declares `"toolbox_ids": []` on the node itself,
// and leaves `metadata.cinatra.toolboxes` unset.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const oasPath = join(__dirname, "..", "cinatra", "oas.json");
const oas = JSON.parse(readFileSync(oasPath, "utf8"));

const BRIDGE_URL_MARK = "/api/llm-bridge";

// Every component in the document, including components nested inside inner
// Flow components, so a declaration cannot hide one level down.
function allComponents(node, depth = 0, out = []) {
  if (!node || typeof node !== "object" || depth > 8) return out;
  const refs = node.$referenced_components;
  if (refs && typeof refs === "object") {
    for (const [id, comp] of Object.entries(refs)) {
      if (!comp || typeof comp !== "object") continue;
      out.push([id, comp]);
      allComponents(comp, depth + 1, out);
    }
  }
  return out;
}

const components = allComponents(oas);
const bridgeNodes = components.filter(
  ([, c]) => c.component_type === "ApiNode" && typeof c.url === "string" && c.url.includes(BRIDGE_URL_MARK),
);

test("every bridge node declares an explicit, empty toolbox list", () => {
  assert.ok(bridgeNodes.length > 0, "expected at least one bridge-targeting ApiNode");
  for (const [id, node] of bridgeNodes) {
    const data = node.data || {};
    assert.ok(
      Object.prototype.hasOwnProperty.call(data, "toolbox_ids"),
      `node ${id}: data.toolbox_ids must be declared explicitly — an omitted list makes the host attach its default toolbox to the bridge turn`,
    );
    assert.deepEqual(
      data.toolbox_ids,
      [],
      `node ${id}: data.toolbox_ids must be exactly [] — this turn answers with the bare two-key JSON contract and calls no tool`,
    );
  }
});

test("the toolbox declaration is not parked where the host would not read it", () => {
  // An empty flow-level `metadata.cinatra.toolboxes` is a no-op at compile
  // time: only a NON-empty list is propagated onto nodes, and only onto nodes
  // that have not declared their own. A list parked there would look like a
  // declaration while changing nothing.
  const flowCinatra = (oas.metadata && oas.metadata.cinatra) || {};
  assert.ok(
    !Object.prototype.hasOwnProperty.call(flowCinatra, "toolboxes"),
    "metadata.cinatra.toolboxes must stay unset on the flow — the operative declaration is data.toolbox_ids on the bridge node",
  );
  const strays = components
    .filter(([, c]) => c.metadata && c.metadata.cinatra && "toolboxes" in c.metadata.cinatra)
    .map(([id]) => id);
  assert.deepEqual(strays, [], `toolboxes declared on component metadata (${strays.join(", ")}) instead of on the node's data.toolbox_ids`);
});

test("the generate node's prompt states the two-key contract and matches the declared outputs", () => {
  const generate = oas.$referenced_components.generate;
  assert.equal(generate.component_type, "ApiNode");
  const system = generate.data && generate.data.system;
  assert.equal(typeof system, "string", "expected the generate node's data.system prompt");

  // The operative instruction, not an incidental mention somewhere in the
  // prompt's examples: the opening sentence that fixes the envelope.
  const contractLine = "Return a single JSON object with exactly these two top-level keys:";
  assert.ok(system.includes(contractLine), "the system prompt must state the two-key contract up front");
  const head = system.slice(system.indexOf(contractLine), system.indexOf(contractLine) + 1200);
  for (const key of ["ideas", "notes"]) {
    assert.ok(head.includes(`"${key}"`), `the two-key contract must name the declared output ${key}`);
  }
  assert.ok(
    /no markdown wrapping of the JSON/i.test(system) && /no prose preface/i.test(system),
    "the prompt must forbid fencing and a prose preface around the JSON envelope",
  );

  assert.deepEqual(generate.outputs.map((o) => o.title).sort(), ["ideas", "notes"]);
});

test("the retired idea-batch keys are named nowhere in the pack's flow", () => {
  const whole = JSON.stringify(oas);
  for (const retired of ["ideaBatchTitle", "ideaBatchDocument"]) {
    assert.equal(
      whole.includes(retired),
      false,
      `${retired} is retired: the ideas are filed one by one, never as one batch document`,
    );
  }
});

// A node that declares an empty toolbox list must also SAY so in its own
// instructions. The host's canonical-extension invariant reads the bridge
// node's `data.system` and requires one of a fixed set of tool-discipline
// phrasings; a paraphrase outside that set does not satisfy it, so the
// alternation below is copied verbatim from the host's own check and the
// prompt carries one of its literal phrasings.
const NO_TOOL_DISCLAIMER =
  /NO MCP primitives|MUST NOT call any (MCP|tool)|Never call any tool|Do NOT call any (MCP )?tool|Do not call any tool|no MCP primitives/i;

test("every node declaring an empty toolbox list says so in its own prompt", () => {
  const emptyToolboxNodes = bridgeNodes.filter(([, node]) => {
    const data = node.data || {};
    return (
      Object.prototype.hasOwnProperty.call(data, "toolbox_ids") &&
      Array.isArray(data.toolbox_ids) &&
      data.toolbox_ids.length === 0
    );
  });
  assert.ok(emptyToolboxNodes.length > 0, "expected at least one node declaring an empty toolbox list");
  for (const [id, node] of emptyToolboxNodes) {
    const system = (node.data || {}).system;
    assert.equal(typeof system, "string", `node ${id}: expected a data.system prompt`);
    assert.match(
      system,
      NO_TOOL_DISCLAIMER,
      `node ${id}: the prompt must state that this turn calls no tool — the declaration alone is not enough`,
    );
  }
});
