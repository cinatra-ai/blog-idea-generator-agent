// Pins the two things a person needs from this pack when a run starts with
// nothing in the brief box: the declaration has to SAY what the brief is and
// what to write in it, and the agent's own refusal has to be a sentence the
// person can act on.
//
// A real run of this agent parked on its brief screen with the box empty, was
// accepted empty, and ended failed with the host's own fan-out sentence about
// an empty `ideas` list - which names neither the brief nor what to do about
// it. The brief input was declared as a bare {"title": "brief", "type":
// "string"} in BOTH of the places a screen is compiled from, so the box
// carried no description and no example; and Step 1 of the recipe returned the
// four bare words "brief is required" into `notes`.
//
// The keys pinned below are the ones the host really carries through to a
// screen - `format`, `description` and the `x-` hint namespace. A `minLength`
// or a `pattern` is deliberately NOT declared: nothing reads one, so it would
// be a claim this pack cannot keep. No `default` is declared either - the
// absent default is what makes the runtime refuse a start message that omits
// the brief altogether.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const oas = JSON.parse(readFileSync(join(root, "cinatra", "oas.json"), "utf8"));
const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

const start = oas.$referenced_components.start;

// The same input written twice: the flow's own inputs list and the StartNode's.
// A hint on only one of them would draw one screen on a freshly compiled
// template and another on a derived one.
const briefEntries = [
  ["the flow's own inputs", oas.inputs.find((i) => i.title === "brief")],
  ["the StartNode's inputs", start.inputs.find((i) => i.title === "brief")],
];

const system = oas.$referenced_components.generate.data.system;
const briefBullet = system.split("\n").find((line) => line.startsWith("- Confirm `brief`"));

test("the brief input is declared in both of the places a screen is compiled from", () => {
  for (const [label, entry] of briefEntries) {
    assert.ok(entry, `${label}: expected an input titled "brief"`);
  }
  assert.deepEqual(
    briefEntries[0][1],
    briefEntries[1][1],
    "the two entries are the same input written twice and must agree key for key",
  );
});

test("the brief input says what it is and what to write in it", () => {
  for (const [label, entry] of briefEntries) {
    assert.equal(entry.title, "brief", `${label}: the title is unchanged`);
    assert.equal(entry.type, "string", `${label}: the type is unchanged`);
    assert.equal(
      entry.format,
      "multiline",
      `${label}: format multiline is the spelling the field renderer reads for a multi-line box`,
    );
    assert.equal(typeof entry.description, "string", `${label}: expected a description`);
    assert.ok(entry.description.length > 0, `${label}: the description must not be empty`);
    assert.match(entry.description, /topic/i, `${label}: the description must say what the brief is`);
    assert.match(
      entry.description,
      /needs it|required/i,
      `${label}: the description must say that the run needs it`,
    );
    const placeholder = (entry.json_schema || {})["x-placeholder"];
    assert.equal(
      typeof placeholder,
      "string",
      `${label}: expected an x-placeholder example under the input's own json_schema`,
    );
    assert.ok(placeholder.length > 0, `${label}: the x-placeholder example must not be empty`);
    assert.deepEqual(
      Object.keys(entry).sort(),
      ["description", "format", "json_schema", "title", "type"],
      `${label}: exactly these keys - nothing else is added to this entry`,
    );
  }
});

test("the requiredness is not weakened and no unread constraint is declared", () => {
  assert.deepEqual(
    start.metadata.cinatra.required,
    ["brief"],
    "the StartNode's required list is exactly the brief",
  );
  for (const [label, entry] of briefEntries) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(entry, "default"),
      false,
      `${label}: the brief carries no default - an absent default is what makes the runtime refuse a start message that omits it`,
    );
    for (const unread of ["minLength", "maxLength", "pattern", "enum"]) {
      assert.equal(
        Object.prototype.hasOwnProperty.call(entry, unread),
        false,
        `${label}: ${unread} is not declared - no input-schema pipeline copies it and no renderer reads it`,
      );
      assert.equal(
        Object.prototype.hasOwnProperty.call(entry.json_schema || {}, unread),
        false,
        `${label}: ${unread} is not declared under json_schema either`,
      );
    }
    assert.deepEqual(
      Object.keys(entry.json_schema || {}).filter((key) => !key.startsWith("x-")),
      [],
      `${label}: the input's json_schema carries hint keys only`,
    );
  }
});

test("the empty-brief refusal is a reading a person can act on", () => {
  assert.equal(typeof briefBullet, "string", "expected Step 1 to open with the brief bullet");
  assert.equal(
    /notes: "brief is required"/.test(briefBullet),
    false,
    "the refusal must not be the four bare words a person cannot act on",
  );
  assert.match(briefBullet, /brief field/i, "the refusal must name the field the person types into");
  assert.match(briefBullet, /topic, angle or hook/i, "the refusal must say what to write in it");
  assert.match(briefBullet, /start the run again/i, "the refusal must say how to get the ideas");
});

test("the refusal still instructs the same envelope and the same stop", () => {
  assert.match(
    briefBullet,
    /\{ideas: \[\], notes:/,
    "the empty-brief branch still returns the two-key envelope with an empty ideas list",
  );
  assert.match(briefBullet, /and stop\.$/, "the empty-brief branch still stops");
});

test("the fan-out binding is untouched and no idea is fabricated for an empty brief", () => {
  const ideas = oas.$referenced_components.end.outputs.find((o) => o.title === "ideas");
  assert.deepEqual(ideas.cinatra.artifact, {
    extension: "@cinatra-ai/blog-idea-artifact",
    objectTypeId: "@cinatra-ai/blog-idea-artifact:blog-idea",
    contentFrom: "ideas",
    declaredMime: "text/plain",
    fanOut: {
      mode: "member",
      titleFrom: "first-line",
      titlePrefix: "Title:",
    },
  });
  assert.match(
    briefBullet,
    /ideas: \[\]/,
    "an empty brief still returns an empty ideas list, never a fabricated idea filed as an artifact",
  );
});

// The declaration is shipped content - the manifest's files list names
// `cinatra` - and a changed declaration loads only under a new published
// version, because the loader skips a hash mismatch. 0.2.0 is the version that
// carried the bare brief entry and the four-word refusal.
const VERSION_THAT_CARRIED_THE_BARE_BRIEF = "0.2.0";

test("the changed declaration ships under its own version", () => {
  assert.deepEqual(manifest.files, ["cinatra"], "the declaration is shipped content");
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/, "the published version is a plain semver");
  const parts = (version) => version.split(".").map(Number);
  const [major, minor, patch] = parts(manifest.version);
  const [baseMajor, baseMinor, basePatch] = parts(VERSION_THAT_CARRIED_THE_BARE_BRIEF);
  assert.ok(
    major > baseMajor ||
      (major === baseMajor && (minor > baseMinor || (minor === baseMinor && patch > basePatch))),
    `version ${manifest.version} must be above ${VERSION_THAT_CARRIED_THE_BARE_BRIEF}, the version that carried the bare declaration`,
  );
});
