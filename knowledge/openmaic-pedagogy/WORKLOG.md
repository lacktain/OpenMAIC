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

### Implementation loop 3, job/API review visibility
- Extended classroom job success payloads in `lib/server/classroom-job-store.ts` with a compact blueprint-review summary instead of forcing later consumers to re-open the persisted classroom just to understand what happened.
- Successful job results now include:
  - `stageName`
  - `blueprintReview.revisionCount`
  - `blueprintReview.releaseForSceneGeneration`
  - `blueprintReview.approvedSceneCount`
  - compact reviewer verdict/score rows
- Kept the change backward-compatible by only including `blueprintReview` when the stage actually has pedagogical blueprint data.
- Added `tests/server/classroom-job-store.test.ts` to verify both:
  - blueprint summary persistence on successful pedagogical runs
  - unchanged success-result behavior when no blueprint metadata exists

### Implementation loop 3, checks and findings
- Re-ran formatting, type-checking, and the full server test suite after the job-store change.
- Current green state: `7` server test files, `52` tests passing.

### Implementation loop 4, prompt-driven review modules and hybrid live gate
- Added `lib/generation/lesson-blueprint-ai.ts` as the prompt-facing review orchestration layer.
  - normalizes prompt reviewer/adjudicator outputs
  - merges prompt results with heuristic fallbacks in hybrid mode
  - supports prompt-driven revision attempts with schema validation
- Added dedicated prompt IDs and templates for:
  - SME review
  - Merrill review
  - Schön review
  - adjudication
  - revision
- Upgraded `runBlueprintReviewGate(...)` so it can run in:
  - `heuristic`
  - `prompt`
  - `hybrid`
- The live classroom pipeline now uses the hybrid blueprint gate and emits clearer progress/error behavior around review rounds.
- Added richer review-round metadata (`reviewMode`, `reviewRounds`) and structured `BlueprintReviewError` reporting for prompt-driven failures.
- Existing test coverage now includes prompt/hybrid review behavior and prompt-driven fail surfacing in `tests/server/pedagogical-blueprint-review.test.ts`.

### Current implementation state
- The repo now contains a real, tested outline-stage pedagogical blueprint/review gate.
- That gate is integrated into live classroom generation, can operate in heuristic/prompt/hybrid modes, influences downstream scene prompts, persists onto the stage, and now also surfaces a compact review summary through the async job/status path.
- Cloud-infrastructure alignment currently exists as lightweight learner/outcome/risk heuristics, not yet as a full curriculum graph.
- The next highest-value slice is probably one of:
  1. add eval coverage around blueprint-guided scene generation quality, not just schema/pipeline behavior
  2. start curriculum-aware mapping from the cloud-infra materials into blueprint outcomes/themes without over-specializing the generic path
  3. improve operator/debug visibility for per-round prompt review traces in a safe compact form

### Packaging and deployment prep for external testing
- Added a first external-deployment packaging pass for the pedagogical branch.
- `docker-compose.yml` is now more production-friendly for swap testing:
  - explicit image/build settings
  - production env defaults
  - stable container name
  - named persistent volume
  - basic internal healthcheck
- Added `knowledge/openmaic-pedagogy/DEPLOYMENT.md` with clone/build/run notes for a separate environment with its own keys and `ACCESS_CODE`.
- Also have in-flight cloud-curriculum mapping changes to tie blueprint themes, outcomes, and prerequisites more directly to the 19-week cloud-infrastructure material.

### Push status
- Local commit/push preparation is in progress, but the repo currently only has the public upstream OpenMAIC remote configured.
- A writable remote or fork is still needed before the branch can be pushed externally.

## 2026-04-23

### Shared-core mapping and GUI pedagogical gate
- Added `knowledge/openmaic-pedagogy/SHARED-GENERATION-CORE-MAP.md` after a full code read of the relevant GUI and server paths.
  - explicitly maps the browser adapter, server/job adapter, and the shared lower-level generation core
  - identifies the real divergence as orchestration, not scene-generation primitives
  - records the architectural decision to treat post-outline pedagogical preflight as the first shared canonical slice
- Added `lib/generation/pedagogical-preflight.ts` as a shared wrapper around the outline-stage pedagogical gate.
  - both adapters can now depend on the same post-outline review contract instead of each growing their own review logic
  - returns GUI-friendly review events in addition to the approved blueprint result
- Refactored `lib/server/classroom-generation.ts` to call the shared pedagogical preflight wrapper instead of directly owning the gate call.
  - behavior remains the same for the async job path
  - this keeps the server path aligned while the browser path is brought onto the same review contract
- Added `app/api/generate/pedagogical-step/route.ts`.
  - runs the same hybrid SME / Merrill / Schön review flow for the GUI path using the browser-selected model headers
  - returns blueprint, reviewer verdicts, adjudication, approved outlines, review rounds, and display events
- Updated the GUI preview flow in `app/generation-preview/page.tsx`, `types.ts`, and `components/visualizers.tsx`.
  - inserted a dedicated `pedagogical-review` step after outline generation and before agent/scene generation
  - persists the pedagogical review result in session storage so a refresh cannot silently skip the teacher gate
  - writes `stage.pedagogicalBlueprint` on the client stage before classroom generation continues
  - pauses the GUI flow for explicit teacher approval before the first scene is generated
- Added `app/generation-preview/components/pedagogical-review-panel.tsx`.
  - shows reviewer verdicts and scores for SME / Merrill / Schön
  - shows review timeline events and approved-outline preview
  - exposes an explicit `Approve blueprint and continue` control before scene generation resumes
- Added i18n step labels for the new pedagogical review phase in all shipped locales.
- Added `tests/server/pedagogical-preflight.test.ts` for the new shared wrapper/event behavior.
- Re-ran focused validation after the change:
  - `corepack pnpm exec prettier --write ...`
  - `corepack pnpm exec tsc --noEmit`
  - `corepack pnpm exec vitest run tests/server/pedagogical-preflight.test.ts tests/server/pedagogical-blueprint-review.test.ts tests/server/classroom-generation-blueprint.test.ts`

### Import/export preservation for teacher-reviewed classrooms
- Patched local stage persistence so the full `Stage` shape is stored instead of a narrow whitelist.
  - this preserves `stage.pedagogicalBlueprint` when a reviewed classroom is saved locally and later reopened or exported
- Extended classroom ZIP manifests to carry `stage.pedagogicalBlueprint`.
  - exported teacher-reviewed classrooms now retain their pedagogical review metadata when shared between installations
- Updated classroom ZIP import to restore the pedagogical blueprint into the receiving installation's local stage record.
  - this keeps the review contract intact for teacher-to-student and teacher-to-teacher sharing flows
- Added/updated validation for the round trip:
  - `tests/export/classroom-zip.test.ts`
  - `tests/utils/stage-storage.test.ts`
  - `tests/server/classroom-generation-blueprint.test.ts`
- Re-ran validation after the import/export preservation patch:
  - `corepack pnpm exec vitest run tests/export/classroom-zip.test.ts tests/utils/stage-storage.test.ts tests/server/classroom-generation-blueprint.test.ts`
  - `corepack pnpm exec tsc --noEmit`

