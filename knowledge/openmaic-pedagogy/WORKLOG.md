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

### No code changes yet
This iteration establishes the separate workspace and planning baseline only.

### Implementation loop 1, blueprint review gate foundation
Implemented the first real coding slice for the pedagogical review architecture.

Main changes:
- Added `lib/types/blueprint.ts` with typed schemas for:
  - lesson blueprints
  - pedagogical scene metadata
  - reviewer results
  - adjudication results
- Added `lib/generation/lesson-blueprint.ts` with:
  - blueprint creation from first-pass outlines
  - heuristic SME / Merrill / Schön review passes
  - adjudication logic
  - revision logic that can strengthen weak outline plans before scene generation
- Extended `SceneOutline` with optional `pedagogicalMetadata`
- Extended `Stage` with persisted `pedagogicalBlueprint` review data
- Inserted a new blueprint review phase in `lib/server/classroom-generation.ts`
  - outlines are now reviewed and potentially revised before full scene generation
  - approved outlines, not raw outlines, now drive downstream scene creation
- Updated `lib/generation/scene-generator.ts` so downstream prompts receive an approved pedagogical contract context, including Merrill phase, support level, reflective cues, factual-risk cues, and preserve constraints
- Added `tests/server/pedagogical-blueprint-review.test.ts`

Validation completed:
- TypeScript: `corepack pnpm exec tsc --noEmit`
- Server tests: `corepack pnpm exec vitest run tests/server`
- Formatting checks completed on changed implementation files

Current observation:
- The first slice is a strong foundation, but the review logic is still heuristic and local. It is not yet a full multi-model SME panel or retrieval-backed factual verifier.

Next likely step:
- replace or augment heuristic review logic with prompt-driven reviewer modules and clearer pass / revise / fail control in the live generation path.
