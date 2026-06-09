# Codebase Structure

**Analysis Date:** 2026-06-09

## Directory Layout

```
blog-idea-generator-agent/
├── cinatra/
│   └── oas.json                   # Declarative OAS Flow: nodes, edges, inputs/outputs
├── skills/
│   └── blog-idea-generator-agent/
│       └── SKILL.md               # LLM behavioral specification (system prompt contract)
├── .github/
│   └── workflows/
│       ├── ci.yml                 # Standalone CI: classify, lint, kind-gate
│       └── release.yml            # Release workflow
├── .planning/
│   └── codebase/                  # GSD codebase maps (this document lives here)
├── extension-kind-gate.mjs        # Zero-dependency CI gate for agent/workflow validation
├── package.json                   # Package manifest with cinatra.kind and dependencies
├── tsconfig.json                  # TypeScript config (used by gate tooling)
├── .npmrc                         # npm registry config
├── LICENSE                        # Apache-2.0
└── README.md                      # Agent description
```

## Directory Purposes

**`cinatra/`:**
- Purpose: Cinatra platform artifacts for this extension
- Contains: `oas.json` — the complete OAS Flow definition that the Cinatra runtime executes
- Key files: `cinatra/oas.json`

**`skills/blog-idea-generator-agent/`:**
- Purpose: LLM skill definitions auto-discovered by the Cinatra LLM bridge via `agent_id`
- Contains: `SKILL.md` — step-by-step recipe, input contracts, output JSON shape, constraints
- Key files: `skills/blog-idea-generator-agent/SKILL.md`

**`.github/workflows/`:**
- Purpose: GitHub Actions CI/CD pipelines
- Contains: `ci.yml` (pre-publish sanity gate), `release.yml` (publishing)
- Key files: `.github/workflows/ci.yml`, `.github/workflows/release.yml`

**`.planning/codebase/`:**
- Purpose: GSD codebase analysis documents consumed by `/gsd-plan-phase` and `/gsd-execute-phase`
- Contains: ARCHITECTURE.md, STRUCTURE.md (this file)
- Generated: Yes (by GSD mapper)
- Committed: Yes

## Key File Locations

**Entry Points:**
- `cinatra/oas.json`: Flow definition; `start_node.$component_ref: "start"` is the agent entry point
- `extension-kind-gate.mjs`: CI gate entry; `main()` is invoked by `node extension-kind-gate.mjs --package-root .`

**Configuration:**
- `package.json`: Package identity (`@cinatra-ai/blog-idea-generator-agent`), `cinatra.kind: "agent"`, runtime agent dependency on `@cinatra-ai/context-selection-agent`, produces `@cinatra-ai/blog-idea-artifact`
- `tsconfig.json`: TypeScript configuration (applies to `extension-kind-gate.mjs` and any tooling)
- `.npmrc`: npm/pnpm registry settings

**Core Logic:**
- `cinatra/oas.json`: All flow logic — node graph, data wiring, prompt templates, model preferences
- `skills/blog-idea-generator-agent/SKILL.md`: All LLM behavioral logic — recipe steps, constraints, output schema

**CI:**
- `.github/workflows/ci.yml`: Standalone CI pipeline; runs `extension-kind-gate.mjs` for the `agent` kind gate

## Naming Conventions

**Files:**
- OAS artifacts: `cinatra/oas.json` (agents), `cinatra/workflow.bpmn` (workflows)
- Skills: `skills/<agent-name>/SKILL.md` where `<agent-name>` matches the `agent_id` used in `oas.json`
- CI gates: `extension-kind-gate.mjs` — shipped verbatim by the extraction script into each extracted repo
- Package names: `@cinatra-ai/<slug>-agent` for agent extensions, `@cinatra-ai/<slug>-workflow` for workflow extensions

**OAS Node IDs:**
- camelCase for main flow nodes: `start`, `generate`, `end`, `context_ideaContext`
- Context sub-flow nodes prefixed: `ctx-<slotId>-<step>` (e.g. `ctx-ideaContext-resolve_context`)
- Data flow edges named: `<sourceNode>_<output>_to_<destNode>_<input>` (e.g. `start_brief_to_generate_brief`)

**Context Slots:**
- Slot IDs: camelCase (e.g. `ideaContext`)
- Sub-flow refs: `context-<slotId>-subflow` and `context_<slotId>` for the FlowNode

## Where to Add New Code

**New input parameter:**
- Declare in `cinatra/oas.json` → `$referenced_components.start.inputs` (with type and default)
- Add to flow-level `inputs` array at top of `cinatra/oas.json`
- Wire a DataFlowEdge from `start` to `generate` (or whichever node consumes it)
- Document in `skills/blog-idea-generator-agent/SKILL.md` under `## Inputs`

**New context slot (additional artifact type):**
- Add slot definition to `metadata.cinatra.contextSlots` in `cinatra/oas.json`
- Add a new `context_<slotId>` FlowNode, a `context-<slotId>-subflow` sub-flow component, and appropriate control/data flow edges
- Add corresponding internal inputs (`<slotId>ParentPackageName`, `<slotId>SlotId`) to `start`

**New LLM behavioral rule:**
- Edit `skills/blog-idea-generator-agent/SKILL.md` only — no `cinatra/oas.json` changes needed
- SKILL.md changes take effect on the next run (discovered server-side by the bridge)

**New CI validation rule:**
- Add to `extension-kind-gate.mjs` → `BANNED_PRIMITIVES` (for retired tool names) or `validateAgent()` / `validateWorkflow()` functions
- The gate is self-contained; no imports to update

**New artifact produced:**
- Add to `package.json` → `cinatra.produces[]`
- Add to `cinatra/oas.json` → `metadata.cinatra.produces[]`

## Special Directories

**`cinatra/`:**
- Purpose: Platform-consumed sidecar directory; `oas.json` for agents, `workflow.bpmn` for workflows
- Generated: `oas.json` is authored/maintained manually (or by extraction tooling); not auto-generated at build time within this repo
- Committed: Yes — it is the primary deployment artifact

**`.planning/`:**
- Purpose: GSD planning documents
- Generated: Yes (by GSD mapper commands)
- Committed: Yes

---

*Structure analysis: 2026-06-09*
