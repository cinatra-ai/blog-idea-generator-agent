<!-- refreshed: 2026-06-09 -->
# Architecture

**Analysis Date:** 2026-06-09

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                     Caller / Orchestrator                    │
│  (any Cinatra agent or workflow that invokes via agent_run)  │
└──────────────────────────┬──────────────────────────────────┘
                           │  inputs: brief, audience, count,
                           │          tone, existingIdeasContext,
                           │          referenceContent
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  OAS Flow  (cinatra/oas.json)                │
│                                                             │
│  ┌──────────┐   ┌─────────────────────────────────────┐    │
│  │  start   │──▶│  context_ideaContext  (FlowNode)     │    │
│  │ (inputs) │   │  Resolves brand-voice slot artifacts │    │
│  └──────────┘   │  via @cinatra-ai/context-selection-  │    │
│                 │  agent sub-flow.  May surface HITL    │    │
│                 │  gate for user artifact selection.    │    │
│                 └──────────────┬────────────────────────┘    │
│                                │  contextSlotBindings        │
│                                ▼                            │
│                 ┌──────────────────────────────────────┐    │
│                 │  generate  (ApiNode → /api/llm-bridge)│    │
│                 │  agent_id: blog-idea-generator-agent  │    │
│                 │  model: openai / gpt-5.5              │    │
│                 │  system+user prompt from SKILL.md     │    │
│                 └──────────────┬────────────────────────┘    │
│                                │  ideas[], notes             │
│                                ▼                            │
│                 ┌──────────────────────────────────────┐    │
│                 │              end                      │    │
│                 └──────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼  produces
              @cinatra-ai/blog-idea-artifact
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| OAS Flow definition | Declares nodes, edges, inputs/outputs for the entire agent run | `cinatra/oas.json` |
| `start` (StartNode) | Accepts and exposes all user-facing inputs; marks `brief` as required | `cinatra/oas.json` (`$referenced_components.start`) |
| `context_ideaContext` (FlowNode) | Resolves the `ideaContext` context slot (brand-voice artifacts, 0-5 items); may trigger interactive HITL selection | `cinatra/oas.json` (`$referenced_components.context_ideaContext`) |
| `generate` (ApiNode) | Single POST to `/api/llm-bridge`; provides system + user prompt; model: gpt-5.5; returns `{ideas, notes}` JSON | `cinatra/oas.json` (`$referenced_components.generate`) |
| `end` (EndNode) | Emits `ideas[]` and `notes` as typed outputs with defaults | `cinatra/oas.json` (`$referenced_components.end`) |
| SKILL.md | LLM behavioral specification: step-by-step recipe, constraints, output shape | `skills/blog-idea-generator-agent/SKILL.md` |
| extension-kind-gate | Zero-dependency CI gate: validates `cinatra/oas.json` for retired CRM primitives; handles workflow BPMN sanity for other extension kinds | `extension-kind-gate.mjs` |

## Pattern Overview

**Overall:** Stateless Leaf Agent — single LLM round-trip, no persistent state, no MCP tool calls at runtime.

**Key Characteristics:**
- The agent is defined entirely as a declarative OAS Flow JSON (`cinatra/oas.json`) — no imperative application code.
- The SKILL.md at `skills/blog-idea-generator-agent/SKILL.md` is the system prompt contract; the LLM-bridge auto-discovers it via `agent_id: "blog-idea-generator-agent"`.
- One optional pre-LLM step: context slot resolution for brand-voice artifacts, surfaced through the `@cinatra-ai/context-selection-agent` sub-flow (which may pause for HITL).
- Outputs are deterministically parsed JSON — callers receive a typed `ideas[]` array and a `notes` string with zero free-form prose wrapping.
- Tool discipline enforced in SKILL.md: the LLM MUST NOT call any MCP primitive or `web_search`; research must be pre-chained via `@cinatra-ai/web-research-agent` and passed in `referenceContent`.

## Layers

**Inputs Layer:**
- Purpose: Accept and validate caller-supplied parameters
- Location: `cinatra/oas.json` → `$referenced_components.start`
- Contains: Type declarations, defaults, required/hidden metadata for `brief`, `audience`, `count`, `tone`, `existingIdeasContext`, `referenceContent`, `cinatra_run_id`, `projectId`
- Depends on: Nothing (entry point)
- Used by: `context_ideaContext`, `generate`

