# Worklog

## 2026-04-21

### Initialized separate working copy
- Created dedicated working folder: `projects/openMAIC-pedagogical`
- Created branch: `pedagogy-review-pipeline`
- Moved planning docs into `knowledge/openmaic-pedagogy/` because `/docs` is gitignored in upstream OpenMAIC
- Intention: keep pedagogical improvements isolated, shareable, and upstream-friendly

### Current architectural conclusion
- OpenMAIC already has a first-pass outline generation step before full scene generation
- That outline stage is the correct insertion point for pedagogical grounding and factual review
- The key improvement direction is to transform the outline into a reviewed lesson blueprint

### Current design direction
Planned review lenses:
1. SME factual and decomposition review
2. Merrill-based instructional review
3. Schön-based reflective-practice review

### Current target learner
- Second-year vocational cloud-infrastructure student

### Curriculum dependency still needed
To fully align the implementation with the earlier 19 academic weeks, gather or reconstruct:
- weekly themes and subthemes
- learning outcomes
- core concepts and skills
- lab / project expectations
- assessment patterns
- terminology conventions

### Implementation loop 1, outline-stage blueprint/review gate landed
- Added `lib/types/blueprint.ts` with explicit schemas and types for:
  - lesson intent, outcomes, prerequisites, and theme graph
  - per-scene pedagogical metadata
  - reviewer issues/results and adjudication
  - persisted `PedagogicalBlueprintRecord`
- Extended existing generation/stage contracts without breaking the current pipeline:
  - `SceneOutline` now accepts optional `pedagogicalMetadata`
  - `Stage` now accepts optional `pedagogicalBlueprint`
- Added `lib/generation/lesson-blueprint.ts` as the first real pedagogical layer between outline generation and scene generation.
  - Builds a normalized lesson blueprint from raw scene outlines
  - Reviews it through SME, Merrill, and Schön lenses
  - Revises weak blueprints once by default
  - Converts approved blueprint scenes back into downstream-compatible `SceneOutline[]`
- Integrated the gate into `lib/server/classroom-generation.ts`.
  - New progress step: `reviewing_blueprint`
  - Scene generation now runs on `approvedOutlines`, not raw outline output
  - Approved blueprint review artifacts are persisted onto `stage.pedagogicalBlueprint`
- Added pedagogical-context propagation into `lib/generation/scene-generator.ts` so approved outline metadata influences downstream prompt context instead of being dropped.

### Implementation loop 1, checks and findings
- Installed repo dependencies locally with `corepack pnpm install --frozen-lockfile`.
- Added `tests/server/pedagogical-blueprint-review.test.ts` covering:
  - reviewer detection of weak sequencing
  - revise-to-pass behavior
  - vocational cloud-infrastructure heuristic alignment
- Fixed type issues surfaced by `tsc --noEmit`, especially around nullable helpers and quiz question-type compatibility.
- Ran and passed:
  - `corepack pnpm exec vitest run tests/server/pedagogical-blueprint-review.test.ts`
  - `corepack pnpm exec tsc --noEmit`
  - `corepack pnpm exec vitest run tests/server`

### Implementation loop 2, pipeline integration hardening
- Fixed a real orchestration bug in `lib/server/classroom-generation.ts`:
  - if generated agent creation fails, the pipeline now truly falls back to default-agent persistence (`agentIds`) instead of incorrectly emitting `generatedAgentConfigs` for default agents.
- Added `tests/server/classroom-generation-blueprint.test.ts` to cover server-pipeline behavior, not just pure blueprint heuristics.
  - verifies the blueprint gate is inserted before scene generation
  - verifies approved outlines are the ones rendered into scenes
  - verifies pedagogical blueprint data is persisted on the stage
  - verifies `reviewing_blueprint` progress updates are emitted
  - verifies blueprint-review failure stops the pipeline before scene generation/persistence
  - verifies generate-mode agent fallback uses default agent persistence correctly
- Reformatted touched files with Prettier.

### Implementation loop 2, checks and findings
- Re-ran full relevant checks after the new integration tests:
  - `corepack pnpm exec prettier --check ...`
  - `corepack pnpm exec tsc --noEmit`
  - `corepack pnpm exec vitest run tests/server`
- Current green state: `6` server test files, `50` tests passing.

### Current implementation state
- The repo now contains a real, tested outline-stage pedagogical blueprint/review gate.
- The current slice is intentionally heuristic-first and upstream-friendly.
- Cloud-infrastructure alignment exists as lightweight learner/outcome/risk heuristics, not as a hard-coded curriculum fork.
- The next highest-value slice is probably one of:
  1. expose review artifacts more cleanly through job/API surfaces for UI/debug visibility
  2. add prompt/template and eval coverage around blueprint-guided scene generation quality
  3. start introducing curriculum-aware mapping from the cloud-infra materials into blueprint outcomes/themes without over-specializing the generic path

