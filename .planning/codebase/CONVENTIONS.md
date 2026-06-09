# Coding Conventions

**Analysis Date:** 2026-06-09

## Repository Type

This is a **content-only Cinatra agent extension** — a source-mirror repo. There are no `src/` TypeScript files owned by this repo. The repo ships:
- `skills/blog-idea-generator-agent/SKILL.md` — the LLM system prompt (Markdown)
- `cinatra/oas.json` — the OpenAPI-style agent contract (JSON)
- `package.json` — the extension manifest (JSON)
- `extension-kind-gate.mjs` — a self-contained CI validation utility (ESM JavaScript)
- `tsconfig.json` — a TypeScript config stub (targets a `src/` that does not exist here; provided for monorepo integration)

All TypeScript authoring, typechecking, and testing of the business logic happens in the Cinatra monorepo, not in this repo.

## Naming Patterns

**Files:**
- `kebab-case` for all filenames: `extension-kind-gate.mjs`, `oas.json`, `workflow.bpmn` (pattern)
- Skill directory matches the package slug: `skills/blog-idea-generator-agent/`
- CI workflow files: `ci.yml`, `release.yml` (plain lowercase)

**Functions (in `extension-kind-gate.mjs`):**
- `camelCase` for all exported and internal functions: `parseArgs`, `validateAgent`, `validateWorkflowPackageShape`, `validateBpmnSanity`, `findWorkflowSidecars`, `validateWorkflow`, `runGate`, `main`
- Private helpers (not exported): `walkLlmStrings`, `scanOasString`, `wordBoundary`, `prefixOf`, `localOf`

**Variables:**
- `camelCase` for local bindings: `packageRoot`, `oasPath`, `findings`, `allSidecars`
- `SCREAMING_SNAKE_CASE` for module-level constants: `LLM_VISIBLE_FIELDS`, `BANNED_PRIMITIVES`, `BANNED_TYPEHINTS`, `PRIMITIVE_PATTERNS`, `OBJECTS_LIST_CRM_RE`, `BPMN_MODEL_NS`, `WORKFLOW_PACKAGE_NAME_RE`

**Types:**
- No TypeScript types in this repo's own files (gate is plain `.mjs`). Types are defined in the monorepo.

## Code Style

**Formatting:**
- No Prettier or ESLint config file present in this repo. The monorepo owns formatter configuration.
- Indentation: 2 spaces (observed in `extension-kind-gate.mjs` and JSON files)
- Trailing commas: present in multi-line arrays and objects
- Quotes: double quotes for strings

**Linting:**
- No local `.eslintrc*` or `biome.json` detected. Lint runs in the monorepo context.

## Import Organization

**`extension-kind-gate.mjs` pattern:**
- All imports are Node built-ins grouped at the top, single `import` statement per module:
  ```js
  import { readFileSync, existsSync, readdirSync } from "node:fs";
  import { resolve, join, basename, dirname, relative } from "node:path";
  ```
- Explicit `node:` protocol prefix on all built-in imports (enforced by zero-dependency constraint)
- No third-party imports anywhere in the repo

**Path Aliases:**
- Not applicable — no bundler or path aliases in use

## Error Handling

**Patterns (in `extension-kind-gate.mjs`):**
- Functions return `string[]` error lists (pure / no throws) rather than throwing exceptions
- Callers accumulate errors via `errors.push(...validateXxx())` and check `errors.length`
- `try/catch` wraps only I/O operations (`readFileSync`, `readdirSync`); errors are pushed as strings, not re-thrown
- `process.exit(1)` on failure, `process.exit(0)` on success — all in `main()`
- The top-level invocation wraps `main()` in a `try/catch` to surface unexpected errors

Example pattern:
```js
try {
  parsed = JSON.parse(readFileSync(oasPath, "utf8"));
} catch (err) {
  errors.push(`cinatra/oas.json failed to parse: ${err instanceof Error ? err.message : String(err)}`);
  return errors;
}
```

## Logging

**Framework:** `console.log` / `console.error` (no logging library)

**Patterns:**
- Success → `console.log` with a checkmark prefix string
- Failure → `console.error` with a cross prefix string and bullet-point list of violations
- CI steps use inline `echo` shell commands for step-level messaging

## Comments

**When to Comment:**
- Block comments at the top of `extension-kind-gate.mjs` explain the design constraints (zero-dependency, self-contained, exit code contract)
- Section dividers (`// ---...---`) separate logical subsections within the file
- Inline comments explain non-obvious decisions (e.g., why `npx` is used over `pnpm dlx`, why `node:` prefix)

**JSDoc/TSDoc:**
- JSDoc `/** */` comments on exported functions describe purpose and return type in plain English (not formal `@param`/`@returns` tags)

Example:
```js
/** Validate an agent extension at packageRoot. Pure: returns string[] errors. */
export function validateAgent(packageRoot) { ... }
```

## Module Design

**Exports:**
- Named exports only in `extension-kind-gate.mjs` — all validation functions are exported so they can be unit-tested or imported by the monorepo gate
- The `main()` function is NOT exported; it is guarded by a direct-invocation check:
  ```js
  const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
  if (invokedDirectly) { main(); }
  ```

**Barrel Files:**
- Not applicable — single utility file, no barrel pattern

## SKILL.md Authoring Conventions

- Frontmatter block (`---`) declares `name` and `description`
- Sections use `##` (H2) for major phases and `###` (H3) for sub-steps
- Inputs declared as a bullet list with type annotation and default value
- Constraints summarized in a `## Constraints` section after the step-by-step recipe
- Output format shown as a fenced JSON code block with a full example
- Output must be **strict JSON only** — no markdown wrapping, no prose preface

## OAS / Manifest Conventions

**`cinatra/oas.json`:**
- `agentspec_version` field declares the spec version (e.g., `"26.1.0"`)
- Inputs declared as an array with `title`, `type`, and optional `default`
- `metadata.cinatra` block carries runtime hints: `llm.preferredProvider`, `llm.preferredModel`, `hitlScreens`, `contextSlots`, `produces`

**`package.json`:**
- `"type": "module"` — ESM throughout
- `cinatra` block is the extension manifest: `apiVersion`, `kind: "agent"`, `dependencies`, `agentDependencies`, `produces`
- First-party `@cinatra-ai/*` runtime dependencies declared in `cinatra.dependencies` (not `dependencies`/`devDependencies`) — this is enforced by CI

---

*Convention analysis: 2026-06-09*