**Context Resolution Layer:**
- Purpose: Resolve optional brand-voice artifacts from the `ideaContext` context slot (0-5 `@cinatra-ai/brand-voice-artifact` items); handles both interactive and autonomous selection modes
- Location: `cinatra/oas.json` → `$referenced_components.context-ideaContext-subflow`
- Contains: `ctx-ideaContext-resolve_context` (API call to `/api/context-resolve`), `ctx-ideaContext-select_mode` (BranchingNode), `ctx-ideaContext-emit_context_payload` (OutputMessageNode), `ctx-ideaContext-context_select_gate` (HITL InputMessageNode), `ctx-ideaContext-finalize_interactive` / `ctx-ideaContext-finalize_autonomous` (API calls to `/api/context-finalize`)
- Depends on: `start` inputs (`cinatra_run_id`, `projectId`, `ideaContextSlotId`, `ideaContextParentPackageName`)
- Used by: `generate` (via `contextSlotBindings`)

**Generation Layer:**
- Purpose: Single LLM call that produces blog ideas strictly following the SKILL.md 4-step recipe
- Location: `cinatra/oas.json` → `$referenced_components.generate`
- Contains: ApiNode POST to `{{CINATRA_BASE_URL}}/api/llm-bridge` with inline system + user prompt templates
- Depends on: All inputs from `start`, `contextSlotBindings` from context layer, SKILL.md (discovered server-side by `agent_id`)
- Used by: `end`

**Output Layer:**
- Purpose: Type-safe emission of the agent's result
- Location: `cinatra/oas.json` → `$referenced_components.end`
- Contains: Typed `ideas[]` (array of objects) and `notes` (string) with empty-collection defaults
- Depends on: `generate`
- Used by: Callers via `agent_run`

**CI Gate Layer:**
- Purpose: Pre-publish sanity validation; runs unauthenticated without registry access
- Location: `extension-kind-gate.mjs`
- Contains: `validateAgent()` (OAS retired-primitive scan), `validateWorkflow()` (BPMN shape), `runGate()` (dispatch by `cinatra.kind`)
- Depends on: Node.js built-ins only
- Used by: `.github/workflows/ci.yml` (`kind-gates` job)

## Data Flow

### Primary Request Path (no brand-voice context, autonomous)

1. Caller invokes agent with `brief` (required) and optional params — `start` node (`cinatra/oas.json` `$referenced_components.start`)
2. `context_ideaContext` FlowNode calls `/api/context-resolve`; `selectionMode` is `"autonomous"` → branches to `ctx-ideaContext-finalize_autonomous`; returns `contextSlotBindings: []` — (`cinatra/oas.json` `context-ideaContext-subflow`)
3. `generate` ApiNode POSTs to `/api/llm-bridge` with all inputs + `contextSlotBindings`; LLM executes SKILL.md 4-step recipe — (`cinatra/oas.json` `$referenced_components.generate`)
4. LLM returns `{ideas:[{title, summary, outline}], notes}` strict JSON; bridge parses and surfaces typed outputs
5. `end` node emits `ideas[]` and `notes` to the caller — (`cinatra/oas.json` `$referenced_components.end`)
6. Caller receives `@cinatra-ai/blog-idea-artifact`

### Brand-Voice Context Path (interactive HITL)

1. Steps 1 same as above
2. `context_ideaContext` resolves candidates; `selectionMode` is not `"autonomous"` → `emit_context_payload` (OutputMessageNode sends JSON payload to UI), then `context_select_gate` (InputMessageNode — pauses run, awaits user selection in `@cinatra-ai/context-selection-agent:context-selector` renderer)
3. User picks 0-5 brand-voice artifacts; `finalize_interactive` POSTs to `/api/context-finalize` with `userResponse`; returns `contextSlotBindings`
4. Continues from step 3 of primary path, with bound artifact content injected alongside other inputs

**State Management:**
- Stateless: no module-level singletons, no persistent store, no session state. Each agent run is fully isolated. Context artifact references are resolved fresh per run via the Cinatra platform APIs.

## Key Abstractions

**OAS Flow:**
- Purpose: Declarative directed graph of nodes (Start, ApiNode, FlowNode, BranchingNode, OutputMessageNode, InputMessageNode, EndNode) connected by control-flow and data-flow edges
- Examples: `cinatra/oas.json`
- Pattern: Nodes declare typed inputs/outputs; edges wire them; platform executes the graph

