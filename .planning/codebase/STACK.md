# Technology Stack

**Analysis Date:** 2026-06-09

## Languages

**Primary:**
- TypeScript — compiled to ESNext (ES2023 target), configured in `tsconfig.json`

**Secondary:**
- JavaScript (ESM) — CI gate script `extension-kind-gate.mjs` (zero-dependency, Node built-ins only)

## Runtime

**Environment:**
- Node.js (ESM modules; `"type": "module"` in `package.json`)

**Package Manager:**
- npm (`.npmrc` present — note existence only, contents not read)
- Lockfile: Not detected in repo root (likely generated on install)

## Frameworks

**Core:**
- Cinatra Agent Framework (`agentspec_version: 26.1.0`) — the agent is defined as a `Flow` component type via `cinatra/oas.json`; no npm framework package is bundled

**Testing:**
- Not detected (no jest/vitest config, no test files present)

**Build/Dev:**
- TypeScript compiler (`tsc`) — outputs to `dist/`, sources expected in `src/` per `tsconfig.json`
- `extension-kind-gate.mjs` — standalone Node CI gate (no build tool dependency)

## Key Dependencies

**Critical:**
- `@cinatra-ai/context-selection-agent` (runtime agent dependency, semver `^0.1.1`) — provides the HITL context-selector screen used in the `ideaContext` context slot; declared in `package.json` under `cinatra.agentDependencies`

**Infrastructure:**
- No npm package dependencies declared in `package.json` (no `dependencies` or `devDependencies` fields)

## Configuration

**TypeScript (`tsconfig.json`):**
- Target: `ES2023`, module: `ESNext`, moduleResolution: `bundler`
- Strict mode enabled; `noImplicitAny: false`
- JSX: `react-jsx` (for potential UI components)
- Outputs: `dist/`, maps and declarations enabled
- Sources: `src/**/*.ts`, `src/**/*.tsx`

**Cinatra Agent Spec (`cinatra/oas.json`):**
- `agentspec_version: 26.1.0`
- Preferred LLM provider: `openai`, preferred model: `gpt-5.5`
- Context slot `ideaContext`: accepts `@cinatra-ai/brand-voice-artifact`, 0–5 items, `accumulate` resolution
- Produces: `@cinatra-ai/blog-idea-artifact`

**Package Manifest (`package.json`):**
- Package name: `@cinatra-ai/blog-idea-generator-agent`
- Version: `0.1.0`
- License: Apache-2.0

## Platform Requirements

**Development:**
- Node.js with ESM support
- Access to Cinatra AI private npm registry (for `@cinatra-ai/*` scoped packages; `.npmrc` configures registry auth)

**Production:**
- Deployed and executed within the Cinatra AI platform marketplace
- Marketplace performs Profile-1.0 BPMN compile and full OAS runtime-invariant validation at publish/install time
- CI gate (`extension-kind-gate.mjs`) runs unauthenticated, before registry access, as a lightweight pre-publish sanity check

---

*Stack analysis: 2026-06-09*
