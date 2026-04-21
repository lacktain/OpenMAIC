# Integration Points in the Current OpenMAIC Codebase

## Why this document exists

The pedagogical improvement track should fit the current OpenMAIC pipeline cleanly. This note maps the most likely integration points before any code changes are made.

## Current pipeline, as observed

### Entry
- `app/api/generate-classroom/route.ts`
  - receives user requirement
  - creates a background generation job

### Job runner
- `lib/server/classroom-job-runner.ts`
  - runs the classroom generation pipeline
  - updates progress

### Main server pipeline
- `lib/server/classroom-generation.ts`
  - resolves the model
  - optionally runs search
  - calls outline generation
  - resolves agents
  - loops through outlines to generate scene content and actions
  - runs optional media and TTS
  - persists the classroom

### Outline generation
- `lib/generation/outline-generator.ts`
  - `generateSceneOutlinesFromRequirements(...)`
  - creates the first-pass scene structure from the user requirement
  - currently returns `languageDirective` and `outlines`

### Scene generation
- `lib/generation/scene-generator.ts`
  - `generateSceneContent(...)`
  - `generateSceneActions(...)`
  - creates full lesson scenes from the outline

### Current stage-1 output type
- `lib/types/generation.ts`
  - `SceneOutline`
  - this is currently the main outline contract for downstream generation

## Architectural observation

The best insertion point for the new pedagogical quality layer is between:
- outline generation, and
- full scene generation.

That means the likely flow should become:
1. generate draft outline / blueprint
2. review draft blueprint
3. revise or approve blueprint
4. generate full scenes from approved blueprint

## Most likely new modules to introduce

### New type layer
Potential location:
- `lib/types/generation.ts`, or a new sibling file such as `lib/types/blueprint.ts`

Potential additions:
- lesson blueprint type
- pedagogical metadata per scene
- review verdict schema
- revision request schema
- adjudication result schema

### New review orchestration layer
Potential location:
- `lib/generation/` or `lib/server/`

Potential additions:
- blueprint reviewer orchestrator
- SME review module
- Merrill review module
- Schön review module
- adjudication module

### New prompts
Potential location:
- `lib/prompts/templates/`

Potential additions:
- blueprint planner prompt
- SME review prompt
- Merrill review prompt
- Schön review prompt
- adjudication prompt
- revision prompt

### New tests
Potential location:
- `tests/server/`
- `tests/prompts/`
- maybe `tests/eval/`

Potential additions:
- blueprint schema tests
- review normalization tests
- pass / revise / fail behavior tests
- contract-preservation tests for downstream generation

## Likely minimal-change implementation strategy

### Step 1
Extend the outline-stage contract rather than replacing the whole generation system.

### Step 2
Insert a review gate inside `lib/server/classroom-generation.ts` after outline generation succeeds and before scene generation begins.

### Step 3
Initially keep downstream scene generation mostly intact, but feed it richer blueprint metadata.

### Step 4
Only after that, tighten downstream generation so it respects the approved blueprint as a stronger contract.

## Early schema hypothesis

The current `SceneOutline` type likely needs future fields such as:
- learning objective
- prerequisite assumptions
- pedagogical role
- Bloom / progression metadata
- scaffolding notes
- assessment purpose
- reflective-practice hooks
- factual risk notes

It may be cleaner to introduce a new `LessonBlueprint` wrapper rather than overloading `SceneOutline` too quickly.

## Notes on SME quality review

If the factual quality target is textbook-like, the review layer should not rely only on free-form critique. It likely needs:
- explicit claims to inspect,
- evidence-aware review,
- issue classification,
- and a revision contract.

## Notes on cloud-curriculum alignment

The current generic outline generator will eventually need domain-specific grounding for the cloud-infrastructure target. That should happen only after the general blueprint and review architecture exists.

## Immediate next planning task

Define the new blueprint schema and the review verdict format before writing pipeline code.
