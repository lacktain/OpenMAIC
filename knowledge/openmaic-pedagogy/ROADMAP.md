# Roadmap

## Phase 1, planning and fit analysis

### Goal
Translate the pedagogical vision into concrete OpenMAIC integration points.

### Deliverables
- mapped current generation pipeline
- proposed blueprint schema
- review criteria for SME, Merrill, and Schön
- pass / revise / fail policy
- list of files and modules likely to change

## Phase 2, outline contract design

### Goal
Introduce a lesson-blueprint concept that is stricter than the current scene outline.

### Deliverables
- blueprint schema draft
- scene-level pedagogical metadata
- review output schema
- adjudication contract for downstream generation

## Phase 3, first implementation slice

### Goal
Add a minimal pre-generation review gate without breaking current OpenMAIC flows.

### Likely scope
- outline generation path
- new reviewer modules
- prompt templates for review
- result normalization
- failure / revision behavior
- tests

## Phase 4, curriculum alignment slice

### Goal
Adapt the pedagogical system toward the cloud-infrastructure curriculum target.

### Deliverables
- learner profile defaults for vocational cloud students
- curriculum-specific planning heuristics
- cloud-domain SME checks
- sequence tuning for weekly progression

## Phase 5, hardening and shareability

### Goal
Make the changes understandable, testable, and upstream-friendly.

### Deliverables
- documentation
- tests
- configuration strategy
- clean commit history
- possible upstream proposal notes

## Open questions
- Should blueprint review happen only once, or iteratively until threshold pass?
- Should the SME step use retrieval or fixed curriculum references from local materials?
- How much freedom should downstream scene generation retain after blueprint approval?
- Should reflective-practice checks be global or only applied to suitable lesson types?
- How should cost tiering work between normal generation and premium review mode?
