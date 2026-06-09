# External Integrations

**Analysis Date:** 2026-06-09

## APIs & External Services

**LLM Provider:**
- OpenAI — used as the preferred LLM backend for the single round-trip idea generation call
  - SDK/Client: Cinatra platform-managed (no direct npm OpenAI SDK in this repo)
  - Auth: Platform-managed; not configured at the agent repo level
  - Preferred model: `gpt-5.5` (declared in `cinatra/oas.json` under `metadata.cinatra.llm`)

**Cinatra AI Marketplace / Registry:**
- Private npm registry at `@cinatra-ai` scope (registry configured via `.npmrc`)
- Publishes this agent as `@cinatra-ai/blog-idea-generator-agent` to the Cinatra marketplace

## Data Storage

**Databases:**
- Not applicable — this is a stateless leaf agent with no persistence layer

**File Storage:**
- Not applicable

**Caching:**
- Not applicable

## Authentication & Identity

**Auth Provider:**
- Cinatra platform-managed — no direct auth provider integration in this repo
- The `cinatra_run_id` input field (`cinatra/oas.json`) ties execution to a platform run context

## Monitoring & Observability

**Error Tracking:**
- Not detected at the repo level; monitoring deferred to the Cinatra platform runtime

**Logs:**
- Not detected; logging handled by the Cinatra platform infrastructure

## CI/CD & Deployment

**Hosting:**
- Cinatra AI marketplace — agents are deployed and executed by the Cinatra platform after marketplace publish/install

**CI Pipeline:**
- `.github/` directory present (contents not enumerated in detail)
- `extension-kind-gate.mjs` — standalone CI gate script run as a pre-publish sanity check
  - Validates `cinatra/oas.json` parses correctly and contains no retired CRM primitives in LLM-visible prompt strings
  - Runs unauthenticated (zero npm dependencies) before registry access is available
  - Usage: `node extension-kind-gate.mjs --package-root .`

## Agent Dependencies (Runtime)

**@cinatra-ai/context-selection-agent:**
- Edge type: `runtime`
- Version constraint: `^0.1.1`
- Requirement: required
- Role: Provides the HITL `context-selector` screen for the `ideaContext` context slot, allowing callers to interactively select brand-voice artifacts before idea generation
- Declared in `package.json` under `cinatra.dependencies` and `cinatra.agentDependencies`

## Artifacts Consumed

**@cinatra-ai/brand-voice-artifact:**
- Injected via the `ideaContext` context slot (0–5 items, `accumulate` resolution mode, `interactive` selection)
- Used to keep generated blog ideas on-message with the caller's brand voice
- Slot defined in `cinatra/oas.json` under `metadata.cinatra.contextSlots`

## Artifacts Produced

**@cinatra-ai/blog-idea-artifact:**
- Output artifact type produced by this agent
- Contains `ideas` (array of `{title, summary, outline}`) and `notes` (string)
- Declared in both `package.json` (`cinatra.produces`) and `cinatra/oas.json` (`metadata.cinatra.produces`)

## Webhooks & Callbacks

**Incoming:**
- Not applicable

**Outgoing:**
- Not applicable — single round-trip LLM call only; no outgoing webhooks

## Explicitly Excluded Integrations

The agent's SKILL.md and `cinatra/oas.json` explicitly prohibit:
- No MCP primitives (no agent dispatch, no CRM reads/writes, no list ops)
- No `web_search` calls — all content must come from the inline `brief` and `referenceContent` inputs
- Callers needing web research should chain `@cinatra-ai/web-research-agent` first and pass output via `referenceContent`

## Environment Configuration

**Required env vars:**
- None managed at the repo level; all secrets and LLM credentials are platform-managed

**Secrets location:**
- `.npmrc` present — contains registry auth configuration (contents not read)

---

*Integration audit: 2026-06-09*