**Context Slot:**
- Purpose: Optional pre-LLM artifact injection pattern — a named slot (`ideaContext`) that accepts specific artifact extensions (`@cinatra-ai/brand-voice-artifact`) and binds their content into the LLM call
- Examples: `cinatra/oas.json` → `metadata.cinatra.contextSlots[0]`
- Pattern: `resolve → branch(autonomous/interactive) → finalize → contextSlotBindings`

**SKILL.md:**
- Purpose: The LLM's executable specification. Defines inputs, a 4-step recipe, constraints (count cap, tone defaults, exclusion logic, referenceContent anonymization), and exact output JSON shape
- Examples: `skills/blog-idea-generator-agent/SKILL.md`
- Pattern: Auto-discovered server-side by `agent_id`; not imported by any application code in this repo

## Entry Points

**Agent Run:**
- Location: `cinatra/oas.json` → `start_node.$component_ref: "start"`
- Triggers: External caller invoking `agent_run` with `@cinatra-ai/blog-idea-generator-agent`
- Responsibilities: Accept inputs, route through context resolution, invoke LLM, return typed outputs

**CI Gate:**
- Location: `extension-kind-gate.mjs` → `main()`
- Triggers: `node extension-kind-gate.mjs --package-root .` in `.github/workflows/ci.yml`
- Responsibilities: Parse `package.json` kind, dispatch to `validateAgent()` or `validateWorkflow()`, exit 0/1

## Architectural Constraints

- **Threading:** Not applicable — no application runtime. The OAS flow is executed by the Cinatra platform; `extension-kind-gate.mjs` is single-threaded Node.js.
- **Global state:** None. `extension-kind-gate.mjs` uses only module-scoped `const` sets/arrays (compile-time constants for banned primitives). No shared mutable state.
- **Circular imports:** Not applicable — no import graph beyond Node built-ins in `extension-kind-gate.mjs`.
- **No MCP primitives at runtime:** Enforced by SKILL.md directive and audited by `extension-kind-gate.mjs`'s `validateAgent()` (scans LLM-visible strings for retired CRM tool names).
- **count cap:** LLM is instructed to apply `Math.max(1, Math.min(10, count ?? 5))` defensively — values outside [1, 10] are silently clamped.
- **referenceContent anonymization:** LLM MUST NOT reference the source document, its origin, or any person/company names found in it.

## Anti-Patterns

### Calling MCP primitives from the LLM

**What happens:** SKILL.md explicitly forbids the LLM from calling any Cinatra MCP primitive (CRM reads/writes, list ops, agent dispatch) or `web_search`.
**Why it's wrong:** Would violate the stateless single-round-trip contract; web search introduces non-determinism and latency; CRM writes have side effects not authorized by this agent.
**Do this instead:** Pre-chain `@cinatra-ai/web-research-agent` and pass its output via `referenceContent`; use the `ideaContext` slot for brand-voice artifacts.

### Leaking first-party packages into direct dependencies

**What happens:** CI checks that `@cinatra-ai/*` and `@cinatra/*` packages appear only as optional `peerDependencies`, never in `dependencies`/`devDependencies`/`optionalDependencies`.
**Why it's wrong:** This is a source-mirror repo. Host-internal packages are never published to a registry; leaking them into direct deps would cause CI install failures in unauthenticated contexts.
**Do this instead:** Declare any first-party dependency in `peerDependencies` with `peerDependenciesMeta.<pkg>.optional: true` (see `package.json`).

## Error Handling

**Strategy:** Minimal in-agent error handling; relies on platform-level error propagation.

**Patterns:**
- SKILL.md defines one explicit error path: if `brief` is empty, return `{ideas: [], notes: "brief is required"}` and stop — no exception thrown.
- `extension-kind-gate.mjs` uses a pure `errors: string[]` accumulation pattern; all validators return error arrays and never throw (except for truly unexpected errors caught in `main()`).
- OAS node failures (HTTP errors from `/api/llm-bridge`, `/api/context-resolve`, `/api/context-finalize`) are handled by the Cinatra platform runtime, not by code in this repo.

## Cross-Cutting Concerns

**Logging:** Not applicable — no application runtime in this repo. Platform handles run logging.
**Validation:** Input validation is split: structural type validation is declared in OAS node `inputs` schemas; semantic validation (count capping, brief presence check, exclusion set building) is delegated to the LLM via SKILL.md.
**Authentication:** Not applicable at the repo level. The Cinatra platform authenticates all `/api/*` calls using `cinatra_run_id` and `projectId` passed through the flow.

---

*Architecture analysis: 2026-06-09*
