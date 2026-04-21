# Implementation Checklist

## Goal of the first coding slice
Add a minimal but real outline-stage quality gate to OpenMAIC without breaking the existing lesson-generation flow.

## Likely files to inspect and modify first

### Pipeline entry and orchestration
- `app/api/generate-classroom/route.ts`
- `lib/server/classroom-job-runner.ts`
- `lib/server/classroom-generation.ts`

### Stage-1 generation
- `lib/generation/outline-generator.ts`
- `lib/types/generation.ts`
- `lib/generation/pipeline-types.ts`

### Prompt system
- `lib/prompts/templates/requirements-to-outlines/`
- likely new prompt directories for blueprint review

### Tests
- `tests/server/`
- `tests/prompts/`
- maybe `tests/eval/`

## First coding slice, proposed sequence

### 1. Add new types
- define blueprint wrapper type
- define reviewer result types
- define adjudication result type
- keep compatibility with existing `SceneOutline`

### 2. Add planning and review modules
- add a blueprint normalization / wrapper module
- add SME review module
- add Merrill review module
- add Schön review module
- add adjudication module

### 3. Add review prompts
- one prompt per reviewer role
- one adjudication prompt
- optionally one revision prompt

### 4. Insert review gate in the server pipeline
In `lib/server/classroom-generation.ts`:
- after outline generation succeeds
- before the loop that generates scene content and actions

### 5. Define revision behavior
- if pass: proceed
- if revise: perform targeted outline revision or fail clearly in the first slice
- if fail: stop before full scene generation

### 6. Add tests
- schema parse and normalization tests
- reviewer result normalization tests
- adjudication decision tests
- pipeline behavior tests for pass / revise / fail

## What should NOT happen in the first coding slice
- do not redesign the whole rendering system
- do not rewrite all scene generation prompts at once
- do not hard-bake cloud-specific logic into the generic path too early
- do not require a full multi-provider ensemble on day one

## What a successful first slice looks like
- existing outline generation still works
- a review gate now exists between outline and scene generation
- bad lesson blueprints can be blocked or flagged for revision
- the system remains understandable and testable
- the architecture leaves room for later cloud-curriculum specialization
