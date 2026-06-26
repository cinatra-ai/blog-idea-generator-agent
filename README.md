# Blog Idea Generator Agent

Turn a short brief into a batch of distinct blog post ideas you can pick from. Provide a topic, audience, and tone — the agent returns several ready-to-evaluate ideas, each with a working title, a one-paragraph summary, and a numbered outline you can hand straight to a draft writer.

Install via the Cinatra marketplace. No credentials are required; the agent is stateless and makes a single LLM call per run. To configure brand voice context, attach a Brand Voice artifact in the context slot before running. Pass `brief` (required), and optionally `audience`, `count` (default 5, max 10), `tone`, `existingIdeasContext` (titles to avoid), and `referenceContent` (transcript or notes to draw themes from). The agent returns a JSON object `{ideas:[{title,summary,outline}], notes}`. If `brief` is empty the agent returns `{ideas:[], notes:"brief is required"}` immediately. Titles that overlap with `existingIdeasContext` are excluded. For troubleshooting, verify that `brief` is non-empty and that any attached Brand Voice artifact is published; the agent does not call external tools or the web.

## Works with

- Cinatra Blog Draft Writer Agent
- Cinatra Brand Voice Artifact

## Capabilities

- Generate a configurable batch of distinct blog post ideas from a short brief
- Tailor every idea to a specified audience and tone
- Produce a working title, one-paragraph summary, and outline for each idea
- Skip titles already covered using an exclusion list
- Draw thematic inspiration from reference content such as transcripts or notes
- Inject brand voice context via an optional artifact slot
