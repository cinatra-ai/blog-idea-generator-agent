# Testing Patterns

**Analysis Date:** 2026-06-09

## Test Framework

**Runner:**
- Not applicable in this repo directly. No test framework is installed in `package.json`. The `pnpm test --if-present` CI step exits 0 because no `test` script is defined.
- The monorepo owns and runs unit + integration tests for the agent logic.

**Assertion Library:**
- Not applicable (no tests in this repo)

**Run Commands:**
```bash
# No local test script defined. CI runs:
corepack pnpm test --if-present   # exits 0 — no test script present
```

## Test File Organization

**Location:**
- No test files exist in this repo (confirmed via filesystem scan — zero `*.test.*` or `*.spec.*` files)

**Naming:**
- Not applicable

## What IS Tested (CI Gate)

Although this repo has no unit test suite, it runs a structural validation gate in CI that functions as a correctness check:

**Gate file:** `extension-kind-gate.mjs`

**CI step** (`.github/workflows/ci.yml`, `kind-gates` job):
```bash
node extension-kind-gate.mjs --package-root .
```

This gate validates:
1. `cinatra/oas.json` parses as valid JSON
2. LLM-visible fields (`system`, `user`, `description`) in the OAS contain no banned/retired CRM primitive names (e.g., `contacts_list`, `accounts_get`)
3. No banned legacy entity typeHints in prompt strings
4. No retired `objects_list(<crm-entity>)` call pattern in prompt strings

Exit codes: `0` = pass, `1` = one or more violations.

## Gate Logic Structure

The gate functions in `extension-kind-gate.mjs` are all **pure functions** (take inputs, return `string[]` errors), making them importable and independently verifiable by the monorepo test suite:

| Function | What it checks |
|---|---|
| `parseArgs(argv)` | CLI argument parsing |
| `validateAgent(packageRoot)` | OAS parse + banned-primitive scan |
| `validateWorkflowPackageShape(pkg)` | Workflow package.json shape |
| `validateBpmnSanity(xml)` | BPMN XML well-formedness + shape |
| `findWorkflowSidecars(packageRoot)` | Finds all `cinatra/workflow.bpmn` files |
| `validateWorkflow(packageRoot)` | Orchestrates workflow checks |
| `runGate(packageRoot)` | Top-level dispatch by `cinatra.kind` |

## Mocking

**Framework:** Not applicable — no test suite in this repo.

**In the gate utility itself:** no mocking infrastructure. All functions use real filesystem reads (`readFileSync`, `existsSync`, `readdirSync`) and are tested by the monorepo against fixture files.

## Fixtures and Factories

**Test Data:**
- Not applicable in this repo. The monorepo provides fixture `oas.json` and `workflow.bpmn` files when testing the gate.

**Location:**
- No fixture directory present.

## Coverage

**Requirements:** Not enforced in this repo.

**View Coverage:**
```bash
# Not applicable — no local test runner.
```

## Test Types

**Unit Tests:**
- Not present in this repo. The monorepo tests `extension-kind-gate.mjs` exported functions against fixture files.

**Integration Tests:**
- The CI pipeline acts as the integration gate: `npm pack --dry-run` validates the publish payload shape end-to-end.

**E2E Tests:**
- Not applicable for this content-only agent repo. LLM output quality is not automatically tested; it is validated by human review of the SKILL.md prompt and OAS contract.

## CI Pipeline as Test Substitute

The `.github/workflows/ci.yml` `build` job runs these checks in lieu of a test suite:

1. **Dependency shape check** — inline `node -e` script validates no `@cinatra-ai/*` packages leaked into `dependencies`/`devDependencies`/`optionalDependencies` (must be optional `peerDependencies` only)
2. **Install skip** — skipped for this source-mirror repo (host-internal peers not resolvable standalone)
3. **Typecheck skip** — skipped for this source-mirror repo (monorepo owns typecheck)
4. **Test skip** — skipped for this source-mirror repo
5. **Pack dry-run** — `npm pack --dry-run` validates publishable package shape
6. **Agent OAS gate** — `node extension-kind-gate.mjs --package-root .` validates `cinatra/oas.json` content

## Adding Tests

If unit tests are added to this repo in the future:
- Add a `test` script to `package.json`
- Use a standalone-installable test framework (e.g., `node:test` built-in — zero extra deps) to preserve the zero-dependency philosophy of the extracted repo
- Place test files alongside or under a `test/` directory at repo root
- The CI `Test` step already runs `corepack pnpm test --if-present` — no CI changes needed

---

*Testing analysis: 2026-06-09*
