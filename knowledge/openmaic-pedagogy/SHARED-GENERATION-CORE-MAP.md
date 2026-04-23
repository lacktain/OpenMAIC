# Shared Generation Core Map

## Why this note exists

The codebase currently has two real lesson-generation adapters:
- a browser-first preview adapter
- a server-side async classroom adapter

They share lower-level generators, but they do **not** share one canonical orchestration layer. This note records the exact boundary after a full code read so the next implementation steps stay disciplined.

## Relevant files read for this map

### Browser / GUI path
- `app/generation-preview/page.tsx`
- `app/generation-preview/types.ts`
- `app/generation-preview/components/visualizers.tsx`
- `lib/hooks/use-scene-generator.ts`
- `app/api/generate/scene-outlines-stream/route.ts`
- `app/api/generate/scene-content/route.ts`
- `app/api/generate/scene-actions/route.ts`
- `app/classroom/[id]/page.tsx`
- `lib/store/stage.ts`

### Server / job path
- `app/api/generate-classroom/route.ts`
- `lib/server/classroom-generation.ts`
- `lib/server/classroom-job-store.ts`
- `lib/server/resolve-model.ts`

### Shared generation / pedagogy core
- `lib/generation/outline-generator.ts`
- `lib/generation/scene-generator.ts`
- `lib/generation/lesson-blueprint.ts`
- `lib/generation/lesson-blueprint-ai.ts`
- `lib/generation/pipeline-types.ts`
- `lib/types/generation.ts`
- `lib/types/blueprint.ts`
- `lib/types/stage.ts`

## What the GUI path currently does

`app/generation-preview/page.tsx` currently owns the orchestration for the browser path.

It performs these steps directly:
1. parse PDF if needed
2. run optional web search
3. stream outlines from `/api/generate/scene-outlines-stream`
4. optionally generate agents
5. create a client-side `Stage`
6. generate the **first** scene by calling:
   - `/api/generate/scene-content`
   - `/api/generate/scene-actions`
7. generate blocking TTS for the first scene
8. persist to IndexedDB
9. navigate to `/classroom/[id]`
10. let `useSceneGenerator()` finish the remaining scenes in the classroom view

Important observation:
- the GUI path currently never runs `runBlueprintReviewGate(...)`
- it proceeds from streamed draft outlines straight into scene generation
- this is the main reason the pedagogical step was invisible in the browser flow

## What the server path currently does

`lib/server/classroom-generation.ts` owns the orchestration for the server/job path.

It performs these steps:
1. resolve the server model
2. optional web search
3. generate outlines via `generateSceneOutlinesFromRequirements(...)`
4. run `runBlueprintReviewGate(...)`
5. persist `stage.pedagogicalBlueprint`
6. generate agents
7. generate scenes from `approvedOutlines`
8. run optional media generation
9. run optional TTS generation
10. persist the classroom

Important observation:
- the server path is already the only place where the pedagogical blueprint gate is authoritative
- its approved blueprint is treated as the contract for downstream scene generation

## What is already shared

These pieces are already shared across the two adapters:
- `SceneOutline` and `Stage` contracts
- lower-level scene generation functions
- model-resolution helpers for API routes
- `lesson-blueprint.ts` and `lesson-blueprint-ai.ts`
- downstream prompt injection through `outline.pedagogicalMetadata`

That means the codebase is **not** split at the prompt/function level. It is split at the orchestration layer.

## Exact duplication / drift points

### 1. Outline-stage orchestration is duplicated
- GUI path builds prompt + streaming logic in `app/api/generate/scene-outlines-stream/route.ts`
- server path builds prompt + one-shot logic in `lib/generation/outline-generator.ts`

These are similar, but not one canonical entry.

### 2. Post-outline preflight is split
- server path: outline -> pedagogical blueprint review -> approved outlines
- GUI path: outline -> scene generation immediately

This is the critical divergence for the current feature.

### 3. Scene orchestration is duplicated at adapter level
- GUI preview manually generates the first scene in `app/generation-preview/page.tsx`
- classroom view resumes generation through `useSceneGenerator()`
- server path loops over approved outlines inside `lib/server/classroom-generation.ts`

Lower-level scene generators are shared, but the sequencing and progress semantics are not.

### 4. Progress semantics differ by adapter
- GUI preview uses local step indicators and SSE outline streaming
- classroom view uses Zustand state and resume semantics
- server path uses job progress callbacks and persisted job state

## The shared core boundary we should treat as canonical

The shared generation core should be:

1. normalize inputs already gathered by the adapter
2. generate first-pass outlines
3. run pedagogical preflight
   - build blueprint
   - run SME / Merrill / Schön review
   - adjudicate
   - revise if needed
   - return approved outlines and review artifacts
4. generate scenes from approved outlines
5. optional media / TTS
6. persist or hand back results

## What should remain adapter-specific

### GUI adapter responsibilities
- browser storage
- SSE / animated progress
- agent reveal UX
- teacher approval UI before continuing past blueprint review
- incremental first-scene experience and resume-on-classroom navigation

### Server adapter responsibilities
- async job lifecycle
- server-owned credentials and provider resolution
- persisted status polling
- headless persistence/export behavior

## Immediate implementation consequence

The next safe refactor is **not** a full pipeline rewrite.

The next safe refactor is:
1. introduce a shared pedagogical preflight service used by both adapters
2. make the GUI call that shared preflight after outline generation
3. persist the returned blueprint on the client-side `Stage`
4. pause the GUI flow for explicit teacher approval before scene generation continues

That gets the pedagogical step into the browser-visible flow now, while moving the architecture toward one canonical post-outline core.

## Follow-on refactor after this slice

Once the pedagogical preflight is shared, the larger consolidation target should be:
- a shared orchestration module for outline -> preflight -> scenes
- with GUI and server only differing in transport, persistence, and progress presentation

In other words:
- two entry adapters are fine
- two generation brains are not
